const router = require("express").Router();
const index = require("../index");
const axios = require("axios").default;

// Current set is the name of the hash in the redis backend.
var currentSet = "ffa";
// The name of the hash to store the cached playerdb.co responses in.
let cachedNamesSetName = process.env.CACHED_SET || "uuids:names";

// List all the players in their respective team
router.get("", async (req, res) => {
  index.getRedisClient().hgetall(currentSet, async (err, reply) => {
    if (err) throw err;
    var response = await real(reply);
    if (response != null) {
      //JSON.parse(reply);
      res.json({ dataset: currentSet, response });
    } else {
      res.json({ dataset: currentSet, response: [] });
    }
  });
});
// List a specific player and their team
router.get("/player/:id", async (req, res) => {});

async function real(reply) {
  if (reply == null) return null;
  var keys = Object.keys(reply);
  var response = [];
  for (const key of keys) {
    var content = JSON.parse(reply[key]);
    var modifiedContent = await modifyObjectToIncludeNames(content);
    console.log(modifiedContent);
    response.push(modifiedContent);
  }
  return response;
}

async function modifyObjectToIncludeNames(teamObject) {
  var players = teamObject.members;
  var playersWithNames = [];

  for (const player in players) {
    var playerObject = { id: players[player] };
    var playerName = await getPlayerName(playerObject.id);
    if (playerName != null) {
      playerObject.name = playerName;
      writeNameForId(playerObject.id, playerName);
    } else {
      writeNameForId(playerObject.id, -1);
    }
    playersWithNames.push(playerObject);
  }
  teamObject.players = playersWithNames;
  delete teamObject.members;
  return teamObject;
}

async function writeNameForId(id, name) {
  await index
    .getRedisClient()
    .hset(cachedNamesSetName, id, { name, timeStamp: new Date().getTime() }),
    (err, reply) => {
      if (err) throw err;
      console.log(reply);
    };
}

async function getPlayerName(id) {
  try {
    //Ask playerdb for the player name
    const response = await axios.get(
      `https://playerdb.co/api/player/minecraft/${id}`
    );
    var player = response.data;

    if (player.code === "player.found") {
      var playerName = player.data.player.username;
      return playerName;
    }
  } catch (error) {
    //console.log(error);
  }
}

module.exports = router;
