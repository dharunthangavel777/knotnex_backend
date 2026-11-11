# KnotNex — FCM API Contracts & Endpoint Specifications

All endpoints are hosted at `https://knotnex-backend-389663780266.asia-south1.run.app/api/v1` and require `Authorization: Bearer <JWT>` unless explicitly marked public.

---

## 1. Device Token Management Endpoints

### 1.1 Register Device Token
- **Endpoint**: `POST /notifications/register-device`
- **Auth**: Required (`Bearer <JWT>`)
- **Request Body**:
  ```json
  {
    "fcmToken": "c3tFob9YTFi2t7SjsQjTh_...",
    "platform": "android | ios | web",
    "deviceId": "optional-device-hardware-uuid",
    "appType": "knotnex_user | knotnex_org",
    "deviceInfo": {
      "model": "Pixel 8",
      "osVersion": "14",
      "appVersion": "1.0.0"
    }
  }
  ```
- **Response** (HTTP 200):
  ```json
  {
    "success": true,
    "message": "Device token registered",
    "data": { "success": true }
  }
  ```

### 1.2 Unregister Device Token (Logout)
- **Endpoint**: `POST /notifications/unregister-device` or `DELETE /notifications/devices/:token`
- **Auth**: Required (`Bearer <JWT>`)
- **Request Body**:
  ```json
  {
    "fcmToken": "c3tFob9YTFi2t7SjsQjTh_..."
  }
  ```
- **Response** (HTTP 200):
  ```json
  {
    "success": true,
    "message": "Device token unregistered",
    "data": { "success": true }
  }
  ```

---

## 2. In-App Notification Center Endpoints

### 2.1 List User Notifications
- **Endpoint**: `GET /notifications?page=1&limit=20`
- **Auth**: Required (`Bearer <JWT>`)
- **Response** (HTTP 200):
  ```json
  {
    "success": true,
    "data": {
      "items": [
        {
          "id": "uuid",
          "user_id": "uuid",
          "actor_id": "uuid",
          "actor_name": "Suriya M",
          "actor_avatar": "https://...",
          "type": "event",
          "title": "New Event Invitation",
          "body": "You have been invited to KnotNex Tech Expo.",
          "data": { "eventId": "uuid", "route": "knotnex://events/uuid" },
          "is_read": false,
          "created_at": "2026-11-11T07:00:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 15,
        "totalPages": 1
      }
    }
  }
  ```

### 2.2 Get Unread Count
- **Endpoint**: `GET /notifications/unread-count`
- **Auth**: Required (`Bearer <JWT>`)
- **Response** (HTTP 200):
  ```json
  {
    "success": true,
    "data": {
      "unreadCount": 3,
      "count": 3
    }
  }
  ```

### 2.3 Mark Single Notification as Read
- **Endpoint**: `PATCH /notifications/:id/read`
- **Auth**: Required (`Bearer <JWT>`)

### 2.4 Mark All Notifications as Read
- **Endpoint**: `PATCH /notifications/read-all`
- **Auth**: Required (`Bearer <JWT>`)

---

## 3. Notification Preferences Endpoints

### 3.1 Get Preferences
- **Endpoint**: `GET /notifications/preferences`
- **Auth**: Required (`Bearer <JWT>`)
- **Response** (HTTP 200):
  ```json
  {
    "success": true,
    "data": {
      "user_id": "uuid",
      "messages": true,
      "reactions": true,
      "comments": true,
      "followers": true,
      "events": true,
      "careers": true,
      "schemes": true,
      "system_alerts": true,
      "pause_all": false,
      "sound_vibrate": true
    }
  }
  ```

### 3.2 Update Preferences
- **Endpoint**: `PUT /notifications/preferences`
- **Auth**: Required (`Bearer <JWT>`)

---

## 4. Admin Broadcast Management Endpoints

### 4.1 Estimate Broadcast Audience
- **Endpoint**: `GET /notifications/broadcasts/estimate?targetAudience=all&isMandatory=false`
- **Auth**: Required (`requireAdmin`)
- **Response** (HTTP 200):
  ```json
  {
    "success": true,
    "data": {
      "totalUsers": 120,
      "totalDevices": 94,
      "androidDevices": 86,
      "iosDevices": 8,
      "webDevices": 0
    }
  }
  ```

### 4.2 Create Broadcast
- **Endpoint**: `POST /notifications/broadcasts`
- **Auth**: Required (`requireAdmin`)
- **Request Body**:
  ```json
  {
    "title": "KnotNex Summit 2026 🚀",
    "body": "Registrations are now open for our annual summit.",
    "imageUrl": "https://storage.googleapis.com/.../banner.jpg",
    "category": "announcement | event | career | scheme | system",
    "priority": "normal | high | urgent",
    "deepLink": "knotnex://events/123",
    "actionLabel": "Explore",
    "targetAudience": "all | users | organizations | custom",
    "isMandatory": false,
    "scheduledAt": "2026-11-15T10:00:00.000Z",
    "sendNow": true
  }
  ```

### 4.3 Send Broadcast Now
- **Endpoint**: `POST /notifications/broadcasts/:id/send`
- **Auth**: Required (`requireAdmin`)

### 4.4 Cancel Scheduled Broadcast
- **Endpoint**: `POST /notifications/broadcasts/:id/cancel`
- **Auth**: Required (`requireAdmin`)

### 4.5 Retry Failed Recipients
- **Endpoint**: `POST /notifications/broadcasts/:id/retry`
- **Auth**: Required (`requireAdmin`)

### 4.6 Single-Device Diagnostic Test Push
- **Endpoint**: `POST /notifications/test-push`
- **Auth**: Optional / Secured
- **Request Body**:
  ```json
  {
    "fcmToken": "c3tFob9YTFi2t7SjsQjTh_...",
    "title": "KnotNex Diagnostic Alert",
    "body": "FCM v1 test payload delivery."
  }
  ```
