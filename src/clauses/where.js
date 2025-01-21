// @ts-check
/** @import { DataType } from "../models/types.js" */
/** @import { Relationships } from "../config/relationships.js" */
/** @import { SchemaColumnDefinition } from "../adapter.js" */
/** @import { MaybeArray } from "../models/maybe.js" */

import { KinshipBase } from '../context/base.js';
import { 
    KinshipColumnDoesNotExistError, 
    KinshipInvalidPropertyTypeError, 
    KinshipSyntaxError 
} from '../exceptions.js';

/**
 * Initializes the first parts of a WhereBuilder given the column name and table name.
 * @template {object} TTableModel
 * @template {keyof TTableModel} TColumn
 * @param {KinshipBase} kinshipBase
 * @param {TColumn} column
 * @param {string} table
 * @param {"WHERE"|"WHERE NOT"} chain
 * @returns {WhereBuilder<TTableModel, TColumn, TTableModel>}
 */
export function Where(kinshipBase, column, table=kinshipBase.tableName, chain="WHERE") {
    return new WhereBuilder(kinshipBase, column, table, chain);
}

/**
 * @template {Array} TArgs
 * @template TTableModel
 * @template {keyof TTableModel} TColumn
 * @template [TBaseModel=TTableModel]
 * @typedef {(...args: TArgs) => Chain<TBaseModel>} IWhereConditionHandler
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
 * @template {object} TTableModel
 * @template {keyof TTableModel} TColumn
 * @template {object} [TBaseModel=TTableModel]
 * @typedef {object} IWhereBuilderExternal
 * @prop {IWhereBuilderExternal<TTableModel, TColumn>} not
 * Negate the next condition (or nest of conditions)
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} equals
 * `[Column] = {value}`  
 * Add a condition that checks if column values are equal to the `value` specified.
 * @prop {IWhereBuilderExternal<TTableModel, TColumn, TBaseModel>['equals']} eq
 * _Alias for `.equals()`_  
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} lessThan
 * `[Column] < {value}`  
 * Add a condition that checks if column values are less than the `value` specified.
 * @prop {IWhereBuilderExternal<TTableModel, TColumn, TBaseModel>['lessThan']} lt
 * _Alias for `.lessThan()`_  
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} lessThanOrEqualTo
 * `[Column] <= {value}`  
 * Add a condition that checks if column values are less than OR equal to the `value` specified.
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} lteq
 * _Alias for `.lessThanOrEqualTo()`_  
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} greaterThan
 * `[Column] > {value}`  
 * Add a condition that checks if column values are greater than the `value` specified.
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} gt
 * _Alias for `.greaterThan()`_  
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} greaterThanOrEqualTo
 * `[Column] >= {value}`  
 * Add a condition that checks if column values are greater than OR equal to the `value` specified.
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} gteq
 * _Alias for `.greaterThanOrEqualTo()`_  
 * @prop {IWhereConditionHandler<[lowerBound: InferArgument<TTableModel, TColumn>, upperBound: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} between
 * `[Column] BETWEEN {lowerBound} AND {upperBound}`  
 * Add a condition that checks if column values are between the `lowerBound` and `upperBound`.  
 * _Note: Inclusiveness/Exclusiveness may be dependent on the adapter you are using._
 * @prop {IWhereConditionHandler<[lowerBound: InferArgument<TTableModel, TColumn>, upperBound: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} in
 * `[Column] IN (...{values})`  
 * Add a condition that checks if column values are in a range of specified `values`.
 * @prop {IWhereConditionHandler<[pattern: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} like
 * `[Column] LIKE "{pattern}"`  
 * Add a condition that checks if column values are like a given `pattern`.  
 * _Note: Wildcard characters may be dependent on the adapter you are using._
 * @prop {IWhereConditionHandler<[value: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} contains
 * _Alias for `.like("%" + value + "%")`_  
 * @prop {IWhereConditionHandler<[pattern: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} startsWith
 * _Alias for `.like(value + "%")`_  
 * @prop {IWhereConditionHandler<[pattern: InferArgument<TTableModel, TColumn>], TTableModel, TColumn, TBaseModel>} endsWith
 * _Alias for `.like("%" + value)`_  
 */

