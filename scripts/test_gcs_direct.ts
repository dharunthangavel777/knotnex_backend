import { CloudStorageIntegration } from '../src/integrations/gcp/cloud-storage.gcp';
import https from 'https';

async function testGcs() {
  try {
    console.log('Testing GCS signed upload URL generation...');
    const result = await CloudStorageIntegration.generateSignedUploadUrl('posts/test.txt', 'text/plain', true, 15);
    console.log('Generated signed URL:\n', result.uploadUrl);

    console.log('\nAttempting PUT to GCS signed URL...');
    const url = new URL(result.uploadUrl);
    const body = Buffer.from('Hello GCP Cloud Storage!');
    const req = https.request(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': body.length,
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('GCS Response Code:', res.statusCode);
        console.log('GCS Response Body:\n', data);
      });
    });
    req.on('error', (err) => console.error('Req error:', err));
    req.write(body);
    req.end();
  } catch (err) {
    console.error('Error:', err);
  }
}
testGcs();
