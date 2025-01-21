//@ts-check
/** @import { Clarify } from "../context/types.js" */

/**
 * @template TType
 * @template {boolean} [TNotNull=false]
 * @template {boolean} [TPrimaryKey=false]
 * @template {keyof IColumnBuilder<any>} [TUsedKeys=never]
 * @typedef {object} IColumnBuilder
 * @prop {() => Clarify<Omit<IColumnBuilder<TType, true, TPrimaryKey, "notNull"|TUsedKeys>, "notNull"|TUsedKeys>>} notNull
 * @prop {() => Clarify<Omit<IColumnBuilder<TType, TNotNull, true, "primaryKey"|TUsedKeys>,"primaryKey"|TUsedKeys>>} primaryKey
 * @prop {() => Clarify<Omit<IColumnBuilder<TType, TNotNull, true, "withDefault"|TUsedKeys>,"withDefault"|TUsedKeys>>} withDefault
 */

/**
 * @template TType
 * @implements {IColumnBuilder<TType>}
 */
export class ColumnBuilder {

    /** @type {IColumnBuilder<TType>['notNull']} */
    notNull() {
        return /** @type {any} */ (new ColumnBuilder());
    }

    /** @type {IColumnBuilder<TType>['primaryKey']} */
    primaryKey() {
        return /** @type {any} */ (new ColumnBuilder());
    }
    
    /** @type {IColumnBuilder<TType>['withDefault']} */
    withDefault() {
        return /** @type {any} */ (new ColumnBuilder());
    }

}

/**
 * @template {IColumnBuilder<any>} TColumnBuilder
 * @typedef {TColumnBuilder extends IColumnBuilder<infer T> ? T : never} InferTypeFromColumnBuilder
 */