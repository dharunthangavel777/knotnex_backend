# KnotNex Social Platform — RESTful API Specification
**Version:** 1.0.0  
**Base Path:** `/api/v1`  
**Authentication Scheme:** Bearer JWT (`Authorization: Bearer <token>`)  

---

## 1. Feed & Discovery Endpoints

### 1.1 `GET /api/v1/posts/feed`
Fetches the personalized home feed (following + public community posts).

- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:**
  - `page` (optional integer, default: `1`)
  - `limit` (optional integer, default: `20`, max: `50`)
  - `cursor` (optional string, timestamp/UUID cursor for infinite scroll)
  - `category` (optional string, e.g., `Career & Jobs`, `Schemes & Grants`)
- **Rate Limit:** 60 requests / minute
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "posts": [
      {
        "id": "e6a218d4-5df1-4a55-8968-3e4b702ec24d",
        "author_id": "89b53147-3801-44fe-9896-cf9bece0e9a7",
        "author_name": "Priya Sharma",
        "author_avatar": "https://storage.googleapis.com/knotnex/avatars/priya.jpg",
        "author_verified": true,
        "author_headline": "Software Engineer & Accessibility Advocate",
        "caption": "Excited to share our new inclusive open-source toolkit! #Accessibility #TechForGood",
        "post_type": "post",
        "media_urls": [
          "https://storage.googleapis.com/knotnex/posts/toolkit-preview.jpg"
        ],
        "thumbnail_url": null,
        "tags": ["#Accessibility", "#TechForGood"],
        "category": "Tech & Coding",
        "audience": "public",
        "allow_comments": true,
        "allow_reposts": true,
        "likes_count": 42,
        "comments_count": 8,
        "shares_count": 5,
        "save_count": 12,
        "views_count": 350,
        "is_liked": true,
        "is_saved": false,
        "is_following_author": true,
        "liked_by_preview": [
          { "id": "uuid-1", "full_name": "Rahul Verma", "avatar_url": "..." },
          { "id": "uuid-2", "full_name": "Ananya Roy", "avatar_url": "..." }
        ],
        "created_at": "2026-10-13T08:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 140,
      "totalPages": 7,
      "hasMore": true
    }
  }
}
```

---

### 1.2 `GET /api/v1/posts/reels`
Returns a stream of full-screen vertical video posts (`post_type = 'reel'`).

- **Query Parameters:** `page`, `limit`
- **Response `200 OK`:** Same structure as `/posts/feed`, filtered to videos with aspect ratio `9:16`.

---

### 1.3 `GET /api/v1/posts/saved`
Retrieves bookmarked items for the authenticated user.

- **Response `200 OK`:** List of saved posts with active `is_saved: true`.

---

## 2. Post Lifecycle & CRUD

### 2.1 `POST /api/v1/posts`
Creates and publishes a new post (thought/text, media photo, or reel).

- **Request Body:**
```json
{
  "caption": "Sharing thoughts on inclusive tech.",
  "postType": "post",
  "mediaUrls": [
    "https://storage.googleapis.com/knotnex/posts/image1.jpg"
  ],
  "thumbnailUrl": "https://storage.googleapis.com/knotnex/posts/image1_thumb.jpg",
  "tags": ["#InclusiveDesign"],
  "location": "Bengaluru, India",
  "audience": "public",
  "category": "Tech & Coding",
  "taggedUsers": ["uuid-user-1", "uuid-user-2"],
  "allowComments": true,
  "allowReposts": true
}
```
- **Validation Rules:**
  - `caption`: Required for `write` posts (max 2000 chars); optional if `mediaUrls` has items.
  - `postType`: One of `['post', 'reel', 'write']`.
  - `audience`: One of `['public', 'connections', 'community', 'private']`.
- **Response `201 Created`:** Enriched post object matching feed schema.

---

### 2.2 `GET /api/v1/posts/:id`
Retrieves complete details of a single post by UUID.

- **Response `200 OK`:** Single enriched post object.
- **Response `404 Not Found`:** `{ "success": false, "error": "Post not found" }`

---

### 2.3 `DELETE /api/v1/posts/:id`
Deletes a post owned by the caller or by an administrator.

- **Response `200 OK`:** `{ "success": true, "data": { "deleted": true } }`
- **Response `403 Forbidden`:** If user is not the author or an admin.

---

## 3. Social Interaction Endpoints

### 3.1 `POST /api/v1/posts/:id/like`
Toggles like status on a post.

- **Idempotency / Rate Limit:** 120 calls / minute per user.
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "liked": true,
    "likes_count": 43
  }
}
```

---

### 3.2 `GET /api/v1/posts/:id/liked-by`
Paginated list of members who reacted to the post.

- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-liker",
        "full_name": "Devi Krishnan",
        "avatar_url": "...",
        "headline": "Accessibility Consultant",
        "is_verified": true,
        "liked_at": "2026-10-13T09:12:00Z"
      }
    ]
  }
}
```

---

### 3.3 `POST /api/v1/posts/:id/save`
Toggles bookmark status on a post.

- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "saved": true,
    "save_count": 13
  }
}
```

---

### 3.4 `POST /api/v1/posts/:id/share`
Records a share event (internal direct share or external OS share).

- **Request Body:** `{ "platform": "internal" }` or `{ "platform": "whatsapp" }`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "shared": true,
    "shares_count": 6
  }
}
```

---

### 3.5 `POST /api/v1/posts/views/batch`
High-efficiency batch view registration for in-feed impressions.

- **Request Body:**
```json
{
  "postIds": [
    "e6a218d4-5df1-4a55-8968-3e4b702ec24d",
    "b45129c1-7f89-42b1-9123-1d2a456fe78a"
  ]
}
```
- **Response `200 OK`:** `{ "success": true, "data": { "recorded": 2 } }`

---

### 3.6 `POST /api/v1/posts/:id/report`
Files an abuse/inappropriate content report against a post.

- **Request Body:**
```json
{
  "reason": "Harassment",
  "details": "User is targeting community members in comments."
}
```
- **Response `200 OK`:** `{ "success": true, "data": { "reported": true } }`

---

## 4. Comments & Threaded Replies

### 4.1 `GET /api/v1/posts/:id/comments`
Retrieves the complete threaded comment hierarchy for a post.

- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "c1-uuid",
      "post_id": "p-uuid",
      "author_id": "u-uuid",
      "author_name": "Arjun Das",
      "author_avatar": "...",
      "author_verified": false,
      "content": "This is a great milestone for KnotNex!",
      "likes_count": 4,
      "is_liked": false,
      "created_at": "2026-10-13T09:00:00Z",
      "replies": [
        {
          "id": "r1-uuid",
          "post_id": "p-uuid",
          "parent_id": "c1-uuid",
          "author_id": "author-uuid",
          "author_name": "Priya Sharma",
          "author_avatar": "...",
          "author_verified": true,
          "content": "Thank you Arjun!",
          "likes_count": 1,
          "is_liked": true,
          "created_at": "2026-10-13T09:05:00Z",
          "replies": []
        }
      ]
    }
  ]
}
```

---

### 4.2 `POST /api/v1/posts/:id/comments`
Creates a top-level comment or threaded reply.

- **Request Body:**
```json
{
  "content": "Count me in for the upcoming hackathon!",
  "parentId": "c1-uuid"
}
```
- **Response `201 Created`:** Enriched comment node with canonical UUID and empty `replies: []`.

---

### 4.3 `POST /api/v1/posts/:id/comments/:commentId/like`
Toggles like status on an individual comment.

- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "liked": true,
    "likes_count": 5
  }
}
```
