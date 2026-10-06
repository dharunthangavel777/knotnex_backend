import fs from 'fs';
import path from 'path';
import { mediaBucket } from '../src/config/storage';

async function syncUploadsToGcs() {
  console.log('🔄 Checking local uploads directory to sync to GCS (knotnex-media-prod)...');

  const folders = ['posts', 'reels'];
  let totalUploaded = 0;

  for (const folder of folders) {
    const dir = path.join(process.cwd(), 'uploads', folder);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    console.log(`\n📁 Checking uploads/${folder} (${files.length} files found)...`);

    for (const fileName of files) {
      const filePath = path.join(dir, fileName);
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;

      const destination = `${folder}/${fileName}`;
      const ext = path.extname(fileName).toLowerCase();
      const contentType = ext === '.mp4' ? 'video/mp4' : ext === '.png' ? 'image/png' : 'image/jpeg';

      console.log(`  -> Uploading ${destination} (${(stat.size / 1024).toFixed(1)} KB)...`);
      try {
        await mediaBucket.upload(filePath, {
          destination,
          metadata: {
            contentType,
          },
          resumable: false,
        });
        console.log(`     ✅ Synced to gs://knotnex-media-prod/${destination}`);
        totalUploaded++;
      } catch (err: any) {
        console.error(`     ❌ Failed to upload ${destination}:`, err.message);
      }
    }
  }

  console.log(`\n🎉 Sync complete! Total files synced: ${totalUploaded}`);
}

syncUploadsToGcs().catch(console.error);
