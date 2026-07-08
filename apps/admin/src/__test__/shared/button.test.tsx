import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/shared/components/ui/button';

describe('Button', () => {
  it('should render its children', () => {
    render(<Button>Click me</Button>);

    expect(screen.getByRole('button', { name: 'Click me' })).toBeDefined();
  });

  it('should fire onClick when pressed', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);

    await userEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should be disabled when the disabled prop is set', () => {
    render(<Button disabled>Nope</Button>);

    expect(screen.getByRole('button', { name: 'Nope' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});
