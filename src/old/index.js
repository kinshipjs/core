//@ts-check
import { KinshipAdapterError, 
    KinshipColumnDoesNotExistError, 
    KinshipConstraintError, 
    KinshipInternalError, 
    KinshipInvalidPropertyTypeError, 
    KinshipNonUniqueKeyError, 
    KinshipNotImplementedError, 
    KinshipOptionsError, 
    KinshipSyntaxError } from "./exceptions.js";
import { deepCopy } from "./util.js";
import { Where, WhereBuilder } from "./where-builder.js";
import * as Types from "./types.js";
import { CommandListener } from "./events.js";
import { setDefaultResultOrder } from "dns";

/**
 * @typedef {object} KinshipOptions
 * @prop {boolean=} allowTruncation
 * Disable protective measures to prevent an accidental truncation of your table through the `.truncate()` function. (default: false)
 * @prop {boolean=} allowUpdateAll
 * Disable protective measures to prevent an accidental update of all records on your table. (default: false)
 */

/**
 * @typedef {Omit<Omit<Types.FromClauseProperty, "referenceTableKey">, "refererTableKey">} MainTableFromClauseProperty
 */

/**
 * @template {SqlTable} T 
 * Model representing the raw table in SQL.
 * @template {SqlTable} U 
 * Model representing the table how it is worked on in `Kinship`.
 * @typedef {object} ContextState
 * @prop {Types.SelectClauseProperty[]} select
 * Columns to retrieve from the database.
 * @prop {[MainTableFromClauseProperty, ...Types.FromClauseProperty[]]} from
 * Tables to retrieve columns from in the database. (The first index will always be the main table of the context.)
 * @prop {Types.GroupByClauseProperty[]=} groupBy
 * Columns to group by.
 * @prop {Types.SortByClauseProperty[]=} sortBy
 * Columns to sort by.
 * @prop {number=} limit
 * Number of rows to retrieve.
 * @prop {number=} offset
 * Number of rows to skip before retrieving.
 * @prop {WhereBuilder<any, any>=} where
 * Builder representing state of the WHERE clause.
 * @prop {boolean=} explicit
 * True if the next update/delete operation should be explicit. False otherwise.
 * @prop {boolean=} negated
 * Direct relationships from this table.
 * @prop {((t: U) => T)=} mapBack 
 * Mapping function used to map aliased records to the raw table models.
 * @prop {((t: T) => U)=} mapForward 
 * Mapping function used to map raw table records to the aliased version.
 */

/**
 * @enum {0|1|2|3}
 */
export const EventTypes = {
    QUERY: /** @type {0} */ (0),
    INSERT: /** @type {1} */ (1),
    UPDATE: /** @type {2} */ (2),
    DELETE: /** @type {3} */ (3),
};

/**
 * Class representing a connection to a database's table for usage of relational mapping.
 * @template {Types.SqlTable} TTableModel
 * Original table model as it is portrayed in the database.
 * @template {Types.SqlTable} [TAliasModel=Types.OnlyNonSqlTables<TTableModel>]
 * **Used internally**  
 * Uses to track the state of what the models should look like in the arguments or return values for transactional functions (`.select()`, `.insert()`, `.update()`, `.delete()`)
 */
export class KinshipContext {
    /** Table name as it appears in the database.
     * @protected @type {string} */ _tableName;
    /** Object containing keys that are exact names of each column of the table and values containing information about the column's configuration.
     * @protected @type {{[K in keyof TTableModel]: DescribedSchema}} */ _schema;
    /** All relationships between this context and other tables.
     * @protected @type {Record<string, Types.Relationship<TTableModel>>} */ _relationships;
    /** Promise used for handling asynchronous tasks in synchronous functions.
     * @protected @type {Promise<any>} */ _promise;

    /** State of the context, used to store different "views" of the context.
     * @type {ContextState<TTableModel, TAliasModel>} */ #state;
    /** Adapter being used by the user.
     * @type {KinshipAdapter<any>} */ #adapter;
    /** Options passed in by the user that determine certain behaviors in `Kinship`.
     * @type {KinshipOptions} */ #options;
    /** Function used to identify a default value for unspecified columns.
     * @type {(model: TTableModel, args: any) => import("./types.js").MaybePromise<void>} */ #identification;
    /** Function used to identify a default value for unspecified columns.
     * @type {() => import("./types.js").MaybePromise<any>} */ #middleware;
    /** Emitter for handling events across `Kinship`.
     * @type {CommandListener} */ #emitter;
    
