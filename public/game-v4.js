'use strict';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const random = (min, max) => min + Math.random() * (max - min);

const ui = {
  hud: $('#hud'), xp: $('#xpbar'), lv: $('#lv'), hp: $('#hp'), kills: $('#kills'),
  clock: $('#clock'), sound: $('#sound'), build: $('#build'), radar: $('#radarLabel'),
  start: $('#start'), choices: $('#choices'), cards: $('#cards'), over: $('#over'),
  bossHud: $('#bossHud'), bossName: $('#bossName'), bossBar: $('#bossBar'),
  warning: $('#warning'), startRanks: $('#startRanks'), finalRanks: $('#finalRanks'),
  finalScore: $('#finalScore'), playerName: $('#playerName'), relicTray: $('#relicTray'),
  relicSlots: $('#relicSlots'), relicScreen: $('#relicScreen'), relicTitle: $('#relicTitle'),
  relicSub: $('#relicSub'), relicNew: $('#relicNew'), relicCards: $('#relicCards'),
};

const images = {
  player: new Image(), enemy: new Image(), vfx: new Image(), bosses: new Image(),
  city: new Image(), treasure: new Image(),
};
images.player.src = 'assets/astra-sd.png';
images.enemy.src = 'assets/shade-sd.png';
images.vfx.src = 'assets/vfx.png';
images.bosses.src = 'assets/bosses.png';
images.city.src = 'assets/cyber-city.png';
images.treasure.src = 'assets/jackpot-gremlin.png';

let S = null;
let running = false;
let last = performance.now();
let lastHud = 0;
let chosen = [];
const keys = new Set();
let joy = { on: false, id: -1, sx: 0, sy: 0, x: 0, y: 0 };

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

  return { init, resume, se, scene, toggle, setIntensity: (value) => { intensity = value; } };
})();

const upgrades = [
  { id: 'power', icon: '◆', name: '룬 증폭', desc: '모든 공격 피해량 +12%', max: 10, tags: ['projectile', 'saber', 'orbit'], apply: s => { s.damage *= 1.12; } },
  { id: 'haste', icon: '⌁', name: '영창 가속', desc: '성좌탄 공격 간격 13% 감소', max: 7, tags: ['projectile'], apply: s => { s.rate = Math.max(.1, s.rate * .87); } },
  { id: 'multishot', icon: '≋', name: '쌍성 궤도', desc: '동시에 발사하는 성좌탄 +1', max: 5, tags: ['projectile'], apply: s => { s.multishot++; } },
  { id: 'pierce', icon: '↠', name: '위상 관통', desc: '성좌탄 관통 횟수 +1', max: 6, tags: ['projectile'], apply: s => { s.pierce++; } },
  { id: 'critical', icon: '✦', name: '운명 간섭', desc: '치명타 확률 +8%, 배율 +0.18', max: 6, tags: ['projectile', 'saber'], apply: s => { s.crit += .08; s.critMult += .18; } },
  { id: 'blast', icon: '✺', name: '붕괴 잔향', desc: '명중 폭발 범위 +22', max: 6, tags: ['projectile', 'area'], apply: s => { s.blast += 22; } },
  { id: 'chain', icon: 'ϟ', name: '연쇄 낙뢰', desc: '주변 적에게 낙뢰 +1회', max: 5, tags: ['projectile', 'area'], apply: s => { s.chain++; } },
  { id: 'size', icon: '◉', name: '거대 성핵', desc: '성좌탄 크기 +18%, 피해 +10%', max: 6, tags: ['projectile'], apply: s => { s.shotScale *= 1.18; s.projectileMult *= 1.1; } },
  { id: 'orbit', icon: '☄', name: '수호 위성', desc: '공격 위성 +1, 위성 빌드 개방', max: 6, tags: ['orbit'], apply: s => { s.orbitals++; } },
  { id: 'orbit_speed', icon: '⟳', name: '초고속 공전', desc: '위성 회전 속도 +24%', max: 5, tags: ['orbit'], requires: s => s.orbitals > 0, apply: s => { s.orbitSpeed *= 1.24; } },
  { id: 'orbit_size', icon: '⊚', name: '거대 위성핵', desc: '위성 크기 +20%, 피해 +16%', max: 5, tags: ['orbit'], requires: s => s.orbitals > 0, apply: s => { s.orbitSize *= 1.2; s.orbitDamage *= 1.16; } },
  { id: 'orbit_range', icon: '◎', name: '이중 공전면', desc: '공전 반경 +16, 위성 피해 +10%', max: 4, tags: ['orbit'], requires: s => s.orbitals > 0, apply: s => { s.orbitRadius += 16; s.orbitDamage *= 1.1; } },
  { id: 'orbit_shock', icon: '✹', name: '초신성 방전', desc: '위성 명중 시 12% 확률로 범위 방전', max: 4, tags: ['orbit', 'area'], requires: s => s.orbitals > 0, apply: s => { s.orbitShock += .12; } },
  { id: 'orbit_pulse', icon: '◌', name: '맥동 성환', desc: '주기적으로 모든 위성이 충격파 방출', max: 3, tags: ['orbit', 'area'], requires: s => s.orbitals > 0, apply: s => { s.orbitPulse++; } },
  { id: 'saber', icon: '╱', name: '아스트랄 광검', desc: '초근접 광선검 개방 또는 피해 +32%', max: 6, tags: ['saber'], apply: s => { s.saberLevel++; s.saberDamage *= 1.32; } },
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
  { id: 'limit_power', icon: '∞', name: '한계 돌파 · 힘', desc: '모든 공격 피해량 +6%', max: 999, tags: ['projectile', 'saber', 'orbit'], weight: .12, requires: s => s.level >= 35, apply: s => { s.damage *= 1.06; } },
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
  { id: 'arc_cell', rarity: 0, icon: '◆', name: '증폭 아크 셀', desc: '모든 공격 피해 +15%', tags: ['projectile', 'saber', 'orbit'], equip: s => { s.damageMult *= 1.15; }, unequip: s => { s.damageMult /= 1.15; } },
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
  { id: 'soul_battery', rarity: 2, icon: '♠', name: '영혼 배터리', desc: '일반 적 12킬마다 체력 2 회복, 모든 피해 +12%', tags: ['survival', 'projectile', 'saber', 'orbit'], equip: s => { s.damageMult *= 1.12; }, unequip: s => { s.damageMult /= 1.12; }, onKill: s => relicKillTick(s, 'soul_battery', 12, 2) },
  { id: 'event_horizon', rarity: 3, icon: '◎', name: '사건의 지평선', desc: '위성 +2, 크기 +45%, 피해 +70%, 충격파', tags: ['orbit', 'area'], equip: s => { s.orbitals += 2; s.orbitSize *= 1.45; s.orbitDamage *= 1.7; s.orbitPulse++; }, unequip: s => { s.orbitals -= 2; s.orbitSize /= 1.45; s.orbitDamage /= 1.7; s.orbitPulse--; } },
  { id: 'zero_edge', rarity: 3, icon: '⌁', name: '제로 엣지', desc: '광검 피해 +80%, 속도 +33%, 잔상 베기 +1', tags: ['saber'], equip: s => { s.saberDamage *= 1.8; s.saberRate *= .75; s.saberEcho++; }, unequip: s => { s.saberDamage /= 1.8; s.saberRate /= .75; s.saberEcho--; } },
  { id: 'phoenix', rarity: 3, icon: '♨', name: '불사조 커널', desc: '1회 치명상을 무시하고 체력 40% 부활', tags: ['survival'], equip: s => { s.maxHp += 10; }, unequip: s => { s.maxHp -= 10; s.hp = Math.min(s.hp, s.maxHp); } },
  { id: 'rift_crown', rarity: 3, icon: '♛', name: '균열 왕관', desc: '모든 피해 +35%, 경험치 +25%', tags: ['projectile', 'saber', 'orbit', 'growth'], equip: s => { s.damageMult *= 1.35; s.xpGain *= 1.25; }, unequip: s => { s.damageMult /= 1.35; s.xpGain /= 1.25; } },
  { id: 'singularity', rarity: 4, icon: '✺', name: '아르카나 특이점', desc: '모든 피해 +60%, 각 빌드 추가 피해 +25%', tags: ['projectile', 'saber', 'orbit'], equip: s => { s.damageMult *= 1.6; s.projectileMult *= 1.25; s.saberMult *= 1.25; s.orbitMult *= 1.25; }, unequip: s => { s.damageMult /= 1.6; s.projectileMult /= 1.25; s.saberMult /= 1.25; s.orbitMult /= 1.25; } },
  { id: 'immortal', rarity: 4, icon: '∞', name: '불멸 회로', desc: '최대 체력 +30, 재생 +1, 일반 적 8킬마다 2 회복', tags: ['survival'], equip: (s, first) => { s.maxHp += 30; if (first) s.hp += 30; s.regen += 1; }, unequip: s => { s.maxHp -= 30; s.hp = Math.min(s.hp, s.maxHp); s.regen -= 1; }, onKill: s => relicKillTick(s, 'immortal', 8, 2) },
  { id: 'godspeed', rarity: 4, icon: '»', name: '신속 연산기관', desc: '이동 +25%, 성좌탄·광검·위성 속도 대폭 증가', tags: ['mobility', 'projectile', 'saber', 'orbit'], equip: s => { s.speed *= 1.25; s.rate *= .8; s.saberRate *= .8; s.orbitSpeed *= 1.5; }, unequip: s => { s.speed /= 1.25; s.rate /= .8; s.saberRate /= .8; s.orbitSpeed /= 1.5; } },
  { id: 'midas', rarity: 4, icon: '¤', name: '미다스 바이러스', desc: '잭팟 그렘린 출현 간격 -45%, 유물 등급 보정', tags: ['growth'], equip: s => { rescaleTreasureTimer(s, .55); s.treasureRateMult *= .55; s.rarityBias++; }, unequip: s => { rescaleTreasureTimer(s, 1 / .55); s.treasureRateMult /= .55; s.rarityBias--; } },
];

