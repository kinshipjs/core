//@ts-check
/** @import { DataType } from "../models/types.js" */
/** @import { Relationships } from "../config/relationships.js" */
/** @import { SchemaColumnDefinition } from "../adapter.js" */
/** @import { MaybeArray } from "../models/maybe.js" */

/**
 * @template TTableModel
 * @template {keyof TTableModel} [TColumn=keyof TTableModel]
 * @typedef {object} IWhereBuilder
 * @prop {IWhereBuilder<TTableModel, TColumn>} not
 * Negate the next condition (or nest of conditions)
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} equals
 * `[Column] = {value}`  
 * Add a condition that checks if column values are equal to the `value` specified.
 * @prop {IWhereBuilder<TTableModel, TColumn>['equals']} eq
 * _Alias for `.equals()`_  
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} lessThan
 * `[Column] < {value}`  
 * Add a condition that checks if column values are less than the `value` specified.
 * @prop {IWhereBuilder<TTableModel, TColumn>['lessThan']} lt
 * _Alias for `.lessThan()`_  
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} lessThanOrEqualTo
 * `[Column] <= {value}`  
 * Add a condition that checks if column values are less than OR equal to the `value` specified.
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} lteq
 * _Alias for `.lessThanOrEqualTo()`_  
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} greaterThan
 * `[Column] > {value}`  
 * Add a condition that checks if column values are greater than the `value` specified.
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} gt
 * _Alias for `.greaterThan()`_  
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} greaterThanOrEqualTo
 * `[Column] >= {value}`  
 * Add a condition that checks if column values are greater than OR equal to the `value` specified.
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} gteq
 * _Alias for `.greaterThanOrEqualTo()`_  
 * @prop {IWhereConditionHandler<[lowerBound: InferArgument<TTableModel, TColumn>, upperBound: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} between
 * `[Column] BETWEEN {lowerBound} AND {upperBound}`  
 * Add a condition that checks if column values are exclusively between the `lowerBound` and `upperBound`.  
 * @prop {IWhereConditionHandler<[lowerBound: InferArgument<TTableModel, TColumn>, upperBound: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} in
 * `[Column] IN (...{values})`  
 * Add a condition that checks if column values are in a range of specified `values`.
 * @prop {IWhereConditionHandler<[pattern: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} like
 * `[Column] LIKE "{pattern}"`  
 * Add a condition that checks if column values are like a given `pattern`.  
 * _Note: Wildcard characters may be dependent on the adapter you are using._
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} contains
 * _Alias for `.like("%" + value + "%")`_  
 * @prop {IWhereConditionHandler<[pattern: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} startsWith
 * _Alias for `.like(value + "%")`_  
 * @prop {IWhereConditionHandler<[pattern: InferArgument<TTableModel, TColumn>], TTableModel, TColumn>} endsWith
 * _Alias for `.like("%" + value)`_  
 */

/**
 * @template TTableModel
 * @template TBuilder 
 * @typedef {ReturnType<CreatePropertyProxy<TTableModel, TBuilder>>} PropertyProxy
 */

/**
 * @template TTableModel
 * @template TBuilder
 * @param {new (property: string) => TBuilder} builder 
 * @returns {{[K in keyof TTableModel]: TBuilder}}
 */
function CreatePropertyProxy(builder) {
    return new Proxy(/** @type {any} */ ({}), {
        get(t,p,r) {
            if(typeof p !== "string") {
                throw new Error(`Reference must be of type string`);
            }
            return new builder(p);
        }
    });
}

/**
 * @typedef IBuilder2
 * @prop {number} b
 */

/** 
 * @template TTableModel
 * @template {keyof TTableModel} [TColumn=keyof TTableModel]
 * @implements {IWhereBuilder<TTableModel, TColumn>}
 */
export class WhereBuilder {
    /** @type {string} */
    #__property;

    /**
     * @param {string} property 
     */
    constructor(property) {
        this.#__property = property;
    }

