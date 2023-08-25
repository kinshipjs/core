//@ts-check
import { KinshipContext } from "../src/context/context.js";
import { adapter, createMySql2Pool } from "@kinshipjs/adapter-mysql";

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
    host: "localhost",
    database: "kinship_test",
    port: 3306,
    user: "root",
    password: "root"
});

const connection = adapter(pool);

// /** @type {KinshipContext<LastRowNumber>} */
// const lastIds = new KinshipContext(connection, "LastRowNumber")
/** @type {KinshipContext<User>} */
const ctx = new KinshipContext(connection, "User");

ctx.onQuerySuccess(({cmdRaw}) => {
    console.log(cmdRaw);
});

ctx.onQueryFail(({cmdRaw}) => {
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

// ctx.beforeInsert((m, { $$itemNumber, lastUserId }) => {
//     m.Id = `U-${(lastUserId + $$itemNumber).toString().padStart(6, '0')}`;
// }, async () => {
//     // Retrieve the latest Id from the LastRowNumber table.
//     const results = await lastIds.where(m => m.Id.equals(1)).select(m => m.User);
//     const [lastUserId] = results;
//     if(lastUserId) {
//         return {
//             lastUserId: lastUserId.User
//         };
//     } else {
//         await lastIds.insert({
//             User: 0,
//             Role: 0,
//         });
//         return {
//             lastUserId: 0
//         };
//     }
// });

// ctx.afterInsert(() => {}, async (numRecords) => {
//     // Update the LastRowNumber table so the User Id is reflected.
//     console.log(`AFTER Insert.`);
//     const results = await lastIds.where(m => m.Id.equals(1)).select();
//     console.log({results});
//     const [lastUserId] = results;
//     lastUserId.User += numRecords;
//     await lastIds.update(lastUserId);
// });

async function test() {
    const users = await ctx
        .include(m => m.userRoles
            .thenInclude(m => m.role))
        .select();
    console.log(users);
}

await test();
process.exit(1);