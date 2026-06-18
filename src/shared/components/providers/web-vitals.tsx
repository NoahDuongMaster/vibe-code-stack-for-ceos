'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { logger } from '@/shared/utils/logger.helper';

const WebVitals = () => {
  useReportWebVitals((metric) => {
    switch (metric.name) {
      case 'TTFB':
        logger.info(`TTFB: ${(metric.value / 1000).toFixed(2)}s`);
        break;
      case 'FCP':
        logger.info(`FCP: ${(metric.value / 1000).toFixed(2)}s`);
        break;
      case 'LCP':
        logger.info(`LCP: ${(metric.value / 1000).toFixed(2)}s`);
        break;
      case 'CLS':
        logger.info(`CLS: ${metric.value.toFixed(3)}`);
        break;
      case 'INP':
        logger.info(`INP: ${metric.value.toFixed(0)}ms`);
        break;
    }
  });

  return null;
};

export default WebVitals;
