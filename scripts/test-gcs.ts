import { storage } from '../src/config/storage';
import http from 'https';

async function testUpload(bucketName: string) {
  console.log(`\nTesting upload to bucket: ${bucketName}`);
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file('test/hello.txt');

    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: 'text/plain',
    });

    console.log('Signed URL generated.');

    const url = new URL(uploadUrl);
    const req = http.request(
      url,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength('hello world'),
        },
      },
      (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          console.log(`Result for ${bucketName}: ${res.statusCode} ${res.statusMessage}`);
          if (res.statusCode !== 200) {
            console.log('Error body:', body);
          } else {
            console.log('SUCCESS! File uploaded to', bucketName);
          }
        });
      }
    );

    req.on('error', e => console.error('Request error:', e));
    req.write('hello world');
    req.end();
  } catch (err: any) {
    console.error(`Error for ${bucketName}:`, err.message);
  }
}

async function run() {
  await testUpload('knotnex-f68fd.firebasestorage.app');
  await testUpload('knotnex-f68fd.appspot.com');
  await testUpload('knotnex-media-prod');
}

run();
