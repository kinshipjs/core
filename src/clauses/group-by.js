//@ts-check

import { KinshipInternalError } from "../exceptions";

export class GroupByBuilder {
    constructor(kinshipBase) {

    }

    /**
     * 
     * @param {"AVG"|"COUNT"|"MIN"|"MAX"|"SUM"|"TOTAL"} aggr
     * @returns {(col?: any) => any} 
     */
    #getAggregateData(aggr) {
        return (col) => {
            if (aggr === "TOTAL") return {
                table: 'AGGREGATE',
                column: 'COUNT(*)',
                alias: `$total`,
                aggregate: aggr
            }
            if (col === undefined) throw new KinshipInternalError();
            const { table, column, alias } = /** @type {import("../context/base").ColumnDetails} */ (col);
            const c = aggr === 'COUNT'
                ? `COUNT(DISTINCT ${table}.${column})`
                : `${aggr}(${table}.${column})`;
            return {
                table: 'AGGREGATE',
                column: c,
                alias: `$${aggr.toLowerCase()}_` + alias?.replace(/\<\|/g, "_"),
                aggregate: aggr
            }
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
 * @typedef {import("../context/base").ColumnDetails & { aggregate?: "AVG"|"COUNT"|"MIN"|"MAX"|"SUM"|"TOTAL" }} GroupByClauseProperty
 */

/**
 * Model representing grouped columns, including aggregates.
 * @template {object|undefined} TTableModel
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
 * @template {object|undefined} TTableModel
 * @typedef {AugmentAllValues<TTableModel>} SpfGroupByCallbackModel
 */

/** AugmentAllValues  
 * Augments the type, `T`, so that all nested properties have string values reflecting their own key and their parent(s).  
 * (e.g., { Foo: { Bar: "" } } becomes { Foo: { Bar: "Foo_Bar" } })
 * @template {object|undefined} T
 * @typedef {{[K in keyof T]-?: K}} AugmentAllValues
*/