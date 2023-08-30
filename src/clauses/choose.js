//@ts-check
import { KinshipBase } from "../context/base.js";
import { assertAsArray } from "../context/util.js";
import { KinshipColumnDoesNotExistError, KinshipInvalidPropertyTypeError } from "../exceptions.js";


export class ChooseBuilder {
    /** @type {KinshipBase} */ #base;

    /**
     * @param {KinshipBase} kinshipBase 
     */
    constructor(kinshipBase) {
        this.#base = kinshipBase;
    }

    /**
     * @template {object} TAliasModel
     * Queries selected columns or all columns from the context using a built state.
     * @template {import("../clauses/choose.js").SelectedColumnsModel<TAliasModel>|TAliasModel} [TSelectedColumns=TAliasModel]
     * Type that represents the selected columns.
     * @param {import("../context/context.js").State} oldState
     * Old state before the user called `.choose()`.
     * @param {((model: import("../clauses/choose.js").SpfSelectCallbackModel<TAliasModel>) => 
     *  import("../models/maybe.js").MaybeArray<keyof TSelectedColumns>)=} callback
     * Callback model that allows the user to select which columns to grab.
     * @returns {import("../context/context.js").State}
     */
    getState(oldState, callback) {
        if(oldState.groupBy) {
            this.#base.listener.emitWarning({
                type: "SELECT",
                message: `Cannot choose columns when a GROUP BY clause is present.`,
                dateIso: new Date().toISOString(),
                table: this.#base.tableName
            });
            return oldState;
        }
        if(!callback) {
            return oldState;
        }
        /** @type {import('../context/base.js').Column[]} */
        const select = assertAsArray(/** @type {any} */ (callback(this.#newProxy())));
        return {
            ...oldState,
            select
        };
    }

    #newProxy(table = this.#base.tableName, 
        callback=(o) => o, 
        relationships=this.#base.relationships, 
        schema=this.#base.schema, 
        realTableName=this.#base.tableName) 
    {
        return new Proxy({}, {
            get: (t, p, r) => {
                if (typeof(p) === 'symbol') throw new KinshipInvalidPropertyTypeError(p);
                if (this.#base.isRelationship(p, relationships)) {
                    return this.#newProxy(relationships[p].alias, callback, relationships[p].relationships, relationships[p].schema, relationships[p].table);
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

/**
 * Model representing selected columns.
 * @template {object} TTableModel
 * @typedef {{[K in keyof Partial<TTableModel> as import("../models/string.js").Join<TTableModel, K & string>]: SelectClauseProperty}} SelectedColumnsModel
 */

/**
 * Object to carry data tied to various information about a column being selected.
 * @typedef {import('../context/base.js').Column} SelectClauseProperty
 */

/**
 * Model parameter that is passed into the callback function for `.select`.  
 * 
 * __NOTE: This is a superficial type to help augment the AliasModel of the context so Users can expect different results in TypeScript.__  
 * __Real return value: {@link SelectClauseProperty}__
 * @template {object} TTableModel
 * @typedef {import("../models/string.js").Deflate<TTableModel>} SpfSelectCallbackModel
 */

export default {};