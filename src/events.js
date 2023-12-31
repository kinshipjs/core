// @ts-check
import EventEmitter from "events";

/**
 * @typedef {object} SuccessEventDetail
 * @prop {string} cmd
 * @prop {any[]} args
 * @prop {any[]} results
 */

/**
 * @typedef {object} FailEventDetail
 * @prop {string=} cmd
 * @prop {any[]=} args
 * @prop {Error} err
 */

export class CommandListener extends EventEmitter {
    static _id = 0;
    
    /**
     * Creates a new EventEmitter tailored for logging Kinship commands.
     * @param {string} tableName 
     */
    constructor(tableName) {
        super();
        this.id = CommandListener._id++;
        this.tableName = tableName.toLowerCase();
        this.setMaxListeners(Infinity);
    }

    /**
     * Adds the listener function to the end of the listeners array for the event named `eventName`. No checks are made to see if the listener has already been added. 
     * Multiple calls passing the same combination of `eventName` and listener will result in the listener being added, and called, multiple times.
     * @param {string|symbol} event The name of the event.
     * @param {(...args: any[]) => void} callback The callback function
     * @returns {this} Reference to the EventEmitter, so that calls can be chained.
     */
    on(event, callback) {
        super.on(event, callback);
        return this;
    }

    /**
     * Synchronously calls each of the listeners registered for the event named `eventName`, in the order they were registered, passing the supplied arguments to each.
     *
     * Returns `true` if the event had listeners, `false` otherwise.
     * @param {string|symbol} event 
     * @param  {...any} args 
     * @returns {boolean}
     */
    emit(event, ...args) {
        let emitted = super.emit(event, ...args);
        return emitted;
    }

    /**
     * 
     * @param {string|symbol} event 
     * @param {SuccessEventDetail} detail 
     * @returns {boolean}
     */
    #emitSuccess(event, detail) {
        if(this.listenerCount(event) > 0) {
            return this.emit(event, this.#createDetailFromSuccessEvent(detail));
        }
        return false;
    }

    /**
     * 
     * @param {string|symbol} event 
     * @param {FailEventDetail} detail 
     * @returns {boolean}
     */
    #emitFail(event, detail) {
        if(this.listenerCount(event) > 0) {
            return this.emit(event, this.#createDetailFromFailEvent(detail));
        }
        return false;
    }

    /**
     * Adds a listener event to the Connection Pool associated with this context 
     * whenever a Query command is successfully executed on the pool.
     * @param {SuccessHandler} callback Function that executes when a query command is executed on this context.
     * @returns {() => CommandListener} Function for the user to use to unsubscribe to the event.
     */
    onQuerySuccess(callback) {
        const event = `query-success-${this.tableName}`;
        this.on(event, callback);
        return () => this.removeListener(event, callback);
    }

    /**
     * Adds a listener event to the Connection Pool associated with this context 
     * whenever a Query command is successfully executed on the pool.
     * @param {FailHandler} callback Function that executes when a query command is executed on this context.
     * @returns {() => CommandListener} Function for the user to use to unsubscribe to the event.
     */
    onQueryFail(callback) {
        const event = `query-fail-${this.tableName}`;
        this.on(event, callback);
        return () => this.removeListener(event, callback);
    }

    /**
     * Adds a listener event to the Connection Pool associated with this context 
     * whenever a Query command is successfully executed on the pool.
     * @param {SuccessHandler} callback Function that executes when a query command is executed on this context.
     * @returns {() => CommandListener} Function for the user to use to unsubscribe to the event.
     */
    onInsertSuccess(callback) {
        const event = `insert-success-${this.tableName}`;
        this.on(event, callback);
        return () => this.removeListener(event, callback);
    }

    /**
     * Adds a listener event to the Connection Pool associated with this context 
     * whenever a Query command is successfully executed on the pool.
     * @param {FailHandler} callback Function that executes when a query command is executed on this context.
     * @returns {() => CommandListener} Function for the user to use to unsubscribe to the event.
     */
    onInsertFail(callback) {
        const event = `insert-fail-${this.tableName}`;
        this.on(event, callback);
        return () => this.removeListener(event, callback);
    }

