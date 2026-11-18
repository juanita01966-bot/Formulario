import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.NODE_ENV = 'test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const {
  DEFAULT_GIFT_PROBABILITY,
  sanitizeGiftProbability,
  normalizeGiftRecord,
  pickWeightedGift,
  isMissingColumnError,
  supabaseWriteWithOptionalColumns,
  mapGiftRow,
  memoryGiftProbabilities,
} = await import('../server/index.js');

describe('Gift Probability Sanitization, Weighted Draw & Supabase Compatibility', () => {
  test('sanitizeGiftProbability handles defaults, clamping, rounding, and invalid inputs', () => {
    assert.strictEqual(DEFAULT_GIFT_PROBABILITY, 10);

    // Missing / invalid inputs fall back to default 10 (or provided fallback)
    for (const invalid of [undefined, null, '', '   ', true, false, {}, [], NaN, Infinity, -Infinity, 'abc']) {
      assert.strictEqual(
        sanitizeGiftProbability(invalid),
        10,
        `Expected default 10 for ${String(invalid)}`
      );
      assert.strictEqual(
        sanitizeGiftProbability(invalid, 11.1),
        11.1,
        `Expected custom fallback 11.1 for ${String(invalid)}`
      );
    }

    // Zero & negative clamping (must preserve +0, never -0)
    assert.ok(Object.is(sanitizeGiftProbability(0), 0));
    assert.ok(Object.is(sanitizeGiftProbability('0'), 0));
    assert.ok(Object.is(sanitizeGiftProbability(-0), 0));
    assert.ok(Object.is(sanitizeGiftProbability(-5), 0));
    assert.ok(Object.is(sanitizeGiftProbability('-0.01'), 0));

    // Decimal rounding to 2 decimal places and 100+ weights allowed
    assert.strictEqual(sanitizeGiftProbability(11.1), 11.1);
    assert.strictEqual(sanitizeGiftProbability(11.116), 11.12);
    assert.strictEqual(sanitizeGiftProbability(' 25.555 '), 25.56);
    assert.strictEqual(sanitizeGiftProbability(150), 150);
    assert.strictEqual(sanitizeGiftProbability(250.349), 250.35);
  });

  test('normalizeGiftRecord supplies fallback probability 10 for older records and sanitizes existing values', () => {
    const legacyGift = { id: 'legacy-1', name: 'Legacy Gift', active: true };
    const normalizedLegacy = normalizeGiftRecord(legacyGift);
    assert.strictEqual(normalizedLegacy.probability, 10);

    const zeroGift = { id: 'zero-1', name: 'Zero Weight Gift', active: true, probability: 0 };
    assert.strictEqual(normalizeGiftRecord(zeroGift).probability, 0);

    const negativeGift = { id: 'neg-1', name: 'Negative Gift', active: true, probability: -12.4 };
    assert.strictEqual(normalizeGiftRecord(negativeGift).probability, 0);

    const seededGift = { id: 'seed-1', name: 'Seed Gift', active: true, probability: 11.1 };
    assert.strictEqual(normalizeGiftRecord(seededGift).probability, 11.1);
  });

  test('pickWeightedGift strictly excludes 0-weight gifts when positive weights exist and falls back cleanly if all are 0', () => {
    assert.strictEqual(pickWeightedGift([]), null);

    const skewed = [
      { id: 'disabled-weight', probability: 0 },
      { id: 'only-eligible', probability: 50 },
      { id: 'also-zero', probability: -5 },
    ];
    for (let i = 0; i < 300; i += 1) {
      const picked = pickWeightedGift(skewed);
      assert.strictEqual(picked?.id, 'only-eligible');
    }

    const allZero = [
      { id: 'zero-a', probability: 0 },
      { id: 'zero-b', probability: 0 },
    ];
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) {
      const picked = pickWeightedGift(allZero);
      assert.ok(picked && (picked.id === 'zero-a' || picked.id === 'zero-b'));
      seen.add(picked.id);
    }
    assert.strictEqual(seen.size, 2, 'All-zero fallback should uniformly draw across all gifts');

    const weighted = [
      { id: 'rare', probability: 5 },
      { id: 'common', probability: 95 },
    ];
    let commonCount = 0;
    for (let i = 0; i < 500; i += 1) {
      if (pickWeightedGift(weighted)?.id === 'common') {
        commonCount += 1;
      }
    }
    assert.ok(commonCount > 400, `Expected common gift to dominate weighted draws, got ${commonCount}/500`);
  });

  test('supabaseWriteWithOptionalColumns strips missing probability column gracefully on PostgREST/Postgres errors', async () => {
    // 1. PGRST204 schema cache error for probability only
    const calls1 = [];
    await supabaseWriteWithOptionalColumns(
      'gifts',
      'POST',
      { Prefer: 'return=minimal' },
      { id: 'g-1', name: 'Regalo', usage_tip: 'Tip', probability: 25 },
      ['usage_tip', 'probability'],
      async (_path, init) => {
        const body = JSON.parse(init.body);
        calls1.push(body);
        if ('probability' in body) {
          const err = new Error("Could not find the 'probability' column of 'gifts' in the schema cache");
          err.code = 'PGRST204';
          throw err;
        }
        return null;
      }
    );
    assert.strictEqual(calls1.length, 2);
    assert.strictEqual(calls1[0].probability, 25);
    assert.strictEqual('probability' in calls1[1], false);
    assert.strictEqual(calls1[1].usage_tip, 'Tip');

    // 2. Both probability (42703) and usage_tip (PGRST204) missing on array payload
    const calls2 = [];
    await supabaseWriteWithOptionalColumns(
      'gifts',
      'POST',
      { Prefer: 'resolution=merge-duplicates,return=minimal' },
      [{ id: 'g-2', name: 'Regalo 2', usage_tip: 'Tip 2', probability: 11.1 }],
      ['usage_tip', 'probability'],
      async (_path, init) => {
        const rows = JSON.parse(init.body);
        calls2.push(rows);
        if ('probability' in rows[0]) {
          const err = new Error('column "probability" of relation "gifts" does not exist');
          err.code = '42703';
          throw err;
        }
        if ('usage_tip' in rows[0]) {
          const err = new Error("Could not find the 'usage_tip' column of 'gifts' in the schema cache");
          err.code = 'PGRST204';
          throw err;
        }
        return null;
      }
    );
    assert.strictEqual(calls2.length, 3);
    assert.deepStrictEqual(Object.keys(calls2[2][0]).sort(), ['id', 'name']);

    // 3. Unrelated database error is NOT swallowed
    assert.strictEqual(
      isMissingColumnError({ code: '42501', message: 'permission denied for table gifts' }, ['probability']),
      false
    );
    await assert.rejects(
      () =>
        supabaseWriteWithOptionalColumns(
          'gifts',
          'PATCH',
          {},
          { name: 'Regalo', probability: 10 },
          ['usage_tip', 'probability'],
          async () => {
            const err = new Error('permission denied for table gifts');
            err.code = '42501';
            throw err;
          }
        ),
      /permission denied/
    );
  });

  test('mapGiftRow maps numeric/string probabilities and falls back cleanly when Supabase column is missing', () => {
    memoryGiftProbabilities.clear();

    assert.strictEqual(
      mapGiftRow({ id: 'g-num', name: 'Num', probability: 11.1, active: true }).probability,
      11.1
    );
    assert.strictEqual(
      mapGiftRow({ id: 'g-str', name: 'Str', probability: '22.256', active: true }).probability,
      22.26
    );
    assert.strictEqual(
      mapGiftRow({ id: 'g-zero', name: 'Zero', probability: '0', active: true }).probability,
      0
    );

    // Missing column without memory cache defaults to 10
    assert.strictEqual(
      mapGiftRow({ id: 'g-legacy', name: 'Legacy', active: true }).probability,
      10
    );

    // Missing column WITH memory fallback returns cached value
    memoryGiftProbabilities.set('g-cached', 37.5);
    assert.strictEqual(
      mapGiftRow({ id: 'g-cached', name: 'Cached', active: true }).probability,
      37.5
    );
    memoryGiftProbabilities.clear();
  });

  test('defaultStore.json and supabase/schema.sql define seeded probability 11.1 and randomizeGifts true', () => {
    const defaultStore = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'shared', 'defaultStore.json'), 'utf8')
    );
    assert.strictEqual(defaultStore.settings.randomizeGifts, true);
    assert.strictEqual(defaultStore.gifts.length, 9);
    for (const gift of defaultStore.gifts) {
      assert.strictEqual(gift.probability, 11.1, `Seeded gift ${gift.id} must default to 11.1`);
    }

    const schemaSql = fs.readFileSync(path.join(PROJECT_ROOT, 'supabase', 'schema.sql'), 'utf8');
    assert.match(schemaSql, /probability\s+numeric\s+not\s+null\s+default\s+11\.1/i);
    assert.match(
      schemaSql,
      /alter\s+table\s+public\.gifts\s+add\s+column\s+if\s+not\s+exists\s+probability\s+numeric\s+not\s+null\s+default\s+11\.1/i
    );
    assert.match(schemaSql, /probability\s*=\s*excluded\.probability/i);
  });
});
