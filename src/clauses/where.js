// @ts-check

import { KinshipBase } from '../context/base.js';
import { 
    KinshipColumnDoesNotExistError, 
    KinshipInvalidPropertyTypeError, 
    KinshipSyntaxError 
} from '../exceptions.js';

/**
 * Initializes the first parts of a WhereBuilder given the column name and table name.
 * @template {import("../models/sql.js").Table} TTableModel
 * @template {keyof TOriginalModel} TColumn
 * @template {import("../models/sql.js").Table} [TOriginalModel=TTableModel]
 * @param {KinshipBase} kinshipBase
 * @param {TColumn} column
 * @returns {WhereBuilder<TTableModel, TColumn, TOriginalModel>}
 */
export function Where(kinshipBase, column) {
    return new WhereBuilder(kinshipBase, column, "WHERE");
}

/**
 * Assists in building a WHERE clause.
 * @template {import("../models/sql.js").Table} TTableModel import("../models/sql.js").Table model that the WHERE clause is being built for.
 * @template {keyof TOriginalModel} TColumn Initial column type for when the WhereBuilder is created.
 * @template {import("../models/sql.js").Table} [TOriginalModel=TTableModel] Used to keep track of the original model when nesting conditions.
 */
export class WhereBuilder {
    /** @private @type {WhereClausePropertyArray} */ _conditions; // not marked with # because it needs access to other objects from within.
    /** @type {WhereClauseProperty} */ #current;
    /** @type {boolean} */ #negated;
    /** @type {KinshipBase} */ #kinshipBase;

