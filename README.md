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

You can also edit your database with the mutation object, containing respective `insert`, `update`, and `delete` functionalities.  

Each context will receive an edit root type, prepended respectively with `update`, `insert`, and `delete`.

If, for some reason, you would like to ignore certain functionalities of your mutation, you can pass into the `.addContext` function's fourth (4th) parameter, `mutationOptions` the respective disable property to disable such behavior.  

```ts
gql.addContext(someContext, undefined, undefined, { disableInserts: true });
```

The mutation object acts the same as the query object, with the exception of the return values for the `update` and `delete` query functions, where the return values will only ever be `numRowsAffected` which would be the total number of rows affected from the execution.  

Additionally, the `update` query function will automatically have double the parameters as the `query` query function, where one set of arguments are prepended with `filterBy_` and the other set being the arguments you use to choose what column to set the new value to.

Finally, in the `insert` and `update` query functions, any argument that is deemed to be a virtually generated column or an `identity` column (automatically increments within the database) will be omitted.

Here is an example of inserting a User.

```
mutation {
    insertUser(FirstName: "John", LastName: "Doe") {
        Id,
        John,
        Doe
    }
}
```

Here is an example of updating the User, "John Doe" to "Jane Doe". (assuming Id is `1`)

```
mutation {
    updateUser(filterBy_Id: 1, FirstName: "Jane") {
        numRowsAffected
    }
}
```

Here is an example of deleting the User, "Jane Doe" (assuming Id is `1`)

```
mutation {
    deleteUser(Id: 1) {
        numRowsAffected
    }
}
```

## Generated behavior

`@myorm/graphql` generates all of the GraphQL object types, as well as the root query and root mutation types. With that being the case, it is important to know what you would all have access to.  

