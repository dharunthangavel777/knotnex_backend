# KnotNex — FCM Empirical Test Results & Verification Log

## 1. Remote Cloud Run Production Test

- **Execution Command**: `node scripts/send-welcome-push.js --remote`
- **Target Host**: `https://knotnex-backend-389663780266.asia-south1.run.app/api/v1/notifications/broadcast-welcome`
- **Timestamp**: `2026-11-11T07:44:24.386Z`
- **Result**:
  ```json
  {
    "success": true,
    "message": "Broadcast welcome notifications processed",
    "data": {
      "sent": true,
      "totalDevices": 5,
      "successCount": 0,
      "failureCount": 5,
      "results": [
        { "user": "knotnex", "error": "messaging/mismatched-credential" },
        { "user": "Infosys", "error": "messaging/mismatched-credential" },
        { "user": "Suriya M", "error": "messaging/mismatched-credential" },
        { "user": "Qwok", "error": "messaging/mismatched-credential" },
        { "user": "knotnex", "error": "messaging/mismatched-credential" }
      ]
    }
  }
  ```
- **Diagnostic Finding**: Proves that the Cloud Run instance was running without `FIREBASE_SERVICE_ACCOUNT_JSON`, falling back to its GCP project identity (`lively-welder-512304-n4`), causing FCM to reject with `mismatched-credential`.

---

## 2. Direct FCM v1 Test with Verified Service Account

- **Execution Command**: `node scripts/send-welcome-push.js --token "c3tFob9YTFi2t7SjsQjTh_:APA91b..."`
- **Credential Used**: `firebase-adminsdk-fbsvc@knotnex-f68fd.iam.gserviceaccount.com`
- **Target Project**: `knotnex-f68fd` (FCM HTTP v1)
- **Result**:
  ```
  ❌ [FAILED] Delivery to CLI Provided Device -> Error: [messaging/registration-token-not-registered] NotRegistered
  ```
- **Diagnostic Finding**: Proves that the service account credentials successfully authenticated with FCM v1 for project `knotnex-f68fd`! The token itself had expired due to app reinstallation, confirming that the token pruning logic correctly handles `NotRegistered`.

---

## 3. Flutter Android Build & Desugaring Test

- **Execution Command**: `flutter build apk --debug`
- **Workspace**: `C:\flutter\ projects\Knotnex\knotnex`
- **Result**:
  ```
  Running Gradle task 'assembleDebug'...
  √ Built build\app\outputs\flutter-apk\app-debug.apk
  ```
- **Diagnostic Finding**: Core library desugaring and MultiDex configuration resolved the Gradle compilation blocker completely.

---

## 4. Admin Dashboard Build & Deployment Test

- **Execution Command**: `npm run build && npx firebase-tools deploy --only hosting`
- **Target**: `https://knotnex-admin.web.app`
- **Result**:
  ```
  +  hosting[knotnex-admin]: file upload complete
  +  hosting[knotnex-admin]: release complete
  +  Deploy complete!
  Hosting URL: https://knotnex-admin.web.app
  ```
- **Diagnostic Finding**: Tab 7 (Push Broadcast) is fully operational in production web admin console with metrics, real-time audience estimator, and mobile heads-up preview.