    /** @type {IWhereBuilder<TBaseModel, TTableModel, TColumn>['not'] } */
    get not() {
        return new WhereBuilder(this.#__property);
    }

    /** @type {IWhereBuilder<TBaseModel, TTableModel, TColumn>['between'] } */
    between(value, value2) {
        return /** @type {typeof PropertyProxy<TTableModel, WhereBuilder<TTableModel, TColumn>>} */ (CreatePropertyProxy)(WhereBuilder);
    }

    /** @type {IWhereBuilder<TBaseModel, TTableModel, TColumn>['contains'] } */
    contains(value) {
        return new CreatePropertyProxy(WhereBuilder);
    }

    /** @type {IWhereBuilder<TBaseModel, TTableModel, TColumn>['equals'] } */
    equals(value) {
        return new CreatePropertyProxy(WhereBuilder);
    }

    /** @type {IWhereBuilder<TBaseModel, TTableModel, TColumn>['endsWith'] } */
    endsWith(value) {
        return new CreatePropertyProxy(WhereBuilder);
    }

    /** @type {IWhereBuilder<TBaseModel, TTableModel, TColumn>['lessThan'] } */
    lessThan(value) {
        return new CreatePropertyProxy(WhereBuilder);
    }

    /** @type {IWhereBuilder<TBaseModel, TTableModel, TColumn>['lessThanOrEqualTo'] } */
    lessThanOrEqualTo(value) {
        return new CreatePropertyProxy(WhereBuilder);
    }

    /** @type {IWhereBuilder<TBaseModel, TTableModel, TColumn>['greaterThan'] } */
    greaterThan() {
        return new CreatePropertyProxy(WhereBuilder);
    }

    /** @type {IWhereBuilder<TBaseModel, TTableModel, TColumn>['greaterThanOrEqualTo'] } */
    greaterThanOrEqualTo() {
        return new CreatePropertyProxy(WhereBuilder);
    }

    /** @type {IWhereBuilder<TBaseModel, TTableModel, TColumn>['in'] } */
    in() {
        return new CreatePropertyProxy(WhereBuilder);
    }

    /** @type {IWhereBuilder<TBaseModel, TTableModel, TColumn>['like'] } */
    like(value) {
        return new CreatePropertyProxy(WhereBuilder);
    }

    /** @type {IWhereBuilder<TBaseModel, TTableModel, TColumn>['startsWith'] } */
    startsWith() {
        return new CreatePropertyProxy(WhereBuilder);
    }

    eq = this.equals;
    lt = this.lessThan;
    lteq = this.lessThanOrEqualTo;
    gt = this.greaterThan;
    gteq = this.greaterThanOrEqualTo;
}
/** @typedef {{ a: number,b: string }} Obj */
/** @type {PropertyProxy<Obj, IWhereBuilder<Obj>>} */
const pp = CreatePropertyProxy(WhereBuilder);
pp.a.equals("")
    

/** @enum {string} */
export const WhereChain = {
    WHERE: "WHERE",
    WHERE_NOT: "WHERE NOT",
    AND: "AND",
    AND_NOT: "AND NOT",
    OR: "OR",
    OR_NOT: "OR NOT"
};

/** @enum {typeof WhereOperator[keyof typeof WhereOperator]} */
export const WhereOperator = Object.freeze({
    EQUALS: "=",
    NOT_EQUALS: "<>",
    LESS_THAN: "<",
    GREATER_THAN: ">",
    LESS_THAN_OR_EQUAL_TO: "<=",
    GREATER_THAN_OR_EQUAL_TO: ">=",
    IN: "IN",
    LIKE: "Like",
    IS: "IS",
    IS_NOT: "IS NOT",
    BETWEEN: "BETWEEN"
});

/**
 * @template {Array} TArgs
 * @template TTableModel
 * @template {keyof TTableModel} TColumn
 * @typedef {(...args: TArgs) => PropertyProxy<TTableModel, IWhereBuilder<TTableModel, TColumn>>} IWhereConditionHandler
 */

/**
 * @typedef {object} IWhereConditionIterator
 * @prop {() => { nest: boolean, value: WhereClauseProperty }} next
 * @prop {() => void} reset
 */

/**
 * @template TTableModel
 * @template {keyof TTableModel} TColumn
 * @typedef {undefined extends TTableModel[TColumn] ? TTableModel[TColumn]|null : TTableModel[TColumn]} InferArgument
 */

/**
 * @typedef {[WhereClauseProperty, ...(WhereClauseProperty|WhereClausePropertyArray)[]]} WhereClausePropertyArray 
 */

/**
 * @typedef {object} WhereClauseProperty
 * @prop {string} table
 * @prop {string} property
 * @prop {WhereChain} chain
 * @prop {MaybeArray<DataType|null>} value
 * @prop {WhereOperator} operator
 */

/**
 * Object to chain AND and OR conditions onto a WHERE clause.
 * @template {object} TTableModel
 * @template {object} [TOriginalModel=TTableModel]
 * @typedef {Object} Chain
 * @prop {(modelCallback: ChainCallback<TTableModel, TOriginalModel>) => Chain<TTableModel, TOriginalModel>} and 
 * Apply an AND chain to your WHERE clause.
 * @prop {(modelCallback: ChainCallback<TTableModel, TOriginalModel>) => Chain<TTableModel, TOriginalModel>} or 
 * Apply an OR chain to your WHERE clause.
 */

/**
 * @template {object} TTableModel
 * @template {object} [TOriginalModel=TTableModel]
 * @callback ChainCallback
 * @param {ChainObject<TTableModel, TOriginalModel>} model
 * @returns {any}
 */

/**
 * @template {object} TTableModel
 * @template {object} [TOriginalModel=TTableModel]
 * @typedef {{[K in keyof TTableModel]-?:
*   NonNullable<TTableModel[K]> extends DataType
*     ? WhereBuilder<TTableModel, K, TOriginalModel>
*   : NonNullable<TTableModel[K]> extends (infer U extends object)[]
*     ? ChainObject<Required<U>, TOriginalModel> 
*   : NonNullable<TTableModel[K]> extends object
*     ? ChainObject<Required<TTableModel[K]>, TOriginalModel> 
*   : never}} ChainObject
*/

/**
* Function definition for every type of condition to be created in a WHERE clause.
* @template {object} TTableModel
* @template {keyof TTableModel} TColumn
* @template {object} [TOriginalModel=TTableModel]
* @callback Condition
* @param {undefined extends TTableModel[TColumn] ? TTableModel[TColumn]|null : TTableModel[TColumn]} value
* Value of the same type of the column being worked on to check the condition against.
* @returns {Chain<TOriginalModel>}
* A group of methods for optional chaining of conditions.
*/

/** 
* Function used to help initialize building a WHERE clause.
* @template {object} TTableModel
* @typedef {(m: {[K in keyof TTableModel]: WhereBuilder<TTableModel, K>}) => void} WhereBuilderFunction 
*/