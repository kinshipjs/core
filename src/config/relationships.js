//@ts-check

import { KinshipBase } from "../context/base.js";
import { KinshipInvalidPropertyTypeError, KinshipSyntaxError } from "../exceptions.js";

/** @enum {string} */
export const RelationshipType = {
    ONE_TO_ONE: "1:1",
    ONE_TO_MANY: "1:n"
}

export class RelationshipBuilder {
    /** @type {KinshipBase} */ #base;

    /**
     * 
     * @param {KinshipBase} kinshipBase 
     */
    constructor(kinshipBase) {
        this.#base = kinshipBase;
    }
    
    /**
     * Configure a relationship using a callback.
     * @template {object} TTableModel
     * @param {HasOneCallback<TTableModel>|HasManyCallback<TTableModel>} callback
     * @param {RelationshipType} relationshipType
     * @param {string} table
     * @param {any} relationships
     * @param {string} prependTable
     * @param {string} prependColumn
     */
    configureRelationship(callback, 
        relationshipType, 
        table=this.#base.tableName, 
        relationships=this.#base.relationships, 
        prependTable=`${this.#base.tableName}_`, 
        prependColumn='',
    ) {
        /** @type {any} */
        const isPromise = callback(this.#newProxy(table, relationships, prependTable, prependColumn, relationshipType));
        if(isPromise && "then" in isPromise && "catch" in isPromise) {
            throw new KinshipSyntaxError(`Callback must not be asynchronous.`);
        }
    }

    /**
     * Gets the state for an `.include()` call, given some callback.
     * @template {object} TTableModel
     * @param {import("../context/context.js").State} oldState
     * @param {(model: {[K in keyof import("./relationships.js").OnlyTableTypes<TTableModel>]: 
     *   import("./relationships.js").ThenIncludeCallback<
     *     import("./relationships.js").OnlyTableTypes<TTableModel>[K], K>
     *   }) => void} callback
     * @returns {import("../context/context.js").State}
     */
    getStateForInclude(oldState, callback) {
        callback(this.#newIncludeProxy(oldState));
        return oldState;
    }

    /**
     * With forwarded data from the proxy, configures the real table name for the table
     * that this relationship is configured with.
     * @param {string} table
     * @param {string} prependTable
     * @param {string} prependColumn
     * @param {any} relationships
     * @param {RelationshipType} relationshipType
     * @param {string} codeTableName 
     * @param {string} realTableName 
     * @returns 
     */
    #fromTable(table,
        prependTable, 
        prependColumn, 
        relationships, 
        relationshipType, 
        codeTableName, 
        realTableName, 
    ) {
        return {
            withKeys: (primaryKey, foreignKey) => this.#withKeys(
                table,
                prependTable,
                prependColumn,
                relationships,
                relationshipType,
                codeTableName, 
                realTableName, 
                primaryKey, 
                foreignKey
            )
        };
    }

