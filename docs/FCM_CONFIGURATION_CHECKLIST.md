# KnotNex — FCM Configuration Checklist & Environment Guide

Use this checklist to verify that all components across Google Cloud, Firebase, Android, and iOS are configured correctly.

---

## 1. Firebase Console (`knotnex-f68fd`)

- [x] **Project ID**: `knotnex-f68fd` verified.
- [x] **Project Number / Sender ID**: `401166115196` verified.
- [x] **Firebase Cloud Messaging API (V1)**: Enabled.
- [x] **Android Application Registered**:
  - Package Name: `com.example.knotnex`
  - App ID: `1:401166115196:android:606918abc9c6b45eddc4f9`
  - SHA-1 & SHA-256 fingerprints added.
- [ ] **Apple iOS Application Registered**:
  - Bundle ID: `com.example.knotnexUser`
  - App ID: `1:401166115196:ios:...`
  - APNs Authentication Key (`.p8` file): Uploaded to Firebase Console with Key ID and Team ID.

---

## 2. Google Cloud Run Backend (`knotnex-backend`)

Configure in Cloud Run Console under **Service Details → Edit & Deploy New Revision → Variables & Secrets**:

| Variable Name | Required Value | Verified |
|---|---|:---:|
| `NODE_ENV` | `production` | [x] |
| `APP_ENV` | `production` | [x] |
| `DATABASE_URL` | `postgresql://postgres:...@34.47.245.32:5432/knotnex_db` | [x] |
| `AUTO_RUN_MIGRATIONS` | `true` | [x] |
| `GCS_PROJECT_ID` | `lively-welder-512304-n4` | [x] |
| `GCS_MEDIA_BUCKET` | `knotnex-media-prod` | [x] |
| `GCS_PRIVATE_BUCKET` | `knotnex-private-prod` | [x] |
| `FIREBASE_PROJECT_ID` | `knotnex-f68fd` | [ ] *(Add to Cloud Run)* |
| `JWT_SECRET` | `c8df94e2a1b5c4d3e8f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3` | [ ] *(Add to Cloud Run)* |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Minified JSON string from `knotnex-f68fd-firebase-adminsdk-fbsvc-81c9923441.json` | [ ] *(Add to Cloud Run)* |

---

## 3. Flutter Android App Configuration

- [x] **`google-services.json`**: Located at `android/app/google-services.json`.
- [x] **Manifest Permission**: `android.permission.POST_NOTIFICATIONS` in `AndroidManifest.xml`.
- [x] **Default Channel Meta-data**: `knotnex_high_importance_channel` in `AndroidManifest.xml`.
- [x] **Core Library Desugaring**: `isCoreLibraryDesugaringEnabled = true` in `android/app/build.gradle.kts`.
- [x] **MultiDex**: `multiDexEnabled = true` in `android/app/build.gradle.kts`.
- [x] **Desugaring Dependency**: `coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")`.
- [x] **Foreground Heads-Up Handler**: `flutter_local_notifications` v18+ initialized with `knotnex_high_importance_channel`.

---

## 4. Flutter iOS App Configuration

- [ ] **`GoogleService-Info.plist`**: Placed inside `ios/Runner/GoogleService-Info.plist` (downloaded from Firebase Console).
- [ ] **Background Modes**: `UIBackgroundModes` with `fetch` and `remote-notification` in `ios/Runner/Info.plist`.
- [ ] **Entitlements**: `Runner.entitlements` with `aps-environment` set to `development` or `production`.
- [ ] **APNs `.p8` Key**: Generated in Apple Developer portal and uploaded to Firebase Console.
- [x] **Foreground Presentation**: `setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true)` enabled in Dart code.
