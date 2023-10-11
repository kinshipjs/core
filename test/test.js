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

/**
 * @typedef {object} LastRowNumber
 * @prop {number=} Id
 * @prop {number} User
 * @prop {number} Role
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

const chinookConnection = adapter(chinookPool);
const connection = adapter(pool);

/** @type {KinshipContext<LastRowNumber>} */
const lastIds = new KinshipContext(connection, "LastIdAssigned")
/** @type {KinshipContext<User>} */
const users = new KinshipContext(connection, "User");
/** @type {KinshipContext<xUserRole>} */
const xUserRoles = new KinshipContext(connection, "xUserRole");
/** @type {KinshipContext<Role>} */
const roles = new KinshipContext(connection, "Role");
const lastId = lastIds.where(m => m.Id.equals(1));

users.hasMany(m => m.userRoles
        .fromTable("xUserRole")
        .withKeys("Id", "UserId")
    .andThatHasOne(m => m.role
        .fromTable("Role")
        .withKeys("RoleId", "Id")
    )
);

users.onFail(({cmdRaw}) => {
    console.log(cmdRaw);
})

// assign last Id to every record before it is inserted.
users.beforeInsert((m, { $$itemNumber, lastUserId }) => {
    // appending '__' forces the property to change no matter what.
    m.Id = `U-${(lastUserId + $$itemNumber).toString().padStart(7, '0')}`;
}, async () => {
    // Retrieve the latest Id from the LastRowNumber table.
    const results = await lastId.select(m => m.User);
    const [lastUserId] = results;
    if(lastUserId) {
        return {
            lastUserId: lastUserId.User
        };
    } else {
        await lastIds.insert({
            User: 0,
            Role: 0,
        });
        return {
            lastUserId: 0
        };
    }
});

users.afterInsert(async (u) => {
    // insert cascading
    await transaction({ xUserRoles }).execute(async ({ xUserRoles: xUserRolesCtx }) => {
        console.log(JSON.stringify({u}, undefined, 2));
        if(!u.userRoles) {
            return;
        }
        let roles = /** @type {Role[]} */ (u.userRoles.map(ur => ur.role).filter(r => Boolean(r)));
        if(roles.length > 0) {
            // only inserts xRefs.
            const needsUpdating = roles.filter(r => Boolean(r.Id));
            await xUserRolesCtx.insert(needsUpdating.map(r => ({
                UserId: u.Id,
                RoleId: r.Id
            })));
        }
    });
}, async (numRecords) => {
    // Update the LastRowNumber table so the User Id is reflected.
    const results = await lastId.select();
    const [lastUserId] = results;
    lastUserId.User += numRecords;
    await lastIds.update(lastUserId);
});

async function testCount() {
    var count = await users.count();
}

async function testQuery() {
    var us = await users;
    us = await users.where(m => m.Id.equals("U-0000001"));
    us = await users.sortBy(m => m.FirstName);
    var grouped = await users.groupBy(m => m.LastName);
    us = await users.take(1);
    us = await users.skip(1).take(1);
    us = await users.take(1).skip(1);
    us = await users.where(m => m.Id.equals("U-0000001")).sortBy(m => m.LastName);
    us = await users.sortBy(m => m.LastName).where(m => m.Id.equals("U-0000001"));
    const usersByLastNameStartingWithA = users.where(m => m.LastName.startsWith("A"));
    us = await usersByLastNameStartingWithA;
}

async function testIncludes() {
    await users.include(m => m.userRoles);
    await users;
    throw Error();
}

async function testInsert() {
    const [johnDoe] = await users.insert({
        FirstName: "John",
        LastName: "Doe"
    });
    console.log(JSON.stringify(johnDoe, undefined, 2));
    return johnDoe;
}

async function testUpdate(johnDoe) {
    const n = await users.where(m => m.Id.equals(johnDoe.Id)).update(m => {
        m.FirstName = "Jane";
    });
    console.log({n});
}

async function testDelete(janeDoe) {
    const n = await users.where(m => m.Id.equals(janeDoe.Id)).delete();
    console.log({n});
}

users.onSuccess(({ cmdRaw }) => {
    console.log(cmdRaw + "\n");
});

await testIncludes();
await testCount();
await testQuery();
const johnDoe = await testInsert();
await testUpdate(johnDoe);
await testDelete(johnDoe);

process.exit(1);