//@ts-check

const KinshipGithubURL = `https://github.com/kinshipjs/core`;

export class KinshipAdapterError extends Error {
    constructor(message) {
        super(message);
        this.name = `KinshipAdapterError`;
    }
}

export class KinshipOptionsError extends Error {
    constructor(message) {
        super(message);
        this.name = `KinshipOptionsError`;
    }
}

export class KinshipSyntaxError extends Error {
    /** @type {Error} */ originalError;
    /**
     * @param {string} message 
     */
    constructor(message) {
        super(message);
        this.name = "KinshipSyntaxError";
    }
}

export class KinshipInternalError extends Error {
    constructor() {
        super(`An internal error has occurred. Please submit this as an issue on GitHub. (${KinshipGithubURL})`);
        this.name = 'KinshipInternalError';
    }
}

export class KinshipInvalidArgumentError extends Error {
    constructor(arg) {
        super(`The argument, ${arg}, is an invalid argument.`);
        this.name = 'KinshipInvalidArgumentError';
    }
}

export class KinshipInvalidPropertyTypeError extends Error {
    /**
     * 
     * @param {any} arg 
     * @param {"string"|"number"} expectedType 
     */
    constructor(arg, expectedType="string") {
        super(`The property reference, ${String(arg)}, is of an invalid accessor type. (expected: ${expectedType}, actual: ${typeof arg})`);
        this.name = 'KinshipInvalidPropertyTypeError';
    }
}

export class KinshipColumnDoesNotExistError extends Error {
    constructor(col, table) {
        super(`The property, "${col}", does not exist as a column on the table, "${table}".`);
        this.name = 'KinshipColumnDoesNotExistError';
    }
}

export class KinshipNotImplementedError extends Error {
    constructor(message) {
        super(message);
        this.name = `KinshipNotImplementedError`;
    }
}

export class KinshipSafeDeleteModeEnabledError extends Error {
    constructor() {
        super(`An attempt to delete all records or truncate the context has been made. `
        + `If this was not a mistake, you can disable this setting within the constructor options by passing true into \`disableSafeDeleteMode\``);
        this.name = `KinshipSafeDeleteModeEnabledError`;
    }
}

export class KinshipSafeUpdateModeEnabledError extends Error {
    constructor() {
        super(`An attempt to update all records within the context has been made. `
        + `If this was not a mistake, you can disable this setting within the constructor options by passing true into \`disableSafeUpdateMode\``);
        this.name = `KinshipSafeUpdateModeEnabledError`;
    }
}

export class RollbackInvokedError extends Error {
    constructor(message) {
        super(`A rollback was manually invoked: ${message}`);
        this.name = `RollbackInvokedError`;
    }
}

/** Thrown when a database error occurs that can */
export class KinshipUnknownDBError extends Error {
    /**
     * @param {string} message 
     * @param {number} errCode 
     * @param {string} sqlMessage 
     */
    constructor(message, errCode, sqlMessage) {
        super(`${message} (Error Code: ${errCode}, Original Message: ${sqlMessage}) `);
        this.sqlMsg = sqlMessage;
        this.errCode = errCode;
        this.name = this.constructor.name;
    }
}

export class KinshipUnhandledDBError extends KinshipUnknownDBError {
    /**
     * @param {string} message
     * @param {number} errCode 
     * @param {string} sqlMessage 
     */
    constructor(message, errCode, sqlMessage) {
        super(message, errCode, sqlMessage);
    }
}

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

export class KinshipNonUniqueKeyError extends KinshipUnknownDBError {
    /**
     * @param {number} errCode 
     * @param {string} sqlMessage 
     */
    constructor(errCode, sqlMessage) {
        super(`An attempt to insert a duplicate key has occurred.`, errCode, sqlMessage);
    }
}

export class KinshipValueCannotBeNullError extends KinshipUnknownDBError {
    /**
     * @param {number} errCode 
     * @param {string} sqlMessage 
     */
    constructor(errCode, sqlMessage) {
        super(`One or more columns were attempted to be inserted/updated with a value of null.`, errCode, sqlMessage);
    }
}

export class KinshipUpdateConstraintError extends KinshipUnknownDBError {
    /**
     * @param {number} errCode 
     * @param {string} sqlMessage 
     */
    constructor(errCode, sqlMessage) {
        super(`An update failed because of a constraint.`, errCode, sqlMessage);
    }
}

export class KinshipDeleteConstraintError extends KinshipUnknownDBError {
    /**
     * @param {number} errCode 
     * @param {string} sqlMessage 
     */
    constructor(errCode, sqlMessage) {
        super(`A delete failed because of a constraint.`, errCode, sqlMessage);
    }
}