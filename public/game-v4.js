'use strict';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const TAU = Math.PI * 2;
const PLAYER_HIT_RADIUS = 11;
const OPENING_MOB_DENSITY_SCALE = .7;
const AMBIENT_SPAWN_RATE_SCALE = .81;
const SETTINGS_KEY = 'neon-arcana-settings-v1';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const random = (min, max) => min + Math.random() * (max - min);
const I18n = window.NeonI18n;

function tr(key, variables, fallback = '') {
  const value = I18n?.t(key, variables);
  return !value || value === key ? fallback || key : value;
}
function currentLanguage() { return I18n?.getLanguage?.() || 'ko'; }
function classTermSwap(text) {
  if (S?.playerClass === 'silverbullet' && typeof text === 'string') return text.replace(/성좌탄/g, '은탄').replace(/성좌포/g, '은탄포');
  return text;
}
function upgradeName(upgrade) { return classTermSwap(tr(`upgrade.${upgrade.id}.name`, null, upgrade.name)); }
function relicName(relic) { return tr(`relic.${relic.id}.name`, null, relic.name); }
function localizedBaseDescription(group, item, fallback) { return tr(`${group}.${item.id}.desc`, null, fallback); }

const ui = {
  hud: $('#hud'), xp: $('#xpbar'), lv: $('#lv'), hp: $('#hp'), kills: $('#kills'),
  clock: $('#clock'), build: $('#build'), radar: $('#radarLabel'), menuButton: $('#menuButton'),
  start: $('#start'), choices: $('#choices'), cards: $('#cards'), over: $('#over'),
  bossHud: $('#bossHud'), bossName: $('#bossName'), bossTimer: $('#bossTimer'), bossBar: $('#bossBar'),
  warning: $('#warning'), startRanks: $('#startRanks'), finalRanks: $('#finalRanks'),
  finalScore: $('#finalScore'), playerName: $('#playerName'), relicTray: $('#relicTray'),
  relicDetails: $('#relicDetails'), relicSlots: $('#relicSlots'), relicScreen: $('#relicScreen'), relicTitle: $('#relicTitle'),
  relicTrayToggle: $('#relicTrayToggle'), classBadge: $('#classBadge'),
  relicSub: $('#relicSub'), relicNew: $('#relicNew'), relicCards: $('#relicCards'),
  codexButton: $('#codexButton'), codexScreen: $('#codexScreen'), codexClose: $('#codexClose'), codexGrid: $('#codexGrid'),
  rankDetailScreen: $('#rankDetailScreen'), rankDetailTitle: $('#rankDetailTitle'), rankDetailClose: $('#rankDetailClose'),
  rankDetailSummary: $('#rankDetailSummary'), rankDetailBuilds: $('#rankDetailBuilds'), rankDetailRelics: $('#rankDetailRelics'), rankDetailEmpty: $('#rankDetailEmpty'),
  gameMenu: $('#gameMenu'), menuResume: $('#menuResume'), menuSound: $('#menuSound'), menuSoundState: $('#menuSoundState'),
  menuHitbox: $('#menuHitbox'), menuHitboxState: $('#menuHitboxState'),
  menuLanguage: $('#menuLanguage'), menuQuit: $('#menuQuit'), startLanguage: $('#startLanguage'),
};

const images = {
  player: new Image(), enemy: new Image(), vfx: new Image(), bosses: new Image(),
  city: new Image(), treasure: new Image(), enemyMissile: new Image(), saberBlade: new Image(),
  archetypeIcons: new Image(), bomberDrone: new Image(), ultimateFx: new Image(), mechaOrbital: new Image(),
  leviathan: new Image(), darkBlade: new Image(), thorHammer: new Image(), darkAura: new Image(),
};
images.player.src = 'assets/astra-sd.png';
images.enemy.src = 'assets/shade-sd.png';
images.vfx.src = 'assets/vfx.png';
images.bosses.src = 'assets/bosses.png';
images.city.src = 'assets/cyber-city.png';
images.treasure.src = 'assets/jackpot-gremlin.png';
images.enemyMissile.src = 'assets/enemy-missile.png';
images.saberBlade.src = 'assets/saber-blade.png';
images.archetypeIcons.src = 'assets/archetype-icons.png';
images.bomberDrone.src = 'assets/bomber-drone.png';
images.ultimateFx.src = 'assets/ultimate-fx.png';
images.mechaOrbital.src = 'assets/mecha-orbital.png';
images.leviathan.src = 'assets/leviathan.png';
images.darkBlade.src = 'assets/dark-blade.png';
images.thorHammer.src = 'assets/thor-hammer.png';
images.darkAura.src = 'assets/dark-aura.png';

let S = null;
let running = false;
let last = performance.now();
let lastHud = 0;
let chosen = [];
const keys = new Set();
let joy = { on: false, id: -1, sx: 0, sy: 0, x: 0, y: 0 };
let mouseAim = { inside: false, valid: false, moved: false, x: 1, y: 0 };
const panelTimers = new WeakMap();

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { showHitbox: stored.showHitbox === true };
  } catch { return { showHitbox: false }; }
}

const settings = loadSettings();
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* file:// and privacy modes may block storage. */ }
}

function showPanel(node) {
  if (!node) return;
  if (typeof clearTimeout === 'function') clearTimeout(panelTimers.get(node)); node.classList.remove('hidden', 'tween-out');
}

function hidePanel(node, immediate = false) {
  if (!node) return;
  if (typeof clearTimeout === 'function') clearTimeout(panelTimers.get(node));
  if (immediate || node.classList.contains('hidden')) { node.classList.remove('tween-out'); node.classList.add('hidden'); return; }
  node.classList.add('tween-out');
  const timer = setTimeout(() => { node.classList.add('hidden'); node.classList.remove('tween-out'); panelTimers.delete(node); }, 175);
  panelTimers.set(node, timer);
}

const AudioEngine = (() => {
  let ac, master, musicBus, seBus, compressor, timer;
  let nextTime = 0, step = 0, muted = false, intensity = 0;
  const lastSE = {};
  const bpm = 122, beat = 60 / bpm / 4;
  const arp = [62, 65, 69, 72, 69, 65, 67, 69, 60, 65, 69, 72, 67, 64, 69, 73];
  const bass = [38, 38, 34, 34, 41, 41, 36, 45];
  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  async function init() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC({ latencyHint: 'interactive' });
      master = ac.createGain(); musicBus = ac.createGain(); seBus = ac.createGain();
      compressor = ac.createDynamicsCompressor();
      master.gain.value = .86; musicBus.gain.value = .32; seBus.gain.value = .38;
      musicBus.connect(compressor); seBus.connect(compressor); compressor.connect(master); master.connect(ac.destination);
      const unlock = ac.createBufferSource(); unlock.buffer = ac.createBuffer(1, 1, ac.sampleRate); unlock.connect(master); unlock.start();
    }
    if (ac.state !== 'running') await ac.resume();
    if (ac.state !== 'running') return false;
    if (!timer) { nextTime = ac.currentTime + .05; timer = setInterval(schedule, 25); }
    return true;
  }

  async function resume() {
    if (!ac) return false;
    if (ac.state !== 'running') await ac.resume();
    if (ac.state === 'running') nextTime = Math.max(nextTime, ac.currentTime + .04);
    return ac.state === 'running';
  }

  function tone(frequency, duration, type = 'triangle', volume = .08, when = ac?.currentTime, slide = 1, bus = seBus) {
    if (!ac || muted || !bus) return;
    const oscillator = ac.createOscillator(), gain = ac.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, when);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * slide), when + duration);
    gain.gain.setValueAtTime(.0001, when); gain.gain.exponentialRampToValueAtTime(volume, when + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
    oscillator.connect(gain); gain.connect(bus); oscillator.start(when); oscillator.stop(when + duration + .02);
  }

  function noise(duration = .06, volume = .05, when = ac?.currentTime, bus = seBus) {
    if (!ac || muted || !bus) return;
    const length = Math.max(1, ac.sampleRate * duration), buffer = ac.createBuffer(1, length, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ac.createBufferSource(), gain = ac.createGain(), filter = ac.createBiquadFilter();
    source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 1450;
    gain.gain.setValueAtTime(volume, when); gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
    source.connect(filter); filter.connect(gain); gain.connect(bus); source.start(when); source.stop(when + duration + .02);
  }

  function schedule() {
    if (!ac || ac.state !== 'running') return;
    if (nextTime < ac.currentTime - .2) nextTime = ac.currentTime + .05;
    while (nextTime < ac.currentTime + .13) {
      const songStep = step % 128, local = songStep % 16, bar = Math.floor(songStep / 16) % 8;
      if (songStep % 4 === 0) {
        tone(freq(bass[bar]), beat * 3.6, 'sine', .14, nextTime, .98, musicBus);
        tone(freq(bass[bar] + 12), beat * 1.8, 'triangle', .045, nextTime, .995, musicBus);
        tone(120, beat * .7, 'sine', .18, nextTime, .38, musicBus);
      }
      if (songStep % 2 === 0) tone(freq(arp[Math.floor(songStep / 2) % arp.length]), beat * 1.65, 'triangle', .07, nextTime, .998, musicBus);
      if (local === 4 || local === 12) noise(beat * .72, .04, nextTime, musicBus);
      if (songStep % 2 === 1 && intensity > 0) noise(beat * .25, .018, nextTime, musicBus);
      if (intensity > 1 && songStep % 8 === 6) tone(freq(74 + (bar % 2) * 3), beat * 2.2, 'sawtooth', .025, nextTime, .99, musicBus);
      nextTime += beat; step++;
    }
  }

  function allow(name, ms) {
    const now = performance.now();
    if (now - (lastSE[name] || 0) < ms) return false;
    lastSE[name] = now; return true;
  }

  function se(name) {
    if (!ac || muted) return;
    const t = ac.currentTime;
    if (name === 'fire' && allow(name, 65)) tone(880, .07, 'triangle', .06, t, .42);
    if (name === 'saber' && allow(name, 90)) { tone(170, .16, 'sawtooth', .1, t, 3.8); tone(1040, .1, 'triangle', .055, t, .62); }
    if (name === 'hit' && allow(name, 28)) { noise(.045, .045, t); tone(180, .05, 'square', .045, t, .7); }
    if (name === 'kill' && allow(name, 42)) { tone(560, .13, 'triangle', .09, t, .35); noise(.09, .06, t); }
    if (name === 'xp' && allow(name, 42)) tone(1050, .055, 'triangle', .055, t, 1.42);
    if (name === 'hurt' && allow(name, 170)) { tone(155, .17, 'sawtooth', .12, t, .42); noise(.12, .08, t); }
    if (name === 'select') { tone(620, .08, 'triangle', .08, t, 1.5); tone(930, .11, 'triangle', .06, t + .07, 1.18); }
    if (name === 'level') [74, 77, 81, 86].forEach((m, i) => tone(freq(m), .16, 'triangle', .075, t + i * .08, 1.01));
    if (name === 'boss') { tone(82, .7, 'sawtooth', .12, t, .5); noise(.45, .09, t); }
    if (name === 'treasure') { [69, 76, 81, 88].forEach((m, i) => tone(freq(m), .2, 'square', .07, t + i * .07, 1.02)); }
    if (name === 'reel' && allow(name, 52)) tone(freq(62 + Math.floor(Math.random() * 18)), .055, 'square', .045, t, 1.12);
    if (name === 'relic') { [72, 79, 84, 91].forEach((m, i) => tone(freq(m), .28, 'triangle', .08, t + i * .1, 1.01)); }
    if (name === 'wave') { tone(105, .45, 'sawtooth', .08, t, .55); noise(.3, .06, t); }
    if (name === 'over') [62, 60, 57, 50].forEach((m, i) => tone(freq(m), .32, 'sine', .08, t + i * .19, .92));
  }

  function scene(name) {
    if (!ac) return;
    const volume = name === 'battle' ? .32 : name === 'choice' ? .10 : .03;
    musicBus.gain.cancelScheduledValues(ac.currentTime);
    musicBus.gain.setValueAtTime(musicBus.gain.value, ac.currentTime);
    musicBus.gain.linearRampToValueAtTime(volume, ac.currentTime + .35);
  }

  function toggle() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : .86, ac.currentTime, .03);
    return !muted;
  }

  return { init, resume, se, scene, toggle, isMuted: () => muted, setIntensity: (value) => { intensity = value; } };
})();

const upgrades = [
  { id: 'power', icon: '◆', name: '룬 증폭', desc: '모든 공격 피해량 +12%', max: 10, tags: ['projectile', 'saber', 'orbit'], apply: s => { s.damage *= 1.12; } },
  { id: 'haste', icon: '⌁', name: '영창 가속', desc: '성좌탄 공격 간격 13% 감소', max: 7, tags: ['projectile'], apply: s => { s.rate = Math.max(.1, s.rate * .87); } },
  { id: 'multishot', icon: '≋', name: '쌍성 궤도', desc: '동시에 발사하는 성좌탄 +1', max: 7, tags: ['projectile'], apply: s => { s.multishot++; } },
  { id: 'pierce', icon: '↠', name: '위상 관통', desc: '성좌탄 관통 횟수 +1', max: 6, tags: ['projectile'], apply: s => { s.pierce++; } },
  { id: 'critical', icon: '✦', name: '운명 간섭', desc: '치명타 확률 +8%, 배율 +0.18', max: 6, tags: ['projectile', 'saber'], apply: s => { s.crit += .08; s.critMult += .18; } },
  { id: 'blast', icon: '✺', name: '붕괴 잔향', desc: '성좌탄 명중 시 폭발 반경 +22/LV (최대 132) · 주변 적에게 주 대상 피해의 35%', max: 6, tags: ['projectile', 'area'], apply: s => { s.blast += 22; } },
  { id: 'chain', icon: 'ϟ', name: '연쇄 낙뢰', desc: '성좌탄 명중 시 210 이내 낙뢰 대상 +1/LV (최대 5) · 각 대상에게 주 대상 피해의 28%', max: 5, tags: ['projectile', 'area'], apply: s => { s.chain++; } },
  { id: 'size', icon: '◉', name: '거대 성핵', desc: '성좌탄 크기 +18%, 피해 +10%', max: 6, tags: ['projectile'], apply: s => { s.shotScale *= 1.18; s.projectileMult *= 1.1; } },
  { id: 'orbit', icon: '☄', name: '수호 위성', desc: '공격 위성 +1, 위성 빌드 개방', max: 7, tags: ['orbit'], apply: s => { s.orbitals++; } },
  { id: 'orbit_speed', icon: '⟳', name: '초고속 공전', desc: '위성 회전 속도 +24%', max: 5, tags: ['orbit'], requires: s => s.orbitals > 0, apply: s => { s.orbitSpeed *= 1.24; } },
  { id: 'orbit_size', icon: '⊚', name: '거대 위성핵', desc: '위성 크기 +20%, 피해 +16%', max: 5, tags: ['orbit'], requires: s => s.orbitals > 0, apply: s => { s.orbitSize *= 1.2; s.orbitDamage *= 1.16; } },
  { id: 'orbit_range', icon: '◎', name: '이중 공전면', desc: '공전 반경 +16, 위성 피해 +10%', max: 4, tags: ['orbit'], requires: s => s.orbitals > 0, apply: s => { s.orbitRadius += 16; s.orbitDamage *= 1.1; } },
  { id: 'orbit_shock', icon: '✹', name: '초신성 방전', desc: '위성체 명중 시 방전 확률 +12%p/LV (최대 48%) · 반경 90 · 주변 적에게 주 대상 피해의 42%', max: 4, tags: ['orbit', 'area'], requires: s => s.orbitals > 0, apply: s => { s.orbitShock += .12; } },
  { id: 'orbit_guard', icon: '⬡', name: '성환 요격막', desc: '위성에 닿은 적 투사체를 6% 확률로 소거', max: 5, tags: ['orbit', 'survival'], requires: s => s.orbitals > 0, apply: s => { s.orbitGuard += .06; } },
  { id: 'orbit_pulse', icon: '◌', name: '맥동 성환', desc: '주기적으로 모든 위성이 충격파 방출', max: 3, tags: ['orbit', 'area'], requires: s => s.orbitals > 0, apply: s => { s.orbitPulse++; } },
  { id: 'saber', icon: '╱', name: '아스트랄 광검', desc: '광검 피해 +25%', max: 7, tags: ['saber'], apply: s => { s.saberLevel++; s.saberDamage *= 1.25; } },
  { id: 'saber_reach', icon: '⌒', name: '월광 검로', desc: '광검 사거리 +20, 베기 각도 확대', max: 5, tags: ['saber'], requires: s => s.saberLevel > 0, apply: s => { s.saberRange += 20; s.saberArc += .14; } },
  { id: 'saber_haste', icon: '≪', name: '찰나 발도', desc: '광검 공격 간격 17% 감소', max: 5, tags: ['saber'], requires: s => s.saberLevel > 0, apply: s => { s.saberRate = Math.max(.22, s.saberRate * .83); } },
  { id: 'saber_echo', icon: '〽', name: '잔상 연격', desc: '광검 추가 잔상 베기 +1', max: 3, tags: ['saber'], requires: s => s.saberLevel > 0, apply: s => { s.saberEcho++; } },
  { id: 'saber_guard', icon: '◇', name: '검막 반사', desc: '광검 사용 중 방어 확률 +7%', max: 4, tags: ['saber', 'survival'], requires: s => s.saberLevel > 0, apply: s => { s.saberGuard += .07; } },
  { id: 'speed', icon: '≫', name: '공간 도약', desc: '이동 속도 +11%', max: 6, tags: ['mobility'], apply: s => { s.speed *= 1.11; } },
  { id: 'magnet', icon: '⌾', name: '중력 우물', desc: '경험치 흡수 범위 +85', max: 6, tags: ['growth'], apply: s => { s.magnet += 85; } },
  { id: 'vital', icon: '♥', name: '생명 결계', desc: '최대 체력 +8, 체력 10 회복', max: 7, tags: ['survival'], apply: s => { s.maxHp += 8; s.hp = Math.min(s.maxHp, s.hp + 10); } },
  { id: 'regen', icon: '♧', name: '재생 술식', desc: '초당 체력 회복 +0.35', max: 6, tags: ['survival'], apply: s => { s.regen += .35; } },
  { id: 'guard', icon: '⬡', name: '성좌 방벽', desc: '피격 무효 확률 +6%', max: 6, tags: ['survival'], apply: s => { s.guard += .06; } },
  { id: 'fortune', icon: '♢', name: '마력 정제', desc: '획득 경험치 +22%', max: 5, tags: ['growth'], apply: s => { s.xpGain *= 1.22; } },
  { id: 'relic_slot', icon: '▣', name: '차원 수납 확장', desc: '유물 슬롯 +1 (최대 7)', max: 4, tags: ['utility'], weight: 2.4, requires: s => s.relicSlots < 7 && s.relics.length >= s.relicSlots && s.level >= 8 + (s.ranks.relic_slot || 0) * 7, apply: s => { s.relicSlots++; } },
  { id: 'limit_master_projectile', icon: '∞', name: '성좌포 한계돌파', desc: '마스터 레이저 피해와 범위 강화', max: Infinity, tags: ['projectile'], weight: .9, requires: s => isMastered('projectile', s), apply: () => {} },
  { id: 'limit_master_saber', icon: '∞', name: '광검 한계돌파', desc: '마스터 휠윈드 피해와 범위 강화', max: Infinity, tags: ['saber'], weight: .9, requires: s => isMastered('saber', s), apply: () => {} },
  { id: 'limit_master_orbit', icon: '∞', name: '위성 한계돌파', desc: '마스터 추격 폭발 피해와 범위 강화', max: Infinity, tags: ['orbit'], weight: .9, requires: s => isMastered('orbit', s), apply: () => {} },
  { id: 'limit_master_thor', icon: '∞', name: '토르의 망치 한계돌파', desc: '토르의 망치 피해와 범위 강화', max: Infinity, tags: ['projectile', 'area'], weight: .9, requires: s => isMastered('thor', s), apply: () => {} },
  { id: 'limit_power', icon: '∞', name: '한계 돌파 · 힘', desc: '모든 공격 피해량 점진 증가', max: 999, tags: ['projectile', 'saber', 'orbit'], weight: .12, requires: s => s.level >= 35, apply: () => {} },
  { id: 'limit_vital', icon: '∞', name: '한계 돌파 · 생명', desc: '최대 체력 +5, 체력 5 회복', max: 999, tags: ['survival'], weight: .12, requires: s => s.level >= 35, apply: s => { s.maxHp += 5; s.hp = Math.min(s.maxHp, s.hp + 5); } },
  { id: 'limit_growth', icon: '∞', name: '한계 돌파 · 공명', desc: '경험치 +7%, 흡수 범위 +20', max: 999, tags: ['growth'], weight: .1, requires: s => s.level >= 35, apply: s => { s.xpGain = Math.min(4, s.xpGain * 1.07); s.magnet += 20; } },
];

const rarities = [
  { name: '일반', color: '#b8c4d8', salvage: .2 },
  { name: '레어', color: '#4dffa4', salvage: .36 },
  { name: '유니크', color: '#51bfff', salvage: .58 },
  { name: '전설', color: '#c46cff', salvage: .86 },
  { name: '신화', color: '#ffbe38', salvage: 1.25 },
];

const relics = [
  { id: 'arc_cell', rarity: 0, icon: '◆', name: '증폭 아크 셀', desc: '모든 공격 피해 +10%', tags: ['projectile', 'saber', 'orbit'], equip: s => { s.damageMult *= 1.1; }, unequip: s => { s.damageMult /= 1.1; } },
  { id: 'blood_cap', rarity: 0, icon: '♥', name: '혈류 축전지', desc: '최대 체력 +12, 최초 획득 시 12 회복', tags: ['survival'], equip: (s, first) => { s.maxHp += 12; if (first) s.hp = Math.min(s.maxHp, s.hp + 12); }, unequip: s => { s.maxHp -= 12; s.hp = Math.min(s.hp, s.maxHp); } },
  { id: 'magnet_prism', rarity: 0, icon: '⌾', name: '자력 프리즘', desc: '흡수 범위 +30%, 경험치 +10%', tags: ['growth'], equip: s => { s.magnetMult *= 1.3; s.xpGain *= 1.1; }, unequip: s => { s.magnetMult /= 1.3; s.xpGain /= 1.1; } },
  { id: 'hunter_lens', rarity: 0, icon: '✦', name: '사냥꾼의 렌즈', desc: '치명타 +8%, 치명 피해 +0.2', tags: ['projectile', 'saber'], equip: s => { s.crit += .08; s.critMult += .2; }, unequip: s => { s.crit -= .08; s.critMult -= .2; } },
  { id: 'split_core', rarity: 1, icon: '≋', name: '분열 코어', desc: '4번째 성좌탄 일제사격마다 투사체 +2', tags: ['projectile'], equip: () => {}, unequip: () => {} },
  { id: 'orbit_gear', rarity: 1, icon: '⟳', name: '성환 가속기', desc: '위성 +1, 속도 +30%, 피해 +30%', tags: ['orbit'], equip: s => { s.orbitals++; s.orbitSpeed *= 1.3; s.orbitDamage *= 1.3; }, unequip: s => { s.orbitals--; s.orbitSpeed /= 1.3; s.orbitDamage /= 1.3; } },
  { id: 'edge_lens', rarity: 1, icon: '╱', name: '근접 초점 렌즈', desc: '광검 피해 +45%, 사거리 +18', tags: ['saber'], equip: s => { s.saberDamage *= 1.45; s.saberRange += 18; }, unequip: s => { s.saberDamage /= 1.45; s.saberRange -= 18; } },
  { id: 'nano_shunt', rarity: 1, icon: '♧', name: '나노 회복 분기기', desc: '재생 +0.45, 일반 적 20킬마다 체력 3 회복', tags: ['survival'], equip: s => { s.regen += .45; }, unequip: s => { s.regen -= .45; }, onKill: s => relicKillTick(s, 'nano_shunt', 20, 3) },
  { id: 'execution', rarity: 2, icon: '†', name: '처형 프로토콜', desc: '일반 적 체력이 15% 미만이면 즉시 처형', tags: ['projectile', 'saber'], equip: () => {}, unequip: () => {} },
  { id: 'echo_chamber', rarity: 2, icon: '〽', name: '공명 탄실', desc: '6번째 일제사격이 70% 피해로 반복', tags: ['projectile'], equip: () => {}, unequip: () => {} },
  { id: 'gravity_halo', rarity: 2, icon: '◉', name: '중력 후광', desc: '주변 일반 적 이동 속도 24% 감소', tags: ['area', 'survival'], equip: () => {}, unequip: () => {} },
  { id: 'soul_battery', rarity: 2, icon: '♠', name: '영혼 배터리', desc: '일반 적 12킬마다 체력 2 회복, 모든 피해 +8%', tags: ['survival', 'projectile', 'saber', 'orbit'], equip: s => { s.damageMult *= 1.08; }, unequip: s => { s.damageMult /= 1.08; }, onKill: s => relicKillTick(s, 'soul_battery', 12, 2) },
  { id: 'event_horizon', rarity: 3, icon: '◎', name: '사건의 지평선', desc: '위성 +2, 크기 +45%, 피해 +40%, 충격파', tags: ['orbit', 'area'], equip: s => { s.orbitals += 2; s.orbitSize *= 1.45; s.orbitDamage *= 1.4; s.orbitPulse++; }, unequip: s => { s.orbitals -= 2; s.orbitSize /= 1.45; s.orbitDamage /= 1.4; s.orbitPulse--; } },
  { id: 'zero_edge', rarity: 3, icon: '⌁', name: '제로 엣지', desc: '광검 피해 +50%, 속도 +33%, 잔상 베기 +1', tags: ['saber'], equip: s => { s.saberDamage *= 1.5; s.saberRate *= .75; s.saberEcho++; }, unequip: s => { s.saberDamage /= 1.5; s.saberRate /= .75; s.saberEcho--; } },
  { id: 'phoenix', rarity: 3, icon: '♨', name: '불사조 커널', desc: '1회 치명상을 무시하고 체력 40% 부활', tags: ['survival'], equip: s => { s.maxHp += 10; }, unequip: s => { s.maxHp -= 10; s.hp = Math.min(s.hp, s.maxHp); } },
  { id: 'rift_crown', rarity: 3, icon: '♛', name: '균열 왕관', desc: '모든 피해 +22%, 경험치 +25%', tags: ['projectile', 'saber', 'orbit', 'growth'], equip: s => { s.damageMult *= 1.22; s.xpGain *= 1.25; }, unequip: s => { s.damageMult /= 1.22; s.xpGain /= 1.25; } },
  { id: 'chain_detonator', rarity: 3, icon: '☢', name: '연쇄 기폭 코어', desc: '자폭 적의 폭발이 주변 적에게 30% 피해', tags: ['area'], equip: () => {}, unequip: () => {} },
  { id: 'tamer_core', rarity: 3, icon: '⛓', name: '조련의 코어', desc: '보스 처치 시 12%p 확률로 아군화 (레벨당 +12%p, 최대 65%)', tags: ['survival', 'area'], equip: s => { s.allyTameChance = (s.allyTameChance || 0) + .12; }, unequip: s => { s.allyTameChance -= .12; } },
  { id: 'singularity', rarity: 4, icon: '✺', name: '아르카나 특이점', desc: '모든 피해 +35%, 각 빌드 추가 피해 +15%', tags: ['projectile', 'saber', 'orbit'], equip: s => { s.damageMult *= 1.35; s.projectileMult *= 1.15; s.saberMult *= 1.15; s.orbitMult *= 1.15; }, unequip: s => { s.damageMult /= 1.35; s.projectileMult /= 1.15; s.saberMult /= 1.15; s.orbitMult /= 1.15; } },
  { id: 'immortal', rarity: 4, icon: '∞', name: '불멸 회로', desc: '최대 체력 +30, 재생 +1, 일반 적 8킬마다 2 회복', tags: ['survival'], equip: (s, first) => { s.maxHp += 30; if (first) s.hp += 30; s.regen += 1; }, unequip: s => { s.maxHp -= 30; s.hp = Math.min(s.hp, s.maxHp); s.regen -= 1; }, onKill: s => relicKillTick(s, 'immortal', 8, 2) },
  { id: 'godspeed', rarity: 4, icon: '»', name: '신속 연산기관', desc: '이동 +25%, 성좌탄·광검·위성 속도 대폭 증가', tags: ['mobility', 'projectile', 'saber', 'orbit'], equip: s => { s.speed *= 1.25; s.rate *= .8; s.saberRate *= .8; s.orbitSpeed *= 1.5; }, unequip: s => { s.speed /= 1.25; s.rate /= .8; s.saberRate /= .8; s.orbitSpeed /= 1.5; } },
];

