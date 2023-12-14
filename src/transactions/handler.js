//@ts-check

import { KinshipBase } from "../context/base.js";
import { Optimized, assertAsArray, getFilterConditionsFromWhere } from "../context/util.js";
import { WhereBuilder } from "../clauses/where.js";
import { KinshipInternalError } from "../exceptions.js";
import { RelationshipType } from "../config/relationships.js";

/**
 * Base class for handling execution of a given command.
 */
export class KinshipExecutionHandler {
    /** @protected @type {KinshipBase} */ base;
    /** @type {TriggerProperties[]} */ #before;
    /** @type {TriggerProperties[]} */ #after;
    
    /**
     * Construct a new Execution handler that will handle the before and after triggers, 
     * as well as the execution of the adapter's command.
     * @param {KinshipBase} kinshipBase 
     */
    constructor(kinshipBase) {
        this.base = kinshipBase;
        this.#before = [];
        this.#after = [];
    }

    /**
     * Handles the execution of a command and its respective triggers if any exist.
     * @template {object} T
     * @param {Promise<import("../context/context.js").State>} promise
     * @param {{ records?: import("../models/maybe.js").MaybeArray<T>|undefined, callback?: Function, transaction?: any, truncate?: boolean }=} data
     * @returns {Promise<{ numRowsAffected: number, records: T[], whereClause?: WhereBuilder<T>}>}
     */
    async handle(promise, data) {
        let { records, callback, transaction, truncate } = { callback:undefined, records: undefined, transaction: undefined, truncate: undefined, ...data };
        // await the promise so the state is in sync.
        let state = await promise;
        // prepare the state for adapter usage.
        state = this.#prepareState(state);
        if(!state) {
            throw new KinshipInternalError();
        }
        if(records) {
            records = assertAsArray(records);
            if(records.length <= 0) {
                return {
                    numRowsAffected: 0,
                    records: []
                }
            }
        } else {
            records = [];
        }
        try {
            await this.#applyBefore(records);
            const data = await this._execute(state, records ? records : callback, transaction, truncate);
            data.records = this.#serializeRows(state.groupBy !== undefined, state.from.length > 1, data.records) ?? [];
            await this.#applyAfter(data.records);
            return data;
        } catch(err) {
            throw err;
        }
    }

    /**
     * Creates a trigger, `callback`, on the context that is called for every record after a command has been executed
     * within the adapter. This trigger can use data returned from `hook` as static data arguments to avoid 
     * unnecessary calls to retrieve data.  
     * If a property is set on the record within the trigger, then the property will only get set if the property key
     * does not already exist.  
     * If you wish to override this, then you may prepend `__` to the property you wish to change.
     * @template {object|undefined} TAliasModel
     * Type of the model that the table represents.
     * @param {TriggerCallback<TAliasModel>} callback
     * @param {TriggerHookCallback=} hook
     * @returns {TriggerManager}
     */
    after(callback, hook) {
        if(hook === undefined) {
            hook = () => ({});
        }
        this.#after = [...this.#after, { trigger: callback, hook }];
        const n = this.#before.length;
        return {
            once: () => {
                this.#after[n].once = true;
            },
            unsubscribe: () => {
                this.afterUnsubscribe(n);
            }
        }
    }

    /**
     * Creates a trigger, `callback`, on the context that is called for every record before a command has been executed
     * within the adapter. This trigger can use data returned from `hook` as static data arguments to avoid 
     * unnecessary calls to retrieve data.  
     * If a property is set on the record within the trigger, then the property will only get set if the property key
     * does not already exist.  
     * If you wish to override this, then you may prepend `__` to the property you wish to change.
     * @template {object|undefined} TAliasModel
     * Type of the model that the table represents.
     * @param {TriggerCallback<TAliasModel>} callback
     * @param {TriggerHookCallback=} hook
     * @returns {TriggerManager}
     */
    before(callback, hook) {
        if(hook === undefined) {
            hook = () => ({});
        }
        this.#before = [...this.#before, { trigger: callback, hook }];
        const n = this.#before.length;
        // return () => this.beforeUnsubscribe(this.#before.length);
        return {
            once: () => {
                this.#before[n].once = true;
            },
            unsubscribe: () => {
                this.beforeUnsubscribe(n);
            }
        }
    }

