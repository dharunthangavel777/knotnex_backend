# KnotNex — FCM Production Deployment & Operations Guide

## 1. Cloud Run Deployment & Environment Configuration

### Step 1: Open Google Cloud Console
1. Navigate to: https://console.cloud.google.com/run?project=lively-welder-512304-n4
2. Click on the backend service: **`knotnex-backend`**.
3. Click **Edit & Deploy New Revision**.

### Step 2: Configure Environment Variables
Under the **Container** tab, navigate to **Variables & Secrets**. Ensure the following environment variables are added or updated:

1. **`FIREBASE_PROJECT_ID`**:
   ```
   knotnex-f68fd
   ```

2. **`JWT_SECRET`**:
   ```
   c8df94e2a1b5c4d3e8f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3
   ```

3. **`FIREBASE_SERVICE_ACCOUNT_JSON`**:
   Paste the minified content of your Firebase Service Account JSON file (downloaded from Firebase Console -> Project Settings -> Service Accounts -> Generate new private key).
   Format:
   ```json
   {"type":"service_account","project_id":"<YOUR_FIREBASE_PROJECT_ID>","private_key":"<YOUR_PRIVATE_KEY>","client_email":"<YOUR_CLIENT_EMAIL>"}
   ```

### Step 3: Deploy Revision
Click **Deploy**. Once the new revision is live, Cloud Run will authenticate directly against `knotnex-f68fd` without `messaging/mismatched-credential` errors.

---

## 2. iOS Apple Developer Portal & Firebase Setup

For iOS physical devices to receive push notifications:
1. Open https://developer.apple.com/account/resources/authkeys/list.
2. Click **+** to create a new key.
3. Name it `KnotNex APNs Key` and check **Apple Push Notifications service (APNs)**.
4. Download the `.p8` file and note the **Key ID** and your Apple **Team ID**.
5. Open Firebase Console: https://console.firebase.google.com/project/knotnex-f68fd/settings/cloudmessaging.
6. Under **Apple app configuration**, find `knotnex_user (com.example.knotnexUser)`.
7. Click **Upload** next to **APNs Authentication Key**, upload the `.p8` file, and enter Key ID and Team ID.

---

## 3. Flutter Client Release Build & Testing

### Building Android Release APK:
```powershell
cd knotnex
flutter build apk --release
```

### Testing Push on Physical Device:
1. Log into the KnotNex Flutter app on an Android device.
2. Check the logs or database to observe token registration:
   `[KnotNex FCM] Acquired device token for user ...`
3. Send a test notification from the Admin Dashboard at `https://knotnex-admin.web.app` (Tab 7: Push Broadcast) or via:
   ```bash
   node scripts/send-welcome-push.js --token "<DEVICE_FCM_TOKEN>"
   ```
4. Verify:
   - When the app is in the background or closed: Device receives standard heads-up banner with KnotNex icon.
   - When the app is in foreground: Native system heads-up alert slides down AND in-app floating banner displays.
   - Tapping the banner routes directly to the specified deep link.
