//@ts-check
import { CommandListener } from "../events.js";
import { KinshipAdapterError, KinshipNonUniqueKeyError } from "../exceptions.js";
import { Where } from "../clauses/where.js"

/**
 * Handles some interactions with the adapter, stores some information/helpers about the table, and handles all
 * asynchronous activity in a synchronous manner.
 */
export class KinshipBase {
    /** @type {import("./adapter.js").KinshipAdapterConnection} */ adapter;
    /** @type {KinshipOptions} */ options;

    /** @type {string} */ tableName;
    /** @type {Record<string, import("../config/has-relationship.js").Relationship<any>>} */ relationships;
    /** @type {Record<string, import("../config/has-relationship.js").DescribedSchema>} */ schema;

    /** @type {CommandListener} */ listener;
    /** @type {Promise<void>} */ promise;

    /** @type {Record<string, import("../config/has-relationship.js").DescribedSchema[]>} */ #primaryKeyCache = {};

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
            stateless: false,
            ...options
        };
        this.relationships = {};
        this.schema = {};
        this.listener = new CommandListener(tableName);
        this.promise = Promise.resolve();
        
        console.log(`Appending describe ${tableName}`);
        this.handleAsync(async () => {
            const schema = await this.describe(tableName);
            this.schema = schema;
            console.log(`Finished describe`);
        });
    }

    /**
     * Calls the adapter's serialize function with the appropriate scope. 
     */
    handleAdapterSerialize() {
        return this.adapter.serialize({
            ErrorTypes,
            KinshipAdapterError: (msg) => new KinshipAdapterError(msg),
            Where
        });
    }

    /**
     * Calls the adapter's execute function with the appropriate scope. 
     */
    handleAdapterExecute() {
        return this.adapter.execute({
            ErrorTypes,
            KinshipAdapterError: (msg) => new KinshipAdapterError(msg),
            Where
        });
    }

    /**
     * Handles calls that rely on asynchronous processes.  
     * This does not necessarily mean the action being done in `promise` has to be asynchronous itself,
     * it just means that some data may be relied upon for the action to be done. (e.g., Using schema or
     * relationships.)
     * @param {() => void|Promise<void>} callback
     */
    handleAsync(callback) {
        console.log(`--- RE-SYNC REQUIRED ---`)
        this.promise = this.promise.then(() => {
            return callback();
        }).catch(err => {
            throw err;
        });
    }
    
    /**
     * Gets all of the primary keys that belong to the table, if any exist.
     * @param {string} tableName 
     * Name of the table to get the primary keys from. (default: the table the context represents)
     * @param {Record<string, import("../config/has-relationship.js").Relationship<object>>} relationships 
     * Used recursively for when `tableName` is not the table the context represents. 
     * @returns {import("../config/has-relationship.js").DescribedSchema[]}
     * Array of objects for column information that represent the primary key(s), or any empty array if none exist.
     */
    getPrimaryKeys(tableName=this.tableName, relationships=this.relationships) {
        if(tableName in this.#primaryKeyCache) {
            return this.#primaryKeyCache[tableName];
        }

        let keys = [];
        if (tableName === this.tableName) {
            keys = Object.values(this.schema).filter(col => col.isPrimary);
        } else {
            // covers the case where `table` equals the table name as it was declared in related configurations.
            if (tableName in relationships) {
                return Object.entries(relationships[tableName].schema).filter(([k,v]) => v.isPrimary).map(([k,v]) => v);
            }

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
     * @returns {import("../config/has-relationship.js").DescribedSchema=}
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
     * @template {object|undefined} TTableModel
     * @param {string} table 
     * Table to check to see if it is a relationship.
     * @param {Record<string, import("../config/has-relationship.js").Relationship<TTableModel>>=} relationships
     * Table to check to see if the argument, `table`, is a relationship with.  
     * @returns {boolean}
     * True if the argument, `table`, is a relationship with the table the context represents.
     */
    isRelationship(table, relationships = undefined) {
        if (relationships) {
            return table in relationships;
        }
        return table in this.relationships;
    }

    /**
     * Returns true if the column is not a primary key and it is not a virtual column.
     * @param {import("../config/has-relationship.js").DescribedSchema|string} column
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
     * @returns {Promise<Record<string, import("../config/has-relationship.js").DescribedSchema>>}
     */
    async describe(tableName) {
        const { cmd, args } = this.handleAdapterSerialize().forDescribe(tableName);
        const schema = await this.handleAdapterExecute().forDescribe(cmd, args);
        return Object.fromEntries(Object.entries(schema).map(([k,v]) => [v.field, { ...v, table: tableName, alias: v.field }]));
    }

    /**
     * Gets all columns that are to be selected from this schema.
     * @returns {import("../clauses/choose.js").SelectClauseProperty[]}
     */
    getAllSelectColumnsFromSchema() {
        return Object.values(this.schema).map(v => ({
            table: v.table,
            alias: v.field,
            column: v.field
        }));
    }
}

/** @enum {() => Error} */
const ErrorTypes = {
    NON_UNIQUE_KEY: () => new KinshipNonUniqueKeyError()
}

/**
 * Various options that can be passed to alter behavior of a single `KinshipContext`.
 * @typedef {object} KinshipOptions
 * @prop {boolean} disableSafeDeleteMode 
 * By default, a safe mode for deleting records exist, preventing accidental truncations or deletion of all rows in a table.
 * Pass `true` into this property to disable this feature.
 * @prop {boolean} disableSafeUpdateMode
 * By default, a safe mode for updating records exist, preventing accidental updating of all rows in a table.
 * Pass `true` into this property to disable this feature.
 * @prop {boolean} stateless
 * By default, Kinship behaves in a stateful way, where each clause that is called on a context creates a phantom duplicate
 * with the new state and it will remain that way indefinitely. Passing true into this will prevent these duplicates and
 * will always reset the state with every transaction.
 */

/**
 * Details on a column.
 * @typedef {object} ColumnDetails
 * @prop {string} table
 * object|undefined the column belongs to (escaped)
 * @prop {string} column
 * Column of the table (escaped)
 * @prop {string} alias
 * Alias of the column (escaped)
 */