//@ts-check

import { deepCopy } from "../util.js";
import { KinshipBase } from "./base.js";
import { KinshipDeleteHandler } from "../transactions/delete.js";
import { KinshipInsertHandler } from "../transactions/insert.js";
import { KinshipQueryHandler } from "../transactions/query.js";
import { KinshipUpdateHandler } from "../transactions/update.js";

/**
 * Establishes a connection directly to a table within your database.
 * @template {import("../models/sql.js").Table} TTableModel
 * Type of the model that represents the table and its columns, in their exact form.
 * @template {import("../models/sql.js").Table} [TAliasModel=TTableModel]
 * Type of the model, `TTableModel`, which will be augmented as new clauses are called.
 */
export class KinshipContext {
    /* -------------------------Private Properties------------------------- */
    /** @type {KinshipBase} */ #base;
    /** @type {KinshipDeleteHandler} */ #delete;
    /** @type {any} */ #initialState;
    /** @type {KinshipInsertHandler} */ #insert;
    /** @type {KinshipQueryHandler} */ #query;
    /** @type {KinshipUpdateHandler} */ #update;
    /** @type {any} */ #state;

    /* -------------------------Constructor------------------------- */
    
    /**
     * Instantiate a new KinshipContext.
     * @param {import("../index.js").KinshipAdapter<any>} adapter
     * Kinship adapter used to connect to your database. 
     * @param {string} tableName 
     * Name of the table that is being connected to.
     * @param {import("./base.js").KinshipOptions=} options
     * Optional additional configurations. 
     */
    constructor(adapter, tableName, options=undefined) {
        if(adapter instanceof KinshipContext) {
            this.#base = adapter.#base;
            this.#delete = adapter.#delete;
            this.#insert = adapter.#insert;
            this.#query = adapter.#query;
            this.#update = adapter.#update;
            this.#state = this.#initialState = adapter.#state;
        } else {
            this.#base = new KinshipBase(adapter, tableName, options);
            this.#delete = new KinshipDeleteHandler(this.#base);
            this.#insert = new KinshipInsertHandler(this.#base);
            this.#query = new KinshipQueryHandler(this.#base);
            this.#update = new KinshipUpdateHandler(this.#base);
            this.#initialState = {};
            this.#state = {};
        }
    }

    /* -------------------------Transaction Functions------------------------- */

    async count() {
        return 0;
    }

    /**
     * Delete rows in the table using a previously built `.where()` clause function.
     * @overload
     * @returns {Promise<number>}
     */
    /**
     * Delete records based on their primary key.  
     * If no primary key exists on the record, then they will be ignored.
     * @overload
     * @param {import("../models/maybe.js").MaybeArray<TAliasModel>} records
     * @returns {Promise<number>}
     */
    /**
     * Deletes records in the table connected to this context.
     * @param {import("../models/maybe.js").MaybeArray<TAliasModel>=} records 
     * @returns {Promise<number>} Number of rows affected.
     */
    async delete(records=undefined) {
        const { numRowsAffected } = await this.#delete.handle(this.#state, records);
        return numRowsAffected;
    }

    /**
     * Insert records into the table.
     * @param {import("../models/maybe.js").MaybeArray<TAliasModel>} records
     * Record or records to insert into the database.
     * @returns {Promise<TAliasModel[]>} 
     * The same records that were inserted, with updated properties of any default values.
     * Default values include virtual columns, database defaults, and user defined defaults.
     */
    async insert(records) {
        const { numRowsAffected, whereClause, ...data } = await this.#insert.handle(this.#state, records);
        // If this is not undefined, then the handler determined that virtual columns exist, so we must requery
        if(whereClause) { 
            const ctx = this.#newContext();
            ctx.#state = { where: whereClause };
            records = /** @type {TAliasModel[]} */ (await ctx.select());
        } else {
            records = data.records;
        }
        return records;
    }

    /**
     * Queries selected columns or all columns from the context using a built state.
     * @template {(SelectedColumnsModel<TTableModel>)|TAliasModel} [TSelectedColumns=TAliasModel]
     * Type that represents the selected columns.
     * @param {((model: import("../transactions/query.js").SpfSelectCallbackModel<TTableModel>) 
     *      => import("../models/maybe.js").MaybeArray<TSelectedColumns>)=} callback
     * Callback model that allows the user to select which columns to grab.
     * @returns {Promise<ReconstructSqlTable<TTableModel, TSelectedColumns>[]>} Rows queried from the database serialized into a user-friendly format.
     */
    async select(callback=undefined) {
        const { records } = await this.#query.handle(this.#state, /** @type {Function} */ (callback));
        this.#resetState();
        return /** @type {any} */ (records);
    }

