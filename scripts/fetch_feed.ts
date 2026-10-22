const PROD_URL = 'https://knotnex-backend-389663780266.asia-south1.run.app/api/v1';

async function main() {
  try {
    const testId = Date.now().toString().slice(-4);
    const email = `diag_${testId}@knotnex.test`;
    const password = 'Password@2026';
    
    // 1. Signup / Signin to get token
    console.log('Signing up tester:', email);
    const signupRes = await fetch(`${PROD_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName: `Diag ${testId}` }),
    });
    const signupData = (await signupRes.json()) as any;
    let token = signupData.data?.tokens?.accessToken || signupData.tokens?.accessToken;
    
    if (!token) {
      console.log('Signup response:', signupData);
      const loginRes = await fetch(`${PROD_URL}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const loginData = (await loginRes.json()) as any;
      token = loginData.data?.tokens?.accessToken || loginData.tokens?.accessToken;
    }

    console.log('Got token:', token ? 'YES' : 'NO');
    if (!token) return;

    // 2. Fetch Feed
    const feedRes = await fetch(`${PROD_URL}/posts/feed?limit=20`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const feedData = (await feedRes.json()) as any;
    const posts = feedData.data?.posts || feedData.data || [];
    console.log(`\n=== FOUND ${posts.length} POSTS IN PROD FEED ===`);
    for (const p of posts) {
      console.log(`\nPost ID: ${p.id}`);
      console.log(`  type: ${p.post_type}`);
      console.log(`  caption: ${(p.caption || '').substring(0, 50)}`);
      console.log(`  media_urls:`, p.media_urls);
      console.log(`  thumbnail_url:`, p.thumbnail_url);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
