//@ts-check
import { CommandListener } from "../events.js";
import { KinshipAdapterError, KinshipNonUniqueKeyError } from "../exceptions.js";
import { ErrorTypes } from "./adapter.js";
import { Optimized } from "./util.js";

/**
 * Handles some interactions with the adapter, stores some information/helpers about the table, and handles all
 * asynchronous activity in a synchronous manner.
 */
export class KinshipBase {
    /** Adapter that handles all serialization and execution of commands. 
     * @type {import("./adapter.js").KinshipAdapterConnection} */ adapter;
    /** Options that were given in the context constructor. 
     * @type {KinshipOptions} */ options;

    /** Name of the table as it was given in the context constructor. 
     * @type {string} */ tableName;
    /** All relationships that have been configured on the context. 
     * @type {import("../config/relationships.js").Relationships<any>} */ relationships;
    /** Schema that represents the table the context is connected to. 
     * @type {Record<string, import("../context/adapter.js").SchemaColumnDefinition>} */ schema;

    /** Event handler for commands when they are executed.
     * @type {CommandListener} */ listener;
    /** Used to manage state without forcing the consumer to use await as state depends on asynchronous processes 
     * @type {Promise<import("./context.js").State>} */ promise;
     
     isTransaction = false;

    /** Caches primary keys for a table to improve speed.
     * @type {Record<string, import("../context/adapter.js").SchemaColumnDefinition[]>} */ #primaryKeyCache = {};

    /**
     * @param {import("./adapter.js").KinshipAdapterConnection} adapter 
     * @param {string} tableName 
     * @param {Partial<KinshipOptions>=} options
     */
    constructor(adapter, tableName, options=undefined) {
        this.adapter = adapter;
        this.tableName = tableName;
        this.options = {
            disableSafeDeleteMode: false,
            disableSafeUpdateMode: false,
            ...options
        };
        this.relationships = {};
        this.schema = {};
        this.listener = new CommandListener(tableName);
        this.promise = Promise.resolve(/** @type {import("./context.js").State} */ ({}));
        
        this.afterResync(async (oldState) => {
            const schema = await this.describe(tableName);
            this.schema = schema;
            return oldState;
        });
    }

    /**
     * Calls the adapter's serialize function with the appropriate scope. 
     */
    handleAdapterSerialize() {
        return this.adapter.serialize();
    }

    /**
     * Calls the adapter's execute function with the appropriate scope. 
     */
    handleAdapterExecute() {
        return this.adapter.execute({
            ErrorTypes,
            KinshipAdapterError: (msg) => new KinshipAdapterError(msg)
        });
    }

    /**
     * Triggers `callback` only once the context has caught up with resynchronizing with asynchronous tasks.
     * @param {(oldState: import("./context.js").State) => import("./context.js").State|Promise<import("./context.js").State>} callback 
     * Callback that works on data within `Kinship` that requires the context to be resynchronized first.
     */
    afterResync(callback) {
        this.promise = this.promise.then((oldState) => {
            return callback(oldState);
        }).catch(err => {
            throw err;
        });
    }

    /**
     * Resynchronizes the context, returning the last state returned from the chain of promises.
     * @returns {Promise<import("./context.js").State>}
     */
    async resync() {
        return await this.promise;
    }
    
    /**
     * Gets all of the primary keys that belong to the table, if any exist.
     * @param {string} tableName 
     * Name of the table to get the primary keys from. (default: the table the context represents)
     * @param {import("../config/relationships.js").Relationships<object>} relationships 
     * Used recursively for when `tableName` is not the table the context represents. 
     * @returns {import("../context/adapter.js").SchemaColumnDefinition[]}
     * Array of objects for column information that represent the primary key(s), or any empty array if none exist.
     */
    getPrimaryKeys(tableName=this.tableName, relationships=this.relationships) {
        if(tableName in this.#primaryKeyCache) {
            return this.#primaryKeyCache[tableName];
        }

        let keys = [];
        if (tableName === this.tableName) {
            // covers the case where `table` is this table name.
            keys = Object.values(this.schema).filter(col => col.isPrimary);
        } else if (tableName in relationships) {
            // covers the case where `table` equals the table name as it was declared in related configurations.
            keys = Object.entries(relationships[tableName].schema).filter(([k,v]) => v.isPrimary).map(([k,v]) => v);
        } else {
            // covers the case where `table` equals the actual table name as it appears in the database.
            const filtered = Object.values(relationships).filter(o => o.table === tableName);
            if (filtered.length > 0) {
                keys = Object.entries(filtered[0].schema).filter(([k,v]) => v.isPrimary).map(([k,v]) => v);
            } else {
                for (const k in relationships) {
                    keys = this.getPrimaryKeys(tableName, relationships[k].relationships);
                    if(keys !== undefined) {
                        break;
                    }
                }
            }
        }
        this.#primaryKeyCache[tableName] = keys;
        return keys;
    }

