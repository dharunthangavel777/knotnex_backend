import { pool } from '../src/config/database';

async function migrateUrls() {
  console.log('🔄 Migrating database media URLs from local emulator (10.0.2.2 / localhost) to Google Cloud Storage...');

  const query = `
    UPDATE posts
    SET 
      media_urls = ARRAY(
        SELECT REPLACE(
          REPLACE(u, 'http://10.0.2.2:8080/uploads/', 'https://storage.googleapis.com/knotnex-media-prod/'),
          'http://localhost:8080/uploads/', 'https://storage.googleapis.com/knotnex-media-prod/'
        )
        FROM unnest(media_urls) AS u
      ),
      thumbnail_url = REPLACE(
        REPLACE(thumbnail_url, 'http://10.0.2.2:8080/uploads/', 'https://storage.googleapis.com/knotnex-media-prod/'),
        'http://localhost:8080/uploads/', 'https://storage.googleapis.com/knotnex-media-prod/'
      )
    WHERE (thumbnail_url LIKE '%/uploads/%' OR array_to_string(media_urls, ',') LIKE '%/uploads/%')
    RETURNING id, post_type, caption, media_urls, thumbnail_url;
  `;

  const res = await pool.query(query);
  console.log(`✅ Successfully updated ${res.rowCount} posts in PostgreSQL!`);
  for (const row of res.rows) {
    console.log(`  [${row.post_type}] ${row.id}: ${JSON.stringify(row.media_urls)}`);
  }
  process.exit(0);
}

migrateUrls().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
