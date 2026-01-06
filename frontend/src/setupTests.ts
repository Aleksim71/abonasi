// frontend/src/setupTests.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import '@testing-library/jest-dom';

// IMPORTANT:
// Backend dev server is on 3001 (and tests/MSW handlers are aligned with that).
// If Request/fetch gets "/api/..." in Node/jsdom, undici requires an absolute URL.
// So we normalize to http://localhost:3001
const ABS_ORIGIN = 'http://localhost:3001';

function toAbsoluteUrl(input: unknown): unknown {
  if (typeof input === 'string') {
    return input.startsWith('/') ? `${ABS_ORIGIN}${input}` : input;
  }

  if (input instanceof URL) return input;

  // If it's a Request and its url is relative (rare, but keep safe)
  if (typeof input === 'object' && input && 'url' in (input as any)) {
    const url = String((input as any).url || '');
    if (url.startsWith('/')) {
      const req = input as Request;
      return new Request(`${ABS_ORIGIN}${url}`, req);
    }
  }

  return input;
}

// Patch Request (do NOT replace fetch — MSW should keep intercepting normally)
const RealRequest = globalThis.Request;

class PatchedRequest extends RealRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(toAbsoluteUrl(input) as any, init);
  }
}

(globalThis as any).Request = PatchedRequest;