const relicById = new Map(relics.map(relic => [relic.id, relic]));
const upgradeById = new Map(upgrades.map(upgrade => [upgrade.id, upgrade]));
const hasRelic = (id) => Boolean(S?.relics.some(relic => relic.id === id));
const relicLevel = (id) => S?.relics.find(relic => relic.id === id)?.level || 0;

function relicKillTick(state, id, interval, heal) {
  const level = state.relics.find(relic => relic.id === id)?.level || 1;
  interval = Math.max(3, Math.ceil(interval / (1 + (level - 1) * .35)));
  heal += Math.floor((level - 1) / 2);
  const key = `kills:${id}`; state.relicUses[key] = (state.relicUses[key] || 0) + 1;
  if (state.relicUses[key] >= interval) { state.relicUses[key] = 0; state.hp = Math.min(state.maxHp, state.hp + heal); }
}

function rescaleTreasureTimer(state, factor) {
  if (Number.isFinite(state.nextTreasureAt)) state.nextTreasureAt = state.time + Math.max(2, state.nextTreasureAt - state.time) * factor;
}

function fresh() {
  return {
    x: 0, y: 0, hp: 50, maxHp: 50, speed: 250, facing: 1, aimX: 1, aimY: 0,
    damage: 2.4, damageMult: 1, projectileMult: 1, saberMult: 1, orbitMult: 1,
    rate: .54, multishot: 1, pierce: 0, crit: .07, critMult: 1.75,
    blast: 0, blastDamage: .35, chain: 0, chainDamage: .28, shotScale: 1,
    orbitals: 0, orbitSpeed: 2.5, orbitRadius: 78, orbitSize: 1, orbitDamage: .72,
    orbitCooldown: .45, orbitShock: 0, orbitPulse: 0, orbitPulseClock: 4,
    saberLevel: 0, saberDamage: 1.8, saberRange: 118, saberArc: 1.38,
    saberRate: 1.02, saberClock: 0, saberEcho: 0, saberGuard: 0, saberActive: 0,
    magnet: 280, magnetMult: 1, regen: 0, guard: 0, xpGain: 1,
    shotClock: 0, spawnClock: 0, healClock: 0, time: 0, xp: 0, nextXp: 5,
    level: 1, kills: 0, bossesKilled: 0, inv: 0, moving: false, paused: false,
    over: false, victory: false, submitted: false, score: 0, volleyCount: 0,
    mobs: [], shots: [], delayedVolleys: [], enemyShots: [], hazards: [], gems: [],
    chests: [], effects: [], particles: [], ranks: {}, orbitHits: new Map(),
    rewardQueue: [], activeReward: null, relics: [], acquiredRelics: new Set(), relicSlots: 3, rarityBias: 0,
    treasureRateMult: 1, nextTreasureAt: random(34, 48), treasureNumber: 0,
    nextBossAt: random(44, 52), bossIndex: 0, bossActive: null, bossWarned: false,
    nextWorldEvent: random(58, 72), worldEventIndex: 0, slotPity: 0,
    shake: 0, relicUses: {}, temporarySpeed: 1, temporarySpeedClock: 0,
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function cleanName() {
  const value = (ui.playerName.value || 'ASTRA').trim().replace(/[^0-9A-Za-z가-힣_\- ]/g, '').slice(0, 12);
  return value.length >= 2 ? value : 'ASTRA';
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), secs = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function renderRanks(target, rows, ownRank) {
  target.innerHTML = rows.length
    ? rows.map((row, index) => `<div class="rank-row ${row.victory ? 'win' : ''}"><span>${index + 1}</span><b>${escapeHtml(row.player)}</b><em>${Number(row.score).toLocaleString()}</em><span>${formatTime(row.duration)}</span></div>`).join('') + (ownRank ? `<div class="rank-status">이번 기록 순위: #${ownRank}</div>` : '')
    : '<div class="rank-status">아직 등록된 기록이 없습니다.</div>';
}

async function loadLeaderboard(target = ui.startRanks) {
  try {
    const response = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const data = await response.json(); renderRanks(target, data.scores || []);
  } catch { target.innerHTML = '<div class="rank-status">온라인 랭킹 연결 대기 중</div>'; }
}

async function submitScore() {
  if (!S || S.submitted) return;
  S.submitted = true; ui.finalRanks.innerHTML = '<div class="rank-status">점수 등록 중…</div>';
  try {
    const response = await fetch('/api/leaderboard', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ player: cleanName(), kills: S.kills, level: S.level, duration: Math.floor(S.time), victory: S.bossesKilled > 0, bosses: S.bossesKilled }),
    });
    if (!response.ok) throw new Error();
    const data = await response.json(); S.score = Number(data.score ?? S.score); ui.finalScore.textContent = `SCORE ${S.score.toLocaleString()} · RIFT DEPTH ${S.bossesKilled}`; renderRanks(ui.finalRanks, data.scores || [], data.rank);
  } catch { ui.finalRanks.innerHTML = '<div class="rank-status">점수 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.</div>'; }
}

async function begin() {
  await AudioEngine.init(); AudioEngine.scene('battle');
  S = fresh(); running = true; chosen = [];
  ui.start.classList.add('hidden'); ui.over.classList.add('hidden'); ui.choices.classList.add('hidden'); ui.relicScreen.classList.add('hidden');
  ui.hud.classList.remove('hidden'); ui.build.classList.remove('hidden'); ui.radar.classList.remove('hidden'); ui.relicTray.classList.remove('hidden');
  ui.bossHud.classList.add('hidden'); updateBuild(); updateRelicTray();
  const openingOffset = Math.random() * TAU;
  for (let i = 0; i < 18; i++) {
    const angle = openingOffset + i * TAU / 18;
    spawnEnemy(innerWidth, innerHeight, { angle, distance: edgeSpawnDistance(innerWidth, innerHeight, angle, 42), ignoreCap: true });
  }
  S.spawnClock = .28;
}

function endGame() {
  if (S.over) return;
  S.over = true; S.victory = S.bossesKilled > 0; running = false;
  S.score = S.kills * 10 + S.level * 120 + Math.floor(S.time) * 4 + S.bossesKilled * 1000 + (S.victory ? 2500 : 0);
  AudioEngine.se('over'); AudioEngine.scene('over');
  $('#resultTime').textContent = formatTime(S.time); $('#resultKills').textContent = S.kills;
  $('#resultBosses').textContent = S.bossesKilled; $('#resultLevel').textContent = S.level;
  ui.finalScore.textContent = `SCORE ${S.score.toLocaleString()} · RIFT DEPTH ${S.bossesKilled}`;
  ui.over.querySelector('h2').textContent = '작전 종료'; ui.bossHud.classList.add('hidden');
  ui.choices.classList.add('hidden'); ui.relicScreen.classList.add('hidden'); ui.over.classList.remove('hidden'); submitScore();
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
  return upgrades.filter(upgrade => (S.ranks[upgrade.id] || 0) < upgrade.max && (!upgrade.requires || upgrade.requires(S)));
}

function enqueueReward(reward) {
  S.rewardQueue.push(reward); processRewards();
}

function queueChoice() { enqueueReward({ type: 'level' }); }
function queueRelic(source = 'treasure', tier = 1) { enqueueReward({ type: 'relic', source, tier }); }

function processRewards() {
  if (!S || S.paused || S.over || !S.rewardQueue.length) return;
  const reward = S.rewardQueue.shift(); S.activeReward = reward;
  if (reward.type === 'level') openLevelChoices(); else openRelicReward(reward);
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
    button.className = 'choice';
    button.innerHTML = `<span class="icon">${upgrade.icon}</span><strong>${upgrade.name}</strong><small>${upgrade.desc}</small><em>RANK ${rank} → ${rank + 1} · [${index + 1}]</em>`;
    button.onclick = () => choose(index); ui.cards.appendChild(button);
  });
  S.paused = true; AudioEngine.se('level'); AudioEngine.scene('choice'); ui.choices.classList.remove('hidden');
}