    /**
     * Create a new `KinshipContext` to interact with a table in your database.
     * @param {KinshipAdapter<any>} adapter 
     * Adapter being used for which type of database is being worked on.
     * @param {string} table 
     * Name of the table as it exactly appears in the database.
     * @param {KinshipOptions=} tableOptions 
     * Additional options that can be passed to enable/disable certain features.
     */
    constructor(adapter, table, tableOptions={}, shouldDescribe=true) {
        this.#adapter = adapter;
        this._tableName = table;
        this.#options = {
            allowTruncation: false,
            allowUpdateAll: false,
            ...tableOptions,
        };
        this.#state = {
            select: [],
            from: [{
                realName: table,
                alias: table
            }],
        }
        this._relationships = {};
        this.#identification = () => {};
        this.#middleware = () => ({});
        this.#emitter = new CommandListener(table);
        if(shouldDescribe) {
            this._promise = (async () => {
                const schema = await this.#describe(table);
                this._schema = /** @type {{[K in keyof TTableModel]: DescribedSchema}} */ (Object.fromEntries(Object.entries(schema).map(([k,v]) => [v.field, v])));
                this.#state.select = Object.values(this._schema).map(v => ({
                    table: v.table,
                    alias: this.#adapter.syntax.escapeColumn(v.field),
                    column: v.field,
                    aliasUnescaped: v.field
                }))
            })();
        } else {
            this._promise = Promise.resolve();
        }
    }

    // TRANSACTION FUNCTIONS (functions that interact with the database through the adapter.)

    /**
     * Query rows from the table using all configured clauses on the state of this context.
     * @template {Types.SelectedColumnsModel<TTableModel>|TAliasModel} [TSelectedColumns=TAliasModel]
     * Used internally for typescript to create a new `TAliasModel` on the returned context, which will change the scope of what the user will see in further function calls.
     * @param {((model: Types.SpfSelectCallbackModel<TTableModel>) => Types.MaybeArray<keyof TSelectedColumns>)=} modelCallback
     * Used to choose which columns to retrieve from the query.  
     * If nothing is specified, the original aliased representation will be returned.  
     * If a GROUP BY clause has been specified, an error will be thrown.
     * @returns {Promise<(TSelectedColumns extends TAliasModel ? TAliasModel : Types.ReconstructSqlTable<TTableModel, TSelectedColumns>)[]>} Array of records, serialized from the rows returned from the query given the clauses specified.
     */
    async select(modelCallback=undefined) {
        await this._promise;
        if(modelCallback) {
            if(this.#state.groupBy) throw Error('Cannot choose columns when a GROUP BY clause is present.');
            const selects = /** @type {Types.MaybeArray<Types.SelectClauseProperty>}*/ (/** @type {unknown} */ (modelCallback(this.#newProxyForColumn())));
            this.#state.select = [...Array.isArray(selects) ? selects : [selects]];
        }
        const scope = this.#getScope();

        // make sure primary keys exist within query, otherwise serialization breaks.
        const stateOfSelectsMapped = this.#state.select.map(s => s.alias);
        if (this.#state.from.length > 1 && !this.#state.groupBy) {
            for (let i = 1; i < this.#state.from.length; ++i) {
                const table = /** @type {import("./types.js").FromClauseProperty} */(this.#state.from[i]);
                if (!stateOfSelectsMapped.includes(table.referenceTableKey.alias)) {
                    this.#state.select.push(table.referenceTableKey);
                }
                if (!stateOfSelectsMapped.includes(table.refererTableKey.alias)) {
                    this.#state.select.push(table.refererTableKey);
                }
            }
        }
        const { cmd, args } = this.#adapter.serialize(scope).forQuery({
            select: this.#state.select,
            from: this.#state.from,
            //@ts-ignore `._getConditions` is marked private so the User does not see the function.
            where: this.#state?.where?._getConditions(),
            group_by: this.#state.groupBy,
            order_by: this.#state.sortBy,
            limit: this.#state.limit,
            offset: this.#state.offset
        });
        try {
            const results = await this.#adapter.execute(scope).forQuery(cmd, args);
            const serialized = /** @type {any} */ (this.#serialize(results));
            this.#emitter.emitQuerySuccess({
                cmd, 
                args,
                results
            });
            return serialized;
        } catch(err) {
            this.#emitter.emitQueryFail({
                cmd,
                args,
                err: /** @type {Error} */ (err)
            });
            throw err;
        }
    }

    /**
     * Query the total number of rows from the table using all configured clauses on the state of this context.  
     * __NOTE: This function will return the COUNT(*) of the query being executed, and depending on the adapter, if there are any inclusions (`.include()`) then 
     * the number returned might be of all rows in the `LEFT JOIN` instead of the total number of rows just on the table this context represents.__
     * @returns {Promise<number>} Number of rows in the table specified through the clauses.
     */
    async count() {
        await this._promise;
        const scope = this.#getScope();
        const { cmd, args } = this.#adapter.serialize(scope).forCount({
            select: this.#state.select,
            from: this.#state.from,
            //@ts-ignore `._getConditions` is marked private so the User does not see the function.
            where: this.#state.where?._getConditions(),
            group_by: this.#state.groupBy,
            order_by: this.#state.sortBy,
            limit: this.#state.limit,
            offset: this.#state.offset
        });
        try {
            const result = await this.#adapter.execute(scope).forCount(cmd, args);
            this.#emitter.emitQuerySuccess({
                cmd, 
                args,
                results: [result]
            });
            return result;
        } catch(err) {
            this.#emitter.emitQueryFail({
                cmd,
                args,
                err: /** @type {Error} */ (err)
            });
            throw err;
        }
    }
    
    /**
     * Insert records into the table.
     * @param {Types.MaybeArray<TTableModel>} records
     * Record or records to insert into the database.
     * @returns {Promise<TTableModel[]>} The same records that were inserted, with appropriate columns being identified from AUTO_INCREMENT properties or `.default()` values.
     */
    async insert(records) {
        await this._promise;
        if (records === undefined) return [];
        records = Array.isArray(records) ? records : [records];
        if (records.length <= 0) return [];
        // Map the records back to their original Table representation, just so Kinship can correctly work with it.
        
        // identify all columns that do not exist on each record with the user's identification function.
        const newProxy = (r, table=this._tableName, relationships=this._relationships, schema=this._schema) => new Proxy(r, {
            get: (t,p,r) => {
                if (typeof p === "symbol") throw new KinshipInvalidPropertyTypeError(p);
                if (p in relationships) {
                    return newProxy(t[p], relationships[p].table, relationships[p].relationships, relationships[p].schema);
                }
                if (!(p in schema)) throw new KinshipColumnDoesNotExistError(p, table);
                return t[p];
            },
            set: (t,p,v) => {
                if (typeof p === "symbol") throw new KinshipInvalidPropertyTypeError(p);
                if (!(p in this._schema)) throw new KinshipColumnDoesNotExistError(p, table);
                if(!this._schema[p].isIdentity && !(p in t)) {
                    //@ts-ignore `p` will belong in `t`, as it is pre-checked to see if p is in schema.
                    t[p] = v;
                    return true;
                }
                return true;
            }
        });
        // set user specified default values
        const args = await this.#middleware();
        for(let i = 0; i < records.length; ++i) {
            args.$$itemNumber = i;
            const r = records[i];
            this.#identification(r, args);
        }
        // set database specified default values (this is mapped as we also remove keys that should not exist during the insert.)
        const recs = records.map(r => {
            /** @type {any} */
            let o = {};
            for(const key in this._schema) {
                // delete virtual keys.
                if(this._schema[key].isIdentity || this._schema[key].isIdentity || this._schema[key].isVirtual) continue;
                // set defaults
                if(!(key in r)) {
                    r[key] = /** @type {any} */ (this._schema[key].defaultValue());
                }
                // transfer
                o[key] = r[key];
            }
            return o;
        });
        const insertIds = await this.#insert(recs);
        const idKey = this.#getIdentityKey();
        if(idKey !== undefined) {
            records.forEach((r,n) => {
                //@ts-ignore property access is valid, although typescript says otherwise.
                r[idKey.field] = insertIds[n];
            });
        }
        
        // If the schema has any column that is virtually generated, then we want to return the most up to date values, so we re-select the records we just inserted.
        if(Object.values(this._schema).filter(c => c.isVirtual).length > 0) {
            // get an array of all unique columns that are to be inserted.
            const columns = Array.from(new Set(records.flatMap(r => Object.keys(r).filter(k => isPrimitive(r[k])))));
            // map each record so all of them have the same keys, where keys that are not present have a null value.
            const values = records.map(r => Object.values({...Object.fromEntries(columns.map(c => [c,null])), ...Object.fromEntries(Object.entries(r).filter(([k,v]) => isPrimitive(v)))}))
            const where = Where(this.#adapter, columns[0], this._tableName, this._relationships, this._schema);
            let chain = where.in(values.map(v => v[0]));
            for(let i = 1; i < columns.length; ++i) {
                //@ts-ignore typescript will show as error because TTableModel is generic in this context.
                chain = chain.and(m => m[columns[i]].in(values.map(v => v[i])));
            }
            return await this.#duplicate(ctx => {
                ctx.#state.where = where;
            }).select();
        }
        return records;
    }

    /**
     * Update rows within the table given an array of records (update by primary key [implicit]) 
     * or a function that specifies the values to update, using a built WHERE clause using `.where()` [explicit].  
     * @param {Types.MaybeArray<TTableModel>|((m: TTableModel) => Partial<TTableModel>|void)} records  
     * Records or function to use to determine what rows to update.
     * - `TTableModel|TTableModel[] records`: Records to update, this will require the primary key(s) to be present on the record, otherwise this function will throw an error.  
     * - `((model: TTableModel) => Partial<TTableModel>|undefined) records`: A function that either sets `model`'s respective columns to the desired values in the update or returns an object containin the properties and desired values to update to.
     * __NOTE: For explicit usage, the object returned will take precedence over property sets.__
     * @returns {Promise<number>} Number of rows that were affected by the update.
     * @example
     * ```ts
     * const ctx = new KinshipContext<{ Id: number, Name: string }>(adapter, "Foo");
     * // implicit
     * ctx.update({ Id: 1, Name: "john" }).then(n => console.log(`number of rows affected: ${n}`)); // will print 1
     * ctx.update({ Id: 1, Name: "jane" }).then(n => console.log(`number of rows affected: ${n}`)); // will print 1
     * // explicit using sets
     * ctx.where(m => m.Id.in([1])).update(m => {
     *   m.Name = "john";
     * }).then(n => console.log(`number of rows affected: ${n}.`)); // will print 1
     * // explicit using update object.
     * ctx.where(m => m.Id.in([1])).update(m => {
     *   return {
     *     Name: "jane"
     *   };
     * }).then(n => console.log(`number of rows affected: ${n}.`)); // will print 1
     * ```
     */
    async update(records) {
        await this._promise;
        let cmd, args;
        if(records === undefined) return 0;
        const scope = this.#getScope();
        const pKeys = this.#getPrimaryKeys();
        // the user is explicitly telling Kinship what columns/values to set.
        if (typeof records === 'function') {
            if (this.#state.where == undefined && !this.#options.allowUpdateAll) {
                throw new KinshipOptionsError('Updating all is disabled on this context. You can enable updating to all records by passing { allowUpdateAll: true } into "options" during construction.');
            }
            let columns = [];
            let values = [];
            // user can either do value sets (e.g., `m.Column = 12`) or return an object. If an object is returned, then `o` takes precedence.
            const newProxy = () => new Proxy(/** @type {any} */({}), {
                set: (t,p,v) => {
                    if(typeof p === "symbol") throw new KinshipInvalidPropertyTypeError(p);
                    // Ignore changes to primary keys.
                    if(pKeys.includes(p)) return false;
                    // Only change columns that are within the schema.
                    if(!(p in this._schema)) return false;
                    columns.push(p);
                    values.push(/** @type {any} */ v instanceof Date ? this.#adapter.syntax.dateString(v) : v);
                    return true;
                }
            });
            let o = records(newProxy());
            // sets through returned object.
            if(o !== undefined) {
                o = /** @type {Partial<TTableModel>} */ (Object.fromEntries(
                    Object.entries(o)
                        .map(([k, value]) => [
                            k, 
                            /** @type {any} */ (value) instanceof Date ? this.#adapter.syntax.dateString(value) : value
                        ]).filter(([k,v]) => !pKeys.includes(k)))); 
                columns = Object.keys(o);
                values = Object.values(o);
            }

            //@ts-ignore ._getConditions is marked private, but is available for use within this context.
            const whereConditions = this.#state.where._getConditions();
            // sets through explicit set values from proxy. 
            const detail = this.#adapter.serialize(scope).forUpdate({
                table: this._tableName,
                columns,
                where: whereConditions,
                explicit: {
                    values
                }
            });
            cmd = detail.cmd;
            args = detail.args;
        } else {
            // Otherwise, user passed in a record or an array of records that are to be updated via their primary key.
            records = Array.isArray(records) ? records : [records];
            if(records.length <= 0) return 0;
            if (pKeys.length <= 0) {
                throw new KinshipSyntaxError(`No primary key exists on ${this._tableName}. Use the explicit version of this update by passing a callback instead.`);
            }
            
            // get the columns that are to be updated.
            const columns = records
                .flatMap(r => Object.keys(r)
                    .filter((k) => r[k] == null || typeof r[k] !== "object" || r[k] instanceof Date))
                    .filter((k, n, self) => self.indexOf(k) === n)
                .filter(k => {
                    if(this._schema[k].isVirtual) {
                        this.#emitter.emitWarning({
                            table: this._tableName,
                            type: "Update",
                            message: `An attempt was made to update a virtually generated column.`,
                            dateIso: new Date().toISOString(),
                        })
                    }
                    return !pKeys.includes(k) || this._schema[k].isVirtual;
                }); // ignore primary key changes.
            
            // add a WHERE statement so the number of rows affected returned matches the actual rows affected, otherwise it will "affect" all rows.
            let where = Where(this.#adapter, pKeys[0], this._tableName, this._relationships, this._schema);
            let chain = where.in(records.map(r => r[pKeys[0]]))
            for(let i = 1; i < pKeys.length; ++i) {
                //@ts-ignore
                chain = chain.and(m => m[pKeys[i]].in(records.map(r => r[pKeys[i]])).and(m => m[pKeys[i+1]].in(r[pKeys[i+1]])));
            }
            //@ts-ignore ._getConditions is marked private, but is available for use within this context.
            const whereConditions = where._getConditions();
    
            const detail = this.#adapter.serialize(scope).forUpdate({
                table: this._tableName,
                columns,
                where: whereConditions,
                implicit: {
                    primaryKeys: pKeys,
                    objects: records
                }
            });
            cmd = detail.cmd;
            args = detail.args;
        }

        try {
            const results = await this.#adapter.execute(scope).forUpdate(cmd, args);
            this.#emitter.emitUpdateSuccess({
                cmd,
                args,
                results: [results]
            });
            return results;
        } catch(err) {
            this.#emitter.emitUpdateFail({
                cmd,
                args,
                err
            });
            throw err;
        }
    }

    /**
     * Delete the records specified. Each record specified should have their primary key(s) specified as well.
     * If no records are specified, then the delete will occur based off the built `WHERE` clause.  
     * @param {Types.MaybeArray<TAliasModel>?} records 
     * Records to delete (default: undefined) If undefined is passed, then the explicit version of this function will occur, which deletes records based on the `WHERE` clause specified..
     * @returns {Promise<number>} Number of rows affected.
     * @example
     * ```ts
     * const ctx = new KinshipContext<{ Id: number, Name: string }>(adapter, "Foo");
     * // implicit
     * ctx.delete({ Id: 1, Name: "john" }).then(n => console.log(`number of rows affected: ${n}`)); // will print 1
     * // explicit
     * ctx.where(m => m.Id.in([1])).delete().then(n => console.log(`number of rows affected: ${n}.`)); // will print 1
     * ```
     */
    async delete(records=null) {
        await this._promise;
        if(records === undefined) return 0;
        const scope = this.#getScope();

        let cmd, args;
        if (records === null) {
            if (this.#state.where === undefined) {
                throw new KinshipSyntaxError("No WHERE clause was provided, possibly resulting in an update to all records.");
            }
            //@ts-ignore ._getConditions is marked private, but is available for use within this context.
            const whereConditions = this.#state.where._getConditions();
            const detail = this.#adapter.serialize(scope).forDelete({
                table: this._tableName,
                where: whereConditions
            });
            cmd = detail.cmd;
            args = detail.args;
        } else {
            const pKeys = this.#getPrimaryKeys();
            records = Array.isArray(records) ? records : [records];
            if (records.length <= 0) return 0;
            if (pKeys === undefined) {
                throw new KinshipSyntaxError(`No primary key exists on ${this._tableName}. Use the explicit version of this update by passing a callback instead.`);
            }
            // add a WHERE statement so the number of rows affected returned matches the actual rows affected, otherwise it will "affect" all rows.
            let where = Where(this.#adapter, pKeys[0], this._tableName, this._relationships, this._schema);
            let chain = where.in(records.map(r => r[pKeys[0]]))
            for(let i = 1; i < pKeys.length; ++i) {
                //@ts-ignore
                chain = chain.and(m => m[pKeys[i]].in(records.map(r => r[pKeys[i]])).and(m => m[pKeys[i+1]].in(r[pKeys[i+1]])));
            }
    
            //@ts-ignore ._getConditions is marked private, but is available for use within this context.
            const whereConditions = where._getConditions();
    
            const detail = this.#adapter.serialize(scope).forDelete({
                table: this._tableName,
                where: whereConditions
            });
            cmd = detail.cmd;
            args = detail.args
        }

        try {
            const results = await this.#adapter.execute(scope).forDelete(cmd, args);
            this.#emitter.emitDeleteSuccess({
                cmd,
                args,
                results: [results]
            });
            return results;
        } catch(err) {
            this.#emitter.emitDeleteFail({
                cmd,
                args,
                err
            });
            throw err;
        }
    }

    /**
     * Truncate the table.  
     * __NOTE: Usage of this function requires the property, `allowTruncation`, to be present and truthy in the `options` passed into the constructor.__ 
     * @returns {Promise<number>} Number of rows that have been affected.
     */
    async truncate() {
        await this._promise;
        if(!("allowTruncation" in this.#options) || !this.#options.allowTruncation) {
            throw new KinshipOptionsError(`Truncation is disabled on this context. You can enable truncation by passing { allowTruncation: true } into "options" during construction.`);
        }
        const scope = this.#getScope();
        const { cmd, args } = this.#adapter.serialize(scope).forTruncate({ table: this._tableName });

        try {
            const results = this.#adapter.execute(scope).forTruncate(cmd, args);
            this.#emitter.emitDeleteSuccess({
                cmd,
                args,
                results: [results]
            });
            return results;
        } catch(err) {
            this.#emitter.emitDeleteFail({
                cmd, 
                args,
                err
            });
            throw err;
        }
    }

    /**
     * @param {string} sqlCmd
     * @param {SQLPrimitive[]} sqlArgs
     */
    async execute(sqlCmd, ...sqlArgs) {
        return this.#adapter.execute(this.#getScope()).forQuery(sqlCmd, sqlArgs);
    }

    /**
     * 
     * @param {string} table 
     * Table to describe. 
     * @returns {Promise<{[fieldName: string]: DescribedSchema}>}
    */
    async #describe(table) {
        const { cmd, args } = this.#adapter
            .serialize(this.#getScope())
            .forDescribe(table);
        const schema = await this.#adapter
            .execute(this.#getScope())
            .forDescribe(cmd, args);
        
        for(const k in schema) {
            schema[k].alias = schema[k].field;
            schema[k].table = table;
        }
        return schema;
    }

    // INTERMEDIATE FUNCTIONS (functions that assist transaction functions)

    /**
     * Alias your table to a different return type.  
     * 
     * This function essentially uses the `modelCallback` you provide to map the results before they are returned back to you.  
     * 
     * __NOTE: Aliasing does **NOT** change how clause building works. Clause building will **ONLY** work on the original column name from the table. Aliasing only takes place when directly
     * interacting with your records (e.g., `.select()`, `.insert()`, `.update()`, and `.delete()`.__
     * 
     * __NOTE: It is assumed that you are aliasing non-null variables, so if you attempt to insert, 
     * then the created command will fail if you do not have these variables present. The same goes for updating/deleting on records without primary keys and no where clause was built.__
     * 
     * @template {Types.SqlTable} TAliasedType 
     * Aliased type that is derived from the return value of `aliasModelCallback`.
     * @template {{[K in keyof TTableModel]-?: TTableModel[K]}} [TRequiredModel={[K in keyof TTableModel]-?: TTableModel[K]}]
     * @param {((model: TRequiredModel) => TAliasedType)} aliasModelCallback 
     * Callback that should return an object that would represent your desired aliased type.
     * @returns {KinshipContext<TTableModel, TAliasedType>} A new context with the all previously configured clauses and the updated alias type.
     */
    alias(aliasModelCallback) {
        return this.#duplicate((ctx) => {
            // @ts-ignore This is being assigned to this here because it is meant to be transferred to the new context.
            ctx.#state.mapForward = aliasModelCallback;
            const newProxy = (table = "") =>
                new Proxy(/** @type {any} */({}), {
                    get: (t, p, r) => {
                        if(typeof p === "symbol") throw new KinshipInternalError();
                        if (p in ctx._relationships) {
                            if (!table.endsWith(`${String(p)}.`)) {
                                table = `${table}${String(p)}.`;
                            }
                            if (ctx._relationships[p].type === "1:n") {
                                return [newProxy(table)];
                            }
                            return newProxy(table);
                        }
                        return `${table}${String(p)}`;
                    },
                });

            const aliasMap = aliasModelCallback(newProxy());
            const flipd = Object.fromEntries(
                Object.entries(aliasMap)
                    .filter(([k, v]) => typeof v !== "object")
                    .map(([k, v]) => [v, k])
            );
            ctx.#state.mapBack = (x) => {
                /** @type {Partial<TTableModel>} */
                const o = {};
                for (const key in flipd) {
                    // @ts-ignore The key is expected to be part of TTableModel, but TS won't know that, so the error is ignored.
                    o[key] = x[flipd[key]];
                }
                return o;
            };
        });
	}

    /**
     * Upon inserting, give a default value to a column if the respective property does not exist in the record(s).
     * @param {(model: TTableModel, args: any & { $$itemNumber: number }) => import("./types.js").MaybePromise<void>} callback 
     * Callback that gives context to the record being inserted.  
     * Set the value you wish to default in the cases where the property does not exist.  
     * @param {(() => import("./types.js").MaybePromise<any>)=} middleware
     * Middleware function that you can use to give context to more arguments 
     * in `args` in your `callback` function parameter.  
     * This function is useful if an argument you rely on in `callback` is static 
     * and would be the same across all records. 
     * @returns {this}
     * @example
     * ```ts
     * interface Foo {
     *   a?: number; // auto increment
     *   b: string;
     *   c?: boolean;
     *   d?: Date;
     *   extraId?: string; // resembles something like "Id-123456"
     * };
     * 
     * const ctx = new KinshipContext<Foo>(adapter, "Foo");
     * 
     * // `$$itemNumber` is always available
     * ctx.default((m, { lastInsertId, $$itemNumber }) => {
     *   const newId = parseInt(lastInsertId.replace("Id-", "") ?? "0");
     *   m.c = false;
     *   m.d = new Date();
     *   m.extraId = `Id-${(newId + 1 + $$itemNumber).toString().padStart(6, '0')}`;
     * }, async () => {
     *   const [lastId] = await ctx.sortBy(m => m.Id.desc()).limit(1).select(m => m.extraId);
     *   return {
     *     lastInsertId: lastId
     *   };
     * });
     * ```
     */
    default(callback, middleware=undefined) {
        this.#middleware = middleware ?? this.#middleware;
        this.#identification = callback;
        return this;
    }

    #beforeInsert;

    /**
     * 
     * @param {(m: TTableModel) => void} callback 
     */
    beforeInsert(callback) {
        this.#beforeInsert = callback;
        return this;
    }

    afterInsert(callback) {

    }

    beforeUpdate(callback) {

    }

    afterUpdate(callback) {

    }

    beforeDelete(callback) {

    }

    afterDelete(callback) {

    }

    // CLAUSE FUNCTIONS (functions that influence the results of the transaction functions)

    /**
     * Limit the number of rows to retrieve.
     * @param {number} n 
     * Number of rows to retrieve.
     * @returns {KinshipContext<TTableModel, TAliasModel>} A new context with the state of the context this occurred in addition with a new state of a LIMIT clause.
     */
    take(n) {
        return this.#duplicate(ctx => {
            ctx.#state.limit = n;
        });
    }

    /**
     * Skip a number of rows before retrieving.
     * __WARNING: Depending on the adapter being used, you may need to use `.take()` in conjunction with this function.__
     * @param {number} n 
     * Number of rows to skip.
     * @returns {KinshipContext<TTableModel, TAliasModel>} A new context with the state of the context this occurred in addition with a new state of a OFFSET clause.
     */
    skip(n) {
        return this.#duplicate(ctx => {
            ctx.#state.offset = n;
        });
    }

    /**
     * Filter the query results given a column or columns' comparative qualities to some value or values.  
     * __NOTE: Since JavaScript does not offer operator overloading, you must use the {@link WhereBuilder}'s operator exposed functions.__
     * @param {(model: Types.ChainObject<TTableModel>) => void} modelCallback 
     * Property reference callback that is used to assist building a WHERE clause.
     * @returns {KinshipContext<TTableModel, TAliasModel>} A new context with the state of the context this occurred in addition with a new state of a WHERE clause.
     */
    where(modelCallback) {
        return this.#duplicate(ctx => {
            const newProxy = (realTableName=ctx._tableName, table = ctx._tableName, relationships=ctx._relationships, schema=ctx._schema) => new Proxy({}, {
                get: (t,p,r) => {
                    if (typeof (p) === 'symbol') throw new KinshipInvalidPropertyTypeError(p);
                    if (ctx.#isRelationship(p, relationships)) {
                        return newProxy(relationships[p].table, relationships[p].alias, relationships[p].relationships, relationships[p].schema);
                    }
                    if(!(p in schema)) throw new KinshipColumnDoesNotExistError(p, realTableName);
                    const field = schema[p].field;
                    if(ctx.#state.where) {
                        //@ts-ignore `._append` is marked private so the User does not see the function.
                        return ctx.#state.where._append(field, `AND${ctx.#state.negated ? ' NOT' : ''}`);
                    }
                    return ctx.#state.where = Where(
                        ctx.#adapter,
                        ctx.#adapter.syntax.escapeColumn(field), 
                        ctx.#adapter.syntax.escapeTable(table), 
                        ctx._relationships,
                        ctx._schema,
                        `WHERE${ctx.#state.negated ? ' NOT' : ''}`
                    );
                }
            });

            modelCallback(newProxy());
            this.#state.negated = false;
        });
    }

    /**
     * Specify the columns to sort on.  
     * __NOTE: columns used for sorting are done in the order that is specified.__
     * @param {(model: Types.SortByCallbackModel<TTableModel>) => Types.MaybeArray<Types.SortByClauseProperty|Types.SortByCallbackModelProp>} modelCallback 
     * Property reference callback that is used to determine which column or columns will be used to sort the queried rows
     * @returns {KinshipContext<TTableModel, TAliasModel>} A new context with the state of the context this occurred in addition with a new state of an ORDER BY clause.
     */
    sortBy(modelCallback) {
        return this.#duplicate(ctx => {
            const sorts = modelCallback(this.#newProxyForColumn(undefined, o => ({
                ...o,
                direction: "ASC",
                asc: () => ({ ...o, direction: "ASC" }),
                desc: () => ({ ...o, direction: "DESC" })
            })));

            ctx.#state.sortBy = /** @type {import("./types.js").SortByClauseProperty[]} */ (Array.isArray(sorts) ? sorts : [sorts]);
        });
    }

    /**
     * Specify the columns to group the results on.
     * @template {Types.GroupedColumnsModel<TTableModel>} TGroupedColumns
     * Used internally for typescript to create a new `TAliasModel` on the returned context, which will change the scope of what the user will see in further function calls.
     * @param {(model: Types.SpfGroupByCallbackModel<TTableModel>, aggregates: Types.Aggregates) => Types.MaybeArray<keyof TGroupedColumns>} modelCallback 
     * Property reference callback that is used to determine which column or columns should be selected and grouped on in future queries.
     * @returns {KinshipContext<Types.ReconstructSqlTable<TTableModel, TGroupedColumns>, Types.ReconstructSqlTable<TTableModel, TGroupedColumns>>} A new context with the state of the context this occurred in addition with a new state of a GROUP BY clause.
     */
    groupBy(modelCallback) {
        return this.#duplicate(ctx => {
            /**
             * 
             * @param {"AVG"|"COUNT"|"MIN"|"MAX"|"SUM"|"TOTAL"} aggr
             * @returns {(col?: any) => any} 
             */
            const getGroupedColProp = (aggr) => {
                return (col) => {
                    if(aggr === "TOTAL") return {
                        table: 'AGGREGATE',
                        column: 'COUNT(*)',
                        alias: `$total`,
                        aggregate: aggr
                    }
                    if(col === undefined) throw new KinshipInternalError();
                    const { table, column, aliasUnescaped } = /** @type {Types.Column} */ (col);
                    const c = aggr === 'COUNT' 
                        ? `COUNT(DISTINCT ${table}.${column})` 
                        : `${aggr}(${table}.${column})`;
                    return {
                        table: 'AGGREGATE',
                        column: c,
                        alias: this.#adapter.syntax.escapeColumn(`$${aggr.toLowerCase()}_` + aliasUnescaped?.replaceAll('<|', "_")),
                        aggregate: aggr
                    }
                };
            };

            const groups = /** @type {Types.MaybeArray<Types.GroupByClauseProperty>} */ (/** @type {unknown} */ (modelCallback(this.#newProxyForColumn(), {
                avg: getGroupedColProp("AVG"),
                count: getGroupedColProp("COUNT"),
                min: getGroupedColProp("MIN"),
                max: getGroupedColProp("MAX"),
                sum: getGroupedColProp("SUM"),
                total: getGroupedColProp("TOTAL")
            })));

            ctx.#state.select = Array.isArray(groups) ? groups : [groups];
            ctx.#state.groupBy = ctx.#state.select.filter(col => !("aggregate" in col));
        });
    }

    /**
     * Specify the columns to select from all queries.
     * @template {Types.SelectedColumnsModel<TTableModel>} TSelectedColumns
     * Used internally for typescript to create a new `TAliasModel` on the returned context, which will change the scope of what the user will see in further function calls.
     * @param {(model: Types.SpfSelectCallbackModel<TTableModel>) => Types.MaybeArray<keyof TSelectedColumns>} modelCallback
     * Property reference callback that is used to determine which column or columns should be selected on future queries.
     * @returns {KinshipContext<TTableModel, Types.ReconstructSqlTable<TTableModel, TSelectedColumns>>} A new context with the all previously configured clauses and the updated groupings.
     */
    choose(modelCallback) {
        if(this.#state.groupBy) throw Error('Cannot choose columns when a GROUP BY clause is present.');

        return this.#duplicate(ctx => {
            const selects = /** @type {Types.MaybeArray<Types.SelectClauseProperty>}*/ (/** @type {unknown} */ (modelCallback(this.#newProxyForColumn())));
            ctx.#state.select = Array.isArray(selects) ? selects : [selects];
        });
    }

    /**
     * Specify the columns you would like to select
     * @template {Types.IncludedColumnsModel<TTableModel>} TIncludedColumn
     * @param {(model: {[K in keyof import("./types.js").OnlySqlTableTypes<TTableModel>]: Types.ThenIncludeCallback<import("./types.js").OnlySqlTableTypes<TTableModel>[K], K>}) => void} modelCallback
     * @returns {KinshipContext<TTableModel, TAliasModel & {[K in keyof TIncludedColumn as K extends keyof TTableModel ? K : never]: Exclude<TTableModel[K], undefined>}>} A new context with the all previously configured clauses and the updated groupings.
     */
    include(modelCallback) {
        return this.#duplicate(ctx => {
            const newProxy = (table=ctx._tableName, relationships=ctx._relationships) => new Proxy(/** @type {any} */({}), {
                get: (t,p,r) => {
                    if (typeof(p) === 'symbol') throw new KinshipInvalidPropertyTypeError(p);
                    if (!ctx.#isRelationship(p, relationships)) throw Error(`The specified table, "${p}", does not have a configured relationship with "${table}".`);
                    
                    const pKey = relationships[p].primary;
                    const fKey = relationships[p].foreign;
                    const relatedTableAlias = relationships[p].alias;
                    ctx.#state.from.push({
                        realName: relationships[p].table,
                        alias: relatedTableAlias,
                        programmaticName: p,
                        refererTableKey: {
                            table: ctx.#adapter.syntax.escapeTable(table),
                            column: ctx.#adapter.syntax.escapeColumn(pKey.column),
                            alias: ctx.#adapter.syntax.escapeTable(pKey.alias)
                        },
                        referenceTableKey: {
                            table: ctx.#adapter.syntax.escapeTable(relatedTableAlias),
                            column: ctx.#adapter.syntax.escapeColumn(fKey.column),
                            alias: ctx.#adapter.syntax.escapeColumn(fKey.alias)
                        }
                    });
                    ctx.#state.select = ctx.#state.select.concat(Object.values(relationships[p].schema).map(col => ({
                        table: ctx.#adapter.syntax.escapeTable(col.table),
                        column: ctx.#adapter.syntax.escapeColumn(col.field),
                        alias: ctx.#adapter.syntax.escapeColumn(col.alias)
                    })));

                    const thenInclude = {
                        thenInclude: (callback) => {
                            callback(newProxy(relatedTableAlias, relationships[p].relationships));
                            return thenInclude;
                        }
                    };
                    return thenInclude;
                }
            });

            modelCallback(newProxy());
        });
    }

    // PREPARATIONAL FUNCTIONS (functions that prepare the context)

    /**
     * Configure a one-to-one relationship between the table represented in this context and related tables.
     * @param {Types.HasOneCallback<TTableModel>} modelCallback 
     * Property reference callback that is used to configure the relationships.
     * @returns {this} Reference back to this context, so the user can further chain and configure more relationships.
     */
    hasOne(modelCallback) {
        return this.#configureRelationship(modelCallback, "1:1");
    }

    /**
     * Configure a one-to-many relationship between the table represented in this context and related tables.
     * @param {Types.HasManyCallback<TTableModel>} modelCallback 
     * Property reference callback that is used to configure the relationships.
     * @returns {this} Reference back to this context, so the user can further chain and configure more relationships.
     */
    hasMany(modelCallback) {
        return this.#configureRelationship(modelCallback, "1:n");
    }

    // LOGGING FUNCTIONS (functions that can be used by the User to)

    /**
     * Specify a function to be called when a successful transactional event occurs on the context.
     * @param {SuccessHandler} callback Callback to add to the event handler.
     * @param {EventTypes=} eventType Type of event. If undefined, then all success events handle the callback (delete/insert/query/update)
     * @returns {() => void} Function for the user to use to unsubscribe to the event.
     */
    handleSuccess(callback, eventType=undefined) {
        switch(eventType) {
            case EventTypes.DELETE: return this.#emitter.onDeleteSuccess(callback);
            case EventTypes.INSERT: return this.#emitter.onInsertSuccess(callback);
            case EventTypes.QUERY: return this.#emitter.onQuerySuccess(callback);
            case EventTypes.UPDATE: return this.#emitter.onUpdateSuccess(callback);
            default:
                let deleteUnsubscribe = this.#emitter.onDeleteSuccess(callback);
                let insertUnsubscribe = this.#emitter.onInsertSuccess(callback);
                let queryUnsubscribe = this.#emitter.onQuerySuccess(callback);
                let updateUnsubscribe = this.#emitter.onUpdateSuccess(callback);
                return () => {
                    deleteUnsubscribe();
                    insertUnsubscribe();
                    queryUnsubscribe();
                    updateUnsubscribe();
                }
                
        }
    }

    /**
     * 
     * Specify a function to be called when a failed transactional event occurs on the context.
     * @param {FailHandler} callback Callback to add to the event handler.
     * @param {EventTypes=} eventType Type of event. If undefined, then all failure events handle the callback (delete/insert/query/update)
     * @returns {() => void} Function for the user to use to unsubscribe to the event.
     */
    handleFail(callback, eventType=undefined) {
        switch(eventType) {
            case EventTypes.DELETE: return this.#emitter.onDeleteFail(callback);
            case EventTypes.INSERT: return this.#emitter.onInsertFail(callback);
            case EventTypes.QUERY: return this.#emitter.onQueryFail(callback);
            case EventTypes.UPDATE: return this.#emitter.onUpdateFail(callback);
            default:
                let deleteUnsubscribe = this.#emitter.onDeleteFail(callback);
                let insertUnsubscribe = this.#emitter.onInsertFail(callback);
                let queryUnsubscribe = this.#emitter.onQueryFail(callback);
                let updateUnsubscribe = this.#emitter.onUpdateFail(callback);
                return () => {
                    deleteUnsubscribe();
                    insertUnsubscribe();
                    queryUnsubscribe();
                    updateUnsubscribe();
                }
        }
    }

    /**
     * Specify a function to be called when a warning event occurs on the context.
     * @param {WarningHandler} callback Callback to add to the event handler.
     * @returns {() => CommandListener} Function for the user to use to unsubscribe to the event.
     */
    handleWarning(callback) {
        return this.#emitter.onWarning(callback);
    }

    // SYNONYMS

    map = this.alias;
    identify = this.default;
    limit = this.take;
    offset = this.skip;
    filter = this.where;
    sort = this.sortBy;
    group = this.groupBy;
    join = this.include;
    onSuccess = this.handleSuccess;
    onFail = this.handleFail;
    onWarning = this.handleWarning;

    // GETTERS

    /**
     * Negate the next `.where()` clause function call.
     */
    get not() {
        this.#state.negated = true;
        return this;
    }

    /**
     * Get the schema of the table. (this will return a promise.)
     */
    get schema() {
        return this._promise.then(() => {
            return this._schema;
        });
    }

    // PRIVATE functions

    /**
     * Returns a function to be used in a JavaScript `<Array>.map()` function that recursively maps relating records into a single record.
     * @param {any[]} records All records returned from a SQL query.
     * @param {any} record Record that is being worked on (this is handled recursively)
     * @param {string} prepend String to prepend onto the key for the original record's value.
     * @returns {(record: any, n?: number) => TTableModel} Function for use in a JavaScript `<Array>.map()` function for use on an array of the records filtered to only uniques by main primary key.
     */
    #map(records, record=records[0], prepend="", relationships=this._relationships) {
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
                const map = this.#map(records, Object.fromEntries(entries), prepend + table + '<|', relationships[table].relationships);
                if (relationships[table].type === "1:1" || this.#state.groupBy) {
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
     * @param {any[]} records Records to filter.
     * @returns {TTableModel[]} Records, serialized into objects that a user would expect.
     */
    #serialize(records) {
        if (records.length <= 0 || this.#state.from.length === 1) return records;
        const map = this.#map(records);
        // group by is specific where each record returned will be its own result and will not be serialized like normal.
        if(this.#state.groupBy) {
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
    #filterForUniqueRelatedRecords(records, table=this._tableName) {
        let pKeyInfo = this.#getPrimaryKeyInfo(table);
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
     * Gets the names of all primary keys on the table, `tableName`.
     * @param {string?} tableName 
     * Name of the table. If null, then it will assume the main table this context represents. (default: null)
     * @returns {(keyof TTableModel & string)[]}
     * Array of strings that are the name of the columns marked as a primary key.
     */
    #getPrimaryKeys(tableName=null) {
        return this.#getPrimaryKeyInfo(tableName).map(col => col.field);
    }

    #primaryKeyCache = {};
    /**
     * Returns the full information about the primary key(s) of the table.
     * @param {string?} tableName 
     * Name of the table. If null, then it will assume the main table this context represents. (default: null)
     * @param {Record<string, Types.Relationship<TTableModel>>} relationships 
     * All relationships to the table, `tableName`. (not to be recursed on.)
     * @returns {DescribedSchema[]}
     * Array of field schemas that are a Primary Key on the table, `tableName`.
     */
    #getPrimaryKeyInfo(tableName = null, relationships = this._relationships) {
        tableName = tableName ?? this._tableName;
        if(tableName in this.#primaryKeyCache) {
            return this.#primaryKeyCache[tableName];
        }
        let key = [];
        if (tableName === this._tableName) {
            key = Object.values(this._schema).filter(col => col.isPrimary);
        } else {
            // covers the case where `table` equals the table name as it was declared in related configurations.
            if (tableName in relationships) {
                return Object.entries(relationships[tableName].schema).filter(([k,v]) => v.isPrimary).map(([k,v]) => v);
            }
            // covers the case where `table` equals the actual table name as it appears in the database.
            const filtered = Object.values(relationships).filter(o => o.table === tableName);
            if (filtered.length > 0) {
                return Object.entries(filtered[0].schema).filter(([k,v]) => v.isPrimary).map(([k,v]) => v);
            } else {
                for (const k in relationships) {
                    key = this.#getPrimaryKeyInfo(tableName, relationships[k].relationships);
                    if(key !== undefined) {
                        return key;
                    }
                }
            }
        }
        this.#primaryKeyCache[tableName] = key;
        return key;
    }

    /**
     * Returns the identity key that belongs to the table, `tableName`, if one exists.
     * @param {string?} tableName 
     * Name of the table. If null, then it will assume the main table this context represents. (default: null)
     * @returns {DescribedSchema=}
     * Field schema that is an identity key on the table, `tableName`.
     */
    #getIdentityKey(tableName=null) {
        const keys = this.#getPrimaryKeyInfo(tableName);
        return keys.filter(k => k.isIdentity)[0];
    }

    async #insert(records, table=this._tableName) {
        const scope = this.#getScope();
        // get an array of all unique columns that are to be inserted.
        const columns = Array.from(new Set(records.flatMap(r => Object.keys(r).filter(k => isPrimitive(r[k])))));
        // map each record so all of them have the same keys, where keys that are not present have a null value.
        const values = records.map(r => Object.values({
                ...Object.fromEntries(columns.map(c => [c,null])), 
                ...Object.fromEntries(Object.entries(r).filter(([k,v]) => isPrimitive(v)))
            }).map(value => /** @type {any} */ (value) instanceof Date ? this.#adapter.syntax.dateString(value) : value)
        );
        const { cmd, args }  = this.#adapter.serialize(scope).forInsert({ table, columns, values });

        try {
            const results = await this.#adapter.execute(scope).forInsert(cmd, args);
            this.#emitter.emitInsertSuccess({
                cmd,
                args,
                results
            });

            return results;
        } catch(err) {
            this.#emitter.emitInsertFail({
                cmd,
                args,
                err
            });
            throw err;
        }
    }

    /**
     * 
     * @returns {AdapterScope}
     */
    #getScope() {
        return { 
            KinshipAdapterError: (msg) => new KinshipAdapterError(msg), 
            Where,
            ErrorTypes: {
                NON_UNIQUE_KEY: () => new KinshipNonUniqueKeyError()
            }
        };
    }
    
    /**
     * Configures a one-to-one or one-to-many relationship (specified by `type`) within the current `table`.
     * @param {Types.HasOneCallback<TTableModel>|Types.HasManyCallback<TTableModel>} callback
     * Callback that is of type {@link Types.HasOneCallback} or {@link Types.HasManyCallback} which helps the user map the references.
     * @param {"1:1"|"1:n"} type 
     * Specification of whether the relationship configured is a one-to-one (1:1) or one-to-many relationship (1:n).
     * @param {string} table
     * Name of the parent table that is configuring the relationship to.
     * @param {Record<string, Types.Relationship<TTableModel>>} relationships
     * Relationships belonging to the parent table.
     * @param {string} prependTable
     * String to help create the alias of the related table, which will be used in the command for table references.
     * @param {string} prependColumn
     * String to help create the alias of the related table's columns, which will be used in the command for column references and serialization after querying occurred.
     * @returns {this} Reference back to this context, so the user can further chain and configure more relationships.
     */
    #configureRelationship(callback, 
        type, 
        table=this._tableName, 
        relationships=this._relationships, 
        prependTable=`${this._tableName}_`, 
        prependColumn='',
    ) {
        const withKeys = (codeTableName, realTableName, primaryKey, foreignKey) => {
            relationships[codeTableName] = {
                type,
                table: realTableName,
                alias: `__${prependTable}${codeTableName}__`,
                primary: {
                    table,
                    column: primaryKey,
                    alias: `${prependColumn}${primaryKey}`
                },
                foreign: {
                    table: realTableName,
                    column: foreignKey,
                    alias: `${prependColumn}${codeTableName}<|${foreignKey}`
                },
                schema: /** @type {{[K in keyof TTableModel]: DescribedSchema}} */ ({}),
                relationships: {},
                constraints: []
            };
            this._promise = (async () => {
                await this._promise;
                const schema = await this.#describe(realTableName);
                relationships[codeTableName].schema = /** @type {{[K in keyof TTableModel]: DescribedSchema}} */ (
                    Object.fromEntries(
                        Object.entries(schema).map(([k,v]) => [v.field, {
                            ...v,
                            table: relationships[codeTableName].alias,
                            alias: `${prependColumn}${codeTableName}<|${v.field}`
                        }])
                    )
                );
            })();

            const andThat = {
                andThatHasOne: (callback) => {
                    this.#configureRelationship(callback, 
                        "1:1", 
                        realTableName, 
                        relationships[codeTableName].relationships, 
                        `${prependTable}${codeTableName}_`, 
                        `${prependColumn}${codeTableName}<|`
                    );
                    return andThat;
                },
                andThatHasMany: (callback) => {
                    this.#configureRelationship(callback, 
                        "1:n", 
                        realTableName, 
                        relationships[codeTableName].relationships, 
                        `${prependTable}${codeTableName}_`, 
                        `${prependColumn}${codeTableName}<|`
                    );
                    return andThat;
                }
            }
            return andThat;
        };

        const withPrimary = (codeTableName, realTableName, primaryKey) => ({
            withForeign: (foreignKey) => withKeys(codeTableName, realTableName, primaryKey, foreignKey)
        });
        
        const fromTable = (codeTableName, realTableName) => ({
            withPrimary: (primaryKey) => withPrimary(codeTableName, realTableName, primaryKey),
            withKeys: (primaryKey, foreignKey) => withKeys(codeTableName, realTableName, primaryKey, foreignKey)
        });

        const newProxy = () => new Proxy(/** @type {any} */ ({}), {
            get: (t,p,r) => {
                if (typeof(p) === 'symbol') throw new KinshipInvalidPropertyTypeError(p);
                if (p in relationships) throw Error(`A relationship already exists for the table, "${p}"`);
                
                return {
                    fromTable: (realTableName) => fromTable(p, realTableName),
                    withKeys: (primaryKey, foreignKey) => withKeys(p, p, primaryKey, foreignKey),
                    withPrimary: (primaryKey) => withPrimary(p, p, primaryKey)
                }
            }
        });

        callback(newProxy());

        return this;
    }

    /**
     * Create a new proxy to retrieve column data, this covers the behavior when a column is nested within related tables.
     * @param {string=} table 
     * Handled recursively, table (aliased name) that is being checked.
     * @param {((o: Types.Column) => any)=} callback
     * Callback that can be used to work with the column as it is referenced.
     * @returns {any} Proxy that handles property references on a table.
     */
    #newProxyForColumn(table = this._tableName, callback=(o) => o, relationships=this._relationships, schema=this._schema, realTableName=this._tableName){
        if(table === undefined) table = this._tableName;
        return new Proxy({}, {
            get: (t, p, r) => {
                if (typeof(p) === 'symbol') throw new KinshipInvalidPropertyTypeError(p);
                if (this.#isRelationship(p, relationships)) {
                    return this.#newProxyForColumn(relationships[p].alias, callback, relationships[p].relationships, relationships[p].schema, relationships[p].table);
                }
                if(!(p in schema)) throw new KinshipColumnDoesNotExistError(p, realTableName);
                const { field, alias } = schema[p];
                return callback({
                    table: this.#adapter.syntax.escapeTable(table),
                    column: this.#adapter.syntax.escapeColumn(field),
                    alias: this.#adapter.syntax.escapeColumn(alias),
                    aliasUnescaped: alias
                });
            }
        });
    }

    /**
     * Duplicates this context which would expect to have further updates using the `callback` argument.  
     * 
     * Use this function to maintain a desired state between each context.
     * @param {(ctx: KinshipContext<any, any>) => void} callback 
     * Callback that is used to further configure state after the duplication has occurred.
     * @returns {any}
     * A new context with the altered state.
     */
    #duplicate(callback) {
        /** @type {KinshipContext<any, any>} */
        const ctx = new KinshipContext(this.#adapter, this._tableName, this.#options, false);
        ctx._promise = (async () => {
            await this._promise;
            ctx.#emitter = this.#emitter;
            ctx._schema = this._schema;
            ctx._relationships = this._relationships;
            // state must be deep copied, as the state will be unique to each context created between each clause function
            ctx.#state = deepCopy(this.#state);
            //@ts-ignore `._clone()` is marked private, but is intended to be visible to this class.
            ctx.#state.where = this.#state.where?._clone();
            callback(ctx);
            ctx._schema = this._schema;
        })();
        return ctx;
    }

    /**
     * Checks to see if `table` is a relationship with the provided table
     * @param {string} table 
     * Table to check to see if it is a relationship.
     * @param {Record<string, Types.Relationship<TTableModel>>=} relationships
     * Table to check to see if the argument, `table`, is a relationship with.  
     * If `lastTable` is falsy, or unprovided, then `lastTable` defaults to the main table in this context.
     * @returns {boolean}
     * True if the argument, `lastTable`, with this context has a relationship with `table`, otherwise false.
     */
    #isRelationship(table, relationships = undefined) {
        if (relationships) {
            return table in relationships;
        }
        return table in this._relationships;
    }
}

