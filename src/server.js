
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("TrustVault is running!");
});

app.listen(PORT, () => {
  console.log(`TrustVault is running on port ${PORT}`);
});
