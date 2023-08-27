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
import { RelationshipBuilder, RelationshipType } from "../config/has-relationship.js";

/**
 * Establishes a connection directly to a table within your database.
 * @template {object|undefined} TTableModel
 * Type of the model that represents the table and its columns, in their exact form.
 * @template {object|undefined} [TAliasModel=import("../models/string.js").FriendlyType<import("../config/has-relationship.js").OnlyDataTypes<TTableModel>>]
 * Type of the model, `TTableModel`, which will be augmented as new clauses are called.
 */
export class KinshipContext {
    static n = 0;
    /* -------------------------Private Properties------------------------- */
    // Properties to maintain a flow and state of the context.

    /** The base Kinship platform that interfaces with the adapter and handlers. 
     * @type {KinshipBase} */ #base;
    /** Builders for clauses and state. 
     * @type {Builders<TTableModel, TAliasModel>} */ #builders;
    /** Handlers for transactions with the database. 
     * @type {Handlers} */ #handlers;
    /** @type {State=} */ #state;

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
     * @param {import("./adapter.js").KinshipAdapterConnection} adapter
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
            this.#builders = {
                groupBy: new GroupByBuilder(this.#base),
                orderBy: new OrderByBuilder(this.#base),
                relationships: new RelationshipBuilder(this.#base),
            };
            this.#resetState();
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
        if(this.#state) {
            this.#afterResync(() => /** @type {State} */ (this.#state));
        }
        const { numRowsAffected } = await this.#handlers.delete.handle(records);
        if(this.#state) {
            this.#resetState()
        }
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
        if(this.#state) {
            this.#afterResync(() => /** @type {State} */ (this.#state));
        }
        const { numRowsAffected, whereClause, ...data } = await this.#handlers.insert.handle(records);
        // If `whereClause` is NOT undefined, then the handler determined that virtual columns exist, so we must requery
        if(whereClause) { 
            const ctx = this.#newContext();
            ctx.#afterResync((oldState) => ({ ...oldState, where: whereClause }));
            records = /** @type {TAliasModel[]} */ (await ctx.select());
        } else {
            records = data.records;
        }
        if(this.#state) {
            this.#resetState()
        }
        return records;
    }

    /**
     * Queries selected columns or all columns from the context using a built state.
     * @template {import("../clauses/choose.js").SelectedColumnsModel<TAliasModel>|TAliasModel} [TSelectedColumns=TAliasModel]
     * Type that represents the selected columns.
     * @param {((model: import("../clauses/choose.js").SpfSelectCallbackModel<TAliasModel>) => 
     *  import("../models/maybe.js").MaybeArray<keyof TSelectedColumns>)=} callback
     * Callback model that allows the user to select which columns to grab.
     * @returns {Promise<(TSelectedColumns extends TAliasModel 
     *  ? TAliasModel 
     *  : import("../models/string.js").Reconstructed<TAliasModel, TSelectedColumns>)[]>}
     * Rows queried from the database serialized into a user-friendly format.
     */
    async select(callback=undefined) {
        if(this.#state) {
            this.#afterResync(() => /** @type {State} */ (this.#state));
        }
        const { records } = await this.#handlers.query.handle(undefined, callback);
        if(!this.#state) {
            this.#resetState();
        }
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
        if(this.#state) {
            this.#afterResync(() => /** @type {State} */ (this.#state));
        }
        if(typeof records === 'function') {
            var { numRowsAffected } = await this.#handlers.update.handle([], records);
        } else {
            var { numRowsAffected }  = await this.#handlers.update.handle(records);
        }
        if(!this.#state) {
            this.#resetState()
        }
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
        this.#afterResync((oldState) => this.#choose(callback, oldState));
        return /** @type {any} */ (this);
    }

    /**
     * Specify the columns to group the results on.  
     * This method will override any previous `.groupBy()` calls.
     * @template {import("../clauses/group-by.js").GroupedColumnsModel<TTableModel>} [TGroupedColumns=import("../clauses/group-by.js").GroupedColumnsModel<TTableModel>]
     * Used internally for typescript to create a new `TAliasModel` on the returned context, which will change the scope of what the user will see in further function calls.
     * @param {(model: import("../clauses/group-by.js").SpfGroupByCallbackModel<TTableModel>, aggregates: import("../clauses/group-by.js").Aggregates) => import("../models/maybe.js").MaybeArray<keyof TGroupedColumns>} callback
     * Property reference callback that is used to determine which column or columns should be selected and grouped on in future queries.
     * @returns {KinshipContext<TTableModel, import("../models/string.js").Reconstructed<TAliasModel, TGroupedColumns>>} A new context with the state of the context this occurred in addition with a new state of a GROUP BY clause.
     */
    groupBy(callback) {
        this.#afterResync((oldState) => this.#groupBy(callback, oldState));
        return /** @type {any} */ (this);
    }

    /**
     * @template {import("../config/has-relationship.js").IncludedColumnsModel<TTableModel>} TIncludedColumn
     * @param {(model: {[K in keyof import("../config/has-relationship.js").OnlyTableTypes<TTableModel>]: 
     *   import("../config/has-relationship.js").ThenIncludeCallback<
     *     import("../config/has-relationship.js").OnlyTableTypes<TTableModel>[K], K>
     *   }) => void
     * } callback
     * @returns {KinshipContext<TTableModel, TAliasModel & {[K in keyof TIncludedColumn as K extends keyof TTableModel ? K : never]: Exclude<TTableModel[K], undefined>}>} 
     */
    include(callback) {
        this.#afterResync((oldState) => this.#include(callback, oldState));
        return /** @type {any} */ (this);
    }

    /**
     * Skip some number of rows before retrieving.  
     * This method will override any previous `.skip()` calls.
     * @param {number} numberOfRecords Number of rows to skip.
     * @returns {KinshipContext<TTableModel, TAliasModel>}
     */
    skip(numberOfRecords) {
        this.#afterResync((oldState) => this.#skip(numberOfRecords, oldState));
        return this;
    }

    /**
     * Specify the columns to sort on (in the exact order).  
     * This method will stack, meaning it will not override previous `.sortBy()` calls.   
     * @param {(model: import("../clauses/order-by.js").SortByCallbackModel<TAliasModel>) 
     *   => import("../models/maybe.js").MaybeArray<
     *      import("../clauses/order-by.js").SortByClauseProperty
     *      |import("../clauses/order-by.js").SortByCallbackModelProp
     * >} callback
     * Property reference callback that is used to determine which column or columns will be used to sort the queried rows
     * @returns {KinshipContext<TTableModel, TAliasModel>} A new context with the state of the context this occurred in addition with a new state of an ORDER BY clause.
     */
    sortBy(callback) {
        this.#afterResync((oldState) => this.#sortBy(callback, oldState));
        return this;
    }
    
    /**
     * Limit the number of rows to retrieve.  
     * This method will override any previous `.take()` calls.
     * @param {number} numberOfRecords Number of rows to take.
     * @returns {KinshipContext<TTableModel, TAliasModel>}
     */
    take(numberOfRecords) {
        this.#afterResync((oldState) => this.#take(numberOfRecords, oldState));
        return this;
    }

    /**
     * Filter what rows are returned from your query.  
     * This method will stack, meaning it will not override previous `.where()` calls.   
     * @param {(model: import("../clauses/where.js").ChainObject<TAliasModel>) => void} callback
     * @returns {KinshipContext<TTableModel, TAliasModel>} 
     */
    where(callback) {
        this.#afterResync((oldState) => this.#where(callback, oldState));
        return this;
    }

    /* -------------------------Private Clause Functions------------------------- */
    // Private functions for use with their corresponding public Clause Function.

    /**
     * Handles merging the oldState with the choose clause that was added by the consumer.
     * @param {any} callback 
     * @param {State} oldState State of the context before this was called. 
     * @returns {State} The new state of the context.
     */
    #choose(callback, oldState) {
        return oldState;
    }

