// Bundle analyzer helper — run with "npm run analyze"
// This wraps next.config to enable @next/bundle-analyzer when ANALYZE=true
import withBundleAnalyzer from '@next/bundle-analyzer';

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export { withAnalyzer };
