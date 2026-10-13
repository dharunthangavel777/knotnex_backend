# KnotNex Social Platform — Complete Feature Audit
**Document Version:** 1.0.0  
**Scope:** Flutter Mobile Client (`knotnex`) & Node.js/TypeScript Backend (`knotnex_backend`)  
**Audit Date:** October 2026  

---

## 1. Executive Summary

This document details an exhaustive, line-by-line technical audit of all social networking capabilities across the KnotNex platform. Every user interaction has been traced from the Flutter UI (`knotnex/lib/features/home`) through state management, network client (`ApiClient`), backend controllers (`post.controller.ts`), services (`post.service.ts`), database tables (`PostgreSQL`), Cloud Storage, and notification delivery pipelines.

---

## 2. Feature-by-Feature Status Matrix

| Feature | Flutter Implementation | Backend Implementation | Database Persistence | End-to-End Status | Critical Gaps & Observations |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Home Feed (List & Pagination)** | ✅ `home_screen.dart`, `feed_provider.dart` | ✅ `GET /posts/feed` (`post.service.ts`) | ✅ `posts`, `users`, `post_reactions` | **Fully Implemented** | Cursor-based pagination recommended over offset; dynamic following filter works. |
| **Post Card Media Rendering** | ⚠️ `post_card.dart` | ✅ `posts.media_urls` | ✅ `media_urls JSONB/TEXT[]` | **Implemented but Incomplete** | Aspect ratios hardcoded to 4:5 (single), 1:1 (carousel), 9:16 (reel). Landscape (16:9, 1.91:1) gets cropped. |
| **Carousel Posts** | ✅ `PageView.builder`, page indicator | ✅ `posts.media_urls` array | ✅ Array storage | **Fully Implemented** | Full-screen pinch-to-zoom supported via `FullScreenImageViewer`. |
| **Video Autoplay & Muting** | ✅ `AppVideoPlayer`, `_checkVisibility()` | ✅ URL streaming | ✅ Cloud Storage / CDN | **Fully Implemented** | Global feed mute sync works via `globalFeedMutedNotifier`. |
| **Like / Reaction (Home Feed)** | ✅ Optimistic toggle + scale anim | ✅ `POST /posts/:id/like` | ✅ `post_reactions`, `likes_count` | **Fully Implemented** | Rollback on failure works. Liked-by preview populates top 3 likers. |
| **Like / Reaction (Reels Feed)** | ❌ Local state toggle only | ⚠️ Backend route exists | ⚠️ Not called from Reels | **UI-Only / Disconnected** | **CRITICAL:** `reels_screen.dart` lines 489-494 and double-tap update only local `_isLiked` and `_likeCount`. **No API call is dispatched!** |
| **Save / Bookmark (Home Feed)** | ✅ Optimistic toggle + toast | ✅ `POST /posts/:id/save` | ✅ `saved_items`, `save_count` | **Fully Implemented** | Toggle persists to DB and increments/decrements `save_count`. |
| **Save / Bookmark (Reels Feed)** | ❌ Local state toggle only | ⚠️ Backend route exists | ⚠️ Not called from Reels | **UI-Only / Disconnected** | **CRITICAL:** `reels_screen.dart` lines 590-602 only updates local `_isSaved`. **No API call is dispatched!** |
| **Share Post (Home Feed)** | ✅ Bottom sheet + platform tracking | ✅ `POST /posts/:id/share` | ✅ `post_shares`, `shares_count` | **Fully Implemented** | Tracks internal vs external share, increments `shares_count`. |
| **Share Reel (Reels Feed)** | ⚠️ Opens share sheet | ⚠️ Route exists | ❌ Not tracked | **Implemented but Incomplete** | Opens `showShareBottomSheet` but does not invoke `FeedProvider.sharePost`. |
| **Comments (Bottom Sheet)** | ⚠️ Awaits server before adding | ✅ `GET /posts/:id/comments`, `POST /posts/:id/comments` | ✅ `post_comments`, `likes_count` | **Implemented but Incomplete** | **Lacks instant optimistic pending state with `Sending...` badge.** Adds only after server responds. |
| **Threaded Comment Replies** | ✅ Recursive tree builder | ✅ `parent_id` foreign key | ✅ Self-referencing FK | **Fully Implemented** | Supports 1-2 levels of nesting with ancestor connector lines. |
| **Comment Reactions (Likes)** | ✅ Optimistic toggle | ✅ `POST /posts/:id/comments/:commentId/like` | ✅ `comment_reactions` | **Fully Implemented** | Real-time count update with rollback on network failure. |
| **Single Post View (`view_post_screen.dart`)** | ❌ Isolated local mock list | ⚠️ Route exists | ❌ Not connected | **UI-Only / Disconnected** | **CRITICAL:** Simulates 800ms delay (`Future.delayed`), doesn't fetch backend comments, adding a comment only modifies in-memory state! |
| **Post Reporting** | ✅ Radio dialog + reason selection | ✅ `POST /posts/:id/report` | ✅ `post_reports`, `flagged_for_review` | **Fully Implemented** | Persists reporter ID, post ID, reason, and updates moderation flag. |
| **Reel Reporting** | ❌ Missing UI action | ✅ Route exists | ❌ Not exposed | **Missing on Reels UI** | Reels screen lacks a 3-dot options menu or report action. |
| **View Tracking & Deduplication** | ✅ `ViewTrackingService` (10s buffer) | ✅ `POST /posts/views/batch` | ✅ `post_views` (1 per user/post/day) | **Fully Implemented** | Deduplicates views per user per day in Postgres; updates `views_count`. |
| **Create Post (Text / Thought)** | ✅ `CreatePostMode.text` | ✅ `POST /posts` (`postType: 'write'`) | ✅ `posts.post_type = 'write'` | **Fully Implemented** | Immediate optimistic insertion at top of feed with fallback rollback. |
| **Create Post (Media / Photos)** | ✅ Cloud Storage upload + progress | ✅ `POST /posts` | ✅ Cloud Storage + `posts.media_urls` | **Fully Implemented** | `DirectUploadService` streams directly to GCS with progress bar. |
| **Create Reel (Video)** | ⚠️ Video recording & selection | ✅ `POST /posts` (`postType: 'reel'`) | ✅ Cloud Storage + `posts` | **Implemented but Incomplete** | Needs unified thumbnail generation and upload session credentials. |
| **Notifications (Social Activity)** | ✅ `NotificationScreen`, unread badges | ✅ `NotificationService` | ✅ `notifications` table, FCM push | **Fully Implemented** | Post author notified on like & comment; parent author notified on reply. |

