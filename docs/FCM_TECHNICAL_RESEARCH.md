# KnotNex — Official Firebase Cloud Messaging (FCM) Technical Research & Reference

This document compiles the verified technical specifications, official API requirements, and architectural rules governing Firebase Cloud Messaging (FCM) across Flutter (Android & iOS), Node.js (Firebase Admin SDK v12+), and Google Cloud Run.

---

## 1. Firebase Cloud Messaging HTTP v1 & Admin SDK Architecture

### Official References:
- **FCM HTTP v1 API Overview**: https://firebase.google.com/docs/cloud-messaging/send/v1-api
- **Send Messages using Firebase Admin SDK**: https://firebase.google.com/docs/cloud-messaging/send/admin-sdk
- **Firebase Admin Messaging API Reference**: https://firebase.google.com/docs/reference/admin/node/firebase-admin.messaging.messaging
- **FCM Error Codes Specification**: https://firebase.google.com/docs/cloud-messaging/error-codes
- **FCM Troubleshooting Guide**: https://firebase.google.com/docs/cloud-messaging/troubleshooting

### Architectural Rules & Invariants:
1. **HTTP v1 Standard**: All legacy FCM protocols (XMPP, HTTP legacy endpoint `https://fcm.googleapis.com/fcm/send`, and server keys) were deprecated on June 20, 2023, and fully decommissioned on June 20, 2024. KnotNex exclusively utilizes OAuth 2.0-authenticated FCM HTTP v1 via `firebase-admin/messaging`.
2. **Multicast Batch Limit**: `messaging().sendEachForMulticast()` accepts a maximum of **500 registration tokens** per call. Multicast requests with $> 500$ tokens must be chunked into deterministic sub-batches of 500.
3. **Data Payload Formatting Constraint**: All keys and values within the FCM `data` map **must be strings**. Numbers, booleans, nested maps, or arrays must be string-serialized (e.g. `JSON.stringify(val)`). Passing non-string objects causes `INVALID_ARGUMENT` rejection by Google's backend API.
4. **Idempotency & Message Deduplication**:
   - FCM HTTP v1 provides message IDs (`projects/PROJECT_ID/messages/MESSAGE_ID`).
   -knotnex uses client-side deduplication keys (`${type}_${title}_${body}_${senderId}`) with an 8-second burst window to prevent duplicate UI rendering.
5. **FCM Error Classification**:
   | FCM Error Code | HTTP Status | Permanent or Transient | Required Action |
   |---|---|---|---|
   | `messaging/registration-token-not-registered` (`UNREGISTERED`) | 404 | Permanent | Token expired, uninstalled, or refreshed. Immediately deactivate in `user_devices` (`is_active = FALSE`). |
   | `messaging/invalid-registration-token` (`INVALID_ARGUMENT`) | 400 | Permanent | Token format corrupted or from wrong project. Immediately deactivate token. |
   | `messaging/sender-id-mismatch` (`SENDER_ID_MISMATCH`) | 403 | Permanent | Token generated with sender ID different from backend service account. Mark token invalid. |
   | `messaging/mismatched-credential` | 401 | Permanent | Service account does not match target Firebase project. Check service account config. |
   | `messaging/quota-exceeded` (`QUOTA_EXCEEDED`) | 429 | Transient | Honor `Retry-After` header. Exponential backoff with full jitter. |
   | `messaging/server-unavailable` (`UNAVAILABLE`) | 503 | Transient | FCM cluster temporarily degraded. Retry with backoff. |
   | `messaging/internal-error` (`INTERNAL`) | 500 | Transient | Server error within Google infrastructure. Retry with backoff. |

---

## 2. FlutterFire Client Architecture (`firebase_messaging` & `flutter_local_notifications`)

### Official References:
- **FlutterFire FCM Setup**: https://firebase.google.com/docs/cloud-messaging/flutter/get-started
- **Receive Messages in Flutter**: https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages
- **FlutterFire GitHub Source**: https://github.com/firebase/flutterfire/tree/main/packages/firebase_messaging/firebase_messaging
- **Flutter Local Notifications Plugin**: https://pub.dev/packages/flutter_local_notifications

### Platform Delivery Behaviors:

