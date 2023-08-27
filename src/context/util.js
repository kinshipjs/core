//@ts-check

import { WhereBuilder } from "../clauses/where.js";

/**
 * Given an object that could be an array or itself, augment it so it has to be an array.  
 * __NOTE: Will not work on an array of arrays.__
 * @template T
 * @param {import("../models/maybe.js").MaybeArray<T>} o 
 * @returns {T[]}
 */
export function assertAsArray(o) {
    if(o === undefined) return [];
    const arr = Array.isArray(o) ? o : [o];
    return /** @type {T[]} */ (arr);
}

/**
 * Given an array of records, get all properties that are unique across all records.
 * @template {object|undefined} TAliasModel
 * @param {TAliasModel[]} records 
 * @returns {string[]}
 */
export function getUniqueColumns(records) {
    const onlyPrimitiveKeys = r => Object.keys(r).filter(k => isPrimitive(r[k]));
    const allPrimitiveKeysAcrossAllRecords = records.flatMap(onlyPrimitiveKeys);
    const uniquePrimitiveKeys = new Set(allPrimitiveKeysAcrossAllRecords);
    return Array.from(uniquePrimitiveKeys);
}

/**
 * Given an array of records and an array of columns of which are all unique column names across all records, 
 * get all respective values to each property specified from columns as one array.
 * @template {object|undefined} TAliasModel
 * @param {TAliasModel[]} records 
 * @param {string[]} columns
 */
export function getAllValues(records, columns=getUniqueColumns(records)) {
    return records.map(r => Object.values({
        ...Object.fromEntries(columns.map(c => [c,null])), 
        ...Object.fromEntries(Object.entries(/** @type {any} */ (r)).filter(([k,v]) => isPrimitive(v)))
    }))
}

/**
 * Returns true if the field value is:
 *   - an instance of Date
 *   - a type of bigint, boolean, number, or string
 *   - strictly null 
 * @param {any} field Field to check
 * @returns {boolean} True if it is a primitive value, false otherwise.
 */
export function isPrimitive(field) {
    switch(typeof field) {
        case "bigint":
        case "boolean":
        case "number":
        case "string":
            return true;
    }
    return field instanceof Date || field === null;
}

/**
 * 
 * @param {WhereBuilder<any, any>} where
 */
export function doFiltersExist(where) {
    const numConditions = getFilterConditionsFromWhere(where).length; 
    return "where" in where && numConditions > 0
}

/**
 * 
 * @param {WhereBuilder<any, any>=} where
 * @returns {import("../clauses/where.js").WhereClausePropertyArray}
 */
export function getFilterConditionsFromWhere(where) {
    return where
        //@ts-ignore _getConditions is marked private but it is available for internal use.
        ?._getConditions() ?? /** @type {import("../clauses/where.js").WhereClausePropertyArray} */ ([]);
}