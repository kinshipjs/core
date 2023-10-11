//@ts-check

import { KinshipBase } from "../context/base.js";
import { assertAsArray } from "../context/util.js";
import { KinshipColumnDoesNotExistError, KinshipInternalError, KinshipInvalidPropertyTypeError } from "../exceptions.js";

/** @enum {number} */
const AggregateType = {
    AVG: 0,
    COUNT: 1,
    MIN: 2,
    MAX: 3,
    SUM: 4,
    TOTAL: 5
};

export class GroupByBuilder {
    /** @type {KinshipBase} */ #base;

    /**
     * @param {KinshipBase} kinshipBase 
     */
    constructor(kinshipBase) {
        this.#base = kinshipBase;
    }

    /**
     * Specify the columns to group the results on.
     * @template {object} TTableModel
     * @template {import("../clauses/group-by.js").GroupedColumnsModel<TTableModel>} TGroupedColumns
     * Used internally for typescript to create a new `TAliasModel` on the returned context, which will change the scope of what the user will see in further function calls.
     * @param {import("../context/context.js").State} oldState
     * @param {(model: import("../clauses/group-by.js").SpfGroupByCallbackModel<TTableModel>, aggregates: import("../clauses/group-by.js").Aggregates) => import("../models/maybe.js").MaybeArray<keyof TGroupedColumns>} callback
     * Property reference callback that is used to determine which column or columns should be selected and grouped on in future queries.
     * @returns {import("../context/context.js").State} 
     * State for group by. 
     */
    getState(oldState, callback) {
        /** @type {Aggregates} */
        const aggregates = {
            avg: this.#getAggregateData(AggregateType.AVG),
            count: this.#getAggregateData(AggregateType.COUNT),
            min: this.#getAggregateData(AggregateType.MIN),
            max: this.#getAggregateData(AggregateType.MAX),
            sum: this.#getAggregateData(AggregateType.SUM),
            total: this.#getAggregateData(AggregateType.TOTAL),
        };
        const data = assertAsArray(callback(this.#newProxy(), aggregates));

        /** @type {GroupByClauseProperty[]} */
        const props = /** @type {any} */ (data);

        return {
            ...oldState,
            select: props,
            groupBy: props.filter(col => !("aggregate" in col))
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
                };
            }
        });
    }

    /**
     * 
     * @param {AggregateType} aggregate
     * @returns {(col?: any) => any} 
     */
    #getAggregateData(aggregate) {
        return (col) => {
            if(aggregate === AggregateType.TOTAL) {
                return { 
                    table: "", 
                    column: this.#base.adapter.aggregates.total, 
                    alias: "$total", 
                    aggregate 
                }
            }
            if (col === undefined) throw new KinshipInternalError();
            const alias = col.alias?.replace(/\<\|/g, "_");
            switch(aggregate) {
                case AggregateType.AVG: return { 
                    table: "", 
                    column: this.#base.adapter.aggregates.avg(col.table, col.column), 
                    alias: `$avg_${alias}`,
                    aggregate 
                };
                case AggregateType.COUNT: return { 
                    table: "", 
                    column: this.#base.adapter.aggregates.count(col.table, col.column), 
                    alias: `$count_${alias}`,
                    aggregate 
                };
                case AggregateType.MAX: return { 
                    table: "", 
                    column: this.#base.adapter.aggregates.max(col.table, col.column), 
                    alias: `$max_${alias}`,
                    aggregate 
                };
                case AggregateType.MIN: return { 
                    table: "", 
                    column: this.#base.adapter.aggregates.min(col.table, col.column), 
                    alias: `$min_${alias}`,
                    aggregate 
                };
                case AggregateType.SUM: return { 
                    table: "", 
                    column: this.#base.adapter.aggregates.sum(col.table, col.column), 
                    alias: `$sum_${alias}`,
                    aggregate 
                };
            }
            throw new KinshipInternalError();
        };
    }
}

/** @typedef {typeof count} AggrCountCallback */
/** @typedef {typeof avg} AggrAvgCallback */
/** @typedef {typeof sum} AggrSumCallback */
/** @typedef {typeof min} AggrMinCallback */
/** @typedef {typeof max} AggrMaxCallback */

/**
 * Creates an aggregated column for the count of distinct rows of some column, `col`, passed in.
 * @template {string} K
 * Key's name being worked on in this aggregate. (inferred from `col`)
 * @param {K} col
 * Name of the column being worked on in this aggregate.
 * @returns {`$count_${K}`}
 * The new property key that will exist in all records queried.
 */