function isPrimitive(value) {
    return value == null || typeof value !== "object" || value instanceof Date;
}

// Exported types

/** DescribedSchema  
 * 
 * Object representing the schema of a column in a table.
 * @typedef {object} DescribedSchema
 * @prop {string} table
 * The raw name of the table this field belongs to.
 * @prop {string} field
 * The raw name of the field as it is displayed in the database's table.
 * @prop {string} alias
 * The given alias for Kinship to use. (this is handled internally.)
 * @prop {boolean} isPrimary
 * True if the column is a primary key.
 * @prop {boolean} isIdentity
 * True if the column is an identity key. (automatically increments)
 * @prop {boolean} isVirtual
 * True if the column is virtually generated.
 * @prop {boolean} isNullable
 * True if the column is nullable within the database.
 * @prop {boolean} isUnique
 * True if the column is unique (primary keys can set this to true as well)
 * @prop {"string"|"int"|"float"|"boolean"|"date"} datatype
 * Type that the column represents.
 * @prop {() => SQLPrimitive|undefined} defaultValue
 * Function that returns the value specified in the database schema for database generated values on inserts.
 */

/** SQLPrimitive  
 * 
 * All typescript types that are associated with SQL primitive types.
 * @typedef {boolean|string|number|Date|bigint} SQLPrimitive
 */

