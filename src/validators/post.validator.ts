import { z } from 'zod';
import { PostType } from '../types/enums';

export const createPostSchema = z.object({
  body: z.object({
    caption:       z.string().max(2000).nullable().optional(),
    content:       z.string().max(2000).nullable().optional(),
    mediaUrls:     z.array(z.string()).default([]),
    media_urls:    z.array(z.string()).optional(),
    postType:      z.nativeEnum(PostType).default(PostType.POST),
    thumbnailUrl:  z.string().nullable().optional(),
    tags:          z.array(z.string()).default([]),
    location:      z.string().nullable().optional(),
    audience:      z.enum(['public','connections','community','private']).default('public'),
    category:      z.string().max(100).nullable().optional(),
    community:     z.string().max(100).nullable().optional(),
    taggedUsers:   z.array(z.string()).default([]),
    allowComments: z.boolean().default(true),
    allowReposts:  z.boolean().default(true),
  }).refine((data) => {
    const text = data.caption || data.content;
    const hasMedia = (data.mediaUrls && data.mediaUrls.length > 0) || (data.media_urls && data.media_urls.length > 0);
    if (data.postType === PostType.WRITE) {
      return Boolean(text && text.trim().length > 0);
    }
    return Boolean((text && text.trim().length > 0) || hasMedia);
  }, {
    message: 'Write posts require text content; media posts require text or media attachment.',
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
