//@ts-check

import { deepCopy } from "../util.js";
import { KinshipBase } from "./base.js";
import { KinshipDeleteHandler } from "../transactions/delete.js";
import { KinshipInsertHandler } from "../transactions/insert.js";
import { KinshipQueryHandler } from "../transactions/query.js";
import { KinshipUpdateHandler } from "../transactions/update.js";

/**
 * Establishes a connection to a specific table within the data context.
 * @template {import("./base.js").Table} TTableModel
 * Type of the model that represents the table and its columns, in their exact form.
 * @template {import("./base.js").Table} [TAliasModel=TTableModel]
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

    /**
     * @overload
     * @param {import("../index.js").KinshipAdapter<any>} adapter
     * @param {string} tableName
     */
    /**
     * @overload
     * @param {import("../index.js").KinshipAdapter<any>} adapter
     * @param {string} tableName
     * @param {import("./base.js").KinshipOptions} options 
     */
    /**
     * 
     * @param {import("../index.js").KinshipAdapter<any>|KinshipContext} adapter 
     * @param {string} tableName 
     * @param {import("./base.js").KinshipOptions=} options 
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

    /**
     * Delete rows in the table using a previously built `.where()` clause function.
     * @overload
     * @returns {Promise<number>}
     */
    /**
     * Delete records based on their primary key.  
     * If no primary key exists on the record, then they will be ignored.
     * @overload
     * @param {import("./base.js").MaybeArray<TAliasModel>} records
     * @returns {Promise<number>}
     */
    /**
     * Deletes records in the table connected to this context.
     * @param {import("./base.js").MaybeArray<TAliasModel>=} records 
     * @returns {Promise<number>} Number of rows affected.
     */
    async delete(records=undefined) {
        const { numRowsAffected } = await this.#delete.handle(this.#state, records);
        return numRowsAffected;
    }

    /**
     * Insert records into the table.
     * @param {import("./base.js").MaybeArray<TAliasModel>} records
     * Record or records to insert into the database.
     * @returns {Promise<TAliasModel[]>} 
     * The same records that were inserted, with updated properties of any default values.
     * Default values include virtual columns, database defaults, and user defined defaults.
     */
    async insert(records) {
        const { numRowsAffected, whereClause, ...data } = await this.#insert.handle(this.#state, records);
        // If this is not undefined, then the handler determined that virtual columns exist, so we must requery
        if(whereClause) { 
            const ctx = this.#newContext;
            ctx.#state = { where: whereClause };
            records = await ctx.select();
        } else {
            records = data.records;
        }
        return records;
    }

    /**
     * Query all columns for rows from the table referenced by this context.
     * @template {TAliasModel} TSelectedColumns
     * Type that represents the selected columns.
     * @overload
     * @returns {Promise<TAliasModel[]>}
     * Rows queried from the database serialized into their base TypeScript type.
     */
    /**
     * Query the selected columns as specified in `callback`, for rows from the table referenced by this context.
     * @template {import("../import("../clauses/group-by.js").js").SelectedColumnsModel<TTableModel>} TSelectedColumns
     * Type that represents the selected columns, inferred from the return type in the `callback` parameter function.
     * @overload 
     * @param {(model: import("../import("../clauses/group-by.js").js").SpfSelectCallbackModel<TTableModel>) => import("../import("../clauses/group-by.js").js").MaybeArray<keyof TSelectedColumns>} callback
     * Callback model that allows you to select which columns to grab.
     * @returns {Promise<import("../import("../clauses/group-by.js").js").ReconstructSqlTable<TTableModel, TSelectedColumns>[]>}
     * Rows queried from the database serialized into their base TypeScript type.
     */
    /**
     * Queries selected columns or all columns from the context using a built state.
     * @template {import("../import("../clauses/group-by.js").js").SelectedColumnsModel<TTableModel>|TAliasModel} [TSelectedColumns=TAliasModel]
     * Type that represents the selected columns.
     * @param {((model: import("../import("../clauses/group-by.js").js").SpfSelectCallbackModel<TTableModel>) => import("../import("../clauses/group-by.js").js").MaybeArray<keyof TSelectedColumns>)|void} callback
     * Callback model that allows the user to select which columns to grab.
     * @returns {Promise<import("../import("../clauses/group-by.js").js").ReconstructSqlTable<TTableModel, TSelectedColumns>[]|TAliasModel[]>} Array of records, serialized from the rows returned from the query given the clauses specified.
     * Rows queried from the database serialized into a user-friendly format.
     */
    async select(callback) {
        const { records } = await this.#query.handle(this.#state, /** @type {Function} */ (callback));
        this.#resetState();
        return /** @type {any} */ (records);
    }

    /**
     * Update records based on their primary key.  
     * If no primary key exists on the record, then they will be ignored.
     * @overload
     * @param {import("./base.js").MaybeArray<TTableModel>} records
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
     * @param {import("./base.js").MaybeArray<TTableModel>|((m: TTableModel) => Partial<TTableModel>|void)} records 
     * @returns {Promise<number>}
     */
    async update(records) {
        const { numRowsAffected, ...data }  = await this.#update.handle(this.#state, records);
        records = /** @type {TTableModel[]} */ (data.records);
        this.#resetState();
        return numRowsAffected;
    }

    /* -------------------------Public Clause Functions------------------------- */
    /**
     * Specify the columns to group the results on.
     * @template {import("../clauses/group-by.js").GroupedColumnsModel<TTableModel>} TGroupedColumns
     * Used internally for typescript to create a new `TAliasModel` on the returned context, which will change the scope of what the user will see in further function calls.
     * @param {(model: import("../clauses/group-by.js").SpfGroupByCallbackModel<TTableModel>, aggregates: import("../clauses/group-by.js").Aggregates) => import("../clauses/group-by.js").MaybeArray<keyof TGroupedColumns>} callback
     * Property reference callback that is used to determine which column or columns should be selected and grouped on in future queries.
     * @returns {KinshipContext<ReconstructSqlTable<TTableModel, TGroupedColumns>, import("../clauses/group-by.js").ReconstructSqlTable<TTableModel, TGroupedColumns>>} A new context with the state of the context this occurred in addition with a new state of a GROUP BY clause.
     */
    groupBy(callback) {
        const ctx = this.#newContext;
        return ctx.#groupBy();  
    }

    /**
     * Skip some number of rows before retrieving.
     * @param {number} numberOfRecords Number of rows to skip.
     * @returns {KinshipContext<TTableModel, TAliasModel>}
     */
    skip(numberOfRecords) {
        const ctx = this.#newContext;
        return ctx.#skip(numberOfRecords);  
    }

    sortBy() {
        const ctx = this.#newContext;
        return ctx.#sortBy();
    }
    
    /**
     * Limit the number of rows to retrieve.
     * @param {number} numberOfRecords Number of rows to take.
     * @returns {KinshipContext<TTableModel, TAliasModel>}
     */
    take(numberOfRecords) {
        const ctx = this.#newContext;
        return ctx.#take(numberOfRecords);  
    }

    where() {
        const ctx = this.#newContext;
        return ctx.#where();
    }

    /* -------------------------Private Clause Functions------------------------- */

    #groupBy() {
        return this;
    }

    /**
     * Adds `numberOfRecords` to the `offset` property in `#state`.
     * @param {number} numberOfRecords 
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

    /* -------------------------Private GET Properties------------------------- */

    /**
     * Creates a new context with the initial state set to the state of this state.
     */
    get #newContext() {
        //@ts-ignore One parameter constructor is only available to this getter.
        const ctx = new KinshipContext(this);
        return ctx;
    }
}

