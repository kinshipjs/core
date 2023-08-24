//@ts-check
import { CommandListener } from "../events.js";
import { KinshipAdapterError, KinshipNonUniqueKeyError } from "../exceptions.js";
import { Where } from "../clauses/where.js"

export class KinshipBase {
    /** @type {import("../index.js").KinshipAdapter<any>} */ adapter;
    /** @type {KinshipOptions} */ options;

    /** @type {string} */ tableName;
    /** @type {any} */ relationships;
    /** @type {any} */ schema;

    /** @type {CommandListener} */ listener;
    /** @type {Promise<void>} */ promise;

    /**
     * @param {import("../index.js").KinshipAdapter<any>} adapter 
     * @param {string} tableName 
     * @param {KinshipOptions=} options
     */
    constructor(adapter, tableName, options=undefined) {
        this.adapter = adapter;
        this.tableName = tableName;
        this.options = options;
        this.listener = new CommandListener(tableName);
    }

    handleAdapterSerialize() {
        return this.adapter.serialize({
            ErrorTypes,
            KinshipAdapterError: (msg) => new KinshipAdapterError(msg),
            Where
        });
    }

    handleAdapterExecute() {
        return this.adapter.execute({
            ErrorTypes,
            KinshipAdapterError: (msg) => new KinshipAdapterError(msg),
            Where
        });
    }

    getPrimaryKeys() {
        return [];
    }

    getIdentityKey() {
        return {
            field: ""
        }
    }

    /** @type {boolean=} */ #hasAnyVirtualKeys = undefined;
    get hasAnyVirtualKeys() {
        if(this.#hasAnyVirtualKeys !== undefined) {
            return this.#hasAnyVirtualKeys;
        }
        return this.#hasAnyVirtualKeys = Object.values(this.schema).filter(c => c.isVirtual).length > 0;
    }

    /**
     * @template {object|undefined} TTableModel
     * Checks to see if `table` is a relationship with the provided table
     * @param {string} table 
     * Table to check to see if it is a relationship.
     * @param {Record<string, import("../types.js").Relationship<TTableModel>>=} relationships
     * Table to check to see if the argument, `table`, is a relationship with.  
     * If `lastTable` is falsy, or unprovided, then `lastTable` defaults to the main table in this context.
     * @returns {boolean}
     * True if the argument, `lastTable`, with this context has a relationship with `table`, otherwise false.
     */
    isRelationship(table, relationships = undefined) {
        if (relationships) {
            return table in relationships;
        }
        return table in this.relationships;
    }

    /**
     * Returns true if the column is not a primary key and it is not a virtual column.
     * @param {string} column
     * @returns {boolean}
     */
    isEditable(column) {
        const pKeys = this.getPrimaryKeys();
        const isPrimaryKey = pKeys.includes(column);
        const isVirtual = this.schema[column].isVirtual;
        return !isPrimaryKey && !isVirtual;
    }

    /**
     * 
     * @param {string|boolean|number|bigint|Date|undefined} value 
     * @returns {string|boolean|number|bigint|Date|undefined}
     */
    toAdapterDateString(value) {
        if(value instanceof Date) {
            return this.adapter.syntax.dateString(value);
        }
        return value;
    }
}

/** @enum {() => Error} */
const ErrorTypes = {
    NON_UNIQUE_KEY: () => new KinshipNonUniqueKeyError()
}

/**
 * @typedef {object} KinshipOptions
 * @param {boolean} allowTruncation
 * @param {boolean} allowUpdateAll
 * @param {boolean} requeryAfterInsert
 * @param {boolean} requeryAfterUpdate
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