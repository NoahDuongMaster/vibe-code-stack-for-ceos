import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@/shared/lib/xhr', () => ({
  Request: class {
    get = mockGet;
    post = mockPost;
  },
}));

vi.mock('@/shared/config/env.configuration', () => ({
  env: { client: { NEXT_PUBLIC_API_ENDPOINT: 'http://localhost:3000' } },
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

import {
  createPostAPI,
  getPostByIdAPI,
  getPostsAPI,
} from '@/__examples__/_full-feature/adapters/post.adapter';

describe('Post Adapter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getPostsAPI calls request.get with query params', async () => {
    const expected = {
      data: { items: [], total: 0, page: 1, limit: 10, totalPages: 0 },
      message: 'OK',
      success: true,
    };
    mockGet.mockResolvedValue(expected);

    const result = await getPostsAPI({ page: 1, limit: 10 });

    expect(mockGet).toHaveBeenCalledWith('/api/mock', { page: 1, limit: 10 });
    expect(result).toEqual(expected);
  });

  it('getPostByIdAPI calls request.get with id in URL', async () => {
    const post = {
      id: '1',
      title: 'Test',
      body: 'Body',
      userId: 'u1',
      createdAt: '2024-01-01',
    };
    mockGet.mockResolvedValue(post);

    const result = await getPostByIdAPI('1');

    expect(mockGet).toHaveBeenCalledWith('/api/mock/1');
    expect(result).toEqual(post);
  });

  it('createPostAPI calls request.post with input body', async () => {
    const input = { title: 'New', body: 'Content' };
    const created = {
      id: '2',
      ...input,
      userId: 'u1',
      createdAt: '2024-01-01',
    };
    mockPost.mockResolvedValue(created);

    const result = await createPostAPI(input);

    expect(mockPost).toHaveBeenCalledWith('/api/mock', input);
    expect(result).toEqual(created);
  });
});