    /**
     * Adds a listener event to the Connection Pool associated with this context 
     * whenever a Query command is successfully executed on the pool.
     * @param {SuccessHandler} callback Function that executes when a query command is executed on this context.
     * @returns {() => CommandListener} Function for the user to use to unsubscribe to the event.
     */
    onUpdateSuccess(callback) {
        const event = `update-success-${this.tableName}`;
        this.on(event, callback);
        return () => this.removeListener(event, callback);
    }

    /**
     * Adds a listener event to the Connection Pool associated with this context 
     * whenever a Query command is successfully executed on the pool.
     * @param {FailHandler} callback Function that executes when a query command is executed on this context.
     * @returns {() => CommandListener} Function for the user to use to unsubscribe to the event.
     */
    onUpdateFail(callback) {
        const event = `update-fail-${this.tableName}`;
        this.on(event, callback);
        return () => this.removeListener(event, callback);
    }

    /**
     * Adds a listener event to the Connection Pool associated with this context 
     * whenever a Query command is successfully executed on the pool.
     * @param {SuccessHandler} callback Function that executes when a query command is executed on this context.
     * @returns {() => CommandListener} Function for the user to use to unsubscribe to the event.
     */
    onDeleteSuccess(callback) {
        const event = `delete-success-${this.tableName}`;
        this.on(event, callback);
        return () => this.removeListener(event, callback);
    }

    /**
     * Adds a listener event to the Connection Pool associated with this context 
     * whenever a Query command is successfully executed on the pool.
     * @param {FailHandler} callback Function that executes when a query command is executed on this context.
     * @returns {() => CommandListener} Function for the user to use to unsubscribe to the event.
     */
    onDeleteFail(callback) {
        const event = `delete-fail-${this.tableName}`;
        this.on(event, callback);
        return () => this.removeListener(event, callback);
    }

    /**
     * Adds a listener event to the Connection Pool associated with this context
     * whenever a Warning has been internally emitted.
     * @param {WarningHandler} callback 
     * @returns {() => CommandListener} Function for the user to use to unsubscribe to the event.
     */
    onWarning(callback) {
        const event = `warning-${this.tableName}`;
        this.on(event, callback);
        return () => this.removeListener(event, callback);
    }

    /**
     * @param {SuccessEventDetail} detail Details of the command when it was sent.
     * @returns {boolean} True if the event was emitted, false otherwise
     */
    emitQuerySuccess(detail) {
        return this.#emitSuccess(`query-success-${this.tableName}`, detail);
    }

    /**
     * @param {FailEventDetail} detail Details of the command when it was sent.
     * @returns {boolean} True if the event was emitted, false otherwise
     */
    emitQueryFail(detail) {
        return this.#emitFail(`query-fail-${this.tableName}`, detail);
    }

    /**
     * @param {SuccessEventDetail} detail Details of the command when it was sent.
     * @returns {boolean} True if the event was emitted, false otherwise
     */
    emitInsertSuccess(detail) {
        return this.#emitSuccess(`insert-success-${this.tableName}`, detail);
    }

    /**
     * @param {FailEventDetail} detail Details of the command when it was sent.
     * @returns {boolean} True if the event was emitted, false otherwise
     */
    emitInsertFail(detail) {
        return this.#emitFail(`insert-fail-${this.tableName}`, detail);
    }

    /**
     * @param {SuccessEventDetail} detail Details of the command when it was sent.
     * @returns {boolean} True if the event was emitted, false otherwise
     */
    emitUpdateSuccess(detail) {
        return this.#emitSuccess(`update-success-${this.tableName}`, detail);
    }

    /**
     * @param {FailEventDetail} detail Details of the command when it was sent.
     * @returns {boolean} True if the event was emitted, false otherwise
     */
    emitUpdateFail(detail) {
        return this.#emitFail(`update-fail-${this.tableName}`, detail);
    }

    /**
     * @param {SuccessEventDetail} detail Details of the command when it was sent.
     * @returns {boolean} True if the event was emitted, false otherwise
     */
    emitDeleteSuccess(detail) {
        return this.#emitSuccess(`delete-success-${this.tableName}`, detail);
    }

