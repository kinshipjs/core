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

/**
 * Suite of optimized functions. 
 * These functions were tested against many other functions using https://jsbench.me
 * and were deemed to be the fastest of all functions that were tested.
 */
export const Optimized = {
    /**
     * Checks to see if the object is empty.
     * @param {object} obj 
     * @returns {boolean}
     */
    isEmptyObject(obj) {
        for(let k in obj) return false;
        return true;
    },
    /**
     * Same behavior as JavaScript's `Array.prototype.map()` function.
     * @template T
     * @template U
     * @param {T[]} objs Objects to map
     * @param {(o: T) => U} callback Function with the parameter `o` from `objs` and returns `U`.
     * @returns {U[]} Mapped values from `objs`.
     */
    map(objs, callback) {
        let arr = [];
        for(let i = 0; i < objs.length; ++i) {
            arr.push(callback(objs[i]));
        }
        return arr;
    },
    /**
     * Same behavior as JavaScript's `Array.prototype.map()` function.
     * @template T
     * @param {T[]} objs Objects to map
     * @param {(o: T) => boolean} callback Function with the parameter `o` from `objs` and returns `U`.
     * @returns {T[]}} Mapped values from `objs`.
     */
    filter(objs, callback) {
        let arr = [];
        for(let i = 0; i < objs.length; ++i) {
            const obj = objs[i];
            if(callback(obj)) {
                arr.push(obj);
            }
        }
        return arr;
    },
    /**
     * Gets all unique objects within `objs` by the given `key`.
     * @param {object[]} objs 
     * @param {string} key 
     * @returns {object[]}
     */
    getUniqueObjectsByKey(objs, key) {
        const set = new Set();
        const uniques = [];
        for(let i = 0; i < objs.length; ++i) {
            const obj = objs[i];
            if(!set.has(obj[key])) {
                set.add(obj[key]);
                uniques.push(obj);
            }
        }
        return uniques;
    },
    /**
     * Gets all unique objects within `objs` by the given `keys`.
     * @param {object[]} objs 
     * @param {string[]} keys 
     * @returns {object[]}
     */
    getUniqueObjectsByKeys(objs, keys) {
        const set = new Set();
        const uniques = [];
        for(let i = 0; i < objs.length; ++i) {
            const obj = objs[i];
            const key = this.map(keys, k => obj[k]).toString();
            if(!set.has(key)) {
                uniques.push(obj);
                set.add(key);
            }
        }
        return uniques;
    },
    /**
     * Assigns all columns from `schema` to a new object, with the values of `record` for corresponding column properties.
     * @param {Record<string, import("../config/relationships.js").SchemaColumnDefinition>} schema 
     * @param {object} record 
     * @returns {object}
     */
    getObjectFromSchemaAndRecord(schema, record) {
        let newObject = {};
        for(const key in schema) {
            const colDef = schema[key];
            newObject[colDef.alias] = record[colDef.commandAlias];
        }
        return newObject;
    },
    /**
     * Gets all related records given a `pKeyValue` and the 
     * relating key, `fKey` to index into each record from `records`.
     * @param {object[]} records 
     * @param {string|number|bigint} pKeyValue 
     * @param {string} fKey 
     * @returns {object[]}
     */
    getRelatedRecords(records, pKeyValue, fKey) {
        let relatedRecords = [];
        for(let i = 0; i < records.length; ++i) {
            const rec = records[i];
            if(pKeyValue === rec[fKey]) {
                relatedRecords.push(rec);
            }
        }
        return relatedRecords;
    },
    /**
     * Assigns all keys and values from `source` that start with `$` to `target`. 
     * The reference of `target` does not change.
     * @param {object} source 
     * @param {object} target 
     * @returns {object} The same reference to `target`.
     */
    assignKeysThatStartWith$To(source, target) {
        for(const key in source) {
            if(key.startsWith("$")) {
                target[key] = source[key];
            }
        }
        return target;
    }
}