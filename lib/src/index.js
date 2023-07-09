//@ts-check
import { MyORMContext } from '@myorm/myorm';
import {
    GraphQLObjectType,
    GraphQLList,
    GraphQLNonNull,
    GraphQLString,
    GraphQLInt,
    GraphQLFloat,
    GraphQLBoolean,
    GraphQLScalarType
}  from 'graphql';
import pluralize from 'pluralize';

const { singular } = pluralize;

const numRowsAffectedObjectType = new GraphQLObjectType({
    name: 'NumberOfRowsAffectedType',
    description: 'Number of rows affected by the database transaction.',
    fields: () => ({
        numRowsAffected: {
            type: GraphQLInt,
            description: 'Total number of rows affected by the transaction.'
        }
    })
});

/**
 * Object to set up and configure for usage of dynamically creating `GraphQL` root query and mutation types.
 */
export class MyORMGraphQL {
    /** @type {string} */ #name;
    /** @type {{[key: string]: { context: MyORMContext, description?: string, userDefinedArgs: {[key: string]: { description?: string, type?: GraphQLScalarType, handler: (model: import('@myorm/myorm').ChainObject<any>, argValue: any) => void}}, ignoredArgs: string[] }}} */ #contexts;

    /**
     * Construct a new MyORMGraphQL object for use within NodeJS' `graphql` library.
     * @param {string} name
     * Name to prepend to all constructed object types associated with the determined record types for each context passed in.
     */
    constructor(name) {
        this.#name = name;
        this.#contexts = {};
    }

    /**
     * Add a new context to this instance of `MyORMGraphQL` to generate a root query/mutation type.
     * @template TContext
     * Generic parameter representing the actual `MyORMContext` type being worked on from `context`.
     * @param {TContext extends MyORMContext<infer T, infer U> ? TContext : never} context
     * Context being added to this. 
     * @param {((functions: ContextConfigurationCallback<TContext extends MyORMContext<infer T, infer U> ? U : never>) => void)=} configurationCallback
     * Configuration callback used to add extra arguments to querying functions.
     * @param {{ name?: string, description?: string }=} details
     * Extra details that can be given to the root object type.
     * @returns {this}
     * Reference back to the same `MyORMGraphQL` object for usage of chaining.
     */
    addContext(context, configurationCallback=undefined, details={name:undefined, description:undefined}) {
        let { name, description } = details;
        //@ts-ignore _table is marked protected, but we need to use it here.
        const $table = context._table;
        const ctxName = name ?? $table;
        description = description ?? `All records from the MyORM context representing the database table, "${$table}".`;
        this.#contexts[ctxName] = {
            context,
            description,
            userDefinedArgs: {},
            ignoredArgs: []
        };
        
