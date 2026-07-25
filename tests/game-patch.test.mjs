import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function sources() {
  const [game, html, i18n, leaderboard] = await Promise.all([
    readFile(new URL('public/game-v4.js', root), 'utf8'),
    readFile(new URL('public/game.html', root), 'utf8'),
    readFile(new URL('public/game-i18n.js', root), 'utf8'),
    readFile(new URL('app/api/leaderboard/route.ts', root), 'utf8'),
  ]);
  return { game, html, i18n, leaderboard };
}

test('boss patterns use airstrikes and dash telegraphs are visual-only', async () => {
  const { game } = await sources();
  assert.doesNotMatch(game, /crossfire/i);
  assert.match(game, /function spawnBossAirstrike/);
  assert.match(game, /airstrike:\s*true/);
  assert.match(game, /telegraphOnly:\s*true/);
  assert.match(game, /!hazard\.telegraphOnly && hazard\.warmup <= 0/);
  assert.match(game, /damage:\s*0, telegraphOnly:\s*true/);
});

test('chain detonation relic scales from 30 percent and is accepted by rankings', async () => {
  const { game, i18n, leaderboard } = await sources();
  assert.match(game, /id:\s*'chain_detonator', rarity:\s*3/);
  assert.match(game, /Math\.min\(120, 30 \+ \(level - 1\) \* 15\)/);
  assert.match(game, /Math\.min\(1\.2, \.3 \+ \(chainLevel - 1\) \* \.15\)/);
  assert.match(i18n, /chain_detonator:\s*\[/);
  assert.match(leaderboard, /"chain_detonator"/);
});

test('hitbox option uses one smaller collision radius and persists locally', async () => {
  const { game, html } = await sources();
  assert.match(game, /const PLAYER_HIT_RADIUS = 11/);
  assert.match(game, /SETTINGS_KEY = 'neon-arcana-settings-v1'/);
  assert.match(game, /function drawPlayerHitbox/);
  const hitboxRenderer = game.slice(game.indexOf('function drawPlayerHitbox'), game.indexOf('\nfunction drawWorld'));
  assert.match(hitboxRenderer, /traceWireSphere/);
  assert.match(hitboxRenderer, /ctx\.ellipse\(x, y, r, r \* \.34/);
  assert.match(hitboxRenderer, /const label = 'HIT'/);
  assert.match(hitboxRenderer, /ctx\.globalAlpha = \.68/);
  assert.doesNotMatch(hitboxRenderer, /#ff5f7f|moveTo\(x - 4, y\)/);
  assert.doesNotMatch(hitboxRenderer, /shadowBlur|globalCompositeOperation = 'lighter'/);
  assert.match(html, /id="menuHitbox"/);
  assert.match(html, /id="menuHitboxState"/);
});

test('title uses the fixed empty plaza with separated live SD layers', async () => {
  const { html } = await sources();
  assert.match(html, /assets\/title-bg-v2\.png/);
  assert.doesNotMatch(html, /@keyframes titleCityDrift/);
  assert.match(html, /class="start-boss"/);
  assert.doesNotMatch(html, /class="start-sword"/);
  assert.match(html, /assets\/astra-sd\.png/);
  assert.match(html, /assets\/shade-sd\.png/);
  assert.match(html, /\.start-hero\{background-position:0 0;animation:heroBobCalm/);
  assert.match(html, /\.start-enemy-a\{background-position:0 0;animation:enemyBobCalm/);
  assert.match(html, /\.start-enemy-b\{background-position:100% 0;animation:enemyBobCalm/);
  await access(new URL('public/assets/title-bg-v2.png', root));
});

test('level choices animate simultaneously and codex owns one icon', async () => {
  const { game, html, i18n } = await sources();
  assert.match(html, /\.cards>\.choice\{[^}]*animation-delay:0s!important/);
  assert.doesNotMatch(html, /\.cards>:nth-child/);
  assert.match(game, /replace\(\/\^▤\\s\*\//);
  assert.doesNotMatch(i18n, /'hud\.codex':\s*'▤/);
});

test('mastery limit break cadence is capped with its range at level 20', async () => {
  const { game } = await sources();
  assert.match(game, /interval:\s*1 - Math\.min\(20, level\) \* \.01/);
  assert.match(game, /masterySpecs\.projectile\.interval \* scale\.interval/);
  assert.match(game, /masterySpecs\.saber\.interval \* scale\.interval/);
  assert.match(game, /masterySpecs\.orbit\.interval \* scale\.interval/);
  assert.doesNotMatch(game, /if \(limitBuild\) \{ S\.masteryClocks\[limitBuild\]/);
});

test('opening density and ambient spawn frequency are reduced from the current build', async () => {
  const { game } = await sources();
  assert.match(game, /const OPENING_MOB_DENSITY_SCALE = \.7/);
  assert.match(game, /const AMBIENT_SPAWN_RATE_SCALE = \.81/);
  assert.match(game, /openingDensityScale = OPENING_MOB_DENSITY_SCALE/);
  assert.match(game, /regularCount === 0 \? 4/);
  assert.match(game, /\/ AMBIENT_SPAWN_RATE_SCALE/);
});

test('telegraph geometry matches actual attack reach and collision width', async () => {
  const { game } = await sources();
  assert.match(game, /const dashRange = mob\.dashSpeed \* mob\.dashDuration/g);
  assert.doesNotMatch(game, /mob\.castAngle\) \* (?:900|1100)/);
  assert.match(game, /const visualRadius = hazard\.r \+ PLAYER_HIT_RADIUS/);
  assert.match(game, /ctx\.lineWidth = visualRadius \* 2/);
});

test('area technique descriptions expose radius, chance, and damage while chain FX are bounded', async () => {
  const { game, i18n } = await sources();
  assert.match(game, /붕괴 잔향[^\n]+주 대상 피해의 35%/);
  assert.match(game, /연쇄 낙뢰[^\n]+주 대상 피해의 28%/);
  assert.match(game, /초신성 방전[^\n]+주 대상 피해의 42%/);
  assert.match(i18n, /Collapse Echo[^\n]+35% of the primary hit/);
  assert.match(i18n, /Chain Lightning[^\n]+28% of the primary hit/);
  assert.match(i18n, /Supernova Discharge[^\n]+42% of the primary hit/);
  assert.match(game, /function nearestMobs/);
  assert.match(game, /emitHitFx = true/);
  assert.match(game, /true, false\);/);
  assert.match(game, /const chainFxCap = crowded \|\| innerWidth < 760 \? 2 : 3/);
});
