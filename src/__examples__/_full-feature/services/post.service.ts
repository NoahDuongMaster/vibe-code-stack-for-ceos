// Step 3 of full-feature pattern: service — business logic + orchestration
// Rules: calls adapters, may transform/combine data, never imports from components/app

import type { TPaginatedResponse } from '@/shared/types/api.types';
import {
  createPostAPI,
  getPostByIdAPI,
  getPostsAPI,
} from '../adapters/post.adapter';
import type {
  TCreatePostInput,
  TGetPostsQuery,
  TPost,
} from '../schema/post.schema';

export const postService = {
  async getPosts(
    query: TGetPostsQuery = {},
  ): Promise<TPaginatedResponse<TPost>> {
    return getPostsAPI(query);
  },

  async getPostById(id: string): Promise<TPost> {
    return getPostByIdAPI(id);
  },

  async createPost(input: TCreatePostInput): Promise<TPost> {
    return createPostAPI(input);
  },
};