---

## 3. Deep-Dive Findings & Architectural Bottlenecks

### 3.1 Reels Screen Isolation (`reels_screen.dart`)
- **Issue:** Tapping the heart icon or double-tapping the video only executes:
  ```dart
  setState(() {
    _isLiked = !_isLiked;
    _isLiked ? _likeCount++ : _likeCount--;
  });
  ```
  It does not invoke `context.read<FeedProvider>().toggleLike(reel['id'])`.
- **Issue:** Tapping the bookmark button only updates local `_isSaved` without calling `FeedProvider.toggleSave(reel['id'])`.
- **Impact:** User engagement on Reels is lost upon closing the screen; database counts and post author notifications are never triggered.

### 3.2 View Post Screen Disconnection (`view_post_screen.dart`)
- **Issue:** The screen contains an isolated duplicate class `CommentNode` instead of using the central model.
- **Issue:** `_loadPost()` executes `await Future.delayed(const Duration(milliseconds: 800));` and leaves comments blank.
- **Issue:** `_addComment()` instantiates a local node and appends it to `_comments` in memory without dispatching `ApiClient.post('/posts/$id/comments')`.
- **Impact:** Opening a post in full-screen view isolates the user from real server conversations.

### 3.3 Comment Submission Optimistic State (`comments_bottom_sheet.dart`)
- **Issue:** When submitting a comment or reply, the UI waits for the HTTP request to finish (`await provider.addComment(...)`) before inserting the node.
- **Requirement:** Modern benchmark (Instagram/LinkedIn) requires:
  1. Instant optimistic insertion with temporary ID (`temp_${timestamp}`)
  2. Visual `Sending...` badge or subtle pending opacity
  3. Authoritative server reconciliation replacing temp ID with canonical UUID
  4. Explicit retry badge if request fails due to connection drop.

### 3.4 Aspect Ratio Preservation (`post_card.dart`)
- **Issue:** `AspectRatio` is statically enforced (`aspectRatio: post['aspectRatio'] ?? 4 / 5`).
- **Impact:** Landscape photos (16:9 or 1.91:1) and panoramic images get cropped or clipped rather than maintaining their natural bounds with dynamic aspect ratios or flexible aspect constraints (min 4:5, max 1.91:1).

---

## 4. Remediation Checklist
1. Connect `reels_screen.dart` like, double-tap like, save, and share directly to `FeedProvider` with optimistic rollback.
2. Refactor `view_post_screen.dart` to use `FeedProvider.fetchComments()` and `FeedProvider.addComment()`.
3. Upgrade `comments_bottom_sheet.dart` to full optimistic submission lifecycle (`Sending...` indicator, client UUID reconciliation, failure retry banner).
4. Implement dynamic aspect ratio calculation in `post_card.dart` supporting 1:1, 4:5, 16:9, and 1.91:1 with letterbox prevention.
5. Add 3-dot action menu to `reels_screen.dart` enabling "Report Reel" and "Save to Bookmarks".
