const index = require("../index");
// Redis for data
const { createNodeRedisClient } = require("handy-redis");
const redisClient = createNodeRedisClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.nodeRedis.on("message", (channel, message) => {
  if (channel === "dedsafio:sync") {
    try {
      var changeDatasetMessage = JSON.parse(message);
      changeDatasetMessage.newDataset;
      index.getPlayersRoute().changeSet();
    } catch (error) {
      console.log(error);
    }
  }
  console.log(`Message received: ${message} from channel ${channel}`);
});
redisClient.subscribe("dedsafio:events", "dedsafio:sync", "dedsafio:auth");
