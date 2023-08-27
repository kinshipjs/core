//@ts-check
import { KinshipContext } from "../src/context/context.js";
import { adapter, createMySql2Pool } from "@kinshipjs/mysql";
import { config } from 'dotenv';

config();

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
    password: process.env.PASS
});

const connection = adapter(pool);

/** @type {KinshipContext<LastRowNumber>} */
const lastIds = new KinshipContext(connection, "LastIdAssigned", { stateless: true })
/** @type {KinshipContext<User>} */
const ctx = new KinshipContext(connection, "User", { stateless: true });

ctx.onSuccess(({cmdRaw}) => {
    console.log(cmdRaw);
});

ctx.onFail(({cmdRaw}) => {
    console.log(cmdRaw);
});

lastIds.onSuccess(({cmdRaw}) => {
    console.log(cmdRaw);
});

lastIds.onFail(({cmdRaw}) => {
    console.log(cmdRaw);
});

ctx.hasMany(m => m.userRoles
        .fromTable("xUserRole")
        .withKeys("Id", "UserId")
    .andThatHasOne(m => m.role
        .fromTable("Role")
        .withKeys("RoleId", "Id")
    )
);

ctx.beforeInsert((m, { $$itemNumber, lastUserId }) => {
    m.Id = `U-${(lastUserId + $$itemNumber).toString().padStart(7, '0')}`;
}, async () => {
    // Retrieve the latest Id from the LastRowNumber table.
    const results = await lastIds.where(m => m.Id.equals(1)).select(m => m.User);
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

ctx.afterInsert(() => {}, async (numRecords) => {
    // Update the LastRowNumber table so the User Id is reflected.
    const results = await lastIds.where(m => m.Id.equals(1)).select();
    const [lastUserId] = results;
    lastUserId.User += numRecords;
    await lastIds.update(lastUserId);
});

async function testQuery() {
    var users = await ctx
        .include(m => m.userRoles
            .thenInclude(m => m.role))
        .groupBy((m, { total }) => [m.userRoles.role.Title, total()])
        .select();
    console.log(JSON.stringify(users, undefined, 2));
}

async function testInsert() {
    const [johnDoe] = await ctx.insert({
        FirstName: "John",
        LastName: "Doe"
    });
    console.log(JSON.stringify(johnDoe, undefined, 2));
    return johnDoe;
}

async function testUpdate(johnDoe) {
    johnDoe.FirstName = "Jane";
    const n = await ctx.update(johnDoe);
    console.log({n});
}

async function testDelete(janeDoe) {
    const n = await ctx.delete(janeDoe);
    console.log({n});
}

await testQuery();
const johnDoe = await testInsert();
await testUpdate(johnDoe);
await testDelete(johnDoe);
process.exit(1);