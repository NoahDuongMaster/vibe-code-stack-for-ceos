import camelcaseKeys from 'camelcase-keys';
import snakecaseKeys from 'snakecase-keys';

export function camelizeKeys<T>(obj: unknown): T {
  if (!obj || typeof obj !== 'object') return obj as T;
  return camelcaseKeys(obj as Record<string, unknown>, { deep: true }) as T;
}

export function snakifyKeys<T>(obj: unknown): T {
  if (!obj || typeof obj !== 'object') return obj as T;
  return snakecaseKeys(obj as Record<string, unknown>, { deep: true }) as T;
}
