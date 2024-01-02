//@ts-check
import { KinshipGraphQL } from '../src/index.js';
import { GraphQLSchema, graphql } from "graphql";
import { database } from "./json-database.js";
import { adapter } from '@kinshipjs/json';
import { KinshipContext } from '@kinshipjs/core';

const cnn = adapter(database);
const cars = new KinshipContext(cnn, "Car");

const carsQL = new KinshipGraphQL("JSON")
    .addContext(cars, undefined, { name: "Cars" });
const rootQueryType = await carsQL.createRootQueryObject();
const rootMutationType = await carsQL.createRootMutationObject();

const schema = new GraphQLSchema({
    query: rootQueryType,
    mutation: rootMutationType
});

const query = (s="") => `query {${s}}`;

const getAllCars = query(`Cars { Id, Make, Model }`);
const getRedToyotaTundra2014 = query(`Cars(skip: 1, take: 1) { Id, Make, Model, Color }`);
const getFords = query(`Cars(Make:"Ford") { Id, Make, Model, Color }`);

/**
 * @param {string} s 
 */
async function execute(s) {
    let result = await graphql({ 
        schema, 
        source: getAllCars
    });

    console.log(result.data);
}

await execute(getAllCars);
await execute(getRedToyotaTundra2014);
await execute(getFords);