/**
 * @typedef {object} IWhereBuilderInternal
 * @prop {() => IWhereConditionIterator} iterator
 * Returns an Iterator object that can be used to iterate over all the conditions that were added to this where builder.
 */

/**
 * @template TTableModel
 * @template {keyof TTableModel} TColumn
 * @template [TBaseModel=TTableModel]
 * @typedef {IWhereBuilderExternal<TTableModel, TColumn, TBaseModel> & IWhereBuilderInternal} IWhereBuilder
 */

/**
 * Assists in building a WHERE clause.
 * @template {object} TTableModel Table model that the WHERE clause is being built for.
 * @template {keyof TTableModel} TColumn Initial column type for when the WhereBuilder is created.
 * @template {object} [TBaseModel=TTableModel] Used to keep track of the original model when nesting conditions.
 * @implements {IWhereBuilder<TTableModel, TColumn, TBaseModel>}
 */
export class WhereBuilder {
    /** @private @type {WhereClausePropertyArray} */ _conditions; // not marked with # because it needs access to other objects from within.
    /** @type {WhereClauseProperty} */ #current;
    /** @type {boolean} */ #negated;
    /** @type {KinshipBase} */ #kinshipBase;

    /**
     * @param {KinshipBase} kinshipBase
     * @param {keyof TBaseModel} column 
     * @param {string} table
     * @param {WhereChain} chain
     */
    constructor(kinshipBase, column, table, chain = "WHERE") {
        // @ts-ignore
        this.#current = { chain, property: column, table }
        this.#kinshipBase = kinshipBase;
        this.#negated = chain.endsWith('NOT');
        //@ts-ignore This will only have the first argument once the condition function is called.
        this._conditions = [];
    }

    // Public functions

    /** @type {IWhereBuilder<TTableModel, TColumn, TBaseModel>['not']} */
    get not() {
        this.#current.chain += " NOT";
        this.#negated = true;
        return /** @type {any} */ (this);
    }

