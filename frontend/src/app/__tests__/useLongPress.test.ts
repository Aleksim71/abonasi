// frontend/src/app/__tests__/useLongPress.test.ts

import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '../../pages/useLongPress';

// In jsdom (Vitest env) PointerEvent may be undefined.
// We only need { clientX, clientY } to exercise our hook logic.
type MinimalPointerLike = { clientX: number; clientY: number };

function makePointerLike(x: number, y: number): MinimalPointerLike {
  return { clientX: x, clientY: y };
}

function wrapPointer(nativeEvent: MinimalPointerLike) {
  return { nativeEvent } as unknown as React.PointerEvent;
}

describe('useLongPress', () => {
  it('fires onLongPress after delay', () => {
    vi.useFakeTimers();

    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { delayMs: 100, moveTolerancePx: 8 }));

    act(() => {
      result.current.bind.onPointerDown(wrapPointer(makePointerLike(10, 10)));
    });

    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(result.current.isLongPressActive).toBe(true);

    vi.useRealTimers();
  });

  it('cancels if moved beyond tolerance before delay', () => {
    vi.useFakeTimers();

    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { delayMs: 100, moveTolerancePx: 5 }));

    act(() => {
      result.current.bind.onPointerDown(wrapPointer(makePointerLike(10, 10)));
    });

    act(() => {
      // moved 10px → > tolerance (5) → should cancel
      result.current.bind.onPointerMove(wrapPointer(makePointerLike(20, 10)));
    });

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(onLongPress).toHaveBeenCalledTimes(0);
    expect(result.current.isLongPressActive).toBe(false);

    vi.useRealTimers();
  });

  it('once=true fires only once even if armed again', () => {
    vi.useFakeTimers();

    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { delayMs: 50, once: true }));

    // First arm -> fires
    act(() => {
      result.current.bind.onPointerDown(wrapPointer(makePointerLike(0, 0)));
      vi.advanceTimersByTime(60);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(result.current.isLongPressActive).toBe(true);

    // UI may reset active state, but once=true must prevent second call
    act(() => {
      result.current.reset();
    });
    expect(result.current.isLongPressActive).toBe(false);

    // Second arm -> should NOT fire
    act(() => {
      result.current.bind.onPointerDown(wrapPointer(makePointerLike(0, 0)));
      vi.advanceTimersByTime(60);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