function choose(index) {
  if (!S?.paused || S.activeReward?.type !== 'level') return;
  const upgrade = chosen[index]; if (!upgrade) return;
  upgrade.apply(S); S.ranks[upgrade.id] = (S.ranks[upgrade.id] || 0) + 1;
  effect('level', S.x, S.y, { life: .85, max: .85 });
  ui.choices.classList.add('hidden'); AudioEngine.se('select'); finishReward(`${upgrade.icon} ${upgrade.name}  RANK ${S.ranks[upgrade.id]}`);
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
  button.innerHTML = `<span class="relic-icon">${relic.icon}</span><span class="rarity">${rarity.name} RELIC</span><strong>${relic.name}</strong><small>${relic.desc}</small><em>${label}</em>`;
  button.onclick = action; return button;
}

function rollRelicAward(reward) {
  const inventoryFull = S.relics.length >= S.relicSlots;
  const candidates = inventoryFull ? S.relics.map(item => relicById.get(item.id)) : relics;
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
  S.paused = true; S.relicRoulette = true; S.relicCandidate = null; S.relicReplaceIndex = null;
  const result = rollRelicAward(reward); S.relicRouletteResult = result;
  ui.relicTitle.textContent = reward.source === 'boss' ? '보스 유물 슬롯' : '잭팟 유물 슬롯';
  ui.relicSub.textContent = S.relics.length >= S.relicSlots ? '슬롯이 가득 차 중복 유물이 나오면 자동으로 레벨업합니다' : '획득 유물이 자동으로 결정됩니다';
  ui.relicNew.innerHTML = ''; ui.relicCards.innerHTML = ''; ui.relicScreen.classList.remove('hidden'); AudioEngine.scene('choice');
  let tick = 0;
  const spin = () => {
    const preview = tick >= 18 ? result : relics[Math.floor(Math.random() * relics.length)];
    const rarity = rarities[preview.rarity], currentLevel = relicLevel(preview.id);
    ui.relicCards.innerHTML = `<div class="relic-card" style="--rarity:${rarity.color};grid-column:1/-1;min-width:min(82vw,360px);margin:auto;cursor:default"><span class="relic-icon">${preview.icon}</span><span class="rarity">${tick >= 18 ? rarity.name : 'SEARCHING'} RELIC</span><strong>${preview.name}</strong><small>${tick >= 18 ? preview.desc : '공명 주파수 탐색 중…'}</small><em>${tick >= 18 ? (currentLevel ? `LV.${currentLevel} → LV.${currentLevel + 1}` : 'NEW RELIC') : '◈ ◇ ◈'}</em></div>`;
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
    updateRelicTray(); finishReward(`${existing.icon} ${existing.name} · RELIC LV.${existing.level}`); return;
  }
  const instance = { ...definition, level: 1 }, first = !S.acquiredRelics.has(instance.id);
  S.acquiredRelics.add(instance.id); S.relics.push(instance); instance.equip(S, first);
  effect('relic', S.x, S.y, { life: 1.15, max: 1.15, color: rarities[instance.rarity].color });
  updateRelicTray(); finishReward(`${instance.icon} ${rarities[instance.rarity].name} 유물 · ${instance.name}`);
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
  ui.relicNew.innerHTML = `<div class="relic-new" style="--rarity:${rarity.color}">신규 <b>${rarity.name} · ${candidate.icon} ${candidate.name}</b> — ${candidate.desc}</div>`;
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
  ui.relicNew.innerHTML = `<div class="relic-new" style="--rarity:${newRarity.color}">OLD <b style="color:${oldRarity.color}">${old.icon} ${old.name}</b> — ${old.desc}<br>NEW <b>${candidate.icon} ${candidate.name}</b> — ${candidate.desc}</div>`;
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
  old.unequip(S); S.relics[index] = candidate; candidate.equip(S, first);
  effect('relic', S.x, S.y, { life: 1.1, max: 1.1, color: rarities[candidate.rarity].color });
  updateRelicTray(); finishReward(`${old.name} → ${candidate.name}`);
}

function salvageRelic(relic) {
  const rarity = rarities[relic.rarity]; S.xp += S.nextXp * rarity.salvage;
  S.hp = Math.min(S.maxHp, S.hp + [2, 3, 5, 9, S.maxHp][relic.rarity]);
  finishReward(`${relic.name} 분해 · 공명 에너지 회수`); processLevelUps();
}

function finishReward(message) {
  ui.choices.classList.add('hidden'); ui.relicScreen.classList.add('hidden');
  S.paused = false; S.activeReward = null; S.relicRoulette = false; S.relicCandidate = null; S.relicReplaceIndex = null;
  AudioEngine.se('select'); AudioEngine.scene('battle'); if (message) showToast(message);
  updateBuild(); updateRelicTray(); setTimeout(processRewards, 120);
}

function updateBuild() {
  ui.build.innerHTML = Object.entries(S.ranks).map(([id, rank]) => {
    const upgrade = upgradeById.get(id); return upgrade ? `<span>${upgrade.icon} ${upgrade.name} ${rank}</span>` : '';
  }).join('');
}

function updateRelicTray() {
  ui.relicSlots.innerHTML = '';
  for (let i = 0; i < S.relicSlots; i++) {
    const relic = S.relics[i], slot = document.createElement('span'); slot.className = `relic-slot${relic ? '' : ' empty'}`;
    slot.innerHTML = relic ? `${relic.icon}<small>LV.${relic.level || 1}</small>` : '＋'; slot.title = relic ? `${rarities[relic.rarity].name} · ${relic.name} LV.${relic.level || 1}: ${relic.desc}` : '빈 유물 슬롯';
    if (relic) slot.style.setProperty('--rarity', rarities[relic.rarity].color); ui.relicSlots.appendChild(slot);
  }
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
  if (S.effects.length >= 220 && type === 'hit') return;
  if (S.effects.length >= 280) S.effects.shift();
  S.effects.push({ type, x, y, life: .35, max: .35, ...extra });
}
function burst(x, y, color, count = 8, speed = 150) {
  for (let i = 0; i < count && S.particles.length < 260; i++) {
    const angle = Math.random() * TAU, velocity = random(speed * .35, speed);
    S.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: random(.22, .55), max: .55, color, size: random(1.5, 4) });
  }
}

