//@ts-check
import { KinshipContext } from "../src/context/context.js";
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
    password: process.env.PASS
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
const ctx = new KinshipContext(connection, "User");
const playlists = new KinshipContext(chinookConnection, "Playlist");
const lastId = await lastIds.where(m => m.Id.equals(1)).checkout();

playlists.hasMany(m => m.PlaylistTracks.fromTable("PlaylistTrack").withKeys("PlaylistId", "PlaylistId")
    .andThatHasOne(m => m.Track.withKeys("TrackId", "TrackId")))

ctx.onSuccess(({cmdRaw}) => {
    console.log(cmdRaw);
});

ctx.onFail(({cmdRaw, cmdSanitized, args}) => {
    console.log(cmdSanitized, args);
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

ctx.afterInsert(() => {}, async (numRecords) => {
    // Update the LastRowNumber table so the User Id is reflected.
    const results = await lastId.select();
    const [lastUserId] = results;
    lastUserId.User += numRecords;
    await lastIds.update(lastUserId);
});

async function testCount() {
    var count = await ctx.count();
    console.log({count});
}

async function testQuery() {
    const start = process.hrtime.bigint();
    var ps = await playlists.include(m => m.PlaylistTracks.thenInclude(m => m.Track)).select();
    // var users = await ctx
    //     .include(m => m.userRoles
    //         .thenInclude(m => m.role))
    //     .select();
    // console.log(JSON.stringify(users, undefined, 2));
    const end = process.hrtime.bigint();
    console.log(JSON.stringify(ps, undefined, 2));
    console.log((end - start) / 1000n);
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
    const n = await ctx.where(m => m.Id.equals(johnDoe.Id)).update(m => {
        m.FirstName = "Jane";
    });
    console.log({n});
}

async function testDelete(janeDoe) {
    const n = await ctx.where(m => m.Id.equals(janeDoe.Id)).delete();
    console.log({n});
}

await testQuery();
process.exit(1);