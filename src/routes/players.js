const router = require("express").Router();
const index = require("../index");
const axios = require("axios").default;

// List all the players in their respective team
router.get("", async (req, res) => {
  index.getRedisClient().hgetall("ffa", (err, reply) => {
    if (err) throw err;

    var keys = Object.keys(reply);
    var reponse = [];
    for (const key of keys) {
      var content = JSON.parse(reply[key]);
      var modifiedContent = await modifyObjectToIncludeNames(content);
      console.log(modifiedContent);
      reponse.push(modifiedContent);
    }
    //JSON.parse(reply);
    res.json({ reponse });
  });
});
// List a specific player and their team
router.get("/player/:id", async (req, res) => {});

async function modifyObjectToIncludeNames(teamObject) {
  var players = teamObject.members;
  var playersWithNames = [];
  for (const player in players) {
    var playerObject = { id: players[player] };
    var playerName = await getPlayerName(playerObject.id);
    if (playerName != null) {
      playerObject.name = playerName;
      //console.log(playerObject);
    }
    playersWithNames.push(playerObject);
  }
  teamObject.players = playersWithNames;
  return teamObject;
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