    /** @type {IWhereBuilder<TTableModel, TColumn, TBaseModel>['equals']} */
    equals(value) {
        this.#current.value = this.#getValue(value);
        this.#current.operator = WhereOperator.EQUALS;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is not equal to the value specified.
     * @type {Condition<TTableModel, TColumn, TBaseModel>} 
     */
    notEquals(value) {
        this.#current.value = this.#getValue(value);
        this.#current.operator = WhereOperator.NOT_EQUALS;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is less than the value specified.
     * @type {Condition<TTableModel, TColumn, TBaseModel>} 
     */
    lessThan(value) {
        this.#current.value = this.#getValue(value);
        this.#current.operator = WhereOperator.LESS_THAN;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is less than or equal to the value specified.
     * @type {Condition<TTableModel, TColumn, TBaseModel>} 
     */
    lessThanOrEqualTo(value) {
        this.#current.value = this.#getValue(value);
        this.#current.operator = WhereOperator.LESS_THAN_OR_EQUAL_TO;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is greater than the value specified.
     * @type {Condition<TTableModel, TColumn, TBaseModel>} 
     */
    greaterThan(value) {
        this.#current.value = this.#getValue(value);
        this.#current.operator = WhereOperator.GREATER_THAN;
        this.#insert();
        return this.#chain();
    }

    /** @type {IWhereBuilder<TTableModel, TColumn, TBaseModel>['greaterThanOrEqualTo']} */
    greaterThanOrEqualTo(value) {
        this.#current.value = this.#getValue(value);
        this.#current.operator = WhereOperator.GREATER_THAN_OR_EQUAL_TO;
        this.#insert();
        return this.#chain();
    }

    /** @type {IWhereBuilder<TTableModel, TColumn, TBaseModel>['between']} */
    between(value1, value2) {
        if (typeof value1 !== "number") throw new KinshipInvalidPropertyTypeError(value1, "number");
        if (typeof value2 !== "number") throw new KinshipInvalidPropertyTypeError(value2, "number");
        this.#current.value = [
            /** @type {any} */ (value1) instanceof Date ? this.#kinshipBase.adapter.syntax.dateString(value1) : value1,
            /** @type {any} */ (value2) instanceof Date ? this.#kinshipBase.adapter.syntax.dateString(value2) : value2
        ];
        this.#current.operator = WhereOperator.BETWEEN;
        this.#insert();
        return this.#chain();
    }

    /** @type {IWhereBuilder<TTableModel, TColumn, TBaseModel>['in']} */
    in(values) {
        this.#current.value = /** @type {DataType[]} */ (
            values.map(value => /** @type {any} */ (value) instanceof Date 
                ? this.#kinshipBase.adapter.syntax.dateString(value) 
                : value
            )
        );
        this.#current.operator = WhereOperator.IN;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column, as a string, is like, by SQL's LIKE command syntax, the value specified.
     * This operation is case insensitive.
     * @param {TTableModel[TColumn] extends string|undefined ? string : never} value
     * String value to check where the column is like.
     * @returns {Chain<TBaseModel>} A group of methods for optional chaining of conditions.
     */
    like(value) {
        this.#current.value = value;
        this.#current.operator = WhereOperator.LIKE;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column, as a string, contains the value specified.
     * This operation is case insensitive.
     * @param {TTableModel[TColumn] extends string|undefined ? string : never} value
     * String value to check where the column contains.
     * @returns {Chain<TBaseModel>} A group of methods for optional chaining of conditions.
     */
    contains(value) {
        this.#current.value = `%${value}%`;
        this.#current.operator = WhereOperator.LIKE;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column, as a string, contains the value specified.
     * This operation is case insensitive.
     * @param {TTableModel[TColumn] extends string|undefined ? string : never} value
     * String value to check where the column contains.
     * @returns {Chain<TBaseModel>} A group of methods for optional chaining of conditions.
     */
    startsWith(value) {
        this.#current.value = `${value}%`;
        this.#current.operator = WhereOperator.LIKE;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column, as a string, contains the value specified.
     * This operation is case insensitive.
     * @param {TTableModel[TColumn] extends string|undefined ? string : never} value
     * String value to check where the column contains.
     * @returns {Chain<TBaseModel>} A group of methods for optional chaining of conditions.
     */
    endsWith(value) {
        this.#current.value = `%${value}`;
        this.#current.operator = WhereOperator.LIKE;
        this.#insert();
        return this.#chain();
    }

    // Private functions

    /**
     * To be used within `KinshipContext` only.
     * @private
     * @returns {WhereClausePropertyArray}
     */
    _getConditions() {
        return this._conditions;
    }

    /**
     * To be used within `KinshipContext` only.
     * @private
     * @param {keyof TBaseModel} column
     * @param {string} table
     * @param {WhereChain} chain
     * @returns {this}
     */
    _append(column, table=this.#kinshipBase.tableName, chain = WhereChain.WHERE) {
        // @ts-ignore
        this.#current = { table, chain, property: column };
        this.#negated = chain.endsWith('NOT');
        return this;
    }

    /**
     * @private
     * @returns {WhereBuilder<any,any>}
     */
    _clone() {
        const where = new WhereBuilder(
            this.#kinshipBase, 
            this.#current.property, 
            this.#current.table, 
            this.#current.chain
        );
        where._conditions = this._conditions;
        return where;
    }

    /**
     * Chains a ConditionConfig
     * @returns {Chain<TBaseModel>}
     */
    #chain() {
        return new Proxy({
            and: (modelCallback) => {
                const wb = modelCallback(this.#newProxy(WhereChain.AND, this.#kinshipBase.tableName));
                this._conditions = [...this._conditions, wb._conditions.length > 1 ? wb._conditions : wb._conditions[0]];
                return this.#chain();
            },
            or: (modelCallback) => {
                const wb = modelCallback(this.#newProxy(WhereChain.OR, this.#kinshipBase.tableName));
                this._conditions = [...this._conditions, wb._conditions.length > 1 ? wb._conditions : wb._conditions[0]];
                return this.#chain();
            }
        }, {
            get: (t, p, r) => {
                if (String(p) === "_conditions") {
                    return this._conditions;
                }
                if (String(p) !== "and" && String(p) !== "or") {
                    throw new KinshipSyntaxError(`You can only chain WHERE conditions with 'AND' or 'OR'. ("${String(p)}")`);
                }
                return t[p];
            }
        });
    }

    
    /**
     * Checks to see if the value is a Date, if so, then will use the Adapter's dateString syntax to convert it. 
     * Otherwise returns the value.
     * @param {TTableModel[TColumn] | null} value
     */
    #getValue(value) {
        return /** @type {DataType} */ (
            value instanceof Date
                ? this.#kinshipBase.adapter.syntax.dateString(value)
                : value
        );
    }

    /**
     * Inserts the object, if it has all of the required properties to build a WHERE conditional.
     */
    #insert() {
        if ("chain" in this.#current
            && "property" in this.#current
            && "value" in this.#current
            && "operator" in this.#current
            && "table" in this.#current
        ) {
            // for values of null, then we convert the operator to "IS" or "IS NOT"
            if (this.#current.value == null) {
                if (this.#current.operator == "=") {
                    this.#current.operator = "IS";
                }
                if (this.#current.operator == "<>") {
                    this.#current.operator = "IS NOT";
                }
            }
            this._conditions = [...this._conditions, this.#current];
            this.#current = /** @type {any} Cast as these properties will be filled in. */ ({});
        } else {
            throw Error('Something went wrong when building the WHERE clause. If you see this, report it as an issue.');
        }
    }

    /**
     * Create a new proxy that is used for property de-referencing in the `.and()` or `.or()` function.
     * @param {WhereChain} chain 
     * Type of chaining that is used (AND, OR, AND NOT, OR NOT, WHERE, WHERE NOT)
     * @param {string} table 
     * @param {Relationships<any>} relationships 
     * @param {Record<string, SchemaColumnDefinition>} schema 
     * @param {string} realTableName 
     */
    #newProxy(chain,
        table = this.#kinshipBase.tableName, 
        relationships = this.#kinshipBase.relationships, 
        schema = this.#kinshipBase.schema, 
        realTableName = this.#kinshipBase.tableName
    ) {
        return new Proxy(/** @type {any} */({}), {
            get: (t, p, r) => {
                if (typeof p === "symbol") throw new KinshipInvalidPropertyTypeError(p);
                if (p in relationships) {
                    return this.#newProxy(chain,
                        relationships[p].alias, 
                        relationships[p].relationships, 
                        relationships[p].schema, 
                        relationships[p].table
                    );
                }
                if (!(p in schema)) throw new KinshipColumnDoesNotExistError(p, realTableName);
                return new WhereBuilder(this.#kinshipBase, p, table, chain);
            }
        });
    }

    iterator() {
        /** @type {WhereClausePropertyArray} */
        let conditions = [...this._getConditions()];
        return {
            next: () => {
                const value = conditions.pop();
                if(!value) {
                    return undefined;
                }
                if(Array.isArray(value)) {
                    conditions = value;
                    return {
                        nest: true,
                        value: value[0]
                    };
                }
                return {
                    nest: false,
                    value: value
                }
            }
        }
    }

    // Synonyms

    /**
     * Synonym of `.equals()`.
     * @type {Condition<TTableModel, TColumn, TBaseModel>}
     */
    eq = this.equals;
    /**
     * Synonym of `.notEquals()`.
     * @type {Condition<TTableModel, TColumn, TBaseModel>}
     */
    neq = this.notEquals;
    /**
     * Synonym of `.lessThan()`.
     * @type {Condition<TTableModel, TColumn, TBaseModel>}
     */
    lt = this.lessThan;
    /**
     * Synonym of `.lessThanOrEqualTo()`.
     * @type {Condition<TTableModel, TColumn, TBaseModel>}
     */
    lteq = this.lessThanOrEqualTo;
    /**
     * Synonym of `.greaterThan()`.
     * @type {Condition<TTableModel, TColumn, TBaseModel>}
     */
    gt = this.greaterThan;
    /**
     * Synonym of `.greaterThanOrEqualTo()`.
     * @type {Condition<TTableModel, TColumn, TBaseModel>}
     */
    gteq = this.greaterThanOrEqualTo;
}

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