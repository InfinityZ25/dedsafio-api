const router = require("express").Router();
const index = require("../index");

router.get("", async (req, res) => {
  res.json({ recieved: true });
});

module.exports = router;