        if(configurationCallback) {
            configurationCallback({
                addArgument: (d,g,c) => this.#addArgument(ctxName, d,g, /** @type {any} */ (c)),
                removeArgument: (c) => this.#removeArgument(ctxName, /** @type {any} */ (c)),
                changeArgument: (c) => this.#changeArgument(ctxName, /** @type {any} */ (c))
            });
        }
        return this;
    }

    /**
     * Create a new Object Type for all contexts connected to this MyGraphQL instance, to be used within a `GraphQLSchema` object as a "Root Query" context.
     * @param {string=} name 
     * Name to be given to the Object Type.
     * @param {string=} description 
     * Description to be given to the Object Type.
     * @returns {Promise<GraphQLObjectType>}
     * A GraphQLObjectType instance to be used within the NodeJS library, `graphql`.
     */
    async createRootQueryObject(name, description) {
        const config = await this.#getObjectTypeConfig(name, description);
        return new GraphQLObjectType(config);
    }

    /**
     * Create a new Object Type for all contexts connected to this MyGraphQL instance, to be used within a `GraphQLSchema` object as a "Root Mutation" context.
     * @param {string=} name 
     * Name to be given to the Object Type.
     * @param {string=} description 
     * Description to be given to the Object Type.
     * @returns {Promise<GraphQLObjectType>}
     * A GraphQLObjectType instance to be used within the NodeJS library, `graphql`.
     */
    async createRootMutationObject(name, description) {
        const config = await this.#getMutationObjectTypeConfig(name, description);
        return new GraphQLObjectType(config);
    }

    /**
     * Get a `GraphQLObjectType` for the given `ctx` for querying records, given extra information.
     * @param {MyORMContext} ctx
     * Context to construct the `GraphQLObjectType` from.
     * @param {string} $table
     * Table that `ctx` represents.
     * @param {{[x: string]: import('@myorm/myorm').DescribedSchema}} $schema
     * Schema of the table that `ctx` represents.
     * @param {Record<string, any>} $relationships
     * Relationships to the table that `ctx` was configured with.
     * @param {string=} alias
     * Alias of the name the `GraphQLObjectType` should be given.
     * @param {string=} description
     * Description the `GraphQLObjectType` should be given.
     */
    #getQueryObjectTypeConfigForContext(ctx, $table, $schema, $relationships, alias="", description="") {
        const ctxDetails = this.#contexts[alias ?? $table];

        /** @type {import('graphql').GraphQLFieldConfigMap<any, any>} */
        let fields = {};
        
        // define primitive keys in the schema.
        for(const key in $schema) {
            fields[key] = {
                type: getGraphQLType(key, $schema[key].datatype, $schema[key].isNullable || $schema[key].isIdentity),
                description: `Property that represents the column, "${key}", within the table represented by MyORM as "${$table}"`
            };
        }
        
        // define relationship schemas.
        fields = rDefine($relationships, fields, $table);

        const type = new GraphQLObjectType({
            name: `${alias === "" ? $table : alias}Records`,
            description: `Model representing records from "${$table}".`,
            fields: () => fields
        });

        // arguments used to filter on the records.
        const args = {
            // static arguments that exist on all defined object types.
            skip: {
                type: GraphQLInt,
                description: 'Number of records to skip. (this will not work unless "take" is also provided)'
            },
            take: {
                type: GraphQLInt,
                description: 'Number of records to retrieve.'
            },
            // other arguments that can be optionally passed.
            ...Object.fromEntries(Object.keys($schema)
                .filter(k => !ctxDetails.ignoredArgs.includes(k))
                .map(k => [k, { 
                    type: getGraphQLType(k, $schema[k].datatype, true) 
                }])),
            // user defined arguments
            ...Object.fromEntries(Object.keys(ctxDetails.userDefinedArgs)
                .filter(k => !ctxDetails.ignoredArgs.includes(k))
                .map(k => [k, { 
                    type: ctxDetails.userDefinedArgs[k].type ?? getGraphQLType(k, $schema[k]?.datatype, true), 
                    description: ctxDetails.userDefinedArgs[k].description 
                }]))
        };
        
        return {
            type: new GraphQLList(type),
            description,
            args,
            resolve: async (_, args, __, resolvers) => {
                // create an isolated variable for the context, so that the original context remains untouched.
                let resolveCtx = ctx; 
                
                // unpack the arguments.
                const { skip, take, ...dynamicArgs } = args;
                
                // function to choose the columns to grab based on what the user has selected from their gql query.
                const selectFields = (selections, m) => {
                    return selections.flatMap(s => {
                        if(s.selectionSet) {
                            return selectFields(s.selectionSet.selections, m[s.name.value]);
                        }
                        return m[s.name.value];
                    });
                };

                // function to choose the relationships to include based on what the user selected from their gql query.
                const selectIncludes = (selections, m) => {
                    let o;
                    for(const s of selections) {
                        if(s.selectionSet) {
                            o = m[s.name.value].thenInclude(m => selectIncludes(s.selectionSet.selections, m));
                        }
                    }
                    return o;
                }
                
                // append sequential conditions for each dynamic argument that was passed in by the user.
                for(const argKey in dynamicArgs) {
                    if(argKey in ctxDetails.userDefinedArgs) {
                        resolveCtx = resolveCtx.where(m => ctxDetails.userDefinedArgs[argKey].handler(m, dynamicArgs[argKey]));
                    } else {
                        // @ts-ignore when using generic types, .eq displays an error
                        resolveCtx = resolveCtx.where(m => m[argKey].eq(dynamicArgs[argKey]));
                    }
                }
                
                // append sequential conditions for each static argument that was passed in by the user.
                if(take) {
                    resolveCtx = resolveCtx.take(take);
                    if(skip) {
                        resolveCtx = resolveCtx.skip(skip);
                    }
                }
                // include the appropriate relationships.
                resolveCtx = resolveCtx.include(m => selectIncludes(resolvers.fieldNodes[0].selectionSet?.selections, m));

                // query the database using the columns the user requested.
                const results = await resolveCtx.select(m => selectFields(resolvers.fieldNodes[0].selectionSet?.selections, m));
                return results;
            }
        };
    }

    /**
     * Get a `GraphQLObjectType` for the given `ctx` for inserting records, given extra information.
     * @param {MyORMContext} ctx
     * Context to construct the `GraphQLObjectType` from.
     * @param {string} $table
     * Table that `ctx` represents.
     * @param {{[x: string]: import('@myorm/myorm').DescribedSchema}} $schema
     * Schema of the table that `ctx` represents.
     * @param {Record<string, any>} $relationships
     * Relationships to the table that `ctx` was configured with.
     * @param {string=} alias
     * Alias of the name the `GraphQLObjectType` should be given.
     * @param {string=} description
     * Description the `GraphQLObjectType` should be given.
     */
    #getInsertObjectTypeConfigForContext(ctx, $table, $schema, $relationships, alias = "", description = "") {
        const ctxDetails = this.#contexts[alias ?? $table];

        /** @type {import('graphql').GraphQLFieldConfigMap<any, any>} */
        let fields = {};

        // define primitive keys in the schema.
        for (const key in $schema) {
            fields[key] = {
                type: getGraphQLType(key, $schema[key].datatype, $schema[key].isNullable),
                description: `Property that represents the column, "${key}", within the table represented by MyORM as "${$table}"`
            };
        }

        const type = new GraphQLObjectType({
            name: `${alias === "" ? $table : alias}`,
            description: `Model representing records from "${$table}".`,
            fields: () => fields
        });

        // arguments used to filter on the records.
        const args = {
            // other arguments that can be optionally passed.
            ...Object.fromEntries(Object.keys($schema)
                .filter(k => !ctxDetails.ignoredArgs.includes(k))
                .map(k => [k, {
                    type: getGraphQLType(k, $schema[k].datatype, $schema[k].isNullable || $schema[k].isIdentity),
                    description: `Use this argument for the initial value for the column, "${k}".${$schema[k].isNullable || $schema[k].isIdentity ? "" : " (required)"}`
                }]))
        };

        return {
            type: GraphQLList(type),
            description,
            args,
            resolve: async (_, args, __, resolvers) => {
                return await ctx.insert(args);
            }
        };
    }

    /**
     * Get a `GraphQLObjectType` for the given `ctx` for updating records, given extra information.
     * @param {MyORMContext} ctx
     * Context to construct the `GraphQLObjectType` from.
     * @param {string} $table
     * Table that `ctx` represents.
     * @param {{[x: string]: import('@myorm/myorm').DescribedSchema}} $schema
     * Schema of the table that `ctx` represents.
     * @param {Record<string, any>} $relationships
     * Relationships to the table that `ctx` was configured with.
     * @param {string=} alias
     * Alias of the name the `GraphQLObjectType` should be given.
     * @param {string=} description
     * Description the `GraphQLObjectType` should be given.
     */
    #getUpdateObjectTypeConfigForContext(ctx, $table, $schema, $relationships, alias = "", description = "") {
        const ctxDetails = this.#contexts[alias ?? $table];

        // arguments used to filter on the records.
        const args = {
            // other arguments that can be optionally passed.
            ...Object.fromEntries(Object.keys($schema)
                .filter(k => !ctxDetails.ignoredArgs.includes(k))
                .map(k => [`filterBy_${k}`, {
                    type: getGraphQLType(k, $schema[k].datatype, true),
                    description: `Use this argument to check equality for "${k}" to determine what record(s) to update.`
                }])),
            ...Object.fromEntries(Object.keys($schema)
                .filter(k => !ctxDetails.ignoredArgs.includes(k))
                .map(k => [k, {
                    type: getGraphQLType(k, $schema[k].datatype, true),
                    description: `Use this argument to set the column "${k}" for all records qualified for update.`
                }]))
        };

        return {
            type: numRowsAffectedObjectType,
            description,
            args,
            resolve: async (_, args, __, resolvers) => {
                const filterArgs = Object.fromEntries(Object.entries(args).filter(([k,v]) => k.startsWith("filterBy_")));
                const updateArgs = Object.fromEntries(Object.entries(args).filter(([k,v]) => !k.startsWith("filterBy_")));
                let resolveCtx = ctx;
                for (const argKey in filterArgs) {
                    // @ts-ignore when using generic types, .eq displays an error
                    resolveCtx = resolveCtx.where(m => m[argKey.replace('filterBy_', '')].eq(args[argKey]));
                }
                return {
                    numRowsAffected: await resolveCtx.update(() => updateArgs)
                };
            }
        };
    }

    /**
     * Get a `GraphQLObjectType` for the given `ctx` for deleting records, given extra information.
     * @param {MyORMContext} ctx
     * Context to construct the `GraphQLObjectType` from.
     * @param {string} $table
     * Table that `ctx` represents.
     * @param {{[x: string]: import('@myorm/myorm').DescribedSchema}} $schema
     * Schema of the table that `ctx` represents.
     * @param {Record<string, any>} $relationships
     * Relationships to the table that `ctx` was configured with.
     * @param {string=} alias
     * Alias of the name the `GraphQLObjectType` should be given.
     * @param {string=} description
     * Description the `GraphQLObjectType` should be given.
     */
    #getDeleteObjectTypeConfigForContext(ctx, $table, $schema, $relationships, alias = "", description = "") {
        const ctxDetails = this.#contexts[alias ?? $table];

        // arguments used to filter on the records.
        const args = {
            // other arguments that can be optionally passed.
            ...Object.fromEntries(Object.keys($schema)
                .filter(k => !ctxDetails.ignoredArgs.includes(k))
                .map(k => [k, {
                    type: getGraphQLType(k, $schema[k].datatype, true),
                    description: `Delete a record from ${$table} by checking equality of ${k}.`
                }]))
        };

        return {
            type: numRowsAffectedObjectType,
            description,
            args,
            resolve: async (_, args, __, resolvers) => {
                let resolveCtx = ctx;
                for(const argKey in args) {
                    // @ts-ignore when using generic types, .eq displays an error
                    resolveCtx = resolveCtx.where(m => m[argKey].eq(args[argKey]));
                }
                return {
                    numRowsAffected: await resolveCtx.delete()
                };
            }
        };
    }

    /**
     * Constructs a `GraphQLObject` meant for usage as a root query object type.
     * @param {string=} name 
     * Name the `GraphQLObjectType` should be given. 
     * @param {string=} description 
     * Description the `GraphQLObjectType` should be given.
     * @returns {Promise<import('graphql').GraphQLObjectTypeConfig<any,any>>}
     */
    async #getObjectTypeConfig(name = this.#name, description = `Represents the method type to query records from all contexts connected to "${this.#name}".`) {
        /** @type {import('graphql').GraphQLFieldConfigMap<any, any>} */
        const rootFields = {};
        // loop through each context
        for (let ctxKey in this.#contexts) {
            const ctx = this.#contexts[ctxKey].context;
            // @ts-ignore marked protected, but available for use here.
            const $promise = ctx._promise;
            await $promise;
            // @ts-ignore marked protected, but available for use here.
            const $table = ctx._table, $schema = ctx._schema, $relationships = ctx._relationships;

            rootFields[ctxKey] = this.#getQueryObjectTypeConfigForContext(ctx, $table, $schema, $relationships, ctxKey, this.#contexts[ctxKey].description);
        }

        return {
            name: `${name}_query`,
            description,
            fields: () => rootFields
        };
    }

    /**
     * Constructs a `GraphQLObject` meant for usage as a root mutation object type.
     * @param {string=} name 
     * Name the `GraphQLObjectType` should be given. 
     * @param {string=} description 
     * Description the `GraphQLObjectType` should be given.
     * @returns {Promise<import('graphql').GraphQLObjectTypeConfig<any,any>>}
     */
    async #getMutationObjectTypeConfig(name=this.#name, description=`Represents the method type to insert/update/delete records in all contexts connected to "${this.#name}".`) {
        /** @type {import('graphql').GraphQLFieldConfigMap<any, any>} */
        const rootFields = {};
        // loop through each context
        for (let ctxKey in this.#contexts) {
            const ctx = this.#contexts[ctxKey].context;
            // @ts-ignore marked protected, but available for use here.
            const $promise = ctx._promise;
            await $promise;
            // @ts-ignore marked protected, but available for use here.
            const $table = ctx._table, $schema = ctx._schema, $relationships = ctx._relationships;

            rootFields[`insert${singular(ctxKey)}`] = this.#getInsertObjectTypeConfigForContext(ctx, $table, $schema, $relationships, ctxKey, `Insert a record into the "${$table}" database table.`);
            rootFields[`update${singular(ctxKey)}`] = this.#getUpdateObjectTypeConfigForContext(ctx, $table, $schema, $relationships, ctxKey, `Update a record in the "${$table}" database table.`);
            rootFields[`delete${singular(ctxKey)}`] = this.#getDeleteObjectTypeConfigForContext(ctx, $table, $schema, $relationships, ctxKey, `Delete a record from the "${$table}" database table.`);
        }

        return {
            name: `${name}_mutation`,
            description,
            fields: () => rootFields
        };
    }

    /**
     * `addArgument` function that is passed to the configuration callback in the second argument of `.addContext()`.
     * @param {string} name 
     * @param {{name: string, description?: string}} details 
     * @param {GraphQLScalarType} graphqlArgType 
     * @param {*} callback 
     */
    #addArgument(name, details, graphqlArgType, callback) {
        const ctxDetails = this.#contexts[name];
        ctxDetails.userDefinedArgs[details.name] = {
            description: details.description,
            handler: callback,
            type: graphqlArgType
        };
    }

    /**
     * `removeArgument` function that is passed to the configuration callback in the second argument of `.addContext()`.
     * @param {string} name 
     * @param {*} callback 
     */
    #removeArgument(name, callback) {
        const ctxDetails = this.#contexts[name];
        callback(new Proxy({}, {
            get: (t,p,r) => {
                if(typeof p === "symbol") throw Error(`Expected string property in object dereference, but got symbol. (${String(p)})`);
                ctxDetails.ignoredArgs.push(p);
            }
        }));
    }

    /**
     * `changeArgument` function that is passed to the configuration callback in the second argument of `.addContext()`.
     * @param {string} name
     * @param {*} callback
     */
    #changeArgument(name, callback) {
        const ctxDetails = this.#contexts[name];
        callback(new Proxy({}, {
            get: (t,p,r) => {
                if(typeof p === "symbol") throw Error(`Expected string property in object dereference, but got symbol. (${String(p)})`);
                return {
                    as: (newName) => {
                        return {
                            to: (newDefinition) => {
                                ctxDetails.userDefinedArgs[newName] = {
                                    handler: newDefinition
                                };
                                ctxDetails.ignoredArgs.push(p);
                                return {
                                    typedAs: (gqlType) => {
                                        ctxDetails.userDefinedArgs[newName].type = gqlType;
                                    }
                                }
                            }
                        }
                    },
                    to: (newDefinition) => {
                        ctxDetails.userDefinedArgs[p] = {
                            handler: newDefinition
                        };
                        return {
                            typedAs: (gqlType) => {
                                ctxDetails.userDefinedArgs[p].type = gqlType;
                            }
                        }
                    }
                }
            }
        }))
    }
}

