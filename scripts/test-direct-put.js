const https = require('https');

const req = https.request('https://knotnex-backend-389663780266.asia-south1.run.app/api/v1/uploads/direct-put?folder=org-gallery&fileName=test123.jpg', {
  method: 'PUT',
  headers: {
    'Content-Type': 'image/jpeg',
    'Content-Length': Buffer.byteLength('test-image-data-12345')
  }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', console.error);
req.write('test-image-data-12345');
req.end();

