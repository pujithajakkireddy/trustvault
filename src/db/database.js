
require("dotenv").config();

const { Pool } = require("pg");

const connectionString =
  process.env.NODE_ENV === "test"
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    process.env.NODE_ENV === "test"
      ? "TEST_DATABASE_URL must be configured for tests."
      : "DATABASE_URL must be configured."
  );
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: true,
  },
});

module.exports = pool;