/**
 * Get the `GraphQLScalarType` based on the type assigned by `MyORM`.
 * @param {string} name
 * @param {"string"|"int"|"float"|"boolean"|"date"} type 
 * @param {boolean} nullable
 */
function getGraphQLType(name, type, nullable) {
    let gqlType = null;
    switch(type) {
        case "string": gqlType = GraphQLString; break;
        case "int": gqlType = GraphQLInt; break;
        case "float": gqlType = GraphQLFloat; break;
        case "boolean": gqlType = GraphQLBoolean; break;
        case "date": gqlType = GraphQLString; break;
        default: throw Error(`Could not determine type of ${name}. (MyORM determined type: ${type})`);
    }
    if(nullable) {
        return gqlType;
    }
    return GraphQLNonNull(gqlType);
}

/**
 * Recursively defines `GraphQLObjectType` objects for usage in the `fields` property of another `GraphQLObjectType`.
 * @param {*} relationships 
 * @param {*} fields 
 * @returns {import('graphql').GraphQLFieldConfigMap<any, any>}
 */
function rDefine(relationships, fields, table) {
    if(!relationships) return fields;
    for(const key in relationships) {
        /** @type {import('graphql').GraphQLFieldConfigMap<any, any>} */
        let includedFields = {};
        for(const k in relationships[key].schema) {
            includedFields[k] = {
                type: getGraphQLType(key, relationships[key].schema[k].datatype, relationships[key].schema[k].isNullable),
                description: `Property that represents the column, "${key}", within the table represented by MyORM as "${table}"`
            };
        }
        includedFields = rDefine(relationships[key].relationships, includedFields, key);
        let type = new GraphQLObjectType({
            name: `${singular(key)}Record${relationships[key].type === "1:n" ? "Array" : ""}`,
            description: `Model representing records from "${key}" that is a relationship from the table, "${table}".`,
            fields: () => includedFields
        });
        if(relationships[key].type === "1:n") {
            fields[key] = {
                type: GraphQLList(type),
                description: `Records from the table, "${relationships[key].foreign.table}", that relate to another table, "${relationships[key].primary.table}".`
            };
        } else {
            fields[key] = {
                type,
                description: `Record from the table, "${relationships[key].foreign.table}", that relate to another table, "${relationships[key].primary.table}".`
            }
        }
    }
    return fields;
}