    /**
     * Handles merging the oldState with the group by clause that was added by the consumer.
     * @param {any} callback 
     * @param {State} oldState State of the context before this was called. 
     * @returns {State} The new state of the context.
     */
    #groupBy(callback, oldState) {
        const { select, groupBy } = this.#builders.groupBy.getState(callback);
        return { ...oldState, select, groupBy };
    }

    /**
     * Handles merging the oldState with the include clause that was added by the consumer.
     * @param {any} callback 
     * @param {State} oldState State of the context before this was called. 
     * @returns {State} The new state of the context.
     */
    #include(callback, oldState) {
        const state = this.#builders.relationships.getStateForInclude(callback);
        return { 
            ...oldState,  
            from: [...oldState.from, ...state.from],
            select: [...oldState.select, ...state.select]
        };
    }

    /**
     * Handles merging the oldState with the offset clause that was added by the consumer.
     * @param {number} numberOfRecords 
     * @param {State} oldState State of the context before this was called. 
     * @returns {State} The new state of the context.
     */
    #skip(numberOfRecords, oldState) {
        return { 
            ...oldState, 
            offset: numberOfRecords 
        };
    }
    
    /**
     * Handles merging the oldState with the order by clause that was added by the consumer.
     * @param {any} callback 
     * @param {State} oldState State of the context before this was called. 
     * @returns {State} The new state of the context.
     */
    #sortBy(callback, oldState) {
        return { ...oldState, orderBy: this.#builders.orderBy.getState(callback) };
    }

    /**
     * Handles merging the oldState with the limit clause that was added by the consumer.
     * @param {number} numberOfRecords 
     * @param {State} oldState State of the context before this was called. 
     * @returns {State} The new state of the context.
     */
    #take(numberOfRecords, oldState) {
        return { 
            ...oldState, 
            limit: numberOfRecords 
        };
    }

    /**
     * Handles merging the oldState with the where clause that was added by the consumer.
     * @param {any} callback 
     * @param {State} oldState State of the context before this was called. 
     * @returns {State} The new state of the context.
     */
    #where(callback, oldState) {
        let where = oldState.where;
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
                if(where) {
                    return where
                        //@ts-ignore `._append` is marked private so the User does not see the function.
                        ._append(field, table, `AND${oldState.negated ? ' NOT' : ''}`);
                }
                const chain = oldState.negated ? `WHERE NOT` : `WHERE`;
                where = /** @type {typeof Where<any, any>} */ (Where)(
                    this.#base,
                    field,
                    table,
                    chain
                );
                return where;
            }
        });
        callback(newProxy());
        return { 
            ...oldState,
            where,
            negated: false 
        };
    }

    /* -------------------------Configuration Functions------------------------- */
    // Users can configure one-to-one and one-to-many relationships on this context.

    /**
     * @param {import("../config/has-relationship.js").HasOneCallback<TTableModel>} callback 
     * @returns {this}
     */
    hasOne(callback) {
        this.#builders.relationships.configureRelationship(callback, RelationshipType.ONE_TO_ONE);
        return this;
    }

    /**
     * @param {import("../config/has-relationship.js").HasManyCallback<TTableModel>} callback 
     * @returns {this}
     */
    hasMany(callback) {
        this.#builders.relationships.configureRelationship(callback, RelationshipType.ONE_TO_MANY);
        return this;
    }

    /**
     * @returns {Promise<KinshipContext<TTableModel, TAliasModel>>}
     */
    async checkpoint() {
        this.#state = /** @type {State} */ (await this.#base.promise);
        return this;
    }

    /* -------------------------Trigger Handlers------------------------- */
    // Users can use `Trigger Handlers` to define behavior before and after a command is executed, 
    // essentially creating a middleware for each record passing through the context.
 
    /**
     * Set a trigger for every record that gets deleted within the context, __after__ the delete occurs.  
     * __If a delete occurs explicitly (e.g., using `.where(...).delete()`), then this trigger will not fire.__
     * @param {import("../transactions/exec-handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/exec-handler.js").TriggerHookCallback=} hook
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
     * @param {import("../transactions/exec-handler.js").TriggerHookCallback=} hook
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
     * @param {import("../transactions/exec-handler.js").TriggerHookCallback=} hook
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
     * @param {import("../transactions/exec-handler.js").TriggerHookCallback=} hook
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
     * @param {import("../transactions/exec-handler.js").TriggerHookCallback=} hook
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
     * @param {import("../transactions/exec-handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     */
    beforeUpdate(callback, hook=undefined) {
        this.#handlers.update.before(callback, hook);
        return this;
    }
    
    /* -------------------------Event Functions------------------------- */
    // Users can use `Event Functions` to define behavior for when a command succeeds/fails.

    onDeleteSuccess(callback) {
        this.#base.listener.onDeleteSuccess(callback);
    }

    onDeleteFail(callback) {
        this.#base.listener.onDeleteFail(callback);
    }

    onInsertSuccess(callback) {
        this.#base.listener.onInsertSuccess(callback);
    }

    onInsertFail(callback) {
        this.#base.listener.onInsertFail(callback);
    }

    onQuerySuccess(callback) {
        this.#base.listener.onQuerySuccess(callback);
    }

    onQueryFail(callback) {
        this.#base.listener.onQueryFail(callback);
    }

    onUpdateSuccess(callback) {
        this.#base.listener.onUpdateSuccess(callback);
    }

    onUpdateFail(callback) {
        this.#base.listener.onUpdateFail(callback);
    }

    onSuccess(callback) {
        this.onDeleteSuccess(callback);
        this.onInsertSuccess(callback);
        this.onQuerySuccess(callback);
        this.onUpdateSuccess(callback);
    }

    onFail(callback) {
        this.onDeleteFail(callback);
        this.onInsertFail(callback);
        this.onQueryFail(callback);
        this.onUpdateFail(callback);
    }

    /* -------------------------Private Functions------------------------- */
    // Extra private functions that are essential for many functions within this context.

    #resetState() {
        this.#afterResync(() => {
            return {
                select: this.#base.getAllSelectColumnsFromSchema(),
                from: [{
                    alias: this.#base.tableName,
                    realName: this.#base.tableName
                }]
            };
        });
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

    /**
     * Wrapper for `this.#base.afterResync` to only trigger the callback once the context has caught up with asynchronous work. 
     * @param {(oldState: import("./context.js").State) => import("./context.js").State|Promise<import("./context.js").State>} callback 
     */
    #afterResync(callback) {
        this.#base.afterResync(callback);
    }

    /* -------------------------Disposable Functions------------------------- */
    // for TS 5.2, the `using` and `await using` keywords are implemented. 
    // If an adapter has to be disposed of (I.O.W., it was defined by the adapter developer) then they are handled here. 

    //@ts-ignore 
    [Symbol.dispose]() {
        if(this.#base.adapter.dispose) {
            this.#base.adapter.dispose();
        }
    }

    //@ts-ignore 
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
 * @prop {RelationshipBuilder} relationships
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
 * @prop {import("../config/has-relationship.js").FromClauseProperties} from
 * @prop {import("../clauses/group-by.js").GroupByClauseProperty[]=} groupBy
 * @prop {boolean=} negated
 * @prop {number=} limit
 * @prop {number=} offset
 * @prop {import("../clauses/order-by.js").SortByClauseProperty[]=} orderBy
 * @prop {import("../clauses/order-by.js").Column[]} select
 * @prop {WhereBuilder=} where
 */

/**
 * Object that manages the state of clauses within this context.
 * @typedef {State & { conditions?: import("../clauses/where.js").WhereClausePropertyArray }} AdapterReadyState
 */

// polyfills for Dispose until it is officially released.

//@ts-ignore
Symbol.dispose ??= Symbol("dispose");
//@ts-ignore
Symbol.asyncDispose ??= Symbol("asyncDispose");