//@ts-check
import { foreign, int, varchar } from "../src/context/types.js";
import { KinshipContext, table } from "../src/context/context.js";
import { test } from 'vitest';
import { MockAdapter } from "./mocks/adapter.js";

const adapterConnection = new MockAdapter();

test("Test query all [context.then()]", async () => {
    adapterConnection.once("query", data => {
    });
    const context = new AuthContext(adapterConnection);
    const results = await context.roles.select(m => [m.description])
    context.roles.where(m => m.description.equals("")
        .and(m => m.description.not.not))
});

class User {
    id = int("Id").primaryKey().identity();
    firstName = varchar("FirstName", 64);
    lastName = varchar("LastName", 64);
    email = varchar("Email", 64).notNull();

    roles = foreign(xUserRole).many();
}

class xUserRole {
    userId = int("UserId").primaryKey();
    roleId = int("RoleId").primaryKey();
    user = foreign(User).one();
    role = foreign(Role).one();
}

class Role {
    id = int("Id").primaryKey().identity();
    title = varchar("Title", 20);
    description = varchar("Description", 128);

    users = foreign(xUserRole).many();
}

class AuthContext extends KinshipContext {
    users = table(User, "User");
    roles = table(Role, "Role");
}

AuthContext.onModelCreating(builder => {
    builder.hasOne(m => m.roles)
    builder.hasMany(m => m.roles)
    
})