    /**
     * With forwarded data from the proxy, finishes the configuration for the table
     * by calling a describe on the database to receive the schema, as well as saving all data to the `KinshipBase`.
     * @template {object} TTableModel
     * @param {string} table
     * @param {string} prependTable
     * @param {string} prependColumn
     * @param {any} relationships
     * @param {RelationshipType} relationshipType
     * @param {string} codeTableName 
     * @param {string} realTableName 
     * @param {string} primaryKey 
     * @param {string} foreignKey 
     * @returns {AndThatHasCallbacks<TTableModel>}
     */
    #withKeys(table,
        prependTable, 
        prependColumn, 
        relationships, 
        relationshipType, 
        codeTableName, 
        realTableName, 
        primaryKey, 
        foreignKey
    ) {
        relationships[codeTableName] = {
            relationshipType,
            table: realTableName,
            alias: `__${prependTable}${codeTableName}__`,
            primary: {
                table,
                column: primaryKey,
                alias: `${prependColumn}${primaryKey}`
            },
            foreign: {
                table: realTableName,
                column: foreignKey,
                alias: `${prependColumn}${codeTableName}<|${foreignKey}`
            },
            schema: {},
            relationships: {}
        };
        this.#base.afterResync(async (oldState) => {
            const schema = await this.#base.describe(realTableName);
            for(const key in schema) {
                schema[key].table = relationships[codeTableName].alias;
                schema[key].commandAlias = `${prependColumn}${codeTableName}<|${schema[key].field}`;
            }
            relationships[codeTableName].schema = schema;
            return oldState;
        });
        const andThat = {
            andThatHasOne: ( 
                callback
            ) => 
            {
                /** @type {any} */
                const isPromise = this.configureRelationship(callback, 
                    RelationshipType.ONE_TO_ONE, 
                    realTableName, 
                    relationships[codeTableName].relationships, 
                    `${prependTable}${codeTableName}_`, 
                    `${prependColumn}${codeTableName}<|`
                );
                if(isPromise && "then" in isPromise && "catch" in isPromise) {
                    throw new KinshipSyntaxError(`Callback must not be asynchrous.`);
                }
                return andThat;
            },
            andThatHasMany: ( 
                callback
            ) => 
            {
                /** @type {any} */
                const isPromise = this.configureRelationship(callback, 
                    RelationshipType.ONE_TO_MANY, 
                    realTableName, 
                    relationships[codeTableName].relationships, 
                    `${prependTable}${codeTableName}_`, 
                    `${prependColumn}${codeTableName}<|`
                );
                if(isPromise && "then" in isPromise && "catch" in isPromise) {
                    throw new KinshipSyntaxError(`Callback must not be asynchrous.`);
                }
                return andThat;
            }
        }
        return andThat;
    };

    /**
     * @param {RelationshipType} relationshipType
     * @param {string} table
     * @param {any} relationships
     * @param {string} prependTable
     * @param {string} prependColumn
     * @returns {any}
     */
    #newProxy(
        table, 
        relationships, 
        prependTable, 
        prependColumn, 
        relationshipType
    ) {
        return new Proxy(/** @type {any} */ ({}), {
            get: (t,p,r) => {
                if (typeof(p) === 'symbol') throw new KinshipInvalidPropertyTypeError(p);
                if (p in relationships) throw Error(`A relationship already exists for the table, "${p}"`);
                
                return {
                    fromTable: (realTableName) => this.#fromTable(table,
                        prependTable,
                        prependColumn,
                        relationships,
                        relationshipType,
                        p, 
                        realTableName
                    ),
                    withKeys: (primaryKey, foreignKey) => this.#withKeys(table,
                        prependTable,
                        prependColumn,
                        relationships,
                        relationshipType,
                        p, 
                        p, 
                        primaryKey, 
                        foreignKey
                    )
                }
            }
        })
    }

    /**
     * @param {import("../context/context.js").State} state 
     * @param {string} table 
     * @param {Relationships<any>} relationships 
     * @returns 
     */
    #newIncludeProxy(state, table=this.#base.tableName, relationships=this.#base.relationships) {
        return new Proxy(/** @type {any} */({}), {
            get: (t,p,r) => {
                if (typeof(p) === 'symbol') throw new KinshipInvalidPropertyTypeError(p);
                if (!this.#base.isRelationship(p, relationships)) throw Error(`The specified table, "${p}", does not have a configured relationship with "${table}".`);
                
                const pKey = relationships[p].primary;
                const fKey = relationships[p].foreign;
                const relatedTableAlias = relationships[p].alias;
                state.from.push({
                    realName: relationships[p].table,
                    alias: relatedTableAlias,
                    programmaticName: p,
                    refererTableKey: {
                        column: pKey.column,
                        alias: pKey.alias,
                        table
                    },
                    referenceTableKey: {
                        column: fKey.column,
                        alias: fKey.alias,
                        table: relatedTableAlias
                    }
                });
                state.select = state.select.concat(
                    this.#base.getAllSelectColumnsFromSchema(relationships[p].schema)
                );

                const thenInclude = {
                    thenInclude: (callback) => {
                        callback(this.#newIncludeProxy(state, relatedTableAlias, relationships[p].relationships));
                        return thenInclude;
                    }
                };
                return thenInclude;
            }
        });
    } 
}

/** DescribedSchema  
 * 
 * Object representing the schema of a column in a table.
 * @typedef {object} SchemaColumnDefinition
 * @prop {string} table
 * The name of the table this column belongs to.
 * @prop {string} field
 * The name of the column as it appears in the database.
 * @prop {string} alias
 * The name of the column as it will appear in the results.
 * @prop {string} commandAlias
 * The name of the column as it is used inside of commands. (this is handled within Kinship.)
 * @prop {boolean} isPrimary
 * Column is a primary key.
 * @prop {boolean} isIdentity
 * Column is an identity key. (automatically increments)
 * @prop {boolean} isVirtual
 * Column is virtually generated.
 * @prop {boolean} isNullable
 * Column is nullable within the database.
 * @prop {boolean} isUnique
 * Column is unique (primary keys can set this to true as well)
 * @prop {"string"|"int"|"float"|"boolean"|"date"} datatype
 * Column general type.
 * @prop {() => import("../models/types.js").DataType|undefined} defaultValue
 * Function that returns the value specified in the database schema for database generated values on inserts.
 */

