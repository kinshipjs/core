//@ts-check

import { KinshipColumnDoesNotExistError, KinshipInvalidPropertyTypeError } from "../exceptions.js";
import { KinshipExecutionHandler } from "./handler.js";
import { getAllValues, getUniqueColumns } from "../context/util.js";
import { Where, WhereBuilder } from "../clauses/where.js";

export class KinshipInsertHandler extends KinshipExecutionHandler {
    /**
     * @protected
     * @template {object|undefined} TTableModel
     * @param {any} state
     * @param {TTableModel[]} records
     * @param {Function=} callback
     * @param {any=} transaction
     * @returns {Promise<{ numRowsAffected: number, records: TTableModel[], whereClause?: WhereBuilder<TTableModel> }>}
     */
    async _execute(state, records, callback=undefined, transaction=undefined) {
        const { cmd, args } = this._serialize(state, records);
        try {
            const insertIds = await this.base.handleAdapterExecute(transaction).forInsert(cmd, args);
            this.base.listener.emitInsertSuccess({ cmd, args, results: insertIds });
            this.#fixIdentityKeys(records, insertIds);
            /** @type {WhereBuilder<TTableModel>} */
            const whereClause = /** @type {any} */ (this.#getWhereClauseIfVirtualColumnsExist(records));
            return {
                numRowsAffected: 0,
                records,
                whereClause
            };
        } catch(err) {
            this.base.listener.emitInsertFail({ cmd, args, err });
            throw err;
        }
    }

    /**
     * @protected
     * @param {any} state
     * @param {object[]} records
     * @returns {{ cmd: string, args: any[] }}
     */
    _serialize(state, records) {
        return this.base.handleAdapterSerialize().forInsert(this.#getDetail(records));
    }

    #getDetail(records) {
        records = this.#setDatabaseDefaultValues(records);        
        const columns = getUniqueColumns(records);
        const values = getAllValues(records);
        return {
            table: this.base.tableName,
            columns,
            values
        };
    }

    #fixIdentityKeys(records, insertIds) {
        const idKey = this.base.getIdentityKey();
        if(idKey !== undefined) {
            records.forEach((r,n) => {
                //@ts-ignore property access is valid, although typescript says otherwise.
                r[idKey.field] = insertIds[n];
            });
        }
    }

    #setDatabaseDefaultValues(records) {
        return records.map(r => {
            /** @type {any} */
            let o = {};
            for(const key in this.base.schema) {
                // ignore virtual keys.
                if(this.base.schema[key].isVirtual) continue;
                // set defaults
                if(!(key in r)) {
                    r[key] = /** @type {any} */ (this.base.schema[key].defaultValue());
                }
                // transfer
                o[key] = r[key];
            }
            return o;
        });
    }

    #getWhereClauseIfVirtualColumnsExist(records) {
        if(!this.base.hasAnyVirtualKeys) {
            return undefined;
        }
        let pKeys = Object.keys(this.base.schema).filter(k => this.base.schema[k].isPrimary);
        records = records.map(o => {
            let newO = {};
            for(const key in o) {
                if(pKeys.includes(key)) {
                    newO[key] = o[key];
                }
            }
            return newO;
        });
        const columns = getUniqueColumns(records);
        const values = getAllValues(records);
        const where = /** @type {typeof Where<any, any>} */ (Where)(this.base, columns[0]);
        let chain = where.in(values.map(v => v[0]));
        for(let i = 1; i < columns.length; ++i) {
            //@ts-ignore typescript will show as error because TTableModel is generic in this context.
            chain = chain.and(m => m[columns[i]].in(values.map(v => v[i])));
        }
        return where;
    }

    #newProxyForColumn(r, 
        table=this.base.tableName, 
        relationships=this.base.relationships, 
        schema=this.base.schema) 
    {
        return new Proxy(r, {
            get: (t,p,r) => {
                if (typeof p === "symbol") throw new KinshipInvalidPropertyTypeError(p);
                if (p in relationships) {
                    return this.#newProxyForColumn(t[p], relationships[p].table, relationships[p].relationships, relationships[p].schema);
                }
                if (!(p in schema)) throw new KinshipColumnDoesNotExistError(p, table);
                return t[p];
            },
            set: (t,p,v) => {
                if (typeof p === "symbol") throw new KinshipInvalidPropertyTypeError(p);
                if (!(p in this.base.schema)) throw new KinshipColumnDoesNotExistError(p, table);
                if(!this.base.schema[p].isIdentity && !(p in t)) {
                    t[p] = v;
                    return true;
                }
                return true;
            }
        })
    }
}