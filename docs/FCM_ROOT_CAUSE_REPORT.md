# KnotNex — FCM Root Cause Analysis & Diagnostic Report

## Executive Summary

Through direct diagnostic testing against both local infrastructure and the deployed Google Cloud Run backend (`https://knotnex-backend-389663780266.asia-south1.run.app`), the root causes preventing reliable push notification delivery were isolated, verified, and reproduced.

---

## 1. Primary Root Cause: Cloud Run Cross-Project Credential Mismatch

### Diagnostic Test Output:
When invoking the Cloud Run backend's broadcast endpoint `POST /api/v1/notifications/broadcast-welcome` against the 5 registered devices in the database:
```json
{
  "sent": true,
  "totalDevices": 5,
  "successCount": 0,
  "failureCount": 5,
  "results": [
    {
      "user": "knotnex",
      "token": "c3tFob9YTFi2t7SjsQjTh_:AP...",
      "status": "FAILED",
      "error": "messaging/mismatched-credential"
    },
    {
      "user": "Infosys",
      "token": "c3FWb5VOQpeOvGeJ7ojTpx:AP...",
      "status": "FAILED",
      "error": "messaging/mismatched-credential"
    },
    {
      "user": "Suriya M",
      "token": "dm_hjmATRP29n1JB50jvzx:AP...",
      "status": "FAILED",
      "error": "messaging/mismatched-credential"
    },
    {
      "user": "Qwok",
      "token": "dd-hxIDgQR2WHol0hsFZCv:AP...",
      "status": "FAILED",
      "error": "messaging/mismatched-credential"
    },
    {
      "user": "knotnex",
      "token": "dv8S7JEUTgCjCJ9NGQBtGn:AP...",
      "status": "FAILED",
      "error": "messaging/mismatched-credential"
    }
  ]
}
```

### Technical Root Cause:
1. **Google Cloud Project vs Firebase Project**:
   - The Cloud Run instance runs in Google Cloud Project `lively-welder-512304-n4`.
   - The Firebase Project containing FCM registration tokens is `knotnex-f68fd` (Sender ID `401166115196`).
2. **Missing In-Memory Credentials**:
   - The file `keys/knotnex-f68fd-firebase-adminsdk-fbsvc-81c9923441.json` is gitignored and excluded from the Docker build context.
   - Cloud Run's Environment Variables lacked `FIREBASE_SERVICE_ACCOUNT_JSON`.
   - Consequently, `src/config/firebase.ts` fell back to initializing with project ID only, or inherited the Cloud Run default compute service account (`389663780266-compute@developer.gserviceaccount.com`).
3. **FCM v1 Rejection**:
   - When the backend calls FCM HTTP v1 using OAuth 2.0 tokens issued for `lively-welder-512304-n4`, FCM checks whether that identity owns the device tokens registered to `knotnex-f68fd`.
   - Because they belong to different Google Cloud projects, Google FCM rejected 100% of the messages with HTTP 401: `messaging/mismatched-credential`.

---

## 2. Secondary Root Cause: Core Library Desugaring Blocker on Android Release Builds

### Symptom:
When compiling the Flutter Android application in release mode:
```
Execution failed for task ':app:checkReleaseAarMetadata'.
> Dependency ':flutter_local_notifications' requires core library desugaring to be enabled for :app.
```

### Technical Root Cause:
- `flutter_local_notifications` v18+ relies on Java 8/11 `java.time` APIs.
- Flutter's default `build.gradle.kts` does not enable core library desugaring by default.
- **Resolution**: Configured `isCoreLibraryDesugaringEnabled = true`, `multiDexEnabled = true`, and added `desugar_jdk_libs:2.1.4` in `android/app/build.gradle.kts`.

---

## 3. Tertiary Root Cause: Android Foreground Notification Suppression

### Symptom:
When the app was actively running in the foreground (open state), notifications arrived over FCM but did not appear in the system status bar or notification drawer.

### Technical Root Cause:
- Standard FCM behavior dictates that when an app is in the **foreground**, FCM delivers the message silently to `FirebaseMessaging.onMessage` and **does not display a system notification**.
- **Resolution**: Integrated `flutter_local_notifications` with `knotnex_high_importance_channel` to explicitly generate an OS-level heads-up notification when `onMessage` fires.

---

## 4. Quaternary Root Cause: Stale Token Retention & Shared Device Collisions

### Technical Root Cause:
- When a user logs out and another user logs in on the same device, the same device FCM token remained associated with the previous user.
- Expired tokens returning `messaging/registration-token-not-registered` were not being pruned or deactivated in `user_devices`.
- **Resolution**:
  - Implemented token ownership re-assignment upon `registerDeviceToken`: when `(user_B, token)` registers, all records with `fcm_token = token AND user_id != user_B` are updated to `is_active = FALSE`.
  - Implemented automatic token deactivation in multicast responses for `registration-token-not-registered`.

---

## 5. Summary of Failure Chain & Mitigations

| Failure Point | Impact | Remediation Applied |
|---|---|---|
| Cloud Run ADC Mismatch | `mismatched-credential` on all sends | Inject `FIREBASE_SERVICE_ACCOUNT_JSON` into Cloud Run and configure ADC fallback. |
| Android AAR Metadata Check | Build crash on release APK | Configured `desugar_jdk_libs:2.1.4` and `multiDexEnabled` in `build.gradle.kts`. |
| Foreground FCM Suppression | No alerts while app is open | Wired `FlutterLocalNotificationsPlugin.show()` in `FirebaseMessaging.onMessage`. |
| Device Token Swapping | Cross-account notification leak | Added device re-assignment query in `registerDeviceToken`. |
| Inactive Token Accumulation | Wasted multicast bandwidth | Automatic `is_active = FALSE` marking upon FCM `UNREGISTERED` response. |
