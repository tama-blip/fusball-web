const bcrypt = require("bcryptjs");
const pool = require("./db");

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || "Fusball Admin";

  if (!email || !password) {
    console.log("Usage: node backend/create-admin.js admin@fusball.id StrongPassword123");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (name,email,password_hash,role)
     VALUES (?,?,?,'admin')
     ON DUPLICATE KEY UPDATE
       name=VALUES(name), password_hash=VALUES(password_hash), role='admin'`,
    [name, email.toLowerCase(), hash]
  );

  console.log(`Admin ready: ${email}`);
  await pool.end();
}

main().catch(error => { console.error(error); process.exit(1); });