/** SqlTable  
 * 
 * Object type that represents an expected
 * @typedef {{[key: string]: object|SQLPrimitive|SqlTable|SqlTable[]}} SqlTable
 */

/*****************************ADAPTER******************************/

/** SerializationQueryHandlerData  
 * 
 * Data passed for the scope of the custom adapter to help serialize a query command.
 * @typedef {object} SerializationQueryHandlerData
 * @prop {Types.WhereClausePropertyArray=} where
 * Recursively nested array of objects where each object represents a condition.  
 * If the element is an array, then that means the condition is nested with the last element from that array.  
 * If undefined, then no `WHERE` clause was given.
 * @prop {number=} limit
 * Number representing the number of records to grab.  
 * If undefined, then no `LIMIT` clause was given.
 * @prop {number=} offset
 * Number representing the number of records to skip before grabbing.  
 * If undefined, then no `OFFSET` clause was given.
 * @prop {Types.SortByClauseProperty[]=} order_by
 * Array of objects where each object represents a column to order by.  
 * If undefined, then no `ORDER BY` clause was given.
 * @prop {Types.GroupByClauseProperty[]=} group_by
 * Array of objects where each object represents a column to group by.  
 * If undefined, then no `GROUP BY` clause was given.
 * @prop {Types.SelectClauseProperty[]} select
 * Array of objects where each object represents a column to select.
 * @prop {[MainTableFromClauseProperty, ...Types.FromClauseProperty[]]} from
 * Array of objects where each object represents a table to join on.  
 * The first object will represent the main table the context is connected to. 
 */

