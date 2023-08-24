//@ts-check
import { KinshipContext } from "../src/context/context.js";

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

/** @type {KinshipContext<LastRowNumber>} */
const lastIdsCtx = new KinshipContext(/** @type {import("../src/old/index.js").KinshipAdapter<any>}*/ ({}), "LastRowNumber")
const lastIds = lastIdsCtx.where(m => m.Id.equals(1));
/** @type {KinshipContext<User>} */
const ctx = new KinshipContext(/** @type {import("../src/old/index.js").KinshipAdapter<any>}*/ ({}), "User");

ctx.beforeInsert((m, { $$itemNumber, lastUserId }) => {
    m.Id = `U-${lastUserId + $$itemNumber}`;
}, async () => {
    // Retrieve the latest Id from the LastRowNumber table.
    console.log(`BEFORE INSERT: Getting last User Id.`);
    const [lastUserId] = await lastIds.select(m => m.User);
    if(lastUserId) {
        return {
            lastUserId: lastUserId.User
        };
    } else {
        await lastIds.insert({
            User: 0,
            Role: 0,
        });
        return 0;
    }
});

ctx.afterInsert(() => {}, async (numRecords) => {
    // Update the LastRowNumber table so the User Id is reflected.
    console.log(`AFTER Insert.`);
    const [lastUserId] = await lastIds.select();
    lastUserId.User += numRecords;
    await lastIds.update(lastUserId);
});

