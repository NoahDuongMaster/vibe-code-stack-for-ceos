/// <reference types="@rsbuild/core/types" />

// Enables strict `import.meta.env` typing — an undeclared or typo'd env key
// now fails typecheck instead of silently widening to `any`.
interface RsbuildTypeOptions {
  strictImportMetaEnv: true;
}

interface ImportMetaEnv {
  readonly PUBLIC_API_URL?: string;
  readonly PUBLIC_SENTRY_DSN?: string;
  readonly PUBLIC_ENABLE_MOCK_AUTH?: string;
}