const relicById = new Map(relics.map(relic => [relic.id, relic]));
const upgradeById = new Map(upgrades.map(upgrade => [upgrade.id, upgrade]));
const masterySpecs = {
  projectile: { id: 'multishot', limitId: 'limit_master_projectile', label: '성좌포', interval: 9.5, note: '주기적으로 화면을 가르는 관통 성좌 레이저를 발사합니다.' },
  saber: { id: 'saber', limitId: 'limit_master_saber', label: '아스트랄 광검', interval: 7.5, note: '주기적으로 전방위를 베는 황금 휠윈드를 발동합니다.' },
  orbit: { id: 'orbit', limitId: 'limit_master_orbit', label: '수호 위성', interval: 10.5, note: '위성들이 적을 추격해 폭발한 뒤 다시 복귀합니다.' },
  thor: { id: 'chain', limitId: 'limit_master_thor', label: '토르의 망치', interval: 8.5, note: '주기적으로 체력이 가장 높은 주변 적에게 거대한 번개 망치를 내리쳐 기절·감전시킵니다. 모든 쉴드를 무시하고 피해를 입힙니다.' },
};
const rarityKeys = ['common', 'rare', 'unique', 'legendary', 'mythic'];
function rarityName(index) { return tr(`rarity.${rarityKeys[index]}`, null, rarities[index]?.name || ''); }
const classMasteryOverrides = {
  silverbullet: { projectile: { label: '은탄포', note: '주기적으로 주변 밀집 지역에 은탄을 원형으로 화려하게 난사합니다.' } },
  mechanic: { orbit: { label: '위성 과부하', note: '주기적으로 위성이 과부하 상태가 되어 이동속도가 오르고 레이저 범위가 넓어집니다.' } },
  shadowmaster: { saber: { label: '쌍검 검기', note: '주기적으로 쌍검에서 관통하는 거대한 어둠의 검기를 발사합니다.' } },
};
function masteryLabel(build) {
  const override = classMasteryOverrides[S?.playerClass]?.[build];
  if (override) return override.label;
  return classTermSwap(tr(`mastery.${build}.name`, null, masterySpecs[build]?.label || build));
}
function masteryNote(build) {
  const override = classMasteryOverrides[S?.playerClass]?.[build];
  if (override) return override.note;
  return classTermSwap(tr(`mastery.${build}.desc`, null, masterySpecs[build]?.note || ''));
}
const hasRelic = (id) => Boolean(S?.relics.some(relic => relic.id === id));
const relicLevel = (id) => S?.relics.find(relic => relic.id === id)?.level || 0;

function upgradeDescription(upgrade, rank = 0) { return classTermSwap(upgradeDescriptionRaw(upgrade, rank)); }
function upgradeDescriptionRaw(upgrade, rank = 0) {
  if (currentLanguage() !== 'ko') return localizedBaseDescription('upgrade', upgrade, upgrade.desc);
  if (upgrade.id === 'orbit') return rank === 0 ? '공격 위성 +1 · 위성 빌드 개방' : '공격 위성 +1';
  if (upgrade.id === 'saber') return rank === 0 ? '초근접 광검 개방 · 아크 실드에 2.4배 피해' : '광검 피해 +25%';
  if (upgrade.id === 'multishot') return rank === 0 ? '성좌탄 +1 · 투사체 집중 빌드 개방' : '동시에 발사하는 성좌탄 +1';
  if (upgrade.id === 'orbit_pulse') {
    if (rank <= 0) return '모든 위성이 충격파 방출 · 발동 간격 4.5초';
    if (rank < upgrade.max) {
      const current = Math.max(1.8, 5.3 - rank * .8);
      const next = Math.max(1.8, 5.3 - (rank + 1) * .8);
      return `충격파 발동 간격 0.8초 감소 · ${current.toFixed(1)}초 → ${next.toFixed(1)}초`;
    }
    return '충격파 발동 간격 2.9초 · 레벨마다 0.8초 감소';
  }
  if (upgrade.id === 'chain' && S?.playerClass === 'thor') {
    return `모든 공격(투사체·위성·광검) 명중 시 240 이내 낙뢰 대상 +1/LV (최대 5) · 각 대상에게 주 대상 피해의 ${Math.round(S.chainDamage * 100)}% (쉴드 대상 +50%)`;
  }
  const limitBuild = limitBreakBuildForUpgrade(upgrade.id);
  if (limitBuild) return `마스터 특수기 피해 +4%p (무한) · 범위 +2%p / 공격 주기 -1%p (각 LV.20까지) · 현재 피해 +${rank * 4}% / 범위 +${Math.min(20, rank) * 2}% / 주기 -${Math.min(20, rank)}%`;
  if (upgrade.id === 'limit_power') {
    const current = Math.min(20, rank) * 2 + Math.max(0, rank - 20) * .5;
    return `모든 공격 피해 +${rank < 20 ? 2 : .5}%p · 현재 +${current.toFixed(current % 1 ? 1 : 0)}%`;
  }
  return upgrade.desc;
}

function masteryBuildForUpgrade(id) {
  return Object.keys(masterySpecs).find(build => masterySpecs[build].id === id && (build !== 'thor' || S?.playerClass === 'thor'));
}

function limitBreakBuildForUpgrade(id) {
  return Object.keys(masterySpecs).find(build => masterySpecs[build].limitId === id);
}

function limitBreakLevel(build, state = S) { return state?.ranks[masterySpecs[build]?.limitId] || 0; }
function masteryScale(build, state = S) {
  const level = limitBreakLevel(build, state);
  return { level, damage: 1 + level * .04, range: 1 + Math.min(20, level) * .02, interval: 1 - Math.min(20, level) * .01 };
}

function endlessPowerScale(state = S) {
  const level = state?.ranks.limit_power || 0;
  return 1 + Math.min(20, level) * .02 + Math.max(0, level - 20) * .005;
}

function upgradeMaxFor(upgrade, state = S) {
  return upgrade.id === 'chain' && state?.playerClass === 'thor' ? 7 : upgrade.max;
}

function isMastered(build, state = S) {
  if (build === 'thor' && state?.playerClass !== 'thor') return false;
  const spec = masterySpecs[build], upgrade = spec && upgradeById.get(spec.id);
  return Boolean(upgrade && (state?.ranks[spec.id] || 0) >= upgradeMaxFor(upgrade, state));
}

const percentGain = (factor, level) => Math.round((Math.pow(factor, level) - 1) * 100);
const killInterval = (base, level) => Math.max(6, Math.ceil(base / (1 + (level - 1) * .28)));

function relicEffectText(relic, requestedLevel = relic?.level || 1) {
  if (currentLanguage() !== 'ko') return localizedBaseDescription('relic', relic, relic?.desc || '');
  const level = Math.max(1, requestedLevel || 1), healBonus = Math.floor((level - 1) / 2);
  const effects = {
    arc_cell: () => `모든 공격 피해 +${percentGain(1.1, level)}%`,
    blood_cap: () => `최대 체력 +${12 * level} · 최초 획득 시 12 회복`,
    magnet_prism: () => `흡수 범위 +${percentGain(1.3, level)}% · 경험치 +${percentGain(1.1, level)}%`,
    hunter_lens: () => `치명타 +${8 * level}%p · 치명 피해 +${(0.2 * level).toFixed(1)}`,
    split_core: () => `${Math.max(2, 5 - level)}번째 일제사격마다 투사체 +${2 + Math.floor((level - 1) / 2)}`,
    orbit_gear: () => `위성 +${level} · 속도/피해 +${percentGain(1.3, level)}%`,
    edge_lens: () => `광검 피해 +${percentGain(1.45, level)}% · 사거리 +${18 * level}`,
    nano_shunt: () => `재생 +${(0.45 * level).toFixed(2)} · ${killInterval(20, level)}킬마다 ${3 + healBonus} 회복`,
    execution: () => `일반 적 체력 ${Math.min(35, 12 + level * 4)}% 미만 즉시 처형`,
    echo_chamber: () => `${Math.max(3, 7 - level)}번째 일제사격을 ${Math.min(100, 65 + level * 10)}% 피해로 반복`,
    gravity_halo: () => `반경 ${260 + level * 12} 내 일반 적 ${Math.min(52, 18 + level * 6)}% 감속`,
    soul_battery: () => `모든 피해 +${percentGain(1.08, level)}% · ${killInterval(12, level)}킬마다 ${2 + healBonus} 회복`,
    event_horizon: () => `위성 +${2 * level} · 크기 +${percentGain(1.45, level)}% · 피해 +${percentGain(1.4, level)}% · 충격파 LV.${level}`,
    zero_edge: () => `광검 피해 +${percentGain(1.5, level)}% · 간격 ${Math.round((1 - Math.pow(.75, level)) * 100)}% 감소 · 잔상 +${level}`,
    phoenix: () => `최대 체력 +${10 * level} · ${level}회 부활 · 체력 ${Math.min(70, 35 + level * 5)}% 복구`,
    rift_crown: () => `모든 피해 +${percentGain(1.22, level)}% · 경험치 +${percentGain(1.25, level)}%`,
    singularity: () => `모든 피해 +${percentGain(1.35, level)}% · 각 빌드 피해 +${percentGain(1.15, level)}%`,
    immortal: () => `최대 체력 +${30 * level} · 재생 +${level} · ${killInterval(8, level)}킬마다 ${2 + healBonus} 회복`,
    godspeed: () => `이동 +${percentGain(1.25, level)}% · 공격 간격 ${Math.round((1 - Math.pow(.8, level)) * 100)}% 감소 · 위성 속도 +${percentGain(1.5, level)}%`,
    chain_detonator: () => `자폭 적 폭발 시 주변 적에게 폭발 피해의 ${Math.min(120, 30 + (level - 1) * 15)}%`,
    tamer_core: () => `보스 처치 시 ${Math.min(65, 12 * level)}% 확률로 아군화`,
  };
  return effects[relic?.id]?.() || relic?.desc || '';
}

function relicKillTick(state, id, interval, heal) {
  const level = state.relics.find(relic => relic.id === id)?.level || 1;
  interval = killInterval(interval, level);
  heal += Math.floor((level - 1) / 2);
  const key = `kills:${id}`; state.relicUses[key] = (state.relicUses[key] || 0) + 1;
  if (state.relicUses[key] >= interval) { state.relicUses[key] = 0; healPlayer(heal, state); }
}

function healingScale(state = S) {
  const latePenalty = 1 / (1 + Math.max(0, (state?.time || 0) - 600) / 1800);
  return latePenalty * ((state?.recoveryLock || 0) > 0 ? .35 : 1);
}

function healPlayer(amount, state = S) {
  if (!state || amount <= 0) return 0;
  const scaled = Math.max(.1, amount * healingScale(state));
  const actual = Number.isFinite(state.healBudget) ? Math.min(scaled, Math.max(0, state.healBudget)) : scaled;
  if (actual <= 0) return 0;
  const before = state.hp; state.hp = Math.min(state.maxHp, state.hp + actual);
  const healed = state.hp - before;
  if (Number.isFinite(state.healBudget)) state.healBudget = Math.max(0, state.healBudget - healed);
  return healed;
}


function fresh() {
  return {
    x: 0, y: 0, hp: 30, maxHp: 30, speed: 250, facing: 1, aimX: 1, aimY: 0,
    playerClass: null, shadowClock: 9, shadowActive: 0, mechOverload: 0, orbitalRigs: [],
    damage: 2.4, damageMult: 1, projectileMult: 1, saberMult: 1, orbitMult: 1,
    rate: .54, multishot: 1, pierce: 0, crit: .07, critMult: 1.75,
    blast: 0, blastDamage: .35, chain: 0, chainDamage: .28, shotScale: 1,
    orbitals: 0, orbitSpeed: 2.5, orbitRadius: 78, orbitSize: 1, orbitDamage: .72,
    orbitCooldown: .45, orbitShock: 0, orbitGuard: 0, orbitPulse: 0, orbitPulseClock: 4,
    saberLevel: 0, saberDamage: 2.3, saberRange: 118, saberArc: 1.38,
    saberRate: 1.02, saberClock: 0, saberEcho: 0, saberGuard: 0, saberActive: 0,
    magnet: 280, magnetMult: 1, regen: 0, guard: 0, xpGain: 1, recoveryLock: 0,
    shotClock: 0, spawnClock: 0, healClock: 0, healBudgetClock: 1, healBudget: 2, time: 0, xp: 0, nextXp: 8,
    level: 1, kills: 0, bossesKilled: 0, inv: 0, moving: false, paused: false,
    over: false, victory: false, submitted: false, score: 0, volleyCount: 0,
    mobs: [], mobGrid: new Map(), shots: [], delayedVolleys: [], enemyShots: [], hazards: [], gems: [], allies: [],
    chests: [], effects: [], particles: [], ranks: {}, chainFxThisFrame: 0,
    rewardQueue: [], activeReward: null, relics: [], acquiredRelics: new Set(), relicSlots: 3, rarityBias: 0,
    relicRoulette: false, relicAwaitDismiss: false, relicResultMessage: '',
    treasureRateMult: 1, nextTreasureAt: random(34, 48), treasureNumber: 0,
    leviathanCheckClock: 1, interior: null, worldSnapshot: null, allyTameChance: 0,
    nextBossAt: random(44, 52), bossIndex: 0, bossActive: null, bossWarned: false, bossFailures: 0,
    slotPity: 0,
    shake: 0, relicUses: {}, temporarySpeed: 1, temporarySpeedClock: 0,
    masteryClocks: { projectile: 8, saber: 6, orbit: 9, thor: 8 }, orbitAssault: null,
    codexOpen: false, codexWasPaused: false, menuOpen: false, menuWasPaused: false, abandoned: false,
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function cleanName() {
  const value = (ui.playerName.value || 'ASTRA').trim().replace(/[^\p{L}\p{N}_\- ]/gu, '').slice(0, 12);
  return value.length >= 2 ? value : 'ASTRA';
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), secs = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function computeScore(state) {
  return state.kills * 10 + state.level * 120 + Math.floor(state.time) * 4 + state.bossesKilled * 1000 + (state.bossesKilled > 0 ? 2500 : 0);
}

function lowFxActive() { return innerWidth < 760 || S.mobs.length > 85; }

function compact(array, keep) {
  let write = 0;
  for (let read = 0; read < array.length; read++) {
    if (keep(array[read])) { if (write !== read) array[write] = array[read]; write++; }
  }
  array.length = write;
}

function classIconFor(id) { return classDefs.find(def => def.id === id)?.icon || ''; }
function classNameFor(id) { const def = classDefs.find(entry => entry.id === id); return def ? classLabel(def) : tr('ranking.noClass', null, '미상'); }

function renderRanks(target, rows, ownRank) {
  target.innerHTML = rows.length
    ? rows.map((row, index) => `<div class="rank-row ${row.victory ? 'win' : ''}"><span>${index + 1}</span><b>${classIconFor(row.loadout?.playerClass)} ${escapeHtml(row.player)}</b><em>${Number(row.score).toLocaleString()}</em><span>${formatTime(row.duration)}</span><button class="rank-detail" data-rank-index="${index}">${tr('common.details', null, '상세')}</button></div>`).join('') + (ownRank ? `<div class="rank-status">${tr('ranking.ownRank', { rank: ownRank }, `이번 기록 순위: #${ownRank}`)}</div>` : '')
    : `<div class="rank-status">${tr('common.none', null, '기록 없음')}</div>`;
  target.querySelectorAll('.rank-detail').forEach(button => button.onclick = () => openRankDetail(rows[Number(button.dataset.rankIndex)]));
}

function openRankDetail(row) {
  if (!row) return;
  const loadout = row.loadout && typeof row.loadout === 'object' ? row.loadout : null;
  ui.rankDetailTitle.textContent = tr('ranking.loadoutTitle', { player: row.player || 'UNKNOWN' }, `${row.player || 'UNKNOWN'} · 종료 시 빌드`);
  ui.rankDetailSummary.innerHTML = `<span>${tr('ranking.result', null, '결과')}<b>${row.victory ? tr('gameOver.riftSealed', null, '보스 격파') : tr('gameOver.title', null, '작전 종료')}</b></span><span>${tr('term.score', null, '점수')}<b>${Number(row.score || 0).toLocaleString()}</b></span><span>${tr('ranking.survival', null, '생존')}<b>${formatTime(row.duration || 0)}</b></span><span>${tr('ranking.levelKills', null, '레벨 / 킬')}<b>LV.${Number(row.level || 1)} · ${Number(row.kills || 0).toLocaleString()}</b></span><span>${tr('ranking.bossRecord', null, '보스')}<b>${tr('ranking.bosses', { wins: Number(loadout?.bosses || 0), fails: Number(loadout?.bossFailures || 0) }, `${Number(loadout?.bosses || 0)} 격파`)}</b></span><span>${tr('ranking.class', null, '전직')}<b>${classIconFor(loadout?.playerClass)} ${classNameFor(loadout?.playerClass)}</b></span>`;
  const upgradeEntries = loadout?.upgrades && typeof loadout.upgrades === 'object' ? Object.entries(loadout.upgrades) : [];
  const relicEntries = Array.isArray(loadout?.relics) ? loadout.relics : [];
  ui.rankDetailBuilds.innerHTML = upgradeEntries.map(([id, rawRank]) => {
    const upgrade = upgradeById.get(id), rank = Math.max(1, Math.floor(Number(rawRank) || 1)); if (!upgrade) return '';
    const build = masteryBuildForUpgrade(id), mastered = Boolean(build && rank >= upgradeMaxFor(upgrade, S));
    const note = mastered ? `<br><span style="color:#ffd965">MAX · ${masteryNote(build)}</span>` : '';
    return `<article class="rank-loadout-item" style="--rarity:${mastered ? '#ffd45a' : '#54e8ff'}"><strong>${upgrade.icon} ${upgradeName(upgrade)} · ${limitBreakBuildForUpgrade(id) ? `${tr('common.limitBreak', null, '한계돌파')} LV.${rank}` : mastered ? 'MAX LV' : `LV.${rank}`}</strong><small>${upgradeDescription(upgrade, Math.max(0, rank - 1))}${note}</small></article>`;
  }).join('') || `<article class="rank-loadout-item"><strong>${tr('ranking.noTechnique', null, '술식 정보 없음')}</strong><small>${tr('ranking.noTechniqueDesc', null, '저장된 강화 효과가 없습니다.')}</small></article>`;
  ui.rankDetailRelics.innerHTML = relicEntries.map(entry => {
    const relic = relicById.get(String(entry?.id || '')); if (!relic) return '';
    const level = Math.max(1, Math.floor(Number(entry.level) || 1)), rarity = rarities[relic.rarity];
    return `<article class="rank-loadout-item" style="--rarity:${rarity.color}"><strong>${relic.icon} ${rarityName(relic.rarity)} · ${relicName(relic)} LV.${level}</strong><small>${relicEffectText(relic, level)}</small></article>`;
  }).join('') || `<article class="rank-loadout-item"><strong>${tr('ranking.noRelic', null, '획득 유물 없음')}</strong><small>${tr('ranking.noRelicDesc', null, '이 기록에는 저장된 유물이 없습니다.')}</small></article>`;
  if (!loadout) { ui.rankDetailBuilds.innerHTML = ''; ui.rankDetailRelics.innerHTML = ''; }
  ui.rankDetailEmpty.classList.toggle('hidden', Boolean(loadout)); showPanel(ui.rankDetailScreen);
}

function closeRankDetail() { hidePanel(ui.rankDetailScreen); }

function runLoadoutSnapshot(run) {
  return {
    v: 1,
    upgrades: Object.fromEntries(Object.entries(run.ranks).filter(([, rank]) => Number.isFinite(rank) && rank > 0).map(([id, rank]) => [id, Math.floor(rank)])),
    relics: run.relics.slice(0, 7).map(relic => ({ id: relic.id, level: Math.max(1, Math.floor(relic.level || 1)) })),
    bosses: run.bossesKilled,
    bossFailures: run.bossFailures,
    playerClass: run.playerClass || null,
  };
}

async function loadLeaderboard(target = ui.startRanks) {
  try {
    const response = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const data = await response.json(); renderRanks(target, data.scores || []);
  } catch { target.innerHTML = `<div class="rank-status">${tr('ranking.connecting', null, '온라인 랭킹 연결 대기 중')}</div>`; }
}

async function submitScore() {
  const run = S; if (!run || run.submitted) return;
  run.submitted = true; ui.finalRanks.innerHTML = `<div class="rank-status">${tr('ranking.submitting', null, '점수 등록 중…')}</div>`;
  try {
    const response = await fetch('/api/leaderboard', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: cleanName(), kills: run.kills, level: run.level, duration: Math.floor(run.time), victory: run.bossesKilled > 0, bosses: run.bossesKilled, loadout: runLoadoutSnapshot(run) }),
    });
    if (!response.ok) throw new Error();
    const data = await response.json(); run.score = Number(data.score ?? run.score);
    if (S === run) { ui.finalScore.textContent = `SCORE ${run.score.toLocaleString()} · RIFT DEPTH ${run.bossesKilled}`; renderRanks(ui.finalRanks, data.scores || [], data.rank); }
  } catch { if (S === run) ui.finalRanks.innerHTML = `<div class="rank-status">${tr('ranking.submitFailed', null, '점수 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')}</div>`; }
}

async function begin() {
  await AudioEngine.init(); AudioEngine.scene('battle');
  S = fresh(); running = true; chosen = [];
  mouseAim = { inside: false, valid: false, moved: false, x: 1, y: 0 };
  hidePanel(ui.start, true); hidePanel(ui.over, true); hidePanel(ui.choices, true); hidePanel(ui.relicScreen, true); hidePanel(ui.codexScreen, true); hidePanel(ui.rankDetailScreen, true); hidePanel(ui.gameMenu, true);
  ui.hud.classList.remove('hidden'); ui.build.classList.remove('hidden'); ui.radar.classList.remove('hidden'); ui.relicTray.classList.remove('hidden');
  ui.bossHud.classList.add('hidden'); updateBuild(); updateRelicTray();
  S.spawnClock = 0;
}

function endGame(reason = 'defeat') {
  if (S.over) return;
  S.over = true; S.abandoned = reason === 'abandon'; S.victory = S.bossesKilled > 0; running = false;
  S.score = computeScore(S);
  AudioEngine.se('over'); AudioEngine.scene('over');
  $('#resultTime').textContent = formatTime(S.time); $('#resultKills').textContent = S.kills;
  $('#resultBosses').textContent = S.bossesKilled; $('#resultLevel').textContent = S.level;
  ui.finalScore.textContent = `SCORE ${S.score.toLocaleString()} · RIFT DEPTH ${S.bossesKilled}`;
  ui.over.querySelector('h2').textContent = S.abandoned ? tr('gameOver.abandoned', null, '작전 포기') : tr('gameOver.title', null, '작전 종료'); ui.bossHud.classList.add('hidden');
  hidePanel(ui.gameMenu, true); hidePanel(ui.choices, true); hidePanel(ui.relicScreen, true); hidePanel(ui.codexScreen, true); showPanel(ui.over); submitScore();
}

function returnToMain() {
  running = false; keys.clear(); joy = { on: false, id: -1, sx: 0, sy: 0, x: 0, y: 0 }; S = null;
  hidePanel(ui.over, true); hidePanel(ui.choices, true); hidePanel(ui.relicScreen, true); hidePanel(ui.codexScreen, true); hidePanel(ui.rankDetailScreen, true); hidePanel(ui.gameMenu, true);
  ui.hud.classList.add('hidden'); ui.build.classList.add('hidden'); ui.radar.classList.add('hidden'); ui.relicTray.classList.add('hidden'); ui.bossHud.classList.add('hidden'); ui.warning.classList.add('hidden');
  showPanel(ui.start); AudioEngine.scene('menu'); loadLeaderboard();
}

function updateSoundUi() {
  const muted = AudioEngine.isMuted();
  if (ui.menuSoundState) ui.menuSoundState.textContent = muted ? tr('common.off', null, 'OFF') : tr('common.on', null, 'ON');
  ui.menuSound?.setAttribute('aria-pressed', String(muted));
}

