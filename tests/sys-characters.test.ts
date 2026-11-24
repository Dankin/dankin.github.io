import assert from 'node:assert/strict';
import test from 'node:test';
import { BIRD } from '../src/core/sys/constants.ts';
import { birdHit, birdPeck, CHARACTER_IDS, CHARACTERS, characterClick } from '../src/core/sys/characters.ts';
import { EGG_IDS } from '../src/core/sys/eggs.ts';
import { mulberry32 } from '../src/core/sys/util.ts';

test('characters: every def has 1–2 s action, positive reward except newton (buff), eggId exists', () => {
  for (const id of CHARACTER_IDS) {
    const d = CHARACTERS[id];
    assert.equal(d.id, id);
    assert.ok(d.actionS >= 1 && d.actionS <= 2, id);
    if (d.eggId) assert.ok((EGG_IDS as readonly string[]).includes(d.eggId), `${id} → ${d.eggId}`);
    const c = characterClick(id, 10, 2);
    if (d.kind === 'buff') assert.deepEqual([c.apples, c.coins, c.buff], [0, 0, true]);
    else { assert.ok(c.apples >= 1 && c.coins === c.apples * 2 && !c.buff, id); }
  }
});

test('characterClick: small reward scales with flow, at least 1 apple', () => {
  assert.equal(characterClick('snow-white', 0, 1).apples, 1);
  assert.equal(characterClick('snow-white', 100, 1).apples, 500);
});

test('bird: hit gives small apples + feathers; peck is small, never fatal', () => {
  const h = birdHit(10, 1.5, mulberry32(1));
  assert.equal(h.apples, 10 * BIRD.hitSec);
  assert.ok(h.feathers >= BIRD.feathers[0] && h.feathers <= BIRD.feathers[1]);
  assert.equal(birdPeck(1000, 5), 15);
  assert.equal(birdPeck(100, 1e6), 4, 'capped by peckMaxShare of stock');
  assert.equal(birdPeck(1e9, 1e9), BIRD.peckMaxApples);
  assert.equal(birdPeck(0, 10), 0);
  assert.ok(birdPeck(50, 10) < 50);
});
