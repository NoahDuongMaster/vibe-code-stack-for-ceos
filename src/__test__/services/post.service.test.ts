import { beforeEach, describe, expect, it, vi } from 'vitest';

// Must mock env + xhr deps before any import that transitively loads them
vi.mock('@/shared/config/env.configuration', () => ({
  env: {
    client: {
      NEXT_PUBLIC_API_ENDPOINT: 'http://localhost:3000',
      NEXT_PUBLIC_PROJECT_NAME: 'test',
    },
  },
}));
vi.mock('@/shared/config/jwt.configuration', () => ({
  jwt: {
    accessToken: { key: 'access_token' },
    refreshToken: { key: 'refresh_token' },
  },
}));
vi.mock('@/shared/constants/routes.constant', () => ({
  WEB_ROUTES: { SIGN_IN: '/sign-in' },
  API_ROUTES: { GET_MOCK: '/api/mock' },
}));

import * as postAdapter from '@/__examples__/_full-feature/adapters/post.adapter';
import type { TPost } from '@/__examples__/_full-feature/schema/post.schema';
import { postService } from '@/__examples__/_full-feature/services/post.service';
import type { TPaginatedResponse } from '@/shared/types/api.types';

vi.mock('@/__examples__/_full-feature/adapters/post.adapter');

const mockPost: TPost = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Test Post',
  body: 'This is the body of the test post with enough content.',
  userId: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
};

const mockPaginated: TPaginatedResponse<TPost> = {
  data: {
    items: [mockPost],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  },
  message: 'OK',
  success: true,
};

describe('postService', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getPosts()', () => {
    it('delegates to adapter with provided query', async () => {
      vi.mocked(postAdapter.getPostsAPI).mockResolvedValue(mockPaginated);

      const result = await postService.getPosts({ limit: 10, page: 1 });

      expect(postAdapter.getPostsAPI).toHaveBeenCalledWith({
        limit: 10,
        page: 1,
      });
      expect(result).toEqual(mockPaginated);
    });

    it('defaults to empty query when no args passed', async () => {
      vi.mocked(postAdapter.getPostsAPI).mockResolvedValue({
        data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 },
        message: 'OK',
        success: true,
      });

      await postService.getPosts();

      expect(postAdapter.getPostsAPI).toHaveBeenCalledWith({});
    });

    it('propagates adapter errors to the caller', async () => {
      vi.mocked(postAdapter.getPostsAPI).mockRejectedValue(
        new Error('Network error'),
      );

      await expect(postService.getPosts()).rejects.toThrow('Network error');
    });
  });

  describe('getPostById()', () => {
    it('delegates to adapter with the given id', async () => {
      vi.mocked(postAdapter.getPostByIdAPI).mockResolvedValue(mockPost);

      const result = await postService.getPostById(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(postAdapter.getPostByIdAPI).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
      );
      expect(result).toEqual(mockPost);
    });

    it('propagates not-found errors', async () => {
      vi.mocked(postAdapter.getPostByIdAPI).mockRejectedValue(
        new Error('404 Not Found'),
      );

      await expect(postService.getPostById('nonexistent')).rejects.toThrow(
        '404 Not Found',
      );
    });
  });

  describe('createPost()', () => {
    it('delegates to adapter with input and returns created post', async () => {
      const input = {
        title: 'New Post Title',
        body: 'New post body content goes here.',
      };
      vi.mocked(postAdapter.createPostAPI).mockResolvedValue({
        ...mockPost,
        ...input,
      });

      const result = await postService.createPost(input);

      expect(postAdapter.createPostAPI).toHaveBeenCalledWith(input);
      expect(result.title).toBe(input.title);
      expect(result.body).toBe(input.body);
    });

    it('propagates validation errors from adapter', async () => {
      vi.mocked(postAdapter.createPostAPI).mockRejectedValue(
        new Error('422 Unprocessable Entity'),
      );

      await expect(
        postService.createPost({ title: '', body: '' }),
      ).rejects.toThrow('422 Unprocessable Entity');
    });
  });
});
