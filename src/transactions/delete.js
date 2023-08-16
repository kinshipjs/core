//@ts-check

import { isPrimitive } from "../dev-util";
import { KinshipColumnDoesNotExistError, KinshipInvalidPropertyTypeError, KinshipSyntaxError } from "../exceptions";
import { KinshipBase } from "../context/base.js";
import { KinshipExecutionHandler } from "./exec-handler";
import { Where } from "../where-builder";

export class KinshipQueryHandler extends KinshipExecutionHandler {
    /**
     * @template {import("../context/base.js").Table} TAliasModel
     * @param {any} state
     * @param {TAliasModel[]} records
     * @returns {Promise<{ numRowsAffected: number, records: TAliasModel[] }>}
     */
    async _execute(state, records) {
        let detail;
        if(records === undefined) {
            detail = this.#explicit(state);
            records = [];
        } else {
            detail = this.#implicit(records);
        }
        const { cmd, args } = this.kinshipBase.handleAdapterSerialize().forDelete(detail);
        try {
            const numRowsAffected = await this.kinshipBase.handleAdapterExecute().forDelete(cmd, args);
            this.kinshipBase.listener.emitDeleteSuccess({ cmd, args, results: [numRowsAffected] });
            return {
                numRowsAffected,
                records
            };
        } catch(err) {
            this.kinshipBase.listener.emitDeleteFail({ cmd, args, err });
            throw err;
        }
    }

    #explicit(state) {
        if (state.where === undefined) {
            throw new KinshipSyntaxError("No WHERE clause was provided, possibly resulting in a delete to all records.");
        }
        //@ts-ignore ._getConditions is marked private, but is available for use within this context.
        const whereConditions = state.where._getConditions();
        return {
            table: this.kinshipBase.tableName,
            where: whereConditions
        }
    }

    #implicit(records) {
        const pKeys = this.kinshipBase.getPrimaryKeys();
        if (pKeys === undefined) {
            throw new KinshipSyntaxError(`No primary key exists on ${this.kinshipBase.tableName}. Use the explicit version of this update by passing a callback instead.`);
        }
        // add a WHERE statement so the number of rows affected returned matches the actual rows affected, otherwise it will "affect" all rows.
        let where = Where(this.kinshipBase.adapter, 
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
        const whereConditions = where._getConditions();

        return {
            table: this.kinshipBase.tableName,
            where: whereConditions
        };
    }
}