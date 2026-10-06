import { createPostSchema } from '../src/validators/post.validator';

const testPayload = {
  body: {
    caption: 'Test reel',
    postType: 'reel',
    mediaUrls: ['https://example.com/video.mp4'],
    thumbnailUrl: null,
    location: null,
    category: null,
    community: null,
    tags: [],
    taggedUsers: [],
    audience: 'public',
    allowComments: true,
    allowReposts: true
  }
};

const result = createPostSchema.safeParse(testPayload);
console.log('Validation success?', result.success);
if (!result.success) {
  console.log('Errors:', JSON.stringify(result.error.issues, null, 2));
}
