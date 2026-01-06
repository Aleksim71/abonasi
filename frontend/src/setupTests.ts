import '@testing-library/jest-dom/vitest';

// Silence React Router v7 future-flag warnings in tests only
const originalWarn = console.warn.bind(console);

console.warn = (...args: unknown[]) => {
  const first = args[0];

  if (
    typeof first === 'string' &&
    (first.includes('React Router Future Flag Warning') ||
      first.includes('v7_startTransition') ||
      first.includes('v7_relativeSplatPath'))
  ) {
    return;
  }

  originalWarn(...args);
};