function updateHitboxUi() {
  if (ui.menuHitboxState) ui.menuHitboxState.textContent = settings.showHitbox ? tr('common.on', null, 'ON') : tr('common.off', null, 'OFF');
  ui.menuHitbox?.setAttribute('aria-pressed', String(settings.showHitbox));
}

function toggleHitbox() {
  settings.showHitbox = !settings.showHitbox; saveSettings(); updateHitboxUi();
}

function openGameMenu() {
  if (!S || !running || S.over || S.menuOpen || S.activeReward) return;
  S.menuWasPaused = S.paused; S.paused = true; S.menuOpen = true; keys.clear();
  ui.menuButton?.setAttribute('aria-expanded', 'true'); showPanel(ui.gameMenu); updateSoundUi(); updateHitboxUi();
}

function closeGameMenu() {
  if (!S?.menuOpen) return;
  S.menuOpen = false; S.paused = Boolean(S.menuWasPaused); ui.menuButton?.setAttribute('aria-expanded', 'false'); hidePanel(ui.gameMenu);
  AudioEngine.scene(S.paused ? 'choice' : 'battle');
}

function abandonRun() {
  if (!S || !running || S.over) return;
  S.menuOpen = false; ui.menuButton?.setAttribute('aria-expanded', 'false'); endGame('abandon');
}

function affinityScores() {
  const scores = {};
  for (const [id, rank] of Object.entries(S.ranks)) {
    const upgrade = upgradeById.get(id);
    for (const tag of upgrade?.tags || []) scores[tag] = (scores[tag] || 0) + rank;
  }
  for (const relic of S.relics) {
    for (const tag of relic.tags || []) scores[tag] = (scores[tag] || 0) + (1.5 + relic.rarity * .5) * (relic.level || 1);
  }
  return scores;
}

function weightedPick(pool, weightFor) {
  const weights = pool.map(item => Math.max(.001, weightFor(item)));
  let roll = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

function upgradeWeight(upgrade, affinity) {
  const values = (upgrade.tags || []).map(tag => affinity[tag] || 0).sort((a, b) => b - a);
  const maxAffinity = Math.min(8, values[0] || 0), secondary = Math.min(3, values.slice(1).reduce((a, b) => a + b, 0));
  const owned = (S.ranks[upgrade.id] || 0) > 0 ? 1.28 : 1;
  return (upgrade.weight || 1) * owned * (1 + maxAffinity * .24 + secondary * .08);
}

function eligibleUpgrades() {
  return upgrades.filter(upgrade => (S.ranks[upgrade.id] || 0) < upgradeMaxFor(upgrade, S) && (!upgrade.requires || upgrade.requires(S)));
}

function enqueueReward(reward) {
  S.rewardQueue.push(reward); processRewards();
}

function queueChoice() { enqueueReward({ type: 'level' }); }
function queueRelic(source = 'treasure', tier = 1) { enqueueReward({ type: 'relic', source, tier }); }

function processRewards() {
  if (!S || S.paused || S.over || !S.rewardQueue.length) return;
  const reward = S.rewardQueue.shift(); S.activeReward = reward;
  if (reward.type === 'level') openLevelChoices();
  else if (reward.type === 'classChange') openClassChoices();
  else openRelicReward(reward);
}

const classDefs = [
  { id: 'silverbullet', icon: '🔫', name: '실버불렛', difficulty: 4, desc: '성좌탄이 은탄으로 변합니다. 쉬지 않고 쏟아붓는 연사 사격으로 변경 (탄 크기 축소, 공격속도 대폭 증가, 발당 피해 감소). 궁극기가 밀집 지역에 원형 난사로 변경됩니다.' },
  { id: 'shadowmaster', icon: '🥷', name: '쉐도우마스터', difficulty: 4, desc: '어둠의 쌍검을 사용합니다 (범위는 좁아지지만 피해 증가). 주기적으로 그림자에 숨어 투명화되며 이동속도가 오르고 주변에 검은 기를 발산합니다. 보스 대상 최종 데미지 +30%. 궁극기가 전후방으로 퍼지는 거대한 어둠의 검기로 변경됩니다.' },
  { id: 'mechanic', icon: '🛰', name: '메카닉', difficulty: 2, desc: '위성이 충돌 대신 적을 추적하며 레이저를 쏩니다. 화면 안의 보스를 우선 공격합니다. 궁극기가 과부하 모드(이동속도 증가·레이저 범위 확대)로 변경됩니다.' },
  { id: 'thor', icon: '⚡', name: '토르', difficulty: 2, desc: '연쇄 낙뢰가 모든 공격(투사체·위성·광검)에 적용되며 레벨 7까지 강화됩니다. 번개가 노란색으로 더 화려해집니다. 맥스 레벨 시 토르의 망치 - 화면 안에서 체력이 가장 높은 적에게 거대한 번개를 내리쳐 기절·감전시키며, 쉴드를 무시하고 피해를 입힙니다.' },
  { id: 'none', icon: '⬛', name: '방랑자', difficulty: 1, desc: 'MAX HP +5. 기존 빌드를 그대로 유지합니다.' },
];

function classLabel(def) { return tr(`class.${def.id}.name`, null, def.name); }
function classDesc(def) { return tr(`class.${def.id}.desc`, null, def.desc); }
function classDifficultyStars(def) { const n = clamp(def.difficulty || 1, 1, 5); return '★'.repeat(n) + '☆'.repeat(5 - n); }

function openClassChoices() {
  chosen = classDefs; ui.cards.innerHTML = '';
  classDefs.forEach((def, index) => {
    const button = document.createElement('button');
    button.className = 'choice mastery-ready';
    button.innerHTML = `<span class="icon">${def.icon}</span><strong>${classLabel(def)} <span style="color:#ffd65a;font-size:12px">${classDifficultyStars(def)}</span></strong><small>${classDesc(def)}</small><em>${tr('class.chooseTag', null, '전직')} · [${index + 1}]</em>`;
    button.onclick = () => chooseClass(index); ui.cards.appendChild(button);
  });
  S.paused = true; AudioEngine.se('level'); AudioEngine.scene('choice'); showPanel(ui.choices);
}

function chooseClass(index) {
  if (!S?.paused || S.activeReward?.type !== 'classChange') return;
  const def = classDefs[index]; if (!def) return;
  S.playerClass = def.id;
  if (def.id === 'silverbullet') { S.rate *= .4; S.projectileMult *= .65; S.shotScale *= .55; }
  else if (def.id === 'thor') { S.chainDamage *= 1.4; }
  else if (def.id === 'none') { S.maxHp += 5; S.hp += 5; }
  effect('level', S.x, S.y, { life: .85, max: .85 });
  showWarning(`${classLabel(def)} · ${tr('class.unlocked', null, '전직 완료')}`);
  finishReward(`${def.icon} ${classLabel(def)}`);
}

function openLevelChoices() {
  const pool = eligibleUpgrades(), affinity = affinityScores(), out = [];
  if (S.level === 2 && Object.keys(S.ranks).length === 0) {
    out.push(upgradeById.get('multishot'), upgradeById.get('orbit'), upgradeById.get('saber'));
  } else {
    for (let pass = 0; pass < 2 && pool.length; pass++) {
      const pick = weightedPick(pool, item => upgradeWeight(item, affinity));
      out.push(pick); pool.splice(pool.indexOf(pick), 1);
    }
    if (pool.length) out.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  const slot = upgrades.find(upgrade => upgrade.id === 'relic_slot');
  const slotEligible = slot && (S.ranks.relic_slot || 0) < slot.max && (!slot.requires || slot.requires(S));
  if (slotEligible && !out.includes(slot)) {
    S.slotPity++;
    if (S.slotPity >= 2 && out.length) { out[out.length - 1] = slot; S.slotPity = 0; }
  } else if (out.includes(slot)) S.slotPity = 0;

  if (!out.length) {
    S.paused = false; S.activeReward = null; processRewards(); return;
  }
  chosen = out; ui.cards.innerHTML = '';
  out.forEach((upgrade, index) => {
    const rank = S.ranks[upgrade.id] || 0, button = document.createElement('button');
    const build = masteryBuildForUpgrade(upgrade.id), limitBuild = limitBreakBuildForUpgrade(upgrade.id), awakening = Boolean(build && rank + 1 === upgradeMaxFor(upgrade, S));
    button.className = `choice${awakening || limitBuild ? ' mastery-ready' : ''}`;
    button.innerHTML = `<span class="icon">${upgrade.icon}</span><strong>${upgradeName(upgrade)}</strong><small>${upgradeDescription(upgrade, rank)}${awakening ? `<br><b style="color:#ffd965">MAX · ${masteryNote(build)}</b>` : ''}</small><em>${awakening ? 'MAX LV · MASTERY' : limitBuild ? `${tr('common.limitBreak', null, '한계돌파')} LV.${rank} → LV.${rank + 1}` : `RANK ${rank} → ${rank + 1}`} · [${index + 1}]</em>`;
    button.onclick = () => choose(index); ui.cards.appendChild(button);
  });
  S.paused = true; AudioEngine.se('level'); AudioEngine.scene('choice'); showPanel(ui.choices);
}

function choose(index) {
  if (!S?.paused || S.activeReward?.type !== 'level') return;
  const upgrade = chosen[index]; if (!upgrade) return;
  upgrade.apply(S); S.ranks[upgrade.id] = (S.ranks[upgrade.id] || 0) + 1;
  const masteredBuild = masteryBuildForUpgrade(upgrade.id);
  if (masteredBuild && isMastered(masteredBuild)) {
    S.masteryClocks[masteredBuild] = .35; showWarning(`${masteryLabel(masteredBuild)} · MAX MASTERY`); AudioEngine.se('relic');
  }
  const limitBuild = limitBreakBuildForUpgrade(upgrade.id);
  if (limitBuild) AudioEngine.se('relic');
  effect('level', S.x, S.y, { life: .85, max: .85 });
  hidePanel(ui.choices); AudioEngine.se('select'); finishReward(`${upgrade.icon} ${upgradeName(upgrade)}  ${limitBuild ? `한계돌파 LV.${S.ranks[upgrade.id]}` : `RANK ${S.ranks[upgrade.id]}`}`);
}

function rarityWeights(time) {
  if (time < 60) return [62, 27, 9, 2, 0];
  if (time < 120) return [48, 29, 17, 5.5, .5];
  if (time < 180) return [35, 30, 23, 10, 2];
  if (time < 300) return [23, 28, 29, 16, 4];
  if (time < 480) return [13, 23, 31, 25, 8];
  if (time < 720) return [6, 17, 30, 32, 15];
  return [2, 9, 24, 39, 26];
}

function rollRarity(source, tier) {
  const weights = rarityWeights(S.time), total = weights.reduce((sum, value) => sum + value, 0);
  let roll = Math.random() * total, rarity = 0;
  for (let i = 0; i < weights.length; i++) { roll -= weights[i]; if (roll <= 0) { rarity = i; break; } }
  const minimum = source === 'boss' ? Math.min(3, tier) : 0;
  rarity = Math.max(rarity, minimum);
  const promotion = source === 'boss' ? .18 + tier * .12 : source === 'treasure' ? .26 : 0;
  if (Math.random() < promotion) rarity++;
  return clamp(rarity + S.rarityBias, 0, 4);
}

function relicOptions(reward) {
  const equipped = new Set(S.relics.map(relic => relic.id)), options = [], affinity = affinityScores();
  for (let card = 0; card < 3; card++) {
    let rarity = rollRarity(reward.source, reward.tier), pool = [];
    for (let distance = 0; distance < 5 && !pool.length; distance++) {
      const up = rarity + distance, down = rarity - distance;
      if (up <= 4) pool = relics.filter(relic => relic.rarity === up && !equipped.has(relic.id) && !options.includes(relic));
      if (!pool.length && down >= 0) pool = relics.filter(relic => relic.rarity === down && !equipped.has(relic.id) && !options.includes(relic));
    }
    if (!pool.length) pool = relics.filter(relic => !options.includes(relic));
    const wildcard = Math.random() < .2;
    const pick = weightedPick(pool, relic => {
      if (wildcard) return 1;
      const best = Math.max(0, ...(relic.tags || []).map(tag => affinity[tag] || 0));
      return Math.min(2, 1 + best * .18);
    });
    options.push(pick);
  }
  return options;
}

function relicCard(relic, action, label = '장착') {
  const rarity = rarities[relic.rarity], button = document.createElement('button');
  button.className = 'relic-card'; button.style.setProperty('--rarity', rarity.color);
  button.innerHTML = `<span class="relic-icon">${relic.icon}</span><span class="rarity">${rarityName(relic.rarity)} RELIC</span><strong>${relicName(relic)}</strong><small>${relicEffectText(relic)}</small><em>${label}</em>`;
  button.onclick = action; return button;
}

function rollRelicAward(reward) {
  const candidates = relics;
  const targetRarity = rollRarity(reward.source, reward.tier);
  let pool = [];
  for (let distance = 0; distance < 5 && !pool.length; distance++) {
    const high = targetRarity + distance, low = targetRarity - distance;
    if (high <= 4) pool = candidates.filter(relic => relic.rarity === high);
    if (!pool.length && low >= 0) pool = candidates.filter(relic => relic.rarity === low);
  }
  if (!pool.length) pool = candidates;
  const affinity = affinityScores();
  return weightedPick(pool, relic => {
    const owned = relicLevel(relic.id) > 0 ? 1.18 : 1.35;
    const match = Math.max(0, ...(relic.tags || []).map(tag => affinity[tag] || 0));
    return owned * Math.min(1.8, 1 + match * .12);
  });
}

function openRelicReward(reward) {
  S.paused = true; S.relicRoulette = true; S.relicAwaitDismiss = false; S.relicResultMessage = ''; S.relicCandidate = null; S.relicReplaceIndex = null;
  const result = rollRelicAward(reward); S.relicRouletteResult = result;
  ui.relicTitle.textContent = reward.source === 'boss' ? '보스 유물 슬롯' : '잭팟 유물 슬롯';
  ui.relicSub.textContent = S.relics.length >= S.relicSlots ? '슬롯이 가득 차면 중복 유물은 레벨업, 신규 유물은 가장 약한 유물을 자동으로 교체합니다' : '획득 유물이 자동으로 결정됩니다';
  ui.relicNew.innerHTML = ''; ui.relicCards.innerHTML = ''; showPanel(ui.relicScreen); AudioEngine.scene('choice');
  let tick = 0;
  const spin = () => {
    const preview = tick >= 18 ? result : relics[Math.floor(Math.random() * relics.length)];
    const rarity = rarities[preview.rarity], currentLevel = relicLevel(preview.id);
    ui.relicCards.innerHTML = `<div class="relic-card" style="--rarity:${rarity.color};grid-column:1/-1;min-width:min(82vw,360px);margin:auto;cursor:default"><span class="relic-icon">${preview.icon}</span><span class="rarity">${tick >= 18 ? rarityName(preview.rarity) : 'SEARCHING'} RELIC</span><strong>${relicName(preview)}</strong><small>${tick >= 18 ? relicEffectText(preview, currentLevel + 1) : '공명 주파수 탐색 중…'}</small><em>${tick >= 18 ? (currentLevel ? `LV.${currentLevel} → LV.${currentLevel + 1}` : 'NEW RELIC') : '◈ ◇ ◈'}</em></div>`;
    if (tick < 18) { tick++; AudioEngine.se('reel'); setTimeout(spin, 45 + tick * 5); }
    else { AudioEngine.se('relic'); setTimeout(() => awardRelic(result), 520); }
  };
  spin();
}

function awardRelic(definition) {
  const existing = S.relics.find(relic => relic.id === definition.id);
  if (existing) {
    existing.level = (existing.level || 1) + 1; existing.equip(S, false);
    effect('relic', S.x, S.y, { life: 1.15, max: 1.15, color: rarities[existing.rarity].color });
    updateRelicTray(); showRelicResult(existing, `${existing.icon} ${existing.name} · RELIC LV.${existing.level}`, true); return;
  }
  if (S.relics.length >= S.relicSlots) {
    let weakestIndex = 0;
    for (let i = 1; i < S.relics.length; i++) {
      const a = S.relics[i], b = S.relics[weakestIndex];
      if ((a.level || 1) < (b.level || 1) || ((a.level || 1) === (b.level || 1) && a.rarity < b.rarity)) weakestIndex = i;
    }
    const old = S.relics[weakestIndex];
    for (let level = 0; level < (old.level || 1); level++) old.unequip(S);
    const instance = { ...definition, level: 1 }, first = !S.acquiredRelics.has(instance.id);
    S.acquiredRelics.add(instance.id); S.relics[weakestIndex] = instance; instance.equip(S, first);
    effect('relic', S.x, S.y, { life: 1.15, max: 1.15, color: rarities[instance.rarity].color });
    updateRelicTray(); showRelicResult(instance, `${old.icon} ${old.name} → ${instance.icon} ${instance.name}`, false); return;
  }
  const instance = { ...definition, level: 1 }, first = !S.acquiredRelics.has(instance.id);
  S.acquiredRelics.add(instance.id); S.relics.push(instance); instance.equip(S, first);
  effect('relic', S.x, S.y, { life: 1.15, max: 1.15, color: rarities[instance.rarity].color });
  updateRelicTray(); showRelicResult(instance, `${instance.icon} ${rarities[instance.rarity].name} 유물 · ${instance.name}`, false);
}

function showRelicResult(relic, message, upgraded) {
  const rarity = rarities[relic.rarity];
  S.relicRoulette = false; S.relicAwaitDismiss = true; S.relicResultMessage = message;
  ui.relicTitle.textContent = upgraded ? '유물 레벨 업!' : '새 유물 획득!';
  ui.relicSub.textContent = '효과를 확인한 뒤 화면을 터치하거나 아무 키를 눌러 계속하세요';
  ui.relicCards.innerHTML = `<div class="relic-card result-ready" style="--rarity:${rarity.color};grid-column:1/-1;min-width:min(82vw,360px);margin:auto;cursor:pointer"><span class="relic-icon">${relic.icon}</span><span class="rarity">${rarityName(relic.rarity)} RELIC</span><strong>${relicName(relic)} · LV.${relic.level || 1}</strong><small>${relicEffectText(relic)}</small><em>TAP / PRESS KEY</em></div>`;
}

function dismissRelicResult() {
  if (!S?.relicAwaitDismiss) return;
  const message = S.relicResultMessage; S.relicAwaitDismiss = false; S.relicResultMessage = '';
  finishReward(message);
}

function renderRelicChoices() {
  const reward = S.activeReward;
  ui.relicTitle.textContent = reward.source === 'boss' ? '보스 유물 공명' : '잭팟 유물 캐시';
  ui.relicSub.textContent = '시간이 흐를수록 더 높은 등급이 출현합니다'; ui.relicNew.innerHTML = ''; ui.relicCards.innerHTML = '';
  S.relicChoices.forEach((relic, index) => ui.relicCards.appendChild(relicCard(relic, () => selectRelic(index), `[${index + 1}] 선택`)));
  S.relicCandidate = null; S.relicReplaceIndex = null;
}

function selectRelic(index) {
  const relic = S.relicChoices?.[index]; if (!relic) return;
  if (S.relics.length < S.relicSlots) { equipRelic(relic); return; }
  S.relicCandidate = relic; renderRelicReplacement(relic);
}

function renderRelicReplacement(candidate) {
  const rarity = rarities[candidate.rarity];
  ui.relicTitle.textContent = '유물 슬롯 초과'; ui.relicSub.textContent = '교체할 기존 유물을 선택하거나 신규 유물을 분해하세요';
  ui.relicNew.innerHTML = `<div class="relic-new" style="--rarity:${rarity.color}">신규 <b>${rarity.name} · ${candidate.icon} ${candidate.name}</b> — ${relicEffectText(candidate)}</div>`;
  ui.relicCards.innerHTML = '';
  S.relics.forEach((old, index) => ui.relicCards.appendChild(relicCard(old, () => previewRelicReplacement(index, candidate), `[${index + 1}] 교체 후보`)));
  const salvage = document.createElement('button'); salvage.className = 'relic-card salvage';
  salvage.innerHTML = `<span class="relic-icon">◇</span><span class="rarity">SALVAGE</span><strong>신규 유물 분해</strong><small>${Math.round(rarity.salvage * 100)}% 레벨 경험치와 체력을 얻습니다.</small><em>분해하기</em>`;
  salvage.onclick = () => salvageRelic(candidate); ui.relicCards.appendChild(salvage);
  const back = document.createElement('button'); back.className = 'relic-card salvage';
  back.innerHTML = '<span class="relic-icon">↶</span><span class="rarity">BACK</span><strong>유물 선택으로</strong><small>3개의 신규 유물 후보를 다시 확인합니다.</small><em>뒤로</em>';
  back.onclick = renderRelicChoices; ui.relicCards.appendChild(back);
}

function previewRelicReplacement(index, candidate) {
  const old = S.relics[index], oldRarity = rarities[old.rarity], newRarity = rarities[candidate.rarity]; S.relicReplaceIndex = index;
  ui.relicTitle.textContent = '유물 교체 확인'; ui.relicSub.textContent = '효과를 비교한 뒤 교체를 확정하세요';
  ui.relicNew.innerHTML = `<div class="relic-new" style="--rarity:${newRarity.color}">OLD <b style="color:${oldRarity.color}">${old.icon} ${old.name}</b> — ${relicEffectText(old)}<br>NEW <b>${candidate.icon} ${candidate.name}</b> — ${relicEffectText(candidate)}</div>`;
  ui.relicCards.innerHTML = '';
  ui.relicCards.appendChild(relicCard(candidate, () => replaceRelic(index, candidate), '교체 확정 · ENTER'));
  const cancel = document.createElement('button'); cancel.className = 'relic-card salvage';
  cancel.innerHTML = '<span class="relic-icon">↶</span><span class="rarity">CANCEL</span><strong>교체 슬롯 다시 선택</strong><small>장착 중인 유물 목록으로 돌아갑니다.</small><em>ESC</em>';
  cancel.onclick = () => renderRelicReplacement(candidate); ui.relicCards.appendChild(cancel);
}

function equipRelic(relic) {
  const first = !S.acquiredRelics.has(relic.id); S.acquiredRelics.add(relic.id);
  S.relics.push(relic); relic.equip(S, first); effect('relic', S.x, S.y, { life: 1.1, max: 1.1, color: rarities[relic.rarity].color });
  updateRelicTray(); finishReward(`${relic.icon} ${rarities[relic.rarity].name} 유물 · ${relic.name}`);
}

function replaceRelic(index, candidate) {
  const old = S.relics[index], first = !S.acquiredRelics.has(candidate.id); S.acquiredRelics.add(candidate.id);
  for (let level = 0; level < (old.level || 1); level++) old.unequip(S); const instance = { ...candidate, level: 1 }; S.relics[index] = instance; instance.equip(S, first);
  effect('relic', S.x, S.y, { life: 1.1, max: 1.1, color: rarities[candidate.rarity].color });
  updateRelicTray(); finishReward(`${old.name} → ${candidate.name}`);
}

function salvageRelic(relic) {
  const rarity = rarities[relic.rarity]; S.xp += S.nextXp * rarity.salvage;
  S.hp = Math.min(S.maxHp, S.hp + [2, 3, 5, 9, S.maxHp][relic.rarity]);
  finishReward(`${relic.name} 분해 · 공명 에너지 회수`); processLevelUps();
}

function finishReward(message) {
  hidePanel(ui.choices); hidePanel(ui.relicScreen);
  S.paused = false; S.activeReward = null; S.relicRoulette = false; S.relicAwaitDismiss = false; S.relicResultMessage = ''; S.relicCandidate = null; S.relicReplaceIndex = null;
  AudioEngine.se('select'); AudioEngine.scene('battle'); if (message) showToast(message);
  updateBuild(); updateRelicTray(); setTimeout(processRewards, 210);
}

function updateBuild() {
  ui.build.innerHTML = Object.entries(S.ranks).filter(([id]) => !limitBreakBuildForUpgrade(id)).map(([id, rank]) => {
    const upgrade = upgradeById.get(id), build = masteryBuildForUpgrade(id), mastered = Boolean(build && isMastered(build));
    const limit = build ? limitBreakLevel(build) : 0;
    if (!upgrade) return '';
    const statusText = mastered ? `MAX LV${limit ? ` · ${tr('common.limitBreak', null, '한계돌파')} ${limit}` : ''}` : `LV${rank}`;
    const compact = mastered ? (limit ? `★${limit}` : '★') : String(rank);
    return `<span class="${mastered ? 'mastered' : ''}" title="${escapeHtml(`${upgradeName(upgrade)} ${statusText}`)}">${upgrade.icon} ${compact}</span>`;
  }).join('');
}

function updateRelicTray() {
  ui.relicDetails.innerHTML = S.relics.length ? S.relics.map(relic => {
    const rarity = rarities[relic.rarity];
    return `<div class="relic-detail" style="--rarity:${rarity.color}"><b>${relic.icon} ${relicName(relic)} <em>LV.${relic.level || 1}</em></b><span>${relicEffectText(relic)}</span></div>`;
  }).join('') : '<div class="relic-detail empty"><b>장착 유물 없음</b><span>보스와 잭팟 그렘린을 사냥하세요</span></div>';
  ui.relicSlots.innerHTML = '';
  for (let i = 0; i < S.relicSlots; i++) {
    const relic = S.relics[i], slot = document.createElement('span'); slot.className = `relic-slot${relic ? '' : ' empty'}`;
    slot.innerHTML = relic ? `${relic.icon}<small>LV.${relic.level || 1}</small>` : '＋'; slot.title = relic ? `${rarities[relic.rarity].name} · ${relic.name} LV.${relic.level || 1}: ${relicEffectText(relic)}` : '빈 유물 슬롯';
    if (relic) slot.style.setProperty('--rarity', rarities[relic.rarity].color); ui.relicSlots.appendChild(slot);
  }
}

function toggleRelicTray(forceExpand) {
  const expand = forceExpand ?? ui.relicDetails.classList.contains('collapsed');
  ui.relicDetails.classList.toggle('collapsed', !expand);
  ui.relicTrayToggle?.setAttribute('aria-expanded', String(expand));
}

function renderCodex(tab = 'builds') {
  document.querySelectorAll('[data-codex]').forEach(button => button.classList.toggle('active', button.dataset.codex === tab));
  if (tab === 'relics') {
    ui.codexGrid.innerHTML = relics.map(relic => {
      const owned = S?.relics.find(item => item.id === relic.id), level = owned?.level || 1, rarity = rarities[relic.rarity];
      return `<article class="codex-entry${owned ? '' : ' locked'}" style="--rarity:${rarity.color}"><header><span>${relic.icon} ${relicName(relic)}</span><em>${owned ? `LV.${level}` : rarityName(relic.rarity)}</em></header><p>${relicEffectText(relic, level)}</p></article>`;
    }).join('');
    return;
  }
  if (tab === 'classes') {
    ui.codexGrid.innerHTML = classDefs.map(def => {
      const active = Boolean(S?.playerClass) && S.playerClass === def.id;
      const status = active ? '현재 전직' : S?.playerClass ? '' : 'LV.30 전직 선택';
      return `<article class="codex-entry${active ? ' mastered' : ''}"><header><span>${def.icon} ${classLabel(def)}</span>${status ? `<em>${status}</em>` : ''}</header><p style="color:#ffd65a">난이도 ${classDifficultyStars(def)}</p><p>${classDesc(def)}</p></article>`;
    }).join('');
    return;
  }
  ui.codexGrid.innerHTML = upgrades.filter(upgrade => !upgrade.id.startsWith('limit_')).map(upgrade => {
    const rank = S?.ranks[upgrade.id] || 0, build = masteryBuildForUpgrade(upgrade.id), mastered = Boolean(build && S && isMastered(build));
    const limit = build ? limitBreakLevel(build) : 0;
    const status = mastered ? `MAX LV${limit ? ` · 한계돌파 ${limit}` : ''}` : `LV.${rank}/${upgradeMaxFor(upgrade, S)}`;
    const mastery = build ? `<p class="master-note">MAX · ${masteryNote(build)}<br>${tr('common.limitBreak', null, '한계돌파')}: +${limit * 4}% DMG · +${Math.min(20, limit) * 2}% AREA · -${Math.min(20, limit)}% INTERVAL${limit >= 20 ? ' (AREA / INTERVAL MAX)' : ''}</p>` : '';
    return `<article class="codex-entry${mastered ? ' mastered' : rank ? '' : ' locked'}"><header><span>${upgrade.icon} ${upgradeName(upgrade)}</span><em>${status}</em></header><p>${upgradeDescription(upgrade, rank)}</p>${mastery}</article>`;
  }).join('');
}

function openCodex() {
  if (S?.activeReward) { showToast('보상 선택을 먼저 완료하세요'); return; }
  if (S) { S.codexWasPaused = S.paused; S.paused = true; S.codexOpen = true; }
  renderCodex('builds'); showPanel(ui.codexScreen); AudioEngine.scene('choice');
}

function closeCodex() {
  hidePanel(ui.codexScreen);
  if (S) { S.paused = S.codexWasPaused; S.codexOpen = false; }
  AudioEngine.scene(S && running && !S.over ? 'battle' : 'menu');
}

function showToast(text) {
  const node = document.createElement('div'); node.className = 'toast'; node.textContent = text;
  document.body.appendChild(node); setTimeout(() => node.remove(), 1500);
}

function showWarning(text) {
  ui.warning.textContent = text; ui.warning.classList.remove('hidden'); setTimeout(() => ui.warning.classList.add('hidden'), 2200);
}

function damageFlash() {
  const node = document.createElement('div'); node.className = 'damage-flash'; document.body.appendChild(node); setTimeout(() => node.remove(), 250);
}

function effect(type, x, y, extra = {}) {
  const crowded = S.mobs.length > 90;
  if (type === 'chain') {
    const chainFxCap = crowded || innerWidth < 760 ? 2 : 3;
    if (S.chainFxThisFrame >= chainFxCap) return;
    S.chainFxThisFrame++;
  }
  if (S.effects.length >= (crowded ? 90 : 180) && type === 'hit') return;
  if (S.effects.length >= (crowded ? 150 : 240)) S.effects.shift();
  S.effects.push({ type, x, y, life: .35, max: .35, ...extra });
}
function burst(x, y, color, count = 8, speed = 150) {
  const cap = S.mobs.length > 90 ? 130 : 220;
  for (let i = 0; i < count && S.particles.length < cap; i++) {
    const angle = Math.random() * TAU, velocity = random(speed * .35, speed);
    S.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: random(.22, .55), max: .55, color, size: random(1.5, 4) });
  }
}

function applyStaticTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = tr(node.dataset.i18n, null, node.textContent); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(node => { node.placeholder = tr(node.dataset.i18nPlaceholder, null, node.placeholder); });
  const language = currentLanguage();
  if (ui.startLanguage) ui.startLanguage.value = language;
  if (ui.menuLanguage) ui.menuLanguage.value = language;
  if (ui.menuButton) ui.menuButton.setAttribute('aria-label', tr('menu.open', null, '메뉴'));
  if (ui.codexButton) ui.codexButton.textContent = `▤ ${tr('hud.codex', null, '도감').replace(/^▤\s*/, '')}`;
  if (ui.rankDetailClose) ui.rankDetailClose.textContent = `${tr('common.close', null, '닫기')} ×`;
  if (ui.menuQuit?.querySelector('span')) ui.menuQuit.querySelector('span').textContent = tr('menu.quit', null, '작전 포기');
  updateSoundUi();
  updateHitboxUi();
  if (S) { updateBuild(); updateRelicTray(); if (S.codexOpen) renderCodex('builds'); }
}

function chooseLanguage(language, persist = true) {
  if (!I18n?.setLanguage(language, persist)) return;
  applyStaticTranslations();
}

async function initializeLanguage() {
  applyStaticTranslations();
  if (!I18n || I18n.hasStoredLanguage?.() || location.protocol === 'file:') return;
  try {
    const response = await fetch('/api/locale', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json(); chooseLanguage(data.language || 'en', false);
  } catch { /* Local/offline builds use the browser language selected by game-i18n.js. */ }
}

function resize() {
  const pixelBudget = 3000000, budgetDpr = Math.sqrt(pixelBudget / Math.max(1, innerWidth * innerHeight));
  const dpr = Math.max(.75, Math.min(devicePixelRatio, innerWidth < 760 ? 1.35 : 1.5, budgetDpr)); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize(); addEventListener('resize', resize);

addEventListener('keydown', event => {
  AudioEngine.resume(); const key = event.key.toLowerCase(); keys.add(key);
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  if (key === 'escape' && !ui.rankDetailScreen.classList.contains('hidden')) { keys.delete(key); closeRankDetail(); return; }
  if (key === 'escape' && S?.codexOpen) { keys.delete(key); closeCodex(); return; }
  if (key === 'escape' && S?.menuOpen) { keys.delete(key); closeGameMenu(); return; }
  if (key === 'escape' && S && running && !S.over && !S.activeReward) { keys.delete(key); openGameMenu(); return; }
  if (key === 'm') toggleSound();
  if (S?.paused && S.relicAwaitDismiss) { keys.delete(key); dismissRelicResult(); return; }
  if (S?.paused && ['1', '2', '3'].includes(key)) {
    if (S.activeReward?.type === 'level') choose(Number(key) - 1);
    else if (S.activeReward?.type === 'relic' && !S.relicRoulette && !S.relicCandidate) selectRelic(Number(key) - 1);
  }
  if (S?.paused && S.activeReward?.type === 'relic' && !S.relicRoulette && S.relicCandidate) {
    if (/^[1-7]$/.test(key) && Number(key) <= S.relics.length) previewRelicReplacement(Number(key) - 1, S.relicCandidate);
    if (key === 'enter' && S.relicReplaceIndex != null) replaceRelic(S.relicReplaceIndex, S.relicCandidate);
    if (key === 'escape') {
      if (S.relicReplaceIndex != null) renderRelicReplacement(S.relicCandidate); else renderRelicChoices();
    }
  }
});
addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
ui.relicScreen.addEventListener('pointerdown', event => {
  AudioEngine.resume();
  if (S?.relicAwaitDismiss) { event.preventDefault(); dismissRelicResult(); }
});
canvas.addEventListener('pointerdown', event => {
  AudioEngine.resume(); if (!running || S?.paused) return;
  if (event.pointerType === 'mouse') { updateMouseAim(event); return; }
  joy = { on: true, id: event.pointerId, sx: event.clientX, sy: event.clientY, x: 0, y: 0 }; canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (event.pointerType === 'mouse') { updateMouseAim(event); return; }
  if (!joy.on || event.pointerId !== joy.id) return;
  const dx = event.clientX - joy.sx, dy = event.clientY - joy.sy, length = Math.hypot(dx, dy);
  joy.x = dx / Math.max(length, 64); joy.y = dy / Math.max(length, 64);
});
canvas.addEventListener('pointerup', () => { joy.on = false; joy.x = joy.y = 0; });
canvas.addEventListener('pointercancel', () => { joy.on = false; joy.x = joy.y = 0; });
canvas.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') updateMouseAim(event); });
canvas.addEventListener('pointerleave', event => {
  if (event.pointerType === 'mouse') { mouseAim.inside = false; mouseAim.valid = false; }
});
addEventListener('blur', () => { mouseAim.inside = false; mouseAim.valid = false; });

function updateMouseAim(event) {
  const rect = canvas.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2), dy = event.clientY - (rect.top + rect.height / 2);
  const length = Math.hypot(dx, dy); mouseAim.inside = true; mouseAim.moved = true;
  if (length < 12) { mouseAim.valid = false; return; }
  mouseAim.x = dx / length; mouseAim.y = dy / length; mouseAim.valid = true;
}

function hasMouseAim() { return mouseAim.inside && mouseAim.valid && mouseAim.moved && !joy.on; }

function toggleSound() { AudioEngine.toggle(); updateSoundUi(); }
ui.menuButton.onclick = openGameMenu; ui.menuResume.onclick = closeGameMenu; ui.menuSound.onclick = toggleSound; ui.menuHitbox.onclick = toggleHitbox; ui.menuQuit.onclick = abandonRun;
ui.startLanguage.onchange = event => chooseLanguage(event.target.value); ui.menuLanguage.onchange = event => chooseLanguage(event.target.value);
$('#startButton').onclick = begin; $('#retry').onclick = begin; $('#mainMenu').onclick = returnToMain;
ui.codexButton.onclick = openCodex; ui.codexClose.onclick = closeCodex;
ui.rankDetailClose.onclick = closeRankDetail;
ui.relicTrayToggle.onclick = () => toggleRelicTray();
document.querySelectorAll('[data-codex]').forEach(button => button.onclick = () => renderCodex(button.dataset.codex));

function difficultyScale() {
  const time = S.time;
  const lateGame = time <= 600 ? 1 : Math.pow(1 + (time - 600) / 480, 1.18);
  return (1 + time / 170 + Math.pow(time / 420, 1.35)) * lateGame * (1 + S.bossFailures * .1);
}

function edgeSpawnDistance(W, H, angle, padding = 76) {
  const horizontal = (W / 2 + padding) / Math.max(.08, Math.abs(Math.cos(angle)));
  const vertical = (H / 2 + padding) / Math.max(.08, Math.abs(Math.sin(angle)));
  return Math.min(horizontal, vertical);
}

function enemyDamageScale() { return 1 + S.time / 145 + Math.floor(S.time / 300) * .55 + Math.pow(S.time / 900, 1.2) + S.bossFailures * .15; }

function diminishingMultiplier(value) {
  const compressed = value <= 3 ? value : 3 + Math.log2(value / 3) * 1.5;
  const blend = clamp((S.time - 180) / 420, 0, 1);
  return value + (compressed - value) * blend;
}

function bossPatternDamage(flatDamage) {
  const healthRatio = .04 + Math.min(.16, S.time / 10500);
  return Math.max(flatDamage, S.maxHp * healthRatio);
}

function chooseArchetype() {
  const roll = Math.random(), time = S.time;
  const gunner = time > 45 ? Math.min(.2, (time - 45) / 500) : 0;
  const charger = time > 150 ? Math.min(.16, (time - 150) / 550) : 0;
  const warder = time > 270 ? Math.min(S.saberLevel ? .14 : .1, (time - 270) / 550) : 0;
  const bomber = time > 390 ? Math.min(.11, (time - 390) / 550) : 0;
  const splitter = time > 480 ? Math.min(.11, (time - 480) / 700) : 0;
  if (roll < gunner) return 'gunner';
  if (roll < gunner + charger) return 'charger';
  if (roll < gunner + charger + warder) return 'warder';
  if (roll < gunner + charger + warder + bomber) return 'bomber';
  if (roll < gunner + charger + warder + bomber + splitter) return 'splitter';
  return 'stalker';
}

function spawnEnemy(W, H, options = {}) {
  if (S.mobs.length >= 210) return;
  const cap = Math.min(190, 78 + Math.floor(S.time * .15));
  if (!options.ignoreCap) {
    let mobCount = 0;
    for (const mob of S.mobs) { if (mob.kind === 'mob') mobCount++; if (mobCount >= cap) break; }
    if (mobCount >= cap) return;
  }
  const angle = options.angle ?? Math.random() * TAU, distance = options.distance ?? edgeSpawnDistance(W, H, angle, random(90, 150));
  const eliteChance = clamp((S.time - 20) / 620, 0, .48), elite = options.elite ?? Math.random() < eliteChance;
  const scale = difficultyScale(), baseHp = Math.max(2, 3.2 * scale), archetype = options.archetype || chooseArchetype();
  const archetypeHp = { stalker: 1, gunner: 1.25, charger: 1.45, splitter: 1.6, bomber: 1.08, warder: 1.35 }[archetype];
  const hp = Math.ceil(baseHp * archetypeHp * (elite ? 2.8 : 1) * (options.child ? .42 : 1));
  const archetypeSpeed = archetype === 'warder' ? .82 : archetype === 'bomber' ? 1.52 + Math.min(.48, S.time / 2500) : 1;
  const baseSpeed = Math.min(150, 61 + S.time * .075) * (options.child ? 1.18 : 1) * archetypeSpeed;
  S.mobs.push({
    kind: 'mob', archetype, x: options.x ?? S.x + Math.cos(angle) * distance,
    y: options.y ?? S.y + Math.sin(angle) * distance, r: options.child ? 13 : elite ? 28 : 18 + Math.random() * 5,
    hp, maxHp: hp, shield: archetype === 'warder' ? Math.ceil(hp * .75) : 0, maxShield: archetype === 'warder' ? Math.ceil(hp * .75) : 0,
    speed: baseSpeed * (elite && archetype !== 'bomber' ? .86 : 1), damage: enemyDamageScale() * .52 + (elite ? .75 : 0),
    elite, child: Boolean(options.child), slow: 0, frozen: 0, phase: Math.random() * 2 | 0,
    id: Math.random(), age: 0, state: 'move', stateClock: random(2.4, 4.5), shootClock: random(1.4, 3.4),
    specialClock: random(2.8, 5.2), vx: 0, vy: 0, facing: 1, hitFlash: 0,
  });
}

function spawnTreasure(W, H) {
  if (S.mobs.some(mob => mob.kind === 'treasure')) return;
  const angle = Math.random() * TAU, distance = edgeSpawnDistance(W, H, angle, 125);
  const hp = Math.ceil(13 * difficultyScale() * (1 + S.treasureNumber * .13));
  S.mobs.push({
    kind: 'treasure', x: S.x + Math.cos(angle) * distance, y: S.y + Math.sin(angle) * distance,
    r: 50, hp, maxHp: hp, speed: Math.min(245, 142 + S.time * .055), damage: 0,
    elite: true, slow: 0, frozen: 0, phase: Math.random() * 2 | 0, id: Math.random(), age: 0,
    stateClock: 0, shootClock: 0, specialClock: 0, facing: 1, hitFlash: 0,
  });
  S.treasureNumber++; S.nextTreasureAt = Infinity;
  AudioEngine.se('treasure'); showWarning('JACKPOT SIGNAL // 유물 운반체');
}

const ALLY_CAP = 3, ALLY_TAME_CHANCE_CAP = .65, ALLY_AGGRO_RANGE = 420;
function allyTameChance() { return clamp(S.allyTameChance || 0, 0, ALLY_TAME_CHANCE_CAP); }
function spawnAlly(bossMob) {
  const scale = difficultyScale(), maxHp = Math.max(24, Math.round(bossMob.maxHp * .11));
  S.allies.push({
    kind: 'ally', bossType: bossMob.bossType, tier: bossMob.tier, id: Math.random(),
    x: bossMob.x, y: bossMob.y, r: bossMob.tier === 3 ? 40 : 32,
    hp: maxHp, maxHp, speed: 148 + scale * 4, damage: Math.max(2.4, enemyDamageScale() * 1.6),
    facing: 1, hitFlash: 0, attackClock: 0, inv: 0, age: 0, dead: false,
  });
  showToast('👑 보스를 길들였습니다!'); effect('ring', bossMob.x, bossMob.y, { life: .7, max: .7, radius: 80, color: '#7dffb0' }); burst(bossMob.x, bossMob.y, '#7dffb0', 16, 200);
}

function hurtAlly(ally, amount) {
  if (ally.dead || ally.inv > 0) return;
  ally.hp -= amount; ally.inv = .4; ally.hitFlash = .12;
  if (ally.hp <= 0) {
    ally.dead = true; effect('death', ally.x, ally.y, { life: .5, max: .5, color: '#7dffb0' });
    burst(ally.x, ally.y, '#7dffb0', 10, 180); showToast('동료를 잃었습니다');
  }
}

function updateAlly(ally, dt) {
  ally.age += dt; ally.hitFlash -= dt; ally.attackClock -= dt; ally.inv -= dt;
  let target = null, bestDistSq = ALLY_AGGRO_RANGE * ALLY_AGGRO_RANGE;
  for (const mob of nearbyMobs(ally.x, ally.y, ALLY_AGGRO_RANGE)) {
    if (mob.dead || mob.hp <= 0 || mob.kind !== 'mob') continue;
    const distSq = (mob.x - ally.x) ** 2 + (mob.y - ally.y) ** 2;
    if (distSq < bestDistSq) { bestDistSq = distSq; target = mob; }
  }
  if (target) {
    const dx = target.x - ally.x, dy = target.y - ally.y, distance = Math.hypot(dx, dy) || 1;
    ally.facing = dx < 0 ? -1 : 1;
    if (distance > ally.r + target.r + 14) { ally.x += dx / distance * ally.speed * dt; ally.y += dy / distance * ally.speed * dt; }
    else if (ally.attackClock <= 0) {
      damageMob(target, ally.damage, 'projectile', false, true);
      effect('hit', target.x, target.y, { life: .2, max: .2, kind: 'projectile' });
      ally.attackClock = .55;
    }
  } else {
    const dx = S.x - ally.x, dy = S.y - ally.y, distance = Math.hypot(dx, dy) || 1;
    if (distance > 90) { const followSpeed = Math.min(ally.speed * 1.3, distance * 3); ally.x += dx / distance * followSpeed * dt; ally.y += dy / distance * followSpeed * dt; ally.facing = dx < 0 ? -1 : 1; }
  }
  if (Math.hypot(S.x - ally.x, S.y - ally.y) > 1600) { ally.x = S.x - 70 + random(-40, 40); ally.y = S.y + 70 + random(-40, 40); }
}

const INTERIOR_ARENA_RADIUS = 480, INTERIOR_TIME_LIMIT = 60;

function hasLeviathan() { return S.mobs.some(mob => mob.kind === 'leviathan' && !mob.dead); }

function spawnLeviathan(W, H) {
  const angle = Math.random() * TAU, distance = edgeSpawnDistance(W, H, angle, 260);
  const scale = difficultyScale(), hp = Math.round(2600 * scale * (1 + S.time / 1200));
  S.mobs.push({
    kind: 'leviathan', x: S.x + Math.cos(angle) * distance, y: S.y + Math.sin(angle) * distance,
    r: 130, hp, maxHp: hp, damage: Math.max(10, enemyDamageScale() * 2.4),
    speed: 96, state: 'cruise', stateClock: random(2.5, 4), killClock: 0, digestCooldown: 0,
    facing: 1, hitFlash: 0, frozen: 0, slow: 0, id: Math.random(), age: 0, vx: 0, vy: 0, dead: false,
  });
  showWarning('⚠ 리바이어던 출현 · 개체 밀도 초과'); AudioEngine.se('boss'); S.shake = Math.max(S.shake, 10);
}

function updateLeviathan(mob, dt) {
  mob.age += dt; mob.hitFlash -= dt; mob.stateClock -= dt; mob.killClock -= dt; mob.frozen -= dt; mob.slow -= dt; mob.digestCooldown -= dt;
  const dx = S.x - mob.x, dy = S.y - mob.y, distance = Math.hypot(dx, dy) || 1, angle = Math.atan2(dy, dx);
  mob.facing = dx < 0 ? -1 : 1;
  const movementScale = mob.frozen > 0 ? .3 : mob.slow > 0 ? .72 : 1;
  if (mob.state === 'dash') {
    mob.x += mob.vx * dt * movementScale; mob.y += mob.vy * dt * movementScale;
    if (mob.stateClock <= 0) { mob.state = 'cruise'; mob.stateClock = random(2.6, 4.2); }
  } else if (mob.state === 'telegraph') {
    if (mob.stateClock <= 0) { mob.state = 'dash'; mob.stateClock = .85; mob.vx = Math.cos(mob.castAngle) * 640; mob.vy = Math.sin(mob.castAngle) * 640; }
  } else {
    mob.x += dx / distance * mob.speed * dt * movementScale; mob.y += dy / distance * mob.speed * dt * movementScale;
    if (mob.stateClock <= 0) {
      mob.state = 'telegraph'; mob.stateClock = .68; mob.castAngle = angle;
      S.hazards.push({ x: mob.x, y: mob.y, tx: mob.x + Math.cos(angle) * 720, ty: mob.y + Math.sin(angle) * 720, r: mob.r, warmup: .68, life: .7, type: 'line', damage: 0, telegraphOnly: true });
    }
  }
  if (mob.killClock <= 0) {
    mob.killClock = .4;
    let killed = 0;
    for (const near of nearbyMobs(mob.x, mob.y, mob.r + 46)) {
      if (killed >= 3) break;
      if (near.kind !== 'mob' || near.dead || near.hp <= 0) continue;
      near.hp = 0; killed++;
    }
    if (killed) effect('ring', mob.x, mob.y, { life: .3, max: .3, radius: mob.r + 40, color: '#7dffb0' });
  }
  if (S.allies.length) for (const ally of S.allies) if (!ally.dead && Math.hypot(ally.x - mob.x, ally.y - mob.y) < mob.r + ally.r) hurtAlly(ally, mob.damage);
  if (!S.interior?.active && mob.digestCooldown <= 0 && Math.hypot(S.x - mob.x, S.y - mob.y) < mob.r + PLAYER_HIT_RADIUS + 8) enterInterior(mob);
}

function handleLeviathanDeath(mob) {
  mob.dead = true; effect('death', mob.x, mob.y, { life: .7, max: .7, color: '#39d97a' });
  burst(mob.x, mob.y, '#39d97a', 30, 280); AudioEngine.se('kill'); S.shake = Math.max(S.shake, 14);
  S.kills += 60; S.xp += S.nextXp * 1.6; healPlayer(10);
  if (Math.random() < .82) { dropChest(mob.x, mob.y, 'boss', 3, true); showToast('LEVIATHAN DOWN · RELIC DROP'); }
  else showToast('LEVIATHAN DOWN · NO RELIC');
  if (S.allies.length < ALLY_CAP && Math.random() < allyTameChance()) spawnAlly({ bossType: 'dragon', tier: 3, maxHp: mob.maxHp, x: mob.x, y: mob.y });
}

function spawnInteriorHost() {
  const scale = difficultyScale(), hp = Math.round(1400 * scale * (1 + S.time / 1400));
  const boss = {
    kind: 'boss', bossType: 'dragon', tier: 3, number: 0, cycle: 0, modifier: 'armored', affixes: ['hunter'],
    x: 0, y: -260, r: 62, hp, maxHp: hp,
    speed: 66, damage: Math.max(3, enemyDamageScale() * .9), elite: true, slow: 0, frozen: 0, phase: 0,
    id: Math.random(), age: 0, timeLimit: 999, deadline: S.time + 999, deadlineWarned: true,
    patternClock: 1.4, specialClock: 4, affixClock: 5, eventClock: 7, eventIndex: 0, phaseIndex: 0, phaseInv: 0,
    forceFieldPattern: false, state: 'move', stateClock: 0, vx: 0, vy: 0, facing: 1, hitFlash: 0, isInteriorHost: true,
  };
  S.mobs.push(boss); return boss;
}

function spawnInteriorRelicMob() {
  const hp = Math.ceil(18 * difficultyScale());
  S.mobs.push({
    kind: 'mob', archetype: 'warder', interiorRelic: true, x: random(-260, 260), y: random(-260, 260),
    r: 30, hp, maxHp: hp, shield: Math.ceil(hp * .6), maxShield: Math.ceil(hp * .6),
    speed: 70, damage: Math.max(2, enemyDamageScale() * .6), elite: true, slow: 0, frozen: 0,
    phase: Math.random() * 2 | 0, id: Math.random(), age: 0, state: 'move', stateClock: random(2.4, 4.5),
    shootClock: random(1.4, 3.4), specialClock: random(2.8, 5.2), vx: 0, vy: 0, facing: 1, hitFlash: 0,
  });
}

function enterInterior(leviathanMob) {
  if (S.interior?.active) return;
  S.worldSnapshot = { mobs: S.mobs, allies: S.allies, enemyShots: S.enemyShots, hazards: S.hazards, gems: S.gems, x: S.x, y: S.y, bossActive: S.bossActive };
  S.mobs = []; S.allies = []; S.enemyShots = []; S.hazards = []; S.gems = [];
  S.x = 0; S.y = 0;
  const hostBoss = spawnInteriorHost();
  S.bossActive = hostBoss; S.bossWarned = false;
  for (let i = 0; i < 14; i++) spawnEnemy(900, 700, { angle: Math.random() * TAU, distance: random(220, 420), ignoreCap: true });
  spawnInteriorRelicMob();
  S.interior = { active: true, timer: INTERIOR_TIME_LIMIT, exiting: false, exitClock: 0 };
  rebuildMobGrid();
  S.inv = 1.2; showWarning('⚠ 삼켜졌다 · 60초 안에 숙주를 처치하라'); AudioEngine.se('boss'); S.shake = Math.max(S.shake, 16);
  effect('ring', S.x, S.y, { life: 1, max: 1, radius: 260, color: '#7dffb0' });
}

function beginInteriorExit() {
  if (!S.interior || S.interior.exiting) return;
  S.interior.exiting = true; S.interior.exitClock = 2.2;
  showWarning('⚠ 숙주 처치 · 탈출 경로 확보'); AudioEngine.se('wave'); S.shake = Math.max(S.shake, 12);
  effect('ring', S.x, S.y, { life: 1.6, max: 1.6, radius: 320, color: '#39d97a' });
  for (let i = 0; i < 40; i++) S.particles.push({ x: S.x + random(-260, 260), y: S.y - random(200, 400), vx: random(-10, 10), vy: random(220, 340), size: random(4, 9), color: '#39d97a', life: random(1.2, 2.4), max: 2.4 });
}

function exitInterior() {
  const snap = S.worldSnapshot; if (!snap) { S.interior = null; return; }
  S.mobs = snap.mobs; S.allies = snap.allies; S.enemyShots = snap.enemyShots; S.hazards = snap.hazards; S.gems = snap.gems;
  S.x = snap.x; S.y = snap.y; S.bossActive = snap.bossActive;
  S.worldSnapshot = null; S.interior = null;
  const leviathan = S.mobs.find(m => m.kind === 'leviathan' && !m.dead);
  if (leviathan) {
    leviathan.digestCooldown = 5;
    const angle = Math.random() * TAU;
    leviathan.x = S.x + Math.cos(angle) * 320; leviathan.y = S.y + Math.sin(angle) * 320;
  }
  rebuildMobGrid();
  showToast('🌧 탈출 성공'); AudioEngine.se('relic'); S.inv = 1.4;
  effect('ring', S.x, S.y, { life: .8, max: .8, radius: 200, color: '#39d97a' });
}

function bossAffixes(number) {
  const all = ['overclock', 'minefield', 'echo', 'hunter'];
  if (number <= 4) return [all[number - 1]];
  return [...all].sort(() => Math.random() - .5).slice(0, number >= 7 ? 2 : 1);
}

function spawnBoss(W, H) {
  const number = S.bossIndex + 1, tier = (S.bossIndex % 3) + 1, cycle = Math.floor(S.bossIndex / 3);
  const types = tier === 3 ? ['witch', 'dragon'] : ['oni', 'seraph'];
  const type = types[Math.floor(Math.random() * types.length)], angle = Math.random() * TAU, distance = edgeSpawnDistance(W, H, angle, 145);
  const modifier = ['swift', 'armored', 'unstable'][Math.random() * 3 | 0];
  const base = [0, 170, 440, 1050][tier];
  const lateBoss = S.time <= 600 ? 1 : Math.pow(1 + (S.time - 600) / 600, .9);
  const hp = Math.round(base * Math.pow(1.42, cycle) * (1 + S.time / 900) * lateBoss * (modifier === 'armored' ? 1.25 : 1));
  const timeLimit = Math.max(30, [0, 45, 52, 60][tier] - cycle * 2);
  const boss = {
    kind: 'boss', bossType: type, tier, number, cycle, modifier, affixes: bossAffixes(number),
    x: S.x + Math.cos(angle) * distance, y: S.y + Math.sin(angle) * distance,
    r: tier === 3 ? 62 : 46, hp, maxHp: hp,
    speed: (tier === 3 ? 51 : 58) * (modifier === 'swift' ? 1.18 : 1) * Math.min(1.35, 1 + cycle * .05),
    damage: Math.max(2 + Math.floor(number / 2), enemyDamageScale() * .75), elite: true, slow: 0, frozen: 0, phase: 0,
    id: Math.random(), age: 0, timeLimit, deadline: S.time + timeLimit, deadlineWarned: false, patternClock: 1.15, specialClock: 3.8, affixClock: 4.5,
    eventClock: Math.max(6.5, 10.5 - cycle * .35), eventIndex: Math.floor(Math.random() * 2), phaseIndex: 0, phaseInv: 0, forceFieldPattern: false,
    state: 'move', stateClock: 0, vx: 0, vy: 0, facing: 1, hitFlash: 0,
  };
  S.mobs.push(boss); S.bossActive = boss; S.bossIndex++; S.bossWarned = false; S.nextBossAt = Infinity;
  AudioEngine.se('boss'); showWarning(tier === 3 ? `RIFT LORD #${number}` : `ANOMALY BOSS #${number}`); ui.bossHud.classList.remove('hidden');
}

function handleBossTimeout(W, H) {
  const boss = S.bossActive; if (!boss || boss.hp <= 0) return;
  boss.dead = true; boss.escaped = true; S.bossActive = null; S.bossFailures++; clearBossPatterns(boss.id);
  S.nextBossAt = S.time + random(42, 52); S.bossWarned = false; ui.bossHud.classList.add('hidden');
  for (let i = 0; i < 6; i++) spawnEnemy(W, H, { elite: true, ignoreCap: true });
  effect('ring', S.x, S.y, { life: .9, max: .9, radius: 210, color: '#ff356d' }); burst(S.x, S.y, '#ff356d', 22, 260);
  showWarning('TIME OVER · RIFT OVERLOAD'); AudioEngine.se('wave'); S.shake = 16;
  hurtPlayer(Math.max(8, S.maxHp * .18), true);
}

function enemyBullet(x, y, angle, speed = 230, radius = 7, damage = enemyDamageScale(), ownerBossId = null) {
  if (S.enemyShots.length >= 440) return;
  const bossPattern = Boolean(ownerBossId);
  S.enemyShots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: radius, damage: bossPattern ? bossPatternDamage(damage) : damage, life: 7, bossPattern, ownerBossId, orbitGuardChecked: false });
}

