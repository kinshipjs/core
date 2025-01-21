//@ts-check
/** @import { IKinshipAdapter } from "../adapter.js" */
/** @import { ColumnInfo, MaybeArray } from "./types.js" */

/**
 * @template TTableModel
 * @template TAliasModel
 */
export class KinshipTable {

//#region private variables

    /** @protected @type {KinshipTableOptions} */ 
    _options;
    /** @protected @type {KinshipTableSchema<TTableModel>} */
    _schema;
    /** @protected @type {IKinshipAdapter} */
    _adapter;

//#endregion

//#region constructor
    
    /**
     * 
     * @param {IKinshipAdapter} adapter 
     * @param {KinshipTableSchema<TTableModel>} schema 
     * @param {Partial<KinshipTableOptions>} options 
     */
    constructor(adapter, schema, options={}) {
        this._adapter = adapter;
        this._schema = schema;
        this._options = {
            safeDeleteMode: true,
            safeUpdateMode: true,
            ...options
        };
    }

//#endregion

//#region clause functions

    /**
     * 
     * @param {*} callback 
     */
    groupBy(callback) {

    }

    /**
     * 
     * @param {*} callback 
     */
    include(callback) {

    }

    /**
     * @param {number} maxRecords
     */
    limit(maxRecords) {

    }

    /**
     * @param {number} numRecordsToSkip
     */
    offset(numRecordsToSkip) {

    }

    /**
     * @param {*} callback
     */
    orderBy(callback) {

    }

    /**
     * @param {*} callback 
     */
    select(callback) {

    }

    /**
     * @param {*} callback 
     */
    where(callback) {

    }

//#endregion

//#region command functions
    
    async delete() {

    }

    /**
     * Insert records into the table.
     * @param {MaybeArray<TTableModel>} records
     * Record or records to insert into the database.
     * @returns {Promise<TTableModel[]>} 
     * The same records that were inserted, with updated properties of any default values.  
     * __Default values include virtual columns, database defaults, and user defined defaults.__
     */
    async insert(records) {
        
        if(Array.isArray(records)) {
            return records;
        }
        return [records];
    }

    async then() {

    }

    async truncate() {

    }

    async update() {

    }

//#endregion

//#region miscellaneous functions

//#endregion

}

/**
 * @typedef {object} KinshipTableOptions
 * @prop {boolean} safeDeleteMode
 * @prop {boolean} safeUpdateMode
 * @prop {string=} schema
 */

/**
 * @template TTableModel
 * @typedef {object} KinshipTableSchema
 * @prop {string} name
 * @prop {{[K in keyof TTableModel]: ColumnInfo}} columns
 */