    /**
     * Gets the identity key that belongs to the table, if it exists.
     * @param {string} tableName 
     * Name of the table to get the identity key from.
     * @returns {import("../context/adapter.js").SchemaColumnDefinition=}
     * Object for column information that represents the identity key, or undefined if one does not exist.
     */
    getIdentityKey(tableName=this.tableName) {
        return this.getPrimaryKeys(tableName).filter(colInfo => colInfo.isIdentity)?.[0];
    }

    /** @type {boolean=} */ #hasAnyVirtualKeys = undefined;
    get hasAnyVirtualKeys() {
        if(this.#hasAnyVirtualKeys !== undefined) {
            return this.#hasAnyVirtualKeys;
        }
        return this.#hasAnyVirtualKeys = Object.values(this.schema).filter(c => c.isVirtual).length > 0;
    }

    /**
     * Checks to see if `table` is a relationship with the provided table
     * @param {string} table 
     * Table to check to see if it is a relationship.
     * @param {import("../config/relationships.js").Relationships<any>} relationships
     * Table to check to see if the argument, `table`, is a relationship with.  
     * @returns {boolean}
     * True if the argument, `table`, is a relationship with the table the context represents.
     */
    isRelationship(table, relationships = this.relationships) {
        return table in relationships;
    }

    /**
     * Returns true if the column is not a primary key and it is not a virtual column.
     * @param {import("../context/adapter.js").SchemaColumnDefinition|string} column
     * Column name (as it appears in the database) or the column information for the column.
     * @returns {boolean}
     * True if the column is a primary key or is a virtual column.
     */
    isEditable(column) {
        if(typeof column === 'object') {
            return !column.isPrimary && !column.isVirtual;
        }
        return !this.schema[column].isPrimary && !this.schema[column].isVirtual;
    }

    /**
     * Transforms a Date value to an appropriate string for the adapter's database.
     * @param {string|boolean|number|bigint|Date|undefined} value 
     * Value to check for if its a date.
     * @returns {string|boolean|number|bigint|undefined} 
     * If the value is a Date, then a string will be returned, otherwise the value is returned back untouched.
     */
    toAdapterDateString(value) {
        if(value instanceof Date) {
            return this.adapter.syntax.dateString(value);
        }
        return value;
    }

    /**
     * Call the adapter's describe function to get various information on a table.
     * @param {string} tableName 
     * Table to describe.
     * @returns {Promise<Record<string, import("../context/adapter.js").SchemaColumnDefinition>>}
     */
    async describe(tableName) {
        const { cmd, args } = this.handleAdapterSerialize().forDescribe(tableName);
        const schema = await this.handleAdapterExecute().forDescribe(cmd, args);
        return Object.fromEntries(
            Object.entries(schema).map(([k,v]) => 
                [
                    v.field, 
                    { 
                        ...v, 
                        alias: v.field, 
                        commandAlias: v.field,
                        table: tableName
                    }
                ]
            )
        );
    }

    /**
     * Gets all columns that are to be selected from this schema.
     * @param {Record<string, import("../context/adapter.js").SchemaColumnDefinition>} schema
     * @returns {import("../clauses/choose.js").SelectClauseProperty[]}
     */
    getAllSelectColumnsFromSchema(schema=this.schema) {
        return Object.values(schema).map(v => ({
            alias: v.commandAlias,
            column: v.field,
            table: v.table,
        }));
    }
}

/**
 * @typedef {object} Column
 * @prop {string} table
 * The name of the table this column belongs to.
 * @prop {string} column
 * The name of the column as it appears in the database.
 * @prop {string} alias
 * The name of the column as it is used inside of commands.
 */

/**
 * Various options that can be passed to alter behavior of a single `KinshipContext`.
 * @typedef {object} KinshipOptions
 * @prop {boolean} disableSafeDeleteMode 
 * By default, a safe mode for deleting records exist, preventing accidental truncations or deletion of all rows in a table.
 * Pass `true` into this property to disable this feature.
 * @prop {boolean} disableSafeUpdateMode
 * By default, a safe mode for updating records exist, preventing accidental updating of all rows in a table.
 * Pass `true` into this property to disable this feature.
 */