function resize() {
  const dpr = Math.min(devicePixelRatio, innerWidth < 760 ? 1.5 : 2); canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize(); addEventListener('resize', resize);

addEventListener('keydown', event => {
  AudioEngine.resume(); const key = event.key.toLowerCase(); keys.add(key);
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) event.preventDefault();
  if (key === 'm') toggleSound();
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
canvas.addEventListener('pointerdown', event => {
  AudioEngine.resume(); if (!running || S?.paused) return;
  joy = { on: true, id: event.pointerId, sx: event.clientX, sy: event.clientY, x: 0, y: 0 }; canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!joy.on || event.pointerId !== joy.id) return;
  const dx = event.clientX - joy.sx, dy = event.clientY - joy.sy, length = Math.hypot(dx, dy);
  joy.x = dx / Math.max(length, 64); joy.y = dy / Math.max(length, 64);
});
canvas.addEventListener('pointerup', () => { joy.on = false; joy.x = joy.y = 0; });
canvas.addEventListener('pointercancel', () => { joy.on = false; joy.x = joy.y = 0; });

function toggleSound() { const on = AudioEngine.toggle(); ui.sound.textContent = on ? 'SOUND ON' : 'MUTED'; }
ui.sound.onclick = toggleSound; $('#startButton').onclick = begin; $('#retry').onclick = begin;

function difficultyScale() {
  const time = S.time;
  return 1 + time / 170 + Math.pow(time / 420, 1.35);
}

function edgeSpawnDistance(W, H, angle, padding = 76) {
  const horizontal = (W / 2 + padding) / Math.max(.08, Math.abs(Math.cos(angle)));
  const vertical = (H / 2 + padding) / Math.max(.08, Math.abs(Math.sin(angle)));
  return Math.min(horizontal, vertical);
}

function enemyDamageScale() { return 1 + Math.floor(S.time / 165); }

function chooseArchetype() {
  const roll = Math.random(), time = S.time;
  const bomber = time > 300 ? Math.min(.09, (time - 300) / 2400) : 0;
  const splitter = time > 190 ? Math.min(.11, (time - 190) / 1700) : 0;
  const charger = time > 105 ? Math.min(.15, (time - 105) / 1150) : 0;
  const gunner = time > 52 ? Math.min(.19, (time - 52) / 850) : 0;
  if (roll < bomber) return 'bomber';
  if (roll < bomber + splitter) return 'splitter';
  if (roll < bomber + splitter + charger) return 'charger';
  if (roll < bomber + splitter + charger + gunner) return 'gunner';
  return 'stalker';
}

function spawnEnemy(W, H, options = {}) {
  if (S.mobs.length >= 190) return;
  const cap = Math.min(170, 82 + Math.floor(S.time * .14));
  if (!options.ignoreCap && S.mobs.filter(mob => mob.kind === 'mob').length >= cap) return;
  const angle = options.angle ?? Math.random() * TAU, distance = options.distance ?? edgeSpawnDistance(W, H, angle, random(58, 92));
  const eliteChance = clamp((S.time - 20) / 620, 0, .48), elite = options.elite ?? Math.random() < eliteChance;
  const scale = difficultyScale(), baseHp = Math.max(2, 3.2 * scale), archetype = options.archetype || chooseArchetype();
  const archetypeHp = { stalker: 1, gunner: 1.25, charger: 1.45, splitter: 1.6, bomber: 1.3 }[archetype];
  const hp = Math.ceil(baseHp * archetypeHp * (elite ? 2.8 : 1) * (options.child ? .42 : 1));
  const baseSpeed = Math.min(150, 61 + S.time * .075) * (options.child ? 1.18 : 1);
  S.mobs.push({
    kind: 'mob', archetype, x: options.x ?? S.x + Math.cos(angle) * distance,
    y: options.y ?? S.y + Math.sin(angle) * distance, r: options.child ? 13 : elite ? 28 : 18 + Math.random() * 5,
    hp, maxHp: hp, speed: baseSpeed * (elite ? .86 : 1), damage: enemyDamageScale() + (elite ? 1 : 0),
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
  const hp = Math.round(base * Math.pow(1.42, cycle) * (1 + S.time / 900) * (modifier === 'armored' ? 1.25 : 1));
  const boss = {
    kind: 'boss', bossType: type, tier, number, cycle, modifier, affixes: bossAffixes(number),
    x: S.x + Math.cos(angle) * distance, y: S.y + Math.sin(angle) * distance,
    r: tier === 3 ? 62 : 46, hp, maxHp: hp,
    speed: (tier === 3 ? 51 : 58) * (modifier === 'swift' ? 1.18 : 1) * Math.min(1.35, 1 + cycle * .05),
    damage: 2 + Math.floor(number / 2), elite: true, slow: 0, frozen: 0, phase: 0,
    id: Math.random(), age: 0, patternClock: 1.15, specialClock: 3.8, affixClock: 4.5,
    state: 'move', stateClock: 0, vx: 0, vy: 0, facing: 1, hitFlash: 0,
  };
  S.mobs.push(boss); S.bossActive = boss; S.bossIndex++; S.bossWarned = false; S.nextBossAt = Infinity;
  AudioEngine.se('boss'); showWarning(tier === 3 ? `RIFT LORD #${number}` : `ANOMALY BOSS #${number}`); ui.bossHud.classList.remove('hidden');
}

function enemyBullet(x, y, angle, speed = 230, radius = 7, damage = enemyDamageScale()) {
  if (S.enemyShots.length >= 440) return;
  S.enemyShots.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: radius, damage, life: 7 });
}

function radial(mob, count, speed, offset = S.time * .7) {
  const bulletSpeed = speed * Math.min(1.65, 1 + (mob.number || 0) * .045);
  for (let i = 0; i < count; i++) enemyBullet(mob.x, mob.y, offset + i * TAU / count, bulletSpeed, mob.tier === 3 ? 9 : 7, mob.damage || enemyDamageScale());
}

function pointSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, lengthSq = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSq, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function angleDelta(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }

function updateBoss(mob, dt) {
  mob.age += dt; mob.patternClock -= dt; mob.specialClock -= dt; mob.affixClock -= dt; mob.stateClock -= dt;
  mob.hitFlash -= dt; mob.frozen -= dt; mob.slow -= dt;
  const dx = S.x - mob.x, dy = S.y - mob.y, distance = Math.hypot(dx, dy) || 1, angle = Math.atan2(dy, dx);
  mob.facing = dx < 0 ? -1 : 1;
  const rageThreshold = Math.min(.75, .5 + mob.number * .025), rage = mob.hp < mob.maxHp * rageThreshold;
  const cadence = Math.max(.48, Math.pow(.965, mob.number - 1)) * (mob.affixes.includes('overclock') ? .78 : 1) * (mob.modifier === 'unstable' ? .85 : 1);
  const movementScale = mob.frozen > 0 ? .25 : mob.slow > 0 ? .72 : 1;

  if (mob.bossType === 'oni') {
    if (mob.state === 'dash') {
      mob.x += mob.vx * dt * movementScale; mob.y += mob.vy * dt * movementScale;
      if (mob.stateClock <= 0) mob.state = 'move';
    } else if (mob.state === 'telegraph') {
      if (mob.stateClock <= 0) { mob.state = 'dash'; mob.stateClock = .5; mob.vx = Math.cos(angle) * (rage ? 790 : 680); mob.vy = Math.sin(angle) * (rage ? 790 : 680); }
    } else {
      mob.x += dx / distance * mob.speed * .58 * dt * movementScale; mob.y += dy / distance * mob.speed * .58 * dt * movementScale;
      if (mob.patternClock <= 0) {
        mob.state = 'telegraph'; mob.stateClock = .72; mob.patternClock = (rage ? 2.25 : 3.05) * cadence;
        S.hazards.push({ x: mob.x, y: mob.y, tx: S.x, ty: S.y, r: 34, warmup: .72, life: 1.35, type: 'line', damage: mob.damage });
      }
    }
  } else if (mob.bossType === 'seraph') {
    const desired = 310, direction = distance > desired + 35 ? 1 : distance < desired - 35 ? -1 : 0;
    mob.x += dx / distance * mob.speed * direction * dt * movementScale; mob.y += dy / distance * mob.speed * direction * dt * movementScale;
    if (mob.patternClock <= 0) { radial(mob, rage ? 16 : 11, rage ? 285 : 230); mob.patternClock = (rage ? 1.6 : 2.3) * cadence; }
    if (mob.specialClock <= 0) {
      for (let i = -2; i <= 2; i++) enemyBullet(mob.x, mob.y, angle + i * .11, 340, 8, mob.damage);
      mob.specialClock = 4.2 * cadence;
    }
  } else if (mob.bossType === 'witch') {
    const tangent = angle + Math.PI / 2;
    mob.x += (Math.cos(angle) * (distance > 340 ? 38 : -18) + Math.cos(tangent) * 58) * dt * movementScale;
    mob.y += (Math.sin(angle) * (distance > 340 ? 38 : -18) + Math.sin(tangent) * 58) * dt * movementScale;
    if (mob.patternClock <= 0) {
      for (let i = 0; i < (rage ? 6 : 4); i++) S.hazards.push({ x: S.x + random(-280, 280), y: S.y + random(-210, 210), r: 58, warmup: .95, life: 2.1, type: 'circle', damage: mob.damage + 1 });
      mob.patternClock = (rage ? 2.9 : 4) * cadence;
    }
    if (mob.specialClock <= 0) { radial(mob, 14 + Math.min(8, Math.floor(mob.number / 2)), 205); mob.specialClock = 5.2 * cadence; }
  } else {
    mob.x += dx / distance * mob.speed * .72 * dt * movementScale; mob.y += dy / distance * mob.speed * .72 * dt * movementScale;
    if (mob.patternClock <= 0) {
      const fan = Math.min(5, 3 + Math.floor(mob.number / 3));
      for (let i = -fan; i <= fan; i++) enemyBullet(mob.x, mob.y, angle + i * .12, rage ? 385 : 325, 9, mob.damage);
      mob.patternClock = (rage ? 1.35 : 2.05) * cadence;
    }
    if (mob.specialClock <= 0) { radial(mob, 18 + Math.min(8, mob.cycle * 2), 225); mob.specialClock = 4.8 * cadence; }
  }

  if (mob.affixClock <= 0) {
    if (mob.affixes.includes('minefield')) for (let i = 0; i < 3 + Math.min(3, mob.cycle); i++) S.hazards.push({ x: S.x + random(-230, 230), y: S.y + random(-170, 170), r: 52, warmup: .85, life: 1.9, type: 'circle', damage: mob.damage });
    if (mob.affixes.includes('echo')) radial(mob, 10 + Math.min(8, mob.cycle * 2), 245, S.time * .8 + .17);
    if (mob.affixes.includes('hunter')) for (let i = -1; i <= 1; i++) enemyBullet(mob.x, mob.y, angle + i * .16, 410, 8, mob.damage);
    mob.affixClock = Math.max(3.4, 6.2 - mob.cycle * .25);
  }
  if (mob.state === 'dash') mob.facing = mob.vx < 0 ? -1 : 1;
  if (distance < mob.r + 22) hurtPlayer(mob.damage);
}

function updateMob(mob, dt) {
  mob.age += dt; mob.hitFlash -= dt; mob.slow -= dt; mob.frozen -= dt; mob.stateClock -= dt; mob.shootClock -= dt; mob.specialClock -= dt;
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
  const movementScale = (mob.frozen > 0 ? .12 : mob.slow > 0 ? .72 : 1) * auraSlow;
  if (mob.archetype === 'gunner') {
    const desired = 275, direction = distance > desired + 35 ? 1 : distance < desired - 35 ? -1 : 0;
    mob.x += dx / distance * mob.speed * direction * dt * movementScale; mob.y += dy / distance * mob.speed * direction * dt * movementScale;
    if (mob.shootClock <= 0) { enemyBullet(mob.x, mob.y, angle, 255 + Math.min(100, S.time * .06), 7, mob.damage); mob.shootClock = random(2.2, 3.5); }
  } else if (mob.archetype === 'charger') {
    if (mob.state === 'dash') {
      mob.x += mob.vx * dt * movementScale; mob.y += mob.vy * dt * movementScale;
      if (mob.stateClock <= 0) mob.state = 'move';
    } else if (mob.state === 'telegraph') {
      if (mob.stateClock <= 0) { mob.state = 'dash'; mob.stateClock = .42; mob.vx = Math.cos(angle) * 500; mob.vy = Math.sin(angle) * 500; }
    } else {
      mob.x += dx / distance * mob.speed * dt * movementScale; mob.y += dy / distance * mob.speed * dt * movementScale;
      if (mob.specialClock <= 0) { mob.state = 'telegraph'; mob.stateClock = .65; mob.specialClock = random(3.8, 5.2); S.hazards.push({ x: mob.x, y: mob.y, tx: S.x, ty: S.y, r: 22, warmup: .65, life: 1.12, type: 'line', damage: mob.damage }); }
    }
  } else {
    mob.x += dx / distance * mob.speed * dt * movementScale; mob.y += dy / distance * mob.speed * dt * movementScale;
  }
  if (mob.state === 'dash') mob.facing = mob.vx < 0 ? -1 : 1;
  if (distance < mob.r + 21) hurtPlayer(mob.damage);
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

function createVolley(baseAngle, damageScale = 1, extra = 0) {
  const count = S.multishot + extra, spread = .15;
  for (let i = 0; i < count; i++) {
    const angle = baseAngle + (i - (count - 1) / 2) * spread, critical = Math.random() < S.crit;
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
  if (!S.moving) { S.aimX = Math.cos(base); S.aimY = Math.sin(base); S.facing = Math.cos(base) < 0 ? -1 : 1; }
  const splitLevel = relicLevel('split_core');
  const extra = splitLevel && S.volleyCount % Math.max(2, 5 - splitLevel) === 0 ? 2 + Math.floor((splitLevel - 1) / 2) : 0;
  createVolley(base, 1, extra);
  const echoLevel = relicLevel('echo_chamber');
  if (echoLevel && S.volleyCount % Math.max(3, 7 - echoLevel) === 0) S.delayedVolleys.push({ due: S.time + .12, angle: base, damage: Math.min(1, .65 + echoLevel * .1) });
  AudioEngine.se('fire');
}

function damageMob(mob, amount, kind = 'projectile', critical = false, alreadyScaled = false) {
  if (mob.dead || mob.hp <= 0) return 0;
  const typeMult = kind === 'saber' ? S.saberMult : kind === 'orbit' ? S.orbitMult : S.projectileMult;
  const frozenBonus = mob.frozen > 0 ? 1.25 : 1;
  const actual = alreadyScaled ? amount : amount * S.damageMult * typeMult * frozenBonus;
  mob.hp -= actual; mob.hitFlash = .08;
  const executionLevel = relicLevel('execution');
  if (executionLevel && mob.kind === 'mob' && mob.hp > 0 && mob.hp / mob.maxHp < Math.min(.35, .12 + executionLevel * .04)) mob.hp = 0;
  effect('hit', mob.x, mob.y, { life: critical ? .28 : .2, max: critical ? .28 : .2, critical, kind });
  if (critical) burst(mob.x, mob.y, '#ff71ef', 5, 120);
  return actual;
}

function hitMob(mob, projectile) {
  if (mob.hp <= 0 || projectile.hit.has(mob.id)) return;
  projectile.hit.add(mob.id);
  const dealt = damageMob(mob, projectile.damage, 'projectile', projectile.critical);
  AudioEngine.se('hit');
  if (S.blast > 0) {
    for (const near of S.mobs) if (near !== mob && near.hp > 0 && Math.hypot(near.x - mob.x, near.y - mob.y) < S.blast) damageMob(near, dealt * S.blastDamage, 'projectile', false, true);
    effect('ring', mob.x, mob.y, { life: .26, max: .26, radius: S.blast, color: '#d757ff' });
  }
  if (S.chain > 0) {
    const nearby = S.mobs.filter(near => near !== mob && near.hp > 0 && Math.hypot(near.x - mob.x, near.y - mob.y) < 210).sort((a, b) => Math.hypot(a.x - mob.x, a.y - mob.y) - Math.hypot(b.x - mob.x, b.y - mob.y)).slice(0, S.chain);
    nearby.forEach((near, index) => {
      if (Math.hypot(near.x - mob.x, near.y - mob.y) < 210) {
        damageMob(near, dealt * S.chainDamage, 'projectile', false, true);
        effect('chain', near.x, near.y, { life: .2, max: .2, fromX: index ? nearby[index - 1].x : mob.x, fromY: index ? nearby[index - 1].y : mob.y });
      }
    });
  }
  if (projectile.pierce > 0) projectile.pierce--; else projectile.life = 0;
}

function saberSlash() {
  if (!S.saberLevel) return;
  let target = null, best = Infinity;
  for (const mob of S.mobs) {
    const distance = Math.hypot(mob.x - S.x, mob.y - S.y);
    if (mob.dead || distance > S.saberRange + mob.r) continue;
    const priority = mob.kind === 'treasure' ? .55 : mob.kind === 'boss' ? .72 : 1;
    if (distance * priority < best) { best = distance * priority; target = mob; }
  }
  const base = target ? Math.atan2(target.y - S.y, target.x - S.x) : Math.atan2(S.aimY, S.aimX);
  const sweeps = 1 + S.saberEcho;
  for (let sweep = 0; sweep < sweeps; sweep++) {
    const angle = base + (sweep - (sweeps - 1) / 2) * .48;
    for (const mob of S.mobs) {
      const dx = mob.x - S.x, dy = mob.y - S.y, distance = Math.hypot(dx, dy);
      if (distance <= S.saberRange + mob.r && Math.abs(angleDelta(Math.atan2(dy, dx), angle)) <= S.saberArc / 2) {
        const critical = Math.random() < S.crit; damageMob(mob, S.damage * S.saberDamage * (critical ? S.critMult : 1), 'saber', critical);
      }
    }
    effect('saber', S.x, S.y, { life: .24, max: .24, angle, radius: S.saberRange, arc: S.saberArc, index: sweep });
  }
  S.aimX = Math.cos(base); S.aimY = Math.sin(base); if (!S.moving) S.facing = Math.cos(base) < 0 ? -1 : 1;
  S.saberActive = .22; S.shake = Math.max(S.shake, 2.5); AudioEngine.se('saber');
}

function orbitalPose(index) {
  const lane = index % 2, radius = S.orbitRadius + lane * 17;
  const speed = S.orbitSpeed * (lane ? -.84 : 1);
  const angle = S.time * speed + index * TAU / Math.max(1, S.orbitals);
  return { angle, radius, x: S.x + Math.cos(angle) * radius, y: S.y + Math.sin(angle) * radius };
}

function updateOrbitals(dt) {
  if (!S.orbitals) return;
  for (let i = 0; i < S.orbitals; i++) {
    const pose = orbitalPose(i), radius = 17 * S.orbitSize;
    for (const mob of S.mobs) {
      const key = `${mob.id}:${i}`, previous = S.orbitHits.get(key) || 0;
      const bladeEndX = pose.x + Math.cos(pose.angle + Math.PI / 2) * 36 * S.orbitSize;
      const bladeEndY = pose.y + Math.sin(pose.angle + Math.PI / 2) * 36 * S.orbitSize;
      const collides = i % 3 === 2
        ? pointSegmentDistance(mob.x, mob.y, pose.x, pose.y, bladeEndX, bladeEndY) < mob.r + 10 * S.orbitSize
        : Math.hypot(mob.x - pose.x, mob.y - pose.y) < mob.r + radius;
      if (mob.hp > 0 && S.time - previous > S.orbitCooldown && collides) {
        const dealt = damageMob(mob, S.damage * S.orbitDamage, 'orbit'); S.orbitHits.set(key, S.time);
        if (S.orbitShock > 0 && Math.random() < S.orbitShock) {
          for (const near of S.mobs) if (near !== mob && near.hp > 0 && Math.hypot(near.x - mob.x, near.y - mob.y) < 90) damageMob(near, dealt * .42, 'orbit', false, true);
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
        for (const mob of S.mobs) if (Math.hypot(mob.x - pose.x, mob.y - pose.y) < 115 + mob.r) damageMob(mob, S.damage * S.orbitDamage * .65, 'orbit');
      }
    }
  }
}

function hurtPlayer(amount = 1) {
  if (S.inv > 0 || S.over) return;
  const guardChance = clamp(S.guard + (S.saberActive > 0 ? S.saberGuard : 0), 0, .72);
  if (Math.random() < guardChance) {
    S.inv = .25; S.temporarySpeed = 1.3; S.temporarySpeedClock = 1.2; showToast('⬡ BLOCK'); effect('ring', S.x, S.y, { life: .35, max: .35, radius: 55, color: '#8afff5' }); return;
  }
  const phoenixLevel = relicLevel('phoenix'), phoenixUses = S.relicUses.phoenix || 0;
  if (S.hp - amount <= 0 && phoenixLevel && phoenixUses < phoenixLevel) {
    S.relicUses.phoenix = phoenixUses + 1; S.hp = S.maxHp * Math.min(.7, .35 + phoenixLevel * .05); S.inv = 2.5; effect('relic', S.x, S.y, { life: 1.4, max: 1.4, color: '#ff9f45' }); showWarning(`PHOENIX KERNEL // REBOOT ${S.relicUses.phoenix}/${phoenixLevel}`); return;
  }
  S.hp -= amount; S.inv = .55; S.shake = Math.max(S.shake, 7); AudioEngine.se('hurt'); damageFlash(); burst(S.x, S.y, '#ff3978', 10, 180);
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
  mob.dead = true; effect('death', mob.x, mob.y, { life: .55, max: .55, color: mob.kind === 'treasure' ? '#ffd34e' : '#f64eff' });
  const orbitPrefix = `${mob.id}:`; for (const key of S.orbitHits.keys()) if (key.startsWith(orbitPrefix)) S.orbitHits.delete(key);
  burst(mob.x, mob.y, mob.kind === 'treasure' ? '#ffd34e' : '#e950ff', mob.kind === 'boss' ? 24 : 8, mob.kind === 'boss' ? 250 : 150); AudioEngine.se('kill');
  if (mob.kind === 'boss') {
    S.kills += mob.tier * 15; S.bossesKilled++; S.bossActive = null; ui.bossHud.classList.add('hidden');
    S.xp += S.nextXp * (1.15 + mob.tier * .38); S.hp = Math.min(S.maxHp, S.hp + 5 + mob.tier * 3);
    if (Math.random() < relicDropChance('boss', mob.tier, mob.cycle)) {
      dropChest(mob.x, mob.y, 'boss', mob.tier, true); showToast(`BOSS #${mob.number} DOWN · RELIC DROP`);
    } else showToast(`BOSS #${mob.number} DOWN · NO RELIC`);
    S.nextBossAt = S.time + random(58, 72) + mob.tier * 4; S.bossWarned = false; S.shake = 14;
  } else if (mob.kind === 'treasure') {
    S.kills += 10;
    if (Math.random() < relicDropChance('treasure')) {
      dropChest(mob.x, mob.y, 'treasure', Math.min(3, 1 + Math.floor(S.time / 240))); showToast('JACKPOT GREMLIN DOWN · RELIC DROP');
    } else showToast('JACKPOT GREMLIN DOWN · NO RELIC');
    for (let i = 0; i < 12; i++) dropGem(mob.x + random(-55, 55), mob.y + random(-55, 55), 2 + Math.floor(S.time / 240));
    S.nextTreasureAt = S.time + random(48, 68) * S.treasureRateMult;
  } else {
    S.kills++; S.xp += .72 * S.xpGain;
    dropGem(mob.x, mob.y, (mob.elite ? 3 : 1) + Math.floor(S.time / 300));
    if (mob.archetype === 'splitter' && !mob.child) {
      for (let i = 0; i < 2; i++) spawnEnemy(W, H, { x: mob.x + random(-18, 18), y: mob.y + random(-18, 18), child: true, archetype: 'stalker', ignoreCap: true });
    }
    if (mob.archetype === 'bomber') S.hazards.push({ x: mob.x, y: mob.y, r: 76, warmup: .65, life: 1.35, type: 'circle', damage: mob.damage + 1 });
    onKillHooks();
  }
}

function triggerWorldEvent() {
  const unlocked = S.time < 150 ? ['crossfire', 'mines'] : ['crossfire', 'mines', 'laser'];
  const type = unlocked[S.worldEventIndex % unlocked.length]; S.worldEventIndex++;
  const damage = enemyDamageScale(), speed = 235 + Math.min(170, S.time * .08);
  if (type === 'crossfire') {
    const count = 10 + Math.min(10, Math.floor(S.time / 120));
    for (let i = 0; i < count; i++) {
      const angle = i * TAU / count + S.time, x = S.x + Math.cos(angle) * 560, y = S.y + Math.sin(angle) * 560;
      enemyBullet(x, y, angle + Math.PI, speed, 7, damage);
    }
    showWarning('RIFT PATTERN // CROSSFIRE');
  } else if (type === 'mines') {
    const count = 4 + Math.min(6, Math.floor(S.time / 150));
    for (let i = 0; i < count; i++) S.hazards.push({ x: S.x + random(-320, 320), y: S.y + random(-230, 230), r: 52, warmup: 1, life: 2.1, type: 'circle', damage: damage + 1 });
    showWarning('RIFT PATTERN // MINEFALL');
  } else {
    const angle = Math.random() * Math.PI;
    for (let i = -1; i <= 1; i++) {
      const offsetX = Math.cos(angle + Math.PI / 2) * i * 120, offsetY = Math.sin(angle + Math.PI / 2) * i * 120;
      S.hazards.push({ x: S.x + offsetX - Math.cos(angle) * 650, y: S.y + offsetY - Math.sin(angle) * 650, tx: S.x + offsetX + Math.cos(angle) * 650, ty: S.y + offsetY + Math.sin(angle) * 650, r: 28, warmup: .9, life: 1.55, type: 'line', damage: damage + 1 });
    }
    showWarning('RIFT PATTERN // LASER GRID');
  }
  AudioEngine.se('wave'); S.nextWorldEvent = S.time + random(Math.max(18, 32 - S.time / 90), Math.max(25, 44 - S.time / 110));
}

function processLevelUps() {
  let safety = 0;
  while (S.xp >= S.nextXp && safety++ < 6) {
    S.xp -= S.nextXp; S.level++; S.nextXp = Math.round(4 + 1.1 * S.level + .12 * S.level * S.level); S.rewardQueue.push({ type: 'level' });
  }
  processRewards();
}

function update(dt, W, H) {
  S.time += dt; S.inv -= dt; S.shotClock -= dt; S.saberClock -= dt; S.healClock += dt; S.saberActive -= dt;
  S.temporarySpeedClock -= dt; if (S.temporarySpeedClock <= 0) S.temporarySpeed = 1;
  S.shake = Math.max(0, S.shake - dt * 25); AudioEngine.setIntensity(Math.min(5, Math.floor(S.time / 60)));

  if (!S.bossActive && !S.bossWarned && S.time >= S.nextBossAt - 3) { S.bossWarned = true; showWarning('BOSS ANOMALY DETECTED'); }
  if (!S.bossActive && S.time >= S.nextBossAt) spawnBoss(W, H);
  if (S.time >= S.nextTreasureAt) spawnTreasure(W, H);
  if (S.time >= S.nextWorldEvent) triggerWorldEvent();

  let dx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
  let dy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
  if (joy.on) { dx = joy.x; dy = joy.y; }
  const length = Math.hypot(dx, dy) || 1; S.moving = Math.hypot(dx, dy) > .14;
  if (S.moving) { S.aimX = dx / length; S.aimY = dy / length; if (dx < -.05) S.facing = -1; else if (dx > .05) S.facing = 1; }
  S.x += dx / length * S.speed * S.temporarySpeed * dt; S.y += dy / length * S.speed * S.temporarySpeed * dt;

  if (S.regen > 0 && S.healClock >= 1) { S.healClock -= 1; S.hp = Math.min(S.maxHp, S.hp + S.regen); }
  if (S.spawnClock <= 0) {
    const regularCount = S.mobs.filter(mob => mob.kind === 'mob').length;
    const densityTarget = Math.min(170, 28 + Math.floor(S.time * .25));
    const deficit = Math.max(0, densityTarget - regularCount);
    const baseInterval = Math.max(.09, .5 / Math.pow(1 + S.time / 210, .76));
    const interval = deficit > 0 ? Math.min(.11, baseInterval) : baseInterval;
    const batch = deficit > 30 ? 4 : deficit > 16 ? 3 : deficit > 6 ? 2 : 1;
    S.spawnClock = interval * (S.bossActive ? 1.12 : 1);
    for (let i = 0; i < batch; i++) spawnEnemy(W, H);
  }
  if (S.shotClock <= 0) { S.shotClock = Math.max(.1, S.rate); fire(); }
  if (S.saberLevel > 0 && S.saberClock <= 0) { S.saberClock = Math.max(.2, S.saberRate); saberSlash(); }
  for (const delayed of S.delayedVolleys) if (!delayed.done && delayed.due <= S.time) { delayed.done = true; createVolley(delayed.angle, delayed.damage); }
  S.delayedVolleys = S.delayedVolleys.filter(delayed => !delayed.done);

  for (const mob of S.mobs) if (mob.hp <= 0 && !mob.dead) handleDeath(mob, W, H);
  S.mobs = S.mobs.filter(mob => !mob.dead);
  for (const mob of S.mobs) {
    if (mob.dead || mob.hp <= 0) continue;
    if (mob.kind === 'boss') updateBoss(mob, dt); else updateMob(mob, dt);
    if (S.over) return;
  }
  for (const projectile of S.shots) {
    projectile.trailX = projectile.x; projectile.trailY = projectile.y; projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.life -= dt;
    for (const mob of S.mobs) if (projectile.life > 0 && !mob.dead && Math.hypot(projectile.x - mob.x, projectile.y - mob.y) < mob.r + 8 * S.shotScale) hitMob(mob, projectile);
  }
  for (const projectile of S.enemyShots) {
    projectile.x += projectile.vx * dt; projectile.y += projectile.vy * dt; projectile.life -= dt;
    if (Math.hypot(projectile.x - S.x, projectile.y - S.y) < projectile.r + 18) { hurtPlayer(projectile.damage); projectile.life = 0; if (S.over) return; }
  }
  S.enemyShots = S.enemyShots.filter(projectile => projectile.life > 0 && Math.hypot(projectile.x - S.x, projectile.y - S.y) < 1700);

  for (const hazard of S.hazards) {
    hazard.warmup -= dt; hazard.life -= dt;
    if (hazard.warmup <= 0 && !hazard.hit) {
      const hit = hazard.type === 'circle'
        ? Math.hypot(hazard.x - S.x, hazard.y - S.y) < hazard.r + 16
        : pointSegmentDistance(S.x, S.y, hazard.x, hazard.y, hazard.tx, hazard.ty) < hazard.r + 15;
      if (hit) { hurtPlayer(hazard.damage); hazard.hit = true; if (S.over) return; }
    }
  }
  S.hazards = S.hazards.filter(hazard => hazard.life > 0);

  updateOrbitals(dt);
  for (const mob of S.mobs) if (mob.hp <= 0 && !mob.dead) handleDeath(mob, W, H);
  S.mobs = S.mobs.filter(mob => !mob.dead); S.shots = S.shots.filter(projectile => projectile.life > 0);
  if (S.orbitHits.size > 6000) S.orbitHits.clear();

  for (const gem of S.gems) {
    gem.life -= dt; const distance = Math.hypot(S.x - gem.x, S.y - gem.y);
    if (distance < S.magnet * S.magnetMult) { gem.x += (S.x - gem.x) / Math.max(1, distance) * 480 * dt; gem.y += (S.y - gem.y) / Math.max(1, distance) * 480 * dt; }
    if (distance < 30) { S.xp += gem.value * S.xpGain; gem.value = 0; AudioEngine.se('xp'); }
  }
  S.gems = S.gems.filter(gem => gem.value > 0 && gem.life > 0);

  for (const chest of S.chests) {
    chest.life -= dt; const distance = Math.hypot(S.x - chest.x, S.y - chest.y);
    if (distance < 230) { chest.x += (S.x - chest.x) / Math.max(1, distance) * 300 * dt; chest.y += (S.y - chest.y) / Math.max(1, distance) * 300 * dt; }
    if (!chest.rewarded && distance < 42 && !chest.collected) { chest.collected = true; queueRelic(chest.source, chest.tier); }
  }
  S.chests = S.chests.filter(chest => !chest.collected && chest.life > 0);

  for (const particle of S.particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= .96; particle.vy *= .96; particle.life -= dt; }
  S.particles = S.particles.filter(particle => particle.life > 0);
  for (const item of S.effects) item.life -= dt; S.effects = S.effects.filter(item => item.life > 0);
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

function drawHazards() {
  for (const hazard of S.hazards) {
    const ready = hazard.warmup <= 0; ctx.save();
    ctx.strokeStyle = ready ? '#ff2e72' : '#ff92bd'; ctx.fillStyle = ready ? '#ff175522' : '#ffccdd0d';
    ctx.lineWidth = ready ? 6 : 2; ctx.setLineDash(ready ? [] : [8, 8]); ctx.shadowBlur = ready ? 16 : 6; ctx.shadowColor = '#ff2a70';
    if (hazard.type === 'circle') {
      const progress = ready ? 1 : clamp(1 - hazard.warmup, .08, 1);
      ctx.beginPath(); ctx.arc(hazard.x, hazard.y, hazard.r * progress, 0, TAU); ctx.fill(); ctx.stroke();
      if (ready) { ctx.beginPath(); ctx.arc(hazard.x, hazard.y, hazard.r * .28, 0, TAU); ctx.stroke(); }
    } else {
      if (ready) {
        ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = '#ff245f'; ctx.lineWidth = hazard.r * 2; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(hazard.x, hazard.y); ctx.lineTo(hazard.tx, hazard.ty); ctx.stroke(); ctx.restore();
      }
      ctx.beginPath(); ctx.moveTo(hazard.x, hazard.y); ctx.lineTo(hazard.tx, hazard.ty); ctx.stroke();
      if (ready) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hazard.x, hazard.y); ctx.lineTo(hazard.tx, hazard.ty); ctx.stroke(); }
    }
    ctx.restore();
  }
}

function drawMob(mob, t) {
  const lowFx = innerWidth < 760, spriteAlpha = mob.hitFlash > 0 ? .72 : 1;
  ctx.save();
  if (mob.hitFlash > 0) ctx.globalCompositeOperation = 'lighter';
  if (mob.kind === 'boss') {
    const index = ({ oni: 0, seraph: 1, witch: 2, dragon: 3 })[mob.bossType] ?? 0;
    const scale = mob.tier === 3 ? 245 : 178, bob = Math.sin(t * .004) * 5;
    ctx.shadowBlur = lowFx ? 0 : 30; ctx.shadowColor = '#f03bff';
    sprite(images.bosses, index % 2, Math.floor(index / 2), 2, 2, mob.x - scale / 2, mob.y - scale * .56 + bob, scale, scale, spriteAlpha, mob.facing < 0);
  } else if (mob.kind === 'treasure') {
    const runningFrame = Math.floor(t / 135 + mob.phase) % 2, scale = 142, bob = Math.sin(t * .008 + mob.id * 9) * 5;
    ctx.shadowBlur = lowFx ? 0 : 30; ctx.shadowColor = '#ffd642';
    sprite(images.treasure, runningFrame, 1, 2, 2, mob.x - scale / 2, mob.y - scale * .58 + bob, scale, scale, spriteAlpha, mob.facing < 0);
    ctx.strokeStyle = '#ffd34e'; ctx.lineWidth = 3; ctx.setLineDash([8, 5]); ctx.beginPath(); ctx.arc(mob.x, mob.y, mob.r + 11 + Math.sin(t * .008) * 3, 0, TAU); ctx.stroke();
  } else {
    const close = Math.hypot(mob.x - S.x, mob.y - S.y) < 170, row = close ? 1 : 0;
    const column = (Math.floor(t / (close ? 110 : 230)) + mob.phase) % 2, scale = mob.r * (mob.elite ? 4.2 : 3.8);
    const colors = { gunner: '#45dfff', charger: '#ffb442', splitter: '#9a72ff', bomber: '#ff456d', stalker: '#e33cff' };
    ctx.shadowBlur = lowFx ? 0 : 17; ctx.shadowColor = colors[mob.archetype] || '#e33cff';
    sprite(images.enemy, column, row, 2, 2, mob.x - scale / 2, mob.y - scale * .58, scale, scale, spriteAlpha, mob.facing < 0);
    if (mob.archetype !== 'stalker') {
      ctx.fillStyle = colors[mob.archetype]; ctx.beginPath();
      if (mob.archetype === 'gunner') { ctx.rect(mob.x - 5, mob.y - mob.r - 22, 10, 10); }
      else if (mob.archetype === 'charger') { ctx.moveTo(mob.x, mob.y - mob.r - 25); ctx.lineTo(mob.x + 8, mob.y - mob.r - 12); ctx.lineTo(mob.x - 8, mob.y - mob.r - 12); ctx.closePath(); }
      else { ctx.arc(mob.x, mob.y - mob.r - 17, 5, 0, TAU); }
      ctx.fill();
    }
  }
  ctx.restore();

  const barHalf = mob.kind === 'treasure' ? 62 : mob.kind === 'boss' ? Math.max(54, mob.r) : mob.r;
  const barY = mob.kind === 'treasure' ? mob.y - 89 : mob.kind === 'boss' ? mob.y - mob.r - 34 : mob.y - mob.r - 13;
  ctx.fillStyle = '#171328'; ctx.fillRect(mob.x - barHalf, barY, barHalf * 2, 4);
  ctx.fillStyle = mob.kind === 'treasure' ? '#ffd34e' : mob.kind === 'boss' ? '#ff4f9d' : mob.elite ? '#c977ff' : '#ff6799';
  ctx.fillRect(mob.x - barHalf, barY, barHalf * 2 * clamp(mob.hp / mob.maxHp, 0, 1), 4);
  if (mob.frozen > 0) { ctx.strokeStyle = '#9bf8ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mob.x, mob.y, mob.r + 8, 0, TAU); ctx.stroke(); }
}

function drawProjectiles() {
  for (const projectile of S.shots) {
    const angle = Math.atan2(projectile.vy, projectile.vx); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = projectile.critical ? '#ff67e8' : '#4feeff'; ctx.lineWidth = 8 * S.shotScale; ctx.globalAlpha = .28;
    ctx.beginPath(); ctx.moveTo(projectile.x - Math.cos(angle) * 52 * S.shotScale, projectile.y - Math.sin(angle) * 52 * S.shotScale); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.translate(projectile.x, projectile.y); ctx.rotate(angle); ctx.shadowBlur = 24; ctx.shadowColor = projectile.critical ? '#ff69f3' : '#55f8ff';
    sprite(images.vfx, 1, 0, 3, 2, -35 * S.shotScale, -17 * S.shotScale, 70 * S.shotScale, 34 * S.shotScale); ctx.restore();
  }
  for (const projectile of S.enemyShots) {
    const angle = Math.atan2(projectile.vy, projectile.vx); ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#ff2794'; ctx.lineWidth = projectile.r * 1.15; ctx.globalAlpha = .34;
    ctx.beginPath(); ctx.moveTo(projectile.x - Math.cos(angle) * 28, projectile.y - Math.sin(angle) * 28); ctx.lineTo(projectile.x, projectile.y); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = '#ff4ea3'; ctx.shadowBlur = innerWidth < 760 ? 0 : 18; ctx.shadowColor = '#ff168c'; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, Math.max(2, projectile.r * .3), 0, TAU); ctx.fill(); ctx.restore();
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
    const progress = 1 - item.life / item.max, alpha = clamp(item.life / item.max * 2, 0, 1);
    if (item.type === 'chain') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.shadowBlur = 16; ctx.shadowColor = '#62efff';
      ctx.strokeStyle = '#57e7ff'; ctx.lineWidth = 8; jaggedLine(item.fromX, item.fromY, item.x, item.y, item.life); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; jaggedLine(item.fromX, item.fromY, item.x, item.y, item.life); ctx.stroke(); ctx.restore(); continue;
    }
    if (item.type === 'saber') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.translate(item.x, item.y); ctx.rotate(item.angle);
      ctx.shadowBlur = 24; ctx.shadowColor = item.index % 2 ? '#ff63ef' : '#67f8ff';
      ctx.fillStyle = item.index % 2 ? '#f25bff22' : '#44eaff22'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, item.radius, -item.arc / 2, item.arc / 2); ctx.closePath(); ctx.fill();
      for (const lane of [.38, .64, .88, 1]) {
        ctx.strokeStyle = lane === 1 ? '#fff' : item.index % 2 ? '#f25bff' : '#44eaff'; ctx.lineWidth = lane === 1 ? 4 : 8 * lane;
        ctx.beginPath(); ctx.arc(0, 0, item.radius * lane * (.9 + progress * .1), -item.arc / 2, item.arc / 2); ctx.stroke();
      }
      ctx.restore(); continue;
    }
    if (item.type === 'ring') {
      ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = item.color || '#75efff'; ctx.lineWidth = 5 * (1 - progress) + 1; ctx.shadowBlur = 16; ctx.shadowColor = item.color || '#75efff';
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
      ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = item.color || '#ffd34e'; ctx.shadowBlur = 24; ctx.shadowColor = item.color || '#ffd34e'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(item.x, item.y, 30 + progress * 105, 0, TAU); ctx.stroke(); ctx.translate(item.x, item.y); ctx.rotate(progress); ctx.strokeRect(-45 - progress * 30, -45 - progress * 30, 90 + progress * 60, 90 + progress * 60); ctx.restore();
    }
  }
}

