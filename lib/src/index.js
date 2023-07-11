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
 * @typedef {object} UserDefinedArguments
 * @prop {string=} description
 * @prop {GraphQLScalarType} type
 * @prop {(model: import('@myorm/myorm').ChainObject<any>, argValue: any) => void} handler
 */

/**
 * @typedef {object} ContextDetails
 * @prop {MyORMContext} context
 * @prop {string=} description
 * @prop {{customArgs: {[key: string]: UserDefinedArguments}, ignoredArgs: string[]}} queryCustomArgs
 * @prop {{customArgs: {[key: string]: UserDefinedArguments}, ignoredArgs: string[]}} insertCustomArgs
 * @prop {{customArgs: {[key: string]: UserDefinedArguments}, ignoredArgs: string[]}} updateCustomArgs
 * @prop {{customArgs: {[key: string]: UserDefinedArguments}, ignoredArgs: string[]}} deleteCustomArgs
 * @prop {MyORMGraphQLOptions} mutationOptions
 */

/**
 * Various options to alter the behavior of the GraphQL mutation root type.
 * @typedef {object} MyORMGraphQLOptions
 * @prop {boolean=} disableDeletes
 * Disable the ability to delete rows using the `mutation` root type.
 * @prop {boolean=} disableInserts
 * Disable the ability to insert rows using the `mutation` root type.
 * @prop {boolean=} disableUpdates
 * Disable the ability to update rows using the `mutation` root type.
 */

/**
 * Object to set up and configure for usage of dynamically creating `GraphQL` root query and mutation types.
 */
export class MyORMGraphQL {
    /** @type {string} */ #name;
    /** @type {{[key: string]: ContextDetails}} */ #contexts;
    /** @type {Record<string, GraphQLObjectType>} */ #objectTypes;

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
     * @param {((functions: ContextConfigurationCallbackModel<TContext extends MyORMContext<infer T, infer U> ? U : never>) => void)=} configurationCallback
     * Configuration callback used to add extra arguments to querying functions.
     * @param {{ name?: string, description?: string }=} details
     * Extra details that can be given to the root object type.
     * @param {MyORMGraphQLOptions=} mutationOptions
     * Various options to alter the behavior of the GraphQL mutation root type.
     * @returns {this}
     * Reference back to the same `MyORMGraphQL` object for usage of chaining.
     */
    addContext(context, configurationCallback=undefined, details=undefined, mutationOptions={ }) {
        let { name, description } = details ?? { name: undefined, description: undefined };
        //@ts-ignore _table is marked protected, but we need to use it here.
        const $table = context._table;
        const ctxName = name ?? $table;
        description = description ?? `All records from the MyORM context representing the database table, "${$table}".`;
        this.#contexts[ctxName] = {
            context,
            description,
            queryCustomArgs: {
                customArgs: {},
                ignoredArgs: []
            },
            insertCustomArgs: {
                customArgs: {},
                ignoredArgs: []
            },
            updateCustomArgs: {
                customArgs: {},
                ignoredArgs: []
            },
            deleteCustomArgs: {
                customArgs: {},
                ignoredArgs: []
            },
            mutationOptions: {
                disableDeletes: false,
                disableInserts: false,
                disableUpdates: false,
                ...mutationOptions
            }
        };
        this.#objectTypes = {};
        