| App State | Android Behavior | iOS Behavior | KnotNex Unified Solution |
|---|---|---|---|
| **Terminated (Closed)** | Handled by OS & Google Play Services. Displays notification tray banner matching `knotnex_high_importance_channel`. When tapped, triggers `getInitialMessage()`. | Handled by APNs. Displays notification center banner. When tapped, triggers `getInitialMessage()`. | `FirebaseMessaging.instance.getInitialMessage()` parses payload and deep-links on cold start. |
| **Background (Minimized)** | Handled by OS. Status bar notification displayed. When tapped, triggers `onMessageOpenedApp`. | Handled by APNs. Notification banner displayed. When tapped, triggers `onMessageOpenedApp`. | `FirebaseMessaging.onMessageOpenedApp.listen` parses payload and routes to destination screen. |
| **Foreground (Open / Active)** | **FCM suppresses native system notification by default!** Only fires `FirebaseMessaging.onMessage` listener. | **APNs suppresses notification banner by default** unless `setForegroundNotificationPresentationOptions` is explicitly configured. | 1. iOS: `setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true)`.<br>2. Android: `flutter_local_notifications` generates native heads-up banner via `knotnex_high_importance_channel`.<br>3. In-App: `showInAppNotificationBanner()` displays animated floating pill. |

### Top-Level Background Handler Requirements:
- Must be annotated with `@pragma('vm:entry-point')` to prevent tree-shaking by the Dart AOT compiler.
- Must be a top-level function outside of any class or stateful widget.
- Must execute quickly without performing UI-dependent mutations.

---

## 3. Native Android Platform Requirements

### Official References:
- **Android 13+ Notification Permission**: https://developer.android.com/develop/ui/views/notifications/notification-permission
- **Android Notification Channels**: https://developer.android.com/develop/ui/views/notifications/channels
- **Core Library Desugaring for Java 8+ APIs**: https://developer.android.com/studio/write/java8-support

### Key Requirements:
1. **Manifest Permission**: `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>` is declared in `AndroidManifest.xml`.
2. **Runtime Permission**: On Android 13+ (API 33+), runtime request via `FirebaseMessaging.instance.requestPermission()` is mandatory before tokens or notifications can be received.
3. **High-Importance Notification Channel**:
   - Channel ID: `knotnex_high_importance_channel`
   - Importance: `Importance.max` / `NotificationManager.IMPORTANCE_HIGH`
   - Manifest default: `<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="knotnex_high_importance_channel"/>`
4. **Core Library Desugaring & MultiDex**:
   - `isCoreLibraryDesugaringEnabled = true` in `app/build.gradle.kts`.
   - `coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")` in `dependencies`.
   - `multiDexEnabled = true` in `defaultConfig`.

---

## 4. Native Apple iOS / APNs Platform Requirements

### Official References:
- **Apple User Notifications Framework**: https://developer.apple.com/documentation/usernotifications
- **Registering App with APNs**: https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns

### Key Requirements:
1. **APNs Device Token Precondition**: On iOS, `FirebaseMessaging.instance.getToken()` relies on the native APNs token being assigned by iOS first. In release builds or physical devices, `await FirebaseMessaging.instance.getAPNSToken()` should be validated or awaited with timeout before requesting an FCM registration token.
2. **Xcode Capabilities & Background Modes**:
   - `Push Notifications` capability in `Runner.entitlements`.
   - `Background Modes`: `Remote notifications` (`remote-notification`) and `Background fetch` (`fetch`) in `Info.plist`.
3. **Firebase Console APNs Authentication Key**:
   - Apple Developer APNs Authentication Key (`.p8` file) with Key ID and Team ID must be uploaded to Firebase Console under `Project Settings -> Cloud Messaging -> Apple app configuration -> knotnex_user (com.example.knotnexUser)`.

---

## 5. Google Cloud Run Authentication & Service Accounts

### Official References:
- **Application Default Credentials**: https://cloud.google.com/docs/authentication/application-default-credentials
- **Cloud Run Service Identity**: https://cloud.google.com/run/docs/securing/service-identity

### Key Requirements:
1. **Dual-Credential Strategy**:
   - **Local / Development**: Loads service account key JSON from `keys/` directory or environment variable.
   - **Production (Cloud Run)**: Container runs under Cloud Run Service Identity (`lively-welder-512304-n4`) or uses `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable directly to initialize `admin.initializeApp({ credential: admin.credential.cert(...) })`.
2. **Cross-Project IAM Roles**: When Google Cloud Project (`lively-welder-512304-n4`) hosts Cloud Run while Firebase Project (`knotnex-f68fd`) hosts FCM, the service account or Cloud Run runtime service identity must hold the `Firebase Cloud Messaging Admin` (`roles/firebase.messagingAdmin`) and `Firebase Admin SDK Administrator Service Agent` roles on the Firebase project.