/** SerializationInsertHandlerData  
 * 
 * Data passed for the scope of the custom adapter to help serialize an insert command.
 * @typedef {object} SerializationInsertHandlerData
 * @prop {string} table
 * @prop {string[]} columns
 * @prop {SQLPrimitive[][]} values
 */

/** SerializationUpdateHandlerExplicitData  
 * 
 * Object model type for data used in explicit update transactions.
 * @typedef {object} SerializationUpdateHandlerExplicitData
 * @prop {SqlTable} values Used in an `explicit transaction`.  
 * Object representing what columns will be updated from the command.  
 * If this is undefined, then `objects` should be used.
 */

/** SerializationUpdateHandlerImplicitData  
 * 
 * Object model type for data used in implicit update transactions.
 * @typedef {object} SerializationUpdateHandlerImplicitData
 * @prop {SqlTable[]} objects Used in an `implicit transaction`.  
 * Array of objects that represent the table in the context that should be updated from the command.
 * If this is undefined, then `updateObject` should be used.  
 * __NOTE: If the table has an identity key, then the primary key will be stripped out before being passed into the execution handler function.__
 * @prop {string[]} primaryKeys
 * Primary key of the table.
 */

/** SerializationUpdateHandlerData  
 * 
 * Data passed for the scope of the custom adapter to help serialize an update command.
 * @typedef {object} SerializationUpdateHandlerData
 * @prop {string} table
 * Table the update is occurring on.
 * @prop {string[]} columns
 * Columns to be updated.  
 * @prop {Types.WhereClausePropertyArray} where
 * Recursively nested array of objects where each object represents a condition.  
 * If the element is an array, then that means the condition is nested with the last element from that array.
 * @prop {SerializationUpdateHandlerExplicitData=} explicit
 * @prop {SerializationUpdateHandlerImplicitData=} implicit
 */

