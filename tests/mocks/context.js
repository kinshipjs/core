//@ts-check
import { foreign, int, varchar } from "../../src/context/types.js";
import { KinshipContext, table, transaction } from "../../src/context/context.js";
import { MockAdapter } from "./adapter.js";

export const Chinook = {
    Playlist: class {
        id = int("Id").primaryKey();
        name = varchar("Name", 32).notNull();
    }
};

export class ChinookContext extends KinshipContext {
    playlists = table(Chinook.Playlist, "Playlist");

    constructor() { 
        super(new MockAdapter());
    }
}

const ctx = new ChinookContext();
const x = await ctx.transaction((ctx) => {
    return 2;
});
