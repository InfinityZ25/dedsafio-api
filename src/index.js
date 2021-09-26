// Use environmental variables
require("dotenv").config();
// Express to server as rest api
const express = require("express");
const app = express();
// Redis for data
const redis = require("redis");
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST | "localhost",
  port: process.env.REDIS_PORT | 6379,
  password: process.env.REDIS_PASSWORD,
});
// Import routes
const players = require("./routes/players");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

//Use routes
app.use("/players", players);

//Start the webserver, default 8080.
let PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Serving on port ${PORT}`));

// Exports
module.exports.getRedisClient = () => redisClient;
