import { describe, expect, it } from 'vitest';
import { camelizeKeys, snakifyKeys } from '@/shared/utils/case.helper';

describe('case.helper', () => {
  describe('camelizeKeys', () => {
    it('should deep-convert snake_case keys to camelCase when given a nested object', () => {
      const input = { user_id: 1, nested_obj: { first_name: 'Ada' } };

      expect(camelizeKeys(input)).toEqual({
        userId: 1,
        nestedObj: { firstName: 'Ada' },
      });
    });

    it('should convert keys inside arrays of objects', () => {
      const input = { list_items: [{ item_id: 1 }, { item_id: 2 }] };

      expect(camelizeKeys(input)).toEqual({
        listItems: [{ itemId: 1 }, { itemId: 2 }],
      });
    });

    it('should return primitives and nullish values unchanged', () => {
      expect(camelizeKeys<string>('untouched')).toBe('untouched');
      expect(camelizeKeys<null>(null)).toBeNull();
      expect(camelizeKeys<undefined>(undefined)).toBeUndefined();
    });
  });

  describe('snakifyKeys', () => {
    it('should deep-convert camelCase keys to snake_case when given a nested object', () => {
      const input = { userId: 1, nestedObj: { firstName: 'Ada' } };

      expect(snakifyKeys(input)).toEqual({
        user_id: 1,
        nested_obj: { first_name: 'Ada' },
      });
    });

    it('should be reversible with camelizeKeys', () => {
      const original = { user_id: 1, nested_obj: { first_name: 'Ada' } };

      expect(snakifyKeys(camelizeKeys(original))).toEqual(original);
    });
  });
});