function drawEnergyBlade(x, y, angle, length = 58, color = '#66efff', alpha = 1) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#152333'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(0, 0); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.shadowBlur = 20; ctx.shadowColor = color;
  ctx.strokeStyle = color; ctx.lineWidth = 14; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length, 0); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length, 0); ctx.stroke(); ctx.restore();
}

function drawOrbitals(t) {
  for (let i = 0; i < S.orbitals; i++) {
    const pose = orbitalPose(i), size = 34 * S.orbitSize, type = i % 3;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = i % 2 ? '#e958ff88' : '#5deaff88'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(pose.x, pose.y, size * .65 + Math.sin(t * .006 + i) * 3, 0, TAU); ctx.stroke(); ctx.restore();
    if (type === 0) sprite(images.vfx, 0, 0, 3, 2, pose.x - size / 2, pose.y - size / 2, size, size);
    else if (type === 1) sprite(images.vfx, 1, 1, 3, 2, pose.x - size * .45, pose.y - size * .45, size * .9, size * .9);
    else drawEnergyBlade(pose.x, pose.y, pose.angle + Math.PI / 2, 36 * S.orbitSize, '#ff61ed');
  }
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
  for (let x = gridX; x < S.x + W; x += grid) { ctx.beginPath(); ctx.moveTo(x, S.y - H); ctx.lineTo(x, S.y + H); ctx.stroke(); }
  for (let y = gridY; y < S.y + H; y += grid) { ctx.beginPath(); ctx.moveTo(S.x - W, y); ctx.lineTo(S.x + W, y); ctx.stroke(); }

  drawHazards();
  for (const gem of S.gems) { const bob = Math.sin(t * .006 + gem.x) * 3; sprite(images.vfx, 1, 1, 3, 2, gem.x - 24, gem.y - 24 + bob, 48, 48); }
  for (const chest of S.chests) {
    const bob = Math.sin(t * .007 + chest.phase) * 7, size = 42 + Math.sin(t * .009) * 4;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffd34e'; ctx.shadowBlur = 24; ctx.shadowColor = '#ffb92f'; ctx.translate(chest.x, chest.y + bob); ctx.rotate(t * .0015); ctx.fillRect(-size / 2, -size / 2, size, size); ctx.fillStyle = '#fff3a4'; ctx.fillRect(-size * .2, -size * .2, size * .4, size * .4); ctx.restore();
  }
  for (const mob of S.mobs) drawMob(mob, t);
  drawProjectiles(); drawEffects();
  for (const particle of S.particles) { ctx.save(); ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1); ctx.fillStyle = particle.color; ctx.shadowBlur = innerWidth < 760 ? 0 : 8; ctx.shadowColor = particle.color; ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size); ctx.restore(); }
  drawOrbitals(t);

  const aimAngle = Math.atan2(S.aimY, S.aimX);
  if (S.saberLevel > 0) drawEnergyBlade(S.x + Math.cos(aimAngle) * 18, S.y + Math.sin(aimAngle) * 18, aimAngle, Math.min(92, 48 + S.saberRange * .24) + Math.sin(t * .012) * 3, '#64f5ff', .88);
  const runFrame = Math.floor(t / 115) % 2, idleBob = Math.sin(t * .0032) * 2.2, frame = S.moving ? 2 + runFrame : 0;
  ctx.shadowBlur = 28; ctx.shadowColor = '#36eaff';
  sprite(images.player, frame % 2, Math.floor(frame / 2), 2, 2, S.x - 56, S.y - 68 + (S.moving ? 0 : idleBob), 112, 112, S.inv > 0 && Math.floor(t / 70) % 2 ? .38 : 1, S.facing < 0);
  ctx.shadowBlur = 0;
  if (!S.moving) { ctx.strokeStyle = '#65efff66'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(S.x, S.y + 18, 27 + Math.sin(t * .004) * 3, 0, TAU); ctx.stroke(); }
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
  for (let mobIndex = 0; mobIndex < S.mobs.length; mobIndex++) {
    const mob = S.mobs[mobIndex];
    let dx = (mob.x - S.x) / range * radius, dy = (mob.y - S.y) / range * radius, distance = Math.hypot(dx, dy);
    if (distance > radius - 5) { dx *= (radius - 5) / distance; dy *= (radius - 5) / distance; }
    ctx.fillStyle = mob.kind === 'treasure' ? '#ffd34e' : mob.kind === 'boss' ? '#ff63e8' : mob.elite ? '#c879ff' : '#ff4f91';
    ctx.beginPath(); ctx.arc(centerX + dx, centerY + dy, mob.kind === 'boss' ? 6 : mob.kind === 'treasure' ? 5 : mob.elite ? 3.5 : 2, 0, TAU); ctx.fill();
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
  ui.hp.textContent = `♥ ${Math.ceil(S.hp)}/${S.maxHp}`; ui.kills.textContent = `✦ ${S.kills}`; ui.clock.textContent = formatTime(S.time);
  if (S.bossActive && !S.bossActive.dead) {
    const names = { oni: 'NEON ONI / 집행자', seraph: 'SERAPH EYE / 관측자', witch: 'RIFT EMPRESS / 균열 마녀', dragon: 'CYBER WYRM / 코어 드래곤' };
    const affixNames = { overclock: 'OVERCLOCK', minefield: 'MINEFIELD', echo: 'ECHO', hunter: 'HUNTER' };
    ui.bossName.textContent = `#${S.bossActive.number} ${names[S.bossActive.bossType]} · ${S.bossActive.affixes.map(id => affixNames[id]).join('+')}`;
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

loadLeaderboard(); requestAnimationFrame(loop);
