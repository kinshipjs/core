//@ts-check
import { bit, foreign, int, varchar } from "./datatypes.js";
import { table } from "./table.js";

class User {
    id = int("Id").primaryKey().identity();
    firstName = varchar("FirstName", 32).notNull();
    lastName = varchar("LastName", 32).notNull();

    roles = foreign(UserRole).many();
}

class UserRole {
    userId = int("UserId").primaryKey();
    roleId = int("RoleId").primaryKey();

    user = foreign(User).one();
    role = foreign(Role).one();
}

class Role {
    id = int("Id").primaryKey().identity();
    title = varchar("Title", 32).notNull();
    description = varchar("Description", 256);
    
    users = foreign(UserRole).many();
}

class AuthContext {
    users = table(User);
    userRoles = table(UserRole);
    roles = table(Role);
}


const auth = new AuthContext();
const users = await auth.users
    .include(m => m.roles
        .thenInclude(m => m.role)
        .thenInclude(m => m)
    );