/**
 * @template {object} T
 * @template TReturnIfTrue
 * @template {any} [TReturnIfFalse=never]
 * @typedef {NonNullable<T> extends (infer U extends object)[] ? TReturnIfTrue : TReturnIfFalse} IfTableArray
 */

/**
 * @template {object} T
 * @template TReturnIfTrue
 * @template {any} [TReturnIfFalse=never]
 * @typedef {NonNullable<T> extends object ? TReturnIfTrue : TReturnIfFalse} IfTableObject
 */

/**
 * @template {object} T
 * @typedef {{
 *   [K in keyof OnlyTableTypes<T>]: import("../models/string.js").FriendlyType<Relationship<OnlyTableTypes<T>[K], IfTableArray<T[K], "1:n", "1:1">>>
 * }} Relationships
 */

/** Relationship  
 * 
 * Object model type representing a relationship between tables.
 * @template {object} T
 * @template {"1:1"|"1:n"} [TType="1:1"]
 * Information regarding a relating table.
 * @typedef {object} Relationship
 * @prop {TType} relationshipType
 * Type of relationship this has.
 * @prop {string} table
 * Actual table name as it appears in the database.
 * @prop {string} alias
 * Alias given to this table for command serialization.
 * @prop {import('../context/base.js').Column} primary
 * Information on the key pointing to the original table that holds this relationship.
 * @prop {import('../context/base.js').Column} foreign 
 * Information on the key pointing to the related table. (this key comes from the same table that is specified by `table`)
 * @prop {{[K in keyof T]: SchemaColumnDefinition}} schema
 * Various information about the table's columns.
 * @prop {Relationships<T>=} relationships
 * Further configured relationships that will be on this table.
 */

/** From  
 * 
 * Object containing the `.fromTable()` function for real table name as it appears in the database.
 * @template {object} TFrom
 * Relating table that is configuring the relationship.
 * @template {object} TTo
 * The table that is being configured as a relationship with.
 * @typedef {{ 
 *   fromTable: (realTableName: string) => WithKeys<TFrom, TTo> 
 * }} From
 */

/** WithKeys  
 * 
 * Object containing the `.withKeys()` function for specifying both primary and foreign keys.
 * @template {object} TFrom
 * Relating table that is configuring the relationship.
 * @template {object} TTo
 * The table that is being configured as a relationship with.
 * @typedef {{ 
 *   withKeys: (primaryKey: keyof OnlyDataTypes<TFrom>, foreignKey: keyof OnlyDataTypes<TTo>) 
 *      => AndThatHasCallbacks<Required<TTo>>
 * }} WithKeys
 */

/** FromWithKeys  
 * 
 * An intersection of the 2 types, `From` and `WithKeys`.
 * @template {object} TFrom
 * Relating table that is configuring the relationship.
 * @template {object} TTo
 * The table that is being configured as a relationship with.
 * @typedef {From<TFrom, TTo>
 *   & WithKeys<TFrom, TTo>
 * } FromWithKeys
 */

/** AndThatHasCallbacks  
 * 
 * Object containing the functions, `.andThatHasOne()` and `.andThatHasMany()` to further configure deeper relationships.
 * @template {object} TTo
 * The table that is being configured as a relationship with.
 * @typedef {{ andThatHasOne: (callback: HasOneCallback<TTo>) => AndThatHasCallbacks<Required<TTo>>, andThatHasMany: (callback: HasManyCallback<Required<TTo>>) => AndThatHasCallbacks<TTo> }} AndThatHasCallbacks
 */

/** HasOneCallbackModel  
 * 
 * Model that is passed to the callback that the user provides which gives context to the tables to configure relationships with.
 * @template {object} TTableModel
 * Table model type that is being configured as a relationship.
 * @typedef {{[K in keyof OnlyTables<TTableModel>]: FromWithKeys<TTableModel, OnlyTables<TTableModel>[K]>}} HasOneCallbackModel
 */

/** HasOneCallback  
 * 
 * The callback template that is used by the user to configure one to one relationships.
 * @template {object} TTableModel
 * Table model type that is being configured as a relationship.
 * @callback HasOneCallback
 * @param {HasOneCallbackModel<TTableModel>} model
 * The model that provides context for the user to configure their relationships with.
 * @returns {void}
 */

