//@ts-check
import { KinshipBase } from "../context/base.js";
import { assertAsArray } from "../context/util.js";
import { KinshipColumnDoesNotExistError, KinshipInternalError, KinshipInvalidPropertyTypeError, KinshipSyntaxError } from "../exceptions.js";


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
     * @template {import("../clauses/choose.js").SelectedColumnsModel<TAliasModel>|({[k: string]: keyof TSelectedColumns})|TAliasModel} [TSelectedColumns=TAliasModel]
     * Type that represents the selected columns.
     * @param {import("../context/context.js").State} oldState
     * Old state before the user called `.choose()`.
     * @param {(model: import("../clauses/choose.js").SpfSelectCallbackModel<TAliasModel>) => 
     *  import("../models/maybe.js").MaybeArray<keyof TSelectedColumns>|TSelectedColumns} callback
     * Callback model that allows the user to select which columns to grab.
     * @returns {import("../context/context.js").State}
     */
    getState(oldState, callback) {
        if(oldState.groupBy) {
            throw new KinshipSyntaxError(`Cannot select columns when ".groupBy()" has been previously called.`);
        }
        if(!callback) {
            return oldState;
        }
        const columnArrayOrMap = (callback(this.#newProxy(oldState)));
        /** @type {import('../context/base.js').Column[]} */
        let select;
        if(!this.#isTypeOfMaybeColumnArray(columnArrayOrMap)) {
            const fn = (k, map) => {
                const maybeCol = map[k];
                if(this.#isTypeOfMaybeColumnArray(maybeCol)) {
                    const newCol = {
                        table: map[k].table,
                        column: map[k].column,
                        alias: k,
                        commandAlias: map[k].commandAlias.replace(map[k].column, k)
                    };
                    console.log(newCol);
                    return newCol;
                }
                return Object.keys(maybeCol).flatMap(k => fn(k, maybeCol));
            };
            select = Object.keys(columnArrayOrMap).flatMap(k => fn(k, columnArrayOrMap));
        } else {
            select = assertAsArray(/** @type {any} */(columnArrayOrMap));
        }
        return {
            ...oldState,
            select
        };
    }

    /**
     * @param {import("../models/maybe.js").MaybeArray<any>} o 
     * @returns {boolean}
     */
    #isTypeOfMaybeColumnArray(o) {
        /** @param {object} obj */
        const isTypeOfColumn = obj => ("table" in obj && "column" in obj && "alias" in obj);
        if(Array.isArray(o)) {
            if(o.filter(isTypeOfColumn).length !== o.length) {
                throw new KinshipInternalError();
            }
            return true;
        }
        return isTypeOfColumn(o);
    }

    #newProxy(state, 
        table = this.#base.tableName, 
        callback=(o) => o, 
        relationships=this.#base.relationships, 
        schema=this.#base.schema, 
        realTableName=this.#base.tableName) 
    {
        return new Proxy({}, {
            get: (t, p, r) => {
                if (typeof(p) === 'symbol') throw new KinshipInvalidPropertyTypeError(p);
                if (this.#base.isRelationship(p, relationships)) {
                    return this.#newProxy(state, relationships[p].alias, callback, relationships[p].relationships, relationships[p].schema, relationships[p].table);
                }
                // handles `.select()` where the context has not already been aliased.
                if(p in schema) {
                    const { field: field, alias, commandAlias } = schema[p];
                    return callback({
                        table,
                        column: field,
                        alias,
                        commandAlias,
                        
                    });
                }

                // handles `.select()` where the context has already had `.select()` called on it once, where that `.select()` returned an alias map.
                const [selectedColumn] = state.select.filter(v => v.alias === p);
                if(selectedColumn) {
                    return callback(selectedColumn);
                }

                // if `p` is not part of the schema, and no column exists in the SELECT clause of the state with the alias of `p`, then the column is presumed to not exist.
                throw new KinshipColumnDoesNotExistError(p, realTableName);
                
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