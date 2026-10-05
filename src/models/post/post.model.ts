import { BaseModel } from '../common/base.model';
import { PostType } from '../../types/enums';

export interface PostModel extends BaseModel {
  authorId: string;
  caption?: string;
  mediaUrls: string[];
  postType: PostType;
  thumbnailUrl?: string;
  tags: string[];
  location?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  isModerated: boolean;
  flaggedForReview: boolean;
}

export interface PostCommentModel extends BaseModel {
  postId: string;
  authorId: string;
  parentId?: string;
  content: string;
}

export interface PostReactionModel {
  id: string;
  postId: string;
  userId: string;
  reactionType: string;
  createdAt: Date;
}