    /**
     * Unsubscribe the `before` trigger.
     * @param {number} index
     * Index of the trigger in the array.
     */
    beforeUnsubscribe(index) {
        this.#before.splice(index, 1);
    }

    /**
     * Unsubscribe the `after` trigger.
     * @param {number} index
     * Index of the trigger in the array.
     */
    afterUnsubscribe(index) {
        this.#after.splice(index, 1);
    }

    /**
     * Apply all before triggers that are on this context.
     * @template {object|undefined} TAliasModel
     * Type of the model that the table represents.
     * @param {TAliasModel[]} records
     * Records that are relevant to the command and will be used in the trigger.
     */
    async #applyBefore(records) {
        let n = 0;
        for(const { trigger, hook, once } of this.#before) {
            let args = [];
            if(trigger) {
                if(hook) {
                    args = await hook(records.length);
                }
                for(let i = 0; i < records.length; ++i) {
                    const record = records[i];
                    await trigger(record, { $$itemNumber: i, ...args });
                }
            }
            if(once) {
                this.beforeUnsubscribe(n);
            }
            n++;
        }
    }

    /**
     * Apply all after triggers that are on this context.
     * @template {object|undefined} TAliasModel
     * Type of the model that the table represents.
     * @param {TAliasModel[]} records
     * Records that are relevant to the command and will be used in the trigger.
     */
    async #applyAfter(records) {
        let n = 0;
        for(const { trigger, hook, once } of this.#after) {
            let args = [];
            if(trigger) {
                if(hook) {
                    args = await hook(records.length);
                }
                for(let i = 0; i < records.length; ++i) {
                    const record = records[i];
                    await trigger(record, { $$itemNumber: i, ...args });
                }
            }
            if(once) {
                this.beforeUnsubscribe(n);
            }
            n++;
        }
    }

    /**
     * Must be implemented by child class.
     * @protected
     * @template {object|undefined} TAliasModel
     * @param {import("../context/context.js").State} state
     * @param {import("../models/maybe.js").MaybeArray<TAliasModel>|Function|undefined} records
     * @param {any=} transaction
     * @param {boolean=} truncate
     * @returns {Promise<{ numRowsAffected: number, records: TAliasModel[]}>}
     */
    async _execute(state, records, callback=undefined, transaction=undefined, truncate=undefined) {
        throw new KinshipImplementationError(`Child class must implement the function, "._execute".`);
    }

    /**
     * Must be implemented by child class.
     * @protected
     * @param {any} state
     * @param {object[]} records
     * @param {...any} args
     * @returns {{ cmd: string, args: any[] }}
     */
    _serialize(state, records, ...args) {
        throw new KinshipImplementationError(`Child class must implement the function, "._serialize".`);
    }

    /**
     * Recursively serializes an array of rows to an array of user-friendly objects.
     * @param {boolean} isGroupBy
     * True if the command was a group by command
     * @param {boolean} isJoined
     * True if the command has a `LEFT JOIN` clause on it.
     * @param {object[]} rows 
     * @param {Record<string, import("../adapter.js").SchemaColumnDefinition>} schema
     * @param {import("../config/relationships.js").Relationships<object>} relationships
     * @param {import("../config/relationships.js").Relationships<object>} lastRelationships
     * @param {number} depth 
     * Used for when the command had a group by clause.
     */
    #serializeRows(isGroupBy, 
        isJoined,
        rows, 
        table=this.base.tableName, 
        schema=this.base.schema, 
        relationships=this.base.relationships,
        lastRelationships=relationships,
        depth = 0
    ) {
        if(!isJoined) return rows;
        if(rows.length <= 0) return rows;
        if("$$count" in rows[0]) return rows;
        const pKeys = this.base.getPrimaryKeys(table, lastRelationships);
        const uniqueRowsByPrimaryKey = isGroupBy 
            ? rows 
            : Optimized.getUniqueObjectsByKeys(rows, Optimized.map(pKeys, key => key.commandAlias));
        let serializedRows = [];
        for(let i = 0; i < uniqueRowsByPrimaryKey.length; ++i) {
            const row = uniqueRowsByPrimaryKey[i];
            const newRow = Optimized.getObjectFromSchemaAndRecord(schema, row);
            if(isGroupBy && depth === 0) {
                Optimized.assignKeysThatStartWith$To(row, newRow);
            }
            for(let key in relationships) {
                const relationship = relationships[key];
                const relatedRows = isGroupBy 
                    ? [row] 
                    : Optimized.getRelatedRows(
                        rows, 
                        row[relationship.primary.alias], 
                        relationship.foreign.alias
                    );
                // recurse with a new scope of records of only related records.
                const relatedRowsSerialized = this.#serializeRows(isGroupBy,
                    isJoined,
                    relatedRows,
                    relationship.table,
                    relationship.schema, 
                    relationship.relationships,
                    relationships,
                    depth + 1
                );

                // set based on the type of relationship this is.
                // group by makes every record unique, and thus every related record would become 1:1.
                if(relationship.relationshipType === RelationshipType.OneToOne || isGroupBy) {
                    if(relatedRowsSerialized == null 
                        || relatedRowsSerialized.length <= 0 
                        || Optimized.filter(Object.values(relatedRowsSerialized[0]), (v) => v != null).length <= 0) {
                        newRow[key] = null;
                    } else {
                        newRow[key] = relatedRowsSerialized?.[0] ?? null;
                    }
                } else {
                    newRow[key] = relatedRowsSerialized;
                }
            }
            serializedRows.push(newRow);
        }
        const filtered = Optimized.filter(serializedRows, row => Optimized.filter(Object.values(row), val => val != null).length > 0);
        return filtered.length <= 0 ? null : filtered;
    }

    /**
     * Prepare the state so it is ready for usage with the respective adapter.
     * @param {import("../context/context.js").State} state
     * State of the context built by Kinship
     * @returns {import("../context/context.js").AdapterReadyState}
     * State of the context, slightly altered so it is ready for usage with the adapter.
     */
    #prepareState(state) {
        return {
            ...state,
            conditions: getFilterConditionsFromWhere(state.where)
        }
    }
}

