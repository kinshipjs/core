//@ts-check

// SELECT {selects} FROM {main_table} LEFT JOIN {join_tables} ON {reference_key} = {referer_key} WHERE {where} GROUP BY {group_by} ORDER BY {order_by} [ASC|DESC] LIMIT {limit} OFFSET {offset}
const tabs = (nestLevel) => `${Array(Array.from(nestLevel).keys()).map(() => `\t`)}`
const syntax = {
    /**
     * @returns {ofe[]}
     */
    orderOfExecution: ({AGGREGATE, GROUP_BY, LIMIT, OFFSET, ORDER_BY, SELECT, WHERE}) => {
        return [
            SELECT,
            AGGREGATE,
            WHERE,
            GROUP_BY,
            LIMIT,
            OFFSET,
            ORDER_BY
        ];
    },
    clauses: {
        FROM: "FROM",
        JOIN: "LEFT JOIN",
        GROUP_BY: "GROUP BY",
        LIMIT: "LIMIT",
        OFFSET: "OFFSET",
        ORDER_BY: "ORDER BY",
        WHERE: "WHERE",
        SELECT: "SELECT",
    },
    chains: {
        WHERE: "WHERE",
        WHERE_NOT: "WHERE NOT",
        AND: "AND",
        OR: "OR",
        AND_NOT: "AND NOT",
        OR_NOT: "OR NOT"
    },
    operators: {

    },
    separators: {
        groupBys: `,`,
        orderBys: `,`,
        selects: `,`,
        wheres: `,`
    },
    aggregates: (alias, aggregateType, columnName, tableAlias, tableName) => `${aggregateType}(${tableAlias}.${columnName}) AS ${alias}`,
    groupBys: (alias, columnName, tableAlias, tableName, operator) => `${alias}`,
    limit: (n) => `?`,
    offset: (n) => `?`,
    orderBys: (alias, columnName, tableAlias, tableName, operator) => `${alias}`,
    selects: (alias, columnName, tableAlias, tableName) => `${tableAlias}.${columnName} AS ${alias}`,
    wheres: (alias, columnName, operator, tableAlias, tableName) => `${alias} ${operator} ?`,
    whereChain: (whereStr, chain) => `${chain} ${whereStr}`
};
/** @enum {number} */
const ofe = {
    AGGREGATE: 0,
    SELECT: 1,
    WHERE: 2,
    GROUP_BY: 3,
    ORDER_BY: 4,
    LIMIT: 5,
    OFFSET: 6
};

/**
 * @param {any} state
 * @param {typeof syntax} syntax 
 */
function foo(state, syntax) {
    let cmd = ``;
    let args = [];
    for(const step of syntax.orderOfExecution(ofe)) {
        switch(step) {
            case ofe.AGGREGATE: {

            }
            case ofe.GROUP_BY: {

            }
            case ofe.LIMIT: {

            }
            case ofe.OFFSET: {

            }
            case ofe.ORDER_BY: {

            }
            case ofe.SELECT: {

            }
            case ofe.WHERE: {
                cmd += `${syntax.clauses.SELECT} ${state.selects.map(s => syntax.selects(s.alias, s.column, s.tableAlias, s.tableName)).join(syntax.separators.selects)}\n`;
                break;
            }
        }
    }
}

function custom_adapter(execute, syntax) {
    return {
        serialize: (state) => foo(state, syntax),
        execute: {
            insert: (cmd, args) => {
                try {
                    return execute({
                        NonUniqueKeyError: Error,
                        CannotInsertIdentityKeyError: Error,
                        CannotInsertNullError: Error,
                    }, cmd, args);
                } catch(err) {
                    if(err instanceof Error) {
                        
                    }
                }
            },
            update: (cmd, args) => {
                try {
                    return execute({
                        CannotUpdatePrimaryKeyError: Error,
                        CannotUpdateIdentityKeyError: Error,
                        CannotUpdateToNullError: Error,
                    }, cmd, args);
                } catch(err) {
                    if(err instanceof Error) {
                        
                    }
                }
            }
        }
    };
}

const MySqlCustomAdapter = custom_adapter({}, syntax);