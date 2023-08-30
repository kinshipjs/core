//@ts-check

/** @typedef {string|number|boolean|bigint|Date} DataType */

/**
 * @template T
 * @typedef {T extends DataType|undefined 
 *   ? never 
 *   : T extends (infer U)[]|undefined 
*      ? U 
 *     : T extends object|undefined 
 *       ? T 
 *       : never
 * } OnlyObjectType
 */

export default {};