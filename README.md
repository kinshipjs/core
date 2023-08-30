![Kinship Logo Title & Description](https://raw.githubusercontent.com/kinshipjs/branding/main/kinship-logo-with-description.png)

# What is Kinship?

Kinship is a relatively new approach (in JavaScript and NodeJS) to interfacing with your back-end databases using strong type mapping and friendly syntax to enhance your development experience.

You can learn more about Kinship on the [Kinship website](https://kinshipjs.dev/)

## Get Started

Install dependencies

```
npm i -D @kinshipjs/core
npm i -D @kinshipjs/mysql2
```

Initialize types

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

Initialize contexts

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

Configure relationships (optional)

```ts
users.hasMany(m => m.userRoles.fromTable("xUserRole").withKeys("id", "userId")
    .andThatHasOne(m => m.role.fromTable("Role").withKeys("roleId", "id")));
roles.hasMany(m => m.userRoles.fromTable("xUserRole").withKeys("id", "roleId")
    .andThatHasOne(m => m.role.fromTable("User").withKeys("userId", "id")));
```

Configure triggers (optional and allows for advanced work)

```ts
import { v4 } from 'uuid' // optional
users.beforeInsert((m) => {
    m.id = v4();
});
// you can cascade insert/update/delete this way. (this is not meant to be copied verbatim)
users.afterInsert(async u => {
    if(!u.userRoles) {
        return;
    }
    // start construction of the xref rows.
    const userRoles = m.userRoles.map(ur => ({
        userId: u.id,
        user: u,
        role: ur.role
    }));
    // add new trigger
    const unsubscribe = roles.afterInsert(async r => {
        // finish construction of the xref rows.
        userRoles.forEach(ur => {
            ur.roleId = r.id;
        });
        await xUserRoles.insert(userRoles);
    });
    // insert the role
    await roles.insert(userRoles.map(ur => ur.role));
    // unsubscribe from the trigger.
    unsubscribe();
});

```

Configure event handlers (optional)

```ts
users.onSuccess(({ dateISO, cmdRaw }) => {
    console.log(`${dateISO}: ${cmdRaw}`);
});
users.onFail(({ dateISO, cmdRaw, err }) => {
    console.log(`${dateISO}: ${cmdRaw}`);
    console.error(err);
});
```

Query records

```ts
const allUsers = await users.select();
const allUsersAndRoles = await users.include(m => m.userRoles.thenInclude(m => m.role)).select();
const onlyUsersWithFirstNameJohn = await users.where(m => m.firstName.equals("John")).select();
const usersSortedByLastNameZtoA = await users.sortBy(m => m.lastName.desc()).select();
const usersGroupedByFirstName = await users.groupBy((m, aggregates) => [m.firstName, aggregates.total()]);
const firstUser = await users.take(1).select();
const secondUser = await users.skip(1).take(1).select();
const onlyIds = await users.select(m => m.Id);
const onlyFullName = await users.select(m => [m.FirstName, m.LastName]);
```

Insert records

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

Update records

```ts
const [user] = await users.take(1).select();
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

Delete records

```ts
const [user] = await users.take(1).select();
// implicitly by the row's primary key.
await users.delete(user);

// explicitly through where clause
await users.where(m => m.id.equals(1)).delete();
```

Truncate records (requires property `disableSafeDeleteMode` to be true in the `options` on the constructor)

```ts
await users.truncate();
```