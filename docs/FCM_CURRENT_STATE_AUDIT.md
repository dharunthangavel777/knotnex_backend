# KnotNex — FCM Current State Audit & System Inventory

## 1. Ecosystem Component Inventory

| Component | Repository / Path | Framework / Runtime | Current State |
|---|---|---|---|
| **Flutter Mobile App** | `c:\flutter\ projects\Knotnex\knotnex` | Flutter 3.11+, Dart, Android & iOS | Android `google-services.json` present (`knotnex-f68fd`). Core desugaring added. iOS missing `GoogleService-Info.plist` and `UIBackgroundModes`. |
| **Organization Web App** | `c:\flutter\ projects\Knotnex\knotnex_org` | React 19, TypeScript, Vite, Firebase Hosting | Web dashboard for organizations. Communicates with Cloud Run backend. |
| **Admin Web App** | `c:\flutter\ projects\Knotnex\knotnex_admin` | React 19, TypeScript, Vite, Firebase Hosting | Deployed live to `https://knotnex-admin.web.app`. Push Broadcast management tab added at Index 7. |
| **Backend API** | `c:\flutter\ projects\Knotnex\knotnex_backend` | Node.js, Express, TypeScript, Cloud Run | Deployed to `https://knotnex-backend-389663780266.asia-south1.run.app`. Connects to Cloud SQL PostgreSQL. |
| **Database** | PostgreSQL on Google Cloud SQL | PostgreSQL 15 | Host `34.47.245.32`. Tables: `user_devices`, `notifications`, `notification_preferences`, `notification_broadcasts`, `notification_broadcast_recipients`. |
| **Firebase Project** | `knotnex-f68fd` (Number: `401166115196`) | Google Cloud / Firebase | FCM v1 Enabled. Service Account: `firebase-adminsdk-fbsvc@knotnex-f68fd.iam.gserviceaccount.com`. |
| **Google Cloud Project** | `lively-welder-512304-n4` | Google Cloud Platform | Hosts Cloud Run container and Cloud Storage buckets (`knotnex-media-prod`, `knotnex-private-prod`). |

---

## 2. Flutter Mobile Application Audit (`knotnex`)

### A. Android Native Configuration
- **Package Name**: `com.example.knotnex` (matches `google-services.json`).
- **`AndroidManifest.xml`**:
  - `POST_NOTIFICATIONS` permission declared: `Yes`
  - Default notification channel meta-data: `knotnex_high_importance_channel`
- **`app/build.gradle.kts`**:
  - `compileOptions`: `isCoreLibraryDesugaringEnabled = true` (Java 17 compatibility).
  - `defaultConfig`: `multiDexEnabled = true`.
  - `dependencies`: `coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")`.
- **Firebase Initialization**: `Firebase.initializeApp()` in `main.dart`.
- **FCM Service**: `NotificationService.initFCM(currentUserId)` requests runtime permission and registers token to backend `/notifications/register-device`.
- **Foreground Display**: `_localNotifications.show()` triggers heads-up notification in app-open state via `knotnex_high_importance_channel`.

### B. iOS Native Configuration
- **Bundle Identifier**: `com.example.knotnexUser`
- **`GoogleService-Info.plist`**: **MISSING** from `ios/Runner/`. Must be generated from Firebase Console.
- **`Info.plist`**: **MISSING** `UIBackgroundModes` (`fetch`, `remote-notification`).
- **`Runner.entitlements`**: **MISSING** `aps-environment`.
- **APNs Key in Firebase**: **MISSING**. Apple Developer `.p8` key not uploaded to Firebase Console for `com.example.knotnexUser`.

---

## 3. Backend API & Firebase Admin SDK Audit (`knotnex_backend`)

### A. Firebase Admin SDK Initialization (`src/config/firebase.ts`)
- **Configured Project ID**: `knotnex-f68fd`
- **Local Credential**: `keys/knotnex-f68fd-firebase-adminsdk-fbsvc-81c9923441.json` exists locally.
- **Cloud Run Environment Variable**: `FIREBASE_SERVICE_ACCOUNT_JSON` was missing from Cloud Run console, causing Cloud Run to default to its GCP Project identity `lively-welder-512304-n4` rather than Firebase Project `knotnex-f68fd`.

### B. Device Registration API (`src/controllers/notification.controller.ts`)
- `POST /api/v1/notifications/register-device`:
  - Enforces `authenticate` middleware; uses authenticated `req.user.id`.
  - Upserts into `user_devices (user_id, fcm_token)`.
  - **Identified Gap**: Did not deactivate old user associations when a shared device switches accounts.

### C. Push Sending Service (`src/services/notification.service.ts` & `src/integrations/firebase/fcm.firebase.ts`)
- Implemented `FcmIntegration.sendPushNotification` and `sendMulticast`.
- Multicast chunks into batches of 500 (FCM v1 hard limit).
- Collects invalid tokens (`registration-token-not-registered`) and marks `is_active = FALSE`.
- Admin broadcast management suite wired into database tables `notification_broadcasts` and `notification_broadcast_recipients`.

---

## 4. PostgreSQL Database Schema Audit

| Table | Primary Purpose | Status |
|---|---|---|
| `users` | User profile and legacy `fcm_token` column | Active |
| `user_devices` | Multi-device active FCM tokens per user | Active (Migration 020) |
| `notifications` | In-app notification center inbox records | Active (Migration 002 & 020) |
| `notification_preferences` | User category mute settings & `pause_all` | Active (Migration 022) |
| `notification_broadcasts` | Admin push broadcast campaigns | Active (Migration 024) |
| `notification_broadcast_recipients` | Recipient tracking & delivery metrics | Active (Migration 024) |
