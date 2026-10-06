require("dotenv").config();
const mongoose = require("mongoose");
const { app } = require("./app");

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/logictap";

mongoose
  .connect(MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`Listening on http://127.0.0.1:${PORT}`)))
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
