# KnotNex Social Platform — Testing & Verification Strategy
**Document Version:** 1.0.0  
**Scope:** Automated Unit, Integration, Widget, and End-to-End Test Matrix  

---

## 1. Testing Pyramid Overview

```
          / \
         / E2E \       Multi-User Journeys (User A -> User B interactions)
        /-------\
       / Integr. \     Supertest API & PostgreSQL Transaction Tests
      /-----------\
     / Unit & Widget\  Flutter Widget Tests & Provider State Machine Tests
    /----------------\
```

---

## 2. Flutter Client Test Matrix

### 2.1 Optimistic UI & Rollback Tests (`test/features/home/feed_provider_test.dart`)
- **Test 1: Immediate Optimistic Like Toggle**
  - *Action:* Call `provider.toggleLike(postId)`.
  - *Assertion:* Verify `post['isLiked']` toggles and `likes` increments synchronously before HTTP returns.
  - *Assertion:* Verify backend mock receives `POST /posts/:id/like`.
- **Test 2: Like Failure Rollback**
  - *Action:* Mock HTTP client returns 500 Internal Server Error.
  - *Assertion:* Verify `post['isLiked']` reverts to original value and count decrements back.
  - *Assertion:* Verify toast error displayed to user.
- **Test 3: Double-Tap Debounce / In-Flight Protection**
  - *Action:* Dispatch `toggleLike(postId)` twice in 10ms.
  - *Assertion:* Only 1 outgoing HTTP request is dispatched; second request is suppressed by `_inFlightLikes`.

### 2.2 Comment Submission & "Sending..." Lifecycle Test (`test/features/home/comments_test.dart`)
- **Test 1: Optimistic Pending State Insertion**
  - *Action:* User types "Great post!" and taps Send button.
  - *Assertion:* Comment node appears immediately in tree with temporary ID (`temp_*`) and `isPending: true`.
  - *Assertion:* UI displays `Sending...` badge and disabled interaction controls.
- **Test 2: Server Reconciliation**
  - *Action:* Server returns `201 Created` with canonical UUID `c-1234`.
  - *Assertion:* Comment node ID is replaced with `c-1234`.
  - *Assertion:* `isPending` is set to `false`, `Sending...` badge disappears, full opacity restored.
- **Test 3: Submission Failure & Retry**
  - *Action:* Server returns network failure.
  - *Assertion:* Comment node displays red retry badge (`Failed to send. Tap to retry`).
  - *Assertion:* Tapping retry re-initiates HTTP request with same temporary ID.

---

## 3. Backend Integration Test Matrix (`tests/social.integration.test.ts`)

| Test Suite | Scenario | Expected Outcome |
| :--- | :--- | :--- |
| **Reactions** | Concurrently like post from 10 distinct users | `likes_count` in `posts` table equals exactly 10; 10 rows in `post_reactions`. |
| **Reactions** | Same user sends 5 rapid like requests | Handled via `ON CONFLICT`; exactly 1 reaction row; count is consistent. |
| **Comments** | Submit valid comment | Row inserted in `post_comments`; `comments_count` in `posts` incremented by 1. |
| **Comments** | Submit threaded reply with `parentId` | Foreign key resolved; comment tree query (`getComments`) nests reply under parent. |
| **Deduplicated Views** | Batch record view for 5 posts | `post_views` records 5 rows with `viewed_at = CURRENT_DATE`. Repeated calls today do not increment `views_count`. |
| **Bookmarks** | Save post | `saved_items` table records row; `save_count` increments. |
| **Reports** | Submit abuse report | `post_reports` records row; `flagged_for_review` set to `true`. |
| **Notifications** | User B likes User A's post | Notification row created with `user_id = User A` and `actor_id = User B`. |

---

## 4. End-to-End (E2E) Multi-User Verification Script

The repository includes reproducible TypeScript E2E test scripts in `knotnex_backend/scripts/`:
- `test_10user_create_posts_e2e.ts`: Creates 10 real test users, publishes posts, and verifies feed consistency.
- `run_10user_feed_profile_e2e.ts`: Tests cross-user follows, likes, comments, and profile feeds.

```bash
# Execute Backend Social E2E Suite
cd "C:/flutter/projects/Knotnex/knotnex_backend"
npx ts-node scripts/test_10user_create_posts_e2e.ts
npx ts-node scripts/run_10user_feed_profile_e2e.ts
```
