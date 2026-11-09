/**
 * KnotNex — Broadcast Welcome Push Notification Test Script
 *
 * Dispatches a Welcome Push Notification to all registered/logged-in devices
 * across Android, iOS, and Web via Firebase Cloud Messaging (FCM HTTP v1).
 *
 * Usage:
 *   node scripts/send-welcome-push.js
 *   node scripts/send-welcome-push.js --token <specific_fcm_token>
 *   node scripts/send-welcome-push.js --remote  (Triggers Cloud Run broadcast endpoint)
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const admin = require('firebase-admin');
require('dotenv').config();

// ── 1. Initialize Firebase Admin SDK ──────────────────────────────────────────
const serviceAccountPath = path.resolve(
  __dirname,
  '../keys/knotnex-f68fd-firebase-adminsdk-fbsvc-81c9923441.json'
);

let initialized = false;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id || 'knotnex-f68fd',
    });
    initialized = true;
    console.log('✅ Firebase Admin SDK initialized via FIREBASE_SERVICE_ACCOUNT_JSON env.');
  } catch (e) {
    console.warn('⚠️ Could not parse FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
  }
}

if (!initialized && fs.existsSync(serviceAccountPath)) {
  try {
    const sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: sa.project_id || 'knotnex-f68fd',
    });
    initialized = true;
    console.log('✅ Firebase Admin SDK initialized via Service Account Key file:', sa.client_email);
  } catch (e) {
    console.warn('⚠️ Could not load key file:', e.message);
  }
}

if (!initialized) {
  admin.initializeApp({ projectId: 'knotnex-f68fd' });
  console.log('⚠️ Firebase initialized with project ID fallback.');
}

const messaging = admin.messaging();

// ── 2. Payload Definition ───────────────────────────────────────────────────
const WELCOME_PAYLOAD = {
  notification: {
    title: 'Welcome to KnotNex! 🚀',
    body: 'Welcome to the KnotNex community! Connect with professionals, explore career opportunities, and collaborate in real-time.',
  },
  data: {
    type: 'welcome',
    route: '/home',
    click_action: 'FLUTTER_NOTIFICATION_CLICK',
    sentAt: new Date().toISOString(),
  },
  android: {
    priority: 'high',
    notification: {
      sound: 'default',
      channelId: 'knotnex_high_importance_channel',
      clickAction: 'FLUTTER_NOTIFICATION_CLICK',
    },
  },
  apns: {
    payload: {
      aps: {
        sound: 'default',
        badge: 1,
      },
    },
  },
};

// ── 3. Dispatch Helper ───────────────────────────────────────────────────────
async function sendToToken(token, label = 'User Device') {
  try {
    const response = await messaging.send({
      token,
      ...WELCOME_PAYLOAD,
    });
    console.log(`  🎉 [SUCCESS] Delivered to ${label} (${token.substring(0, 25)}...) -> Message ID: ${response}`);
    return { success: true, token, response };
  } catch (err) {
    console.error(`  ❌ [FAILED] Delivery to ${label} (${token.substring(0, 25)}...) -> Error: [${err.code || 'UNKNOWN'}] ${err.message}`);
    return { success: false, token, error: err.code || err.message };
  }
}

// ── 4. Main Execution ───────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const tokenArgIndex = args.indexOf('--token');
  const isRemote = args.includes('--remote');

  console.log('===============================================================');
  console.log('🔔 KNOTNEX FCM PUSH NOTIFICATION BROADCAST & AUDIT TOOL');
  console.log('⏰ Timestamp :', new Date().toISOString());
  console.log('===============================================================');

  // Case A: Specific token passed directly
  if (tokenArgIndex !== -1 && args[tokenArgIndex + 1]) {
    const directToken = args[tokenArgIndex + 1];
    console.log(`👉 Sending direct test notification to provided token: ${directToken.substring(0, 30)}...`);
    await sendToToken(directToken, 'CLI Provided Device');
    process.exit(0);
  }

  // Case B: Trigger Cloud Run backend broadcast endpoint
  if (isRemote) {
    console.log('👉 Triggering Cloud Run production broadcast endpoint...');
    await triggerRemoteBroadcast();
    process.exit(0);
  }

  // Case C: Discover tokens locally from Firestore and Database
  console.log('🔍 Discovering active tokens across database and Firestore...');
  const tokensFound = [];

  // Check Firestore
  try {
    const db = admin.firestore();
    const liveNotifsSnap = await db.collection('live_notifications').get();
    console.log(`  Found ${liveNotifsSnap.size} user docs in Firestore live_notifications.`);

    const usersSnap = await db.collection('users').get();
    usersSnap.forEach((doc) => {
      const data = doc.data();
      if (data.fcm_token && !tokensFound.some((t) => t.token === data.fcm_token)) {
        tokensFound.push({
          token: data.fcm_token,
          label: data.name || data.email || doc.id,
        });
      }
    });
  } catch (e) {
    console.log('  Firestore token check notice:', e.message);
  }

  // Check PostgreSQL if reachable
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false,
      connectionTimeoutMillis: 3000,
    });
    const res = await pool.query(`
      SELECT DISTINCT COALESCE(ud.fcm_token, u.fcm_token) as token, u.full_name, u.email
      FROM users u
      LEFT JOIN user_devices ud ON ud.user_id = u.id AND ud.is_active = TRUE
      WHERE ud.fcm_token IS NOT NULL OR u.fcm_token IS NOT NULL
    `);
    for (const r of res.rows) {
      if (r.token && !tokensFound.some((t) => t.token === r.token)) {
        tokensFound.push({
          token: r.token,
          label: r.full_name || r.email || 'Registered User',
        });
      }
    }
    await pool.end();
  } catch (e) {
    console.log('  Local DB connection notice (Cloud SQL requires Cloud Run VPC/Proxy):', e.message);
  }

  console.log(`\n📋 Total Unique Device Tokens Discovered Locally: ${tokensFound.length}`);

  if (tokensFound.length > 0) {
    console.log('\n🚀 Dispatching Welcome Notification to discovered devices:');
    let success = 0;
    let fail = 0;
    for (const item of tokensFound) {
      const res = await sendToToken(item.token, item.label);
      if (res.success) success++;
      else fail++;
    }
    console.log('\n===============================================================');
    console.log(`📊 Summary: Total: ${tokensFound.length} | Sent: ${success} | Failed: ${fail}`);
    console.log('===============================================================');
  } else {
    console.log('\n⚠️ No local device tokens found. Triggering Cloud Run production broadcast endpoint...');
    await triggerRemoteBroadcast();
  }
}

async function triggerRemoteBroadcast() {
  const cloudRunUrl = 'https://knotnex-backend-389663780266.asia-south1.run.app/api/v1/notifications/broadcast-welcome';
  console.log(`📡 Calling POST ${cloudRunUrl}...`);

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      title: 'Welcome to KnotNex! 🚀',
      body: 'Welcome to the KnotNex community! Connect with professionals, explore career opportunities, and collaborate in real-time.',
    });

    const parsed = new URL(cloudRunUrl);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: 15000,
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          console.log(`  Response Status: ${res.statusCode}`);
          try {
            const parsedRes = JSON.parse(body);
            console.log('  Response Data  :', JSON.stringify(parsedRes, null, 2));
          } catch (_) {
            console.log('  Raw Response   :', body);
          }
          resolve();
        });
      }
    );

    req.on('error', (e) => {
      console.error('  Remote broadcast error:', e.message);
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});

