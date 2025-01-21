//@ts-check

/**
 * @param {string} realColumnName 
 * @returns {Decorators<number>}
 */
export function int(realColumnName) {
    return decorators({
        type: "int",
        realColumnName,
        notNull: false
    });
}

/**
 * @param {string} realColumnName 
 * @param {number} length
 * @returns {Decorators<string>}
 */
export function varchar(realColumnName, length) {
    return decorators({
        type: "varchar",
        length,
        realColumnName,
        notNull: false
    });
}

/**
 * @param {string} realColumnName 
 * @returns {Decorators<boolean>}
 */
export function boolean(realColumnName) {
    return decorators({
        type: "bit",
        length: 1,
        realColumnName,
        notNull: false
    });
}

/**
 * @template {number} [TLength=1]
 * @param {string} realColumnName 
 * @param {TLength} length
 * @returns {Decorators<TLength extends 1 ? boolean : number>}
 */
export function bit(realColumnName, length=/** @type {any} */(1)) {
    return decorators({
        type: "bit",
        length,
        realColumnName,
        notNull: false
    });
}

/**
 * @param {string} realColumnName 
 * @returns {Decorators<Date>}
 */
export function date(realColumnName) {
    return decorators({
        type: "date",
        realColumnName,
        notNull: false
    });
}

/**
 * @param {string} realColumnName 
 * @returns {Decorators<Date>}
 */
export function datetime(realColumnName) {
    return decorators({
        type: "datetime",
        realColumnName,
        notNull: false
    });
}

/**
 * @param {string} realColumnName 
 * @returns {Decorators<Date>}
 */
export function timestamp(realColumnName) {
    return decorators({
        type: "timestamp",
        realColumnName,
        notNull: false
    });
}

/**
 * @template TModel
 * @param {new () => TModel} foreignProto
 */
export function foreign(foreignProto) {
    return {
        /**
         * 
         * @returns {ForeignReference<typeof foreignProto, TModel, false>}
         */
        one() {
            return {
                prototype: foreignProto
            }
        },
        /**
         * 
         * @returns {ForeignReference<typeof foreignProto, TModel, true>}
         */
        many() {
            return {
                prototype: foreignProto
            }
        }
    }
}

/**
 * 
 * @param {ColumnInfo} columnInfo 
 */
function decorators(columnInfo) {
    return {
        _info: columnInfo,
        notNull() {
            return decorators({
                ...columnInfo,
                notNull: true
            });
        },
        primaryKey() {
            return {
                ...decorators(columnInfo),
                identity(offset=1,step=1) {
                    return decorators({
                        ...columnInfo,
                        offset,
                        step
                    })
                }
            };
        }
    }
}

/**
 * @typedef {object} ColumnInfo
 * @prop {string} type
 * @prop {string} realColumnName
 * @prop {number} [length=undefined]
 * @prop {boolean} [notNull=false]
 * @prop {number} [offset=undefined]
 * @prop {number} [step=undefined]
 */

/**
 * @template TType
 * @template {boolean} [TIsNullable=true]
 * @template {string} [TKeysToOmit=never]
 * @typedef {object} Decorators
 * @prop {() => Omit<Decorators<TType, false, TKeysToOmit|"notNull">, TKeysToOmit|"notNull">} notNull
 * @prop {() => Omit<Decorators<TType, false, TKeysToOmit|"notNull"|"primaryKey"> & { identity: (offset?: number, step?: number) => Omit<Decorators<TType, false, TKeysToOmit|"notNull"|"primaryKey"|"identity">, TKeysToOmit|"notNull"|"primaryKey"|"identity">}, "notNull"|"primaryKey">} primaryKey
 */

/**
 * @template {new () => any} TProto
 * @template {TProto extends new () => infer T ? T : never} TModel
 * @template {boolean} TIsMany
 * @typedef {object} ForeignReference 
 * @prop {TProto} prototype
 */

/**
 * Infer the user's configured class model into an interpreted Table that accurately represents the Table model they set up.
 * @template TModel
 * @typedef {{[K in keyof TModel]: TModel[K] extends ForeignReference<*, infer T, infer TIsMany> 
 *   ? TIsMany extends true 
 *     ? Infer<T>[]
 *   : Infer<T> 
 * : TModel[K] extends Decorators<infer U> 
 *   ? U
 * : TModel[K] extends Omit<Decorators<infer U>, *>
 *   ? U
 * : never}} Infer
 */

/**
 * Coerce the object type, `T`, so that all array-type values are inferred to just their base types, thus removing their array property.  
 * 
 * This type will be recursively applied to all sub-keys on this type. 
 * @template {object} T
 * @typedef {{[K in keyof T]: T[K] extends PrimitiveDataType ? T[K] : T[K] extends (infer U)[] ? RecursiveCoerce<U> : RecursiveCoerce<T[K]>}} RecursiveCoerce
 */

/**
 * Coerce the object type, `T`, so that all array-type values are inferred to just their base types, thus removing their array property.  
 * @template {object} T
 * @typedef {{[K in keyof T]: T[K] extends PrimitiveDataType ? T[K] : T[K] extends (infer U)[] ? U : T[K]}} Coerce
 */

/**
 * @template T
 * @typedef {T extends infer U ? {[K in keyof U]: U[K] } : never} Clarify
 */

/**
 * Wrapper for `Clarify` type on `Coerce` type on `Infer` type.
 * 
 * Use this type if you need to extract the TypeScript representation of a database model.
 * @template T
 * @typedef {Clarify<Infer<T>>} InferredDbModel
 */

/**
 * @template T
 * @typedef {T|T[]} MaybeArray 
 */

/**
 * @typedef {boolean|number|string|Date} PrimitiveDataType
 */