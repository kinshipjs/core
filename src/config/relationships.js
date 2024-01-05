//@ts-check

import { KinshipBase } from "../context/base.js";
import { KinshipInvalidPropertyTypeError, KinshipSyntaxError } from "../exceptions.js";

export class RelationshipBuilder {
    /** @type {KinshipBase} */ #base;

    /**
     * Creates a new RelationshipBuilder that assists with building relationships and using existing relationships to build including queries.
     * @param {KinshipBase} kinshipBase 
     */
    constructor(kinshipBase) {
        this.#base = kinshipBase;
    }
    
    /**
     * Configure a relationship using a callback.
     * @template {object} TTableModel
     * @param {import('../context/context.js').KinshipContext['_afterResync']} afterResync
     * Function that controls asynchronous tasks in the context.
     * @param {HasOneCallback<TTableModel>|HasManyCallback<TTableModel>} callback
     * Callback that was passed into `.hasOne()` or `.hasMany()` by the consumer of the library
     * @param {RelationshipType} relationshipType
     * Type of relationship. (OneToOne or OneToMany)
     * @param {string} table
     * Name of the table connected represented by the context.
     * @param {Relationships<any>} relationships
     * All relationships for the table that is represented by the content.
     * @param {string} prependTable
     * String that is used to help name the configuring relationship table.
     * @param {string} prependColumn
     * String that is used to help name each column from the configuring relationship table.
     */
    configureRelationship(afterResync,
        callback, 
        relationshipType, 
        table=this.#base.tableName, 
        relationships=this.#base.relationships, 
        prependTable=`${this.#base.tableName}_`, 
        prependColumn='',
    ) {
        /** @type {any} */
        const isPromise = callback(this.#newHasProxy(afterResync, table, relationships, prependTable, prependColumn, relationshipType));
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
        const clonedState = { 
            ...JSON.parse(JSON.stringify(oldState)), 
            where: oldState.where
                // @ts-ignore marked private for internal use only
                ?._clone() };
        callback(this.#newIncludeProxy(clonedState));
        return clonedState;
    }

    /**
     * With forwarded data from the proxy, configures the real table name for the table
     * that this relationship is configured with.
     * @template {object} TPrimaryModel
     * @template {import('../context/context.js').KinshipContext<TPrimaryModel>} TForeignContext
     * @param {import('../context/context.js').KinshipContext['_afterResync']} afterResync
     * @param {import('../context/context.js').KinshipContext<any, any>} context
     * @param {string} property
     * @param {string} thisTable
     * @param {string} prependTable
     * @param {string} prependColumn
     * @param {any} relationships
     * @param {RelationshipType} relationshipType
     * @param {(m: {[K in keyof OnlyDataTypes<TPrimaryModel>]-?: K & string}) => Required<keyof OnlyDataTypes<TPrimaryModel> & string>} pKeyCallback
     * @param {(m: {[K in keyof OnlyDataTypes<TForeignContext extends import('../context/context.js').KinshipContext<infer T, infer U> ? T : never>]-?: K & string}) => Required<keyof OnlyDataTypes<TForeignContext extends import('../context/context.js').KinshipContext<infer T, infer U> ? T : never> & string>} fKeyCallback 
     * @returns 
     */
    #from(afterResync,
        context,
        property,
        thisTable,
        prependTable, 
        prependColumn, 
        relationships, 
        relationshipType, 
        pKeyCallback, 
        fKeyCallback
    ) {
        /** @type {string=} */
        let pKey = undefined;
        /** @type {string=} */
        let fKey = undefined;
        const _pKey = pKeyCallback(new Proxy(/** @type {any} */ ({}), {
            get: (t,prop,r) => {
                if(typeof prop !== 'string') {
                    throw new KinshipInvalidPropertyTypeError(prop, 'string');
                }
                pKey = prop;
                return prop;
            }
        }));
        const _fKey = fKeyCallback(new Proxy(/** @type {any} */ ({}), {
            get: (t,prop,r) => {
                if(typeof prop !== 'string') {
                    throw new KinshipInvalidPropertyTypeError(prop, 'string');
                }
                fKey = prop;
                return prop;
            }
        }));

        // if there was no primary key or foreign key set inside the callback, and the return value is a string then correct them here.
        if(typeof _pKey === 'string' && !pKey) {
            pKey = _pKey;
        }
        if(typeof _fKey === 'string' && !fKey) {
            fKey = _fKey;
        }

        // if there is no pKey or no fKey, throw an error.
        if(!pKey || !fKey) {
            throw new KinshipSyntaxError(`No primary or foreign key detected. (received: { pKey: ${pKey}, fKey: ${fKey} })`);
        }
        return this.#withKeys(afterResync,
            thisTable,
            prependTable,
            prependColumn,
            relationships,
            relationshipType,
            property,
            //@ts-ignore Exists but is marked private to hide from regular consumers of this library
            context.__table,
            pKey,
            fKey,
            context
        );
    }

