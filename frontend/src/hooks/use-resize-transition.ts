import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefCallback,
} from 'react';

type Size = {
  width: number;
  height: number;
};

function readSize(element: HTMLElement): Size {
  return { width: element.offsetWidth, height: element.offsetHeight };
}

function clearInlineSize(element: HTMLElement) {
  element.style.removeProperty('width');
  element.style.removeProperty('height');
}

function animateSize(
  element: HTMLElement,
  nextSize: Size,
  previousSizeRef: MutableRefObject<Size | undefined>,
  animatingRef: MutableRefObject<boolean>,
  frameRef: MutableRefObject<number | undefined>,
  cleanupRef: MutableRefObject<ReturnType<typeof setTimeout> | undefined>,
) {
  if (animatingRef.current) return;

  const previousSize = previousSizeRef.current;
  previousSizeRef.current = nextSize;
  if (!previousSize) return;
  if (previousSize.width === nextSize.width && previousSize.height === nextSize.height) return;

  animatingRef.current = true;
  if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
  if (cleanupRef.current !== undefined) clearTimeout(cleanupRef.current);

  element.style.width = `${previousSize.width}px`;
  element.style.height = `${previousSize.height}px`;
  void element.offsetHeight;

  frameRef.current = requestAnimationFrame(() => {
    frameRef.current = undefined;
    element.style.width = `${nextSize.width}px`;
    element.style.height = `${nextSize.height}px`;

    const duration = Math.max(
      ...getComputedStyle(element)
        .transitionDuration.split(',')
        .map((value) =>
          value.trim().endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000,
        ),
    );
    cleanupRef.current = setTimeout(
      () => {
        cleanupRef.current = undefined;
        animatingRef.current = false;
        clearInlineSize(element);
      },
      Number.isFinite(duration) ? duration + 50 : 400,
    );
  });
}

export function useResizeTransition<T extends HTMLElement>(
  trigger?: unknown,
  enabled = true,
): RefCallback<T> {
  const [element, setElement] = useState<T | null>(null);
  const previousSizeRef = useRef<Size>();
  const animatingRef = useRef(false);
  const frameRef = useRef<number>();
  const cleanupRef = useRef<ReturnType<typeof setTimeout>>();
  const resizeRef = useCallback<RefCallback<T>>((nextElement) => {
    setElement(nextElement);
  }, []);

  useLayoutEffect(() => {
    if (!element || !enabled) return;

    const observer = new ResizeObserver(() =>
      animateSize(element, readSize(element), previousSizeRef, animatingRef, frameRef, cleanupRef),
    );

    observer.observe(element);
    previousSizeRef.current = readSize(element);

    return () => {
      observer.disconnect();
      if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
      if (cleanupRef.current !== undefined) clearTimeout(cleanupRef.current);
      animatingRef.current = false;
      clearInlineSize(element);
    };
  }, [element, enabled]);

  useLayoutEffect(() => {
    if (!element || !enabled) return;
    animateSize(element, readSize(element), previousSizeRef, animatingRef, frameRef, cleanupRef);
  }, [element, trigger, enabled]);

  return resizeRef;
}