function radial(mob, count, speed, offset = S.time * .7) {
  const bulletSpeed = speed * Math.min(2.15, 1 + (mob.number || 0) * .052);
  for (let i = 0; i < count; i++) enemyBullet(mob.x, mob.y, offset + i * TAU / count, bulletSpeed, mob.tier === 3 ? 9 : 7, mob.damage || enemyDamageScale(), mob.kind === 'boss' ? mob.id : null);
}

function clearBossPatterns(ownerBossId) {
  S.enemyShots = S.enemyShots.filter(projectile => projectile.ownerBossId !== ownerBossId);
  S.hazards = S.hazards.filter(hazard => hazard.ownerBossId !== ownerBossId);
}

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, lengthSq = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function spawnBossAirstrike(boss, x, y, { r = 54, warmup = 1, life = 2, damage = boss?.damage || 1 } = {}) {
  const startWarmup = warmup;
  S.hazards.push({
    x, y, r, warmup, startWarmup, life, type: 'circle', damage,
    airstrike: true, impactShown: false, missileDrift: random(-34, 34),
    bossPattern: true, ownerBossId: boss?.id,
  });
}

const MOB_CELL_SIZE = 160;
function mobCellKey(x, y) { return `${x},${y}`; }
function rebuildMobGrid() {
  S.mobGrid.clear();
  for (const mob of S.mobs) {
    if (mob.dead || mob.hp <= 0) continue;
    const cellX = Math.floor(mob.x / MOB_CELL_SIZE), cellY = Math.floor(mob.y / MOB_CELL_SIZE), key = mobCellKey(cellX, cellY);
    const bucket = S.mobGrid.get(key); if (bucket) bucket.push(mob); else S.mobGrid.set(key, [mob]);
  }
}
function nearbyMobs(x, y, radius) {
  const out = [], minX = Math.floor((x - radius) / MOB_CELL_SIZE), maxX = Math.floor((x + radius) / MOB_CELL_SIZE);
  const minY = Math.floor((y - radius) / MOB_CELL_SIZE), maxY = Math.floor((y + radius) / MOB_CELL_SIZE);
  for (let cellX = minX; cellX <= maxX; cellX++) for (let cellY = minY; cellY <= maxY; cellY++) {
    const bucket = S.mobGrid.get(mobCellKey(cellX, cellY)); if (bucket) out.push(...bucket);
  }
  return out;
}

function nearestMobs(x, y, radius, limit, excluded) {
  const nearest = [], radiusSq = radius * radius;
  for (const mob of nearbyMobs(x, y, radius + 10)) {
    if (mob === excluded || mob.dead || mob.hp <= 0) continue;
    const dx = mob.x - x, dy = mob.y - y, distanceSq = dx * dx + dy * dy;
    if (distanceSq >= radiusSq) continue;
    let index = nearest.length;
    while (index > 0 && distanceSq < nearest[index - 1].distanceSq) index--;
    if (index >= limit) continue;
    nearest.splice(index, 0, { mob, distanceSq });
    if (nearest.length > limit) nearest.pop();
  }
  return nearest.map(entry => entry.mob);
}

function angleDelta(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }

function updateBoss(mob, dt) {
  mob.age += dt; mob.patternClock -= dt; mob.specialClock -= dt; mob.affixClock -= dt; mob.stateClock -= dt;
  mob.eventClock -= dt; mob.phaseInv -= dt; mob.patternLock = Math.max(0, (mob.patternLock || 0) - dt);
  mob.hitFlash -= dt; mob.frozen -= dt; mob.slow -= dt;
  mob.stunned = (mob.stunned || 0) - dt; mob.shocked = (mob.shocked || 0) - dt;
  if (mob.shocked > 0 && Math.random() < dt * 2) damageMob(mob, S.damage * .15, 'projectile', false, true, false);
  const dx = S.x - mob.x, dy = S.y - mob.y, distance = Math.hypot(dx, dy) || 1, angle = Math.atan2(dy, dx);
  mob.facing = dx < 0 ? -1 : 1;
  const rageThreshold = Math.min(.75, .5 + mob.number * .025), rage = mob.hp < mob.maxHp * rageThreshold;
  const cadence = Math.max(.48, Math.pow(.965, mob.number - 1)) * (mob.affixes.includes('overclock') ? .78 : 1) * (mob.modifier === 'unstable' ? .85 : 1);
  const movementScale = mob.stunned > 0 ? 0 : mob.frozen > 0 ? .25 : mob.slow > 0 ? .72 : 1;

  if (mob.phaseInv > 0) return;
  if (mob.forceFieldPattern || (mob.eventClock <= 0 && mob.patternLock <= 0)) {
    triggerBossFieldPattern(mob); mob.forceFieldPattern = false;
  }

  if (mob.bossType === 'oni') {
    if (mob.state === 'dash') {
      mob.x += mob.vx * dt * movementScale; mob.y += mob.vy * dt * movementScale;
      if (mob.stateClock <= 0) mob.state = 'move';
    } else if (mob.state === 'telegraph') {
      if (mob.stateClock <= 0) { mob.state = 'dash'; mob.stateClock = mob.dashDuration; mob.vx = Math.cos(mob.castAngle) * mob.dashSpeed; mob.vy = Math.sin(mob.castAngle) * mob.dashSpeed; }
    } else {
      mob.x += dx / distance * mob.speed * .58 * dt * movementScale; mob.y += dy / distance * mob.speed * .58 * dt * movementScale;
      if (mob.patternClock <= 0 && mob.patternLock <= 0) {
        mob.state = 'telegraph'; mob.stateClock = .78; mob.castAngle = angle; mob.dashDuration = .5; mob.dashSpeed = rage ? 790 : 680; mob.patternClock = (rage ? 2.25 : 3.05) * cadence;
        const dashRange = mob.dashSpeed * mob.dashDuration;
        S.hazards.push({ x: mob.x, y: mob.y, tx: mob.x + Math.cos(mob.castAngle) * dashRange, ty: mob.y + Math.sin(mob.castAngle) * dashRange, r: mob.r, warmup: .78, life: .8, type: 'line', damage: 0, telegraphOnly: true, bossPattern: true, ownerBossId: mob.id });
      }
    }
  } else if (mob.bossType === 'seraph') {
    const desired = 310, direction = distance > desired + 35 ? 1 : distance < desired - 35 ? -1 : 0;
    mob.x += dx / distance * mob.speed * direction * dt * movementScale; mob.y += dy / distance * mob.speed * direction * dt * movementScale;
    if (mob.patternClock <= 0 && mob.patternLock <= 0) { radial(mob, rage ? 16 : 11, rage ? 320 : 260); mob.patternClock = (rage ? 1.6 : 2.3) * cadence; }
    if (mob.specialClock <= 0 && mob.patternLock <= 0) {
      for (let i = -2; i <= 2; i++) enemyBullet(mob.x, mob.y, angle + i * .11, 370, 8, mob.damage, mob.id);
      mob.specialClock = 4.2 * cadence;
    }
  } else if (mob.bossType === 'witch') {
    const tangent = angle + Math.PI / 2;
    mob.x += (Math.cos(angle) * (distance > 340 ? 38 : -18) + Math.cos(tangent) * 58) * dt * movementScale;
    mob.y += (Math.sin(angle) * (distance > 340 ? 38 : -18) + Math.sin(tangent) * 58) * dt * movementScale;
    if (mob.patternClock <= 0 && mob.patternLock <= 0) {
      for (let i = 0; i < (rage ? 6 : 4); i++) spawnBossAirstrike(mob, S.x + random(-280, 280), S.y + random(-210, 210), { r: 58, warmup: 1.02, life: 2.1, damage: bossPatternDamage(mob.damage + 1) });
      mob.patternClock = (rage ? 2.9 : 4) * cadence;
    }
    if (mob.specialClock <= 0 && mob.patternLock <= 0) { radial(mob, 14 + Math.min(8, Math.floor(mob.number / 2)), 235); mob.specialClock = 5.2 * cadence; }
  } else {
    mob.x += dx / distance * mob.speed * .72 * dt * movementScale; mob.y += dy / distance * mob.speed * .72 * dt * movementScale;
    if (mob.patternClock <= 0 && mob.patternLock <= 0) {
      const fan = Math.min(5, 3 + Math.floor(mob.number / 3));
      for (let i = -fan; i <= fan; i++) enemyBullet(mob.x, mob.y, angle + i * .12, rage ? 425 : 355, 9, mob.damage, mob.id);
      mob.patternClock = (rage ? 1.35 : 2.05) * cadence;
    }
    if (mob.specialClock <= 0 && mob.patternLock <= 0) { radial(mob, 18 + Math.min(8, mob.cycle * 2), 255); mob.specialClock = 4.8 * cadence; }
  }

  if (mob.affixClock <= 0 && mob.patternLock <= 0) {
    if (mob.affixes.includes('minefield')) for (let i = 0; i < 3 + Math.min(3, mob.cycle); i++) spawnBossAirstrike(mob, S.x + random(-230, 230), S.y + random(-170, 170), { r: 52, warmup: .92, life: 1.9, damage: bossPatternDamage(mob.damage) });
    if (mob.affixes.includes('echo')) radial(mob, 10 + Math.min(8, mob.cycle * 2), 245, S.time * .8 + .17);
    if (mob.affixes.includes('hunter')) for (let i = -1; i <= 1; i++) enemyBullet(mob.x, mob.y, angle + i * .16, 440, 8, mob.damage, mob.id);
    mob.affixClock = Math.max(3.4, 6.2 - mob.cycle * .25);
  }
  if (mob.state === 'dash') mob.facing = mob.vx < 0 ? -1 : 1;
  if (Math.hypot(S.x - mob.x, S.y - mob.y) < mob.r + PLAYER_HIT_RADIUS) hurtPlayer(mob.damage);
  if (S.allies.length) for (const ally of S.allies) if (!ally.dead && Math.hypot(ally.x - mob.x, ally.y - mob.y) < mob.r + ally.r) hurtAlly(ally, mob.damage);
}

function spawnBomberFuse(mob) {
  if (mob.bombFuseSpawned) return false;
  mob.bombFuseSpawned = true;
  const fuseDuration = Math.max(.82, 1.15 - Math.min(.25, S.time / 7200));
  S.hazards.push({
    type: 'bombFuse', x: mob.x, y: mob.y, r: 126, warmup: fuseDuration, startWarmup: fuseDuration,
    life: fuseDuration + .28, damage: mob.damage * 2.35, detonated: false, hit: false,
    phase: mob.phase || 0, facing: mob.facing || 1, sourceRadius: mob.r,
  });
  AudioEngine.se('boss');
  return true;
}

function updateMob(mob, dt) {
  mob.age += dt; mob.hitFlash -= dt; mob.slow -= dt; mob.frozen -= dt; mob.stateClock -= dt; mob.shootClock -= dt; mob.specialClock -= dt;
  mob.stunned = (mob.stunned || 0) - dt; mob.shocked = (mob.shocked || 0) - dt;
  if (mob.shocked > 0 && Math.random() < dt * 2) damageMob(mob, S.damage * .15, 'projectile', false, true, false);
  const dx = S.x - mob.x, dy = S.y - mob.y, distance = Math.hypot(dx, dy) || 1, angle = Math.atan2(dy, dx);
  mob.facing = dx < 0 ? -1 : 1;
  if (mob.kind === 'treasure') {
    const flee = distance < 590 ? -1 : distance > 760 ? .35 : 0, tangent = Math.sin(S.time * .9 + mob.id * 9) > 0 ? 1 : -1;
    const vx = dx / distance * mob.speed * flee + Math.cos(angle + Math.PI / 2) * mob.speed * .48 * tangent;
    const vy = dy / distance * mob.speed * flee + Math.sin(angle + Math.PI / 2) * mob.speed * .48 * tangent;
    mob.x += vx * dt; mob.y += vy * dt; mob.facing = vx < 0 ? -1 : 1;
    if (mob.age > 20) { mob.dead = true; mob.escaped = true; showToast('JACKPOT SIGNAL LOST'); S.nextTreasureAt = S.time + random(42, 60) * S.treasureRateMult; }
    return;
  }

  const gravityLevel = relicLevel('gravity_halo');
  const auraSlow = gravityLevel && distance < 260 + gravityLevel * 12 ? Math.max(.48, .82 - gravityLevel * .06) : 1;
  const movementScale = (mob.stunned > 0 ? 0 : mob.frozen > 0 ? .12 : mob.slow > 0 ? .72 : 1) * auraSlow;
  if (mob.archetype === 'bomber') {
    mob.x += dx / distance * mob.speed * dt * movementScale; mob.y += dy / distance * mob.speed * dt * movementScale;
    if (Math.hypot(S.x - mob.x, S.y - mob.y) < mob.r + PLAYER_HIT_RADIUS) { spawnBomberFuse(mob); mob.hp = 0; return; }
  } else if (mob.archetype === 'gunner') {
    const desired = 275, direction = distance > desired + 35 ? 1 : distance < desired - 35 ? -1 : 0;
    mob.x += dx / distance * mob.speed * direction * dt * movementScale; mob.y += dy / distance * mob.speed * direction * dt * movementScale;
    if (mob.shootClock <= 0) { enemyBullet(mob.x, mob.y, angle, 255 + Math.min(100, S.time * .06), 7, mob.damage); mob.shootClock = random(2.2, 3.5); }
  } else if (mob.archetype === 'charger') {
    if (mob.state === 'dash') {
      mob.x += mob.vx * dt * movementScale; mob.y += mob.vy * dt * movementScale;
      if (mob.stateClock <= 0) mob.state = 'move';
    } else if (mob.state === 'telegraph') {
      if (mob.stateClock <= 0) { mob.state = 'dash'; mob.stateClock = mob.dashDuration; mob.vx = Math.cos(mob.castAngle) * mob.dashSpeed; mob.vy = Math.sin(mob.castAngle) * mob.dashSpeed; }
    } else {
      mob.x += dx / distance * mob.speed * dt * movementScale; mob.y += dy / distance * mob.speed * dt * movementScale;
      if (mob.specialClock <= 0) {
        mob.state = 'telegraph'; mob.stateClock = .65; mob.castAngle = angle; mob.dashDuration = .42; mob.dashSpeed = 500; mob.specialClock = random(3.8, 5.2);
        const dashRange = mob.dashSpeed * mob.dashDuration;
        S.hazards.push({ x: mob.x, y: mob.y, tx: mob.x + Math.cos(mob.castAngle) * dashRange, ty: mob.y + Math.sin(mob.castAngle) * dashRange, r: mob.r, warmup: .65, life: .67, type: 'line', damage: 0, telegraphOnly: true });
      }
    }
  } else {
    mob.x += dx / distance * mob.speed * dt * movementScale; mob.y += dy / distance * mob.speed * dt * movementScale;
  }
  if (mob.state === 'dash') mob.facing = mob.vx < 0 ? -1 : 1;
  if (Math.hypot(S.x - mob.x, S.y - mob.y) < mob.r + PLAYER_HIT_RADIUS) hurtPlayer(mob.damage);
  if (S.allies.length) for (const ally of S.allies) if (!ally.dead && Math.hypot(ally.x - mob.x, ally.y - mob.y) < mob.r + ally.r) hurtAlly(ally, mob.damage);
}

function findTarget() {
  let target = null, best = Infinity;
  for (const mob of S.mobs) {
    if (mob.dead) continue;
    let distance = (mob.x - S.x) ** 2 + (mob.y - S.y) ** 2;
    if (mob.kind === 'boss' && distance < 560 ** 2) distance *= .42;
    if (mob.kind === 'treasure') distance *= .22;
    if (distance < best) { best = distance; target = mob; }
  }
  return target;
}

function onScreen(x, y, padding = 0) { return visibleWorld(x, y, innerWidth, innerHeight, padding); }

function findDenseArea() {
  let best = null, bestCount = -1;
  for (const mob of S.mobs) {
    if (mob.dead || mob.hp <= 0 || !onScreen(mob.x, mob.y)) continue;
    const count = nearbyMobs(mob.x, mob.y, 160).length;
    if (count > bestCount) { bestCount = count; best = mob; }
  }
  return best;
}

function createVolley(baseAngle, damageScale = 1, extra = 0) {
  const count = S.multishot + extra;
  const spread = .15;
  for (let i = 0; i < count; i++) {
    const offset = i - (count - 1) / 2, critical = Math.random() < S.crit;
    const angle = baseAngle + offset * spread;
    S.shots.push({
      x: S.x, y: S.y, vx: Math.cos(angle) * 610, vy: Math.sin(angle) * 610, life: 1.55,
      damage: S.damage * damageScale * (critical ? S.critMult : 1), pierce: S.pierce,
      critical, hit: new Set(), trailX: S.x, trailY: S.y,
    });
  }
}

function fire() {
  const target = findTarget(); if (!target) return;
  const base = Math.atan2(target.y - S.y, target.x - S.x); S.volleyCount++;
  if (!S.moving && !hasMouseAim()) { S.aimX = Math.cos(base); S.aimY = Math.sin(base); S.facing = Math.cos(base) < 0 ? -1 : 1; }
  const splitLevel = relicLevel('split_core');
  const extra = splitLevel && S.volleyCount % Math.max(2, 5 - splitLevel) === 0 ? 2 + Math.floor((splitLevel - 1) / 2) : 0;
  createVolley(base, 1, extra);
  const echoLevel = relicLevel('echo_chamber');
  if (echoLevel && S.volleyCount % Math.max(3, 7 - echoLevel) === 0) S.delayedVolleys.push({ due: S.time + .12, angle: base, damage: Math.min(1, .65 + echoLevel * .1) });
  AudioEngine.se('fire');
}

function damageMob(mob, amount, kind = 'projectile', critical = false, alreadyScaled = false, emitHitFx = true, ignoreShield = false) {
  if (mob.dead || mob.hp <= 0) return 0;
  if (mob.kind === 'boss' && mob.phaseInv > 0) return 0;
  const typeMult = kind === 'saber' ? S.saberMult : kind === 'orbit' ? S.orbitMult : S.projectileMult;
  const frozenBonus = mob.frozen > 0 ? 1.25 : 1;
  let affinity = 1;
  if (mob.kind === 'boss' && mob.modifier === 'armored') affinity = kind === 'saber' ? 1.65 : kind === 'projectile' ? .62 : .88;
  if (mob.archetype === 'warder' && mob.shield > 0 && !ignoreShield) affinity = kind === 'saber' ? 2.4 : kind === 'projectile' ? .25 : .55;
  const shadowBossBonus = S.playerClass === 'shadowmaster' && mob.kind === 'boss' ? 1.3 : 1;
  const actual = (alreadyScaled ? amount : amount * diminishingMultiplier(S.damageMult) * diminishingMultiplier(typeMult) * frozenBonus * endlessPowerScale()) * affinity * shadowBossBonus;
  const hpBefore = mob.hp;
  if (mob.shield > 0 && !ignoreShield) {
    mob.shield -= actual;
    if (mob.shield <= 0) {
      mob.hp += Math.min(0, mob.shield); mob.shield = 0; mob.frozen = Math.max(mob.frozen, 1);
      effect('ring', mob.x, mob.y, { life: .38, max: .38, radius: 72, color: '#64f5ff' }); burst(mob.x, mob.y, '#64f5ff', 10, 170);
    }
  } else mob.hp -= actual;
  if (mob.kind === 'boss' && mob.hp > 0 && mob.phaseIndex < 3) {
    const threshold = [.75, .5, .25][mob.phaseIndex];
    if (hpBefore > mob.maxHp * threshold && mob.hp <= mob.maxHp * threshold) {
      mob.hp = Math.max(mob.hp, mob.maxHp * threshold); mob.phaseIndex++; mob.phaseInv = .65; mob.forceFieldPattern = true;
      effect('ring', mob.x, mob.y, { life: .7, max: .7, radius: mob.r + 68, color: '#ffd65a' });
      burst(mob.x, mob.y, '#ffd65a', 16, 210); AudioEngine.se('wave');
    }
  }
  mob.hitFlash = .08;
  const executionLevel = relicLevel('execution');
  if (executionLevel && mob.kind === 'mob' && mob.hp > 0 && mob.hp / mob.maxHp < Math.min(.35, .12 + executionLevel * .04)) mob.hp = 0;
  if (emitHitFx) effect('hit', mob.x, mob.y, { life: critical ? .28 : .2, max: critical ? .28 : .2, critical, kind });
  if (critical) burst(mob.x, mob.y, '#ff71ef', 5, 120);
  return actual;
}

