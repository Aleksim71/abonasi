// frontend/src/pages/useReorderA11y.ts
import { useCallback, useMemo, useRef, useState } from 'react';

export type ReorderId = string;

export type UseReorderA11yArgs = {
  ids: ReorderId[];
  onMove: (fromIndex: number, toIndex: number) => void;
  getItemLabel?: (id: ReorderId, index: number) => string;
};

export type ReorderA11y = {
  liftedId: ReorderId | null;
  instructionsId: string;
  liveRegionId: string;
  getItemProps: (
    id: ReorderId,
    index: number
  ) => {
    tabIndex: 0;
    role: 'listitem';
    'aria-roledescription': string;
    'aria-describedby': string;
    'aria-grabbed': boolean;
    'data-kbd-lifted': 'true' | 'false';
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
    onBlur: () => void;
  };
  liveMessage: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function defaultLabel(_id: string, index: number): string {
  return `Item ${index + 1}`;
}

export function useReorderA11y(args: UseReorderA11yArgs): ReorderA11y {
  const { ids, onMove, getItemLabel = defaultLabel } = args;

  const total = ids.length;

  const [liftedId, setLiftedId] = useState<ReorderId | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const originalIndexRef = useRef<number | null>(null);

  const instructionsId = useMemo(
    () => 'draft-photos-reorder-instructions',
    []
  );
  const liveRegionId = useMemo(() => 'draft-photos-reorder-live', []);

  const announce = useCallback((msg: string) => {
    setLiveMessage('');
    queueMicrotask(() => setLiveMessage(msg));
  }, []);

  const lift = useCallback(
    (id: ReorderId, index: number) => {
      setLiftedId(id);
      originalIndexRef.current = index;
      announce(
        `${getItemLabel(id, index)} lifted. Use Arrow keys to move. Press Space or Enter to drop. Press Escape to cancel.`
      );
    },
    [announce, getItemLabel]
  );

  const drop = useCallback(
    (id: ReorderId, index: number) => {
      setLiftedId(null);
      originalIndexRef.current = null;
      announce(
        `${getItemLabel(id, index)} dropped at position ${index + 1} of ${total}.`
      );
    },
    [announce, getItemLabel, total]
  );

  const cancel = useCallback(
    (id: ReorderId, currentIndex: number) => {
      const from = originalIndexRef.current;
      setLiftedId(null);

      if (from !== null && from !== currentIndex) {
        onMove(currentIndex, from);
        announce(
          `${getItemLabel(id, from)} move cancelled. Returned to position ${
            from + 1
          } of ${total}.`
        );
      } else {
        announce(`${getItemLabel(id, currentIndex)} cancelled.`);
      }

      originalIndexRef.current = null;
    },
    [announce, getItemLabel, onMove, total]
  );

  const onKeyDown = useCallback(
    (id: ReorderId, index: number) =>
      (e: React.KeyboardEvent<HTMLElement>) => {
        const { key } = e;

        const isToggle = key === ' ' || key === 'Enter';
        const isUp = key === 'ArrowUp';
        const isDown = key === 'ArrowDown';
        const isEsc = key === 'Escape';

        if (!isToggle && !isUp && !isDown && !isEsc) return;

        e.preventDefault();
        e.stopPropagation();

        const isLifted = liftedId === id;

        if (isToggle) {
          if (!liftedId) return lift(id, index);
          if (isLifted) return drop(id, index);
          return;
        }

        if (!isLifted) return;

        if (isEsc) return cancel(id, index);

        const delta = isUp ? -1 : 1;
        const to = clamp(index + delta, 0, total - 1);
        if (to === index) return;

        onMove(index, to);
        announce(
          `${getItemLabel(id, to)} moved to position ${to + 1} of ${total}.`
        );
      },
    [announce, cancel, drop, lift, liftedId, onMove, total, getItemLabel]
  );

  // noop; signature without params avoids eslint unused-var noise
  const onBlur = useCallback(() => () => {}, []);

  const getItemProps = useCallback(
    (id: ReorderId, index: number) => {
      const isLifted = liftedId === id;

      // ключевой фикс: держим literal union, а не string
      const kbdLifted: 'true' | 'false' = isLifted ? 'true' : 'false';

      return {
        tabIndex: 0 as const,
        role: 'listitem' as const,
        'aria-roledescription': 'Sortable item',
        'aria-describedby': instructionsId,
        'aria-grabbed': isLifted,
        'data-kbd-lifted': kbdLifted,
        onKeyDown: onKeyDown(id, index),
        onBlur: onBlur()
      };
    },
    [instructionsId, liftedId, onBlur, onKeyDown]
  );

  return {
    liftedId,
    instructionsId,
    liveRegionId,
    getItemProps,
    liveMessage
  };
}
