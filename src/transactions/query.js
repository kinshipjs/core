//@ts-check

import { KinshipColumnDoesNotExistError, KinshipInvalidPropertyTypeError } from "../exceptions.js";
import { KinshipExecutionHandler } from "./handler.js";

export class KinshipQueryHandler extends KinshipExecutionHandler {
    /**
     * @protected
     * @template {object|undefined} TAliasModel
     * @param {import("../context/context.js").AdapterReadyState} state
     * @param {TAliasModel[]} records
     * @param {...any} args
     * @returns {Promise<{ numRowsAffected: number, records: TAliasModel[] }>}
     */
    async _execute(state, records, ...[callback]) {
        // these MUST be called in this order, otherwise certain columns get escaped twice.
        state = this.#useCallbackToSelectColumns(state, callback);
        if(state.select[0].alias !== '$$count') {
            state = this.#assertPrimaryKeysExist(state);
        }

        const detail = this.#getDetail(state);
        const { cmd, args } = this.base.handleAdapterSerialize().forQuery(detail);
        try {
            records = await this.base.handleAdapterExecute().forQuery(cmd, args);
            //todo: serialize records.
            this.base.listener.emitQuerySuccess({ cmd, args, results: records });
            return {
                numRowsAffected: 0,
                records
            };
        } catch(err) {
            this.base.listener.emitQueryFail({ cmd, args, err });
            throw err;
        }
    }

    /**
     * 
     * @param {import("../context/context.js").AdapterReadyState} state 
     * @param {*} callback 
     * @returns {import("../context/context.js").AdapterReadyState}
     */
    #useCallbackToSelectColumns(state, callback) {
        if(state.groupBy) {
            this.base.listener.emitWarning({
                type: "SELECT",
                message: `Cannot choose columns when a GROUP BY clause is present.`,
                dateIso: new Date().toISOString(),
                table: this.base.tableName
            });
            return state;
        }
        if(!callback) {
            return state;
        }
        const selects = callback(this.#newProxyForColumn());
        state.select = [...Array.isArray(selects) ? selects : [selects]];
        return state;
    }

    /**
     * 
     * @param {import("../context/context.js").AdapterReadyState} state 
     * @returns 
     */
    #assertPrimaryKeysExist(state) {
        const stateOfSelectsMapped = state.select.map(s => s.alias);
        if (state.from.length > 1 && !state.groupBy) {
            for (let i = 1; i < state.from.length; ++i) {
                const table = /** @type {import("../config/relationships.js").FromClauseProperty} */(state.from[i]);
                if (!stateOfSelectsMapped.includes(table.referenceTableKey.alias)) {
                    state.select.push(table.referenceTableKey);
                }
                if (!stateOfSelectsMapped.includes(table.refererTableKey.alias)) {
                    state.select.push(table.refererTableKey);
                }
            }
        }
        return state;
    }

    /**
     * 
     * @param {import("../context/context.js").AdapterReadyState} state 
     * @returns 
     */
    #getDetail(state) {
        return {
            select: state.select,
            from: state.from,
            where: state.conditions,
            group_by: state.groupBy,
            order_by: state.orderBy,
            limit: state.limit,
            offset: state.offset
        }
    }

    #newProxyForColumn(table = this.base.tableName, 
        callback=(o) => o, 
        relationships=this.base.relationships, 
        schema=this.base.schema, 
        realTableName=this.base.tableName) 
    {
        return new Proxy({}, {
            get: (t, p, r) => {
                if (typeof(p) === 'symbol') throw new KinshipInvalidPropertyTypeError(p);
                if (this.base.isRelationship(p, relationships)) {
                    return this.#newProxyForColumn(relationships[p].alias, callback, relationships[p].relationships, relationships[p].schema, relationships[p].table);
                }
                if(!(p in schema)) throw new KinshipColumnDoesNotExistError(p, realTableName);
                const { field: field, commandAlias: alias } = schema[p];
                return callback({
                    table,
                    column: field,
                    alias: alias
                });
            }
        });
    }
}