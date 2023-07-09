//@ts-check

import { MyORMContext } from "@myorm/myorm";
import { MyORMGraphQL } from "../src/index.js";
import { config } from 'dotenv';
import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { GraphQLSchema, GraphQLInt, GraphQLString } from "graphql";

import { adapter, createMySql2Pool } from '@myorm/mysql-adapter';
import { adapter as jsonAdapter } from '@myorm/json-adapter';
import { database } from "./json-database.js";

config();
const cfg = { 
    database: process.env.MYORM_DB, 
    host: process.env.MYORM_HOST, 
    user: process.env.MYORM_USER, 
    password: process.env.MYORM_PASS, 
    port: parseInt(process.env.MYORM_PORT ?? "3306") 
};

/** @type {MyORMContext<import('./json-database.js').Car>} */
const cars = new MyORMContext(jsonAdapter(database), "Car", { allowTruncation: true });

const connection = adapter(createMySql2Pool(cfg));
/** @type {MyORMContext<import('../../../../myorm/.github/chinook-setup/chinook-types.js').Playlist>} */
const playlists = new MyORMContext(connection, "Playlist");
/** @type {MyORMContext<import('../../../../myorm/.github/chinook-setup/chinook-types.js').Track>} */
const tracks = new MyORMContext(connection, "Track");

playlists.hasMany(m => m.PlaylistTracks.fromTable("PlaylistTrack").withKeys("PlaylistId", "PlaylistId")
    .andThatHasOne(m => m.Track.withKeys("TrackId", "TrackId")
        .andThatHasOne(m => m.Album.withKeys("AlbumId", "AlbumId"))
        .andThatHasOne(m => m.Genre.withKeys("GenreId", "GenreId"))
        .andThatHasOne(m => m.MediaType.withKeys("MediaTypeId", "MediaTypeId"))));

const myormGQL = new MyORMGraphQL("chinook")
    .addContext(playlists)
    .addContext(tracks)
    .addContext(cars, ({Insert, Update, Delete}) => {
        Insert.removeArgument(m => m.Id);
        Update.addArgument({
            name: "MakeAndModel",
            description: "Make and model, separated by a space in between the two words."
        }, GraphQLString, (m,argVal) => m.Make.equals(argVal.split(" ")[0]).and(m => m.Model.equals(argVal.split(" ")[1])));
        Delete.addArgument({
            name: "MakeAndModel",
            description: "Make and model, separated by a space in between the two words."
        }, GraphQLString, (m, argVal) => m.Make.equals(argVal.split(" ")[0]).and(m => m.Model.equals(argVal.split(" ")[1])));
    })
    .addContext(tracks.where(m => m.Composer.equals("AC/DC")), ({ Query, Insert, Update, Delete }) => {
        Query.addArgument({
            name: "DurationUpperBound",
        }, GraphQLInt, (m,argVal) => m.Milliseconds.lessThanOrEqualTo(argVal));
        Query.addArgument({
            name: "DurationLowerBound",
        }, GraphQLInt, (m, argVal) => m.Milliseconds.greaterThanOrEqualTo(argVal));
        Query.removeArgument(m => m.Milliseconds);
        Query.changeArgument(m => m.Bytes
            .definedAs((m, argVal) => {
                const split = argVal.split("-");
                return m.Bytes.between(parseInt(split[0]), parseInt(split[1]));
            })
            .describedAs("some description")
            .namedAs("BytesRange")
            .typedAs(GraphQLString)
        );

        Insert.removeArgument(m => m.Composer);
    }, { name: "ACDC_Tracks", description: "Tracks with composer of AC/DC" }, { disableInserts: true });

const app = express();

const rootQueryType = await myormGQL.createRootQueryObject();
const rootMutationType = await myormGQL.createRootMutationObject();

app.use('/graphql', graphqlHTTP({
    schema: new GraphQLSchema({
        query: rootQueryType,
        mutation: rootMutationType
    }),
    graphiql: true
}));

app.listen(5555, () => {
    console.log(`Serving on 5555`);
});

const fn = m => {
    console.log(`Command executed: ${m.cmdRaw}`);
};

async function internalFetch(url, cfg) {
    return await fetch('http://localhost:5555' + url, {
        ...cfg,
        headers: {
            ...cfg?.headers,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
    });
}

async function gqlFetch(query, params) {
    const res = await internalFetch('/graphql', {
        method: 'POST',
        body: JSON.stringify({
            query,
            variables: params
        })
    });
    if(!res.ok) {
        throw Error(res.statusText);
    }
    
    const { data } = await res.json();
    return data;
}

playlists.onSuccess(fn);
playlists.onFail(fn);
tracks.onSuccess(fn);
tracks.onFail(fn);

app.get('/playlists', async (req, res, next) => {
    let params = {};
    if ("id" in req.query) {
        params.id = typeof (req.query.id) === "string" ? parseInt(req.query.id) : req.query.id;
    }
    if ("name" in req.query) {
        params.name = req.query.name;
    }
    try {
        const json = await gqlFetch(`query GetPlaylists ($id: Int, $name: String) { Playlist (PlaylistId: $id, Name: $name) { PlaylistId, Name, ${req.query.include ? "PlaylistTracks { PlaylistId, TrackId, Track { TrackId, Name, Composer, Bytes, Milliseconds } }" : "" } } }`, params);
        res.send(json);
    } catch(err) {
        res.sendStatus(500);
    }
});

async function test1() {
    const res = await internalFetch('/playlists');

    if(!res.ok) {
        throw Error(res.statusText);
    }

    const { Playlist } = await res.json();
    console.assert(Playlist.length === 18);
}

async function test2() {
    const res = await internalFetch('/playlists?id=1');

    if (!res.ok) {
        throw Error(res.statusText);
    }

    const { Playlist } = await res.json();
    console.assert(Playlist.length === 1);
}

async function test3() {
    const res = await internalFetch('/playlists?name=Music');

    if (!res.ok) {
        throw Error(res.statusText);
    }

    const { Playlist } = await res.json();
    console.assert(Playlist.length === 2);
}

async function test4() {
    const res = await internalFetch('/playlists?include=true');

    if (!res.ok) {
        throw Error(res.statusText);
    }

    const { Playlist } = await res.json();
    console.assert("PlaylistTracks" in Playlist[0]);
}

// await test1();
// await test2();
// await test3();
// await test4();

// process.exit();