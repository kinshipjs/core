//@ts-check

import { KinshipBase } from "./base.js";
import { KinshipDeleteHandler } from "../transactions/delete.js";
import { KinshipInsertHandler } from "../transactions/insert.js";
import { KinshipQueryHandler } from "../transactions/query.js";
import { KinshipUpdateHandler } from "../transactions/update.js";
import { ErrorTypes, KinshipColumnDoesNotExistError, KinshipInvalidPropertyTypeError, RollbackInvokedError } from "../exceptions.js";
import { Where, WhereBuilder } from "../clauses/where.js";
import { GroupByBuilder } from "../clauses/group-by.js";
import { OrderByBuilder } from "../clauses/order-by.js";
import { RelationshipBuilder, RelationshipType } from "../config/relationships.js";
import { ChooseBuilder } from "../clauses/choose.js";


/**
 * Establishes a connection directly to a table within your database.  
 * @template {object} TTableModel
 * Type of the model that represents the table and its columns, in their exact form.
 * @template {object} [TAliasModel=OnlyDataTypes<TTableModel>]
 * Type of the model, `TTableModel`, which will be augmented as new clauses are called. (dynamically inferred throughout lifespan of object)
 */
export class KinshipContext {
    /* -------------------------Private Properties------------------------- */
    // Properties to maintain a flow and state of the context.

    /** 
     * The base Kinship platform that interfaces with the adapter and handlers. 
     * @type {KinshipBase} 
     */ 
    #base;
    /** 
     * Builders for clauses and state. 
     * @type {Builders<TTableModel, TAliasModel>} 
     */ 
    #builders;
    /** 
     * Handlers for transactions with the database. 
     * @type {Handlers} 
     */ 
    #handlers;
    /** 
     * Holds the current state of the context in its asynchronous form. 
     * @type {Promise<State>} 
     */ 
    #promise = Promise.resolve(/** @type {State} */ ({}));
    /** When the context is first created, we don't want to connect to the database until the User directly interacts with the context.
     * So, we store all of the setup statements inside of this `#initialize` function variable.  
     * 
     * If this variable is undefined, then the context should already be initialized.  
     * 
     * This variable will be initialized to a void function if the context is created manually by the consumer (constructor).  
     * 
     * This variable will be called when any clause function is called (i.e., `.where`, `.include`, `.select`, etc.)
     * @type {(() => void)=} 
     */ 
    #initialize = undefined;

    get _promise() {
        return this.#promise;
    }

