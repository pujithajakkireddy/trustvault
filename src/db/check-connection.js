
const pool = require("./database");

async function testConnection() {
  try {
    const result = await pool.query(
      "SELECT NOW() AS current_time"
    );

    console.log("TrustVault database connection successful!");
    console.log("Database time:", result.rows[0].current_time);
  } catch (error) {
    console.error("Database connection failed.");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testConnection();