/** SerializationDeleteHandlerData  
 * 
 * Data passed for the scope of the custom adapter to help serialize a delete command.
 * @typedef {object} SerializationDeleteHandlerData
 * @prop {string} table
 * Table the delete is occurring on.
 * @prop {Types.WhereClausePropertyArray=} where
 * Recursively nested array of objects where each object represents a condition.  
 * If the element is an array, then that means the condition is nested with the last element from that array.
 */

/** SerializationTruncateHandlerData  
 * 
 * Data passed for the scope of the custom adapter to help serialize a delete command.
 * @typedef {object} SerializationTruncateHandlerData
 * @prop {string} table
 * Recursively nested array of objects where each object represents a condition.  
 * If the element is an array, then that means the condition is nested with the last element from that array.
 */

/** SerializationHandlers  
 * 
 * Various handlers for the `KinshipAdapter` to handle serialization of `Kinship` built data into appropriate command strings.
 * @typedef {object} SerializationHandlers
 * @prop {(data: SerializationQueryHandlerData) => { cmd: string, args: Types.ExecutionArgument[] }} forQuery
 * Handles serialization of a query command and its arguments so it appropriately works for the given database connector.
 * @prop {(data: SerializationQueryHandlerData) => { cmd: string, args: Types.ExecutionArgument[] }} forCount
 * Handles serialization of a query command for `COUNT` and its arguments so it appropriately works for the given database connector.
 * @prop {(data: SerializationInsertHandlerData) => { cmd: string, args: Types.ExecutionArgument[] }} forInsert
 * Handles serialization of a insert command and its arguments so it appropriately works for the given database connector.
 * @prop {(data: SerializationUpdateHandlerData) => { cmd: string, args: Types.ExecutionArgument[] }} forUpdate
 * Handles serialization of a update command and its arguments so it appropriately works for the given database connector.
 * @prop {(data: SerializationDeleteHandlerData) => { cmd: string, args: Types.ExecutionArgument[] }} forDelete
 * Handles serialization of a delete command and its arguments so it appropriately works for the given database connector.
 * @prop {(data: SerializationTruncateHandlerData) => { cmd: string, args: Types.ExecutionArgument[] }} forTruncate
 * Handles serialization of a truncate command and its arguments so it appropriately works for the given database connector.
 * @prop {(table: string) => { cmd: string, args: Types.ExecutionArgument[] }} forDescribe
 * Handles serialization of a describe command and its arguments so it appropriately works for the given database connector.
 */

