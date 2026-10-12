import { Router } from 'express';
import { PostController } from '../controllers/post.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validator.middleware';
import { createPostSchema, createCommentSchema, reportPostSchema } from '../validators/post.validator';
import {
  feedRateLimiter,
  postInteractionRateLimiter,
  batchViewRateLimiter,
} from '../middleware/rateLimiter.middleware';

const router = Router();

// ── Feed & Discovery ─────────────────────────────────────────────────────────
router.get('/feed',              authenticate, feedRateLimiter, PostController.getFeed);
router.get('/reels',             authenticate, feedRateLimiter, PostController.getReels);
router.get('/saved',             authenticate,                  PostController.getSavedPosts);

// ── Batch Views (Must be registered before /:id) ────────────────────────────
router.post('/views/batch',       authenticate, batchViewRateLimiter, PostController.batchRecordViews);

// ── Post CRUD ────────────────────────────────────────────────────────────────
router.post('/',                 authenticate, validate(createPostSchema), PostController.createPost);
router.get('/:id',               optionalAuthenticate, PostController.getPostById);
router.delete('/:id',            authenticate,         PostController.deletePost);

// ── Interactions ─────────────────────────────────────────────────────────────
router.post('/:id/like',         authenticate, postInteractionRateLimiter, PostController.toggleLike);
router.get('/:id/liked-by',      authenticate,                             PostController.getLikedBy);
router.post('/:id/save',         authenticate, postInteractionRateLimiter, PostController.toggleSave);
router.post('/:id/share',        authenticate, postInteractionRateLimiter, PostController.sharePost);
router.post('/:id/view',         authenticate,                             PostController.recordView);
router.post('/:id/report',       authenticate, validate(reportPostSchema), PostController.reportPost);

// ── Comments ─────────────────────────────────────────────────────────────────
router.get('/:id/comments',      optionalAuthenticate, PostController.getComments);
router.post('/:id/comments',     authenticate, validate(createCommentSchema), PostController.addComment);
router.post('/:id/comments/:commentId/like', authenticate, PostController.toggleCommentLike);

// ── User-scoped ──────────────────────────────────────────────────────────────
router.get('/user/:userId',      optionalAuthenticate, PostController.getUserPosts);

export default router;
