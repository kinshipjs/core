//@ts-check

import { isPrimitive } from "../dev-util.js";
import { KinshipBase } from "../context/base.js";
import { assertAsArray, getAllValues, getUniqueColumns } from "../context/util.js";
import { KinshipInternalError } from "../exceptions.js";
import { WhereBuilder } from "../clauses/where.js";

export class KinshipExecutionHandler {
    /** @type {KinshipBase} */ kinshipBase;

    /** @type {TriggerCallback<any>} */ #before;
    /** @type {TriggerHookCallback} */ #beforeHook;

    /** @type {TriggerCallback<any>} */ #after;
    /** @type {TriggerHookCallback} */ #afterHook;
    
    /**
     * Construct a new Execution handler that will handle the before and after triggers, 
     * as well as the execution of the adapter's command.
     * @param {KinshipBase} kinshipBase 
     */
    constructor(kinshipBase) {
        this.kinshipBase = kinshipBase;
    }

    /**
     * Handles the execution of a command and its respective triggers if any exist.
     * @template {object|undefined} T
     * @param {any} state
     * @param {import("../models/maybe.js").MaybeArray<T>|Function|undefined} records
     * @param {...any} args
     * @returns {Promise<{ numRowsAffected: number, records: T[], whereClause?: WhereBuilder<T>}>}
     */
    async handle(state, records, ...args) {
        let recsForTrigger = [];
        if (typeof records !== 'function' && records !== undefined) {
            recsForTrigger = records = /** @type {T[]} */ (assertAsArray(records));
            if(records.length <= 0) {
                return {
                    numRowsAffected: 0,
                    records: []
                }
            }
        }
        recsForTrigger = /** @type {T[]} */ (assertAsArray(recsForTrigger));
        try {
            await this.#applyBefore(recsForTrigger);
            const data = await this._execute(state, records, ...args);
            await this.#applyAfter(recsForTrigger);
            return data;
        } catch(err) {
            throw err;
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
     * @returns {this}
     */
    before(callback, hook) {
        if(hook === undefined) {
            hook = () => ({});
        }
        this.#before = callback;
        this.#beforeHook = hook;
        return this;
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
     * @returns {this}
     */
    after(callback, hook) {
        if(hook === undefined) {
            hook = () => ({});
        }
        this.#after = callback;
        this.#afterHook = hook;
        return this;
    }

    /**
     * @template {object|undefined} TAliasModel
     * Type of the model that the table represents.
     * @param {TAliasModel[]} records
     */
    async #applyBefore(records) {
        const args = await this.#beforeHook();
        await Promise.all(records.map(async r => await this.#before(r, args)));
    }

    /**
     * @template {object|undefined} TAliasModel
     * Type of the model that the table represents.
     * @param {TAliasModel[]} records
     */
    async #applyAfter(records) {
        const args = await this.#afterHook();
        await Promise.all(records.map(async r => await this.#after(r, args)));
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
 * @returns {import("../models/maybe.js").MaybePromise<any>}
 */