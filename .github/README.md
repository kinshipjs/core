![Kinship Logo Title & Description](https://raw.githubusercontent.com/kinshipjs/branding/main/kinship-logo-with-description.png)

# What is Kinship?

Kinship is a Query Builder and a relatively new approach (in JavaScript and NodeJS) to interfacing with your back-end databases using strong type mapping and friendly syntax to enhance your development experience.

You can learn more about Kinship on the [Kinship website](https://kinshipjs.dev/)

## Get Started

Install dependencies

```
npm i -D @kinshipjs/core
# adapter:
npm i -D @kinshipjs/mysql2 # Interface with a MySQL database
# or
npm i -D @kinshipjs/mssql # Interface with a Microsoft SQL Server database
npm i -D @kinshipjs/postgres # Interface with a PostGRES database
npm i -D @kinshipjs/sqlite # Interface with a SQLite database/file
npm i -D @kinshipjs/mongodb # Interface with your mongodb database
npm i -D @kinshipjs/json # Interface with a javascript object
```

### Initialize types

Initialize your types for Kinship to help you work with.

```ts
interface User {
    id?: string;
    firstName: string;
    lastName: string;
    username: string;

    userRoles?: xUserRole[];
};

interface Role {
    id?: number;
    title: string;
    description: string;
    
    userRoles?: xUserRole[];
};

interface xUserRole {
    userId?: string;
    roleId?: number;

    user?: User;
    role?: Role;
}
```

### Initialize contexts

Construct `KinshipContext` objects to connect to your database tables.

```ts
import { KinshipContext } from '@kinshipjs/core';
import { adapter, createMySql2Pool } from '@kinshipjs/mysql2';

const pool = createMySql2Pool({
    host: 'localhost',
    port: 3306,
    database: 'auth',
    user: 'root',
    password: 'root'
});

const connection = adapter(pool);

const users = new KinshipContext<User>(connection, "User");
const roles = new KinshipContext<Role>(connection, "Role");
const userRoles = new KinshipContext<xUserRole>(connection, "xUserRole");
```

### Configure relationships (optional)

Configure one-to-one and one-to-many relationships between tables.

```ts
users.hasMany(m => m.userRoles.fromTable("xUserRole").withKeys("id", "userId")
    .andThatHasOne(m => m.role.fromTable("Role").withKeys("roleId", "id")));
roles.hasMany(m => m.userRoles.fromTable("xUserRole").withKeys("id", "roleId")
    .andThatHasOne(m => m.role.fromTable("User").withKeys("userId", "id")));

// or
users.hasMany(m => m.userRoles.from(xUserRoles, m => m.id, m => m.userId)
    .andThatHasOne(m => m.role.from(roles, m => m.roleId, m => m.id)));
```

### Configure triggers (optional and allows for advanced work)

Configure triggers to execute before or after certain commands are executed.  

Triggers can be helpful if your application is planned to handle any sort of default values.

```ts
import { v4 } from 'uuid'
// Always assign a uuid to a User's id column before they are inserted.
users.beforeInsert((m) => {
    m.id = v4();
});

// Use a hook to set up any variables that only need to be set up once.
// parameters that start with "$$" are always accessible to you.
users.beforeInsert((m, { $$itemNumber, numRecordsDoubled, numUsersWithoutMiddleName }) => {
    // This function will fire for EVERY record being inserted.
    m.id = $$numRecordsDoubled * numUsersWithoutMiddleName; // definitely not recommended, just using it as an example.
}, async ({ $$numRecords }) => {
    // This function will fire only ONCE per `.insert()` call.
    const x = await users.where(m => m.middleName.equals(null).or(m => m.middleName.equals(""))).count();

    // any returned variables are immediately accessible in the main trigger function in the `args` parameter.
    return {
        numRecordsDoubled: $$numRecords * 2,
        numUsersWithoutMiddleName: x
    };
});
```

### Configure event handlers (optional)

Configure event handlers to execute after a command successfully or unsuccessfully executes.

```ts
users.onSuccess(({ dateISO, cmdRaw }) => {
    console.log(`${dateISO}: ${cmdRaw}`);
});
users.onFail(({ dateISO, cmdRaw, err }) => {
    console.log(`${dateISO}: ${cmdRaw}`);
    console.error(err);
});
```

### Query records

Query records using various clauses.

```ts
// any of these clauses can be used in any given order.
const allUsers = await users;
const allUsersAndRoles = await users.include(m => m.userRoles.thenInclude(m => m.role));
const onlyUsersWithFirstNameJohn = await users.where(m => m.firstName.equals("John"));
const usersSortedByLastNameZtoA = await users.sortBy(m => m.lastName.desc());
const usersGroupedByFirstName = await users.groupBy((m, aggregates) => [m.firstName, aggregates.total()]);
const firstUser = await users.take(1);
const secondUser = await users.skip(1).take(1);
const onlyIds = await users.select(m => m.Id);
const onlyFirstNameAndLastName = await users.select(m => [m.FirstName, m.LastName]);
```

### Insert records

Insert one or more records.

```ts
const user = {
    firstName: "John",
    lastName: "Doe",
    roles: [
        {
            // insert a new role as well
            role: {
                title: "New-Role",
                description: "This is a new role"
            } 
        }
    ]
}

// one record
const insertedUser = await users.insert(user);
// many records
const insertedUsers = await users.insert([
    // no roles.
    { firstName: "Joanne", lastName: "Doe" },
    { firstName: "Jane" lastName: "Doe" }
]);
```

### Update records

Update one or more records implicitly (using objects that have the primary key already defined) or explicitly (using a where clause)

```ts
const [user] = await users.take(1);
// implicitly by the row's primary key.
user.firstName = "Jordan";
const numRowsAffected = await users.update(user);

// explicitly through where clause and setting properties
await users.where(m => m.id.equals(1)).update(m => {
    // if a virtual column or identity key is set here, then it is ignored.
    m.firstName = "Jordan";
});
// or by returning the object.
await users.where(m => m.id.equals(1)).update(m => {
    return {
        ...m,
        firstName: "Jordan"
    };
});
```

### Delete records

Delete one or more records implicitly (using objects that have the primary key already defined) or explicitly (using a where clause)

```ts
const [user] = await users.take(1);
// implicitly by the row's primary key.
await users.delete(user);

// explicitly through where clause
await users.where(m => m.id.equals(1)).delete();
```

### Truncate records 

Truncate your entire table. (requires property `disableSafeDeleteMode` to be true in the `options` on the constructor)

```ts
await users.truncate();
```

### All or nothing transactions

Call multiple transactional functions where if one fails, then all will fail.  

```ts
import { transaction } from '@kinshipjs/core';

const config = { }; // ... configuration for database connection
const cnn = adapter(createMssqlPool(config));

const users = new KinshipContext<{ Id?: number, FirstName: string, LastName: string }>(cnn, "dbo.User");
const xUserRoles = new KinshipContext<{ UserId?: number, RoleId?: number }>(cnn, "dbo.xUserRole");
const roles = new KinshipContext<{ Id?: number, Title: string, Description?: string }>(cnn, "dbo.Role");

async function giveUserAdminRole(firstName: string, lastName: string) {
    return await transaction(cnn)
        .execute(async (tnx) => 
    {
        // REQUIRED for the context to work on this specific transaction
        // (alternatively, you can just add `using()` to the context as you're calling the clauses/transactions you want)
        const $users = users.using(tnx); 
        const $xUserRoles = xUserRoles.using(tnx);
        const $roles = roles.using(tnx);

        const [johnDoe] = await $users
            .where(m => m.FirstName.equals(firstName)
                .and(m => m.LastName.equals(lastName)));
        
        const johnDoesCurrentRoles = await $xUserRoles.where(m => m.UserId.equals(johnDoe.Id));
    
        await $xUserRoles.delete(johnDoesCurrentRoles);
    
        const [adminRole] = await $roles.where(m => m.Title.equals("Admin"));

        if(!adminRole) {
            // note: rollback does not need to be thrown here. If any error is thrown, then the transaction is rolled back.
            // if no admin role exists, then user's current roles won't be deleted.
            throw rollback();
        }
        const [xUserRole] = await $xUserRoles.insert({
            UserId: johnDoe.Id,
            RoleId: adminRole.Id
        });

        return { ...johnDoe, xUserRoles: [{ ...xUserRole, Role: adminRole }]};
    });
}

const johnDoe = await giveUserAdminRole("John", "Doe");
console.log(johnDoe);
/**
 * prints: { Id: 1, FirstName: "John", LastName: "Doe", xUserRoles: [ UserId: 1, RoleId: 1, Role: { Id: 1, Title: "Admin", Description: "administrative privileges" } ] }
 */ 
```

If, for example, you have two different database connections, then you would do something like this:

```ts
import { createMssqlPool } from '@kinshipjs/mssql';
import { transaction } from '@kinshipjs/core';

// login database (pretend its connected to localhost:1433)
const loginsCfg = { }; // ... configuration for database connection
const loginsCnn = adapter(createMssqlPool(loginsCfg));

const users = new KinshipContext<{ Id?: number, FirstName: string, LastName: string }>(loginsCnn, "dbo.User");
const xUserRoles = new KinshipContext<{ UserId?: number, RoleId?: number }>(loginsCnn, "dbo.xUserRole");
const roles = new KinshipContext<{ Id?: number, Title: string, Description?: string }>(loginsCnn, "dbo.Role");

// main database (pretend its connected to localhost:1434)
const mainCfg = { };
const mainCnn = adapter(createMssqlPool(mainCfg));

const mainUsers = new KinshipContext<{ Id?: number, LoginUserId?: number }>(mainCnn, "dbo.User");

const msg = await transaction(loginsCnn).execute(async tnx => {
    const $users = users.using(tnx);
    const $xUserRoles = xUserRoles.using(tnx);
    const $roles = roles.using(tnx);
    return await transaction(mainCnn).execute(async mainTnx => {
        // if this transaction fails, the error will bubble up and also invalidate any transactions that this is in.
        const $mainUsers = mainUsers.using(mainTnx);

        // .. do stuff here to insert into the login database
        const [user] = $users.insert({ FirstName: "John", LastName: "Doe" });

        const [mainUser] = await mainUsers.insert({ LoginUserId: user.Id });

        return "Success!";
    });
});
console.log(msg); // prints "Success!"
```

# Kinship Adapters

- [@kinshipjs/json](https://npmjs.com/package/@kinshipjs/core): Connect to a JSON-like schema/database and manage that object using Kinship. (Good for development/testing or local storage!)
- [@kinshipjs/mysql2](https://www.npmjs.com/package/@kinshipjs/mysql2): Connect to a MySQL database using the Node.js `mysql2` ORM.
- [@kinshipjs/mssql](https://www.npmjs.com/package/@kinshipjs/mssql): Connect to a SQL Server database using the Node.js `mssql` ORM.
- [@kinshipjs/sqlite3](https://www.npmjs.com/package/@kinshipjs/sqlite): Connect to a SQLite file database using the Node.js `sqlite3` ORM. (in development)
- [@kinshipjs/postgres](https://www.npmjs.com/package/@kinshipjs/postgres): Connect to a PostgreSQL database using the Node.js `pg` ORM. (in development)

# More Kinship Tools

- [@kinshipjs/dapper](#more-kinship-tools): Use your `KinshipContext` objects for a dapper-like ORM! (in development and on a roadmap)
- [@kinshipjs/graphql-express](#more-kinship-tools): Use your `KinshipContext` objects to quickly build a full GraphQL endpoint on an express web server.
- [@kinshipjs/lucia](#more-kinship-tools): Use your `KinshipContext` objects to interface with the [Lucia Auth Library](https://www.lucia-auth.com) 