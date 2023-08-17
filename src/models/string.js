//@ts-check

/**
 * Checks if the given string type, `K`, contains `TContainer`, and if so, returns `K`, otherwise it returns `never`.
 * @template {string|symbol|number} K
 * @template {string} TContainer
 * @typedef {K extends `${infer A}${TContainer}${infer B}` ? K : never} Contains
 */

/**
 * Checks if the given string type, `K`, begins with `TStarter`, and if so, returns `K`, otherwise it returns `never`.
 * @template {string|symbol|number} K
 * @template {string} TStarter
 * @typedef {K extends `${TStarter}${infer A}` ? K : never} StartsWith
 */

/**
 * Recursively joins all nested objects keys to get a union of all combinations of strings with each key.
 * @template {import("./sql.js").Table} T
 * @template {keyof T & string} [TKey=keyof T & string]
 * @typedef {undefined extends T
 *      ? never
 *      : T[TKey] extends (infer R extends import("./sql.js").Table)[]|undefined
 *          ? T extends T[TKey]
 *              ? never
 *              : `${TKey}_${Join<R>}`
 *          : T[TKey] extends import("./sql.js").Table|undefined
 *              ? `${TKey}_${Join<T[TKey]>}`
 *              : never} Join
 */

/**
 * Grabs the first element in the String, separated by "_".
 * @template {string|symbol|number} K
 * @typedef {K extends `${infer A}_${infer B}` ? A : K} Car
 */

/**
 * Grabs the remaining elements in the String, separated by "_".
 * @template {string|symbol|number} K
 * @typedef {K extends `${infer B}_${infer A}` ? A : never} Cdr
 */

export default {};