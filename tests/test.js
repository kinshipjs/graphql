//@ts-check
import { KinshipGraphQL } from '../src/index.js';
import { GraphQLSchema, graphql } from "graphql";
import { adapter } from '@kinshipjs/json';
import { KinshipContext } from '@kinshipjs/core';

/**
 * @param {"Album"|"Artist"|"Customer"|"Employee"|"Genre"|"Invoice"|"InvoiceLine"|"MediaType"|"Playlist"|"PlaylistTrack"|"Track"} table
 * @returns {Promise<import('@kinshipjs/json').JsonDatabase['$data'][string]>}
 */
async function getChinookTable(table) {
    const res = await fetch(`https://raw.githubusercontent.com/marko-knoebl/chinook-database-json/master/src/data/${table}.json`);

    if(!res.ok) {
        throw Error(`${res.status}: ${res.statusText}`);
    }
    return await res.json();
}

/**
 * @returns {Promise<import('@kinshipjs/json').JsonDatabase['$schema']>}
 */
async function getChinookSchema() {
    const res = await fetch('https://raw.githubusercontent.com/marko-knoebl/chinook-database-json/master/src/schema.json');

    if(!res.ok) {
        throw Error(`${res.status}: ${res.statusText}`);
    }
    /** @type {any[]} */
    const schemas = await res.json();
    const types = {
        string: "string",
        integer: "int",
        "decimal(10,2)": "float",
        datetime: "date"
    }

    /** @type {import('@kinshipjs/json').JsonDatabase['$schema']} */
    let schema = {};
    for(const s of schemas) {
        const { name, schema: tableSchema } = s;
        schema[name] = Object.fromEntries(tableSchema.fields.map(f => [f.name, ({
            isPrimary: tableSchema.primaryKey === f.name,
            isNullable: !(f.constraints?.required),
            datatype: types[f.type]
        })]));
    }
    return schema;
}

/**
 * @returns {Promise<import('@kinshipjs/json').JsonDatabase>}
 */
async function createChinookDatabase() {
    const Album = await getChinookTable("Album");
    const Artist = await getChinookTable("Artist");
    const Customer = await getChinookTable("Customer");
    const Employee = await getChinookTable("Employee");
    const Genre = await getChinookTable("Genre");
    const Invoice = await getChinookTable("Invoice");
    const InvoiceLine = await getChinookTable("InvoiceLine");
    const MediaType = await getChinookTable("MediaType");
    const Playlist = await getChinookTable("Playlist");
    const PlaylistTrack = await getChinookTable("PlaylistTrack");
    const Track = (await getChinookTable("Track"));
    
    return {
        $schema: await getChinookSchema(),
        $data: {
            Album,
            Artist,
            Customer,
            Employee,
            Genre,
            Invoice,
            InvoiceLine,
            MediaType,
            Playlist,
            PlaylistTrack,
            Track
        }
    };
}

const database = await createChinookDatabase();

const cnn = adapter(database);
const playlists = new KinshipContext(cnn, "Playlist");
playlists.hasMany(m => m.PlaylistTracks.fromTable("PlaylistTrack").withKeys("PlaylistId", "PlaylistId")
    .andThatHasOne(m => m.Track.fromTable("Track").withKeys("TrackId", "TrackId")));

console.log(JSON.stringify(await playlists.include(m => m.PlaylistTracks.thenInclude(m => m.Track)), undefined, 2));

const chinookQL = new KinshipGraphQL("Chinook")
    .addContext(playlists, undefined, { name: "Playlists" });

const schema = new GraphQLSchema({
    query: await chinookQL.createRootQueryObject(),
    mutation: await chinookQL.createRootMutationObject()
});

const getAllPlaylists = query(`Playlists { PlaylistId, Name, PlaylistTracks { Track { TrackId, Name, Bytes } } }`);
const getSecondPlaylist = query(`Playlists (skip: 1, take: 1) { PlaylistId, Name }`);
const getMusicPlaylists = query(`Playlists (Name: "Music") { PlaylistId, Name }`);

// await execute(getAllPlaylists);
// await execute(getSecondPlaylist);
// await execute(getMusicPlaylists);

/**
 * @param {string} s 
 */
async function execute(s) {
    let result = await graphql({ 
        schema, 
        source: getAllPlaylists
    });

    console.log(JSON.stringify(result.data, undefined, 2));
}

/**
 * 
 * @param {string} s 
 */
function query(s) {
    return `query {${s}}`;
}