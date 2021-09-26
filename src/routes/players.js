const router = require("express").Router();
const index = require("../index");
const axios = require("axios").default;

// Current set is the name of the hash in the redis backend.
var currentSet = "ffa";
// The name of the hash to store the cached playerdb.co responses in.
let cachedNamesSetName = process.env.CACHED_SET || "uuids:names";

// List all the players in their respective team
router.get("", async (req, res) => {
  var reply = await index.getRedisClient().hgetall(currentSet);
  var response = await real(reply);
  if (response != null) {
    //JSON.parse(reply);
    res.json({ dataset: currentSet, response });
  } else {
    res.json({ dataset: currentSet, response: [] });
  }
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
    //console.log(modifiedContent);
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
      if (playerObject.id != -1) playerObject.name = playerName;
    }
    playersWithNames.push(playerObject);
  }
  teamObject.players = playersWithNames;
  delete teamObject.members;
  return teamObject;
}

async function writeNameForId(id, name) {
  let timeStamp = new Date().getTime();
  index
    .getRedisClient()
    .hset(cachedNamesSetName, id, JSON.stringify({ name, timeStamp }));
}

async function getPlayerName(id) {
  var name = await index.getRedisClient().hget(cachedNamesSetName, id);

  if (name != null) {
    var responseObject = JSON.parse(name);
    responseObject.id = id;
    //console.log(responseObject);
    return responseObject.name;
  } else {
    console.log("Null querying db");
    var response = await getPlayerNameFromPlayerdb(id);
    return response || -1;
  }
}

async function getPlayerNameFromPlayerdb(id) {
  try {
    //Ask playerdb for the player name
    const response = await axios.get(
      `https://playerdb.co/api/player/minecraft/${id}`
    );
    console.log(response);
    var player = response.data;

    if (player.code === "player.found") {
      var playerName = player.data.player.username;
      writeNameForId(id, playerName);
      console.log("player found");
      return playerName;
    } else {
      //If the playerdb api fails, mojang doesn't know the player, and thus they don't exist.
      console.log("player not found");
      writeNameForId(id, -1);
      return "null";
    }
  } catch (error) {
    console.log("player not found");
    writeNameForId(id, null);
  }
}

module.exports = router;
