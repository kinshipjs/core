//@ts-check

import { KinshipColumnDoesNotExistError, KinshipInvalidPropertyTypeError, KinshipSafeDeleteModeEnabledError, KinshipSyntaxError } from "../exceptions.js";
import { KinshipExecutionHandler } from "./handler.js";
import { Where } from "../clauses/where.js";
import { getFilterConditionsFromWhere } from "../context/util.js";

export class KinshipDeleteHandler extends KinshipExecutionHandler {
    /**
     * @protected
     * @param {any} state
     * @param {object[]} records
     * @param {...any} args
     * @returns {Promise<{ numRowsAffected: number, records: object[] }>}
     */
    async _execute(state, records, { truncate }) {
        let detail;
        if(truncate) {
            return this.#handleTruncate();
        }
        if(records.length === 0) {
            detail = this.#explicit(state);
        } else {
            detail = this.#implicit(records);
        }
        const { cmd, args } = this.base.handleAdapterSerialize().forDelete(detail);
        try {
            const numRowsAffected = await this.base.handleAdapterExecute().forDelete(cmd, args);
            this.base.listener.emitDeleteSuccess({ cmd, args, results: [numRowsAffected] });
            return {
                numRowsAffected,
                records
            };
        } catch(err) {
            this.base.listener.emitDeleteFail({ cmd, args, err });
            throw err;
        }
    }

    /**
     * @returns {Promise<{ numRowsAffected: number, records: object[] }>}
     */
    async #handleTruncate() {
        if(!this.base.options.disableSafeDeleteMode) {
            throw new KinshipSafeDeleteModeEnabledError();
        }
        const { cmd, args } = this.base.handleAdapterSerialize().forTruncate({ table: this.base.tableName });
        try {
            const numRowsAffected = await this.base.handleAdapterExecute().forDelete(cmd, args);
            this.base.listener.emitDeleteSuccess({ cmd, args, results: [numRowsAffected] });
            return {
                numRowsAffected,
                records: []
            };
        } catch(err) {
            this.base.listener.emitDeleteFail({ cmd, args, err });
            throw err;
        }
    }

    #explicit(state) {
        if (state.where === undefined && !this.base.options.disableSafeDeleteMode) {
            throw new KinshipSafeDeleteModeEnabledError();
        }
        return {
            table: this.base.tableName,
            where: getFilterConditionsFromWhere(state.where)
        }
    }

    #implicit(records) {
        const pKeys = this.base.getPrimaryKeys();
        if (pKeys === undefined) {
            throw new KinshipSyntaxError(`No primary key exists on ${this.base.tableName}. Use the explicit version of this update by passing a callback instead.`);
        }

        let where = /** @type {typeof Where<any, any>} */ (Where)(
            this.base, 
            pKeys[0].field
        );
        let chain = where.in(records.map(r => r[pKeys[0].field]))
        for(let i = 1; i < pKeys.length; ++i) {
            chain = chain
                //@ts-ignore
                .and(m => m[pKeys[i]]
                    //@ts-ignore
                    .in(records.map(r => r[pKeys[i].field])));
        }

        return {
            table: this.base.tableName,
            where: getFilterConditionsFromWhere(where)
        };
    }
}