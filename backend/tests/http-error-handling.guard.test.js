'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..'); // backend/
const MODULES_DIR = path.join(ROOT, 'src', 'modules');

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

describe('D6 guard: controllers must use handleHttpError (no manual DB_ERROR)', () => {
  test('no forbidden patterns in controllers', () => {
    const files = walk(MODULES_DIR).filter((p) => {
      const rp = rel(p);

      // only controllers:
      // - *.controller.js
      // - special-case controller module: ads.restart.js
      if (rp.endsWith('.controller.js')) return true;
      if (rp === 'src/modules/ads/ads.restart.js') return true;

      return false;
    });

    const forbidden = [
      {
        name: "manual DB_ERROR response",
        re: /res\.status\(\s*500\s*\)\.json\(\s*\{\s*error:\s*'DB_ERROR'/g
      },
      {
        name: 'manual err.status+err.body branching',
        re: /err\s*&&\s*err\.status\s*&&\s*err\.body/g
      }
    ];

    const hits = [];

    for (const file of files) {
      const s = fs.readFileSync(file, 'utf8');

      for (const f of forbidden) {
        if (f.re.test(s)) {
          hits.push(`- ${f.name}: ${rel(file)}`);
        }
      }
    }

    if (hits.length) {
      throw new Error(
        `Forbidden patterns found in controllers.\n` +
          `D6 requires controllers to delegate to handleHttpError(res, err).\n\n` +
          hits.join('\n')
      );
    }
  });
});
