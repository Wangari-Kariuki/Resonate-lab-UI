//this is the server
const express = require("express"); //node loads express into memory
const app = express(); // creates an express application
app.listen(3000); //port opens "any http request arriving in port 3000 belongs to this application"

//adding a route
app.get("/", (req, res) => {
    res.send("Hello");
});

//connecting express to PostgreSQL
const { Client } = require("pg");

const client = new Client({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5433),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "",
    database: process.env.PGDATABASE || "audio"
});

client.connect()
    .then(() => client.query("select id, size,location FROM  audio_files"))
    .then((res) => {
        console.log(res.rows);
    })
    .catch((err) => {
        console.error("PostgreSQL connection error:", err.message);
    })
    .finally(() => {
        client.end();
    });