/** ExecutionHandlers  
 * 
 * Various handlers for the `KinshipAdapter` to handle execution of a command and the command's corresponding arguments.
 * @typedef {object} ExecutionHandlers
 * @prop {(cmd: string, args: Types.ExecutionArgument[]) => Types.MaybePromise<any[]>} forQuery
 * Handles execution of a query command, given the command string and respective arguments for the command string.  
 * This should return an array of objects where each object represents the row returned from the query.
 * @prop {(cmd: string, args: Types.ExecutionArgument[]) => Types.MaybePromise<number>} forCount
 * Handles the execution of a query for `COUNT` command, given the command string and respective arguments for the command string.  
 * This should return a number representing the total number of rows retrieved from the command.
 * @prop {(cmd: string, args: Types.ExecutionArgument[]) => Types.MaybePromise<number[]>} forInsert
 * Handles execution of an insert command, given the command string and respective arguments for the command string.  
 * This should return an array of numbers, where each number represents a table's primary key's auto incremented number (if applicable)  
 * This array should be parallel with the array of records that were serialized in the `serialize(...).forInsert()` function.
 * @prop {(cmd: string, args: Types.ExecutionArgument[]) => Types.MaybePromise<number>} forUpdate
 * Handles execution of an update command, given the command string and respective arguments for the command string.  
 * This should return a number representing the total number of rows affected from the command.
 * @prop {(cmd: string, args: Types.ExecutionArgument[]) => Types.MaybePromise<number>} forDelete
 * Handles execution of a delete command, given the command string and respective arguments for the command string.  
 * This should return a number representing the total number of rows affected from the command.
 * @prop {(cmd: string, args: Types.ExecutionArgument[]) => Types.MaybePromise<number>} forTruncate
 * Handles execution of a truncate command, given the command string and respective arguments for the command string.  
 * This should return a number representing the total number of rows affected from the command.
 * @prop {(cmd: string, args: Types.ExecutionArgument[]) => Types.MaybePromise<{[fieldName: string]: DescribedSchema}>} forDescribe
 * Handles execution of a describe command, given the command string and respective arguments for the command string.
 * This should return an object containing {@link DescribedSchema} objects. 
 * __NOTE: `table` and `alias` can be left as empty strings, as they are handled internally in Kinship anyways.__
 * This should return an array containing {@link Types.ConstraintData} objects.
 */

