import type { ButtonHTMLAttributes } from 'react';
import { cva, cx } from '@/styled-system/css';

const button = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    rounded: 'lg',
    fontWeight: 'semibold',
    fontSize: 'sm',
    cursor: 'pointer',
    transition: 'all',
    transitionDuration: '150ms',
    whiteSpace: 'nowrap',
    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'ring',
      outlineOffset: '2px',
    },
  },
  variants: {
    variant: {
      primary: {
        bg: 'primary',
        color: 'primary.foreground',
        _hover: { opacity: 0.9 },
      },
      secondary: {
        bg: 'secondary',
        color: 'secondary.foreground',
        _hover: { opacity: 0.8 },
      },
      ghost: {
        bg: 'transparent',
        color: 'foreground',
        _hover: { bg: 'accent' },
      },
      destructive: {
        bg: 'destructive',
        color: 'white',
        _hover: { opacity: 0.9 },
      },
    },
    size: {
      sm: { px: '3', py: '1.5', h: '8' },
      md: { px: '4', py: '2', h: '10' },
    },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
});

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md';
};

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(button({ variant, size }), className)}
      {...props}
    />
  );
}
