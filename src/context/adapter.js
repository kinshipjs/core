//@ts-check

import { KinshipAdapterError, KinshipNonUniqueKeyError } from "../exceptions.js";

/**
 * Data passed for the scope of the custom adapter to help serialize a query command.
 * @typedef {object} SerializationQueryHandlerData
 * @prop {import("../clauses/where.js").WhereClausePropertyArray=} where
 * Recursively nested array of objects where each object represents a condition.  
 * If the element is an array, then that means the condition is nested with the last element from that array.  
 * If undefined, then no `WHERE` clause was given.
 * @prop {number=} limit
 * Number representing the number of records to grab.  
 * If undefined, then no `LIMIT` clause was given.
 * @prop {number=} offset
 * Number representing the number of records to skip before grabbing.  
 * If undefined, then no `OFFSET` clause was given.
 * @prop {import("../clauses/order-by.js").SortByClauseProperty[]=} order_by
 * Array of objects where each object represents a column to order by.  
 * If undefined, then no `ORDER BY` clause was given.
 * @prop {import("../clauses/group-by.js").GroupByClauseProperty[]=} group_by
 * Array of objects where each object represents a column to group by.  
 * If undefined, then no `GROUP BY` clause was given.
 * @prop {import("../clauses/choose.js").SelectClauseProperty[]} select
 * Array of objects where each object represents a column to select.
 * @prop {[import("../config/relationships.js").MainTableFromClauseProperty, ...import("../config/relationships.js").FromClauseProperty[]]} from
 * Array of objects where each object represents a table to join on.  
 * The first object will represent the main table the context is connected to. 
 */

/**
 * Data passed for the scope of the custom adapter to help serialize an insert command.
 * @typedef {object} SerializationInsertHandlerData
 * @prop {string} table
 * @prop {string[]} columns
 * @prop {ExecutionArgument[][]} values
 */

/**
 * Object model type for data used in explicit update transactions.
 * @typedef {object} SerializationUpdateHandlerExplicitData
 * @prop {ExecutionArgument} values Used in an `explicit transaction`.  
 * Object representing what columns will be updated from the command.  
 * If this is undefined, then `objects` should be used.
 */

/**
 * Object model type for data used in implicit update transactions.
 * @typedef {object} SerializationUpdateHandlerImplicitData
 * @prop {object[]} objects Used in an `implicit transaction`.  
 * Array of objects that represent the table in the context that should be updated from the command.
 * If this is undefined, then `updateObject` should be used.  
 * __NOTE: If the table has an identity key, then the primary key will be stripped out before being passed into the execution handler function.__
 * @prop {string[]} primaryKeys
 * Primary key of the table.
 */

/**
 * Data passed for the scope of the custom adapter to help serialize an update command.
 * @typedef {object} SerializationUpdateHandlerData
 * @prop {string} table
 * Table the update is occurring on.
 * @prop {string[]} columns
 * Columns to be updated.  
 * @prop {import("../clauses/where.js").WhereClausePropertyArray} where
 * Recursively nested array of objects where each object represents a condition.  
 * If the element is an array, then that means the condition is nested with the last element from that array.
 * @prop {SerializationUpdateHandlerExplicitData=} explicit
 * @prop {SerializationUpdateHandlerImplicitData=} implicit
 */

/**
 * Data passed for the scope of the custom adapter to help serialize a delete command.
 * @typedef {object} SerializationDeleteHandlerData
 * @prop {string} table
 * Table the delete is occurring on.
 * @prop {import("../clauses/where.js").WhereClausePropertyArray=} where
 * Recursively nested array of objects where each object represents a condition.  
 * If the element is an array, then that means the condition is nested with the last element from that array.
 */

/**
 * Data passed for the scope of the custom adapter to help serialize a delete command.
 * @typedef {object} SerializationTruncateHandlerData
 * @prop {string} table
 * Recursively nested array of objects where each object represents a condition.  
 * If the element is an array, then that means the condition is nested with the last element from that array.
 */

/**
 * An argument that is to be passed alongside a command to fill in sanitized values.
 * @typedef {import("../models/types.js").DataType} ExecutionArgument
 */

/**
 * Various handlers to handle serialization for a command and the command's corresponding arguments for a given database language.
 * @typedef {object} SerializationHandlers
 * @prop {(data: SerializationQueryHandlerData) => { cmd: string, args: ExecutionArgument[] }} forQuery
 * Handles serialization of a query command and its arguments so it appropriately works for the given database connector.
 * @prop {(data: SerializationInsertHandlerData) => { cmd: string, args: ExecutionArgument[] }} forInsert
 * Handles serialization of a insert command and its arguments so it appropriately works for the given database connector.
 * @prop {(data: SerializationUpdateHandlerData) => { cmd: string, args: ExecutionArgument[] }} forUpdate
 * Handles serialization of a update command and its arguments so it appropriately works for the given database connector.
 * @prop {(data: SerializationDeleteHandlerData) => { cmd: string, args: ExecutionArgument[] }} forDelete
 * Handles serialization of a delete command and its arguments so it appropriately works for the given database connector.
 * @prop {(data: SerializationTruncateHandlerData) => { cmd: string, args: ExecutionArgument[] }} forTruncate
 * Handles serialization of a truncate command and its arguments so it appropriately works for the given database connector.
 * @prop {(table: string) => { cmd: string, args: ExecutionArgument[] }} forDescribe
 * Handles serialization of a describe command and its arguments so it appropriately works for the given database connector.
 */

