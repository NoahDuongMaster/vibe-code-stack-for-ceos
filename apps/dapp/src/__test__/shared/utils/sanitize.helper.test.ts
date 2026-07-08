import { describe, expect, it } from 'vitest';
import {
  isSafeRedirectPath,
  isValidOrigin,
  sanitizeUrl,
} from '@/shared/utils/sanitize.helper';

describe('sanitize.helper', () => {
  describe('sanitizeUrl', () => {
    it('should pass through safe protocols (http, https, mailto, tel)', () => {
      expect(sanitizeUrl('https://example.com/path')).toBe(
        'https://example.com/path',
      );
      expect(sanitizeUrl('mailto:hello@example.com')).toBe(
        'mailto:hello@example.com',
      );
      expect(sanitizeUrl('tel:+15551234')).toBe('tel:+15551234');
    });

    it('should neutralise dangerous protocols to "#"', () => {
      expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
      expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('#');
    });

    it('should return "#" for malformed input', () => {
      expect(sanitizeUrl('not a url')).toBe('#');
      expect(sanitizeUrl('')).toBe('#');
    });
  });

  describe('isValidOrigin', () => {
    const allowList = ['https://app.example.com', 'https://admin.example.com'];

    it('should accept an origin whose hostname is on the allow list', () => {
      expect(
        isValidOrigin('https://app.example.com/dashboard', allowList),
      ).toBe(true);
    });

    it('should reject an origin not on the allow list', () => {
      expect(isValidOrigin('https://evil.example.net', allowList)).toBe(false);
    });

    it('should reject malformed origins and an empty allow list', () => {
      expect(isValidOrigin('garbage', allowList)).toBe(false);
      expect(isValidOrigin('https://app.example.com', [])).toBe(false);
    });
  });

  describe('isSafeRedirectPath', () => {
    it('should accept a same-origin relative path', () => {
      expect(isSafeRedirectPath('/account')).toBe(true);
      expect(isSafeRedirectPath('/account?tab=billing')).toBe(true);
    });

    it('should reject a protocol-relative URL (open redirect)', () => {
      expect(isSafeRedirectPath('//evil.com')).toBe(false);
      expect(isSafeRedirectPath('//evil.com/phishing')).toBe(false);
    });

    it('should reject the backslash protocol-relative variant', () => {
      expect(isSafeRedirectPath('/\\evil.com')).toBe(false);
    });

    it('should reject anything not starting with a single slash', () => {
      expect(isSafeRedirectPath('https://evil.com')).toBe(false);
      expect(isSafeRedirectPath('account')).toBe(false);
      expect(isSafeRedirectPath('')).toBe(false);
    });
  });
});
