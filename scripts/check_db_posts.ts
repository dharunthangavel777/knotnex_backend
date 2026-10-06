import { pool } from '../src/config/database';

async function checkPosts() {
  const res = await pool.query('SELECT id, author_id, post_type, caption, media_urls, created_at FROM posts ORDER BY created_at DESC LIMIT 15');
  console.log('Recent posts count:', res.rows.length);
  for (const r of res.rows) {
    console.log(`[${r.post_type}] ${r.id} | Author: ${r.author_id} | Caption: ${r.caption.slice(0, 40)} | Media: ${JSON.stringify(r.media_urls)} | Date: ${r.created_at}`);
  }
  process.exit(0);
}

checkPosts();