function triggerChain(mob, dealt, kind = 'projectile') {
  if (S.chain <= 0) return;
  const thor = S.playerClass === 'thor';
  const nearby = nearestMobs(mob.x, mob.y, thor ? 240 : 210, S.chain, mob);
  nearby.forEach((near, index) => {
    const shieldBonus = thor && near.shield > 0 ? 1.5 : 1;
    damageMob(near, dealt * S.chainDamage * shieldBonus, kind, false, true, false);
    effect('chain', near.x, near.y, { life: .2, max: .2, fromX: index ? nearby[index - 1].x : mob.x, fromY: index ? nearby[index - 1].y : mob.y, thor });
  });
}

function hitMob(mob, projectile) {
  if (mob.hp <= 0 || projectile.hit.has(mob.id)) return;
  projectile.hit.add(mob.id);
  const dealt = damageMob(mob, projectile.damage, 'projectile', projectile.critical);
  AudioEngine.se('hit');
  if (S.blast > 0) {
    for (const near of nearbyMobs(mob.x, mob.y, S.blast + 70)) if (near !== mob && near.hp > 0 && Math.hypot(near.x - mob.x, near.y - mob.y) < S.blast) damageMob(near, dealt * S.blastDamage, 'projectile', false, true);
    effect('ring', mob.x, mob.y, { life: .26, max: .26, radius: S.blast, color: '#d757ff' });
  }
  triggerChain(mob, dealt, 'projectile');
  if (projectile.pierce > 0) projectile.pierce--; else projectile.life = 0;
}

function saberSlash() {
  if (!S.saberLevel) return;
  const candidates = nearbyMobs(S.x, S.y, S.saberRange + 90);
  let target = null, best = Infinity;
  for (const mob of candidates) {
    const distance = Math.hypot(mob.x - S.x, mob.y - S.y);
    if (mob.dead || distance > S.saberRange + mob.r) continue;
    const priority = mob.kind === 'treasure' ? .55 : mob.kind === 'boss' ? .72 : 1;
    if (distance * priority < best) { best = distance * priority; target = mob; }
  }
  const directedAim = hasMouseAim() || S.moving;
  const base = directedAim ? Math.atan2(S.aimY, S.aimX) : target ? Math.atan2(target.y - S.y, target.x - S.x) : Math.atan2(S.aimY, S.aimX);
  const dual = S.playerClass === 'shadowmaster';
  const sweeps = (dual ? 2 : 1) + S.saberEcho;
  const arcWidth = dual ? S.saberArc * .72 : S.saberArc;
  const sweepGap = dual ? .34 : .48;
  const damageMult = dual ? 1.35 : 1;
  for (let sweep = 0; sweep < sweeps; sweep++) {
    let angle;
    if (dual && sweep === 0) angle = base;
    else if (dual && sweep === 1) angle = base + Math.PI;
    else if (dual) angle = base + (sweep - 1) * sweepGap;
    else angle = base + (sweep - (sweeps - 1) / 2) * sweepGap;
    for (const mob of candidates) {
      const dx = mob.x - S.x, dy = mob.y - S.y, distance = Math.hypot(dx, dy);
      if (distance <= S.saberRange + mob.r && Math.abs(angleDelta(Math.atan2(dy, dx), angle)) <= arcWidth / 2) {
        const critical = Math.random() < S.crit;
        const dealt = damageMob(mob, S.damage * S.saberDamage * damageMult * (critical ? S.critMult : 1), 'saber', critical);
        if (S.playerClass === 'thor') triggerChain(mob, dealt, 'saber');
      }
    }
    effect('saber', S.x, S.y, { life: .24, max: .24, angle, radius: S.saberRange, arc: arcWidth, index: sweep, dark: dual });
  }
  S.aimX = Math.cos(base); S.aimY = Math.sin(base); if (directedAim || !S.moving) S.facing = Math.cos(base) < 0 ? -1 : 1;
  S.saberActive = .22; S.shake = Math.max(S.shake, 2.5); AudioEngine.se('saber');
}

function orbitalPose(index) {
  if (S.playerClass === 'mechanic') {
    const rig = S.orbitalRigs[index];
    if (rig) return { angle: 0, radius: 0, x: rig.x, y: rig.y };
  }
  const lane = index % 2, radius = S.orbitRadius + lane * 17;
  const speed = S.orbitSpeed * (lane ? -.84 : 1);
  const angle = S.time * speed + index * TAU / Math.max(1, S.orbitals);
  const homeX = S.x + Math.cos(angle) * radius, homeY = S.y + Math.sin(angle) * radius;
  if (!S.orbitAssault) return { angle, radius, x: homeX, y: homeY };
  const age = S.time - S.orbitAssault.start, target = S.orbitAssault.target;
  const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  const blend = age < .55 ? smooth(age / .55) : age < .72 ? 1 : smooth(1 - (age - .72) / .58);
  const strikeAngle = index * TAU / Math.max(1, S.orbitals) + age * 4;
  const strikeX = target.x + Math.cos(strikeAngle) * 42, strikeY = target.y + Math.sin(strikeAngle) * 42;
  return { angle, radius, x: homeX + (strikeX - homeX) * blend, y: homeY + (strikeY - homeY) * blend };
}

function tryOrbitIntercept(projectile) {
  if (!projectile || projectile.life <= 0 || projectile.bossPattern || projectile.orbitGuardChecked || S.orbitGuard <= 0 || S.orbitals <= 0) return false;
  for (let index = 0; index < S.orbitals; index++) {
    const pose = orbitalPose(index), radius = 15 * S.orbitSize + projectile.r;
    if (Math.hypot(projectile.x - pose.x, projectile.y - pose.y) > radius) continue;
    projectile.orbitGuardChecked = true;
    if (Math.random() >= Math.min(.3, S.orbitGuard)) return false;
    projectile.life = 0; effect('ring', pose.x, pose.y, { life: .24, max: .24, radius: 34 * S.orbitSize, color: '#6fffff' });
    burst(pose.x, pose.y, '#6fffff', 5, 110); AudioEngine.se('hit'); return true;
  }
  return false;
}

function updateMechanicOrbitals(dt) {
  while (S.orbitalRigs.length < S.orbitals) S.orbitalRigs.push({ x: S.x, y: S.y, laserClock: random(0, .6), laserFlash: 0, targetRef: null });
  if (S.orbitalRigs.length > S.orbitals) S.orbitalRigs.length = S.orbitals;
  const overloaded = S.mechOverload > 0;
  const homingSpeed = Math.max(140, S.orbitSpeed * 90) * (overloaded ? 1.6 : 1);
  const laserInterval = .85;
  const laserAoeRadius = overloaded ? 70 : 0;
  const priorityTarget = S.bossActive && !S.bossActive.dead && onScreen(S.bossActive.x, S.bossActive.y) ? S.bossActive : null;
  for (let i = 0; i < S.orbitals; i++) {
    const rig = S.orbitalRigs[i];
    let target = priorityTarget;
    if (!target) {
      let best = Infinity;
      for (const mob of S.mobs) { if (mob.dead || mob.hp <= 0) continue; const d = (mob.x - rig.x) ** 2 + (mob.y - rig.y) ** 2; if (d < best) { best = d; target = mob; } }
    }
    const homeAngle = S.time * .6 + i * TAU / Math.max(1, S.orbitals);
    const destX = target ? target.x + Math.cos(homeAngle) * 66 : S.x + Math.cos(homeAngle) * S.orbitRadius;
    const destY = target ? target.y + Math.sin(homeAngle) * 66 : S.y + Math.sin(homeAngle) * S.orbitRadius;
    const dx = destX - rig.x, dy = destY - rig.y, dist = Math.hypot(dx, dy);
    if (dist > .01) { const step = Math.min(dist, homingSpeed * dt); rig.x += dx / dist * step; rig.y += dy / dist * step; }
    rig.laserClock -= dt; rig.laserFlash = Math.max(0, rig.laserFlash - dt);
    rig.targetRef = target;
    if (target && rig.laserClock <= 0 && Math.hypot(target.x - rig.x, target.y - rig.y) < 340) {
      rig.laserClock = laserInterval; rig.laserFlash = .14;
      const dealt = damageMob(target, S.damage * S.orbitDamage * 1.15, 'orbit'); AudioEngine.se('hit');
      if (laserAoeRadius > 0) {
        effect('ring', target.x, target.y, { life: .22, max: .22, radius: laserAoeRadius, color: '#8ff5ff' });
        for (const near of nearbyMobs(target.x, target.y, laserAoeRadius + 40)) {
          if (near === target || near.dead || near.hp <= 0) continue;
          if (Math.hypot(near.x - target.x, near.y - target.y) < laserAoeRadius) damageMob(near, dealt * .6, 'orbit', false, true);
        }
      }
    }
  }
}

function updateOrbitals(dt) {
  if (!S.orbitals) return;
  if (S.playerClass === 'mechanic') { updateMechanicOrbitals(dt); return; }
  for (let i = 0; i < S.orbitals; i++) {
    const pose = orbitalPose(i), radius = 17 * S.orbitSize;
    for (const mob of nearbyMobs(pose.x, pose.y, radius + 90)) {
      mob.orbitHitAt ||= []; const previous = mob.orbitHitAt[i] || 0;
      const bladeEndX = pose.x + Math.cos(pose.angle + Math.PI / 2) * 36 * S.orbitSize;
      const bladeEndY = pose.y + Math.sin(pose.angle + Math.PI / 2) * 36 * S.orbitSize;
      const collides = i % 3 === 2
        ? pointSegmentDistance(mob.x, mob.y, pose.x, pose.y, bladeEndX, bladeEndY) < mob.r + 10 * S.orbitSize
        : Math.hypot(mob.x - pose.x, mob.y - pose.y) < mob.r + radius;
      if (mob.hp > 0 && S.time - previous > S.orbitCooldown && collides) {
        const dealt = damageMob(mob, S.damage * S.orbitDamage, 'orbit'); mob.orbitHitAt[i] = S.time;
        if (S.playerClass === 'thor') triggerChain(mob, dealt, 'orbit');
        if (S.orbitShock > 0 && Math.random() < S.orbitShock) {
          for (const near of nearbyMobs(mob.x, mob.y, 150)) if (near !== mob && near.hp > 0 && Math.hypot(near.x - mob.x, near.y - mob.y) < 90) damageMob(near, dealt * .42, 'orbit', false, true);
          effect('ring', mob.x, mob.y, { life: .3, max: .3, radius: 90, color: '#67f8ff' });
        }
      }
    }
  }
  if (S.orbitPulse > 0) {
    S.orbitPulseClock -= dt;
    if (S.orbitPulseClock <= 0) {
      S.orbitPulseClock = Math.max(1.8, 5.3 - S.orbitPulse * .8);
      for (let i = 0; i < S.orbitals; i++) {
        const pose = orbitalPose(i); effect('ring', pose.x, pose.y, { life: .45, max: .45, radius: 115, color: '#66f2ff' });
        for (const mob of nearbyMobs(pose.x, pose.y, 200)) if (Math.hypot(mob.x - pose.x, mob.y - pose.y) < 115 + mob.r) damageMob(mob, S.damage * S.orbitDamage * .65, 'orbit');
      }
    }
  }
}

function updateMasteries(dt) {
  for (const build of Object.keys(S.masteryClocks)) if (isMastered(build)) S.masteryClocks[build] -= dt;
  if (isMastered('projectile') && S.masteryClocks.projectile <= 0) {
    const target = findDenseArea(), scale = masteryScale('projectile'); S.masteryClocks.projectile = target ? masterySpecs.projectile.interval * scale.interval : .4;
    if (target && S.playerClass === 'silverbullet') {
      const rays = 28;
      for (let i = 0; i < rays; i++) {
        const angle = i / rays * TAU;
        S.shots.push({ x: target.x, y: target.y, vx: Math.cos(angle) * 640, vy: Math.sin(angle) * 640, life: 1.3, damage: S.damage * 2.6 * scale.damage, pierce: Math.max(1, S.pierce), critical: true, hit: new Set(), trailX: target.x, trailY: target.y });
      }
      effect('ring', target.x, target.y, { life: .4, max: .4, radius: 90, color: '#eef6ff' }); S.shake = Math.max(S.shake, 8); AudioEngine.se('wave');
    } else if (target) {
      const angle = Math.atan2(target.y - S.y, target.x - S.x), length = 1250 * scale.range, width = 48 * scale.range;
      const tx = S.x + Math.cos(angle) * length, ty = S.y + Math.sin(angle) * length;
      for (const mob of S.mobs) if (!mob.dead && pointSegmentDistance(mob.x, mob.y, S.x, S.y, tx, ty) < mob.r + width) damageMob(mob, S.damage * 9 * scale.damage, 'projectile');
      effect('masterLaser', S.x, S.y, { tx, ty, widthScale: scale.range, life: .52, max: .52 }); S.shake = Math.max(S.shake, 8); AudioEngine.se('wave');
    }
  }
  if (isMastered('saber') && S.masteryClocks.saber <= 0) {
    const scale = masteryScale('saber'); S.masteryClocks.saber = masterySpecs.saber.interval * scale.interval;
    if (S.playerClass === 'shadowmaster') {
      const target = findTarget(), angle = target ? Math.atan2(target.y - S.y, target.x - S.x) : Math.atan2(S.aimY, S.aimX);
      const length = 640 * scale.range, width = 150 * scale.range;
      const tx = S.x + Math.cos(angle) * length, ty = S.y + Math.sin(angle) * length;
      for (const mob of S.mobs) if (!mob.dead && pointSegmentDistance(mob.x, mob.y, S.x, S.y, tx, ty) < mob.r + width) damageMob(mob, S.damage * S.saberDamage * 3 * scale.damage, 'saber');
      effect('bladeWave', S.x, S.y, { angle, length, width, life: .5, max: .5 });
      S.saberActive = .7; S.shake = Math.max(S.shake, 7); AudioEngine.se('saber');
    } else {
      const radius = Math.max(220, S.saberRange * 1.75) * scale.range;
      for (const mob of nearbyMobs(S.x, S.y, radius + 80)) if (!mob.dead && Math.hypot(mob.x - S.x, mob.y - S.y) < radius + mob.r) damageMob(mob, S.damage * S.saberDamage * 2.4 * scale.damage, 'saber');
      effect('masterWhirl', S.x, S.y, { radius, life: .72, max: .72 }); S.saberActive = .7; S.shake = Math.max(S.shake, 7); AudioEngine.se('saber');
    }
  }
  if (isMastered('orbit') && S.masteryClocks.orbit <= 0 && !S.orbitAssault && S.mechOverload <= 0) {
    const scale = masteryScale('orbit');
    if (S.playerClass === 'mechanic') {
      S.masteryClocks.orbit = masterySpecs.orbit.interval * scale.interval; S.mechOverload = 5 * scale.range;
      effect('ring', S.x, S.y, { life: .5, max: .5, radius: 130, color: '#8ff5ff' }); S.shake = Math.max(S.shake, 6); AudioEngine.se('wave'); showWarning('⚙ OVERLOAD');
    } else {
      const target = findTarget(); S.masteryClocks.orbit = target ? masterySpecs.orbit.interval * scale.interval : .4;
      if (target) S.orbitAssault = { target, start: S.time, exploded: false };
    }
  }
  if (S.orbitAssault) {
    const age = S.time - S.orbitAssault.start, target = S.orbitAssault.target;
    if (age >= .55 && !S.orbitAssault.exploded) {
      const scale = masteryScale('orbit'), radius = 180 * scale.range; S.orbitAssault.exploded = true;
      for (const mob of nearbyMobs(target.x, target.y, radius + 80)) if (!mob.dead && Math.hypot(mob.x - target.x, mob.y - target.y) < radius + mob.r) damageMob(mob, S.damage * S.orbitDamage * Math.max(2, S.orbitals) * 1.35 * scale.damage, 'orbit');
      effect('ring', target.x, target.y, { radius, life: .62, max: .62, color: '#ffd95c' }); burst(target.x, target.y, '#ffd95c', 24, 260); AudioEngine.se('treasure');
    }
    if (age >= 1.3) S.orbitAssault = null;
  }
  if (isMastered('thor') && S.masteryClocks.thor <= 0) {
    const scale = masteryScale('thor'); S.masteryClocks.thor = masterySpecs.thor.interval * scale.interval;
    let target = null, bestHp = -1;
    for (const mob of nearbyMobs(S.x, S.y, 900)) { if (mob.dead || mob.hp <= 0 || !onScreen(mob.x, mob.y)) continue; if (mob.hp > bestHp) { bestHp = mob.hp; target = mob; } }
    if (target) {
      const radius = 200 * scale.range;
      for (const mob of nearbyMobs(target.x, target.y, radius + 80)) {
        if (mob.dead || mob.hp <= 0 || Math.hypot(mob.x - target.x, mob.y - target.y) >= radius + mob.r) continue;
        damageMob(mob, S.damage * 7 * scale.damage, 'projectile', false, false, true, true);
        mob.stunned = Math.max(mob.stunned || 0, 3); mob.shocked = Math.max(mob.shocked || 0, 3);
      }
      effect('ring', target.x, target.y, { life: .6, max: .6, radius, color: '#fff35a' });
      effect('thorHammer', target.x, target.y, { life: .55, max: .55, radius });
      burst(target.x, target.y, '#fff35a', 20, 240);
      S.shake = Math.max(S.shake, 9); AudioEngine.se('wave');
    }
  }
}

function hurtPlayer(amount = 1, unavoidable = false, bypassGuard = false) {
  if ((S.inv > 0 && !unavoidable) || S.over) return;
  if (S.shadowActive > 0 && !unavoidable) return;
  const lateGuardCap = .58 - clamp((S.time - 600) / 600, 0, 1) * .13;
  const guardChance = clamp(S.guard + (S.saberActive > 0 ? S.saberGuard : 0), 0, lateGuardCap);
  if (!unavoidable && !bypassGuard && Math.random() < guardChance) {
    S.inv = .25; S.temporarySpeed = 1.3; S.temporarySpeedClock = 1.2; showToast('⬡ BLOCK'); effect('ring', S.x, S.y, { life: .35, max: .35, radius: 55, color: '#8afff5' }); return;
  }
  const phoenixLevel = relicLevel('phoenix'), phoenixUses = S.relicUses.phoenix || 0;
  if (S.hp - amount <= 0 && phoenixLevel && phoenixUses < phoenixLevel) {
    S.relicUses.phoenix = phoenixUses + 1; S.hp = S.maxHp * Math.min(.7, .35 + phoenixLevel * .05); S.inv = 2.5; effect('relic', S.x, S.y, { life: 1.4, max: 1.4, color: '#ff9f45' }); showWarning(`PHOENIX KERNEL // REBOOT ${S.relicUses.phoenix}/${phoenixLevel}`); return;
  }
  S.hp -= amount; S.inv = .48; S.recoveryLock = 2.4; S.shake = Math.max(S.shake, 7); AudioEngine.se('hurt'); damageFlash(); burst(S.x, S.y, '#ff3978', 10, 180);
  if (S.hp <= 0) { S.hp = 0; endGame(); }
}

function dropGem(x, y, value = 1) {
  if (S.gems.length >= 320) {
    let gem = S.gems[0], best = Infinity;
    for (const candidate of S.gems) { const distance = Math.hypot(candidate.x - x, candidate.y - y); if (distance < best) { best = distance; gem = candidate; } }
    if (gem) { gem.value += value; gem.life = 65; } return;
  }
  S.gems.push({ x, y, value, life: 65 });
}

function dropChest(x, y, source, tier, rewarded = false) {
  S.chests.push({ x, y, source, tier, life: rewarded ? 3.5 : 45, phase: Math.random() * TAU, rewarded });
  if (rewarded) queueRelic(source, tier);
  effect('relic', x, y, { life: .8, max: .8, color: '#ffd34e' }); burst(x, y, '#ffd34e', 18, 210); AudioEngine.se('treasure');
}

function onKillHooks() { for (const relic of S.relics) relic.onKill?.(S); }

function relicDropChance(source, tier = 1, cycle = 0) {
  if (source === 'treasure') return Math.min(.84, .68 + S.time / 3600);
  return Math.min(.9, [.0, .42, .58, .72][tier] + cycle * .035);
}

function handleDeath(mob, W, H) {
  if (mob.dead) return;
  if (mob.kind === 'leviathan') { handleLeviathanDeath(mob); return; }
  if (mob.kind === 'mob' && mob.archetype === 'bomber') spawnBomberFuse(mob);
  mob.dead = true; effect('death', mob.x, mob.y, { life: .55, max: .55, color: mob.kind === 'treasure' ? '#ffd34e' : '#f64eff' });
  burst(mob.x, mob.y, mob.kind === 'treasure' ? '#ffd34e' : '#e950ff', mob.kind === 'boss' ? 24 : 8, mob.kind === 'boss' ? 250 : 150); AudioEngine.se('kill');
  if (mob.kind === 'boss') {
    S.kills += mob.tier * 15; S.bossesKilled++; clearBossPatterns(mob.id);
    S.xp += S.nextXp * (1.15 + mob.tier * .38); healPlayer(5 + mob.tier * 3);
    if (Math.random() < relicDropChance('boss', mob.tier, mob.cycle)) {
      dropChest(mob.x, mob.y, 'boss', mob.tier, true); showToast(`BOSS #${mob.number} DOWN · RELIC DROP`);
    } else showToast(`BOSS #${mob.number} DOWN · NO RELIC`);
    if (S.allies.length < ALLY_CAP && Math.random() < allyTameChance()) spawnAlly(mob);
    if (mob.isInteriorHost) { beginInteriorExit(); }
    else { S.bossActive = null; ui.bossHud.classList.add('hidden'); S.nextBossAt = S.time + random(58, 72) + mob.tier * 4; S.bossWarned = false; }
    S.shake = 14;
  } else if (mob.kind === 'treasure') {
    S.kills += 10;
    if (Math.random() < relicDropChance('treasure')) {
      dropChest(mob.x, mob.y, 'treasure', Math.min(3, 1 + Math.floor(S.time / 240))); showToast('JACKPOT GREMLIN DOWN · RELIC DROP');
    } else showToast('JACKPOT GREMLIN DOWN · NO RELIC');
    for (let i = 0; i < 12; i++) dropGem(mob.x + random(-55, 55), mob.y + random(-55, 55), 2 + Math.floor(S.time / 240));
    S.nextTreasureAt = S.time + random(48, 68) * S.treasureRateMult;
  } else {
    S.kills++; S.xp += .08 * S.xpGain;
    dropGem(mob.x, mob.y, (mob.elite ? 3 : 1) + Math.floor(S.time / 300));
    if (mob.interiorRelic) { dropChest(mob.x, mob.y, 'boss', 2, true); showToast('숙주의 유물 발견'); }
    if (mob.archetype === 'splitter' && !mob.child) {
      for (let i = 0; i < 2; i++) spawnEnemy(W, H, { x: mob.x + random(-18, 18), y: mob.y + random(-18, 18), child: true, archetype: 'stalker', ignoreCap: true });
    }
    onKillHooks();
  }
}

function triggerBossFieldPattern(boss) {
  if (!boss || boss.dead || boss.hp <= 0 || S.bossActive !== boss) return false;
  const unlocked = S.time < 150 ? ['mines'] : S.time < 600 ? ['mines', 'laser'] : ['mines', 'laser', 'spiral'];
  const type = unlocked[boss.eventIndex % unlocked.length]; boss.eventIndex++;
  const damage = bossPatternDamage(boss.damage);
  if (type === 'mines') {
    const count = 4 + Math.min(6, Math.floor(S.time / 150));
    for (let i = 0; i < count; i++) spawnBossAirstrike(boss, S.x + random(-320, 320), S.y + random(-230, 230), { r: 52, warmup: 1.05, life: 2.1, damage: damage + 1 });
  } else if (type === 'laser') {
    const angle = Math.random() * Math.PI;
    for (let i = -1; i <= 1; i++) {
      const offsetX = Math.cos(angle + Math.PI / 2) * i * 120, offsetY = Math.sin(angle + Math.PI / 2) * i * 120;
      S.hazards.push({ x: S.x + offsetX - Math.cos(angle) * 650, y: S.y + offsetY - Math.sin(angle) * 650, tx: S.x + offsetX + Math.cos(angle) * 650, ty: S.y + offsetY + Math.sin(angle) * 650, r: 28, warmup: 1.05, life: 1.72, type: 'line', damage: damage + 1, bossPattern: true, ownerBossId: boss.id });
    }
  } else {
    const arms = 3 + Math.min(2, Math.floor(boss.cycle / 2));
    for (let arm = 0; arm < arms; arm++) radial(boss, 9, 235 + arm * 16, S.time * .9 + arm * (TAU / arms));
  }
  AudioEngine.se('wave'); boss.patternLock = type === 'laser' ? 1.25 : type === 'spiral' ? 1.4 : 1.05;
  boss.eventClock = random(Math.max(6.2, 10.2 - boss.cycle * .3), Math.max(8.2, 13.4 - boss.cycle * .35));
  return true;
}

function processLevelUps() {
  let safety = 0;
  while (S.xp >= S.nextXp && safety++ < 6) {
    S.xp -= S.nextXp; S.level++; S.nextXp = Math.round(7 + 1.55 * S.level + .17 * S.level * S.level);
    S.rewardQueue.push(S.level === 30 && !S.playerClass ? { type: 'classChange' } : { type: 'level' });
  }
  processRewards();
}

