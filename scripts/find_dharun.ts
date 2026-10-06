import { pool } from '../src/config/database';

async function findUser() {
  const users = await pool.query("SELECT id, full_name, email, role FROM users WHERE email ILIKE '%dharun%' OR full_name ILIKE '%dharun%'");
  console.log('Users found:', users.rows);
  if (users.rows.length > 0) {
    for (const u of users.rows) {
      const posts = await pool.query('SELECT id, post_type, caption, media_urls, created_at FROM posts WHERE author_id = $1', [u.id]);
      console.log(`Posts by ${u.full_name} (${u.id}):`, posts.rows);
    }
  }
  process.exit(0);
}

findUser();
