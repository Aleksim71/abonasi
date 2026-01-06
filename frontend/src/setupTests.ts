// frontend/src/setupTests.ts
import '@testing-library/jest-dom';

// ------------------------------------------------------
// React Router warnings suppression (only in tests)
// ------------------------------------------------------
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
  const msg = String(args[0] ?? '');
  // suppress RR v7 future warnings (test env noise)
  if (msg.includes('React Router Future Flag Warning')) return;
  originalWarn(...args);
};

// ------------------------------------------------------
// JSDOM polyfills/mocks
// ------------------------------------------------------
// Vitest/JSDOM doesn't implement URL.createObjectURL by default.
// Our upload UI uses it to preview selected files.
if (typeof URL !== 'undefined') {
  if (typeof URL.createObjectURL !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).createObjectURL = () => 'blob:mock-preview-url';
  }

  if (typeof URL.revokeObjectURL !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).revokeObjectURL = () => {};
  }
}
