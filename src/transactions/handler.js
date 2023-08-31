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

    /** @type {TriggerCallback<any>=} */ #before;
    /** @type {TriggerHookCallback=} */ #beforeHook;

    /** @type {TriggerCallback<any>=} */ #after;
    /** @type {TriggerHookCallback=} */ #afterHook;
    
    /**
     * Construct a new Execution handler that will handle the before and after triggers, 
     * as well as the execution of the adapter's command.
     * @param {KinshipBase} kinshipBase 
     */
    constructor(kinshipBase) {
        this.base = kinshipBase;
        this.#before = undefined;
        this.#beforeHook = undefined;
        this.#after = undefined;
        this.#afterHook = undefined;
    }

    /**
     * Handles the execution of a command and its respective triggers if any exist.
     * @template {object} T
     * @param {import("../models/maybe.js").MaybeArray<T>|undefined} records
     * @param {...any} args
     * @returns {Promise<{ numRowsAffected: number, records: T[], whereClause?: WhereBuilder<T>}>}
     */
    async handle(records, ...args) {
        let state = await this.base.resync();
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
            //@ts-ignore
            // this.base.options.benchmarks.execute.start();
            const data = await this._execute(state, records, ...args);
            //@ts-ignore
            // this.base.options.benchmarks.execute.end();
            //@ts-ignore
            // this.base.options.benchmarks.serialize.start();
            data.records = this.#serialize(state.groupBy !== undefined, data.records);
            //@ts-ignore
            // this.base.options.benchmarks.serialize.end();
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
     * @returns {typeof this['afterUnsubscribe']}
     */
    after(callback, hook) {
        if(hook === undefined) {
            hook = () => ({});
        }
        this.#after = callback;
        this.#afterHook = hook;
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
     * @returns {typeof this['beforeUnsubscribe']}
     */
    before(callback, hook) {
        if(hook === undefined) {
            hook = () => ({});
        }
        this.#before = callback;
        this.#beforeHook = hook;
        return this.beforeUnsubscribe;
    }

    /**
     * Unsubscribe the `before` trigger.
     */
    beforeUnsubscribe() {
        this.#before = undefined;
        this.#beforeHook = undefined;
    }

    /**
     * Unsubscribe the `before` trigger.
     */
    afterUnsubscribe() {
        this.#after = () => {};
        this.#afterHook = () => ({});
    }

    /**
     * @template {object|undefined} TAliasModel
     * Type of the model that the table represents.
     * @param {TAliasModel[]} records
     */
    async #applyBefore(records) {
        let args = [];
        if(this.#beforeHook) {
            args = await this.#beforeHook(records.length);
        }
        if(this.#before) {
            await Promise.all(records.map(async (r,n) => {
                await /** @type {TriggerCallback<any>} */ (this.#before)(r, { $$itemNumber: n, ...args })
            }));
        }
    }

    /**
     * @template {object|undefined} TAliasModel
     * Type of the model that the table represents.
     * @param {TAliasModel[]} records
     */
    async #applyAfter(records) {
        let args = [];
        if(this.#afterHook) {
            args = await this.#afterHook(records.length);
        }
        if(this.#after) {
            await Promise.all(records.map(async (r,n) => {
                await /** @type {TriggerCallback<any>} */ (this.#after)(r, { $$itemNumber: n, ...args })
            }));
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
     * Serializes an array of rows to a user-friendly object.
     * @param {boolean} isGroupBy
     * @param {object[]} rows 
     * @param {Record<string, import("../context/adapter.js").SchemaColumnDefinition>} schema
     * @param {import("../config/relationships.js").Relationships<object>} relationships
     * @param {number} depth 
     * Used for when the command had a group by clause.
     */
    #serialize(isGroupBy, 
        rows, 
        table=this.base.tableName, 
        schema=this.base.schema, 
        relationships=this.base.relationships, 
        depth = 0
    ) {
        if(rows.length <= 0) return rows;
        if(rows[0].$$count) return rows;
        const pKeys = this.base.getPrimaryKeys(table);
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
                const relatedRowsSerialized = this.#serialize(isGroupBy,
                    relatedRows,
                    relationship.table,
                    relationship.schema, 
                    relationship.relationships,
                    depth + 1
                );

                // set based on the type of relationship this is.
                // group by makes every record unique, and thus every related record would become 1:1.
                if(relationship.relationshipType === RelationshipType.OneToOne || isGroupBy) {
                    newRow[key] = relatedRowsSerialized?.[0] ?? null;
                } else {
                    newRow[key] = relatedRowsSerialized;
                }
            }
            serializedRows.push(newRow);
        }
        return serializedRows;
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