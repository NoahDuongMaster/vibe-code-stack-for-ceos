import { createRobotsResponse } from '@/app/seo';

export const GET: import('astro').APIRoute = ({ site }) =>
  createRobotsResponse(site);
