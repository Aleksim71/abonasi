// frontend/src/pages/useLongPress.ts

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';

import { LONG_PRESS_DELAY_MS, TOUCH_MOVE_TOLERANCE_PX } from './draftPhotos.touch.constants';

type Point = { x: number; y: number };

function getClientPoint(ev: PointerEvent | TouchEvent): Point {
  // PointerEvent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyEv: any = ev;
  if (typeof anyEv.clientX === 'number' && typeof anyEv.clientY === 'number') {
    return { x: anyEv.clientX, y: anyEv.clientY };
  }

  // TouchEvent
  const t = (ev as TouchEvent).touches?.[0] ?? (ev as TouchEvent).changedTouches?.[0];
  if (t) return { x: t.clientX, y: t.clientY };

  return { x: 0, y: 0 };
}

function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export type UseLongPressOptions = {
  delayMs?: number;
  moveTolerancePx?: number;
  once?: boolean;
};

export type LongPressBind = {
  onPointerDown: React.PointerEventHandler;
  onPointerMove: React.PointerEventHandler;
  onPointerUp: React.PointerEventHandler;
  onPointerCancel: React.PointerEventHandler;

  // Optional fallback for older mobile Safari:
  onTouchStart: React.TouchEventHandler;
  onTouchMove: React.TouchEventHandler;
  onTouchEnd: React.TouchEventHandler;
  onTouchCancel: React.TouchEventHandler;
};

export type UseLongPressResult = {
  isLongPressActive: boolean;
  reset: () => void;
  bind: LongPressBind;
};

/**
 * Long-press detector with:
 * - proper timer cleanup
 * - scroll-friendly cancellation (move tolerance)
 * - "once" mode (show hint only once)
 *
 * This hook DOES NOT start dragging; it only signals long-press activation.
 */
export function useLongPress(onLongPress: () => void, options: UseLongPressOptions = {}): UseLongPressResult {
  const delayMs = options.delayMs ?? LONG_PRESS_DELAY_MS;
  const moveTolerancePx = options.moveTolerancePx ?? TOUCH_MOVE_TOLERANCE_PX;
  const once = options.once ?? false;

  const [isLongPressActive, setIsLongPressActive] = useState(false);

  const timerRef = useRef<number | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const startedRef = useRef(false);
  const firedOnceRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    startedRef.current = false;
    startPointRef.current = null;
    clearTimer();
  }, [clearTimer]);

  const reset = useCallback(() => {
    cancel();
    setIsLongPressActive(false);
  }, [cancel]);

  const arm = useCallback(
    (ev: PointerEvent | TouchEvent) => {
      if (once && firedOnceRef.current) return;

      startedRef.current = true;
      setIsLongPressActive(false);
      startPointRef.current = getClientPoint(ev);

      clearTimer();
      timerRef.current = window.setTimeout(() => {
        if (!startedRef.current) return;
        if (once) firedOnceRef.current = true;

        setIsLongPressActive(true);
        onLongPress();
      }, delayMs);
    },
    [clearTimer, delayMs, onLongPress, once]
  );

  const maybeCancelOnMove = useCallback(
    (ev: PointerEvent | TouchEvent) => {
      if (!startedRef.current) return;
      const start = startPointRef.current;
      if (!start) return;

      const now = getClientPoint(ev);
      if (dist(start, now) > moveTolerancePx) {
        // Treat as scroll / gesture → cancel long press
        cancel();
      }
    },
    [cancel, moveTolerancePx]
  );

  const finish = useCallback(() => {
    startedRef.current = false;
    startPointRef.current = null;
    clearTimer();
  }, [clearTimer]);

  // Safety cleanup (unmount)
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const bind: LongPressBind = useMemo(
    () => ({
      onPointerDown: (e) => {
        arm(e.nativeEvent);
      },
      onPointerMove: (e) => {
        maybeCancelOnMove(e.nativeEvent);
      },
      onPointerUp: () => {
        finish();
      },
      onPointerCancel: () => {
        cancel();
      },

      onTouchStart: (e) => {
        arm(e.nativeEvent);
      },
      onTouchMove: (e) => {
        maybeCancelOnMove(e.nativeEvent);
      },
      onTouchEnd: () => {
        finish();
      },
      onTouchCancel: () => {
        cancel();
      }
    }),
    [arm, cancel, finish, maybeCancelOnMove]
  );

  return { isLongPressActive, reset, bind };
}

// Extra guard: even if someone strips exports accidentally, TS will still treat file as a module.
// (Here exports already exist, so this is just belt-and-suspenders.)
export {};