        if(configurationCallback) {
            configurationCallback({
                Query: {
                    addArgument: (d,g,c) => this.#addArgument(this.#contexts[ctxName].queryCustomArgs, d,g, /** @type {any} */ (c)),
                    removeArgument: (c) => this.#removeArgument(this.#contexts[ctxName].queryCustomArgs, /** @type {any} */(c)),
                    changeArgument: (c) => this.#changeArgument(this.#contexts[ctxName].queryCustomArgs, /** @type {any} */(c))
                },
                Insert: {
                    removeArgument: (c) => this.#removeArgument(this.#contexts[ctxName].insertCustomArgs, /** @type {any} */(c)),
                    changeArgument: (c) => this.#changeArgument(this.#contexts[ctxName].insertCustomArgs, /** @type {any} */(c))
                },
                Update: {
                    addArgument: (d, g, c) => this.#addArgument(this.#contexts[ctxName].updateCustomArgs, d, g, /** @type {any} */(c)),
                    removeArgument: (c) => this.#removeArgument(this.#contexts[ctxName].updateCustomArgs, /** @type {any} */(c)),
                    changeArgument: (c) => this.#changeArgument(this.#contexts[ctxName].updateCustomArgs, /** @type {any} */(c))
                },
                Delete: {
                    addArgument: (d, g, c) => this.#addArgument(this.#contexts[ctxName].deleteCustomArgs, d, g, /** @type {any} */(c)),
                    removeArgument: (c) => this.#removeArgument(this.#contexts[ctxName].deleteCustomArgs, /** @type {any} */(c)),
                    changeArgument: (c) => this.#changeArgument(this.#contexts[ctxName].deleteCustomArgs, /** @type {any} */(c))
                },
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
        fields = rDefine($relationships, fields, $table, this.#objectTypes);

        const name = `${alias === "" ? $table : alias}Records`;
        /** @type {GraphQLObjectType} */
        let type;
        if(name in this.#objectTypes) {
            type = this.#objectTypes[name];
        } else {
            type = this.#objectTypes[name] = new GraphQLObjectType({
                name,
                description: `Model representing records from "${$table}".`,
                fields: () => fields
            });
        }

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
                .filter(k => !ctxDetails.queryCustomArgs.ignoredArgs.includes(k))
                .map(k => [k, { 
                    type: getGraphQLType(k, $schema[k].datatype, true) 
                }])),
            // user defined arguments
            ...Object.fromEntries(Object.keys(ctxDetails.queryCustomArgs.customArgs)
                .filter(k => !ctxDetails.queryCustomArgs.ignoredArgs.includes(k))
                .map(k => [k, { 
                    type: ctxDetails.queryCustomArgs.customArgs[k].type ?? getGraphQLType(k, $schema[k]?.datatype, true), 
                    description: ctxDetails.queryCustomArgs.customArgs[k].description 
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
                    if(argKey in ctxDetails.queryCustomArgs.customArgs) {
                        resolveCtx = resolveCtx.where(m => ctxDetails.queryCustomArgs.customArgs[argKey].handler(m, dynamicArgs[argKey]));
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

        const name = `${alias === "" ? $table : alias}Records`;
        /** @type {GraphQLObjectType} */
        let type;
        if(name in this.#objectTypes) {
            type = this.#objectTypes[name];
        } else {
            type = this.#objectTypes[name] = new GraphQLObjectType({
                name,
                description: `Model representing records from "${$table}".`,
                fields: () => fields
            });
        }

        // arguments used to filter on the records.
        const args = {
            // custom arguments defined by User.
            ...Object.fromEntries(Object.entries(ctxDetails.insertCustomArgs.customArgs).map(([k,v]) => [k, {
                type: v.type,
                description: v.description
            }])),
            // other arguments that can be optionally passed.
            ...Object.fromEntries(Object.keys($schema)
                .filter(k => !ctxDetails.insertCustomArgs.ignoredArgs.includes(k) && !$schema[k].isIdentity && !$schema[k].isVirtual)
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
            // custom arguments defined by User.
            ...Object.fromEntries(Object.entries(ctxDetails.updateCustomArgs.customArgs).map(([k, v]) => [k, {
                type: v.type,
                description: v.description
            }])),
            // other arguments that can be optionally passed.
            ...Object.fromEntries(Object.keys($schema)
                .filter(k => !ctxDetails.updateCustomArgs.ignoredArgs.includes(k))
                .map(k => [`filterBy_${k}`, {
                    type: getGraphQLType(k, $schema[k].datatype, true),
                    description: `Use this argument to check equality for "${k}" to determine what record(s) to update.`
                }])),
            ...Object.fromEntries(Object.keys($schema)
                .filter(k => !ctxDetails.updateCustomArgs.ignoredArgs.includes(k) && !$schema[k].isIdentity && !$schema[k].isVirtual)
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
                const filterArgs = Object.fromEntries(Object.entries(args).filter(([k,v]) => k.startsWith("filterBy_") || k in ctxDetails.updateCustomArgs.customArgs));
                const updateArgs = Object.fromEntries(Object.entries(args).filter(([k,v]) => !k.startsWith("filterBy_")));
                let resolveCtx = ctx;
                for (let argKey in filterArgs) {
                    if(argKey in ctxDetails.updateCustomArgs.customArgs) {
                        // @ts-ignore when using generic types, .eq displays an error
                        resolveCtx = resolveCtx.where(m => ctxDetails.updateCustomArgs.customArgs[argKey].handler(m, args[argKey]));
                    } else {
                        // @ts-ignore when using generic types, .eq displays an error
                        resolveCtx = resolveCtx.where(m => m[argKey.replace('filterBy_', '')].eq(args[argKey]));
                    }
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
            // custom arguments defined by User.
            ...Object.fromEntries(Object.entries(ctxDetails.deleteCustomArgs.customArgs).map(([k, v]) => [k, {
                type: v.type,
                description: v.description
            }])),
            // other arguments that can be optionally passed.
            ...Object.fromEntries(Object.keys($schema)
                .filter(k => !ctxDetails.deleteCustomArgs.ignoredArgs.includes(k))
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
                    if (argKey in ctxDetails.deleteCustomArgs.customArgs) {
                        // @ts-ignore when using generic types, .eq displays an error
                        resolveCtx = resolveCtx.where(m => ctxDetails.deleteCustomArgs.customArgs[argKey].handler(m, args[argKey]));
                    } else {
                        // @ts-ignore when using generic types, .eq displays an error
                        resolveCtx = resolveCtx.where(m => m[argKey.replace('filterBy_', '')].eq(args[argKey]));
                    }
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
            if(!this.#contexts[ctxKey].mutationOptions.disableInserts) {
                rootFields[`insert${singular(ctxKey)}`] = this.#getInsertObjectTypeConfigForContext(ctx, $table, $schema, $relationships, ctxKey, `Insert a record into the "${$table}" database table.`);
            }
            if(!this.#contexts[ctxKey].mutationOptions.disableUpdates) {
                rootFields[`update${singular(ctxKey)}`] = this.#getUpdateObjectTypeConfigForContext(ctx, $table, $schema, $relationships, ctxKey, `Update a record in the "${$table}" database table.`);
            }
            if(!this.#contexts[ctxKey].mutationOptions.disableDeletes) {
                rootFields[`delete${singular(ctxKey)}`] = this.#getDeleteObjectTypeConfigForContext(ctx, $table, $schema, $relationships, ctxKey, `Delete a record from the "${$table}" database table.`);
            }
        }

        return {
            name: `${name}_mutation`,
            description,
            fields: () => rootFields
        };
    }

    /**
     * `addArgument` function that is passed to the configuration callback in the second argument of `.addContext()`.
     * @param {{customArgs: {[key: string]: UserDefinedArguments}, ignoredArgs: string[]}} argDetails
     * @param {{name: string, description?: string}} details 
     * @param {GraphQLScalarType} graphqlArgType 
     * @param {*} callback 
     */
    #addArgument(argDetails, details, graphqlArgType, callback) {
        argDetails.customArgs[details.name] = {
            description: details.description,
            handler: callback,
            type: graphqlArgType
        };
    }

    /**
     * `removeArgument` function that is passed to the configuration callback in the second argument of `.addContext()`.
     * @param {{customArgs: {[key: string]: UserDefinedArguments}, ignoredArgs: string[]}} argDetails
     * @param {*} callback 
     */
    #removeArgument(argDetails, callback) {
        callback(new Proxy({}, {
            get: (t,p,r) => {
                if(typeof p === "symbol") throw Error(`Expected string property in object dereference, but got symbol. (${String(p)})`);
                argDetails.ignoredArgs.push(p);
            }
        }));
    }

    /**
     * `changeArgument` function that is passed to the configuration callback in the second argument of `.addContext()`.
     * @param {{customArgs: {[key: string]: UserDefinedArguments}, ignoredArgs: string[]}} argDetails
     * @param {*} callback
     */
    #changeArgument(argDetails, callback) {
        let state = {};
        callback(new Proxy({}, {
            get: (t,p,r) => {
                state.name = p;
                if(typeof p === "symbol") throw Error(`Expected string property in object dereference, but got symbol. (${String(p)})`);
                const o = () => ({
                    namedAs: (newName) => {
                        state.oldName = p; 
                        state.name = newName;
                        return o();
                    },
                    definedAs: (newDefinition) => {
                        state.definition = newDefinition;
                        return o();
                    },
                    describedAs: (newDescription) => {
                        state.description = newDescription;
                        return o();
                    },
                    typedAs: (newType) => {
                        state.type = newType;
                        return o();
                    }
                });
                
                return o();
            }
        }));

        argDetails.customArgs[state.name] = {
            type: state.type,
            handler: state.definition,
            description: state.description,
        };
        if(state.name !== state.oldName) {
            argDetails.ignoredArgs.push(state.oldName);
        }

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
 * @param {*} table
 * @param {*} objectTypes
 * @returns {import('graphql').GraphQLFieldConfigMap<any, any>}
 */
function rDefine(relationships, fields, table, objectTypes) {
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
        includedFields = rDefine(relationships[key].relationships, includedFields, key, objectTypes);
        const name = `${singular(key)}Record${relationships[key].type === "1:n" ? "Array" : ""}`;
        let type;
        if(name in objectTypes) {
            type = objectTypes[name];
        } else {
            type = objectTypes[name] = new GraphQLObjectType({
                name,
                description: `Model representing records from "${key}" that is a relationship from the table, "${table}".`,
                fields: () => includedFields
            });
        }

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
 * @template {import('@myorm/myorm').SqlTable} T
 * @typedef {object} ContextConfigurationCallbackModel
 * @prop {ContextConfigurationForArgsCallbackModel<T>} Query
 * @prop {Omit<ContextConfigurationForArgsCallbackModel<T, "insert">, "addArgument">} Insert
 * @prop {ContextConfigurationForArgsCallbackModel<T & {[K in keyof T as `filterBy_${K & string}`]: T[K]}, "update">} Update
 * @prop {ContextConfigurationForArgsCallbackModel<T, "delete">} Delete
 */

/**
 * Various callback tools to allow the user to work with arguments in their GraphQL schema.
 * @template {import('@myorm/myorm').SqlTable} T
 * @template {"query"|"insert"|"update"|"delete"} [U="query"]
 * @typedef {object} ContextConfigurationForArgsCallbackModel
 * @prop {AddArgumentCallback<T>} addArgument
 * Add a custom argument to your GraphQL schema.
 * @prop {RemoveArgumentCallback<T, U>} removeArgument
 * Remove an automatically generated argument from your GraphQL schema.
 * @prop {ChangeArgumentCallback<T, U>} changeArgument
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
 * @template {"query"|"insert"|"update"|"delete"} [U="query"]
 * @callback RemoveArgumentCallback
 * @param {(model: {[K in keyof T as U extends "insert" ? undefined extends T[K] ? K : never : K]: any}) => void} callback 
 */

/**
 * Callback that can be used to change an argument (automatically generated) in the GraphQL schema.
 * @template {import('@myorm/myorm').SqlTable} T
 * @template {"query"|"insert"|"update"|"delete"} [U="query"]
 * @callback ChangeArgumentCallback
 * @param {(model: {[K in keyof T]: Omit<ChangeArgumentCallbackModel<T, {}>, U extends "query" ? never : "definedAs"|"typedAs">}) => void} callback 
 * Model that represents the original table of the context being added, remapped so values are instead {@link ChangeArgumentCallbackModel} types.
 */

/**
 * Functions to be used for changing an existing (automaticlly generated) argument.
 * @template {import('@myorm/myorm').SqlTable} T
 * Model that the context represents
 * @template U
 * Dynamic structure of the {@link ChangeArgumentCallbackModel}, where if the key exists within this generic type, then it will be omitted from the next chain call.
 * @typedef {object} ChangeArgumentCallbackModel
 * @prop {NamedAsCallback<T, U>} namedAs
 * Provide a new name for the argument.
 * @prop {DefinedAsCallback<T, U>} definedAs
 * Provide a new definition for the filter.
 * @prop {DescribedAsCallback<T, U>} describedAs
 * Provide a new description for the argument.
 * @prop {TypedAsCallback<T, U>} typedAs
 * Provide a new `GraphQLScalarType` for the argument.
 */

/**
 * Provide a new name for the argument.
 * @template {import('@myorm/myorm').SqlTable} T
 * Model that the context represents
 * @template U
 * Dynamic structure of the {@link ChangeArgumentCallbackModel}, where if the key exists within this generic type, then it will be omitted from the next chain call.
 * @callback NamedAsCallback
 * @param {string} newName
 * New name for the argument.
 * @returns {Omit<ChangeArgumentCallbackModel<T, U & { namedAs: null }>, keyof (U & { namedAs: null })>}
 * Provide a new definition for the filter.
 */

/**
 * Provide a new definition for the filter of the argument.
 * @template {import('@myorm/myorm').SqlTable} T
 * Model that the context represents
 * @template U
 * Dynamic structure of the {@link ChangeArgumentCallbackModel}, where if the key exists within this generic type, then it will be omitted from the next chain call.
 * @callback DescribedAsCallback
 * @param {string} newDescription
 * Callback that will be augmented and passed into `MyORM`'s `.where()` function.
 * @returns {Omit<ChangeArgumentCallbackModel<T, U & { describedAs: null }>, keyof (U & { describedAs: null })>}
 */

/**
 * Provide a new definition for the filter of the argument.
 * @template {import('@myorm/myorm').SqlTable} T
 * Model that the context represents
 * @template U
 * Dynamic structure of the {@link ChangeArgumentCallbackModel}, where if the key exists within this generic type, then it will be omitted from the next chain call.
 * @callback DefinedAsCallback
 * @param {AlteredWhereCallback<Omit<T, `filterBy_${keyof T}`>>} newDefinition
 * Callback that will be augmented and passed into `MyORM`'s `.where()` function.
 * @returns {Omit<ChangeArgumentCallbackModel<T, U & { definedAs: null }>, keyof (U & { definedAs: null })>}
 */

/**
 * Provide a new type for the argument.
 * @template {import('@myorm/myorm').SqlTable} T
 * Model that the context represents
 * @template U
 * Dynamic structure of the {@link ChangeArgumentCallbackModel}, where if the key exists within this generic type, then it will be omitted from the next chain call.
 * @callback TypedAsCallback
 * @param {GraphQLScalarType} gqlType
 * New type given to the argument.
 * @returns {Omit<ChangeArgumentCallbackModel<T, U & { typedAs: null }>, keyof (U & { typedAs: null })>}
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