/** AdapterWhereHandler  
 * 
 * Reduces all of the conditions built in `Kinship` to a single clause.
 * @callback AdapterWhereHandler
 * @param {Types.WhereClausePropertyArray=} conditions
 * Conditions to reduce to a clause.
 * @param {string=} table
 * If specified, will only reduce conditions that belong to the specified table. (default: empty string or all conditions)
 * @param {((n: number) => string)=} sanitize
 * Function used to convert values to sanitized strings. (default: (n) => `?`.)
 * @returns {{cmd: string, args: Types.SQLPrimitive[]}}
 * string and array of SQL primitives to be concatenated onto the full query string and arguments.
 */

/** AdapterScope  
 * 
 * Scope passed into the Adapter for usage within any of the serialize/execute functions.
 * @typedef {object} AdapterScope
 * @prop {(message: string) => KinshipAdapterError} KinshipAdapterError  
 * Throw an error if it is an unexpected error that occurs within the custom adapter.
 * @prop {typeof ErrorTypes} ErrorTypes
 * @prop {typeof Where} Where
 * Situationally create new WHERE clause conditions.
 */

/** @enum {() => Error} */
const ErrorTypes = {
    NON_UNIQUE_KEY: () => new KinshipNonUniqueKeyError()
}

/** AdapterOptions  
 * 
 * Additional options that can be restricted specifically for the adapter's use.
 * @typedef {object} AdapterOptions
 * @prop {boolean=} allowTruncation
 * Allow the user to truncate the table.
 * @prop {boolean=} allowUpdateAll
 * Allow the user to update all records in the table.
 * @prop {boolean=} eventHandling 
 * Allow the user to attach event handlers to the table.
 */

/** AdapterSyntax  
 * 
 * Tools to assist with the adapter's syntax of how commands should be serialized.
 * @typedef {object} AdapterSyntax
 * @prop {(s: string) => string} escapeTable
 * Escapes a table in the command to protect against SQL injections.
 * `s` is the table to escape.
 * @prop {(s: string) => string} escapeColumn
 * Escapes a column in the command to protect against SQL injections.  
 * `s` is the column to escape.
 * @prop {(date: Date) => string} dateString
 * Conversion function of a JavaScript date to a respective valid string date.
 */

/** KinshipAdapter  
 * 
 * Object model type representing the requirements for an adapter to work with `Kinship`.
 * @template T
 * Type of the expected argument that needs to be passed into the `adapter()` function that represents the connection to the source.
 * @typedef {object} KinshipAdapter
 * @prop {AdapterOptions} options
 * Additional options that are automatically set over `Kinship`'s defaults.
 * @prop {AdapterSyntax} syntax
 * Required functions in order to provide safe SQL serialization.
 * @prop {(scope: AdapterScope) => ExecutionHandlers} execute
 * Function that provides the {@link AdapterScope} `scope` and returns an object of various functions for {@link ExecutionHandlers}.
 * @prop {(scope: AdapterScope) => SerializationHandlers} serialize
 * Function that provides the {@link AdapterScope} `scope` and returns an object of various functions for {@link SerializationHandlers}.
 */

/** InitializeAdapterCallback  
 * 
 * Callback for the initialization of the adapter connection for a specific database adapter.
 * @template T
 * Type of the expected argument that needs to be passed into the `adapter()` function that represents the connection to the source.
 * @callback InitializeAdapterCallback
 * @param {T} config
 * Configuration that belongs to `T` which initializes the connection to the database.
 * @returns {KinshipAdapter<T>}
 * Adapter configuration that is to be used within `Kinship`.
 */

/** SuccessHandler  
 * 
 * Callback function on a Connection Pool handled by the emission of when a context sends a command to be executed.
 * @callback SuccessHandler
 * @param {Types.OnSuccessData} data 
 * Data that was passed from the event emission.
 */

/** FailHandler  
 * 
 * Callback function on a Connection Pool handled by the emission of when a context sends a command and that command fails.
 * @callback FailHandler
 * @param {Types.OnFailData} data 
 * Data that was passed from the event emission.
 */

/** WarningHandler  
 * 
 * Callback function on a Connection Pool handled by the emission of when a context sends a command to be executed.
 * @callback WarningHandler
 * @param {Types.OnSuccessData} data 
 * Data that was passed from the event emission.
 */

/** ChainObject  
 * 
 * Object model that represents the `TTableModel`, but remapped so each primitive property is a `WhereBuilder` function
 * @template {SqlTable} TTableModel
 * @template {SqlTable} [TOriginalModel=TTableModel]
 * @typedef {{[K in keyof Required<TTableModel>]: TTableModel[K] extends (infer T extends SqlTable)[]|undefined ? ChainObject<Required<T>, TOriginalModel> : TTableModel[K] extends SqlTable|undefined ? ChainObject<Exclude<TTableModel[K], undefined>, TOriginalModel> : import('./where-builder.js').WhereBuilder<TOriginalModel, K extends symbol ? never : K>}} ChainObject
 */