    /**
     * @param {KinshipBase} kinshipBase
     * @param {keyof TOriginalModel} column 
     * @param {WhereChain} chain
     */
    constructor(kinshipBase, column, chain = "WHERE") {
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
     * @type {Condition<TOriginalModel, TColumn>} 
     */
    equals(value) {
        this.#current.value = /** @type {any} */ (value) instanceof Date ? this.#kinshipBase.adapter.syntax.dateString(value) : value;
        this.#current.operator = "=";
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is not equal to the value specified.
     * @type {Condition<TOriginalModel, TColumn>} 
     */
    notEquals(value) {
        this.#current.value = /** @type {any} */ (value) instanceof Date ? this.#kinshipBase.adapter.syntax.dateString(value) : value;
        this.#current.operator = "<>";
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is less than the value specified.
     * @type {Condition<TOriginalModel, TColumn>} 
     */
    lessThan(value) {
        this.#current.value = /** @type {any} */ (value) instanceof Date ? this.#kinshipBase.adapter.syntax.dateString(value) : value;
        this.#current.operator = "<";
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is less than or equal to the value specified.
     * @type {Condition<TOriginalModel, TColumn>} 
     */
    lessThanOrEqualTo(value) {
        this.#current.value = /** @type {any} */ (value) instanceof Date ? this.#kinshipBase.adapter.syntax.dateString(value) : value;
        this.#current.operator = "<=";
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is greater than the value specified.
     * @type {Condition<TOriginalModel, TColumn>} 
     */
    greaterThan(value) {
        this.#current.value = /** @type {any} */ (value) instanceof Date ? this.#kinshipBase.adapter.syntax.dateString(value) : value;
        this.#current.operator = ">";
        this.#insert();
        return this.#chain();
    }

    /** 
     * Adds a condition to the WHERE clause where if the specified column is greater than or equal to the value specified.
     * @type {Condition<TOriginalModel, TColumn>} 
     */
    greaterThanOrEqualTo(value) {
        this.#current.value = /** @type {any} */ (value) instanceof Date ? this.#kinshipBase.adapter.syntax.dateString(value) : value;
        this.#current.operator = ">=";
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column is between two numbers.
     * @param {TOriginalModel[TColumn] extends number ? number : never} value1 
     * Lower range of the number to look between. (inclusive)
     * @param {TOriginalModel[TColumn] extends number ? number : never} value2
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
        this.#current.operator = "BETWEEN";
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column contains any of the values specified.
     * @param {TOriginalModel[TColumn][]} values
     * Array of values to check if the column equals any of.
     * @returns {Chain<TOriginalModel>} A group of methods for optional chaining of conditions.
     */
    in(values) {
        this.#current.value = values.map(value => /** @type {any} */(value) instanceof Date ? this.#kinshipBase.adapter.syntax.dateString(value) : value);
        this.#current.operator = "IN";
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column, as a string, is like, by SQL's LIKE command syntax, the value specified.
     * This operation is case insensitive.
     * @param {TOriginalModel[TColumn] extends string ? string : never} value
     * String value to check where the column is like.
     * @returns {Chain<TOriginalModel>} A group of methods for optional chaining of conditions.
     */
    like(value) {
        this.#current.value = value;
        this.#current.operator = "LIKE";
        this.#insert();
        return this.#chain();
    }

    /**
     * Adds a condition to the WHERE clause where if the specified column, as a string, contains the value specified.
     * This operation is case insensitive.
     * @param {TOriginalModel[TColumn] extends string ? string : never} value
     * String value to check where the column contains.
     * @returns {Chain<TOriginalModel>} A group of methods for optional chaining of conditions.
     */
    contains(value) {
        this.#current.value = `%${value}%`;
        this.#current.operator = "LIKE";
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
     * @param {WhereChain} chain
     * @returns {this}
     */
    _append(column, chain = "WHERE") {
        // @ts-ignore
        this.#current = { table: this.#kinshipBase.tableName, chain, property: column };
        this.#negated = chain.endsWith('NOT');
        return this;
    }

    /**
     * @private
     * @returns {WhereBuilder<any,any>}
     */
    _clone() {
        const where = new WhereBuilder(this.#kinshipBase, this.#current.property, this.#current.chain);
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
                const newProxy = (table = this.#kinshipBase.tableName, relationships = this.#kinshipBase.relationships, schema = this.#kinshipBase.schema, realTableName = this.#kinshipBase.tableName) => new Proxy(/** @type {any} */({}), {
                    get: (t, p, r) => {
                        if (typeof p === "symbol") throw new KinshipInvalidPropertyTypeError(p);
                        if (p in relationships) {
                            return newProxy(relationships[p].alias, relationships[p].relationships, relationships[p].schema, relationships[p].table);
                        }
                        if (!(p in schema)) throw new KinshipColumnDoesNotExistError(p, realTableName);
                        return new WhereBuilder(this.#kinshipBase, p, "AND");
                    }
                });
                const wb = modelCallback(newProxy(this.#kinshipBase.tableName));
                // @ts-ignore ._conditions is private, and since this is in a lambda function, ts thinks we aren't in the WhereBuilder class.
                this._conditions = [...this._conditions, wb._conditions];
                return this.#chain();
            },
            or: (modelCallback) => {
                const newProxy = (table = this.#kinshipBase.tableName, relationships = this.#kinshipBase.relationships, schema = this.#kinshipBase.schema, realTableName = this.#kinshipBase.tableName) => new Proxy(/** @type {any} */({}), {
                    get: (t, p, r) => {
                        if (typeof p === "symbol") throw new KinshipInvalidPropertyTypeError(p);
                        if (p in relationships) {
                            return newProxy(relationships[p].alias, relationships[p].relationships, relationships[p].schema, relationships[p].table);
                        }
                        if (!(p in schema)) throw new KinshipColumnDoesNotExistError(p, realTableName);
                        return new WhereBuilder(this.#kinshipBase, p, "OR");
                    }
                });
                const wb = modelCallback(newProxy());
                // @ts-ignore ._conditions is private, and since this is in a lambda function, ts thinks we aren't in the WhereBuilder class.
                this._conditions = [...this._conditions, wb._conditions];
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
     * Inserts the object, if it has all of the required properties to build a WHERE conditional.
     */
    #insert() {
        if ("chain" in this.#current
            && "property" in this.#current
            && "value" in this.#current
            && "operator" in this.#current
            && "table" in this.#current) {
            if (this.#current.value == null) {
                if (this.#current.operator == "=") {
                    this.#current.operator = "IS";
                }
                if (this.#current.operator == "<>") {
                    this.#current.operator = "IS NOT";
                }
            }
            if (this.#negated) {
                if (this._conditions.length <= 0) {
                    //@ts-ignore
                    this._conditions = [...this._conditions, []];
                }
                //@ts-ignore
                this._conditions[0] = [...this._conditions[0], this.#current];
            } else {
                //@ts-ignore
                this._conditions = [...this._conditions, this.#current];
            }
            // @ts-ignore We don't care that the properties don't exist. They will be filled in, we just don't want the old values.
            this.#current = {};
        } else {
            throw Error('Something went wrong when building the WHERE clause. If you see this, report it as an issue.');
        }
    }

    // Synonyms

    /**
     * Synonym of `.equals()`.
     * @type {Condition<TOriginalModel, TColumn>}
     */
    eq = this.equals;
    /**
     * Synonym of `.notEquals()`.
     * @type {Condition<TOriginalModel, TColumn>}
     */
    neq = this.notEquals;
    /**
     * Synonym of `.lessThan()`.
     * @type {Condition<TOriginalModel, TColumn>}
     */
    lt = this.lessThan;
    /**
     * Synonym of `.lessThanOrEqualTo()`.
     * @type {Condition<TOriginalModel, TColumn>}
     */
    lteq = this.lessThanOrEqualTo;
    /**
     * Synonym of `.greaterThan()`.
     * @type {Condition<TOriginalModel, TColumn>}
     */
    gt = this.greaterThan;
    /**
     * Synonym of `.greaterThanOrEqualTo()`.
     * @type {Condition<TOriginalModel, TColumn>}
     */
    gteq = this.greaterThanOrEqualTo;
}

/** WhereChain  
 * @typedef {"WHERE"|"WHERE NOT"|"AND"|"AND NOT"|"OR"|"OR NOT"} WhereChain 
 */

/** WhereCondition  
 * @typedef {"="|"<>"|"<"|">"|"<="|">="|"IN"|"LIKE"|"IS"|"IS NOT"|"BETWEEN"} WhereCondition 
 */

/** WhereClausePropertyArray  
 * 
 * @typedef {[WhereClauseProperty, ...(WhereClauseProperty|WhereClausePropertyArray)[]]} WhereClausePropertyArray 
 */

/** WhereClauseProperty  
 * 
 * @typedef {object} WhereClauseProperty
 * @prop {string} table
 * @prop {string} property
 * @prop {WhereChain} chain
 * @prop {import('../models/maybe.js').MaybeArray<import('../models/sql.js').SQLPrimitive|null>} value
 * @prop {WhereCondition} operator
 */

/**
 * Object to chain AND and OR conditions onto a WHERE clause.
 * @template {import("../models/sql.js").Table} TTableModel
 * @template {import("../models/sql.js").Table} [TOriginalModel=TTableModel]
 * @typedef {Object} Chain
 * @prop {(modelCallback: ChainCallback<TTableModel, TOriginalModel>) => Chain<TTableModel, TOriginalModel>} and 
 * Apply an AND chain to your WHERE clause.
 * @prop {(modelCallback: ChainCallback<TTableModel, TOriginalModel>) => Chain<TTableModel, TOriginalModel>} or 
 * Apply an OR chain to your WHERE clause.
 */

/**
 * @template {import("../models/sql.js").Table} TTableModel
 * @template {import("../models/sql.js").Table} [TOriginalModel=TTableModel]
 * @callback ChainCallback
 * @param {ChainObject<TTableModel, TOriginalModel>} model
 * @returns {any}
 */

/**
 * @template {import("../models/sql.js").Table} TTableModel
 * @template {import("../models/sql.js").Table} [TOriginalModel=TTableModel]
 * @typedef {{[K in keyof Required<TTableModel>]: 
 *      TTableModel[K] extends import('../models/sql.js').SQLPrimitive|undefined 
 *          ? WhereBuilder<TOriginalModel, K & string>
 *          : TTableModel[K] extends (infer T extends import("../models/sql.js").Table)[]|undefined 
    *          ? ChainObject<Required<T>, TOriginalModel> 
    *          : TTableModel[K] extends import("../models/sql.js").Table|undefined 
    *              ? ChainObject<Exclude<TTableModel[K], undefined>, TOriginalModel> 
    *              : never}} ChainObject
 */

/**
 * Function definition for every type of condition to be created in a WHERE clause.
 * @template {import("../models/sql.js").Table} TTableModel
 * @template {keyof TTableModel} TColumn
 * @callback Condition
 * @param {undefined extends TTableModel[TColumn] ? TTableModel[TColumn]|null : TTableModel[TColumn]} value
 * Value of the same type of the column being worked on to check the condition against.
 * @returns {Chain<TTableModel>}
 * A group of methods for optional chaining of conditions.
 */

/** 
 * Function used to help initialize building a WHERE clause.
 * @template {import("../models/sql.js").Table} TTableModel 
 * @typedef {(m: {[K in keyof TTableModel]: WhereBuilder<TTableModel, K>}) => void} WhereBuilderFunction 
 */