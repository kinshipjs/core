//@ts-check

import { KinshipColumnDoesNotExistError, KinshipInvalidPropertyTypeError } from "../exceptions.js";
import { KinshipExecutionHandler } from "./exec-handler.js";
import { getUniqueColumns } from "../context/util.js";
import { Where } from "../clauses/where.js";

export class KinshipUpdateHandler extends KinshipExecutionHandler {
    /**
     * @template {object|undefined} TTableModel
     * @param {any} state
     * @param {TTableModel[]} records
     * @param {((m: TTableModel) => Partial<TTableModel>|void)=} callback
     * @returns {Promise<{ numRowsAffected: number, records: TTableModel[] }>}
     */
    async _execute(state, records, callback=undefined) {
        let detail;
        if(callback !== undefined) {
            detail = this.#explicit(state, callback);
            records = [];
        } else {
            detail = this.#implicit(records);
        }
        const { cmd, args } = this.kinshipBase.handleAdapterSerialize().forUpdate(detail);
        try {
            const numRowsAffected = await this.kinshipBase.handleAdapterExecute().forUpdate(cmd, args);
            this.kinshipBase.listener.emitUpdateSuccess({ cmd, args, results: [numRowsAffected] });
            return {
                numRowsAffected,
                records
            };
        } catch(err) {
            this.kinshipBase.listener.emitUpdateFail({ cmd, args, err });
            throw err;
        }
    }

    /**
     * Handles an implicit transaction by updating records using a built where clause.
     * e.g.,
     * ```ts
     * ctx.where(m => m.id.in([1,2])).update(m => {
     *   m.a = 2;
     *   m.b = 3;
     * });
     * ```
     * @template {object|undefined} TTableModel
     * @param {any} state 
     * @param {((m: TTableModel) => Partial<TTableModel>|void)} callback 
     * @returns {SerializationUpdateHandlerData}
     */
    #explicit(state, callback) {
        let columns = [];
        let values = [];
        const pKeys = this.kinshipBase.getPrimaryKeys();
        let o = callback(this.#newProxyForColumn(columns, values, pKeys));
        if(o !== undefined) {
            // only update columns that can be updated.
            columns = Object.keys(o).filter(k => this.kinshipBase.isEditable(k));
            // convert Date values to their adapter specific date string.
            values = Object.values(o).map(v => this.kinshipBase.toAdapterDateString(v));
        }
        return {
            table: this.kinshipBase.tableName,
            columns,
            where: state.where._getConditions(),
            explicit: {
                values
            }
        }
    }

    /**
     * Handles an implicit transaction by updating records by primary key.
     * e.g.,
     * ```ts
     * ctx.update([{ id: 1, a: 1, b: 2 }, { id: 2, a: 2, b: 3 }])
     * ```
     * @template {object|undefined} TTableModel
     * @param {TTableModel[]} records 
     * @returns {SerializationUpdateHandlerData}
     */
    #implicit(records) {
        const pKeys = this.kinshipBase.getPrimaryKeys();
        if (pKeys.length <= 0) {
            throw new Error(`No primary keys exist on this table. Use the explicit form of updating instead.`);
        }
        
        // get the columns that are to be updated.
        const columns = getUniqueColumns(records);
        const whereConditions = this.#getWhereConditions(records);
        console.log(JSON.stringify(whereConditions, undefined, 2));
        return {
            table: this.kinshipBase.tableName,
            columns,
            where: whereConditions,
            implicit: {
                primaryKeys: pKeys.map(colInfo => colInfo.field),
                objects: records
            }
        }
    }
    
    /**
     * Gets the WHERE clause conditions that assist the update statement so the number of rows affected
     * come back accurately.
     * @template {object|undefined} TTableModel
     * @param {TTableModel[]} records
     * @returns {import("../clauses/where.js").WhereClausePropertyArray}
     */
    #getWhereConditions(records) {
        const pKeys = this.kinshipBase.getPrimaryKeys();
        let where = /** @type {typeof Where<any, any>} */ (Where)(
            this.kinshipBase, 
            pKeys[0].field
        );
        let chain = where.in(records.map(r => r[pKeys[0].field]))
        for(let i = 1; i < pKeys.length; ++i) {
            //@ts-ignore
            chain = chain.and(m => m[pKeys[i]].in(records.map(r => r[pKeys[i]])));
        }
        //@ts-ignore ._getConditions is marked private, but is available for use within this context.
        return where._getConditions();
    }

    #newProxyForColumn(columns, values, pKeys) {
        return new Proxy(/** @type {any} */({}), {
            set: (t,p,v) => {
                if(typeof p === "symbol") throw new KinshipInvalidPropertyTypeError(p);
                // Only change columns that are within the schema.
                if(!(p in this.kinshipBase.schema)) throw new KinshipColumnDoesNotExistError(p, this.kinshipBase.tableName);
                // Ignore changes to primary keys.
                if(pKeys.includes(p)) return true;
                columns.push(p);
                values.push(this.kinshipBase.toAdapterDateString(v));
                return true;
            }
        });
    }
}

/** SerializationUpdateHandlerExplicitData  
 * 
 * Object model type for data used in explicit update transactions.
 * @typedef {object} SerializationUpdateHandlerExplicitData
 * @prop {(object|undefined)} values Used in an `explicit transaction`.  
 * Object representing what columns will be updated from the command.  
 * If this is undefined, then `objects` should be used.
 */

/** SerializationUpdateHandlerImplicitData  
 * 
 * Object model type for data used in implicit update transactions.
 * @typedef {object} SerializationUpdateHandlerImplicitData
 * @prop {(object|undefined)[]} objects Used in an `implicit transaction`.  
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
 * @prop {import("../clauses/where.js").WhereClausePropertyArray} where
 * Recursively nested array of objects where each object represents a condition.  
 * If the element is an array, then that means the condition is nested with the last element from that array.
 * @prop {SerializationUpdateHandlerExplicitData=} explicit
 * @prop {SerializationUpdateHandlerImplicitData=} implicit
 */