If there are any requests to have abilities to modify what can be generated, please open an issue [here](https://github.com/myorm/graphql/issues) specifically stating what should be done.

### Querying

The behavior that is generated using the `@myorm/graphql` plugin consists of allowing querying to the table using various optional filtering arguments that are added by default by each column.  

Each column as a filter checks for `equality` and expects the exact type as it appears in the database. Meaning, if you have a column, named `Foo`, as a `VARCHAR` column, then the GraphQL API will only accept an argument of type `string`, and it will ONLY check for equality.  

There may be columns you want different behavior, or you just don't want the behavior overall. In those cases, you can read the [Features](#features) section to learn more on how to work with your various filtering arguments.  

Additionally, with the default columns as filtering arguments, there will always be two arguments for all contexts, `skip`, and `take`. These filtering arguments allow you to automatically skip some records and/or limit the number of records you would like to retrieve.

### Inserting

The behavior that is generated using the `@myorm/graphql` plugin consists of each context mutation to expect arguments that belong to the main schema for that table, while maintaining what columns are required and what are not.  

__NOTE: Columns marked as an identity column (one that auto increments) or is virtually generated is omitted from the arguments that can be accepted.__

### Updating

The behavior that is generated using the `@myorm/graphql` plugin consists of each context mutation to expect arguments that belong to the main schema for that table to be updated, but each argument is optional. Additionally, there will be an equal number of default-generated arguments that are prepended with `filterBy_`, which are what you would use to help determine which rows should get updated.

__NOTE: If, for some reason, the API call results in the update occurring to all records, then `MyORM` should throw an exception, unless the `allowUpdateOnAll` option is enabled.__

__NOTE: Columns marked as an identity column (one that auto increments) or is virtually generated is omitted from the arguments that can be accepted.__


### Deleting

The behavior that is generated using the `@myorm/graphql` plugin consists of each context mutation to expect arguments that belong to the main schema for that table to be used to determine what records should be deleted. This is similar to the `filterBy_` arguments in [Updating](#updating), so each argument will be optional.

__NOTE: If, for some reason, the API call results in the delete occurring to all records, then `MyORM` should throw an exception. There is no generated behavior that allows for truncation.__

## Arguments

Various features exist within the `@myorm/graphql` plugin, such as adding custom arguments, removing default arguments, or altering default arguments.

### Adding custom arguments

You can add custom arguments in the case that it would make more sense.  

__NOTE: This functionality is not available for `Insert`. For `Update` and `Delete`, the arguments will act as filter arguments.__  

For example, say you have a table called "Track" in a database that stores music, and you would like your GraphQL endpoint to be queried to receive all tracks where the duration of the track is between two numbers (in milliseconds). In this case, you may want two separate arguments called `DurationUpperBound` and `DurationLowerBound`.

To add an argument, you just provide a callback within the `.addContext()` function in the second argument, where the callback you provide has access to a single parameter which has 4 properties, `Query`, `Insert`, `Update`, and `Delete`. Each of these properties have the function `.addArgument`, which you can use to add an argument to its respective root `GraphQLObjectType`.

`addArgument` takes in 3 arguments:
  - `argName`: `{name: string, description?: string}` - Name and description of the argument as it should appear in GraphQL
  - `definitionCallback`: `function` - A callback that appears exactly as it does in `MyORM`'s `.where()` function, but this function has an additional paramter called `argVal`, which would be the argument value that was provided by the API caller.
  - `graphqlType`: `GraphQLScalarType` - A GraphQLScalarType that specifies what type the expected argument should be in the API. 

Here is an example using what was discussed above:

```ts
import { GraphQLInt } from 'graphql';
// ... initialization

gql.addContext(tracks, ({ Query }) => {
    Query.addArgument({
            name: "DurationUpperBound"
        },
        (m,argVal) => m.DurationInMilliseconds.lessThanOrEqualTo(argVal), 
        GraphQLInt
    );
    Query.addArgument({
            name: "DurationLowerBound"
        },
        (m,argVal) => m.DurationInMilliseconds.greaterThanOrEqualTo(argVal),
        GraphQLInt
    );
});
```

### Removing default arguments

You can remove default arguments that you would not like to see in the GraphQL API.

For example, say you have a table called "Track" in a database that stores music, and you would like your GraphQL endpoint to not be queried based on the duration at all. In this case, you would want to remove the ability to query by `Duration`.

To remove an argument, you just provide a callback within the `.addContext()` function in the second argument, where the callback you provide has access to a single parameter which has 4 properties, `Query`, `Insert`, `Update`, and `Delete`. Each of these properties have the function `.removeArgument`, which you can use to remove an argument to its respective root `GraphQLObjectType`.  

__NOTE: When using this function with `Insert`, the only arguments you are allowed to remove are optional arguments. This is to avoid any errors with database transactions.__  

Here is an example where we remove the original `Duration` field:

```ts
// ... initialization

gql.addContext(tracks, ({ Query }) => {
    Query.removeArgument(m => m.Duration);
    // removing multiple arguments (the same arguments we added from the previous .addArgument example.)
    Query.removeArgument(m => [m.FileSize, m.Name]);
});
```

### Altering default arguments

You can alter default arguments on Query arguments that you would like to see different behavior in the GraphQL API.  

For example, say you have a table called "Track" in a database that stores music, and you would like your GraphQL endpoint to have the `Bytes` column to be queried from a string, rather than an integer, where the string would be expected to be two numbers separated by a dash (-), implying a range of numbers.

To change an argument, you just provide a callback within the `.addContext()` function in the second argument, where the callback you provide has access to a single parameter which has 4 properties, `Query`, `Insert`, `Update`, and `Delete`. Each of these properties have the function `.changeArgument`, which you can use to change an argument to its respective root `GraphQLObjectType`.  

With the `.changeArgument` function, it will also remove the old argument that you reference in the callback you provide.  
The dereferenced variable returns an object containing four (4) functions:  
  - `.definedAs`: Accepts a callback function that has access to two parameters, `model` and `argVal`, where `model` is the model that the context represents. This is to be treated like a regular `.where()` function in `MyORM`, except the value intended to be used is `argVal`.
  - `.describedAs`: Accepts a string which would be the new definition for the argument.
  - `.namedAs`: Accepts a string which would be the new name for the argument.
  - `.typedAs`: Accepts a `GraphQLScalarType` which would be the new type for the argument.

__NOTE: Any edit query type does not have access to the `.definedAs` and `.typedAs` functions, as the original behavior for these arguments is required for the plugin to work as intended.__  

Each of these functions are optional and can be used in any order. However, if `.definedAs()` is used with a different expected argument value, then `.typedAs()` should also be used, otherwise, GraphQL will throw an error about an unexpected argument type.  

TypeScript will dynamically change the functions that are available based on what has and has not been used.


```ts
import { GraphQLString } from 'graphql';
// ... initialization

gql.addContext(tracks, ({ Query }) => {
    Query.changeArgument(m => m.Duration
        // optional: this is the behavior of how the argument should be handled. 
        //   (NOTE: If the type of `argVal` is different than the intended argument type, then `.typedAs` must be used, 
        //   otherwise GraphQL will throw an error if the argument is used.)
        .definedAs((m,argVal) => m.Duration.between(parseInt(argVal.split('-')[0]), parseInt(argVal.split('-')[1]))) 
        // optional: type for GraphQL to expect in the API.
        .typedAs(GraphQLString) 
        // optional: you can change the name of the argument here.
        .namedAs("DurationRange")
        // optional: you can change the description from the normal description.
        .describedAs("some description") 
    );
});
```

## Other possibilites

### Mixing adapters

Since `@myorm/graphql` works on each context individually, it is allowed to connect multiple different contexts (as in, connected to different adapters) and therefore, different databases on different servers, and it will not affect the performance of any one context nor the GraphQL endpoint itself.