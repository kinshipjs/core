//@ts-check

import { isPrimitive } from "../dev-util";
import { KinshipColumnDoesNotExistError, KinshipInvalidPropertyTypeError } from "../exceptions";
import { KinshipExecutionHandler } from "./exec-handler";
import { getUniqueColumns } from "../context/util";
import { Where } from "../where-builder";

export class KinshipUpdateHandler extends KinshipExecutionHandler {
    /**
     * @template {import("../models/sql.js").Table} TTableModel
     * @param {any} state
     * @param {TTableModel[]|((m: TTableModel) => Partial<TTableModel>|void)} records
     * @returns {Promise<{ numRowsAffected: number, records: TTableModel[] }>}
     */
    async _execute(state, records) {
        let detail;
        if(typeof records === 'function') {
            detail = this.#explicit(state, records);
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
     * @template {import("../models/sql.js").Table} TTableModel
     * @param {any} state 
     * @param {((m: TTableModel) => Partial<TTableModel>|void)} callback 
     * @returns {import("..").SerializationUpdateHandlerData}
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
     * @template {import("../models/sql.js").Table} TTableModel
     * @param {TTableModel[]} records 
     * @returns {import("..").SerializationUpdateHandlerData}
     */
    #implicit(records) {
        const pKeys = this.kinshipBase.getPrimaryKeys();
        if (pKeys.length <= 0) {
            throw new Error(`No primary keys exist on this table. Use the explicit form of updating instead.`);
        }
        
        // get the columns that are to be updated.
        const columns = getUniqueColumns(records);
        const whereConditions = this.#getWhereConditions(records);

        return {
            table: this.kinshipBase.tableName,
            columns,
            where: whereConditions,
            implicit: {
                primaryKeys: pKeys,
                objects: records
            }
        }
    }

    /**
     * Gets the WHERE clause conditions that assist the update statement so the number of rows affected
     * come back accurately.
     * @template {import("../models/sql.js").Table} TTableModel
     * @param {TTableModel[]} records
     * @returns {import("../types").WhereClausePropertyArray}
     */
    #getWhereConditions(records) {
        const pKeys = this.kinshipBase.getPrimaryKeys();
        let where = Where(
            this.kinshipBase.adapter, 
            pKeys[0], 
            this.kinshipBase.tableName, 
            this.kinshipBase.relationships, 
            this.kinshipBase.schema
        );
        let chain = where.in(records.map(r => r[pKeys[0]]))
        for(let i = 1; i < pKeys.length; ++i) {
            //@ts-ignore
            chain = chain.and(m => m[pKeys[i]].in(records.map(r => r[pKeys[i]])).and(m => m[pKeys[i+1]].in(r[pKeys[i+1]])));
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