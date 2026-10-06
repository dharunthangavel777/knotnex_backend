import { pool } from '../src/config/database';

async function checkDharun() {
  const res = await pool.query("SELECT id, firebase_uid, email, full_name FROM users WHERE email = 'dharuncod@gmail.com'");
  console.log('Dharun in DB:', res.rows);
  process.exit(0);
}

checkDharun();
