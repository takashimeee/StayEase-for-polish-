import bcrypt from "bcryptjs";
import { pool } from "./db.js";

const email = "sarah.jenkins@example.com";
const [[existing]] = await pool.query("SELECT user_id FROM users WHERE email=?", [email]);
if (existing) {
  console.log("Demo user already exists.");
} else {
  await pool.query(
    "INSERT INTO users (first_name,last_name,email,phone,password_hash) VALUES (?,?,?,?,?)",
    ["Sarah", "Jenkins", email, "0917 123 4567", await bcrypt.hash("password123", 10)]
  );
  console.log(`Created demo user ${email} / password123`);
}
await pool.end();