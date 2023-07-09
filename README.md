# `MyORM` GraphQL

The `MyORM` GraphQL plugin serves as a fast and easy way to integrate your database to a GraphQL endpoint by providing various `MyORMContext` objects connected to tables, which then creates your root query and mutation types.

## Getting Started

Run the following commands.

```
npm i @myorm/graphql
npm i @myorm/mysql-adapter # or whichever adapter you prefer to use.
```

Create your database:

```sql
CREATE DATABASE auth;
USE auth;
CREATE TABLE User (
    Id INT AUTO_INCREMENT,
    FirstName VARCHAR(32) NOT NULL,
    LastName VARCHAR(32) NOT NULL,
    Username VARCHAR(20) NOT NULL,
    PassChecksum VARCHAR(36) NOT NULL,
    PRIMARY KEY (Id)
);

CREATE TABLE UserRoleXref (
    UserId INT NOT NULL,
    RoleId INT NOT NULL,
    PRIMARY KEY (UserId, RoleId),
    FOREIGN KEY (UserId) REFERENCES User (Id)
);

CREATE TABLE Role (
    Id INT AUTO_INCREMENT,
    Title VARCHAR(20) NOT NULL,
    Description VARCHAR(64),
    PRIMARY KEY (Id)
);
```

Construct your TypeScript types:

```ts
interface User {
    Id?: number;
    FirstName: string;
    LastName: string;
    Username: string;
    PassChecksum: string;

    UserRoles?: UserRoleXref[];
};

interface UserRoleXref {
    UserId?: number;
    RoleId?: number;

    User?: User;
    Role?: Role;
}

interface Role {
    Id?: number;
    Title: string;
    Description?: string;

    UserRoles?: UserRoleXref[];
}
```

Import `@myorm/myorm`, `@myorm/mysql-adapter`, and `@myorm/graphql`.

```ts
import { MyORMContext } from '@myorm/myorm';
import { adapter, createMySql2Pool } from '@myorm/mysql-adapter';
import { MyORMGraphQL } from '@myorm/graphql';
```

Configure your connection to your database.

```ts
const pool = createMySql2Pool({
    user: 'root',
    password: 'root',
    host: 'localhost',
    port: 3306,
    database:
});

const connection = adapter(pool);

```

Construct your `MyORMContext` objects.

```ts
const users = new MyORMContext<User>(connection, "User");
const userRoles = new MyORMContext<UserRoleXref>(connection, "UserRoleXref");
const roles = new MyORMContext<Role>(connection, "Role");
```

Configure relationships (if any exist)

```ts
users.hasMany(m => m.UserRoles.fromTable("UserRoleXref").withKeys("Id", "UserId")
    .andThatHasOne(m => m.Role.withKeys("Id", "RoleId")));
```

Create your `MyORMGraphQL` object.

```ts
const gql = new MyORMGraphQL("auth_connection");
```

Add your contexts to your `MyORMGraphQL` object using `.addContext()`.

```ts
gql.addContext(users);
gql.addContext(userRoles);
gql.addContext(roles);
```

Finally, create your root query and root mutation types!

```ts
const rootQueryObject = gql.createRootQueryObject();
const rootMutationObject = gql.createRootMutationObject();
```