function count(col) {
    return /** @type {any} */ (`COUNT(DISTINCT ${String(col).replace(/`/g, "")}) AS \`$count_${String(col).replace(/`/g, "")}\``);
}

/**
 * Creates an aggregated column for the average of some column, `col`, passed in.
 * @template {string} K
 * Key's name being worked on in this aggregate. (inferred from `col`)
 * @param {K} col
 * Name of the column being worked on in this aggregate.
 * @returns {`$avg_${K & string}`}
 * The new property key that will exist in all records queried.
 */
function avg(col) {
    return /** @type {any} */ (`AVG(${String(col).replace(/`/g, "")}) AS \`$avg_${String(col).replace(/`/g, "")}\``);
}

/**
 * Creates an aggregated column for the maximum of some column, `col`, passed in.
 * @template {string} K
 * Key's name being worked on in this aggregate. (inferred from `col`)
 * @param {K} col
 * Name of the column being worked on in this aggregate.
 * @returns {`$max_${K & string}`}
 * The new property key that will exist in all records queried.
 */
function max(col) {
    return /** @type {any} */ (`MAX(${String(col).replace(/`/g, "")}) AS \`$max_${String(col).replace(/`/g, "")}\``);
}

/**
 * Creates an aggregated column for the minimum of some column, `col`, passed in.
 * @template {string} K
 * Key's name being worked on in this aggregate. (inferred from `col`)
 * @param {K} col
 * Name of the column being worked on in this aggregate.
 * @returns {`$min_${K & string}`}
 * The new property key that will exist in all records queried.
 */
function min(col) {
    return /** @type {any} */ (`MIN(${String(col).replace(/`/g, "")}) AS \`$min_${String(col).replace(/`/g, "")}\``);
}

/**
 * Creates an aggregated column for the sum of some column, `col`, passed in.
 * @template {string} K
 * Key's name being worked on in this aggregate. (inferred from `col`)
 * @param {K} col
 * Name of the column being worked on in this aggregate.
 * @returns {`$sum_${K & string}`}
 * The new property key that will exist in all records queried.
 */
function sum(col) {
    return /** @type {any} */ (`SUM(${String(col).replace(/`/g, "")}) AS \`$sum_${String(col).replace(/`/g, "")}\``);
}

/**
 * Object to carry data tied to various information about a column being grouped by.
 * @typedef {import("../context/base.js").Column & { aggregate?: "AVG"|"COUNT"|"MIN"|"MAX"|"SUM"|"TOTAL" }} GroupByClauseProperty
 */

/**
 * Model representing grouped columns, including aggregates.
 * @template {object} TTableModel
 * @typedef {{[K in keyof Partial<TTableModel>]: GroupByClauseProperty}
 *  & Partial<{ $total: GroupByClauseProperty }>
 *  & Partial<{[K in keyof TTableModel as `$count_${import("../models/string.js").Join<TTableModel, K & string>}`]: GroupByClauseProperty}>
 *  & Partial<{[K in keyof TTableModel as `$avg_${import("../models/string.js").Join<TTableModel, K & string>}`]: GroupByClauseProperty}>
 *  & Partial<{[K in keyof TTableModel as `$max_${import("../models/string.js").Join<TTableModel, K & string>}`]: GroupByClauseProperty}>
 *  & Partial<{[K in keyof TTableModel as `$min_${import("../models/string.js").Join<TTableModel, K & string>}`]: GroupByClauseProperty}>
 *  & Partial<{[K in keyof TTableModel as `$sum_${import("../models/string.js").Join<TTableModel, K & string>}`]: GroupByClauseProperty}>} GroupedColumnsModel
 */

/**
 * Object representing the `aggregate` object passed into the `.groupBy` callback function.
 * @typedef {Object} Aggregates
 * @prop {() => "$total"} total Gets the total count of all records from the query.
 * @prop {AggrCountCallback} count Gets the count of distinct rows for that field.
 * @prop {AggrAvgCallback} avg Gets the average amount across all rows for that field.
 * @prop {AggrMaxCallback} max Gets the maximum amount between all rows for that field.
 * @prop {AggrMinCallback} min Gets the minimum amount between all rows for that field.
 * @prop {AggrSumCallback} sum Gets the total sum amount across all rows for that field.
 */

/**
 * Model parameter that is passed into the callback function for `.groupBy`.  
 * 
 * __NOTE: This is a superficial type to help augment the AliasModel of the context so Users can expect different results in TypeScript.__  
 * __Real return value: {@link GroupByClauseProperty}__
 * @template {object} TTableModel
 * @typedef {import("../models/string.js").Deflate<TTableModel>} SpfGroupByCallbackModel
 */