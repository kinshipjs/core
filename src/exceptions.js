//@ts-check

const KinshipGithubURL = `https://github.com/kinshipjs/core`;

/**
 * Thrown when an error occurrs within the adapter being used.
 */
export class KinshipAdapterError extends Error {
    /**
     * Create a `KinshipAdapterError`
     * @param {string} message
     * Message as to why the error occurred. 
     */
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

/** Thrown when invalid options were passed into the `KinshipContext`. */
export class KinshipOptionsError extends Error {
    /**
     * Create a `KinshipOptionsError`
     * @param {string} message
     * Message as to why the error occurred. 
     */
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

/** Thrown when syntax of the Kinship library was used inappropriately. (such as selecting a column that was not grouped on) */
export class KinshipSyntaxError extends Error {
    /** @type {Error} */ originalError;
    /**
     * Create a `KinshipSyntaxError`
     * @param {string} message
     * Message as to why the error occurred. 
     */
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

/** Thrown when an error occurred within the Kinship library. If this occurs, please report the issue to github. */
export class KinshipInternalError extends Error {
    constructor() {
        super(`An internal error has occurred. Please submit this as an issue on GitHub. (${KinshipGithubURL})`);
        this.name = this.constructor.name;
    }
}

/** Thrown when an invalid argument was passed.  */
export class KinshipInvalidArgumentError extends Error {
    /** @type {string} */
    argType;
    /** @type {any} */
    arg;
    /**
     * Create a `KinshipInvalidArgumentError`
     * @param {any} arg 
     * Argument that caused the error to occur.
     */
    constructor(arg) {
        super(`The argument, "${String(arg)}", is an invalid argument.`);
        this.name = this.constructor.name;
        this.arg = arg;
        this.argType = typeof arg;
    }
}

/** Thrown when an invalid argument was passed.  */
export class KinshipInvalidPropertyTypeError extends Error {
    /**
     * 
     * Create a `KinshipInvalidPropertyTypeError`
     * @param {any} arg 
     * @param {"string"|"number"} expectedType 
     */
    constructor(arg, expectedType="string") {
        super(`The property reference, "${String(arg)}", is of an invalid accessor type. (expected: ${expectedType}, actual: ${typeof arg})`);
        this.name = this.constructor.name;
    }
}

/** Thrown when an invalid property type de-referenced from a Kinship proxy.  */
export class KinshipColumnDoesNotExistError extends Error {
    /**
     * Create a `KinshipColumnDoesNotExistError`
     * @param {string} col Property accessed that caused the error 
     * @param {string} table Table that `col` was expected to be on.
     */
    constructor(col, table) {
        super(`The property, "${col}", does not exist as a column on the table, "${table}".`);
        this.name = this.constructor.name;
    }
}

/** Thrown when a feature in Kinship is not implemented.  */
export class KinshipNotImplementedError extends Error {
    /**
     * Create a `KinshipNotImplementedError`
     * @param {string} message Message containing info about what is not implemented. 
     */
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

/**
 * Thrown when a delete (truncate, specifically) occurs that would update all records in the table.
 */
export class KinshipSafeDeleteModeEnabledError extends Error {
    /**
     * Create a `KinshipSafeDeleteModeEnabledError`.
     */
    constructor() {
        super(`An attempt to delete all records or truncate the context has been made. `
        + `If this was not a mistake, you can disable this setting within the constructor options by passing true into \`disableSafeDeleteMode\``);
        this.name = this.constructor.name;
    }
}

/**
 * Thrown when an update occurs that would update all records in the table.
 */
export class KinshipSafeUpdateModeEnabledError extends Error {
    /**
     * Create a `KinshipSafeUpdateModeEnabledError`.
     */
    constructor() {
        super(`An attempt to update all records within the context has been made. `
        + `If this was not a mistake, you can disable this setting within the constructor options by passing true into \`disableSafeUpdateMode\``);
        this.name = this.constructor.name;
    }
}

/** 
 * Thrown when a rollback was manually invoked by the user.
 */
export class RollbackInvokedError extends Error {
    /**
     * Create a `RollbackInvokedError`
     * @param {string} message 
     * Message as to why a rollback was invoked.
     */
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

/** 
 * Thrown when a database error occurs that is unknown by the adapter.
 */
export class KinshipUnknownDBError extends Error {
    /**
     * Create a new `KinshipUnknownDBError`
     * @param {number} errCode 
     * Error code provided by the connection.
     * @param {string} sqlMessage 
     * Message provided by the connection.
     */
    constructor(message, errCode, sqlMessage) {
        super(`${message} (Error Code: ${errCode}, Original Message: ${sqlMessage}) `);
        this.sqlMsg = sqlMessage;
        this.errCode = errCode;
        this.name = this.constructor.name;
    }
}

/**
 * Thrown when a database error occurs and the adapter does not handle that specific error.
 */
export class KinshipUnhandledDBError extends KinshipUnknownDBError {
    /**
     * Create a new `KinshipUnhandledDBError`
     * @param {number} errCode 
     * Error code provided by the connection.
     * @param {string} sqlMessage 
     * Message provided by the connection.
     */
    constructor(message, errCode, sqlMessage) {
        super(message, errCode, sqlMessage);
    }
}

/**
 * Functions that throw specific errors and are to be thrown by the adapter.
 */
export const ErrorTypes = {
    /** @type {(errCode: number, sqlMessage: string) => KinshipNonUniqueKeyError} */
    NonUniqueKey: (errCode, sqlMessage) => new KinshipNonUniqueKeyError(errCode, sqlMessage),
    /** @type {(errCode: number, sqlMessage: string) => KinshipValueCannotBeNullError} */
    ValueCannotBeNull: (errCode, sqlMessage) => new KinshipValueCannotBeNullError(errCode, sqlMessage),
    /** @type {(errCode: number, sqlMessage: string) => KinshipUpdateConstraintError} */
    UpdateConstraintError: (errCode, sqlMessage) => new KinshipUpdateConstraintError(errCode, sqlMessage),
    /** @type {(errCode: number, sqlMessage: string) => KinshipDeleteConstraintError} */
    DeleteConstraintError: (errCode, sqlMessage) => new KinshipDeleteConstraintError(errCode, sqlMessage),
    /** @type {(message: string, errCode: number, sqlMessage: string) => KinshipUnhandledDBError} */
    UnhandledDBError: (message, errCode, sqlMessage) => new KinshipUnhandledDBError(message, errCode, sqlMessage),
    /** @type {(message: string, errCode: number, sqlMessage: string) => KinshipUnknownDBError} */
    UnknownDBError: (message, errCode, sqlMessage) => new KinshipUnknownDBError(message, errCode, sqlMessage),
}

/** @typedef {{[K in keyof ErrorTypes]: ErrorTypes[K]}} ErrorType */

/**
 * Thrown when a record is attempted to get inserted with primary key(s) are duplicates.
 */
export class KinshipNonUniqueKeyError extends KinshipUnknownDBError {
    /**
     * Create a new `KinshipNonUniqueKeyError`
     * @param {number} errCode 
     * Error code provided by the connection.
     * @param {string} sqlMessage 
     * Message provided by the connection.
     */
    constructor(errCode, sqlMessage) {
        super(`An attempt to insert a duplicate key has occurred.`, errCode, sqlMessage);
    }
}

/**
 * Thrown when a value is null when the defined column in the table does not allow nulls.
 */
export class KinshipValueCannotBeNullError extends KinshipUnknownDBError {
    /**
     * Create a new `KinshipValueCannotBeNullError`
     * @param {number} errCode 
     * Error code provided by the connection.
     * @param {string} sqlMessage 
     * Message provided by the connection.
     */
    constructor(errCode, sqlMessage) {
        super(`One or more columns were attempted to be inserted/updated with a value of null.`, errCode, sqlMessage);
    }
}

/**
 * Thrown when a constraint exists on a table and an attempt to update occurred without the handling the constraints first.
 */
export class KinshipUpdateConstraintError extends KinshipUnknownDBError {
    /**
     * Create a new `KinshipUpdateConstraintError`
     * @param {number} errCode 
     * Error code provided by the connection.
     * @param {string} sqlMessage 
     * Message provided by the connection.
     */
    constructor(errCode, sqlMessage) {
        super(`An update failed because of a constraint.`, errCode, sqlMessage);
    }
}

/**
 * Thrown when a constraint exists on a table and an attempt to delete occurred without the handling the constraints first.
 */
export class KinshipDeleteConstraintError extends KinshipUnknownDBError {
    /**
     * Create a new `KinshipDeleteConstraintError`
     * @param {number} errCode 
     * Error code provided by the connection.
     * @param {string} sqlMessage 
     * Message provided by the connection.
     */
    constructor(errCode, sqlMessage) {
        super(`A delete failed because of a constraint.`, errCode, sqlMessage);
    }
}