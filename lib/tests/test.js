//@ts-check

import { MyORMContext } from "@myorm/myorm";
import { MyORMGraphQL } from "../src/index.js";
import { adapter, createMySql2Pool } from '@myorm/mysql-adapter';
import { config } from 'dotenv';
import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { GraphQLSchema, GraphQLInt, GraphQLString } from "graphql";

config();
const cfg = { 
    database: process.env.DB_DB, 
    host: process.env.DB_HOST, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASS, 
    port: parseInt(process.env.DB_PORT ?? "3306") 
};

const connection = adapter(createMySql2Pool(cfg));

/** @type {MyORMContext<import('../../../../myorm/.github/chinook-setup/chinook-types.js').Playlist>} */
const playlists = new MyORMContext(connection, "Playlist");
/** @type {MyORMContext<import('../../../../myorm/.github/chinook-setup/chinook-types.js').Track>} */
const tracks = new MyORMContext(connection, "Track");

const acdcTracks = tracks.where(m => m.Composer.equals("AC/DC"));

const fn = m => {
    console.log(`Command executed: ${m.cmdRaw}`);
};

playlists.onSuccess(fn);
playlists.onFail(fn);
tracks.onSuccess(fn);
tracks.onFail(fn);

playlists.hasMany(m => m.PlaylistTracks.fromTable("PlaylistTrack").withKeys("PlaylistId", "PlaylistId")
    .andThatHasOne(m => m.Track.withKeys("TrackId", "TrackId")
        .andThatHasOne(m => m.Album.withKeys("AlbumId", "AlbumId"))
        .andThatHasOne(m => m.Genre.withKeys("GenreId", "GenreId"))
        .andThatHasOne(m => m.MediaType.withKeys("MediaTypeId", "MediaTypeId"))));

const myormGQL = new MyORMGraphQL("chinook");
myormGQL.addContext(playlists);
myormGQL.addContext(tracks, ({ addArgument, removeArgument, changeArgument }) => {
    addArgument({
        name: "BytesLB",
        description: "Lower bound for bytes to check."
    }, GraphQLInt, (m,argVal) => m.Bytes.greaterThanOrEqualTo(argVal));

    addArgument({
        name: "BytesUB",
        description: "Upper bound for bytes to check."
    }, GraphQLInt, (m,argVal) => m.Bytes.lessThanOrEqualTo(argVal));

    // removeArgument(m => m.Bytes);
    changeArgument(m => m.Bytes
        .as("BytesRange")
        .to((m,argVal) => m.Bytes.between(parseInt(argVal.split("-")[0]), parseInt(argVal.split("-")[1])))
        .typedAs(GraphQLString));
});

myormGQL.addContext(acdcTracks, undefined, {name: "ACDC_Tracks", description: "Tracks with composer of AC/DC"});

const app = express();

const rootQueryType = await myormGQL.createRootQueryObject();

app.use('/graphql', graphqlHTTP({
    schema: new GraphQLSchema({
        query: rootQueryType
    }),
    graphiql: true
}));

app.listen(5555, () => {
    console.log(`Serving on 5555`);
});

// playlists.include(m => m.PlaylistTracks.thenInclude(m => m.Track)).select().then(r => {
//     console.log(JSON.stringify(r, undefined, 2));
// })