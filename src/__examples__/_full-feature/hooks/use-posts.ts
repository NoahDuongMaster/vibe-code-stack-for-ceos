// Step 4 (optional): custom hook — wraps TanStack Query for reuse
// Rules: file in src/hooks/ for shared hooks, or co-located for feature-specific

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TCreatePostInput, TGetPostsQuery } from '../schema/post.schema';
import { postService } from '../services/post.service';

const POSTS_KEY = 'posts';

export function usePosts(query: TGetPostsQuery = {}) {
  return useQuery({
    queryKey: [POSTS_KEY, query],
    queryFn: () => postService.getPosts(query),
    staleTime: 30_000,
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: [POSTS_KEY, id],
    queryFn: () => postService.getPostById(id),
    enabled: !!id,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TCreatePostInput) => postService.createPost(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [POSTS_KEY] });
    },
  });
}
