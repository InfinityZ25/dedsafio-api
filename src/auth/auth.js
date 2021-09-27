const index = require("../index");

async function authorization(request, reponse) {
  if (request.headers.authorization) {
    //Expected header => Authorization: Bearer <token>
    const token = request.headers.authorization.split(" ")[1];
    var allowed = await verifyToken(token);
    if (allowed) return allowed;
  }
  reponse.status(401).send("Unauthorized");
  return false;
}

/**
 * Function that holds the logic to check if the token is valid or not.
 * Currently only validates if the token is present in the request and does no validation of the token itself.
 * @param {*} token The token to be validated
 * @returns {boolean} true if the token is valid, false otherwise.
 */
async function verifyToken(token) {
  return (
    token != null &&
    (await index.getRedisClient().sismember("authentication", token)) === 1
  );
}

module.exports.isAuthenticated = (request, reponse) =>
  authorization(request, reponse);
