// Step 1 of full-feature pattern: define Zod schema + derive types
// All types come from schema — no separate type declarations

import { z } from 'zod';

export const ZPost = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().min(1),
  userId: z.string(),
  createdAt: z.string().datetime(),
});

export const ZCreatePostInput = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  body: z.string().min(10, 'Body must be at least 10 characters'),
});

export const ZGetPostsQuery = z.object({
  page: z.number().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
});

export type TPost = z.infer<typeof ZPost>;
export type TCreatePostInput = z.infer<typeof ZCreatePostInput>;
export type TGetPostsQuery = z.infer<typeof ZGetPostsQuery>;
