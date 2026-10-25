
const bcrypt = require("bcryptjs");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const pool = require("../src/db/database");

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const name = (await rl.question("Admin name: ")).trim();
    const email = (await rl.question("Admin email: ")).trim().toLowerCase();
    const password = await rl.question("Admin password (12-72 characters): ");

    if (
      !name ||
      name.length > 100 ||
      email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 12 ||
      password.length > 72
    ) {
      throw new Error("Invalid input. Check the name, email, and password length.");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email, role`,
      [name, email, passwordHash]
    );

    if (result.rowCount === 0) {
      throw new Error("That email already exists. No account was changed.");
    }

    console.log("Admin account created successfully:", result.rows[0]);
  } finally {
    rl.close();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Admin setup failed:", error.message);
  process.exitCode = 1;
});