    /**
     * @param {FailEventDetail} detail Details of the command when it was sent.
     * @returns {boolean} True if the event was emitted, false otherwise
     */
    emitDeleteFail(detail) {
        return this.#emitFail(`delete-fail-${this.tableName}`, detail);
    }

    /**
     * @param {OnWarningData} detail Details of the warning.
     * @returns {boolean} True if the event was emitted, false otherwise.
     */
    emitWarning(detail) {
        return this.emit(`warning-${this.tableName}`, detail);
    }

    /**
     * 
     * @param {SuccessEventDetail} param0 
     */
    #createDetailFromSuccessEvent({ cmd, args, results }) {
        let cmdRaw = cmd;
        args.forEach(a => {
            cmdRaw = cmdRaw.replace("?", Array.isArray(a) ? `(${a.reduce((x,s) => `${s}, ${x}`, '')})` : typeof a === "string" || a instanceof Date ? `"${a}"` : a);
        });
        /** @type {OnSuccessData} */
        const detail = {
            dateIso: new Date().toISOString(),
            cmdRaw,
            cmdSanitized: cmd,
            args,
            resultsInSqlRowFormat: results,
            affectedRows: results.length == 1 ? results[0] : results
        };
        return detail;
    }

    /**
     * 
     * @param {FailEventDetail} param0 
     */
    #createDetailFromFailEvent({ cmd, args, err}) {
        let cmdRaw = cmd;
        if(args) {
            args.forEach(a => {
                if(cmdRaw) {
                    cmdRaw = cmdRaw.replace("?", Array.isArray(a) ? `(${a.reduce((x,s) => `${s}, ${x}`, '')})` : typeof a === "string" || a instanceof Date ? `"${a}"` : a);
                }
            });
        }
        /** @type {OnFailData} */
        const detail = {
            dateIso: new Date().toISOString(),
            cmdRaw,
            cmdSanitized: cmd,
            args,
            error: err
        };
        return detail;
    }
}


/** SuccessHandler  
 * 
 * Callback function on a Connection Pool handled by the emission of when a context sends a command to be executed.
 * @callback SuccessHandler
 * @param {OnSuccessData} data 
 * Data that was passed from the event emission.
 */

/** FailHandler  
 * 
 * Callback function on a Connection Pool handled by the emission of when a context sends a command and that command fails.
 * @callback FailHandler
 * @param {OnFailData} data 
 * Data that was passed from the event emission.
 */

/** WarningHandler  
 * 
 * Callback function on a Connection Pool handled by the emission of when a context sends a command to be executed.
 * @callback WarningHandler
 * @param {OnSuccessData} data 
 * Data that was passed from the event emission.
 */

/** OnSuccessData  
 * 
 * Data passed into the `OnSuccess` functions so the User has context to metadata during a command execution when it is successful.
 * @typedef OnSuccessData
 * @prop {number?} affectedRows 
 * Number of affected rows
 * @prop {string} dateIso 
 * Date in ISO string format
 * @prop {string} cmdRaw 
 * Command in its raw format, including arguments.
 * @prop {string} cmdSanitized 
 * Command in its sanitized format.
 * @prop {any[]} args 
 * Arguments that were passed in with the sanitized format.
 * @prop {any[]?} resultsInSqlRowFormat
 * Results directly from the adapter, or otherwise SQL rows
 */

/** OnFailData  
 * 
 * Data passed into the `OnFail` functions so the User has context to metadata during a command execution when it has failed.
 * @typedef OnFailData
 * @prop {Error} error 
 * Thrown error
 * @prop {string} dateIso 
 * Date in ISO string format
 * @prop {string=} cmdRaw 
 * Command in its raw format, including arguments.
 * @prop {string=} cmdSanitized 
 * Command in its sanitized format.
 * @prop {any[]=} args 
 * Arguments that were passed in with the sanitized format.
 */

/** OnWarningData  
 * 
 * Data passed into the `OnWarning` functions so the User has context to metadata from a command executed outside expected conditions.
 * @typedef OnWarningData
 * @prop {string} dateIso 
 * Date in ISO string format
 * @prop {string} type 
 * Type of command executed
 * @prop {string} table
 * Table the command was executed on.
 * @prop {string} message
 * Message from Kinship
 */