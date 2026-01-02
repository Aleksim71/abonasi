'use strict';

const fs = require('fs');
const path = require('path');

/**
 * D3b — Guard against regressions in ads lifecycle error-contract.
 *
 * Rule:
 * - Inside src/modules/ads we do NOT allow returning `{ ok:false, ... }`
 * - We also do NOT allow stale comments that claim this pattern.
 *
 * Why:
 * - D3a standardized: lifecycle throws TxError via txError(status, code, message)
 * - Controller handles err.status + err.body
 */

const ROOT = path.resolve(__dirname, '..'); // backend/
const ADS_DIR = path.join(ROOT, 'src', 'modules', 'ads');

function walk(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

describe('D3b guard: ads error-contract stays "throw txError"', () => {
  test('no "{ ok:false }" pattern in src/modules/ads', () => {
    if (!fs.existsSync(ADS_DIR)) {
      throw new Error(`ads dir not found: ${ADS_DIR}`);
    }

    const files = walk(ADS_DIR).filter((p) =>
  p.endsWith('.lifecycle.js') || p.endsWith('ads.lifecycle.js')
);

    const forbidden = [
      {
        name: 'ok:false object return (code)',
        re: /\bok\s*:\s*false\b/g
      },
      {
        name: 'stale comment "returns { ok:false, status, body }"',
        re: /returns\s*\{\s*ok\s*:\s*false\s*,\s*status\s*,\s*body\s*\}/gi
      }
    ];

    const hits = [];

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');

      for (const rule of forbidden) {
        rule.re.lastIndex = 0;
        if (rule.re.test(src)) {
          hits.push(`- ${rule.name}: ${rel(file)}`);
        }
      }
    }

    if (hits.length) {
      const msg =
        `Forbidden patterns found in ${rel(ADS_DIR)}.\n` +
        `D3a contract requires: throw txError(status, code, message), not { ok:false }.\n\n` +
        hits.join('\n');
      throw new Error(msg);
    }
  });
});
