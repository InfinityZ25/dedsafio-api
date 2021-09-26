const index = require("../index");
// Redis for data
const { createNodeRedisClient } = require("handy-redis");
const redisClient = createNodeRedisClient({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
});

redisClient.nodeRedis.on("message", (channel, message) => {
  console.log(`Message received: ${message} from channel ${channel}`);
});
redisClient.subscribe("dedsafio:events", "dedsafio:sync", "dedsafio:auth");
