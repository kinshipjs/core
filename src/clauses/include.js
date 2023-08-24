//@ts-check

/** @typedef {[MainTableFromClauseProperty, ...FromClauseProperty[]]} FromClauseProperties */

/**
 * @typedef {object} FromClauseProperty
 * @prop {string} realName
 * Real name of the table  defined by the user in the database.
 * @prop {string} alias
 * Alias of the table, configured by Kinship.
 * @prop {string=} programmaticName
 * Name as the user has configured it.
 * @prop {SelectClauseProperty} refererTableKey
 * Information about the source table key.
 * @prop {SelectClauseProperty} referenceTableKey
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

export default {};