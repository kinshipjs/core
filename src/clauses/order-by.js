//@ts-check
import { KinshipBase } from "../context/base.js";
import { KinshipDataContext } from "../context/context.js";
import { assertAsArray } from "../context/util.js";
import { KinshipColumnDoesNotExistError, KinshipInvalidPropertyTypeError } from "../exceptions.js";

export class OrderByBuilder {
    /** @type {KinshipBase} */ #base;


    /**
     * @param {KinshipBase} kinshipBase 
     */
    constructor(kinshipBase) {
        this.#base = kinshipBase;
    }

    /**
     * @template {object} TTableModel
     * Specify the columns to sort on.  
     * __NOTE: columns used for sorting are done in the order that is specified.__
     * @param {import("../context/context.js").State} oldState
     * @param {(model: SortByCallbackModel<TTableModel>) => import("../models/maybe.js").MaybeArray<SortByClauseProperty|SortByCallbackModelProp>} callback 
     * Property reference callback that is used to determine which column or columns will be used to sort the queried rows
     * @returns {import("../context/context.js").State} A new context with the state of the context this occurred in addition with a new state of an ORDER BY clause.
     */
    getState(oldState, callback) {
        const props = assertAsArray(/** @type {SortByClauseProperty[]} */ (callback(this.#newProxy())));
        return {
            ...oldState,
            orderBy: props
        };
    }
    
    #newProxy(table = this.#base.tableName, 
        relationships=this.#base.relationships, 
        schema=this.#base.schema, 
        realTableName=this.#base.tableName
    ) {
        if(table === undefined) table = this.#base.tableName;
        return new Proxy({}, {
            get: (t, p, r) => {
                if (typeof(p) === 'symbol') throw new KinshipInvalidPropertyTypeError(p);
                if (this.#base.isRelationship(p, relationships)) {
                    return this.#newProxy(relationships[p].alias, relationships[p].relationships, relationships[p].schema, relationships[p].table);
                }
                if(!(p in schema)) throw new KinshipColumnDoesNotExistError(p, realTableName);
                const { field: field, commandAlias: alias } = schema[p];
                return {
                    table,
                    column: field,
                    alias,
                    direction: "ASC",
                    asc() {
                        return {
                            table,
                            column: field,
                            alias,
                            direction: "ASC"
                        }
                    },
                    desc() {
                        return {
                            table,
                            column: field,
                            alias,
                            direction: "DESC"
                        }
                    }
                };
            }
        });
    }
}

/**
 * @typedef {import('../context/base.js').Column & { direction: "ASC"|"DESC" }} SortByClauseProperty
 */

/**
 * @typedef {object} SortByCallbackModelProp
 * @prop {() => SortByClauseProperty} asc
 * @prop {() => SortByClauseProperty} desc
 */

/**
 * @template {object} T
 * @typedef {AugmentModel<T, SortByCallbackModelProp>} SortByCallbackModel
 */

/** 
 * Augments the given type, `TTransformingModel` so that all of its non `object` property types
 * (including nested properties within `SqlTable` type properties) instead have the type, `TFinalType`.
 * @template {object} TTransformingModel
 * Type to recurse through to augment.
 * @template TFinalType
 * Type to augment SQL primitive types (non `SqlTable` types) to.
 * @typedef {{[K in keyof TTransformingModel]-?: TTransformingModel[K] extends import("../models/types.js").DataType|undefined 
 *   ? TFinalType 
 *   : TTransformingModel[K] extends (infer U extends object)[]|undefined 
 *     ? AugmentModel<U, TFinalType> 
 *     : TTransformingModel[K] extends (object|undefined) 
 *       ? AugmentModel<TTransformingModel[K], TFinalType> 
 *       : never
 * }} AugmentModel
 */

