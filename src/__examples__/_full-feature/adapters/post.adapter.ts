// Step 2 of full-feature pattern: adapter — raw HTTP calls only
// Rules: one function per endpoint, no business logic, no error transforms here

import { Request } from '@/shared/lib/xhr';
import { API_ROUTES } from '@/shared/constants/routes.constant';
import type { TPaginatedResponse } from '@/shared/types/api.types';
import type {
  TCreatePostInput,
  TGetPostsQuery,
  TPost,
} from '../schema/post.schema';

const request = new Request();

export const getPostsAPI = async (
  query: TGetPostsQuery,
): Promise<TPaginatedResponse<TPost>> =>
  request.get<TPaginatedResponse<TPost>>(API_ROUTES.GET_MOCK, query);

export const getPostByIdAPI = async (id: string): Promise<TPost> =>
  request.get<TPost>(`${API_ROUTES.GET_MOCK}/${id}`);

export const createPostAPI = async (input: TCreatePostInput): Promise<TPost> =>
  request.post<TCreatePostInput, TPost>(API_ROUTES.GET_MOCK, input);
