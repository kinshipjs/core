//@ts-check

/**
 * Augments the type, `T`, so that all nested properties have string values reflecting their own key and their parent(s).  
 * (e.g., { Foo: { Bar: "" } } becomes { Foo: { Bar: "Foo_Bar" } })
 * @template {import("./sql").Table} T
 * @template {string} [TPre=``]
 * @template {string} [TSeparator=`_`]
 * @typedef {{[K in keyof T]-?: T[K] extends (infer R extends import("./sql").Table)[]|undefined 
 *   ? AugmentAllValues<R, `${TPre}${K & string}${TSeparator}`> 
 *   : T[K] extends import("./sql").Table|undefined 
 *     ? AugmentAllValues<T[K], `${TPre}${K & string}${TSeparator}`> 
 *     : `${TPre}${K & string}`}} AugmentAllValues
 */

export default {};