    get _table() {
        return this.#base.tableName;
    }

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
     * Instantiate a new `KinshipContext` object.
     * @param {import("../adapter.js").KinshipAdapterConnection} adapter
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
            this.#promise = new Promise(res => {
                adapter.#promise.then(oldState => res(oldState));
            });
            this.#promise = adapter.#promise.then(oldState => oldState);
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
                choose: new ChooseBuilder(this.#base)
            };
            
            // context was manually created, which means initialization should wait until the first command is ran.
            this.#initialize = () => {
                this._afterResync(async (oldState) => {
                    const schema = await this.#base.describe(tableName);
                    this.#base.schema = schema;
                    return oldState;
                });
                this.#resetState();
            }
        }
    }

    /* -------------------------Transaction Functions------------------------- */
    // Users can perform some transaction with the database using the state of the context.

    /**
     * Retrieve the number of rows from the built query.
     * @returns {Promise<number>} Number of rows retrieved.
     */
    async count() {
        this.#connect();
        this._afterResync((oldState) => ({
            ...oldState,
            select: [{
                table: "",
                alias: "$$count",
                column: this.#base.adapter.aggregates.total,
                aggregate: ""
            }],
        }));
        const { records } = await this.#handlers.query.handle(this.#promise, undefined);
        this.#resetState();
        return /** @type {any} */ (records[0]).$$count;
    }

    /**
     * Delete rows in the table using a previously built `.where()` clause function.
     * @overload
     * @returns {Promise<number>} Number of rows delete.
     */
    /**
     * Delete records based on their primary key.  
     * If no primary key exists on the record, then they will be ignored.
     * @overload
     * @param {import("../models/maybe.js").MaybeArray<TTableModel>} records
     * Records to delete using their primary key(s).
     * @returns {Promise<number>} Number of rows delete.
     */
    /**
     * Deletes records in the table connected to this context.
     * @param {import("../models/maybe.js").MaybeArray<TTableModel>=} records 
     * Records to delete using their primary key(s) or undefined if using `.where()`.
     * @returns {Promise<number>} Number of rows deleted.
     */
    async delete(records=undefined) {
        this.#connect();
        return this.#delete(records);
    }

    /**
     * Deletes records in the table connected to this context.
     * @param {import("../models/maybe.js").MaybeArray<TTableModel>=} records 
     * Records to delete using their primary key(s) or undefined if using `.where()`.
     * @param {any|undefined} transaction
     * Transaction that is used instead of the connection object.
     * @returns {Promise<number>} Number of rows deleted.
     */
    async #delete(records=undefined, transaction=undefined) {
        const { numRowsAffected } = await this.#handlers.delete.handle(this.#promise, { records, transaction });
        return numRowsAffected;
    }

    /**
     * Insert records into the table.
     * @param {import("../models/maybe.js").MaybeArray<TTableModel>} records
     * Record or records to insert into the database.
     * @returns {Promise<TTableModel[]>} 
     * The same records that were inserted, with updated properties of any default values.  
     * __Default values include virtual columns, database defaults, and user defined defaults.__
     */
    async insert(records) {
        this.#connect();
        return this.#insert(records);
    }

    /**
     * Insert records into the table.
     * @param {import("../models/maybe.js").MaybeArray<TTableModel>} records
     * Record or records to insert into the database.
     * @param {any|undefined} transaction
     * Transaction that is used instead of the connection object.
     * @returns {Promise<TTableModel[]>} 
     * The same records that were inserted, with updated properties of any default values.  
     * __Default values include virtual columns, database defaults, and user defined defaults.__
     */
    async #insert(records, transaction=undefined) {
        this.#connect();
        const { numRowsAffected, whereClause, ...data } = await this.#handlers.insert.handle(this.#promise, { records, transaction });
        // If `whereClause` is NOT undefined, then the handler determined that virtual columns exist, so we must requery
        if(whereClause) { 
            const ctx = this.#newContext();
            ctx._afterResync((oldState) => ({ ...oldState, where: whereClause }));
            records = /** @type {TTableModel[]} */ (/** @type {unknown} */ (await ctx));
        } else {
            records = data.records;
        }
        return records;
    }

    /**
     * Query the table given the state of the context.
     * @param {(records: TAliasModel[]) => void} resolve
     * @returns {Promise<TAliasModel[]>}
     */
    async then(resolve) {
        this.#connect();
        const { records } = await this.#handlers.query.handle(this.#promise, {});
        resolve(/** @type {any} */(records));
        return /** @type {TAliasModel[]} */ (records);
    }

    /**
     * Truncate the table this context represents.
     * @returns {Promise<number>} Number of rows that were deleted.
     */
    async truncate() {
        this.#connect();
        return this.#truncate();
    }

    /**
     * Truncate the table this context represents.
     * @param {any|undefined} transaction
     * Transaction that is used instead of the connection object.
     * @returns {Promise<number>} Number of rows that were deleted.
     */
    async #truncate(transaction=undefined) {
        const { numRowsAffected } = await this.#handlers.delete.handle(this.#promise, { transaction, truncate: true });
        return numRowsAffected;
    }

    /**
     * Update records based on their primary key.  
     * @overload
     * @param {import("../models/maybe.js").MaybeArray<TTableModel>} records
     * Records to update.  
     * __If any record does not have a primary key, then that record is ignored in the update.__
     * @returns {Promise<number>} Number of updated rows.
     */
    /**
     * Update values in the table based on a previously built `.where()` method call.
     * @overload
     * @param {(model: TTableModel) => void} callback
     * Callback where `model` intercepts all property references to determine which columns should be updated and what value to be updated to.
     * @returns {Promise<number>} Number of updated rows.
     */
    /**
     * Update values in the table based on a previously built `.where()` method call.
     * @overload
     * @param {(m: TTableModel) => Partial<TTableModel>} callback
     * Callback where the properties on the return value determine what columns should be updated and what to.
     * @returns {Promise<number>} Number of updated rows.
     */
    /**
     * Update rows in the table.
     * @param {import("../models/maybe.js").MaybeArray<TTableModel>|((m: TTableModel) => Partial<TTableModel>|void)} recordsOrCallback 
     * A record, or an array of records to be updated on primary key 
     * or a callback that specifies which column should be updated to what value.
     * __If any record does not have a primary key, then that record is ignored in the update.__
     * @returns {Promise<number>} Number of updated rows.
     */
    async update(recordsOrCallback) {
        return this.#update(recordsOrCallback);
    }

    /**
     * Update rows in the table.
     * @param {import("../models/maybe.js").MaybeArray<TTableModel>|((m: TTableModel) => Partial<TTableModel>|void)} recordsOrCallback 
     * A record, or an array of records to be updated on primary key 
     * or a callback that specifies which column should be updated to what value.
     * __If any record does not have a primary key, then that record is ignored in the update.__
     * @param {any|undefined} transaction
     * Transaction that is used instead of the connection object.
     * @returns {Promise<number>} Number of updated rows.
     */
    async #update(recordsOrCallback, transaction=undefined) {
        if(typeof recordsOrCallback === 'function') {
            var { numRowsAffected } = await this.#handlers.update.handle(this.#promise, { callback: recordsOrCallback, transaction });
        } else {
            var { numRowsAffected }  = await this.#handlers.update.handle(this.#promise, { records: recordsOrCallback, transaction });
        }

        return numRowsAffected;
    }

    /**
     * Explicitly uses the given `transaction` for the next `insert`, `update`, or `delete` function 
     * to use the given `transaction` argument, received from the `.transaction(...).execute((transaction) => { ... })`;
     * @param {any} transaction 
     * Transaction that the next the `insert`, `update`, or `delete` function should use instead of the default connection.
     * @returns {this}
     */
    using(transaction) {
        const newProxy = (self) => new Proxy(self, {
            get(t,p) {
                // intercept the main transaction functions that must be done in a transaction, when a transaction is specified.
                // then,
                // return another proxy, which will intercept the direct calls to `update()`, `delete()`, and `insert()` functions,
                // to add the actual `transaction` as an argument.
                if(String(p) === 'delete') {
                    return new Proxy(self.#delete, {
                        apply(target, _, args) {
                            return self.#delete(args[0], transaction);
                        }
                    });
                }
                if(String(p) === 'insert') {
                    return new Proxy(self.#insert, {
                        apply(target, _, args) {
                            return self.#insert(args[0], transaction);
                        }
                    });
                }
                if(String(p) === 'update') {
                    return new Proxy(self.#update, {
                        apply(target, _, args) {
                            return self.#update(args[0], transaction);
                        }
                    });
                }
                if(typeof self[p] === 'function') {
                    return new Proxy(self[p], {
                        apply(target, _, args) {
                            return newProxy(self[p](...args));
                        }
                    })
                }
                return this[p];
            }
        });
        return newProxy(this);
    }

    /* -------------------------Public Clause Functions------------------------- */
    // Users can add clauses to their built queries.

    /**
     * Select which columns to retrieve on the next `.select()` transaction.  
     * This method will stack, meaning it will __NOT__ override previous `.choose()` calls.   
     * @template {import("../clauses/choose.js").SelectedColumnsModel<TAliasModel>|TAliasModel} [TSelectedColumns=TAliasModel]
     * The new model type that the context represents. (inferred from usage of `callback`)
     * @param {((model: import("../clauses/choose.js").SpfSelectCallbackModel<TAliasModel>) => 
     *  import("../models/maybe.js").MaybeArray<keyof TSelectedColumns>)=} callback
     * Callback model that allows the user to select which columns to grab.  
     * @returns {KinshipContext<TTableModel, (TSelectedColumns extends Required<TAliasModel>
     *  ? TAliasModel
     *  : import("../models/string.js").Reconstructed<TAliasModel, TSelectedColumns>)>}
     * Reference to the same `KinshipContext`.
     */
    select(callback) {
        const ctx = this.#newContext();
        ctx._afterResync((oldState) => ctx.#builders.choose.getState(oldState, callback));
        return /** @type {any} */ (ctx);
    }

    /**
     * Specify the columns to group the results on.  
     * This method will override any previous `.groupBy()` calls.
     * @template {import("../clauses/group-by.js").GroupedColumnsModel<TTableModel>} [TGroupedColumns=import("../clauses/group-by.js").GroupedColumnsModel<TTableModel>]
     * The new model type that the context represents. (inferred from usage of `callback`)
     * @param {(model: import("../clauses/group-by.js").SpfGroupByCallbackModel<TTableModel>, aggregates: import("../clauses/group-by.js").Aggregates) => import("../models/maybe.js").MaybeArray<keyof TGroupedColumns>} callback
     * Property reference callback that is used to determine which column(s) and aggregates should be selected and grouped on.
     * @returns {KinshipContext<TTableModel, import("../models/string.js").Reconstructed<TAliasModel, TGroupedColumns>>}
     * Reference to the same `KinshipContext`.
     */
    groupBy(callback) {
        const ctx = this.#newContext();
        ctx._afterResync((oldState) => ctx.#builders.groupBy.getState(oldState, callback));
        return /** @type {any} */ (ctx);
    }

    /**
     * Include configured related tables.  
     * This method will stack, meaning it will __NOT__ override previous `.include()` calls.   
     * @template {import("../config/relationships.js").IncludedColumnsModel<TTableModel>} TIncludedColumn
     * The new model type that the context represents. (inferred from usage of `callback`)
     * @param {(model: {[K in keyof import("../config/relationships.js").OnlyTableTypes<TTableModel>]: 
     *   import("../config/relationships.js").ThenIncludeCallback<
     *     import("../config/relationships.js").OnlyTableTypes<TTableModel>[K], K>
     *   }) => void
     * } callback
     * Property reference callback that is used to determine which related tables should be included.
     * @returns {KinshipContext<TTableModel, import("../models/string.js").FriendlyType<TAliasModel & {[K in keyof TIncludedColumn as K extends keyof TTableModel ? K : never]: Exclude<TTableModel[K], undefined>}>>} 
     * Reference to the same `KinshipContext`.
     */
    include(callback) {
        const ctx = this.#newContext();
        ctx._afterResync((oldState) => ctx.#builders.relationships.getStateForInclude(oldState, callback));
        return /** @type {any} */ (ctx);
    }

    /**
     * Skip some number of rows before retrieving.  
     * This method will override any previous `.skip()` calls.
     * @param {number} numberOfRecords 
     * Number of rows to skip.
     * @returns {KinshipContext<TTableModel, TAliasModel>}
     * Reference to the same `KinshipContext`.
     */
    skip(numberOfRecords) {
        const ctx = this.#newContext();
        ctx._afterResync((oldState) => ({ ...oldState, offset: numberOfRecords}));
        return ctx;
    }

    /**
     * Specify the columns to sort on (in the exact order).  
     * This method will stack, meaning it will not override previous `.sortBy()` calls.   
     * @param {(model: import("../clauses/order-by.js").SortByCallbackModel<TAliasModel>) 
     *   => import("../models/maybe.js").MaybeArray<
     *      import("../clauses/order-by.js").SortByClauseProperty
     *      |import("../clauses/order-by.js").SortByCallbackModelProp
     * >} callback
     * Property reference callback that is used to determine which column or columns will be used to sort the queried rows.
     * @returns {KinshipContext<TTableModel, TAliasModel>}
     * Reference to the same `KinshipContext`.
     */
    sortBy(callback) {
        const ctx = this.#newContext();
        ctx._afterResync((oldState) => ctx.#builders.orderBy.getState(oldState, callback));
        return ctx;
    }
    
    /**
     * Limit the number of rows to retrieve.  
     * This method will override any previous `.take()` calls.
     * @param {number} numberOfRecords 
     * Number of rows to retrieve.
     * @returns {KinshipContext<TTableModel, TAliasModel>}
     * Reference to the same `KinshipContext`.
     */
    take(numberOfRecords) {
        const ctx = this.#newContext();
        ctx._afterResync((oldState) => ({ ...oldState, limit: numberOfRecords }));
        return ctx;
    }

    /**
     * Filter what rows are returned from your query.  
     * This method will stack, meaning it will not override previous `.where()` calls.   
     * @param {(model: import("../clauses/where.js").ChainObject<TAliasModel>) => void} callback
     * Property reference callback which gives context to a {@link WhereBuilder} object for building filters.
     * @returns {KinshipContext<TTableModel, TAliasModel>} 
     * Reference to the same `KinshipContext`.
     */
    where(callback) {
        const ctx = this.#newContext();
        ctx._afterResync((oldState) => ctx.#where(callback, oldState));
        return ctx;
    }

    /**
     * Handles merging the oldState with the where clause that was added by the consumer.
     * @param {any} callback 
     * Callback that was passed into `.where()`.
     * @param {State} oldState 
     * State of the context before this was called. 
     * @returns {State} 
     * The new state of the context.
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
     * Configure a one-to-one relationship from this table to another table.
     * @param {import("../config/relationships.js").HasOneCallback<TTableModel>} callback
     * Property reference callback that gives context to functions for configuring which keys, 
     * as well as `.thenInclude()` for further configuring relationships.
     * @returns {this}
     * Reference to the same `KinshipContext`.
     */
    hasOne(callback) {
        if(this.#initialize) {
            const fn = this.#initialize;
            this.#initialize = () => {
                fn();
                this.#builders.relationships.configureRelationship(this._afterResync.bind(this), callback, RelationshipType.OneToOne);
            }
        }
        return this;
    }

    /**
     * Configure a one-to-many relationship from this table to another table.
     * @param {import("../config/relationships.js").HasManyCallback<TTableModel>} callback 
     * Property reference callback that gives context to functions for configuring which keys, 
     * as well as `.thenInclude()` for further configuring relationships.
     * @returns {this}
     * Reference to the same `KinshipContext`.
     */
    hasMany(callback) {
        if(this.#initialize) {
            const fn = this.#initialize;
            this.#initialize = () => {
                fn();
                this.#builders.relationships.configureRelationship(this._afterResync.bind(this), callback, RelationshipType.OneToMany);
            }
        }
        return this;
    }

    /* -------------------------Trigger Handlers------------------------- */
    // Users can use `Trigger Handlers` to define behavior before and after a command is executed, 
    // essentially creating a middleware for each record passing through the context.
 
    /**
     * Set a trigger for every record that gets deleted within the context, __after__ the delete occurs.  
     * __If a delete occurs explicitly (e.g., using `.where(...).delete()`), then this trigger will not fire.__
     * @param {import("../transactions/handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     * @returns {InstanceType<KinshipDeleteHandler>['afterUnsubscribe']} Object that has two functions-- `once` and `unsubscribe`.
     */
    afterDelete(callback, hook=undefined) {
        return this.#handlers.delete.after(callback, hook);
    }

    /**
     * Set a trigger for every record that gets inserted into the context, __after__ the insert occurs.
     * @param {import("../transactions/handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     * @returns {InstanceType<KinshipDeleteHandler>['afterUnsubscribe']} Object that has two functions-- `once` and `unsubscribe`.
     */
    afterInsert(callback, hook=undefined) {
        return this.#handlers.insert.after(callback, hook);
    }

    /**
     * Set a trigger for every record that returns from a query.
     * @param {import("../transactions/handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called after a query is completed.
     * @param {import("../transactions/handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     * @returns {InstanceType<KinshipQueryHandler>['afterUnsubscribe']} Object that has two functions-- `once` and `unsubscribe`.
     */
    afterQuery(callback, hook=undefined) {
        return this.#handlers.query.after(callback, hook);
    }

    /**
     * Set a trigger for every record that gets updated within the context, __after__ the update occurs.  
     * __If an update occurs explicitly (e.g., using `.where(...).update(m => ({ a: 1 }))`), then this trigger will not fire.__
     * @param {import("../transactions/handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     * @returns {InstanceType<KinshipDeleteHandler>['afterUnsubscribe']} Object that has two functions-- `once` and `unsubscribe`.
     */
    afterUpdate(callback, hook=undefined) {
        return this.#handlers.update.after(callback, hook);
    }

    /**
     * Set a trigger for every record explicitly given that gets deleted within the context, __before__ the delete occurs.  
     * __If a delete occurs explicitly (e.g., using `.where(...).delete()`), then this trigger will not fire.__  
     * @param {import("../transactions/handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the delete for every record that is to be deleted.
     * @param {import("../transactions/handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...hookArgs` parameter.
     * @returns {InstanceType<KinshipDeleteHandler>['beforeUnsubscribe']} Object that has two functions-- `once` and `unsubscribe`.
     */
    beforeDelete(callback, hook=undefined) {
        return this.#handlers.delete.before(callback, hook);
    }

    /**
     * Set a trigger for every record that gets inserted into the context, __before__ the insert occurs.
     * @param {import("../transactions/handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the insert for every record that is to be inserted.
     * @param {import("../transactions/handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     * @returns {InstanceType<KinshipDeleteHandler>['beforeUnsubscribe']} Object that has two functions-- `once` and `unsubscribe`.
     */
    beforeInsert(callback, hook=undefined) {
        return this.#handlers.insert.before(callback, hook);
    }

    /**
     * Set a trigger for every record that gets updated within the context, __before__ the update occurs.  
     * __If an update occurs explicitly (e.g., using `.where(...).update(m => ({ a: 1 }))`), then this trigger will not fire.__
     * @param {import("../transactions/handler.js").TriggerCallback<TTableModel>} callback
     * Function that will be called before the update for every record that is to be updated.
     * @param {import("../transactions/handler.js").TriggerHookCallback=} hook
     * Function that is called once before the trigger and establishes static arguments to be available to `callback` within the `...args` parameter.
     * @returns {InstanceType<KinshipDeleteHandler>['beforeUnsubscribe']} Object that has two functions-- `once` and `unsubscribe`.
     */
    beforeUpdate(callback, hook=undefined) {
        return this.#handlers.update.before(callback, hook);
    }
    
    /* -------------------------Event Functions------------------------- */
    // Users can use `Event Functions` to define behavior for when a command succeeds/fails.

    /**
     * Specify a function to be called when a successful transactional event occurs on the context.
     * @param {import("../events.js").SuccessHandler} callback Callback to add to the event handler.
     * @returns {() => void} Function for the user to use to unsubscribe to the event.
     */
    onDeleteSuccess(callback) {
        return this.#base.listener.onDeleteSuccess(callback);
    }

    /**
     * Specify a function to be called when a successful transactional event occurs on the context.
     * @param {import("../events.js").FailHandler} callback Callback to add to the event handler.
     * @returns {() => void} Function for the user to use to unsubscribe to the event.
     */
    onDeleteFail(callback) {
        return this.#base.listener.onDeleteFail(callback);
    }

    /**
     * Specify a function to be called when a successful transactional event occurs on the context.
     * @param {import("../events.js").SuccessHandler} callback Callback to add to the event handler.
     * @returns {() => void} Function for the user to use to unsubscribe to the event.
     */
    onInsertSuccess(callback) {
        return this.#base.listener.onInsertSuccess(callback);
    }

    /**
     * Specify a function to be called when a successful transactional event occurs on the context.
     * @param {import("../events.js").FailHandler} callback Callback to add to the event handler.
     * @returns {() => void} Function for the user to use to unsubscribe to the event.
     */
    onInsertFail(callback) {
        return this.#base.listener.onInsertFail(callback);
    }

    /**
     * Specify a function to be called when a successful transactional event occurs on the context.
     * @param {import("../events.js").SuccessHandler} callback Callback to add to the event handler.
     * @returns {() => void} Function for the user to use to unsubscribe to the event.
     */
    onQuerySuccess(callback) {
        return this.#base.listener.onQuerySuccess(callback);
    }

    /**
     * Specify a function to be called when a successful transactional event occurs on the context.
     * @param {import("../events.js").FailHandler} callback Callback to add to the event handler.
     * @returns {() => void} Function for the user to use to unsubscribe to the event.
     */
    onQueryFail(callback) {
        return this.#base.listener.onQueryFail(callback);
    }

    /**
     * Specify a function to be called when a successful transactional event occurs on the context.
     * @param {import("../events.js").SuccessHandler} callback Callback to add to the event handler.
     * @returns {() => void} Function for the user to use to unsubscribe to the event.
     */
    onUpdateSuccess(callback) {
        return this.#base.listener.onUpdateSuccess(callback);
    }

    /**
     * Specify a function to be called when a successful transactional event occurs on the context.
     * @param {import("../events.js").FailHandler} callback Callback to add to the event handler.
     * @returns {() => void} Function for the user to use to unsubscribe to the event.
     */
    onUpdateFail(callback) {
        return this.#base.listener.onUpdateFail(callback);
    }

    /**
     * Specify a function to be called when a successful transactional event occurs on the context.
     * @param {import("../events.js").SuccessHandler} callback Callback to add to the event handler.
     * @returns {() => void} Function for the user to use to unsubscribe to the event.
     */
    onSuccess(callback) {
        const unsubscribeFunctions = [
            this.onDeleteSuccess(callback),
            this.onInsertSuccess(callback),
            this.onQuerySuccess(callback),
            this.onUpdateSuccess(callback)
        ];
        return () => {
            for(const unsubscribe of unsubscribeFunctions) {
                unsubscribe();
            }
        }
    }

    /**
     * Specify a function to be called when a successful transactional event occurs on the context.
     * @param {import("../events.js").FailHandler} callback Callback to add to the event handler.
     * @returns {() => void} Function for the user to use to unsubscribe to the event.
     */
    onFail(callback) {
        const unsubscribeFunctions = [
            this.onDeleteFail(callback),
            this.onInsertFail(callback),
            this.onQueryFail(callback),
            this.onUpdateFail(callback)
        ];
        return () => {
            for(const unsubscribe of unsubscribeFunctions) {
                unsubscribe();
            }
        }
    }

    /* -------------------------Private Functions------------------------- */
    // Extra private functions that are essential for many functions within this context.

    /**
     * Resets the state of this context to its saved state, or to the default base state if no saved state exists.
     */
    #resetState() {
        this._afterResync(() => ({
            select: this.#base.getAllSelectColumnsFromSchema(),
            from: [{
                alias: this.#base.tableName,
                realName: this.#base.tableName
            }]
        }));
    }

    /**
     * Creates a new context with the initial state set to the state of this state.
     * @template {object} [T=TTableModel]
     * @template {object} [U=TAliasModel]
     * @returns {KinshipContext<T, U>}
     */
    #newContext() {
        this.#connect();
        /** @type {KinshipContext<T, U>} */
        //@ts-ignore One parameter constructor is only available to this getter.
        const ctx = new KinshipContext(this);
        return ctx;
    }

    /**
     * If the context has not been initialized yet (a connection has not been established)
     * then this function will initialize the context.
     */
    #connect() {
        if(this.#initialize) {
            this.#initialize();
            this.#initialize = undefined;
        }
    }

    /**
     * @private
     * Wrapper for `this.#base.afterResync` to only trigger the callback once the context has caught up with asynchronous work. 
     * @param {(oldState: import("./context.js").State) => import("./context.js").State|Promise<import("./context.js").State>} callback
     * Callback that returns the new state. 
     */
    _afterResync(callback) {
        this.#promise = this.#promise.then((oldState) => {
            const newState = callback(oldState);
            return newState;
        }).catch(err => {
            throw err;
        });
    }

    /* -------------------------Disposable Functions------------------------- */
    // for TS 5.2, the `using` and `await using` keywords are implemented. 
    // If an adapter has to be disposed of (I.O.W., it was defined by the adapter developer) then they are handled here. 
    
    [
        // @ts-ignore Ignoring until this becomes an official polyfill.
        Symbol.dispose
    ]() {
        if(this.#base.adapter.dispose) {
            this.#base.adapter.dispose();
        }
    }

    async [
        // @ts-ignore Ignoring until this becomes an official polyfill.
        Symbol.asyncDispose
    ]() {
        if(this.#base.adapter.asyncDispose) {
            await this.#base.adapter.asyncDispose();
        }
    }

    /* -------------------------EXPERIMENTAL------------------------- */

    /**
     * Will return a new object: KinshipPreparedCommand
     * which the user can then call `.execute()` at any time to execute the serialized command at any given time.
     * 
     * This is intended to skip the step of serializing the command entirely at the sacrifice of not adding anything new to the command.
     * @private
     */
    async prepare() {

    }
}

