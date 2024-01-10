// @ts-check

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
 * Assists in building a WHERE clause.
 * @template {object} TTableModel import("../models/sql.js").Table model that the WHERE clause is being built for.
 * @template {keyof TTableModel} TColumn Initial column type for when the WhereBuilder is created.
 * @template {object} [TOriginalModel=TTableModel] Used to keep track of the original model when nesting conditions.
 */
export class WhereBuilder {
    /** @private @type {WhereClausePropertyArray} */ _conditions; // not marked with # because it needs access to other objects from within.
    /** @type {WhereClauseProperty} */ #current;
    /** @type {boolean} */ #negated;
    /** @type {KinshipBase} */ #kinshipBase;

    /**
     * @param {KinshipBase} kinshipBase
     * @param {keyof TOriginalModel} column 
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

    /**
     * Negate the next condition called.
     * @returns {this}
     */
    get not() {
        this.#current.chain += " NOT";
        this.#negated = true;
        return this;
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is equal to the value specified.
     * @type {Condition<TTableModel, TColumn, TOriginalModel>} 
     */
    equals(value) {
        this.#current.value = this.#getValue(value);
        this.#current.operator = WhereOperator.EQUALS;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is not equal to the value specified.
     * @type {Condition<TTableModel, TColumn, TOriginalModel>} 
     */
    notEquals(value) {
        this.#current.value = this.#getValue(value);
        this.#current.operator = WhereOperator.NOT_EQUALS;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is less than the value specified.
     * @type {Condition<TTableModel, TColumn, TOriginalModel>} 
     */
    lessThan(value) {
        this.#current.value = this.#getValue(value);
        this.#current.operator = WhereOperator.LESS_THAN;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is less than or equal to the value specified.
     * @type {Condition<TTableModel, TColumn, TOriginalModel>} 
     */
    lessThanOrEqualTo(value) {
        this.#current.value = this.#getValue(value);
        this.#current.operator = WhereOperator.LESS_THAN_OR_EQUAL_TO;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is greater than the value specified.
     * @type {Condition<TTableModel, TColumn, TOriginalModel>} 
     */
    greaterThan(value) {
        this.#current.value = this.#getValue(value);
        this.#current.operator = WhereOperator.GREATER_THAN;
        this.#insert();
        return this.#chain();
    }

    /** 
     * Adds a condition to the WHERE clause where if the specified column is greater than or equal to the value specified.
     * @type {Condition<TTableModel, TColumn, TOriginalModel>} 
     */
    greaterThanOrEqualTo(value) {
        this.#current.value = this.#getValue(value);
        this.#current.operator = WhereOperator.GREATER_THAN_OR_EQUAL_TO;
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is between two numbers.
     * @param {TTableModel[TColumn] extends number|undefined ? number : never} value1 
     * Lower range of the number to look between. (inclusive)
     * @param {TTableModel[TColumn] extends number|undefined ? number : never} value2
     * Upper range of the number to look between. (inclusive)
     * @returns {Chain<TOriginalModel>} A group of methods for optional chaining of conditions.
     */
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

    /**
     * Adds a condition to the WHERE clause where if the specified column contains any of the values specified.
     * @param {TTableModel[TColumn][]} values
     * Array of values to check if the column equals any of.
     * @returns {Chain<TOriginalModel>} A group of methods for optional chaining of conditions.
     */
    in(values) {
        this.#current.value = /** @type {import("../models/types.js").DataType[]} */ (
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
     * @returns {Chain<TOriginalModel>} A group of methods for optional chaining of conditions.
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
     * @returns {Chain<TOriginalModel>} A group of methods for optional chaining of conditions.
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
     * @returns {Chain<TOriginalModel>} A group of methods for optional chaining of conditions.
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
     * @returns {Chain<TOriginalModel>} A group of methods for optional chaining of conditions.
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
     * @param {keyof TOriginalModel} column
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
     * @returns {Chain<TOriginalModel>}
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
        return /** @type {import('../models/types.js').DataType} */ (
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
     * @param {import('../config/relationships.js').Relationships<any>} relationships 
     * @param {Record<string, import('../adapter.js').SchemaColumnDefinition>} schema 
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

    // Synonyms

    /**
     * Synonym of `.equals()`.
     * @type {Condition<TTableModel, TColumn, TOriginalModel>}
     */
    eq = this.equals;
    /**
     * Synonym of `.notEquals()`.
     * @type {Condition<TTableModel, TColumn, TOriginalModel>}
     */
    neq = this.notEquals;
    /**
     * Synonym of `.lessThan()`.
     * @type {Condition<TTableModel, TColumn, TOriginalModel>}
     */
    lt = this.lessThan;
    /**
     * Synonym of `.lessThanOrEqualTo()`.
     * @type {Condition<TTableModel, TColumn, TOriginalModel>}
     */
    lteq = this.lessThanOrEqualTo;
    /**
     * Synonym of `.greaterThan()`.
     * @type {Condition<TTableModel, TColumn, TOriginalModel>}
     */
    gt = this.greaterThan;
    /**
     * Synonym of `.greaterThanOrEqualTo()`.
     * @type {Condition<TTableModel, TColumn, TOriginalModel>}
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

/** @enum {string} */
export const WhereOperator = {
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
};

/**
 * @typedef {[WhereClauseProperty, ...(WhereClauseProperty|WhereClausePropertyArray)[]]} WhereClausePropertyArray 
 */

/**
 * @typedef {object} WhereClauseProperty
 * @prop {string} table
 * @prop {string} property
 * @prop {WhereChain} chain
 * @prop {import('../models/maybe.js').MaybeArray<import("../models/types.js").DataType|null>} value
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
 *   NonNullable<TTableModel[K]> extends import('../models/types.js').DataType
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