/**
 * Various handlers to handle execution of a command and the command's corresponding arguments for a given database language.
 * @typedef {object} ExecutionHandlers
 * @prop {(cmd: string, args: ExecutionArgument[]) => import("../models/maybe.js").MaybePromise<any[]>} forQuery
 * Handles execution of a query command, given the command string and respective arguments for the command string.  
 * This should return an array of objects where each object represents the row returned from the query.
 * @prop {(cmd: string, args: ExecutionArgument[]) => import("../models/maybe.js").MaybePromise<number[]>} forInsert
 * Handles execution of an insert command, given the command string and respective arguments for the command string.  
 * This should return an array of numbers, where each number represents a table's primary key's auto incremented number (if applicable)  
 * This array should be parallel with the array of records that were serialized in the `serialize(...).forInsert()` function.
 * @prop {(cmd: string, args: ExecutionArgument[]) => import("../models/maybe.js").MaybePromise<number>} forUpdate
 * Handles execution of an update command, given the command string and respective arguments for the command string.  
 * This should return a number representing the total number of rows affected from the command.
 * @prop {(cmd: string, args: ExecutionArgument[]) => import("../models/maybe.js").MaybePromise<number>} forDelete
 * Handles execution of a delete command, given the command string and respective arguments for the command string.  
 * This should return a number representing the total number of rows affected from the command.
 * @prop {(cmd: string, args: ExecutionArgument[]) => import("../models/maybe.js").MaybePromise<number>} forTruncate
 * Handles execution of a truncate command, given the command string and respective arguments for the command string.  
 * This should return a number representing the total number of rows affected from the command.
 * @prop {(cmd: string, args: ExecutionArgument[]) => import("../models/maybe.js").MaybePromise<{[fieldName: string]: SchemaColumnDefinition}>} forDescribe
 * Handles execution of a describe command, given the command string and respective arguments for the command string.
 * This should return an object containing {@link DescribedSchema} objects. 
 * @prop {() => import("../models/maybe.js").MaybePromise<void>} forTransactionBegin
 * Begins a transaction, where each transactional function (e.g., `insert`, `delete`, `update`) will be called
 * in conjunction of eachother, meaning that if one fails, all will fail.  
 * @prop {() => import("../models/maybe.js").MaybePromise<void>} forTransactionEnd
 * Begins a transaction, where each transactional function (e.g., `insert`, `delete`, `update`) will be called
 * in conjunction of eachother, meaning that if one fails, all will fail.  
 */

/** 
 * Scope passed into the Adapter for usage within any of the execute functions.
 * @typedef {object} AdapterScope
 * @prop {(message: string) => KinshipAdapterError} KinshipAdapterError  
 * Throw an error if it is an unexpected error that occurs within the custom adapter.
 * @prop {typeof ErrorTypes} ErrorTypes
 * Situationally create new WHERE clause conditions.
 */

/**
 * Various syntactical functions that are used to help serialize the command for a given database language.
 * @typedef {object} AdapterSyntax
 * @prop {(date: Date) => string} dateString
 * Conversion function of a JavaScript date to a respective valid string date.
 */

/**
 * Various syntactical functions meant for handling aggregate strings for a given database language.
 * @typedef {object} AdapterAggregates
 * @prop {(table: string, col: string) => string} avg
 * How a selected aggregate for average should appear in a query.
 * @prop {(table: string, col: string) => string} count
 * How a selected aggregate for distinct count should appear in a query.
 * @prop {(table: string, col: string) => string} min
 * How a selected aggregate for minimum value should appear in a query.
 * @prop {(table: string, col: string) => string} max
 * How a selected aggregate for maximum value should appear in a query.
 * @prop {(table: string, col: string) => string} sum
 * How a selected aggregate for sum of all values should appear in a query.
 * @prop {string} total
 * How a selected aggregate for a count of all records should appear in a query.
 */

/**
 * Object model type representing the requirements for an adapter to work with `Kinship`.
 * @typedef {object} KinshipAdapterConnection
 * @prop {AdapterAggregates} aggregates
 * Syntax for various aggregates used in the Database.
 * @prop {AdapterSyntax} syntax
 * Required functions in order to provide safe SQL serialization.
 * @prop {(scope: AdapterScope) => ExecutionHandlers} execute
 * Function that provides the {@link AdapterScope} `scope` and returns an object of various functions for {@link ExecutionHandlers}.
 * @prop {() => SerializationHandlers} serialize
 * Function that provides the {@link AdapterScope} `scope` and returns an object of various functions for {@link SerializationHandlers}.
 * @prop {(() => void)=} dispose
 * Function to dispose of any connections.
 * @prop {(() => Promise<void>)=} asyncDispose
 * Function to asynchronously dispose of any connections.
 */

/**
 * Callback for the initialization of the adapter connection for a specific database adapter.
 * @template T
 * Type of the expected argument that needs to be passed into the `adapter()` function that represents the connection to the source.
 * @callback InitializeAdapterCallback
 * @param {T} config
 * Configuration that belongs to `T` which initializes the connection to the database.
 * @returns {KinshipAdapterConnection}
 * Adapter configuration that is to be used within `Kinship`.
 */

/**
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

/** @enum {() => Error} */
export const ErrorTypes = {
    NonUniqueKey: () => new KinshipNonUniqueKeyError()
}