/**
 * Perform an "all or nothing" transaction, where all commands placed within the transaction will only succeed if the passed callback resolves gracefully.  
 * 
 * Inside the callback, a parameter is available, called `transaction`, which will be some object, typed `any`, that must be used in conjunction
 * with the contexts being used within the transaction by calling the `.using(transaction)` function on the context before proceeding with anything else.  
 * 
 * This is because some adapters require the same transaction connection, 
 * or otherwise there are conflicts with the original connection setup when creating the context.
 * @example
 * ```ts
 * const dbConnection = // ... preferred db connection
 * const cnn = adapter(dbConnection); // respective adapter
 * const ctx = new KinshipContext<{ id: number }>(cnn, "Foo");
 * 
 * function doStuff() {
 *   throw new Error(`Uh oh!`);
 * }
 * 
 * await transaction(cnn).execute(async tnx => {
 *   const $ctx = ctx.using(tnx);
 *   await $ctx.where(m => m.id.equals(5)).delete();
 *   // or
 *   await ctx.using(tnx).where(m => m.id.equals(5)).delete();
 *   doStuff();
 *   return 1;
 * });
 * 
 * console.log("Hello world!"); // this code will never reach, and the Foo record with id, `5`, will not be deleted.
 * ```
 * @param {import("../adapter.js").KinshipAdapterConnection} adapterConnection
 * The adapter connection to your database.
 * @returns {{ execute: <TReturnType>(callback: (transaction: any|undefined) => import("../models/maybe.js").MaybePromise<TReturnType>) => Promise<TReturnType> }}
 * Object with one property-- `execute`, which will accept a callback where all kinship
 */
