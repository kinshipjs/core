//@ts-check

import { KinshipBase } from "./base.js";
import { KinshipDeleteHandler } from "../transactions/delete.js";
import { KinshipInsertHandler } from "../transactions/insert.js";
import { KinshipQueryHandler } from "../transactions/query.js";
import { KinshipUpdateHandler } from "../transactions/update.js";
import { KinshipColumnDoesNotExistError, KinshipInvalidPropertyTypeError } from "../exceptions.js";
import { Where, WhereBuilder } from "../clauses/where.js";
import { GroupByBuilder } from "../clauses/group-by.js";
import { OrderByBuilder } from "../clauses/order-by.js";

/**
 * Establishes a connection directly to a table within your database.
 * @template {object|undefined} TTableModel
 * Type of the model that represents the table and its columns, in their exact form.
 * @template {object|undefined} [TAliasModel=TTableModel]
 * Type of the model, `TTableModel`, which will be augmented as new clauses are called.
 */
export class KinshipContext {
    /* -------------------------Private Properties------------------------- */
    // Properties to maintain a flow and state of the context.

    /** @type {KinshipBase} */ #base;
    /** @type {Builders<TTableModel, TAliasModel>} */ #builders;
    /** @type {Handlers} */ #handlers;
    /** @type {State} */ #initialState;
    /** @type {State} */ #state;

    /* -------------------------Constructor------------------------- */
    