/**
 * Grabs the first element in the String, separated by "_".
 * @template {string|symbol|number} K
 * @typedef {K extends `${infer A}_${infer B}` ? A : K} Car
 */

/**
 * Grabs the remaining elements in the String, separated by "_".
 * @template {string|symbol|number} K
 * @typedef {K extends `${infer B}_${infer A}` ? A : never} Cdr
 */




/**
 * Transforms a string or union thereof that resembles some finitely nested properties inside of `TOriginal` model 
 * into its actual representation as shown in `TOriginal`. 
 * @template {import("./base.js").Table} TOriginal
 * @template {string|symbol|number} TSerializedKeyTypes
 * @typedef {Contains<TSerializedKeyTypes, "_"> extends never 
 *   ? TSerializedKeyTypes extends keyof TOriginal 
 *     ? {[K in TSerializedKeyTypes]: TOriginal[TSerializedKeyTypes]} 
 *     : never
 *   : {[K in Car<TSerializedKeyTypes> as K extends keyof TOriginal ? K : never]: K extends keyof TOriginal 
 *     ? TOriginal[K] extends (infer R extends import("./base.js").Table)[]|undefined
 *       ? ReconstructObject<R, Cdr<TSerializedKeyTypes>>[] 
 *       : TOriginal[K] extends import("./base.js").Table|undefined
 *         ? ReconstructObject<Exclude<TOriginal[K], undefined>, Cdr<TSerializedKeyTypes>> 
 *         : TOriginal[K]
 *     : never} 
 * } ReconstructObject
 */

/** ReconstructSqlTable  
 * 
 * Transforms an object, `T`, with non-object value properties where each property key can be mapped back to `TOriginal` 
 * using {@link ReconstructValue<TOriginal, keyof T>}
 * @template {Table} TOriginal
 * @template {Table} T
 * @typedef {{[K in keyof T as import("../models/string.js").StartsWith<K, "$">]: number} & ReconstructObject<TOriginal, keyof T>} ReconstructSqlTable
 */