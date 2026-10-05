import { z } from 'zod';
import { PostType } from '../types/enums';

export const createPostSchema = z.object({
  body: z.object({
    caption:       z.string().max(2000).optional(),
    content:       z.string().max(2000).optional(),
    mediaUrls:     z.array(z.string().url()).default([]),
    media_urls:    z.array(z.string().url()).optional(),
    postType:      z.nativeEnum(PostType).default(PostType.POST),
    thumbnailUrl:  z.string().url().optional(),
    tags:          z.array(z.string()).default([]),
    location:      z.string().optional(),
    audience:      z.enum(['public','connections','community','private']).default('public'),
    category:      z.string().max(100).optional(),
    community:     z.string().max(100).optional(),
    taggedUsers:   z.array(z.string().uuid()).default([]),
    allowComments: z.boolean().default(true),
    allowReposts:  z.boolean().default(true),
  }).refine((data) => {
    const text = data.caption || data.content;
    const hasMedia = (data.mediaUrls && data.mediaUrls.length > 0) || (data.media_urls && data.media_urls.length > 0);
    return Boolean((text && text.trim().length > 0) || hasMedia);
  }, {
    message: 'Post must contain either text content or at least one media file.',
    path: ['content'],
  }),
});

export const createCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Comment cannot be empty').max(1000),
    parentId: z.string().uuid().optional(),
  }),
});

export const reportPostSchema = z.object({
  body: z.object({
    reason: z.string().min(3, 'Report reason is required'),
    details: z.string().optional(),
  }),
});
