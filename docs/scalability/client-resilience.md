# KnotNex — Flutter Client Resilience Architecture

**App Target:** KnotNex Mobile (iOS & Android)  
**Target Load:** 5,000 Rapid Active Users / 500,000 DAU  
**Scope:** HTTP Client Resilience, 429 Handling, View Debouncing, Interaction Protection  

---

## 1. HTTP Client Interceptor: 429 & Retry-After Protocol

### The Current Problem:
When the backend returns HTTP 429 (Too Many Requests), the Flutter `ApiClient` either throws a generic exception or retries immediately, causing a retry storm that further saturates the backend rate limiters.

### Architecture Fix: Smart Rate Limit Interceptor
Add an interceptor in `knotnex/lib/core/network/api_client.dart`:

```dart
class RateLimitInterceptor {
  static const int maxRetries = 3;

  Future<http.Response> handleResponse(
    http.Response response,
    Future<http.Response> Function() retryRequest,
  ) async {
    if (response.statusCode == 429) {
      // 1. Parse Retry-After header (seconds)
      final retryAfterHeader = response.headers['retry-after'];
      int waitSeconds = 3; // Default fallback
      
      if (retryAfterHeader != null) {
        waitSeconds = int.tryParse(retryAfterHeader) ?? 3;
      }

      // Add full jitter (0 to 1000ms) to prevent thundering herd
      final jitterMs = Random().nextInt(1000);
      final totalWait = Duration(seconds: waitSeconds, milliseconds: jitterMs);

      // 2. Notify Global UI Banner / Toast if necessary
      NotificationService.showRateLimitWarning(
        message: 'Too many requests. Please wait ${waitSeconds}s...',
      );

      // 3. Wait before retrying (max 1 automatic retry on user-initiated read requests)
      await Future.delayed(totalWait);
      return retryRequest();
    }
    return response;
  }
}
```

### Exponential Backoff with Decorrelated Jitter:
For network timeouts (5xx or socket errors):
$$T_{\text{wait}} = \min(M, B \times 2^{\text{attempt}}) + \text{rand}(0, 500\text{ms})$$
Where:
- Base backoff $B = 1\text{s}$
- Max backoff $M = 15\text{s}$

---

## 2. Fixing RC-4: View Recording Batching Service

### The Current Problem (`feed_provider.dart`):
`recordView(postId)` is called every time a post is scrolled into view. 10 users scrolling 20 posts generates 200 HTTP calls instantly.

### Architecture Fix: Client-Side Batching Queue
Implement `ViewTrackingService`:

```dart
class ViewTrackingService {
  static final ViewTrackingService instance = ViewTrackingService._();
  ViewTrackingService._() {
    _startPeriodicFlush();
  }

  final Set<String> _pendingPostIds = {};
  Timer? _flushTimer;

  void trackPostView(String postId) {
    _pendingPostIds.add(postId);
    // Flush immediately if buffer reaches 25 posts
    if (_pendingPostIds.length >= 25) {
      flush();
    }
  }

  void _startPeriodicFlush() {
    // Flush every 10 seconds automatically
    _flushTimer = Timer.periodic(const Duration(seconds: 10), (_) => flush());
  }

  Future<void> flush() async {
    if (_pendingPostIds.isEmpty) return;

    final batchToFlush = _pendingPostIds.toList();
    _pendingPostIds.clear();

    try {
      await ApiClient.instance.post(
        '/posts/views/batch',
        body: {'postIds': batchToFlush},
      );
    } catch (e) {
      // Re-queue failed IDs if desirable, or silently drop to avoid memory leak
      debugPrint('Failed to flush view batch: $e');
    }
  }

  void dispose() {
    _flushTimer?.cancel();
    flush();
  }
}
```

---

## 3. Fixing RC-8: Interaction Debouncing & Optimistic UI

### The Current Problem:
Users tapping 'Like' or 'Save' multiple times rapidly trigger multiple API calls in flight.

### Architecture Fix:
1. **Optimistic State Mutation:** Flip UI state immediately (heart turns red, like count increments by 1).
2. **In-Flight Lock & Debounce:**
```dart
final Map<String, bool> _inFlightLikes = {};

Future<void> toggleLike(String postId) async {
  // If already processing a like for this post, ignore tap
  if (_inFlightLikes[postId] == true) return;
  _inFlightLikes[postId] = true;

  // Optimistic UI update
  _optimisticallyUpdateLike(postId);

  try {
    await ApiClient.instance.post('/posts/$postId/like');
  } catch (e) {
    // Revert optimistic UI state on failure
    _revertLike(postId);
    rethrow;
  } finally {
    // Release debounce lock after 500ms
    Future.delayed(const Duration(milliseconds: 500), () {
      _inFlightLikes.remove(postId);
    });
  }
}
```

---

## 4. Fixing RC-7: Feed Provider Lifecycle Guard

### The Current Problem:
`FeedProvider` triggers `fetchFeed()` automatically in its constructor:
```dart
FeedProvider() {
  fetchFeed();
}
```
If widget rebuilds recreate `FeedProvider` or if navigation repeatedly mounts the screen, duplicate requests are dispatched.

### Architecture Fix:
1. Store loading state flag `_isFetching = false`.
2. Guard `fetchFeed()`:
```dart
Future<void> fetchFeed({bool refresh = false}) async {
  if (_isFetching) return;
  if (!refresh && !_hasMore) return;

  _isFetching = true;
  try {
    // Load feed
  } finally {
    _isFetching = false;
  }
}
```
3. Use Riverpod's `keepAlive()` or proper state preservation across tab switches.

---

## 5. Token Refresh Single-Flight Queue

Ensure multiple simultaneous API requests failing with 401 do not trigger multiple concurrent `/auth/refresh` requests:
- Use a `Completer<String?>` singleton lock.
- First request triggers token refresh.
- Concurrent requests await the same `Completer` future.
- All requests replay with the newly acquired token once resolved.
