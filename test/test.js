//@ts-check
import { KinshipContext, transaction } from "../src/context/context.js";
import { adapter, createMySql2Pool } from "@kinshipjs/mysql2";
import { config } from 'dotenv';

config();

/**
 * @typedef {import("../src/config/relationships.js").Relationships<User>} UserRelationships
 */

/**
 * @typedef {import("../src/models/string.js").FriendlyType<UserRelationships['userRoles']['relationships']>} UserRoleRelationships
 */

/**
 * @typedef {object} User
 * @prop {string=} Id
 * @prop {string} FirstName
 * @prop {string} LastName
 * @prop {xUserRole[]=} userRoles
 */

/**
 * @typedef {object} xUserRole
 * @prop {string=} UserId
 * @prop {string=} RoleId
 * @prop {Role=} role
 */

/**
 * @typedef {object} Role
 * @prop {string=} Id
 * @prop {string} Title
 * @prop {string=} Description 
 */

const pool = createMySql2Pool({
    host: process.env.HOST,
    database: process.env.DB,
    port: parseInt(process.env.PORT ?? "3306"),
    user: process.env.USER,
    password: process.env.PASS,
    multipleStatements: true
});

const chinookPool = createMySql2Pool({
    host: process.env.HOST,
    database: "chinook",
    port: parseInt(process.env.PORT ?? "3306"),
    user: process.env.USER,
    password: process.env.PASS
});

const connection = adapter(pool);

/** @type {KinshipContext<User>} */
const users = new KinshipContext(connection, "User");
/** @type {KinshipContext<xUserRole>} */
const xUserRoles = new KinshipContext(connection, "xUserRole");
/** @type {KinshipContext<Role>} */
const roles = new KinshipContext(connection, "Role");