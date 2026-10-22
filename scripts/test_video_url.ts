async function testVideoUrl() {
  const url = 'https://knotnex-backend-389663780266.asia-south1.run.app/uploads/reels/ca600e5e-df36-40e2-93f3-0a8b9f4d1b0d.mp4';
  console.log('Testing video URL:', url);
  try {
    const res = await fetch(url, { method: 'HEAD' });
    console.log('HEAD Status:', res.status, res.statusText);
    console.log('Content-Type:', res.headers.get('content-type'));
    console.log('Content-Length:', res.headers.get('content-length'));
    console.log('Accept-Ranges:', res.headers.get('accept-ranges'));

    const getRes = await fetch(url);
    console.log('GET Status:', getRes.status, getRes.statusText);
    console.log('GET Content-Type:', getRes.headers.get('content-type'));
    console.log('GET Content-Length:', getRes.headers.get('content-length'));
    const buf = await getRes.arrayBuffer();
    console.log('Actual bytes received:', buf.byteLength);
    const textPreview = Buffer.from(buf).toString('utf8', 0, Math.min(200, buf.byteLength));
    console.log('Preview as text:', textPreview);
  } catch (err) {
    console.error('Error fetching video URL:', err);
  }
}

testVideoUrl();
