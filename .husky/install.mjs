// Skip Husky install in production and CI. Truthy (not exact-match) checks —
// GitHub Actions sets CI=true, but other CI providers use CI=1.
if (process.env.NODE_ENV === 'production' || process.env.CI) {
  process.exit(0);
}
const husky = (await import('husky')).default;
console.log(husky());