    // for some reason, when this is overloaded, errors end up existing with type inferrence.
    // /**
    //  * @overload
    //  * Create a brand new KinshipContext.
    //  * @param {import("../old/index.js").KinshipAdapter<any>} adapter
    //  * Kinship adapter used to connect to your database. 
    //  * @param {string} tableName 
    //  * Name of the table that is being connected to.
    //  */
    // /**
    //  * @overload
    //  * Create a brand new KinshipContext with additional options.
    //  * @param {import("../old/index.js").KinshipAdapter<any>} adapter
    //  * Kinship adapter used to connect to your database. 
    //  * @param {string} tableName 
    //  * Name of the table that is being connected to.
    //  * @param {import("./base.js").KinshipOptions} options
    //  * Optional additional configurations. 
    //  */
    // /**
    //  * @overload
    //  * Create a new `KinshipContext` with a base state of another `KinshipContext`.  
    //  * __NOTE: In most cases, this overload would not be used, as every clause that is built will automatically return a new context
    //  * updated with the appropriate base state.__
    //  * @param {KinshipContext} context
    //  * Existing `KinshipContext` object to base this new context off of.
    //  */
    /**
     * Create a brand new KinshipContext.
     * @param {import("../old/index.js").KinshipAdapter<any>|KinshipContext} adapter
     * Kinship adapter used to connect to your database. 
     * @param {string=} tableName 
     * Name of the table that is being connected to.
     * @param {import("./base.js").KinshipOptions=} options
     * Optional additional configurations. 
     */
    constructor(adapter, tableName=undefined, options=undefined) {
        if(adapter instanceof KinshipContext) {
            // when an existing KinshipContext is passed in, then this new context will be based off that context.
            this.#base = adapter.#base;
            this.#builders = adapter.#builders;
            this.#handlers = adapter.#handlers;
            this.#state = this.#initialState = adapter.#state;
        } else {
            if(typeof tableName !== "string") {
                throw Error(`The parameter, \`tableName\` must be a valid string.`);
            }
            this.#base = new KinshipBase(adapter, tableName, options);
            this.#handlers = {
                delete: new KinshipDeleteHandler(this.#base),
                insert: new KinshipInsertHandler(this.#base),
                query: new KinshipQueryHandler(this.#base),
                update: new KinshipUpdateHandler(this.#base)
            };
            this.#initialState = {};
            this.#state = {};
            this.#builders = {
                groupBy: new GroupByBuilder(this.#base),
                orderBy: new OrderByBuilder(this.#base)
            };
        }
    }

    /* -------------------------Transaction Functions------------------------- */
    // Users can perform some transaction with the database using the state of the context.

    /**
     * Retrieve the number of rows returned from the built clause.
     * @returns {Promise<number>}
     */
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
        const { numRowsAffected } = await this.#handlers.delete.handle(this.#state, records);
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
        const { numRowsAffected, whereClause, ...data } = await this.#handlers.insert.handle(this.#state, records);
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
     * @template {import("../clauses/choose.js").SelectedColumnsModel<TAliasModel>} [TSelectedColumns=import("../clauses/choose.js").SelectedColumnsModel<TAliasModel>]
     * Type that represents the selected columns.
     * @param {((model: import("../clauses/choose.js").SpfSelectCallbackModel<TAliasModel>) => 
     *  import("../models/maybe.js").MaybeArray<keyof TSelectedColumns>)=} callback
     * Callback model that allows the user to select which columns to grab.
     * @returns {Promise<(TSelectedColumns extends TAliasModel 
     *  ? TAliasModel 
     *  : import("../models/superficial.js").Isolate<TTableModel, keyof TSelectedColumns>)[]>}
     * Rows queried from the database serialized into a user-friendly format.
     */
    async select(callback=undefined) {
        const { records } = await this.#handlers.query.handle(this.#state, /** @type {Function} */ (callback));
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
        const { numRowsAffected }  = await this.#handlers.update.handle(this.#state, records);
        this.#resetState();
        return numRowsAffected;
    }

    /* -------------------------Public Clause Functions------------------------- */
    // Users can add clauses to their built queries.

    /**
     * Queries selected columns or all columns from the context using a built state.  
     * This method will override any previous `.choose()` calls.
     * @template {import("../clauses/choose.js").SelectedColumnsModel<TAliasModel>} [TSelectedColumns=import("../clauses/choose.js").SelectedColumnsModel<TAliasModel>]
     * Type that represents the selected columns.
     * @param {(model: import("../clauses/choose.js").SpfSelectCallbackModel<TAliasModel>) => 
     *  import("../models/maybe.js").MaybeArray<keyof TSelectedColumns>} callback
     * Callback model that allows the user to select which columns to grab.
     * @returns {KinshipContext<TTableModel, import("../models/superficial.js").Isolate<TTableModel, keyof TSelectedColumns>>}
     * Rows queried from the database serialized into a user-friendly format.
     */
    choose(callback) {
        const ctx = this.#newContext();
        return /** @type {any} */ (ctx.#choose(callback)); 
    }

    /**
     * Specify the columns to group the results on.  
     * This method will override any previous `.groupBy()` calls.
     * @template {import("../clauses/group-by.js").GroupedColumnsModel<TTableModel>} TGroupedColumns
     * Used internally for typescript to create a new `TAliasModel` on the returned context, which will change the scope of what the user will see in further function calls.
     * @param {(model: import("../clauses/group-by.js").SpfGroupByCallbackModel<TTableModel>, aggregates: import("../clauses/group-by.js").Aggregates) => import("../models/maybe.js").MaybeArray<keyof TGroupedColumns>} callback
     * Property reference callback that is used to determine which column or columns should be selected and grouped on in future queries.
     * @returns {KinshipContext<TTableModel, import("../models/superficial.js").Isolate<TTableModel, keyof TGroupedColumns>>} A new context with the state of the context this occurred in addition with a new state of a GROUP BY clause.
     */
    groupBy(callback) {
        const ctx = this.#newContext();
        return /** @type {any} */ (ctx.#groupBy(callback));  
    }

    /**
     * Skip some number of rows before retrieving.  
     * This method will override any previous `.skip()` calls.
     * @param {number} numberOfRecords Number of rows to skip.
     * @returns {KinshipContext<TTableModel, TAliasModel>}
     */
    skip(numberOfRecords) {
        /** @type {KinshipContext<TTableModel, TAliasModel>} */
        const ctx = this.#newContext();
        return ctx.#skip(numberOfRecords);  
    }

    /**
     * Specify the columns to sort on (in the exact order).  
     * This method will stack, meaning it will not override previous `.sortBy()` calls.   
     * @param {(model: import("../clauses/order-by.js").SortByCallbackModel<TTableModel>) 
     *   => import("../models/maybe.js").MaybeArray<
     *      import("../clauses/order-by.js").SortByClauseProperty
     *      |import("../clauses/order-by.js").SortByCallbackModelProp
     * >} callback
     * Property reference callback that is used to determine which column or columns will be used to sort the queried rows
     * @returns {KinshipContext<TTableModel, TAliasModel>} A new context with the state of the context this occurred in addition with a new state of an ORDER BY clause.
     */
    sortBy(callback) {
        const ctx = this.#newContext();
        return ctx.#sortBy(callback);
    }
    
    /**
     * Limit the number of rows to retrieve.  
     * This method will override any previous `.take()` calls.
     * @param {number} numberOfRecords Number of rows to take.
     * @returns {KinshipContext<TTableModel, TAliasModel>}
     */
    take(numberOfRecords) {
        const ctx = this.#newContext();
        return ctx.#take(numberOfRecords);  
    }

    /**
     * Filter what rows are returned from your query.  
     * This method will stack, meaning it will not override previous `.where()` calls.   
     * @param {(model: import("../clauses/where.js").ChainObject<TAliasModel>) => void} callback
     * @returns {KinshipContext<TTableModel, TAliasModel>} 
     */
    where(callback) {
        const ctx = this.#newContext();
        return ctx.#where(callback);
    }

    /* -------------------------Private Clause Functions------------------------- */
    // Private functions for use with their corresponding public Clause Function.

    /** Sets the state for `this.#state.select` through a `SelectBuilder`. */
    #choose(callback) {
        this.#state.select = callback();
        return this;
    }

    /** Sets the state for `this.#state.groupBy` through a `GroupByBuilder`. */
    #groupBy(callback) {
        const { select, groupBy } = this.#builders.groupBy.getState(callback);
        this.#state.select = select;
        this.#state.groupBy = groupBy;
        return this;
    }

    /** Sets the state for `this.#state.offset`. */
    #skip(numberOfRecords) {
        this.#state.offset = numberOfRecords;
        return this;
    }
    
    /** Sets the state for `this.#state.orderBy` through a `SortByBuilder`. */
    #sortBy(callback) {
        this.#state.orderBy = [...(this.#state.orderBy ?? []), ...this.#builders.orderBy.getState(callback)];
        return this;
    }

    /** Sets the state for `this.#state.limit`. */
    #take(numberOfRecords) {
        this.#state.limit = numberOfRecords;
        return this;
    }

    /** Sets the state for `this.#state.where` through a `WhereBuilder`. */
    #where(callback) {
        const newProxy = (realTableName=this.#base.tableName, 
            table=realTableName,
            relationships=this.#base.relationships, 
            schema=this.#base.schema
        ) => new Proxy({}, {
            get: (t,p,r) => {
                if (typeof (p) === 'symbol') throw new KinshipInvalidPropertyTypeError(p);
                if (this.#base.isRelationship(p, relationships)) {
                    return newProxy(relationships[p].table, 
                        relationships[p].alias,
                        relationships[p].relationships, 
                        relationships[p].schema
                    );
                }
                if(!(p in schema)) throw new KinshipColumnDoesNotExistError(p, realTableName);
                const field = schema[p].field;
                if(this.#state.where) {
                    //@ts-ignore `._append` is marked private so the User does not see the function.
                    return ctx.#state.where._append(field, `AND${ctx.#state.negated ? ' NOT' : ''}`);
                }
                const chain = this.#state.negated ? `WHERE NOT` : `WHERE`;
                return this.#state.where = /** @type {typeof Where<TTableModel, typeof field>} */ (Where)(
                    this.#base,
                    field,
                    table,
                    chain
                );
            }
        });
        callback(newProxy());
        this.#state.negated = false;
        return this;
    }

    /* -------------------------Configuration Functions------------------------- */
    // Users can configure one-to-one and one-to-many relationships on this context.

    hasOne() {

    }

    hasMany() {

    }

    /* -------------------------Trigger Handlers------------------------- */
    // Users can use `Trigger Handlers` to define behavior before and after a command is executed, 
    // essentially creating a middleware for each record passing through the context.
 
    /**
     * Set a trigger for every record that gets deleted within the context, __after__ the delete occurs.  
     * __If a delete occurs explicitly (e.g., using `.where(...).delete()`), then this trigger will not fire.__
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/exec-handler.js").TriggerAfterHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     */
    afterDelete(callback, hook=undefined) {
        this.#handlers.delete.after(callback, hook);
        return this;
    }

    /**
     * Set a trigger for every record that gets inserted into the context, __after__ the insert occurs.
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/exec-handler.js").TriggerAfterHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     */
    afterInsert(callback, hook=undefined) {
        this.#handlers.insert.after(callback, hook);
        return this;
    }

    /**
     * Set a trigger for every record that gets updated within the context, __after__ the update occurs.  
     * __If an update occurs explicitly (e.g., using `.where(...).update(m => ({ a: 1 }))`), then this trigger will not fire.__
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/exec-handler.js").TriggerAfterHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     */
    afterUpdate(callback, hook=undefined) {
        this.#handlers.update.after(callback, hook);
        return this;
    }

    /**
     * Set a trigger for every record explicitly given that gets deleted within the context, __before__ the delete occurs.  
     * __If a delete occurs explicitly (e.g., using `.where(...).delete()`), then this trigger will not fire.__
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the delete for every record that is to be deleted.
     * @param {import("../transactions/exec-handler.js").TriggerBeforeHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...hookArgs` parameter.
     */
    beforeDelete(callback, hook=undefined) {
        this.#handlers.delete.before(callback, hook);
        return this;
    }

    /**
     * Set a trigger for every record that gets inserted into the context, __before__ the insert occurs.
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/exec-handler.js").TriggerBeforeHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     */
    beforeInsert(callback, hook=undefined) {
        this.#handlers.insert.before(callback, hook);
        return this;
    }

    /**
     * Set a trigger for every record that gets updated within the context, __before__ the update occurs.  
     * __If an update occurs explicitly (e.g., using `.where(...).update(m => ({ a: 1 }))`), then this trigger will not fire.__
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the update for every record that is to be updated.
     * @param {import("../transactions/exec-handler.js").TriggerBeforeHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     */
    beforeUpdate(callback, hook=undefined) {
        this.#handlers.update.before(callback, hook);
        return this;
    }
    
    /* -------------------------Event Functions------------------------- */
    // Users can use `Event Functions` to define behavior for when a command succeeds/fails.

    onSuccess() {

    }

    onFail() {

    }

    /* -------------------------Private Functions------------------------- */
    // Extra private functions that are essential for many functions within this context.

    /**
     * Resets the `state` of the context back to `initialState`.
     */
    async #resetState() {
        this.#state = JSON.parse(JSON.stringify(this.#initialState));
        this.#state.where = this.#initialState.where
            //@ts-ignore _clone is marked private, but is available for usage here.
            ?._clone();
    }

    /**
     * Creates a new context with the initial state set to the state of this state.
     * @template {object|undefined} [T=TTableModel]
     * @template {object|undefined} [U=TAliasModel]
     * @returns {KinshipContext<T, U>}
     */
    #newContext() {
        /** @type {KinshipContext<T, U>} */
        //@ts-ignore One parameter constructor is only available to this getter.
        const ctx = new KinshipContext(this);
        return ctx;
    }

    /* -------------------------Disposable Functions------------------------- */
    // for TS 5.2, the `using` and `await using` keywords are implemented. 
    // If an adapter has to be disposed of (I.O.W., it was defined by the adapter developer) then they are handled here. 

    [Symbol.dispose]() {
        if(this.#base.adapter.dispose) {
            this.#base.adapter.dispose();
        }
    }

    async [Symbol.asyncDispose]() {
        if(this.#base.adapter.asyncDispose) {
            await this.#base.adapter.asyncDispose();
        }
    }
}

/**
 * Various builders that assist building the state of the context.
 * @template {object} TTableModel
 * @template {object} TAliasModel
 * @typedef {object} Builders
 * @prop {GroupByBuilder} groupBy
 * @prop {OrderByBuilder} orderBy
 * prop {SelectBuilder} select
 */

/**
 * @typedef {object} Handlers
 * @prop {KinshipDeleteHandler} delete
 * @prop {KinshipInsertHandler} insert
 * @prop {KinshipQueryHandler} query
 * @prop {KinshipUpdateHandler} update
 */

/**
 * Object that manages the state of clauses within this context.
 * @typedef {object} State
 * @prop {import("../clauses/include.js").FromClauseProperties=} from
 * @prop {import("../clauses/group-by.js").GroupByClauseProperty[]=} groupBy
 * @prop {boolean=} negated
 * @prop {number=} limit
 * @prop {number=} offset
 * @prop {import("../clauses/order-by.js").SortByClauseProperty[]=} orderBy
 * @prop {import("../clauses/order-by.js").Column[]=} select
 * @prop {WhereBuilder=} where
 */