    /**
     * Update records based on their primary key.  
     * If no primary key exists on the record, then they will be ignored.
     * @overload
     * @param {import("../models/maybe.js").MaybeArray<TAliasModel>} records
     * Records to update.
     * @returns {Promise<number>}
     * Number of rows affected from the update.
     */
    /**
     * Update values on rows in the table using a previously built `.where()` clause function.
     * @overload
     * @param {(model: TTableModel) => void} callback
     * Callback where `model` intercepts all property references to determine what columns should be updated and what to.
     * @returns {Promise<number>}
     * Number of rows affected from the update.
     */
    /**
     * Update values on rows in the table using a previously built `.where()` clause function.
     * @overload
     * @param {(m: TTableModel) => Partial<TTableModel>} callback
     * Callback where the properties on the return value determine what columns should be updated and what to.
     * @returns {Promise<number>}
     * Number of rows affected from the update.
     */
    /**
     * Updates records in the table connected to this context.
     * @param {import("../models/maybe.js").MaybeArray<TAliasModel>|((m: TTableModel) => Partial<TTableModel>|void)} records 
     * @returns {Promise<number>}
     */
    async update(records) {
        const { numRowsAffected }  = await this.#update.handle(this.#state, records);
        this.#resetState();
        return numRowsAffected;
    }

    /* -------------------------Public Clause Functions------------------------- */
    /**
     * Specify the columns to group the results on.
     * @template {import("../clauses/group-by.js").GroupedColumnsModel<TTableModel>} TGroupedColumns
     * Used internally for typescript to create a new `TAliasModel` on the returned context, which will change the scope of what the user will see in further function calls.
     * @param {(model: import("../clauses/group-by.js").SpfGroupByCallbackModel<TTableModel>, aggregates: import("../clauses/group-by.js").Aggregates) => import("../models/maybe.js").MaybeArray<keyof TGroupedColumns>} callback
     * Property reference callback that is used to determine which column or columns should be selected and grouped on in future queries.
     * @returns {KinshipContext<ReconstructSqlTable<TTableModel, TGroupedColumns>, ReconstructSqlTable<TTableModel, TGroupedColumns>>} A new context with the state of the context this occurred in addition with a new state of a GROUP BY clause.
     */
    groupBy(callback) {
        const ctx = this.#newContext();
        return ctx.#groupBy();  
    }

    /**
     * Skip some number of rows before retrieving.
     * @param {number} numberOfRecords Number of rows to skip.
     * @returns {KinshipContext<TTableModel, TAliasModel>}
     */
    skip(numberOfRecords) {
        /** @type {KinshipContext<TTableModel, TAliasModel>} */
        const ctx = this.#newContext();
        return ctx.#skip(numberOfRecords);  
    }

    sortBy() {
        const ctx = this.#newContext();
        return ctx.#sortBy();
    }
    
    /**
     * Limit the number of rows to retrieve.
     * @param {number} numberOfRecords Number of rows to take.
     * @returns {KinshipContext<TTableModel, TAliasModel>}
     */
    take(numberOfRecords) {
        const ctx = this.#newContext();
        return ctx.#take(numberOfRecords);  
    }

    where() {
        const ctx = this.#newContext();
        return ctx.#where();
    }

    /* -------------------------Private Clause Functions------------------------- */

