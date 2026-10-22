async function testGcsReels() {
  const ids = [
    'ca600e5e-df36-40e2-93f3-0a8b9f4d1b0d.mp4',
    '063f7d9e-ff83-421f-bc82-5b8fd47b6df0.mp4',
    '3be93119-408e-4a73-acc5-18c044db595e.mp4',
    'f98ea377-eaf8-49cb-b3ad-445461bdca5e.mp4'
  ];
  for (const id of ids) {
    const url = `https://storage.googleapis.com/knotnex-media-prod/reels/${id}`;
    const res = await fetch(url);
    console.log(id, '-> Status:', res.status, res.headers.get('content-type'), 'Length:', res.headers.get('content-length'));
  }
}
testGcsReels();
