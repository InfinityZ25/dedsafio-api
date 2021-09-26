const router = require("express").Router();
const index = require("../index");
const NodeCache = require("node-cache");
const axios = require("axios").default;

// Current set is the name of the hash in the redis backend.
var currentSet = "ffa";
// The name of the hash to store the cached playerdb.co responses in.
let cachedNamesSetName = process.env.CACHED_SET || "uuids:names";
// Cache map to improve speeds locally
const nCache = new NodeCache({ stdTTL: 120 });

// List all the players in their respective team
router.get("", async (req, res) => {
  if (!index.getAuth().isAuthenticated(req, res)) {
    return;
  }
  var reply = await index.getRedisClient().hgetall(currentSet);
  var response = await getAllTeams(reply);
  if (response != null) {
    //JSON.parse(reply);
    res.json({ dataset: currentSet, response });
  } else {
    res.json({ dataset: currentSet, response: [] });
  }
});
// List a specific player and their team
router.get("/player/:id", async (req, res) => {
  if (!index.getAuth().isAuthenticated(req, res)) {
    return;
  }
  var id = req.params.id;
  var match = await getTeamOfPlayer(id);

  if (match != null) {
    res.json({ dataset: currentSet, match });
  } else {
    res.json({ dataset: currentSet, match: {} });
  }
});

/**
 * A function that obtains the team of a player is existing in the database.
 *
 * @param {*} id ID of the player to get the name of.
 * @returns {Promise<Object>} A promise that resolves to the real name of the player or null if not existing.
 */
async function getTeamOfPlayer(id) {
  var reply = await index.getRedisClient().hgetall(currentSet);
  let keys = Object.keys(reply);

  for (const key of keys) {
    // Obtain the team object from the reply.
    let team = reply[key];
    // Parse the object into a JSON object.
    var teamObject = JSON.parse(team);
    // If the player is in the team, return the team object.
    if (teamObject.members.includes(id)) {
      return await modifyObjectToIncludeNames(teamObject);
    }
  }
  return null;
}

/**
 * A function that queries the redis backend hash for all the teams. This Function also returns the team members with their real names.
 *
 * @param {*} reply A reply string from the redis backend hash containing all the teams in a "field: object" format.
 * @returns {Promise<object>} A promise that resolves to an array of team objects.
 */
async function getAllTeams(reply) {
  if (reply == null) return null;
  var teamsArray = [];
  // Use object.keys to obtain the keys of the reply object and parse through them.
  let keys = Object.keys(reply);

  for (const key of keys) {
    // Obtain the team object from the reply.
    let team = reply[key];
    // Parse the object into a JSON object.
    var teamObject = JSON.parse(team);
    // Modify the team object to include the real names of the players.
    var namefiedTeamObject = await modifyObjectToIncludeNames(teamObject);
    // Add the team object to the teamsArray.
    teamsArray.push(namefiedTeamObject);
  }
  // Return the new teamsArray containing all the teams with the member's real names.
  return teamsArray;
}
/**
 * Function that takes a team object and returns the object modified to include the real name of the uuids.
 *
 * @param {*} teamObject The team object to modify.
 * @returns {Promise<object>} A promise that resolves to the modified team object.
 */
async function modifyObjectToIncludeNames(teamObject) {
  // Obtain the players from the team object's members array.
  var players = teamObject.members;
  // Initialize a new array to stored the player objects with real names.
  var playersWithNames = [];
  // Loop through the players array and obtain the real name of each player.
  for (const player in players) {
    // Create a playerObject to store the real name of the player with its uuid.
    var playerObject = { id: players[player] };
    // Obtain the real name of the player. If the player does not exist, the name will be null.
    var playerName = await getPlayerName(playerObject.id);
    // If the player exists, add the real name to the playerObject
    if (playerName != null && playerObject.id != -1)
      playerObject.name = playerName;
    // Add the playerObject to the playersWithNames array.
    playersWithNames.push(playerObject);
  }
  // Add the playersWithNames array to the teamObject as a players array of objects.
  teamObject.players = playersWithNames;
  // Delete the default teamObject members array from the copy that will be sent to the client.
  delete teamObject.members;
  // Return the teamObject with real names appended.
  return teamObject;
}

/**
 * A function that queries the redis backend hash for the real name of a uuid. If not found, it queries the playerdb.co API.
 *
 * @param {*} id The uuid of the player. Stringified UUID.
 * @returns {Promise<string>} A promise that resolves to the real name of the player or null if not existing.
 */
async function getPlayerName(id) {
  // Check local cache first, if so return it
  if (nCache.has(id)) return nCache.get(id);
  // Ask redis for the name of the player, if cached.
  var name = await index.getRedisClient().hget(cachedNamesSetName, id);
  // If found, return the name.
  if (name != null) {
    // Parse to Json to ensure everything is working fine.
    var responseObject = JSON.parse(name);
    // Write into local cache for 120 seconds.
    nCache.set(id, responseObject.name, 120);
    // Return object field name if it exists. Otherwise return null.
    return responseObject.name;
  } else {
    // Otherwise, ask playerdb.co for the name.
    var response = await getPlayerNameFromPlayerdb(id);
    // Write into local cache for 120 seconds.
    nCache.set(id, response, 120);
    return response;
  }
}
/**
 * A function that queries the playerdb.co API for the real name of a uuid.
 * This function also caches the response in the redis backend hash.
 *
 * @param {*} id The uuid of the player. Stringified UUID.
 * @returns {Promise<string>} A promise that resolves to the real name of the player.
 */
async function getPlayerNameFromPlayerdb(id) {
  try {
    // Ask playerdb for the player nname using a uuid.
    const response = await axios.get(
      `https://playerdb.co/api/player/minecraft/${id}`
    );
    // Obtain the object data from the response.
    var playerQuery = response.data;
    // Use the code to determine if the player does exist or not.
    if (playerQuery.code === "player.found") {
      // Obtain the username from the response
      var playerName = playerQuery.data.player.username;
      // Write without blocking the name to the redis backend hash and return the name.
      writeNameForId(id, playerName);
      return playerName;
    }
  } catch (error) {
    console.error(error);
  }
  // If we get here, the player doesn't exist. Write them as null and return null.
  writeNameForId(id, null);
  return null;
}

/**
 * A function that writes data regarding the real player name of a uuid to the redis backend hash.
 * @param {*} id The uuid of the player. Stringified UUID.
 * @param {String} name The real name of the player. If null or -1 is passed, the player is assumed to not exist.
 * @returns {Promise<number>} A promise that resolves when the data is written to the redis backend.
 */
async function writeNameForId(id, name) {
  let timeStamp = new Date().getTime(); // Timestamp to know when the data was last updated.
  return index
    .getRedisClient()
    .hset(cachedNamesSetName, id, JSON.stringify({ name, timeStamp }));
}

/**
 * Change the name of the dataset being used for all queries.
 * @param {String} set
 */
function changeCurrentSet(set) {
  currentSet = set;
}

// Exports the express router for index.js to use.
module.exports = router;
module.exports.changeSet = (set) => changeCurrentSet(set);