class KinshipImplementationError extends Error {
    constructor(msg) {
        super(msg);
        this.name = "KinshipImplementationError";
    }
}

/** 
 * @template {object|undefined} T 
 * @typedef {{[K in keyof T as `__${K & string}`]: T[K]}} TriggerModelSetProperties
 */

/**
 * Callback used as a trigger when a record is inserted/updated/deleted.  
 * This is called for every row that is inserted/updated/deleted before or after, based on what is specified.
 * @template {object|undefined} TModel 
 * Model of the table that the record is represented as. 
 * @callback TriggerCallback
 * @param {TModel & TriggerModelSetProperties<TModel>} model
 * The record that is being worked on.
 * @param {{[key: string]: any} & { $$itemNumber: number }} hookArgs
 * Data that is retrieved from the hook.  
 * `$$itemNumber` is a static number that represents the position of the item in the array.
 * @returns {import("../models/maybe.js").MaybePromise<void>}
 * Promise of void or void.
 */

/**
 * Callback used to prepare static arguments for the trigger.  
 * This is called once BEFORE the triggers are called and the returned object is flattened and passed into the `hookArgs` property in {@link TriggerCallback}
 * @callback TriggerHookCallback
 * @param {number} numRecords
 * Number of records that are being worked on.
 * @returns {import("../models/maybe.js").MaybePromise<object>}
 * Object or Promise that returns an object that will be spread into the `hookArgs` property of {@link TriggerCallback}.
 */

/**
 * Various functions to handle a trigger
 * @typedef {object} TriggerManager
 * @prop {() => void} once
 * Unsubscribe from the trigger after the trigger has fired once.
 * @prop {() => void} unsubscribe
 * Unsubscribe from the trigger.
 */

/**
 * Properties that define a trigger's behavior.
 * @typedef {object} TriggerProperties
 * @prop {TriggerCallback<any>|undefined} trigger
 * Callback that will be fired for every record relevant to the command.
 * @prop {TriggerHookCallback|undefined} hook
 * Callback that will be fired once and sets up static arguments for the `trigger` callback
 * @prop {boolean=} once
 * If true, then the event will only fire once. 
 */