export function transaction(adapterConnection) {
    return {
        async execute(callback) {
            const { begin, commit, rollback } = await adapterConnection.execute({
                KinshipAdapterError: (msg) => new Error(),
                ErrorTypes
            }).forTransaction();
            const transaction = await begin();
            try {
                const result = await callback(transaction);
                await commit(transaction);
                return result;
            } catch(err) {
                await rollback(transaction);
                throw err;
            }
        }
    }
}

/** @template {object} T @typedef {import("../models/string.js").FriendlyType<import("../config/relationships.js").OnlyDataTypes<T>>} OnlyDataTypes */

/**
 * Various builders to handle clause methods that assist building the state of the context.
 * @template {object} TTableModel
 * @template {object} TAliasModel
 * @typedef {object} Builders
 * @prop {GroupByBuilder} groupBy
 * @prop {OrderByBuilder} orderBy
 * @prop {RelationshipBuilder} relationships
 * @prop {ChooseBuilder} choose
 */

/**
 * Various handlers to handle transaction methods that complete a command and interact with the database.
 * @typedef {object} Handlers
 * @prop {KinshipDeleteHandler} delete
 * @prop {KinshipInsertHandler} insert
 * @prop {KinshipQueryHandler} query
 * @prop {KinshipUpdateHandler} update
 */

/**
 * Object that manages the state of clauses within this context.
 * @typedef {object} State
 * @prop {import("../config/relationships.js").FromClauseProperties} from
 * @prop {import("../clauses/group-by.js").GroupByClauseProperty[]=} groupBy
 * @prop {boolean=} negated
 * @prop {number=} limit
 * @prop {number=} offset
 * @prop {import("../clauses/order-by.js").SortByClauseProperty[]=} orderBy
 * @prop {import("./base.js").Column[]} select
 * @prop {WhereBuilder=} where
 */

/**
 * Object that holds the final state of the context right before the command is sent to the adapter for processing.
 * @typedef {State & { conditions?: import("../clauses/where.js").WhereClausePropertyArray }} AdapterReadyState
 */

// polyfills for Dispose until it is officially released.

//@ts-ignore
Symbol.dispose ??= Symbol("dispose");
//@ts-ignore
Symbol.asyncDispose ??= Symbol("asyncDispose");