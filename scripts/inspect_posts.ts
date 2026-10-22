import { pool } from '../src/config/database';

async function main() {
  try {
    const res = await pool.query(
      `SELECT id, post_type, media_urls, thumbnail_url, caption, created_at FROM posts WHERE post_type = 'reel' OR cardinality(media_urls) > 0 ORDER BY created_at DESC LIMIT 20;`
    );
    console.log(`Found ${res.rows.length} posts with media:`);
    for (const r of res.rows) {
      console.log(`- ID: ${r.id} | Type: ${r.post_type} | Media: ${JSON.stringify(r.media_urls)} | Thumb: ${r.thumbnail_url}`);
    }
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await pool.end();
  }
}

main();
