// Creates a staff/admin account (the register page only makes guests).
// Usage: node scripts/create-user.js <role> <email> <password> <firstName> [lastName]
// Example: node scripts/create-user.js admin admin@stayease.test MyPassw0rd Ana Reyes
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

const ROLES = ['guest', 'admin', 'housekeeping', 'kitchen'];
const [role, email, password, firstName, lastName = ''] = process.argv.slice(2);

if (!ROLES.includes(role) || !email || !password || !firstName) {
  console.error('Usage: node scripts/create-user.js <role> <email> <password> <firstName> [lastName]');
  console.error(`Roles: ${ROLES.join(', ')}`);
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 12);
await pool.execute(
  'INSERT INTO users (role, first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?, ?)',
  [role, firstName, lastName, email.toLowerCase(), passwordHash],
);
console.log(`Created ${role} account for ${email}`);
await pool.end();