    #groupBy() {
        return this;
    }

    /**
     * Adds `numberOfRecords` to the `offset` property in `#state`.
     * @param {number} numberOfRecords
     * @returns {KinshipContext<TTableModel, TAliasModel>}
     */
    #skip(numberOfRecords) {
        this.#state.offset = numberOfRecords;
        return this;
    }

    #sortBy() {
        return this;
    }

    /**
     * Adds `numberOfRecords` to the `limit` property in `#state`.
     * @param {number} numberOfRecords 
     */
    #take(numberOfRecords) {
        this.#state.limit = numberOfRecords;
        return this;
    }

    #where() {
        return this;
    }

    /* -------------------------Trigger Handlers------------------------- */
 
    /**
     * Set a trigger for every record that gets deleted within the context, __after__ the delete occurs.  
     * __If a delete occurs explicitly (e.g., using `.where(...).delete()`), then this trigger will not fire.__
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/exec-handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     */
    afterDelete(callback, hook=undefined) {
        this.#update.after(callback, hook);
        return this;
    }

    /**
     * Set a trigger for every record that gets inserted into the context, __after__ the insert occurs.
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/exec-handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     */
    afterInsert(callback, hook=undefined) {
        this.#update.after(callback, hook);
        return this;
    }

    /**
     * Set a trigger for every record that gets updated within the context, __after__ the update occurs.  
     * __If an update occurs explicitly (e.g., using `.where(...).update(m => ({ a: 1 }))`), then this trigger will not fire.__
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/exec-handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     */
    afterUpdate(callback, hook=undefined) {
        this.#update.after(callback, hook);
        return this;
    }

    /**
     * Set a trigger for every record explicitly given that gets deleted within the context, __before__ the delete occurs.  
     * __If a delete occurs explicitly (e.g., using `.where(...).delete()`), then this trigger will not fire.__
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the delete for every record that is to be deleted.
     * @param {import("../transactions/exec-handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...hookArgs` parameter.
     */
    beforeDelete(callback, hook=undefined) {
        this.#update.before(callback, hook);
        return this;
    }

    /**
     * Set a trigger for every record that gets inserted into the context, __before__ the insert occurs.
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/exec-handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     */
    beforeInsert(callback, hook=undefined) {
        this.#update.before(callback, hook);
        return this;
    }

    /**
     * Set a trigger for every record that gets updated within the context, __before__ the update occurs.  
     * __If an update occurs explicitly (e.g., using `.where(...).update(m => ({ a: 1 }))`), then this trigger will not fire.__
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the update for every record that is to be updated.
     * @param {import("../transactions/exec-handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     */
    beforeUpdate(callback, hook=undefined) {
        this.#update.before(callback, hook);
        return this;
    }
    
    /* -------------------------Event Functions------------------------- */

    onSuccess() {

    }

    onFail() {

    }

    /* -------------------------Private Functions------------------------- */

    /**
     * Resets the `state` of the context back to `initialState`.
     */
    async #resetState() {
        this.#state = deepCopy(this.#initialState);
        this.#state.where = this.#initialState.where._clone();
    }

    /**
     * Creates a new context with the initial state set to the state of this state.
     * @template {import("../models/sql.js").Table} [T=TTableModel]
     * @template {import("../models/sql.js").Table} [U=TAliasModel]
     * @returns {KinshipContext<T, U>}
     */
    #newContext() {
        /** @type {KinshipContext<T, U>} */
        //@ts-ignore One parameter constructor is only available to this getter.
        const ctx = new KinshipContext(this);
        return ctx;
    }
}

/** 
 * Model representing selected columns.
 * @template {import("../models/sql.js").Table} TTableModel
 * @typedef {{[K in keyof Partial<TTableModel> as import("../models/string.js").Join<TTableModel, K & string>]: 
 *      import("../transactions/query.js").SelectClauseProperty}} SelectedColumnsModel
 */

/**
 * Transforms a string or union thereof that resembles some finitely nested properties inside of `TOriginal` model 
 * into its actual representation as shown in `TOriginal`. 
 * @template {import("../models/sql.js").Table} TOriginal
 * @template {string} TSerializedKey
 * @typedef {import("../models/string.js").Contains<TSerializedKey, "_"> extends never
 *   ? TSerializedKey extends keyof TOriginal  
 *     ? {[K in TSerializedKey]: TOriginal[TSerializedKey]} 
 *     : never
 *   : ReconstructNestedObject<TOriginal, TSerializedKey>
 * } ReconstructObject
 */

/**
 * @template {import("../models/sql.js").Table} TOriginal
 * @template {string} TSerializedKey
 * @typedef {{[K in import("../models/string.js").Car<TSerializedKey> as K extends keyof TOriginal ? K : never]: ReconstructNestedObjectValue<TOriginal, TSerializedKey, K>}} ReconstructNestedObject
 */

/**
 * @template {import("../models/sql.js").Table} TOriginal
 * @template {string} TSerializedKey
 * @template {string} K
 * @typedef {TOriginal[K] extends (infer U extends import("../models/sql.js").Table)[]|undefined
 *       ? ReconstructObject<U, import("../models/string.js").Cdr<TSerializedKey>>[] 
 *       : TOriginal[K] extends import("../models/sql.js").Table|undefined
 *         ? ReconstructObject<Exclude<TOriginal[K], undefined>, import("../models/string.js").Cdr<TSerializedKey>> 
 *         : TOriginal[K]} ReconstructNestedObjectValue
 */

/**
 * Transforms an object, `T`, with non-object value properties where each property key can be mapped back to `TOriginal` 
 * using {@link ReconstructObject<TOriginal, keyof T>}
 * @template {import("../models/sql.js").Table} TOriginal
 * @template {import("../models/sql.js").Table} T
 * @typedef {{[K in keyof T as import("../models/string.js").StartsWith<K, "$">]: number} 
 *      & ReconstructObject<TOriginal, keyof T & string>
 * } ReconstructSqlTable
 */

