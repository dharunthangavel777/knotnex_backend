async function testAll() {
  const urls = [
    'https://knotnex-backend-389663780266.asia-south1.run.app/uploads/posts/aef1f600-29fd-4e43-9fd2-e7e91d718629.jpg',
    'https://knotnex-backend-389663780266.asia-south1.run.app/uploads/reels/063f7d9e-ff83-421f-bc82-5b8fd47b6df0.mp4',
    'https://storage.googleapis.com/knotnex-media-prod/reels/ca600e5e-df36-40e2-93f3-0a8b9f4d1b0d.mp4',
    'https://storage.googleapis.com/knotnex-media-prod/posts/aef1f600-29fd-4e43-9fd2-e7e91d718629.jpg'
  ];
  for (const u of urls) {
    const res = await fetch(u);
    console.log(u);
    console.log('-> Status:', res.status, res.headers.get('content-type'));
  }
}
testAll();
