//@ts-check

import { KinshipColumnDoesNotExistError, KinshipInvalidPropertyTypeError } from "../exceptions.js";
import { KinshipExecutionHandler } from "./exec-handler.js";

export class KinshipQueryHandler extends KinshipExecutionHandler {
    /**
     * @template {object|undefined} TAliasModel
     * @param {import("../context/context.js").AdapterReadyState} state
     * @param {TAliasModel[]} records
     * @param {...any} args
     * @returns {Promise<{ numRowsAffected: number, records: TAliasModel[] }>}
     */
    async _execute(state, records, ...[callback]) {
        console.log(`Query executed`);
        // these MUST be called in this order, otherwise certain columns get escaped twice.
        state = this.#useCallbackToSelectColumns(state, callback);
        state = this.#assertPrimaryKeysExist(state);

        const detail = this.#getDetail(state);
        const { cmd, args } = this.kinshipBase.handleAdapterSerialize().forQuery(detail);
        try {
            records = await this.kinshipBase.handleAdapterExecute().forQuery(cmd, args);
            //todo: serialize records.
            this.kinshipBase.listener.emitQuerySuccess({ cmd, args, results: records });
            return {
                numRowsAffected: 0,
                records
            };
        } catch(err) {
            this.kinshipBase.listener.emitQueryFail({ cmd, args, err });
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
            this.kinshipBase.listener.emitWarning({
                type: "SELECT",
                message: `Cannot choose columns when a GROUP BY clause is present.`,
                dateIso: new Date().toISOString(),
                table: this.kinshipBase.tableName
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
                const table = /** @type {import("../config/has-relationship.js").FromClauseProperty} */(state.from[i]);
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
            //@ts-ignore `._getConditions` is marked private so the User does not see the function.
            where: state.conditions,
            group_by: state.groupBy,
            order_by: state.orderBy,
            limit: state.limit,
            offset: state.offset
        }
    }

    #newProxyForColumn(table = this.kinshipBase.tableName, 
        callback=(o) => o, 
        relationships=this.kinshipBase.relationships, 
        schema=this.kinshipBase.schema, 
        realTableName=this.kinshipBase.tableName) 
    {
        return new Proxy({}, {
            get: (t, p, r) => {
                if (typeof(p) === 'symbol') throw new KinshipInvalidPropertyTypeError(p);
                if (this.kinshipBase.isRelationship(p, relationships)) {
                    return this.#newProxyForColumn(relationships[p].alias, callback, relationships[p].relationships, relationships[p].schema, relationships[p].table);
                }
                if(!(p in schema)) throw new KinshipColumnDoesNotExistError(p, realTableName);
                const { field, alias } = schema[p];
                return callback({
                    table,
                    column: field,
                    alias: alias
                });
            }
        });
    }
}