import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ACCOUNTS = [
  { role: "admin", operatorNumber: 0, username: "admin", password: "root", displayName: "Administrator" },
  ...Array.from({ length: 7 }, (_, i) => ({
    role: "operator",
    operatorNumber: i + 1,
    username: "operator",
    password: `operator${i + 1}`,
    displayName: `Operator ${i + 1}`,
  })),
];

async function seed() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query(sql);

  for (const acc of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(acc.password, 10);
    await pool.query(
      `INSERT INTO users (role, operator_number, username, password_hash, display_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (operator_number)
       DO UPDATE SET username = EXCLUDED.username,
                     password_hash = EXCLUDED.password_hash,
                     display_name = EXCLUDED.display_name`,
      [acc.role, acc.operatorNumber, acc.username, passwordHash, acc.displayName]
    );
  }

  console.log("✔ Akkauntlar tayyor:");
  console.log("  admin / root");
  for (let i = 1; i <= 7; i++) console.log(`  operator / operator${i}  (Operator ${i})`);

  await pool.end();
}

seed().catch((err) => {
  console.error("✘ Seed xatosi:", err.message);
  process.exit(1);
});
