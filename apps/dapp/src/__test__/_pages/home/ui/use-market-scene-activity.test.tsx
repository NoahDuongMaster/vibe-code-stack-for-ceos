import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMarketSceneActivity } from '@/_pages/home/ui/use-market-scene-activity';

const motionState = vi.hoisted(() => ({ reducedMotion: false }));

vi.mock('motion/react', () => ({
  useReducedMotion: () => motionState.reducedMotion,
}));

let intersectionCallback: IntersectionObserverCallback | undefined;
const disconnect = vi.fn();

function ActivityHarness() {
  const { containerRef, reducedMotion, shouldAnimate } =
    useMarketSceneActivity();

  return (
    <div
      ref={containerRef}
      data-testid="activity"
      data-animate={String(shouldAnimate)}
      data-reduced-motion={String(reducedMotion)}
    />
  );
}

describe('[MarketSceneActivity]', () => {
  beforeEach(() => {
    motionState.reducedMotion = false;
    intersectionCallback = undefined;
    disconnect.mockClear();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          intersectionCallback = callback;
        }

        disconnect = disconnect;
        observe = vi.fn();
        takeRecords = vi.fn(() => []);
        unobserve = vi.fn();
        root = null;
        rootMargin = '0px';
        thresholds = [0];
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should pause when the scene is offscreen or the document is hidden', () => {
    render(<ActivityHarness />);
    expect(screen.getByTestId('activity').dataset.animate).toBe('true');

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(screen.getByTestId('activity').dataset.animate).toBe('false');

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(screen.getByTestId('activity').dataset.animate).toBe('false');
  });

  it('should disable animation for reduced motion and clean up observers', () => {
    motionState.reducedMotion = true;
    const { unmount } = render(<ActivityHarness />);

    expect(screen.getByTestId('activity').dataset.reducedMotion).toBe('true');
    expect(screen.getByTestId('activity').dataset.animate).toBe('false');

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