/**
 * Various callback tools to allow the user to work with arguments in their GraphQL schema.
 * @template {import('@myorm/myorm').SqlTable} T
 * @typedef {object} ContextConfigurationCallback
 * @prop {AddArgumentCallback<T>} addArgument
 * Add a custom argument to your GraphQL schema.
 * @prop {RemoveArgumentCallback<T>} removeArgument
 * Remove an automatically generated argument from your GraphQL schema.
 * @prop {ChangeArgumentCallback<T>} changeArgument
 * Change the definition of an automatically generated argument in your GraphQL schema.
 */

/**
 * Callback that can be used to add a custom argument into the GraphQL schema.
 * @template {import('@myorm/myorm').SqlTable} T
 * @callback AddArgumentCallback
 * @param {{name: string, description?: string}} details
 * @param {GraphQLScalarType} graphqlArgType
 * @param {(model: import('@myorm/myorm').ChainObject<T>, argValue: any) => void} callback
 */

/**
 * Callback that can be used to remove an argument (automatically generated) from the GraphQL schema.
 * @template T
 * @callback RemoveArgumentCallback
 * @param {(model: {[K in keyof T]: any}) => void} callback 
 */

/**
 * Callback that can be used to change an argument (automatically generated) in the GraphQL schema.
 * @template {import('@myorm/myorm').SqlTable} T
 * @callback ChangeArgumentCallback
 * @param {(model: {[K in keyof T]: ChangeArgumentCallbackModel<T>}) => void} callback 
 * Model that represents the original table of the context being added, remapped so values are instead {@link ChangeArgumentCallbackModel} types.
 */