    /**
     * With forwarded data from the proxy, configures the real table name for the table
     * that this relationship is configured with.
     * @param {import('../context/context.js').KinshipContext['_afterResync']} afterResync
     * @param {string} table
     * @param {string} prependTable
     * @param {string} prependColumn
     * @param {any} relationships
     * @param {RelationshipType} relationshipType
     * @param {string} codeTableName 
     * @param {string} realTableName 
     * @returns 
     */
    #fromTable(afterResync,
        table,
        prependTable, 
        prependColumn, 
        relationships, 
        relationshipType, 
        codeTableName, 
        realTableName
    ) {
        return {
            withKeys: (primaryKey, foreignKey) => this.#withKeys(afterResync,
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
     * @param {import('../context/context.js').KinshipContext['_afterResync']} afterResync
     * @param {string} table
     * @param {string} prependTable
     * @param {string} prependColumn
     * @param {any} relationships
     * @param {RelationshipType} relationshipType
     * @param {string} codeTableName 
     * @param {string} realTableName 
     * @param {string} primaryKey 
     * @param {string} foreignKey 
     * @param {import('../context/context.js').KinshipContext<any, any>|null} context
     * @returns {AndThatHasCallbacks<TTableModel>}
     */
    #withKeys(afterResync,
        table,
        prependTable, 
        prependColumn, 
        relationships, 
        relationshipType, 
        codeTableName, 
        realTableName, 
        primaryKey, 
        foreignKey,
        context=null
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
        afterResync(async (oldState) => {
            const schema = await this.#base.describe(realTableName);
            for(const key in schema) {
                schema[key].table = relationships[codeTableName].alias;
                schema[key].commandAlias = `${prependColumn}${codeTableName}<|${schema[key].field}`;
            }
            relationships[codeTableName].schema = schema;
            if(context) {
                relationships[codeTableName].relationships = await context
                    //@ts-ignore Exists but is marked private to hide from regular consumers of this library
                    .__relationships;
            }
            return oldState;
        });
        return this.#andThat(afterResync, prependTable, prependColumn, relationships, codeTableName, realTableName);
    };

    /**
     * With forwarded data from the proxy, finishes the configuration for the table
     * by calling a describe on the database to receive the schema, as well as saving all data to the `KinshipBase`.
     * @template {object} TTableModel
     * @param {import('../context/context.js').KinshipContext['_afterResync']} afterResync
     * @param {string} prependTable
     * @param {string} prependColumn
     * @param {any} relationships
     * @param {string} codeTableName 
     * @param {string} realTableName 
     * @returns {AndThatHasCallbacks<TTableModel>}
     */
    #andThat(afterResync,
        prependTable, 
        prependColumn, 
        relationships, 
        codeTableName, 
        realTableName, 
    ) {
        const andThat = {
            andThatHasOne: ( 
                callback
            ) => 
            {
                /** @type {any} */
                const isPromise = this.configureRelationship(afterResync, 
                    callback, 
                    RelationshipType.OneToOne, 
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
                const isPromise = this.configureRelationship(afterResync, 
                    callback, 
                    RelationshipType.OneToMany, 
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
    }

    /**
     * @param {import('../context/context.js').KinshipContext['_afterResync']} afterResync
     * @param {RelationshipType} relationshipType
     * @param {string} table
     * @param {any} relationships
     * @param {string} prependTable
     * @param {string} prependColumn
     * @returns {any}
     */
    #newHasProxy(
        afterResync,
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
                    from: (ctx, pKeyCallback, fKeyCallback) => this.#from(afterResync,
                        ctx,
                        p,
                        table,
                        prependTable,
                        prependColumn,
                        relationships,
                        relationshipType,
                        pKeyCallback,
                        fKeyCallback    
                    ),
                    fromTable: (realTableName) => this.#fromTable(afterResync,
                        table,
                        prependTable,
                        prependColumn,
                        relationships,
                        relationshipType,
                        p, 
                        realTableName
                    ),
                    withKeys: (primaryKey, foreignKey) => this.#withKeys(afterResync,
                        table,
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

/** @enum {number} */
export const RelationshipType = {
    OneToOne: 1,
    OneToMany: 2
}

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
 *   [K in keyof OnlyTableTypes<T>]: import("../models/string.js").FriendlyType<Relationship<OnlyTableTypes<T>[K], IfTableArray<T[K], (typeof RelationshipType)['OneToOne'], (typeof RelationshipType)['OneToMany']>>>
 * }} Relationships
 */

/** Relationship  
 * 
 * Object model type representing a relationship between tables.
 * @template {object} T
 * @template {RelationshipType} [TType=RelationshipType]
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
 * @prop {{[K in keyof T]: import("../adapter.js").SchemaColumnDefinition}} schema
 * Various information about the table's columns.
 * @prop {Relationships<T>=} relationships
 * Further configured relationships that will be on this table.
 */

/** From
 * @template TPrimaryModel
 * @typedef {{
 *   from: <TForeignContext>(
 *      ctx: TForeignContext, 
 *      pKeyCallback: (m: {[K in keyof OnlyDataTypes<TPrimaryModel>]-?: K & string}) => Required<keyof OnlyDataTypes<TPrimaryModel> & string>,
 *      fKeyCallback: (m: {[K in keyof OnlyDataTypes<TForeignContext extends import('../context/context.js').KinshipContext<infer T, infer U> ? T : never>]-?: K & string}) => Required<keyof OnlyDataTypes<TForeignContext extends import('../context/context.js').KinshipContext<infer T, infer U> ? T : never> & string>
 * ) => AndThatHasCallbacks<TForeignContext extends import('../context/context.js').KinshipContext<infer T, infer U> ? T : never>
 * }} From
 */

/** FromTable  
 * 
 * Object containing the `.fromTable()` function for real table name as it appears in the database.
 * @template {object} TFrom
 * Relating table that is configuring the relationship.
 * @template {object} TTo
 * The table that is being configured as a relationship with.
 * @typedef {{ 
 *   fromTable: (realTableName: string) => WithKeys<TFrom, TTo> 
 * }} FromTable
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
 * @typedef {From<TFrom>
 *   & FromTable<TFrom, TTo>
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
 * @template {object} [TTableModel=any]
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
 *          : NonNullable<T[K]>
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
 * @typedef {{[K in keyof Required<T> as T[K] extends (object[]|undefined) ? K : never]-?: T[K] extends (infer R extends object)[]|undefined ? NonNullable<R> : never}} OnlyTableArrays
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