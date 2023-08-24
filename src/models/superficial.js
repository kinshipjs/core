//@ts-check

/** @template T @typedef {import("./maybe").MaybeArray<T>} MaybeArray */

/**
 * @template {MaybeArray<object|undefined>} T
 * @typedef {T extends (infer R)[] ? R : T} SqlTableType
 */



/** @typedef {{ a: number, b: string, c: { d: boolean, e: { f: Date, g: number } }}} Test */
/** @typedef {SqlTableType<Test>} X */

/**
 * @template T
 * @typedef {(T extends any ? (x: T) => any : never) extends (x: infer R) => any ? R : never} UnionToIntersection
 */

/**
 * From the given object, `T`, isolate the key value pair that `K` holds inside of the object (K can be nested within more objects)
 * Returning only an object with its representation of how `K` appears in `T`.  
 * Keys that start with `$` are inferred to be a key at the root level of the object with a `number` value type.
 * @template {object} T
 * @template {string} K
 * @typedef {IsAggregate<K> extends never 
 *  ? UnionToIntersection<K extends keyof T 
 *      ? Pick<T,K> 
 *      : {[K2 in keyof T as T[K2] extends object|undefined 
 *          ? K2 
 *          : never]: Isolate<T[K2], K>}> 
 *  : { [K2 in K]: number } } Isolate
 */

/** @template {string} S @typedef {import("./string.js").StartsWith<S, "$avg_"|"$sum_"|"$max_"|"$min_"|"$count_"|"$total_">} IsAggregate */

/** @typedef {IsAggregate<"$avg_X">} Foo */

export default {};