/**
 * Functions to be used for changing an existing (automaticlly generated) argument.
 * @template {import('@myorm/myorm').SqlTable} T
 * @typedef {object} ChangeArgumentCallbackModel
 * @prop {ChangeArgumentAsCallback<T>} as
 * Provide a new name for the argument.
 * @prop {ChangeArgumentToCallback<T>} to 
 * Provide a new definition for the filter.
 */

/**
 * Provide a new name for the argument.
 * @template {import('@myorm/myorm').SqlTable} T
 * @callback ChangeArgumentAsCallback
 * @param {string} newName
 * New name for the argument.
 * @returns {{to: ChangeArgumentToCallback<T>}}
 * Provide a new definition for the filter.
 */

/**
 * Provide a new definition for the filter of the argument.
 * @template {import('@myorm/myorm').SqlTable} T
 * @callback ChangeArgumentToCallback
 * @param {AlteredWhereCallback<T>} newDefinition
 * Callback that will be augmented and passed into `MyORM`'s `.where()` function.
 * @returns {{ typedAs: ChangeArgumentTypedAsCallback }}
 */

/**
 * The Where callback that appears in `MyORM`, slightly altered to have an extra parameter, `argValue` passed in.
 * @template {import('@myorm/myorm').SqlTable} T
 * @callback AlteredWhereCallback
 * @param {import('@myorm/myorm').ChainObject<T>} model
 * Original model that would be used to create conditions on. (similar to `model` in `MyORM`'s `.where(model => model.Foo.equals(...))`.)
 * @param {any} argValue
 * The value from the user that queries the GraphQL endpoint.
 * @returns {void}
 */

/**
 * Provide a new type for the argument.
 * @callback ChangeArgumentTypedAsCallback
 * @param {GraphQLScalarType} gqlType
 * New type given to the argument.
 * @returns {void}
 */