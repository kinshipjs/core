//@ts-check

import { KinshipBase } from "../context/base.js";
import { assertAsArray, getFilterConditionsFromWhere } from "../context/util.js";
import { WhereBuilder } from "../clauses/where.js";
import { KinshipInternalError } from "../exceptions.js";

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
            const data = await this._execute(state, records, ...args);
            data.records = this.#serialize(state, data.records);
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
     * @protected
     * @template {object|undefined} TAliasModel
     * Type of the model that the table represents.
     * @param {any} state
     * @param {import("../models/maybe.js").MaybeArray<TAliasModel>|Function|undefined} records
     * @param {...any} args
     * @returns {Promise<{ numRowsAffected: number, records: TAliasModel[]}>}
     */
    async _execute(state, records, ...args) {
        throw new KinshipImplementationError(`Child class must implement the function, "._execute".`);
    }

    /**
     * Returns a function to be used in a JavaScript `<Array>.map()` function that recursively maps relating records into a single record.
     * @param {import("../context/context.js").AdapterReadyState} state
     * @param {object[]} records All records returned from a SQL query.
     * @param {object} record Record that is being worked on (this is handled recursively)
     * @param {string} prepend String to prepend onto the key for the original record's value.
     * @returns {(record: any, n?: number) => object} Function for use in a JavaScript `<Array>.map()` function for use on an array of the records filtered to only uniques by main primary key.
     */
    #map(state, records, record=records[0], prepend="", relationships=this.base.relationships) {
        return (r) => {
            /** @type {any} */
            const mapping = {};
            const processedTables = new Set();
            for(const key in record) {
                if(key.startsWith("$")) {
                    mapping[key] = r[key];
                    continue;
                }
                const [table] = key.split('<|');
                if(processedTables.has(table)) {
                    continue;
                }
                processedTables.add(table);
                if(table === key) {
                    const actualKey = prepend + key;
                    if (r[actualKey] != null || prepend == '') {
                        mapping[key] = r[actualKey];
                    }
                    continue;
                }

                // alter `record` so keys at this leaf are removed, and all keys altered to prepare for the next leaf.
                const entries = Object.keys(record)
                    .filter(k => k.startsWith(table + '<|'))
                    .map(k => [k.substring(table.length+2), {}]);
                const map = this.#map(state, records, Object.fromEntries(entries), prepend + table + '<|', relationships[table].relationships);
                if (relationships[table].type === "1:1" || state.groupBy) {
                    const _r = map(r);
                    mapping[table] = Object.keys(_r).length <= 0 ? null : _r;
                } else {
                    const pKey = relationships[table].primary.alias;
                    const fKey = relationships[table].foreign.alias;
                    const uniquelyRelatedRecords = this.#filterForUniqueRelatedRecords(records.filter((_r) => r[pKey] === _r[fKey]), table);
                    // recursively map related records in case there are any further nested relationships.
                    mapping[table] = uniquelyRelatedRecords.map(map);
                }
            }
    
            return mapping;
        }
    }

    /**
     * Serializes a given array of records, `records`, into object notation that a User would expect.
     * @param {import("../context/context.js").AdapterReadyState} state
     * @param {any[]} records Records to filter.
     * @returns {object[]} Records, serialized into objects that a user would expect.
     */
    #serialize(state, records) {
        if (records.length <= 0 || state.from.length === 1) return records;
        const map = this.#map(state, records);
        // group by is specific where each record returned will be its own result and will not be serialized like normal.
        if(state.groupBy) {
            return records.map(map);
        }
        return this.#filterForUniqueRelatedRecords(records).map(map);
    }

    /**
     * Filters out duplicates of records that have the same primary key.
     * @param {any[]} records Records to filter.
     * @param {string=} table Table to get the primary key from. (default: original table name)
     * @returns {any[]} A new array of records, where duplicates by primary key are filtered out. If no primary key is defined, then `records` is returned, untouched.
     */
    #filterForUniqueRelatedRecords(records, table=this.base.tableName) {
        let pKeyInfo = this.base.getPrimaryKeys(table);
        if(records === undefined || pKeyInfo.length <= 0) return records;
        const pKeys = pKeyInfo.map(k => k.alias);
        const uniques = new Set();
        return records.filter(r => {
            // if(pKeys.filter(k => !(k in r)).length > 0) return true; // @TODO: This may need to be added back in ?
            const fullKeyValue = pKeys.map(k => r[k]).join(',');
            return !uniques.has(fullKeyValue) 
                && !!uniques.add(fullKeyValue);
        });
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