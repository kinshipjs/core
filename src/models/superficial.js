//@ts-check

/** @template T @typedef {import("./maybe").MaybeArray<T>} MaybeArray */

/**
 * @template {MaybeArray<object|undefined>} T
 * @typedef {T extends (infer R)[] ? R : T} SqlTableType
 */



/** @typedef {{ a: number, b: string, c: { d: boolean, e: { f: Date, g: number } }}} Test */
/** @typedef {SqlTableType<Test>} X */


export default {};