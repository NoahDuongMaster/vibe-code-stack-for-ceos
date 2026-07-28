import { createRobotsResponse } from '@/shared/seo';

export const GET: import('astro').APIRoute = ({ site }) =>
  createRobotsResponse(site);
