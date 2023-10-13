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
 * @template {object} T
 * @template {keyof T & string} [TKey=keyof T & string]
 * @template {string} [TSeparator="$$"]
 * @typedef {undefined extends T
*    ? never
*  : NonNullable<T[TKey]> extends (infer R extends object)[]
*    ? T extends T[TKey]
*      ? never
*    : `${TKey}${TSeparator}${Join<R>}`
*  : NonNullable<T[TKey]> extends object
*    ? `${TKey}${TSeparator}${Join<T[TKey]>}`
*  : never
* } Join
*/

/**
 * Grabs the first element in the String, separated by `TSeparator`.
 * @template {string|symbol|number} K
 * @template {string} [TSeparator='$$']
 * @typedef {K extends `${infer A}${TSeparator}${infer B}` ? A : K} Car
 */

/**
 * Grabs the remaining elements in the String, separated by `TSeparator`.
 * @template {string|symbol|number} K
 * @template {string} [TSeparator='$$']
 * @typedef {K extends `${infer B}${TSeparator}${infer A}` ? A : never} Cdr
 */

/**
 * Deflates a deeply nested object so all keys remap to some representation of where the key is located within the object.
 * @template {object} T
 * @template {string} [TPrepend=""]
 * @template {string} [TSeparator="$$"]
 * @typedef {{[K in (keyof T) & string]-?: NonNullable<T[K]> extends import("./types.js").DataType
 *   ? `${TPrepend}${K}` 
 *   : NonNullable<T[K]> extends (infer U extends object)[]
 *     ? Deflate<U, `${TPrepend}${K}${TSeparator}`, TSeparator>
 *     : NonNullable<T[K]> extends object
 *       ? Deflate<NonNullable<T[K]>, `${TPrepend}${K}${TSeparator}`, TSeparator>
 *       : never
 * }} Deflate
 */

/**
 * @template {object} TOriginal
 * @template {object} TDeflatedKeys
 * @typedef {FriendlyType<{[K in StartsWith<keyof TDeflatedKeys, "$">]: number} & Reinflated<TOriginal, keyof Omit<TDeflatedKeys, StartsWith<keyof TDeflatedKeys, "$">>>>} Reconstructed
 */

/** 
 * @template {object} TOriginal
 * @template {string|symbol|number} Keys 
 * @typedef {{[K in Keys as Contains<K, "$$"> extends never 
 *   ? K
 * : Car<K>]: Contains<K, "$$"> extends never 
 *   ? K extends keyof TOriginal
 *     ? TOriginal[K]
 *   : never 
 * : Car<K> extends keyof TOriginal 
 *   ? NonNullable<TOriginal[Car<K>]> extends (infer U extends object)[]
 *     ? FriendlyType<Reinflated<NonNullable<U>, Cdr<K>>>[]
 *   : FriendlyType<Reinflated<NonNullable<TOriginal[Car<K>]>, Cdr<K>>>
 * : never}} Reinflated
 */

/**
 * @template T
 * @typedef {T extends infer U ? import('./superficial.js').UnionToIntersection<{[K in keyof U]: U[K] }> : never} FriendlyType
 */

export default {};