function update(dt, W, H) {
  const inInterior = Boolean(S.interior?.active);
  if (!inInterior) S.time += dt;
  S.inv -= dt; S.shotClock -= dt; S.spawnClock = Math.max(-1, S.spawnClock - dt); S.saberClock -= dt; S.healClock += dt; S.saberActive -= dt;
  S.chainFxThisFrame = 0;
  S.recoveryLock = Math.max(0, S.recoveryLock - dt); S.healBudgetClock -= dt;
  if (S.healBudgetClock <= 0) { S.healBudgetClock += 1; S.healBudget = Math.max(2, S.maxHp * .025); }
  S.temporarySpeedClock -= dt; if (S.temporarySpeedClock <= 0) S.temporarySpeed = 1;
  S.shake = Math.max(0, S.shake - dt * 25); AudioEngine.setIntensity(Math.min(5, Math.floor(S.time / 60)));

  if (S.interior) {
    if (S.interior.exiting) { S.interior.exitClock -= dt; if (S.interior.exitClock <= 0) exitInterior(); }
    else {
      S.interior.timer -= dt;
      if (S.interior.timer <= 0) { showWarning('⚠ 숙주를 찾지 못함 · 소화됨'); AudioEngine.se('over'); endGame(); return; }
    }
  }

  if (S.playerClass === 'shadowmaster') {
    if (S.shadowActive > 0) {
      S.shadowActive -= dt;
      if (Math.random() < dt * 26) {
        const angle = Math.random() * TAU, radius = random(16, 36);
        S.particles.push({ x: S.x + Math.cos(angle) * radius, y: S.y + Math.sin(angle) * radius, vx: -Math.sin(angle) * 42, vy: -Math.cos(angle) * 42 - 12, size: random(5, 11), color: '#5a1a8f', life: .6, max: .6 });
      }
    } else {
      S.shadowClock -= dt;
      if (S.shadowClock <= 0) { S.shadowActive = 2.5; S.shadowClock = 9; S.temporarySpeed = 1.35; S.temporarySpeedClock = 2.5; showToast('⬛ SHADOW STEP'); }
    }
  }
  if (S.mechOverload > 0) S.mechOverload -= dt;

  if (!inInterior) {
    if (!S.bossActive && !S.bossWarned && S.time >= S.nextBossAt - 3) { S.bossWarned = true; showWarning('BOSS ANOMALY DETECTED'); }
    if (!S.bossActive && S.time >= S.nextBossAt) spawnBoss(W, H);
    if (S.time >= S.nextTreasureAt) spawnTreasure(W, H);
    S.leviathanCheckClock -= dt;
    if (S.leviathanCheckClock <= 0) {
      S.leviathanCheckClock = 1.2;
      if (!hasLeviathan()) {
        let regularCount = 0;
        for (const mob of S.mobs) if (mob.kind === 'mob' && !mob.dead && mob.hp > 0) regularCount++;
        if (regularCount > 150 && Math.random() < .16) spawnLeviathan(W, H);
      }
    }
  }
  if (S.bossActive?.hp > 0) {
    const remaining = S.bossActive.deadline - S.time;
    if (remaining <= 10 && !S.bossActive.deadlineWarned) { S.bossActive.deadlineWarned = true; showWarning('BOSS LIMIT · 10 SECONDS'); AudioEngine.se('boss'); }
    if (remaining <= 0 && !inInterior) handleBossTimeout(W, H);
  }

  let dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  let dy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  if (joy.on) { dx = joy.x; dy = joy.y; }
  const length = Math.hypot(dx, dy) || 1; S.moving = Math.hypot(dx, dy) > .14;
  if (hasMouseAim()) {
    S.aimX = mouseAim.x; S.aimY = mouseAim.y; S.facing = mouseAim.x < 0 ? -1 : 1;
  } else if (S.moving) {
    S.aimX = dx / length; S.aimY = dy / length; if (dx < -.05) S.facing = -1; else if (dx > .05) S.facing = 1;
  }
  const moveSpeed = Math.min(470, S.speed * S.temporarySpeed);
  S.x += dx / length * moveSpeed * dt; S.y += dy / length * moveSpeed * dt;
  if (inInterior) {
    const centerDist = Math.hypot(S.x, S.y);
    if (centerDist > INTERIOR_ARENA_RADIUS) { S.x = S.x / centerDist * INTERIOR_ARENA_RADIUS; S.y = S.y / centerDist * INTERIOR_ARENA_RADIUS; }
  }

  if (S.regen > 0 && S.healClock >= 1) { S.healClock -= 1; healPlayer(S.regen); }
  if (!inInterior && S.spawnClock <= 0) {
    let regularCount = 0;
    for (const mob of S.mobs) if (mob.kind === 'mob' && !mob.dead && mob.hp > 0) regularCount++;
    const openingDensityScale = OPENING_MOB_DENSITY_SCALE + (1 - OPENING_MOB_DENSITY_SCALE) * clamp(S.time / 60, 0, 1);
    const densityTarget = Math.min(190, Math.round((36 + Math.floor(S.time * .24)) * openingDensityScale));
    const deficit = Math.max(0, densityTarget - regularCount);
    const baseInterval = Math.max(.09, .5 / Math.pow(1 + S.time / 210, .76));
    const interval = regularCount === 0 ? .12 : deficit > 0 ? Math.min(.11, baseInterval) : baseInterval;
    const batch = regularCount === 0 ? 4 : deficit > 50 ? 5 : deficit > 28 ? 4 : deficit > 12 ? 3 : deficit > 0 ? 2 : 1;
    S.spawnClock = interval * (S.bossActive ? 1.12 : 1) / AMBIENT_SPAWN_RATE_SCALE;
    for (let i = 0; i < batch; i++) spawnEnemy(W, H);
  }
  if (S.shotClock <= 0) { S.shotClock = Math.max(.1, S.rate); fire(); }
  if (S.saberLevel > 0 && S.saberClock <= 0) { S.saberClock = Math.max(.2, S.saberRate); saberSlash(); }
  for (const delayed of S.delayedVolleys) if (!delayed.done && delayed.due <= S.time) { delayed.done = true; createVolley(delayed.angle, delayed.damage); }
  compact(S.delayedVolleys, delayed => !delayed.done);

  for (const mob of S.mobs) if (mob.hp <= 0 && !mob.dead) handleDeath(mob, W, H);
  compact(S.mobs, mob => !mob.dead);
  for (const mob of S.mobs) {
    if (mob.dead || mob.hp <= 0) continue;
    if (mob.kind === 'boss') updateBoss(mob, dt); else if (mob.kind === 'leviathan') updateLeviathan(mob, dt); else updateMob(mob, dt);
    if (S.over) return;
  }
  rebuildMobGrid();
  for (const ally of S.allies) if (!ally.dead) updateAlly(ally, dt);
  compact(S.allies, ally => !ally.dead);
  for (const projectile of S.shots) {
    projectile.trailX = projectile.x; projectile.trailY = projectile.y; projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.life -= dt;
    for (const mob of nearbyMobs(projectile.x, projectile.y, 105 + 12 * S.shotScale)) if (projectile.life > 0 && !mob.dead && (projectile.x - mob.x) ** 2 + (projectile.y - mob.y) ** 2 < (mob.r + 8 * S.shotScale) ** 2) hitMob(mob, projectile);
  }
  for (const projectile of S.enemyShots) {
    projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.life -= dt;
    if (tryOrbitIntercept(projectile)) continue;
    if (Math.hypot(projectile.x - S.x, projectile.y - S.y) < projectile.r + PLAYER_HIT_RADIUS) {
      hurtPlayer(projectile.bossPattern ? bossPatternDamage(projectile.damage) : projectile.damage, false, projectile.bossPattern);
      projectile.life = 0; if (S.over) return;
    }
  }
  compact(S.enemyShots, projectile => projectile.life > 0 && Math.hypot(projectile.x - S.x, projectile.y - S.y) < 1700);

  for (const hazard of S.hazards) {
    const wasWarming = hazard.warmup > 0;
    hazard.warmup -= dt; hazard.life -= dt;
    if (hazard.type === 'bombFuse') {
      if (hazard.warmup <= 0 && !hazard.detonated) {
        hazard.detonated = true; effect('ring', hazard.x, hazard.y, { life: .5, max: .5, radius: hazard.r, color: '#ff3d66' });
        burst(hazard.x, hazard.y, '#ff4b62', 18, 240); AudioEngine.se('wave'); S.shake = Math.max(S.shake, 7);
        const chainLevel = relicLevel('chain_detonator');
        if (chainLevel) {
          const ratio = Math.min(1.2, .3 + (chainLevel - 1) * .15);
          for (const mob of nearbyMobs(hazard.x, hazard.y, hazard.r + 90)) {
            if (!mob.dead && mob.hp > 0 && Math.hypot(mob.x - hazard.x, mob.y - hazard.y) < hazard.r + mob.r) damageMob(mob, hazard.damage * ratio, 'area', false, true);
          }
          effect('ring', hazard.x, hazard.y, { life: .64, max: .64, radius: hazard.r, color: '#ffd65a' });
        }
        if (Math.hypot(hazard.x - S.x, hazard.y - S.y) < hazard.r + PLAYER_HIT_RADIUS) { hurtPlayer(hazard.damage); hazard.hit = true; if (S.over) return; }
      }
      continue;
    }
    if (hazard.airstrike && wasWarming && hazard.warmup <= 0 && !hazard.impactShown) {
      hazard.impactShown = true; effect('ring', hazard.x, hazard.y, { life: .36, max: .36, radius: hazard.r, color: '#ff5b75' });
      burst(hazard.x, hazard.y, '#ff6a78', 10, 180); AudioEngine.se('hit');
    }
    if (!hazard.telegraphOnly && hazard.warmup <= 0 && !hazard.hit) {
      const hit = hazard.type === 'circle'
        ? Math.hypot(hazard.x - S.x, hazard.y - S.y) < hazard.r + PLAYER_HIT_RADIUS
        : pointSegmentDistance(S.x, S.y, hazard.x, hazard.y, hazard.tx, hazard.ty) < hazard.r + PLAYER_HIT_RADIUS;
      if (hit) { hurtPlayer(hazard.bossPattern ? bossPatternDamage(hazard.damage) : hazard.damage, false, hazard.bossPattern); hazard.hit = true; if (S.over) return; }
    }
  }
  compact(S.hazards, hazard => hazard.life > 0);

  updateOrbitals(dt); updateMasteries(dt);
  for (const mob of S.mobs) if (mob.hp <= 0 && !mob.dead) handleDeath(mob, W, H);
  compact(S.mobs, mob => !mob.dead); compact(S.shots, projectile => projectile.life > 0);

  for (const gem of S.gems) {
    gem.life -= dt; const distance = Math.hypot(S.x - gem.x, S.y - gem.y);
    if (distance < S.magnet * S.magnetMult) { gem.x += (S.x - gem.x) / Math.max(1, distance) * 480 * dt; gem.y += (S.y - gem.y) / Math.max(1, distance) * 480 * dt; }
    if (distance < 30) { S.xp += gem.value * S.xpGain; gem.value = 0; AudioEngine.se('xp'); }
  }
  compact(S.gems, gem => gem.value > 0 && gem.life > 0);

  for (const chest of S.chests) {
    chest.life -= dt; const distance = Math.hypot(S.x - chest.x, S.y - chest.y);
    if (distance < 230) { chest.x += (S.x - chest.x) / Math.max(1, distance) * 300 * dt; chest.y += (S.y - chest.y) / Math.max(1, distance) * 300 * dt; }
    if (!chest.rewarded && distance < 42 && !chest.collected) { chest.collected = true; queueRelic(chest.source, chest.tier); }
  }
  compact(S.chests, chest => !chest.collected && chest.life > 0);

  for (const particle of S.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= .96; particle.vy *= .96; particle.life -= dt; }
  compact(S.particles, particle => particle.life > 0);
  for (const item of S.effects) item.life -= dt; compact(S.effects, item => item.life > 0);
  processLevelUps();
}

function sprite(image, column, row, columns, rows, dx, dy, dw, dh, alpha = 1, flip = false) {
  if (!image.complete || !image.width) return;
  const sw = image.width / columns, sh = image.height / rows;
  ctx.save(); ctx.globalAlpha = alpha;
  if (flip) { ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(image, column * sw, row * sh, sw, sh, 0, 0, dw, dh); }
  else ctx.drawImage(image, column * sw, row * sh, sw, sh, dx, dy, dw, dh);
  ctx.restore();
}

function drawHazards(W, H) {
  for (const hazard of S.hazards) {
    const hasLine = hazard.tx !== undefined;
    if (!visibleWorld(hazard.x, hazard.y, W, H, 400) && (!hasLine || !visibleWorld(hazard.tx, hazard.ty, W, H, 400))) continue;
    const ready = hazard.warmup <= 0, active = ready && !hazard.telegraphOnly;
    const visualRadius = hazard.r + PLAYER_HIT_RADIUS;
    ctx.save();
    if (hazard.type === 'bombFuse') {
      const progress = clamp(1 - hazard.warmup / Math.max(.01, hazard.startWarmup), 0, 1);
      const flash = hazard.detonated ? 0 : .35 + .65 * Math.max(0, Math.sin(progress * Math.PI * (5 + progress * 20)));
      const bodyScale = Math.max(72, hazard.sourceRadius * 4);
      sprite(images.enemy, Math.floor(performance.now() / 90 + hazard.phase) % 2, 1, 2, 2, hazard.x - bodyScale / 2, hazard.y - bodyScale * .58, bodyScale, bodyScale, flash, hazard.facing < 0);
      ctx.globalAlpha = flash; ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = lowFxActive() ? 0 : 22 + progress * 26; ctx.shadowColor = '#ff254f';
      ctx.fillStyle = '#ff193c'; ctx.strokeStyle = progress > .72 ? '#fff' : '#ff6b80'; ctx.lineWidth = 4 + progress * 3;
      ctx.beginPath(); ctx.arc(hazard.x, hazard.y, 20 + progress * 7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.globalAlpha = .25 + flash * .6; ctx.setLineDash([8, 7]); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(hazard.x, hazard.y, visualRadius * (.72 + progress * .28), -Math.PI / 2, -Math.PI / 2 + TAU * progress); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = .12 + progress * .18; ctx.fillStyle = '#ff163d'; ctx.beginPath(); ctx.arc(hazard.x, hazard.y, visualRadius, 0, TAU); ctx.fill();
      ctx.restore(); continue;
    }
    ctx.strokeStyle = active ? '#ff2e72' : '#ff92bd'; ctx.fillStyle = active ? '#ff175522' : '#ffccdd0d';
    ctx.lineWidth = active ? 6 : 2; ctx.setLineDash(active ? [] : [8, 8]); ctx.shadowBlur = lowFxActive() ? 0 : (active ? 16 : 6); ctx.shadowColor = '#ff2a70';
    if (hazard.type === 'circle') {
      const progress = ready ? 1 : clamp(1 - hazard.warmup / Math.max(.01, hazard.startWarmup || 1), .08, 1);
      ctx.beginPath(); ctx.arc(hazard.x, hazard.y, visualRadius * progress, 0, TAU); ctx.fill(); ctx.stroke();
      if (hazard.airstrike && !ready) {
        const missileX = hazard.x + (hazard.missileDrift || 0) * (1 - progress), missileY = hazard.y - 205 * (1 - progress) - 13;
        ctx.save(); ctx.setLineDash([]); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = '#ff7293'; ctx.lineWidth = 3; ctx.shadowBlur = lowFxActive() ? 0 : 16; ctx.shadowColor = '#ff315f';
        ctx.beginPath(); ctx.moveTo(missileX - (hazard.missileDrift || 0) * .22, missileY - 54); ctx.lineTo(missileX, missileY); ctx.stroke();
        ctx.translate(missileX, missileY); ctx.fillStyle = '#eaf9ff'; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(-6, -8); ctx.lineTo(0, -14); ctx.lineTo(6, -8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff386d'; ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(0, -24 - Math.sin(performance.now() * .03) * 4); ctx.lineTo(4, -9); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      if (active) { ctx.beginPath(); ctx.arc(hazard.x, hazard.y, visualRadius * .28, 0, TAU); ctx.stroke(); }
    } else {
      ctx.save(); ctx.globalAlpha = active ? .18 : .08; ctx.strokeStyle = active ? '#ff245f' : '#ff92bd'; ctx.lineWidth = visualRadius * 2; ctx.lineCap = 'round'; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(hazard.x, hazard.y); ctx.lineTo(hazard.tx, hazard.ty); ctx.stroke(); ctx.restore();
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hazard.x, hazard.y); ctx.lineTo(hazard.tx, hazard.ty); ctx.stroke();
      if (active) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hazard.x, hazard.y); ctx.lineTo(hazard.tx, hazard.ty); ctx.stroke(); }
    }
    ctx.restore();
  }
}

function drawMob(mob, t) {
  const lowFx = lowFxActive(), spriteAlpha = mob.hitFlash > 0 ? .72 : 1;
  ctx.save();
  if (mob.hitFlash > 0) ctx.globalCompositeOperation = 'lighter';
  if (mob.kind === 'leviathan') {
    const scale = mob.r * 4.6, bob = Math.sin(t * .0026) * 8;
    ctx.shadowBlur = lowFx ? 0 : 36; ctx.shadowColor = '#39d9ff';
    sprite(images.leviathan, 0, 0, 1, 1, mob.x - scale / 2, mob.y - scale / 2 + bob, scale, scale, spriteAlpha, mob.facing < 0);
    ctx.save(); ctx.globalAlpha = .5 + Math.sin(t * .005) * .15; ctx.strokeStyle = '#39d9ff'; ctx.lineWidth = 3; ctx.setLineDash([10, 6]);
    ctx.beginPath(); ctx.arc(mob.x, mob.y, mob.r + 18, 0, TAU); ctx.stroke(); ctx.restore();
  } else if (mob.kind === 'boss') {
    const index = ({ oni: 0, seraph: 1, witch: 2, dragon: 3 })[mob.bossType] ?? 0;
    const scale = mob.tier === 3 ? 245 : 178, bob = Math.sin(t * .004) * 5;
    const intensityTier = Math.min(5, Math.floor(S.time / 300));
    const auraColor = intensityTier >= 4 ? '#fff4d0' : intensityTier >= 2 ? '#ff8f3b' : '#f03bff';
    ctx.shadowBlur = lowFx ? 0 : 24 + intensityTier * 4; ctx.shadowColor = auraColor;
    sprite(images.bosses, index % 2, Math.floor(index / 2), 2, 2, mob.x - scale / 2, mob.y - scale * .56 + bob, scale, scale, spriteAlpha, mob.facing < 0);
    if (!lowFx && intensityTier >= 2) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const ringCount = Math.min(3, intensityTier - 1);
      for (let ring = 0; ring < ringCount; ring++) {
        const pulse = (t * .0012 + ring * .4) % 1;
        ctx.globalAlpha = (1 - pulse) * .4; ctx.strokeStyle = auraColor; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(mob.x, mob.y, mob.r + 14 + pulse * 46, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
  } else if (mob.kind === 'treasure') {
    const runningFrame = Math.floor(t / 135 + mob.phase) % 2, scale = 142, bob = Math.sin(t * .008 + mob.id * 9) * 5;
    ctx.shadowBlur = lowFx ? 0 : 30; ctx.shadowColor = '#ffd642';
    sprite(images.treasure, runningFrame, 1, 2, 2, mob.x - scale / 2, mob.y - scale * .58 + bob, scale, scale, spriteAlpha, mob.facing < 0);
    ctx.strokeStyle = '#ffd34e'; ctx.lineWidth = 3; ctx.setLineDash([8, 5]); ctx.beginPath(); ctx.arc(mob.x, mob.y, mob.r + 11 + Math.sin(t * .008) * 3, 0, TAU); ctx.stroke();
  } else {
    const close = Math.hypot(mob.x - S.x, mob.y - S.y) < 170, row = close ? 1 : 0;
    const column = (Math.floor(t / (close ? 110 : 230)) + mob.phase) % 2, scale = mob.r * (mob.elite ? 4.2 : 3.8);
    const colors = { gunner: '#45dfff', charger: '#ffb442', splitter: '#9a72ff', bomber: '#ff456d', warder: '#63f6ff', stalker: '#e33cff' };
    ctx.shadowBlur = lowFx ? 0 : 17; ctx.shadowColor = colors[mob.archetype] || '#e33cff';
    sprite(images.enemy, column, row, 2, 2, mob.x - scale / 2, mob.y - scale * .58, scale, scale, spriteAlpha, mob.facing < 0);
    if (mob.archetype !== 'stalker') {
      const iconPose = { gunner: [0, 0], charger: [1, 0], warder: [0, 1] }[mob.archetype] || [1, 1];
      const iconSize = 22;
      sprite(images.archetypeIcons, iconPose[0], iconPose[1], 2, 2, mob.x - iconSize / 2, mob.y - mob.r - 17 - iconSize / 2, iconSize, iconSize);
    }
    if (mob.archetype === 'warder' && mob.shield > 0) {
      ctx.save(); ctx.globalAlpha = .45 + Math.sin(t * .009 + mob.id) * .15; ctx.strokeStyle = '#7dffff'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(mob.x, mob.y, mob.r + 12, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (mob.archetype === 'bomber') {
      ctx.save(); ctx.translate(mob.x, mob.y - 2); ctx.rotate(Math.sin(t * .004 + mob.id * 9) * .08);
      ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = lowFx ? 0 : 20; ctx.shadowColor = '#ff244f';
      const bw = (mob.r + 13) * 2.3, bh = bw * (110 / 234);
      sprite(images.bomberDrone, 0, 0, 1, 1, -bw / 2, -bh / 2, bw, bh);
      ctx.restore();
      ctx.save(); ctx.translate(mob.x, mob.y - 2); ctx.rotate(t * .0018);
      ctx.strokeStyle = '#ff6a81'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 1, mob.r + 13, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  ctx.restore();

  const barHalf = mob.kind === 'leviathan' ? 110 : mob.kind === 'treasure' ? 62 : mob.kind === 'boss' ? Math.max(54, mob.r) : mob.r;
  const barY = mob.kind === 'leviathan' ? mob.y - mob.r * 2.1 - 34 : mob.kind === 'treasure' ? mob.y - 89 : mob.kind === 'boss' ? mob.y - mob.r - 34 : mob.y - mob.r - 13;
  ctx.fillStyle = '#171328'; ctx.fillRect(mob.x - barHalf, barY, barHalf * 2, 4);
  ctx.fillStyle = mob.kind === 'leviathan' ? '#39d9ff' : mob.kind === 'treasure' ? '#ffd34e' : mob.kind === 'boss' ? '#ff4f9d' : mob.elite ? '#c977ff' : '#ff6799';
  ctx.fillRect(mob.x - barHalf, barY, barHalf * 2 * clamp(mob.hp / mob.maxHp, 0, 1), 4);
  if (mob.kind === 'leviathan') { ctx.fillStyle = '#bdf2ff'; ctx.font = '900 10px monospace'; ctx.textAlign = 'center'; ctx.fillText('LEVIATHAN', mob.x, barY - 6); }
  if (mob.maxShield > 0 && mob.shield > 0) { ctx.fillStyle = '#0b2333'; ctx.fillRect(mob.x - barHalf, barY - 5, barHalf * 2, 3); ctx.fillStyle = '#65f6ff'; ctx.fillRect(mob.x - barHalf, barY - 5, barHalf * 2 * clamp(mob.shield / mob.maxShield, 0, 1), 3); }
  if (mob.frozen > 0) { ctx.strokeStyle = '#9bf8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mob.x, mob.y, mob.r + 8, 0, TAU); ctx.stroke(); }
  if (mob.shocked > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#fff35a'; ctx.lineWidth = 2; ctx.shadowBlur = lowFxActive() ? 0 : 10; ctx.shadowColor = '#fff35a';
    ctx.beginPath(); ctx.arc(mob.x, mob.y, mob.r + 11, 0, TAU); ctx.stroke(); ctx.restore();
  }
  if (mob.stunned > 0) {
    ctx.fillStyle = '#fff35a'; ctx.font = '900 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('⚡', mob.x, mob.y - mob.r - 24);
  }
}

function drawAlly(ally, t) {
  const lowFx = lowFxActive(), spriteAlpha = ally.hitFlash > 0 ? .72 : 1;
  const index = ({ oni: 0, seraph: 1, witch: 2, dragon: 3 })[ally.bossType] ?? 0;
  const scale = (ally.tier === 3 ? 245 : 178) * .62, bob = Math.sin(t * .004 + ally.id * 7) * 5;
  ctx.save();
  if (ally.hitFlash > 0) ctx.globalCompositeOperation = 'lighter';
  ctx.shadowBlur = lowFx ? 0 : 24; ctx.shadowColor = '#7dffb0';
  sprite(images.bosses, index % 2, Math.floor(index / 2), 2, 2, ally.x - scale / 2, ally.y - scale * .56 + bob, scale, scale, spriteAlpha, ally.facing < 0);
  ctx.restore();
  ctx.save(); ctx.globalAlpha = .55 + Math.sin(t * .006) * .12; ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.arc(ally.x, ally.y, ally.r + 10, 0, TAU); ctx.stroke(); ctx.restore();
  const barHalf = ally.r + 6, barY = ally.y - scale * .56 - 12;
  ctx.fillStyle = '#171328'; ctx.fillRect(ally.x - barHalf, barY, barHalf * 2, 4);
  ctx.fillStyle = '#7dffb0'; ctx.fillRect(ally.x - barHalf, barY, barHalf * 2 * clamp(ally.hp / ally.maxHp, 0, 1), 4);
  ctx.fillStyle = '#c8ffe0'; ctx.font = '900 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('ALLY', ally.x, barY - 5);
}

function drawProjectiles() {
  for (const projectile of S.shots) {
    if (!visibleWorld(projectile.x, projectile.y, innerWidth, innerHeight, 90)) continue;
    const silver = S.playerClass === 'silverbullet';
    const angle = Math.atan2(projectile.vy, projectile.vx); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = silver ? '#eef6ff' : projectile.critical ? '#ff67e8' : '#4feeff'; ctx.lineWidth = 8 * S.shotScale; ctx.globalAlpha = .28;
    ctx.beginPath(); ctx.moveTo(projectile.x - Math.cos(angle) * 52 * S.shotScale, projectile.y - Math.sin(angle) * 52 * S.shotScale); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.translate(projectile.x, projectile.y); ctx.rotate(angle); ctx.shadowBlur = lowFxActive() ? 0 : 24; ctx.shadowColor = silver ? '#dfefff' : projectile.critical ? '#ff69f3' : '#55f8ff';
    sprite(images.vfx, 1, 0, 3, 2, -35 * S.shotScale, -17 * S.shotScale, 70 * S.shotScale, 34 * S.shotScale); ctx.restore();
  }
  for (const projectile of S.enemyShots) {
    if (!visibleWorld(projectile.x, projectile.y, innerWidth, innerHeight, 90)) continue;
    const boss = Boolean(projectile.bossPattern), trailColor = boss ? '#ff9a2e' : '#ff2794', glowColor = boss ? '#ffb03f' : '#ff168c';
    const angle = Math.atan2(projectile.vy, projectile.vx); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = trailColor; ctx.lineWidth = projectile.r * (boss ? 1.4 : 1.15); ctx.globalAlpha = .34;
    ctx.beginPath(); ctx.moveTo(projectile.x - Math.cos(angle) * (boss ? 38 : 28), projectile.y - Math.sin(angle) * (boss ? 38 : 28)); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.shadowBlur = lowFxActive() ? 0 : (boss ? 24 : 18); ctx.shadowColor = glowColor;
    const missileSize = projectile.r * (boss ? 3.1 : 2.6);
    sprite(images.enemyMissile, 0, 0, 1, 1, projectile.x - missileSize / 2, projectile.y - missileSize / 2, missileSize, missileSize);
    ctx.restore();
  }
}

function jaggedLine(fromX, fromY, toX, toY, life) {
  const points = 6, dx = toX - fromX, dy = toY - fromY, length = Math.hypot(dx, dy) || 1, nx = -dy / length, ny = dx / length;
  ctx.beginPath(); ctx.moveTo(fromX, fromY);
  for (let i = 1; i < points; i++) {
    const ratio = i / points, offset = Math.sin(i * 12.7 + life * 90) * 9;
    ctx.lineTo(fromX + dx * ratio + nx * offset, fromY + dy * ratio + ny * offset);
  }
  ctx.lineTo(toX, toY);
}

function drawEffects() {
  for (const item of S.effects) {
    if (!visibleWorld(item.x, item.y, innerWidth, innerHeight, Math.max(180, item.radius || 0)) && item.type !== 'masterLaser') continue;
    const progress = 1 - item.life / item.max, alpha = clamp(item.life / item.max * 2, 0, 1);
    if (item.type === 'masterLaser') {
      const widthScale = item.widthScale || 1;
      const flashAlpha = alpha * Math.max(0, 1 - progress * 2.2);
      if (flashAlpha > 0 && !item.dark) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flashAlpha; ctx.shadowBlur = lowFxActive() ? 0 : 30; ctx.shadowColor = '#ffd65a';
        const fs = 60 * widthScale * (1 + progress);
        sprite(images.ultimateFx, 0, 0, 1, 1, item.x - fs / 2, item.y - fs / 2, fs, fs);
        ctx.restore();
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.lineCap = 'round'; ctx.shadowBlur = lowFxActive() ? 0 : 35; ctx.shadowColor = item.dark ? '#9c4dff' : '#6cf7ff';
      ctx.strokeStyle = item.dark ? '#5a1a8855' : '#36dfff44'; ctx.lineWidth = 70 * widthScale * (1 - progress * .45); ctx.beginPath(); ctx.moveTo(item.x, item.y); ctx.lineTo(item.tx, item.ty); ctx.stroke();
      ctx.strokeStyle = item.dark ? '#a35bff' : '#8cfaff'; ctx.lineWidth = 28 * widthScale * (1 - progress * .4); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * widthScale; ctx.stroke(); ctx.restore(); continue;
    }
    if (item.type === 'bladeWave') {
      const len = item.length * (.45 + progress * .55), width = item.width * (1 - progress * .25);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.translate(item.x, item.y); ctx.rotate(item.angle);
      ctx.shadowBlur = lowFxActive() ? 0 : 32; ctx.shadowColor = '#9c4dff';
      ctx.fillStyle = '#3a154fbb';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * .5, -width, len, 0); ctx.quadraticCurveTo(len * .5, width, 0, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a35bff'; ctx.lineWidth = 7; ctx.stroke();
      ctx.strokeStyle = '#e9d4ff'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.restore(); continue;
    }
    if (item.type === 'thorHammer') {
      const size = Math.max(160, item.radius * 1.3) * (1 - progress * .12), dropY = -220 * Math.max(0, .5 - progress) * 2;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.shadowBlur = lowFxActive() ? 0 : 30; ctx.shadowColor = '#ffd65a';
      sprite(images.thorHammer, 0, 0, 1, 1, item.x - size / 2, item.y - size / 2 + dropY, size, size);
      ctx.restore(); continue;
    }
    if (item.type === 'masterWhirl') {
      const flashAlpha = alpha * Math.max(0, 1 - progress * 2.2);
      if (flashAlpha > 0) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = flashAlpha; ctx.shadowBlur = lowFxActive() ? 0 : 30; ctx.shadowColor = '#ffd65a';
        const fs = item.radius * 1.3;
        sprite(images.ultimateFx, 0, 0, 1, 1, item.x - fs / 2, item.y - fs / 2, fs, fs);
        ctx.restore();
      }
      ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(progress * TAU * 2.6); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.shadowBlur = lowFxActive() ? 0 : 28; ctx.shadowColor = '#ffd85c';
      for (let blade = 0; blade < 4; blade++) { ctx.rotate(TAU / 4); ctx.strokeStyle = blade % 2 ? '#65f5ff' : '#ffd95c'; ctx.lineWidth = 13; ctx.beginPath(); ctx.arc(0, 0, item.radius * (.58 + blade * .08), -.65, .65); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); }
      ctx.restore(); continue;
    }
    if (item.type === 'chain') {
      const lowFx = lowFxActive(), thor = item.thor;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.shadowBlur = lowFx ? 0 : (thor ? 18 : 12); ctx.shadowColor = thor ? '#fff35a' : '#62efff';
      ctx.strokeStyle = thor ? '#ffe873' : '#57e7ff'; ctx.lineWidth = thor ? 11 : 8; jaggedLine(item.fromX, item.fromY, item.x, item.y, item.life); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = thor ? 3 : 2; ctx.stroke();
      if (thor) { ctx.strokeStyle = '#fff9c4bb'; ctx.lineWidth = 1; jaggedLine(item.fromX, item.fromY, item.x, item.y, item.life + 3); ctx.stroke(); }
      ctx.restore(); continue;
    }
    if (item.type === 'saber') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.translate(item.x, item.y); ctx.rotate(item.angle);
      ctx.shadowBlur = lowFxActive() ? 0 : 24; ctx.shadowColor = item.dark ? '#8b3dff' : item.index % 2 ? '#ff63ef' : '#67f8ff';
      ctx.fillStyle = item.dark ? '#2a114488' : item.index % 2 ? '#f25bff22' : '#44eaff22'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, item.radius, -item.arc / 2, item.arc / 2); ctx.closePath(); ctx.fill();
      for (const lane of [.38, .64, .88, 1]) {
        ctx.strokeStyle = lane === 1 ? '#fff' : item.dark ? '#9c4dff' : item.index % 2 ? '#f25bff' : '#44eaff'; ctx.lineWidth = lane === 1 ? 4 : 8 * lane;
        ctx.beginPath(); ctx.arc(0, 0, item.radius * lane * (.9 + progress * .1), -item.arc / 2, item.arc / 2); ctx.stroke();
      }
      ctx.restore(); continue;
    }
    if (item.type === 'ring') {
      ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = item.color || '#75efff'; ctx.lineWidth = 5 * (1 - progress) + 1; ctx.shadowBlur = lowFxActive() ? 0 : 16; ctx.shadowColor = item.color || '#75efff';
      ctx.beginPath(); ctx.arc(item.x, item.y, (item.radius || 70) * progress, 0, TAU); ctx.stroke(); ctx.restore(); continue;
    }
    if (item.type === 'hit') {
      const size = (item.critical ? 125 : 86) + progress * 25; sprite(images.vfx, 2, 0, 3, 2, item.x - size / 2, item.y - size / 2, size, size, alpha);
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = item.critical ? '#ff75ed' : '#fff'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const angle = i * TAU / 5 + progress; ctx.beginPath(); ctx.moveTo(item.x + Math.cos(angle) * 12, item.y + Math.sin(angle) * 12); ctx.lineTo(item.x + Math.cos(angle) * (30 + progress * 24), item.y + Math.sin(angle) * (30 + progress * 24)); ctx.stroke(); } ctx.restore(); continue;
    }
    if (item.type === 'death') {
      const size = 105 + progress * 65; sprite(images.vfx, 2, 0, 3, 2, item.x - size / 2, item.y - size / 2, size, size, alpha);
      ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = item.color || '#f05cff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(item.x, item.y, 25 + progress * 72, 0, TAU); ctx.stroke(); ctx.restore(); continue;
    }
    if (item.type === 'level') {
      sprite(images.vfx, 0, 1, 3, 2, item.x - 100, item.y - 75, 200, 200, alpha); sprite(images.vfx, 2, 1, 3, 2, item.x - 80, item.y - 110, 160, 160, alpha); continue;
    }
    if (item.type === 'relic') {
      ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = item.color || '#ffd34e'; ctx.shadowBlur = lowFxActive() ? 0 : 24; ctx.shadowColor = item.color || '#ffd34e'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(item.x, item.y, 30 + progress * 105, 0, TAU); ctx.stroke(); ctx.translate(item.x, item.y); ctx.rotate(progress); ctx.strokeRect(-45 - progress * 30, -45 - progress * 30, 90 + progress * 60, 90 + progress * 60); ctx.restore();
    }
  }
}

function drawEnergyBlade(x, y, angle, length = 58, color = '#66efff', alpha = 1, useSprite = false, dark = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha;
  if (useSprite) {
    ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = lowFxActive() ? 0 : 20; ctx.shadowColor = color;
    const h = length * .34;
    sprite(dark ? images.darkBlade : images.saberBlade, 0, 0, 1, 1, -h * .2, -h / 2, length + h * .2, h);
  } else {
    ctx.strokeStyle = '#152333'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(0, 0); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.shadowBlur = lowFxActive() ? 0 : 20; ctx.shadowColor = color;
    ctx.strokeStyle = color; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length, 0); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length, 0); ctx.stroke();
  }
  ctx.restore();
}

