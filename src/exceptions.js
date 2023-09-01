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

export class KinshipConstraintError extends Error {
    constructor(message) {
        super(message);
        this.name = 'KinshipConstraintError';
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

/** @enum {(originalError: Error) => Error} */
export const ErrorTypes = {
    NonUniqueKey: (originalError) => new KinshipNonUniqueKeyError(originalError),
    NotSupported: (originalError) => new KinshipNotSupportedError(originalError),
    InsertedValueCannotBeNull: (originalError) => new KinshipInsertedValueCannotBeNullError(originalError),
    UpdatedValueCannotBeNull: (originalError) => new KinshipUpdatedValueCannotBeNullError(originalError),
    UpdateConstraintError: (originalError) => new KinshipUpdateConstraintError(originalError),
    DeleteConstraintError: (originalError) => new KinshipDeleteConstraintError(originalError),
}

export class KinshipNonUniqueKeyError extends Error {
    constructor(originalError) {
        super(`An attempt to insert a duplicate key has occurred.`);
        this.name = `KinshipNonUniqueKeyError`;
        this.originalError = originalError;
    }
}

export class KinshipNotSupportedError extends Error {
    constructor(originalError) {
        super(`This adapter does not support this use of this function.`);
        this.name = `KinshipNotSupportedError`;
        this.originalError = originalError;
    }
}

export class KinshipInsertedValueCannotBeNullError extends Error {
    constructor(originalError) {
        super(`One or more columns were attempted to be inserted while their value cannot be null.`);
        this.name = `KinshipValueCannotBeNullError`;
        this.originalError = originalError;
    }
}

export class KinshipUpdatedValueCannotBeNullError extends Error {
    constructor(originalError) {
        super(`One or more columns were attempted to be updated while their value cannot be null.`);
        this.name = `KinshipValueCannotBeNullError`;
        this.originalError = originalError;
    }
}

export class KinshipUpdateConstraintError extends Error {
    constructor(originalError) {
        super(`An update failed because of a constraint.`);
        this.name = `KinshipUpdateConstraintError`;
        this.originalError = originalError;
    }
}

export class KinshipDeleteConstraintError extends Error {
    constructor(originalError) {
        super(`A delete failed because of a constraint.`);
        this.name = `KinshipDeleteConstraintError`;
        this.originalError = originalError;
    }
}