Using the [express framework](https://expressjs.com/) and the [express-graphql](https://graphql.org/graphql-js/express-graphql/) library, you can pass your objects in and start your server!

```ts
import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { GraphQLSchema } from "graphql";

app.use('/graphql', graphqlHTTP({
    schema: new GraphQLSchema({
        query: rootQueryObject,
        mutation: rootMutationObject
    }),
    graphiql: true
}));

app.listen(5555, () => {
    console.log(`Serving on 5555`);
});
```

If you navigate to the graphiql url, http://localhost:5555/graphql, you will see something like this in the documentation. (on the right side of the screen)

![image](https://github.com/myorm/graphql/assets/55516053/87c568c0-fcfb-49b4-b65b-df0e41ece63f)

As you navigate throughout the various custom object types that were defined by `MyORM`, you will see various other documentation like so:

![image](https://github.com/myorm/graphql/assets/55516053/c6e1ac93-3c55-4f6b-aa25-363c26dae687)

With this new endpoint, you can query your database using GraphQL syntax like so:

```
query {
    User {
        Id,
        FirstName
    }
}
```

The above query would generate the following MySQL command:

```sql
SELECT `User`.`Id` AS `Id`
		,`User`.`FirstName` AS `FirstName`
	FROM User AS User
```

As you can see, the command will be tailored based on the GraphQL query command provided.  

Here is another example, including the User's Roles

```
query {
    User {
        Id,
        FirstName,
        LastName,
        UserRoles {
            UserId,
            RoleId,
            Role {
                Id,
                Title,
                Description
            }
        }
    }
}
```

The above query would generate the following MySQL command:

```sql
SELECT `User`.`Id` AS `Id`
		,`User`.`FirstName` AS `FirstName`
		,`User`.`LastName` AS `LastName`
		,`__User_UserRoles__`.`UserId` AS `UserRoles<|UserId`
		,`__User_UserRoles__`.`RoleId` AS `UserRoles<|RoleId`
		,`__User_UserRoles_Role__`.`Id` AS `UserRoles<|Role<|Id`
		,`__User_UserRoles_Role__`.`Title` AS `UserRoles<|Role<|Title`
		,`__User_UserRoles_Role__`.`Description` AS `UserRoles<|Role<|Description`
	FROM User AS User
		LEFT JOIN `UserRoleXref` AS `__User_UserRoles__`
			ON `User`.`Id` = `__User_UserRoles__`.`UserId`
		LEFT JOIN `Role` AS `__User_UserRoles_Role__`
			ON `__User_UserRoles__`.`RoleId` = `__User_UserRoles_Role__`.`Id`
```

Here is an example using default arguments:

```
query {
    User(FirstName: "John", LastName: "Doe"){
        Id,
        FirstName,
        LastName,
        UserRoles {
            UserId,
            RoleId,
            Role {
                Id,
                Title,
                Description
            }
        }
    }
}
```

The above query would generate the following MySQL command:

```sql
SELECT `User`.`Id` AS `Id`
		,`User`.`FirstName` AS `FirstName`
		,`User`.`LastName` AS `LastName`
		,`__User_UserRoles__`.`UserId` AS `UserRoles<|UserId`
		,`__User_UserRoles__`.`RoleId` AS `UserRoles<|RoleId`
		,`__User_UserRoles_Role__`.`Id` AS `UserRoles<|Role<|Id`
		,`__User_UserRoles_Role__`.`Title` AS `UserRoles<|Role<|Title`
		,`__User_UserRoles_Role__`.`Description` AS `UserRoles<|Role<|Description`
	FROM User AS User
		LEFT JOIN `UserRoleXref` AS `__User_UserRoles__`
			ON `User`.`Id` = `__User_UserRoles__`.`UserId`
		LEFT JOIN `Role` AS `__User_UserRoles_Role__`
			ON `__User_UserRoles__`.`RoleId` = `__User_UserRoles_Role__`.`Id`
	WHERE `User`.`FirstName` = "John"
		AND `User`.LastName = "Doe"
```

## Generated behavior

`@myorm/graphql` generates all of the GraphQL object types, as well as the root query and root mutation types. With that being the case, it is important to know what you would all have access to.  

If there are any requests to have abilities to modify what can be generated, please open an issue [here](https://github.com/myorm/graphql/issues) specifically stating what should be done.

### Querying

The behavior that is generated using the `@myorm/graphql` plugin consists of allowing querying to the table using various optional filtering arguments that are added by default by each column.  

Each column as a filter checks for `equality` and expects the exact type as it appears in the database. Meaning, if you have a column, named `Foo`, as a `VARCHAR` column, then the GraphQL API will only accept an argument of type `string`, and it will ONLY check for equality.  

There may be columns you want different behavior, or you just don't want the behavior overall. In those cases, you can read the [Features](#features) section to learn more on how to work with your various filtering arguments.  

Additionally, with the default columns as filtering arguments, there will always be two arguments for all contexts, `skip`, and `take`. These filtering arguments allow you to automatically skip some records and/or limit the number of records you would like to retrieve.

## Features

Various features exist within the `@myorm/graphql` plugin, such as adding custom arguments, removing default arguments, or altering default arguments.

### Adding custom arguments

You can add custom arguments in the case that it would make more sense.  

For example, say you have a table called "Track" in a database that stores music, and you would like your GraphQL endpoint to be queried to receive all tracks where the duration of the track is between two numbers (in milliseconds). In this case, you may want two separate arguments called `DurationUpperBound` and `DurationLowerBound`.

To add an argument, you just provide a callback within the `.addContext()` function in the second argument, where the callback you provide has access to the function `addArgument`.  

`addArgument` takes in 3 arguments:
  - `argName`: `string` - Name of the argument as it should appear in GraphQL
  - `definitionCallback`: `function` - A callback that appears exactly as it does in `MyORM`'s `.where()` function, but this function has an additional paramter called `argVal`, which would be the argument value that was provided by the API caller.
  - `graphqlType`: `GraphQLScalarType` - A GraphQLScalarType that specifies what type the expected argument should be in the API. 

Here is an example using what was discussed above:

```ts
import { GraphQLInt } from 'graphql';
// ... initialization

gql.addContext(tracks, ({ addArgument }) => {
    addArgument("DurationUpperBound",
        (m,argVal) => m.DurationInMilliseconds.lessThanOrEqualTo(argVal), 
        GraphQLInt
    );
    addArgument("DurationLowerBound",
        (m,argVal) => m.DurationInMilliseconds.greaterThanOrEqualTo(argVal),
        GraphQLInt
    );
});
```

### Removing default arguments

You can remove default arguments that you would not like to see in the GraphQL API.

Just like [Adding custom arguments](#adding-custom-arguments), in the `.addContext()` function, you can remove any default arguments in the same configuration callback, where now you would have access to a function called `removeArgument`.  

`removeArgument` behaves in the same manner as `MyORM` does as a whole, where you would specify a callback gives access to a parameter called `model`, which would be the model of the table the context represents. All you have to do is reference the argument (or arguments) you would like to remove.

__NOTE: The `removeArgument` function can only remove default arguments, as there is no real reason to remove custom arguments **yet**__

Here is an example going off the example in [Adding custom arguments](#adding-custom-arguments), where we remove the original `Duration` field:

```ts
// ... initialization

gql.addContext(tracks, ({ removeArgument }) => {
    removeArgument(m => m.Duration);
    // removing multiple arguments
    removeArgument(m => [m.Duration, m.Foo]);
});
```

### Altering default arguments

You can alter default arguments that you would like to see different behavior in the GraphQL API.  

Altering default arguments is similar to `MyORM`'s approach to configuring relationships.

Here is an example going off the example in [Adding custom arguments](#adding-custom-arguments) and [Removing default arguments](#removing-default-arguments) where instead of removing the old `Duration` argument, we alter it so it instead takes a `string` that would expected to be two numbers separated by a dash (`-`), where the first number is the lower bound and the second number is the upper bound.

```ts
import { GraphQLString } from 'graphql';
// ... initialization

gql.addContext(tracks, ({ changeArgument }) => {
    changeArgument(m => m.Duration
        // optional: you can change the name of the argument here.
        .to("DurationRange") 
        // required: This is the behavior of how the argument should be handled.
        .as((m,argVal) => m.Duration.between(parseInt(argVal.split('-')[0]), parseInt(argVal.split('-')[1]))) 
        // required: type for GraphQL to expect in the API.
        .typedAs(GraphQLString) 
    );
});
```

## Other possibilites

### Mixing adapters

Since `@myorm/graphql` works on each context individually, it is allowed to connect multiple different contexts (as in, connected to different adapters) and therefore, different databases on different servers, and it will not affect the performance of any one context nor the GraphQL endpoint itself.