//@ts-check
/** @import { IKinshipAdapter } from "../../src/adapter.js" */
import mssql from 'mssql';

const pool = new mssql.ConnectionPool({
    database: "",
    server: "",
    user: "sa",
    password: "",
    port: 15301,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
});

/**
 * @implements {IKinshipAdapter} 
 */
export class MockAdapter {
    #pool;

    /** @type {mssql.Connection|mssql.ConnectionPool|mssql.Transaction} */
    #connection;

    /**
     * 
     * @param {mssql.ConnectionPool} pool 
     */
    constructor(pool) {
        this.#pool = pool;
        this.#connection = pool;
    }

    /** @type {IKinshipAdapter['handleDelete']} */
    handleDelete() {
        return {
            results: [],
            cmd: "",
            cmdArgs: []
        };
    }

    /** @type {IKinshipAdapter['handleInsert']} */
    handleInsert() {
        return {
            results: [],
            cmd: "",
            cmdArgs: []
        };
    }

    /** @type {IKinshipAdapter['handleUpdate']} */
    handleUpdate() {
        return {
            results: [],
            cmd: "",
            cmdArgs: []
        };
    }

    /** @type {IKinshipAdapter['handleQuery']} */
    handleQuery() {
        return {
            results: [],
            cmd: "",
            cmdArgs: []
        };
    }

    /** @type {IKinshipAdapter['createTransaction']} */
    async createTransaction() {
        const transaction = this.#pool.transaction();
        
        return {
            begin: async () => {
                await transaction.begin();

            },
            async commit() {

            },
            async rollback() {

            }
        }
    }
}