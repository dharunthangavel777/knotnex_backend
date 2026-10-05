import { Request, Response } from 'express';
import { PostService } from '../services/post.service';
import { ApiResponse } from '../utils/response.util';
import { UserRole } from '../types/enums';

export class PostController {
  // ── CREATE ───────────────────────────────────────────────────────
  static async createPost(req: Request, res: Response) {
    try {
      const post = await PostService.createPost(req.user!.id, req.body);
      return ApiResponse.created(res, post);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  // ── FEED ─────────────────────────────────────────────────────────
  static async getFeed(req: Request, res: Response) {
    try {
      const result = await PostService.getFeed(req.user?.id || '', req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ── REELS ────────────────────────────────────────────────────────
  static async getReels(req: Request, res: Response) {
    try {
      const result = await PostService.getReels(req.user?.id || '', req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ── SINGLE POST ──────────────────────────────────────────────────
  static async getPostById(req: Request, res: Response) {
    try {
      const post = await PostService.getPostById(req.params.id, req.user?.id);
      if (!post) return ApiResponse.error(res, 'Post not found', 404, 'NOT_FOUND');
      return ApiResponse.success(res, post);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────
  static async deletePost(req: Request, res: Response) {
    try {
      const isAdmin = req.user?.role === UserRole.ADMIN;
      await PostService.deletePost(req.params.id, req.user!.id, isAdmin);
      return ApiResponse.success(res, { deleted: true }, 'Post removed');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ── LIKE / UNLIKE ────────────────────────────────────────────────
  static async toggleLike(req: Request, res: Response) {
    try {
      const result = await PostService.toggleLike(req.params.id, req.user!.id);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ── LIKED-BY LIST ────────────────────────────────────────────────
  static async getLikedBy(req: Request, res: Response) {
    try {
      const result = await PostService.getLikedBy(req.params.id, req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ── TOGGLE SAVE / UNSAVE ─────────────────────────────────────────
  static async toggleSave(req: Request, res: Response) {
    try {
      const result = await PostService.toggleSave(req.user!.id, req.params.id);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ── SHARE ────────────────────────────────────────────────────────
  static async sharePost(req: Request, res: Response) {
    try {
      const platform = req.body.platform || 'internal';
      const result = await PostService.sharePost(req.params.id, req.user!.id, platform);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ── RECORD VIEW ──────────────────────────────────────────────────
  static async recordView(req: Request, res: Response) {
    try {
      const result = await PostService.recordView(req.params.id, req.user!.id);
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ── REPORT ───────────────────────────────────────────────────────
  static async reportPost(req: Request, res: Response) {
    try {
      const result = await PostService.reportPost(
        req.params.id,
        req.user!.id,
        req.body.reason,
        req.body.details
      );
      return ApiResponse.success(res, result, 'Report submitted for review');
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  // ── GET COMMENTS (threaded) ───────────────────────────────────
  static async getComments(req: Request, res: Response) {
    try {
      const comments = await PostService.getComments(req.params.id, req.user?.id);
      return ApiResponse.success(res, comments);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ── ADD COMMENT ──────────────────────────────────────────────────
  static async addComment(req: Request, res: Response) {
    try {
      const comment = await PostService.addComment(
        req.params.id,
        req.user!.id,
        req.body.content,
        req.body.parentId
      );
      return ApiResponse.created(res, comment);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 400);
    }
  }

  // ── TOGGLE COMMENT LIKE ──────────────────────────────────────────
  static async toggleCommentLike(req: Request, res: Response) {
    try {
      const result = await PostService.toggleCommentLike(
        req.params.commentId,
        req.user!.id
      );
      return ApiResponse.success(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ── SAVED POSTS ──────────────────────────────────────────────────
  static async getSavedPosts(req: Request, res: Response) {
    try {
      const result = await PostService.getSavedPosts(req.user!.id, req.query);
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ── USER POSTS (for profile page) ───────────────────────────────
  static async getUserPosts(req: Request, res: Response) {
    try {
      const result = await PostService.getUserPosts(
        req.params.userId,
        req.user?.id || '',
        req.query
      );
      return ApiResponse.paginated(res, result);
    } catch (error: any) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}
