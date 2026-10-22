
const fs = require("node:fs");
const path = require("node:path");
require("dotenv").config();

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL must be configured before applying the test schema."
  );
}

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
  },
});

async function applySchema() {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);

    console.log("Test database schema created successfully.");
  } catch (error) {
    console.error("Failed to create the test database schema.");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

applySchema();
