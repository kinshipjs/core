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

    /** @type {{ trigger: TriggerCallback<any>|undefined, hook: TriggerHookCallback|undefined }[]} */ #before;

    /** @type {{ trigger: TriggerCallback<any>|undefined, hook: TriggerHookCallback|undefined }[]} */ #after;
    
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
     * @param {import("../models/maybe.js").MaybeArray<T>|undefined} records
     * @param {...any} args
     * @returns {Promise<{ numRowsAffected: number, records: T[], whereClause?: WhereBuilder<T>}>}
     */
    async handle(promise, records, ...args) {
        let state = await promise;
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
            const data = await this._execute(state, records, ...args);
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
     * @returns {() => void}
     */
    after(callback, hook) {
        if(hook === undefined) {
            hook = () => ({});
        }
        this.#after = [...this.#after, { trigger: callback, hook }];
        return this.afterUnsubscribe;
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
     * @returns {() => void}
     */
    before(callback, hook) {
        if(hook === undefined) {
            hook = () => ({});
        }
        this.#before = [...this.#before, { trigger: callback, hook }];
        return () => this.beforeUnsubscribe(this.#before.length);
    }

    /**
     * Unsubscribe the `before` trigger.
     * @param {number} n
     */
    beforeUnsubscribe(n) {
        this.#before.splice(n, 1);
    }

    /**
     * Unsubscribe the `before` trigger.
     */
    afterUnsubscribe(n) {
        this.#after.splice(n, 1);
    }

    /**
     * @template {object|undefined} TAliasModel
     * Type of the model that the table represents.
     * @param {TAliasModel[]} records
     */
    async #applyBefore(records) {
        for(const { trigger, hook } of this.#before) {
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
        }
    }

    /**
     * @template {object|undefined} TAliasModel
     * Type of the model that the table represents.
     * @param {TAliasModel[]} records
     */
    async #applyAfter(records) {
        for(const { trigger, hook } of this.#after) {
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
        }
    }

    /**
     * Must be implemented by child class.
     * @protected
     * @template {object|undefined} TAliasModel
     * @param {import("../context/context.js").State} state
     * @param {import("../models/maybe.js").MaybeArray<TAliasModel>|Function|undefined} records
     * @param {...any} args
     * @returns {Promise<{ numRowsAffected: number, records: TAliasModel[]}>}
     */
    async _execute(state, records, ...args) {
        throw new KinshipImplementationError(`Child class must implement the function, "._execute".`);
    }

    /**
     * @protected
     * @param {any} state
     * @param {object[]} records
     * @returns {{ cmd: string, args: any[] }}
     */
    _serialize(state, records, ...args) {
        throw new KinshipImplementationError(`Child class must implement the function, "._serialize".`);
    }

    /**
     * Serializes an array of rows to a user-friendly object.
     * @param {boolean} isGroupBy
     * @param {boolean} isJoined
     * @param {object[]} rows 
     * @param {Record<string, import("../adapter.js").SchemaColumnDefinition>} schema
     * @param {import("../config/relationships.js").Relationships<object>} relationships
     * @param {number} depth 
     * Used for when the command had a group by clause.
     */
    /**
     * Serializes an array of rows to a user-friendly object.
     * @param {boolean} isGroupBy
     * @param {boolean} isJoined
     * @param {object[]} rows 
     * @param {Record<string, import("../adapter.js").SchemaColumnDefinition>} schema
     * @param {import("../config/relationships.js").Relationships<object>} relationships
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
                        || Optimized.filter(Object.values(relatedRowsSerialized[0]), (v) => v != null && v != []).length <= 0) {
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
     * @param {import("../context/context.js").State} state
     * @returns {import("../context/context.js").AdapterReadyState}
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
 * @callback TriggerHookCallback
 * @param {number} numRecords
 * @returns {import("../models/maybe.js").MaybePromise<any>}
 */