/** HasManyCallbackModel  
 * 
 * Model that is passed to the callback that the user provides which gives context to the tables to configure relationships with.
 * @template {object} TTableModel
 * Table model type that is being configured as a relationship.
 * @typedef {{[K in keyof OnlyTableArrays<TTableModel>]: FromWithKeys<TTableModel, OnlyTableArrays<TTableModel>[K]>}} HasManyCallbackModel
 */

/** HasManyCallback  
 * 
 * The callback template that is used by the user to configure one to many relationships.
 * @template {object} TTableModel
 * Table model type that is being configured as a relationship.
 * @callback HasManyCallback
 * @param {HasManyCallbackModel<TTableModel>} model
 * The model that provides context for the user to configure their relationships with.
 * @returns {void}
 */

/** OnlyTables  
 * 
 * Filters out an object model type to only have keys that are valued with `object`s.
 * @template {object} T 
 * The abstract model to check properties for recursive `object`s.
 * @typedef {{[K in keyof Required<T> as T[K] extends import("../models/types.js").DataType|object[]|undefined
 *      ? never 
 *      : K
 *   ]-?: 
 *      T[K] extends import("../models/types.js").DataType|object[]|undefined 
 *          ? never 
 *          : T[K]
 * }} OnlyTables
 */

/** OnlyDataTypes  
 * 
 * Removes all keys where the value in `T` for that key is of type `object` or `object[]`
 * @template {object} T 
 * The abstract model to check properties for recursive `object`s.
 * @typedef {{[K in keyof T as T[K] extends import("../models/types.js").DataType|undefined 
 *      ? K 
 *      : never
 *   ]: T[K]
 * }} OnlyDataTypes
 */

/** OnlyTableArrays  
 * 
 * Filters out an object model type to only have keys that are valued with `object` arrays.
 * @template {object} T 
 * The abstract model to check properties for recursive `object`s.
 * @typedef {{[K in keyof Required<T> as T[K] extends (object[]|undefined) ? K : never]-?: T[K] extends (infer R extends object)[]|undefined ? Required<R> : never}} OnlyTableArrays
 */

/** OnlyTableTypes  
 * Filters out an object model type to only have keys that are valued with `object` or `object` arrays.
 * @template {object} T 
 * The abstract model to check properties for recursive `object`s.
 * @typedef {{[K in keyof (OnlyTables<T> & OnlyTableArrays<T>)]: (OnlyTables<T> & OnlyTableArrays<T>)[K]}} OnlyTableTypes
 */

/* -------------------------Include Types------------------------- */

/** IncludeClauseProperty  
 * 
 * Object to carry data tied to various information about a column being selected.
 * @typedef {FromClauseProperty} IncludeClauseProperty
 */

/** IncludedColumnsModel  
 * 
 * Model representing included columns on the table.
 * @template {object} TTableModel
 * @typedef {{[K in keyof OnlyTableTypes<TTableModel>]: IncludeClauseProperty}} IncludedColumnsModel
 */

/** ThenIncludeCallback  
 * 
 * @template {object} TTableModel
 * @template {string|symbol|number} TLastKey
 * @typedef {{ thenInclude: (model: IncludeCallback<TTableModel, TLastKey>) 
 *   => ThenIncludeCallback<TTableModel, TLastKey> 
 * }} ThenIncludeCallback
 */

/** IncludeCallback  
 * 
 * @template {object} TTableModel
 * @template {string|symbol|number} TLastKey
 * @typedef {(model: {[K in keyof OnlyTableTypes<TTableModel>]: ThenIncludeCallback<OnlyTableTypes<TTableModel>[K], K>}) 
 *   => void
 * } IncludeCallback
 */

/* -------------------------Table From Types------------------------- */

/** @typedef {[MainTableFromClauseProperty, ...FromClauseProperty[]]} FromClauseProperties */

/**
 * @typedef {object} FromClauseProperty
 * @prop {string} realName
 * Real name of the table  defined by the user in the database.
 * @prop {string} alias
 * Alias of the table, configured by Kinship.
 * @prop {string=} programmaticName
 * Name as the user has configured it.
 * @prop {import("../clauses/choose.js").SelectClauseProperty} refererTableKey
 * Information about the source table key.
 * @prop {import("../clauses/choose.js").SelectClauseProperty} referenceTableKey
 * Information about the reference table key.
 */

/**
 * @typedef {object} MainTableFromClauseProperty
 * @prop {string} realName
 * Real name of the table  defined by the user in the database.
 * @prop {string} alias
 * Alias of the table, configured by Kinship.
 * @prop {string=} programmaticName
 * Name as the user has configured it.
 */