function drawOrbitals(t) {
  const mechanic = S.playerClass === 'mechanic';
  for (let i = 0; i < S.orbitals; i++) {
    const pose = orbitalPose(i), size = 34 * S.orbitSize, type = i % 3;
    if (mechanic) {
      const rig = S.orbitalRigs[i];
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = lowFxActive() ? 0 : 16; ctx.shadowColor = '#8ff5ff';
      sprite(images.mechaOrbital, 0, 0, 1, 1, pose.x - size * .8, pose.y - size * .8, size * 1.6, size * 1.6);
      ctx.restore();
      if (rig?.laserFlash > 0 && rig.targetRef && !rig.targetRef.dead) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(rig.laserFlash / .14, 0, 1);
        ctx.strokeStyle = '#8ff5ff'; ctx.lineWidth = 3; ctx.shadowBlur = lowFxActive() ? 0 : 14; ctx.shadowColor = '#8ff5ff';
        ctx.beginPath(); ctx.moveTo(pose.x, pose.y); ctx.lineTo(rig.targetRef.x, rig.targetRef.y); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
      continue;
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = i % 2 ? '#e958ff88' : '#5deaff88'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pose.x, pose.y, size * .65 + Math.sin(t * .006 + i) * 3, 0, TAU); ctx.stroke(); ctx.restore();
    if (type === 0) sprite(images.vfx, 0, 0, 3, 2, pose.x - size / 2, pose.y - size / 2, size, size);
    else if (type === 1) sprite(images.vfx, 1, 1, 3, 2, pose.x - size * .45, pose.y - size * .45, size * .9, size * .9);
    else drawEnergyBlade(pose.x, pose.y, pose.angle + Math.PI / 2, 36 * S.orbitSize, '#ff61ed');
  }
}

function visibleWorld(x, y, W, H, padding = 140) {
  return Math.abs(x - S.x) <= W / 2 + padding && Math.abs(y - S.y) <= H / 2 + padding;
}

function drawPlayerHpBar() {
  const width = 88, height = 8, x = S.x - width / 2, y = S.y + 49, ratio = clamp(S.hp / Math.max(1, S.maxHp), 0, 1);
  ctx.save(); ctx.fillStyle = '#030712dd'; ctx.fillRect(x - 2, y - 2, width + 4, height + 4);
  ctx.fillStyle = ratio > .55 ? '#51f0a4' : ratio > .25 ? '#ffd159' : '#ff426f'; ctx.fillRect(x, y, width * ratio, height);
  ctx.strokeStyle = '#d9fbffcc'; ctx.lineWidth = 1; ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = '#fff'; ctx.font = '900 8px monospace'; ctx.textAlign = 'center'; ctx.fillText(`${Math.ceil(S.hp)} / ${Math.ceil(S.maxHp)}`, S.x, y + 7); ctx.restore();
}

function drawPlayerHitbox() {
  if (!settings.showHitbox) return;
  const x = S.x, y = S.y, r = PLAYER_HIT_RADIUS;
  const traceWireSphere = () => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .34, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y, r * .38, r, 0, 0, TAU); ctx.stroke();
  };
  ctx.save();
  ctx.globalAlpha = .68; ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#02050dcc'; ctx.lineWidth = 4; traceWireSphere();
  ctx.strokeStyle = '#a7f8ff'; ctx.lineWidth = 1.25; traceWireSphere();
  const label = 'HIT';
  ctx.font = '800 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#02050de6'; ctx.fillRect(x - 11, y - r - 12, 22, 9);
  ctx.strokeStyle = '#a7f8ff'; ctx.lineWidth = 1; ctx.strokeRect(x - 11, y - r - 12, 22, 9);
  ctx.fillStyle = '#eaffff'; ctx.fillText(label, x, y - r - 7.5);
  ctx.restore();
}

function drawWorld(W, H, t) {
  ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
  if (images.city.complete && images.city.width) {
    const tile = 860, offsetX = ((-S.x % tile) + tile) % tile - tile, offsetY = ((-S.y % tile) + tile) % tile - tile;
    ctx.globalAlpha = .58;
    for (let x = offsetX; x < W + tile; x += tile) for (let y = offsetY; y < H + tile; y += tile) ctx.drawImage(images.city, x, y, tile, tile);
    ctx.globalAlpha = 1; ctx.fillStyle = '#02061755'; ctx.fillRect(0, 0, W, H);
  }
  const shakeX = S.shake ? random(-S.shake, S.shake) : 0, shakeY = S.shake ? random(-S.shake, S.shake) : 0;
  ctx.save(); ctx.translate(W / 2 - S.x + shakeX, H / 2 - S.y + shakeY);
  ctx.strokeStyle = '#4ccfff12'; ctx.lineWidth = 1;
  const grid = 72, gridX = Math.floor((S.x - W) / grid) * grid, gridY = Math.floor((S.y - H) / grid) * grid;
  ctx.beginPath();
  for (let x = gridX; x < S.x + W; x += grid) { ctx.moveTo(x, S.y - H); ctx.lineTo(x, S.y + H); }
  for (let y = gridY; y < S.y + H; y += grid) { ctx.moveTo(S.x - W, y); ctx.lineTo(S.x + W, y); }
  ctx.stroke();
  if (S.interior?.active) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#39d97a99'; ctx.lineWidth = 6; ctx.shadowBlur = lowFxActive() ? 0 : 22; ctx.shadowColor = '#39d97a';
    ctx.beginPath(); ctx.arc(0, 0, INTERIOR_ARENA_RADIUS, 0, TAU); ctx.stroke(); ctx.restore();
  }

  drawHazards(W, H);
  for (const gem of S.gems) { if (!visibleWorld(gem.x, gem.y, W, H, 70)) continue; const bob = Math.sin(t * .006 + gem.x) * 3; sprite(images.vfx, 1, 1, 3, 2, gem.x - 24, gem.y - 24 + bob, 48, 48); }
  for (const chest of S.chests) {
    if (!visibleWorld(chest.x, chest.y, W, H, 90)) continue;
    const bob = Math.sin(t * .007 + chest.phase) * 7, size = 42 + Math.sin(t * .009) * 4;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffd34e'; ctx.shadowBlur = 24; ctx.shadowColor = '#ffb92f'; ctx.translate(chest.x, chest.y + bob); ctx.rotate(t * .0015); ctx.fillRect(-size / 2, -size / 2, size, size); ctx.fillStyle = '#fff3a4'; ctx.fillRect(-size * .2, -size * .2, size * .4, size * .4); ctx.restore();
  }
  for (const mob of S.mobs) if (visibleWorld(mob.x, mob.y, W, H, mob.kind === 'boss' ? 190 : 110)) drawMob(mob, t);
  for (const ally of S.allies) if (visibleWorld(ally.x, ally.y, W, H, 150)) drawAlly(ally, t);
  drawProjectiles(); drawEffects();
  for (const particle of S.particles) { if (!visibleWorld(particle.x, particle.y, W, H, 50)) continue; ctx.save(); ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1); ctx.fillStyle = particle.color; ctx.shadowBlur = lowFxActive() ? 0 : 8; ctx.shadowColor = particle.color; ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size); ctx.restore(); }
  drawOrbitals(t);

  const aimAngle = Math.atan2(S.aimY, S.aimX);
  if (S.saberLevel > 0 && S.playerClass === 'shadowmaster') {
    const spread = .5, len = Math.min(80, 42 + S.saberRange * .2);
    drawEnergyBlade(S.x + Math.cos(aimAngle + spread) * 16, S.y + Math.sin(aimAngle + spread) * 16, aimAngle + spread, len + Math.sin(t * .012) * 3, '#9c4dff', .88, true, true);
    drawEnergyBlade(S.x + Math.cos(aimAngle - spread) * 16, S.y + Math.sin(aimAngle - spread) * 16, aimAngle - spread, len + Math.sin(t * .012 + 1) * 3, '#9c4dff', .88, true, true);
  } else if (S.saberLevel > 0) drawEnergyBlade(S.x + Math.cos(aimAngle) * 18, S.y + Math.sin(aimAngle) * 18, aimAngle, Math.min(92, 48 + S.saberRange * .24) + Math.sin(t * .012) * 3, '#64f5ff', .88, true);
  const runFrame = Math.floor(t / 115) % 2, idleBob = Math.sin(t * .0032) * 2.2, frame = S.moving ? 2 + runFrame : 0;
  if (S.playerClass === 'shadowmaster' && S.shadowActive > 0) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .8;
    const auraSize = 130;
    ctx.translate(S.x, S.y); ctx.rotate(t * .0009); ctx.translate(-S.x, -S.y);
    sprite(images.darkAura, 0, 0, 1, 1, S.x - auraSize / 2, S.y - auraSize / 2, auraSize, auraSize);
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let ring = 0; ring < 2; ring++) {
      const spin = t * .0022 * (ring ? -1 : 1) + ring * 1.6;
      ctx.globalAlpha = .5 - ring * .15; ctx.strokeStyle = '#5a1a8f'; ctx.lineWidth = 6 - ring * 2; ctx.shadowBlur = lowFxActive() ? 0 : 20; ctx.shadowColor = '#9c4dff';
      ctx.beginPath(); ctx.arc(S.x, S.y, 34 + ring * 12 + Math.sin(t * .006 + ring) * 4, spin, spin + TAU * .72); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.shadowBlur = 28; ctx.shadowColor = '#36eaff';
  const playerAlpha = S.shadowActive > 0 ? .42 : S.inv > 0 && Math.floor(t / 70) % 2 ? .38 : 1;
  sprite(images.player, frame % 2, Math.floor(frame / 2), 2, 2, S.x - 56, S.y - 68 + (S.moving ? 0 : idleBob), 112, 112, playerAlpha, S.facing < 0);
  ctx.shadowBlur = 0;
  drawPlayerHitbox();
  drawPlayerHpBar();
  if (!S.moving && !settings.showHitbox) { ctx.strokeStyle = '#65efff66'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(S.x, S.y + 18, 27 + Math.sin(t * .004) * 3, 0, TAU); ctx.stroke(); }
  ctx.restore();
}

function drawMinimap(W) {
  const mobile = W < 760, radius = mobile ? 52 : 70, centerX = W - radius - 24, centerY = radius + (mobile ? 110 : 88), range = 1150;
  ctx.save(); ctx.fillStyle = '#071026dc'; ctx.strokeStyle = '#3edfff88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(centerX, centerY, radius * .68, 0, TAU); ctx.strokeStyle = '#3edfff22'; ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.arc(centerX, centerY, radius - 3, 0, TAU); ctx.clip();
  for (let gemIndex = 0; gemIndex < S.gems.length; gemIndex += mobile ? 3 : 1) {
    const gem = S.gems[gemIndex];
    const dx = (gem.x - S.x) / range * radius, dy = (gem.y - S.y) / range * radius;
    if (dx * dx + dy * dy < radius * radius) { ctx.fillStyle = '#48ffd5'; ctx.fillRect(centerX + dx - 1, centerY + dy - 1, 2, 2); }
  }
  for (const chest of S.chests) {
    let dx = (chest.x - S.x) / range * radius, dy = (chest.y - S.y) / range * radius, distance = Math.hypot(dx, dy);
    if (distance > radius - 5) { dx *= (radius - 5) / distance; dy *= (radius - 5) / distance; }
    ctx.fillStyle = '#ffd34e'; ctx.fillRect(centerX + dx - 4, centerY + dy - 4, 8, 8);
  }
  const mobStep = S.mobs.length > 140 ? 3 : S.mobs.length > 70 ? 2 : 1;
  for (let mobIndex = 0; mobIndex < S.mobs.length; mobIndex++) {
    const mob = S.mobs[mobIndex];
    if (mobStep > 1 && mobIndex % mobStep !== 0 && mob.kind !== 'boss' && mob.kind !== 'treasure' && mob.kind !== 'leviathan' && !mob.elite) continue;
    let dx = (mob.x - S.x) / range * radius, dy = (mob.y - S.y) / range * radius, distance = Math.hypot(dx, dy);
    if (distance > radius - 5) { dx *= (radius - 5) / distance; dy *= (radius - 5) / distance; }
    ctx.fillStyle = mob.kind === 'leviathan' ? '#39d9ff' : mob.kind === 'treasure' ? '#ffd34e' : mob.kind === 'boss' ? '#ff63e8' : mob.elite ? '#c879ff' : '#ff4f91';
    ctx.beginPath(); ctx.arc(centerX + dx, centerY + dy, mob.kind === 'leviathan' ? 8 : mob.kind === 'boss' ? 6 : mob.kind === 'treasure' ? 5 : mob.elite ? 3.5 : 2, 0, TAU); ctx.fill();
  }
  for (const ally of S.allies) {
    let dx = (ally.x - S.x) / range * radius, dy = (ally.y - S.y) / range * radius, distance = Math.hypot(dx, dy);
    if (distance > radius - 5) { dx *= (radius - 5) / distance; dy *= (radius - 5) / distance; }
    ctx.fillStyle = '#7dffb0'; ctx.beginPath(); ctx.arc(centerX + dx, centerY + dy, 5, 0, TAU); ctx.fill();
  }
  ctx.restore(); ctx.fillStyle = '#82f7ff'; ctx.beginPath(); ctx.moveTo(centerX, centerY - 6); ctx.lineTo(centerX + 5, centerY + 5); ctx.lineTo(centerX - 5, centerY + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7f93b5'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText(`${S.mobs.length} HOSTILES`, centerX, centerY + radius + 15); ctx.restore();
}

function drawJoystick() {
  if (!joy.on) return;
  ctx.strokeStyle = '#78f4ff88'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.sx, joy.sy, 64, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#78f4ff55'; ctx.beginPath(); ctx.arc(joy.sx + joy.x * 64, joy.sy + joy.y * 64, 24, 0, TAU); ctx.fill();
}

function updateHud() {
  ui.xp.style.width = `${Math.min(100, S.xp / S.nextXp * 100)}%`; ui.lv.textContent = `LV.${S.level}`;
  ui.hp.textContent = `♥ ${Math.ceil(S.hp)}/${S.maxHp}`; ui.kills.textContent = `✦ ${computeScore(S).toLocaleString()}`; ui.clock.textContent = formatTime(S.time);
  if (S.playerClass) {
    const def = classDefs.find(entry => entry.id === S.playerClass);
    ui.classBadge.classList.remove('hidden');
    const overloaded = S.playerClass === 'mechanic' && S.mechOverload > 0;
    const shadowed = S.playerClass === 'shadowmaster' && S.shadowActive > 0;
    ui.classBadge.textContent = overloaded ? '⚙ 과부하' : shadowed ? '⬛ 은신' : `${def?.icon || ''} ${classLabel(def || { id: S.playerClass, name: S.playerClass })}`;
    ui.classBadge.classList.toggle('active-state', overloaded || shadowed);
  } else ui.classBadge.classList.add('hidden');
  if (S.interior?.active && S.bossActive) {
    ui.bossName.textContent = `⚠ 숙주 · SWALLOWED HOST`;
    const remaining = Math.max(0, Math.ceil(S.interior.timer));
    ui.bossTimer.textContent = S.interior.exiting ? 'ESCAPING…' : `EXIT ${formatTime(remaining)}`; ui.bossTimer.classList.toggle('danger', remaining <= 15 && !S.interior.exiting);
    ui.bossBar.style.width = `${Math.max(0, S.bossActive.hp / S.bossActive.maxHp * 100)}%`; ui.bossHud.classList.remove('hidden');
  } else if (S.bossActive && !S.bossActive.dead) {
    const names = { oni: 'NEON ONI / 집행자', seraph: 'SERAPH EYE / 관측자', witch: 'RIFT EMPRESS / 균열 마녀', dragon: 'CYBER WYRM / 코어 드래곤' };
    const affixNames = { overclock: 'OVERCLOCK', minefield: 'MINEFIELD', echo: 'ECHO', hunter: 'HUNTER' };
    ui.bossName.textContent = `#${S.bossActive.number} ${names[S.bossActive.bossType]} · ${S.bossActive.affixes.map(id => affixNames[id]).join('+')}`;
    const remaining = Math.max(0, Math.ceil(S.bossActive.deadline - S.time)); ui.bossTimer.textContent = `LIMIT ${formatTime(remaining)}`; ui.bossTimer.classList.toggle('danger', remaining <= 10);
    ui.bossBar.style.width = `${Math.max(0, S.bossActive.hp / S.bossActive.maxHp * 100)}%`; ui.bossHud.classList.remove('hidden');
  } else ui.bossHud.classList.add('hidden');
}

function loop(now) {
  const dt = Math.min((now - last) / 1000, .033), W = innerWidth, H = innerHeight; last = now;
  if (S && running && !S.paused) update(dt, W, H);
  if (S) {
    drawWorld(W, H, now); drawMinimap(W); drawJoystick();
    if (now - lastHud > 80) { lastHud = now; updateHud(); }
  } else { ctx.fillStyle = '#03040d'; ctx.fillRect(0, 0, W, H); }
  requestAnimationFrame(loop);
}

initializeLanguage(); loadLeaderboard(); requestAnimationFrame(loop);
