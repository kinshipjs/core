//@ts-check

/** @typedef {string|number|boolean|bigint|Date} DataType */

/**
 * @template T
 * @typedef {T extends DataType ? never : T extends object|undefined ? T : T extends (infer U)[]|undefined ? U : never} OnlyObjectType
 */

export default {};