const SAVE_KEY = 'idle_hakusura_mobile_save_v7_option_rarity';

const rarityTable = [
  { key: 'common', label: 'コモン', optionCount: 1 },
  { key: 'uncommon', label: 'アンコモン', optionCount: 2 },
  { key: 'rare', label: 'レア', optionCount: 3 },
  { key: 'epic', label: 'エピック', optionCount: 4 },
  { key: 'legendary', label: 'レジェンダリー', optionCount: 5 },
];

const weaponBases = [
  { name: 'ショートソード', weaponType: '剣', minAtk: 4, maxAtk: 8, attackInterval: 1.0 },
  { name: 'バトルアクス', weaponType: '斧', minAtk: 7, maxAtk: 12, attackInterval: 2.0 },
  { name: 'ダガー', weaponType: '短剣', minAtk: 3, maxAtk: 6, attackInterval: 0.8 },
  { name: 'ワンド', weaponType: '杖', minAtk: 3, maxAtk: 7, attackInterval: 1.2 },
];

const armorBases = [
  { name: 'レザーアーマー', minDef: 2, maxDef: 4, hp: 14 },
  { name: 'チェインメイル', minDef: 4, maxDef: 7, hp: 22 },
  { name: 'ミスリルアーマー', minDef: 6, maxDef: 10, hp: 30 },
  { name: 'ローブ', minDef: 1, maxDef: 3, hp: 10 },
];

const accessoryBases = [
  { name: '生命の指輪', hp: 22, vit: 2 },
  { name: '俊足のお守り', agi: 4, def: 1 },
  { name: '守護のペンダント', vit: 3, def: 1, hp: 8 },
  { name: '戦士の紋章', str: 3, hp: 10 },
];

const dungeonMaster = DUNGEON_MASTER;


const dungeonOrder = ['meadow', 'cave'];

function rarityByOptionCount(optionCount) {
  return rarityTable.find((r) => r.optionCount === optionCount) || rarityTable[0];
}

function rollOptionCount() {
  const roll = Math.random();
  if (roll < 0.58) return 1;
  if (roll < 0.83) return 2;
  if (roll < 0.95) return 3;
  if (roll < 0.992) return 4;
  return 5;
}

function makeOptionPool(slot) {
  if (slot === 'weapon') {
    return [
      { key: 'str', label: 'ちから', min: 1, max: 4, scale: 0.16 },
      { key: 'agi', label: 'すばやさ', min: 1, max: 4, scale: 0.16 },
      { key: 'atk', label: '攻撃', min: 1, max: 6, scale: 0.22 },
      { key: 'def', label: '防御', min: 1, max: 3, scale: 0.12 },
    ];
  }
  if (slot === 'armor') {
    return [
      { key: 'vit', label: 'たいりょく', min: 1, max: 4, scale: 0.16 },
      { key: 'str', label: 'ちから', min: 1, max: 3, scale: 0.12 },
      { key: 'hp', label: 'HP', min: 6, max: 18, scale: 0.3 },
      { key: 'def', label: '防御', min: 1, max: 5, scale: 0.2 },
    ];
  }
  return [
    { key: 'str', label: 'ちから', min: 1, max: 4, scale: 0.16 },
    { key: 'vit', label: 'たいりょく', min: 1, max: 4, scale: 0.16 },
    { key: 'agi', label: 'すばやさ', min: 1, max: 4, scale: 0.16 },
    { key: 'hp', label: 'HP', min: 5, max: 16, scale: 0.26 },
    { key: 'def', label: '防御', min: 1, max: 4, scale: 0.16 },
  ];
}

function randomOptionValue(def, stage) {
  return Math.max(1, rand(def.min, def.max) + Math.floor(stage * def.scale));
}

function applyRandomOptions(item, stage, optionCount) {
  const pool = [...makeOptionPool(item.slot)];
  item.options = [];
  for (let i = 0; i < optionCount && pool.length; i += 1) {
    const index = rand(0, pool.length - 1);
    const def = pool.splice(index, 1)[0];
    const value = randomOptionValue(def, stage);
    item[def.key] = (item[def.key] || 0) + value;
    item.options.push({ key: def.key, label: def.label, value });
  }
  const rarity = rarityByOptionCount(item.options.length);
  item.rarity = rarity.label;
  item.optionCount = item.options.length;
}


function nextDungeonKey(key) {
  const index = dungeonOrder.indexOf(key);
  return index >= 0 ? dungeonOrder[index + 1] ?? null : null;
}

let state = loadGame() ?? createInitialState();
normalizePlayerStats(state);
let els = {};
let playerAttackCooldown = 0;
let enemyAttackCooldown = 0;
let battleTimer = null;
const pendingLogs = [];
let currentTab = 'dungeon';
const dirty = { battle: true, dungeon: true, bag: true, equipment: true, status: true, options: true, visibility: true };
function markDirty(...keys) { keys.forEach((key) => { if (key in dirty) dirty[key] = true; }); }

document.addEventListener('DOMContentLoaded', () => {
  els = mapElements();
  currentTab = document.querySelector('.tab.active')?.dataset.tab || 'dungeon';
  bindEvents();
  flushPendingLogs();
  ensureEnemy(true);
  addLog(`冒険開始。${currentDungeon().name} に挑もう。`);
  renderAll();
  startLoop();
});

function createInitialState() {
  const base = {
    autoBattle: false,
    gold: 0,
    kills: 0,
    currentDungeon: 'meadow',
    unlockedDungeons: { meadow: true, cave: false },
    clearedDungeons: { meadow: false, cave: false },
    dungeonProgress: { meadow: 1, cave: 1 },
    player: {
      level: 1,
      exp: 0,
      expToNext: 15,
      statPoints: 0,
      stats: {
        atk: 0,
        maxHp: 0,
        def: 0,
        evasion: 0,
        crit: 0,
        critDamage: 0,
        attackSpeed: 0,
        lifeSteal: 0,
      },
      hp: 0,
      maxHp: 0,
    },
    enemy: null,
    bag: [],
    equipment: { weapon: null, armor: null, accessory: null },
    lastItemId: 0,
  };
  grantStarterItems(base);
  recalcPlayer(base);
  base.player.hp = base.player.maxHp;
  return base;
}

function currentDungeon(sourceState = state) {
  return dungeonMaster[sourceState.currentDungeon] || dungeonMaster.meadow;
}

function currentStage(sourceState = state) {
  return sourceState.dungeonProgress[currentDungeon(sourceState).key];
}

function setCurrentStage(value, sourceState = state) {
  const dungeon = currentDungeon(sourceState);
  const cappedStage = dungeon.finalStage ? Math.min(Math.floor(value), dungeon.finalStage) : Math.floor(value);
  sourceState.dungeonProgress[dungeon.key] = Math.max(1, cappedStage);
}

function grantStarterItems(s) {
  const starterSword = makeWeapon(s, 1, 1, weaponBases[0]);
  const starterArmor = makeArmor(s, 1, 1, armorBases[0]);
  const starterCharm = makeAccessory(s, 1, 1, accessoryBases[0]);
  s.bag.push(starterSword, starterArmor, starterCharm);
  s.equipment.weapon = starterSword.id;
  s.equipment.armor = starterArmor.id;
  s.equipment.accessory = starterCharm.id;
}

function mapElements() {
  const byId = (id) => document.getElementById(id);
  return {
    heroCard: byId('heroCard'),
    dungeonNameLabel: byId('dungeonNameLabel'),
    dungeonLevelText: byId('dungeonLevelText'),
    dungeonList: byId('dungeonList'),
    stageLabel: byId('stageLabel'),
    playerHpText: byId('playerHpText'),
    playerHpBar: byId('playerHpBar'),
    enemyHpText: byId('enemyHpText'),
    enemyHpBar: byId('enemyHpBar'),
    expText: byId('expText'),
    expBar: byId('expBar'),
    toggleBattleBtn: byId('toggleBattleBtn'),
    levelText: byId('levelText'),
    playerLevelTop: byId('playerLevelTop'),
    goldText: byId('goldText'),
    dpsText: byId('dpsText'),
    attackSpeedText: byId('attackSpeedText'),
    dpsTextInfo: byId('dpsTextInfo'),
    attackSpeedTextInfo: byId('attackSpeedTextInfo'),
    enemyNameText: byId('enemyNameText'),
    enemyRankText: byId('enemyRankText'),
    enemyAtkText: byId('enemyAtkText'),
    enemyRewardText: byId('enemyRewardText'),
    enemyNameTextInfo: byId('enemyNameTextInfo'),
    enemyAttackSpeedTextInfo: byId('enemyAttackSpeedTextInfo'),
    enemyRankTextInfo: byId('enemyRankTextInfo'),
    enemyAtkTextInfo: byId('enemyAtkTextInfo'),
    enemyRewardTextInfo: byId('enemyRewardTextInfo'),
    log: byId('log'),
    battleLog: byId('battleLog'),
    battleLogPanel: byId('battleLogPanel'),
    statusLevel: byId('statusLevel'),
    killCountText: byId('killCountText'),
    maxHpText: byId('maxHpText'),
    defText: byId('defText'),
    atkText: byId('atkText'),
    critText: byId('critText'),
    evaText: byId('evaText'),
    critDamageText: byId('critDamageText'),
    attackSpeedTotalText: byId('attackSpeedTotalText'),
    lifeStealText: byId('lifeStealText'),
    pointsText: byId('pointsText'),
    statList: byId('statList'),
    equipWeaponBtn: byId('equipWeaponBtn'),
    equipArmorBtn: byId('equipArmorBtn'),
    equipAccessoryBtn: byId('equipAccessoryBtn'),
    bagList: byId('bagList'),
    bagCountText: byId('bagCountText'),
    saveBtn: byId('saveBtn'),
    resetBtn: byId('resetBtn'),
    itemCardTemplate: byId('itemCardTemplate'),
    dungeonCardTemplate: byId('dungeonCardTemplate'),
  };
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      activateTab(currentTab);
      markDirty('visibility', currentTab, 'equipment');
      renderAll();
    });
  });

  els.bagList?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const itemId = Number(button.dataset.itemId);
    const action = button.dataset.action;
    if (!itemId || !action) return;

    if (action === 'equip-weapon') equipItem(itemId, 'weapon');
    else if (action === 'equip-armor') equipItem(itemId, 'armor');
    else if (action === 'equip-accessory') equipItem(itemId, 'accessory');
    else if (action === 'sell') sellItem(itemId);
  });

  els.toggleBattleBtn?.addEventListener('click', toggleBattle);
  els.saveBtn?.addEventListener('click', () => {
    saveGame();
    addLog('セーブしました。');
  });

  els.resetBtn?.addEventListener('click', () => {
    if (!confirm('セーブデータを削除して最初から始めますか？')) return;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  });
}

function startLoop() {
  let last = performance.now();
  if (battleTimer) clearInterval(battleTimer);
  battleTimer = setInterval(saveGame, 10000);

  function frame(now) {
    const delta = Math.min((now - last) / 1000, 0.1);
    last = now;
    tick(delta);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function tick(delta) {
  if (!state.autoBattle) {
    if (dirty.battle) {
      renderBattleSummary();
      dirty.battle = false;
    }
    return;
  }

  ensureEnemy();
  if (!state.enemy) {
    markDirty('battle');
    renderBattleSummary();
    dirty.battle = false;
    return;
  }

  playerAttackCooldown -= delta;
  enemyAttackCooldown -= delta;
  const pStats = getDerivedStats(state);
  let changed = false;

  if (playerAttackCooldown <= 0 && state.enemy.hp > 0) {
    const damage = computePlayerDamage(pStats);
    state.enemy.hp = Math.max(0, state.enemy.hp - damage);
    addLog(`あなたの攻撃！ ${state.enemy.name} に ${damage} ダメージ。`);
    const steal = Math.floor(damage * pStats.lifeSteal);
    if (steal > 0) {
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + steal);
      addLog(`HPを ${steal} 吸収した。`);
    }
    playerAttackCooldown += 1 / Math.max(0.2, pStats.attackSpeed);
    changed = true;
    if (state.enemy.hp <= 0) {
      onEnemyDefeated();
      changed = true;
    }
  }

  if (state.enemy && state.enemy.hp > 0 && enemyAttackCooldown <= 0) {
    const raw = rand(state.enemy.atkMin, state.enemy.atkMax);
    const evaded = Math.random() < pStats.evasion;
    if (evaded) {
      addLog('敵の攻撃を回避した。');
    } else {
      const damage = Math.max(1, Math.floor(raw - pStats.def));
      state.player.hp = Math.max(0, state.player.hp - damage);
      addLog(`${state.enemy.name} の攻撃！ ${damage} ダメージ。`);
    }
    enemyAttackCooldown += state.enemy.attackInterval;
    changed = true;
    if (state.player.hp <= 0) {
      onPlayerDefeated();
      changed = true;
    }
  }

  if (changed || dirty.battle) {
    renderBattleSummary();
    dirty.battle = false;
  }
}

function toggleBattle() {
  state.autoBattle = !state.autoBattle;
  playerAttackCooldown = 0;
  enemyAttackCooldown = 0;
  addLog(state.autoBattle ? '自動戦闘を開始。' : '自動戦闘を停止。');
  if (state.autoBattle) {
    ensureEnemy();
  }
  markDirty('battle', 'visibility', 'options');
  renderAll();
}

function ensureEnemy(force = false) {
  if (state.enemy && state.enemy.hp > 0 && !force) return;
  state.enemy = createEnemy(currentStage(), currentDungeon());
}

function dungeonEnemyTable(dungeon) {
  const fallback = [{ key: 'unknown', name: 'モンスター', hp: 40, atk: 8, attackInterval: 1.3, exp: 7, gold: 6 }];
  if (!dungeon?.enemyKeys?.length) return fallback;
  const enemyTable = dungeon.enemyKeys.map((enemyKey) => ENEMY_MASTER[enemyKey]).filter(Boolean);
  return enemyTable.length ? enemyTable : fallback;
}

function dungeonBossDef(dungeon) {
  const fallback = { key: 'bossUnknown', name: `${dungeon.name}の主`, hp: 260, atk: 30, attackInterval: 1.6, exp: 48, gold: 44 };
  if (!dungeon?.bossKey) return fallback;
  return BOSS_MASTER[dungeon.bossKey] || fallback;
}

function createEnemy(stage, dungeon) {
  const tier = 1 + Math.floor((stage - 1) / 5);
  const finalStage = dungeon.finalStage || 10;
  const isBossFloor = stage >= finalStage;
  const enemyTable = dungeonEnemyTable(dungeon);
  const enemyDef = isBossFloor
    ? dungeonBossDef(dungeon)
    : enemyTable[(stage + tier) % enemyTable.length];
  const rank = isBossFloor ? 'BOSS' : '';
  const rankMul = isBossFloor ? 2.7 : 1;
  const hpBase = enemyDef.hp + stage * 18 + tier * 10;
  const atkBase = (enemyDef.atk + stage * 2.4 + tier * 1.8) * (isBossFloor ? 1.85 : 1);
  const baseHp = Math.floor(hpBase * rankMul * dungeon.hpScale);
  const baseExp = enemyDef.exp + stage * 2.6 + tier * 1.4;
  const baseGold = enemyDef.gold + stage * 2.9 + tier * 1.1;
  return {
    name: isBossFloor ? enemyDef.name : `${enemyDef.name} ${stage}`,
    rank,
    maxHp: baseHp,
    hp: baseHp,
    atkMin: Math.max(1, Math.floor(atkBase * dungeon.atkScale * 0.75)),
    atkMax: Math.max(2, Math.floor(atkBase * dungeon.atkScale * 1.2)),
    attackInterval: Math.max(0.55, enemyDef.attackInterval / dungeon.speedScale),
    exp: Math.floor(baseExp * rankMul * dungeon.expScale),
    gold: Math.floor(baseGold * rankMul * dungeon.goldScale),
    isBoss: isBossFloor,
  };
}

function getEquippedItems(sourceState = state) {
  return ['weapon', 'armor', 'accessory']
    .map((slot) => getItemById(sourceState.equipment[slot], sourceState))
    .filter(Boolean);
}

function getDerivedStats(sourceState = state) {
  const baseStats = normalizePlayerStats(sourceState);
  const equipItems = getEquippedItems(sourceState);
  const equipAtk = equipItems.reduce((sum, item) => sum + item.atk, 0);
  const equipHp = equipItems.reduce((sum, item) => sum + item.hp, 0);
  const equipDef = equipItems.reduce((sum, item) => sum + item.def, 0);
  const bonusAtk = equipItems.reduce((sum, item) => sum + item.str, 0);
  const bonusHp = equipItems.reduce((sum, item) => sum + item.vit * 8, 0);
  const bonusEvasion = equipItems.reduce((sum, item) => sum + item.agi * 0.004, 0);
  const bonusCrit = equipItems.reduce((sum, item) => sum + item.agi * 0.004, 0);

  const equippedWeapon = equipItems.find((item) => item.slot === 'weapon');
  const weaponAttackInterval = equippedWeapon?.attackInterval || 1.2;
  const attackSpeedMultiplier = 1 + baseStats.attackSpeed * 0.02;
  const attackInterval = Math.max(0.2, weaponAttackInterval / Math.max(0.2, attackSpeedMultiplier));
  const attackSpeed = 1 / Math.max(0.2, attackInterval);
  const critDamageMultiplier = 1.5 + baseStats.critDamage * 0.03;
  const crit = Math.min(0.8, 0.05 + baseStats.crit * 0.005 + bonusCrit);
  const evasion = Math.min(0.6, baseStats.evasion * 0.004 + bonusEvasion);
  const lifeSteal = Math.min(0.5, baseStats.lifeSteal * 0.01);

  return {
    maxHp: 60 + baseStats.maxHp * 8 + equipHp + bonusHp,
    def: Math.floor(baseStats.def * 1.5 + equipDef),
    attackPower: Math.floor(10 + baseStats.atk * 2 + equipAtk + bonusAtk),
    attackSpeed,
    attackInterval,
    crit,
    evasion,
    critDamageMultiplier,
    lifeSteal,
  };
}

function recalcPlayer(sourceState = state) {
  const derived = getDerivedStats(sourceState);
  sourceState.player.maxHp = derived.maxHp;
  sourceState.player.hp = Math.max(1, Math.min(sourceState.player.hp || derived.maxHp, derived.maxHp));
}

function computePlayerDamage(pStats) {
  let damage = rand(Math.floor(pStats.attackPower * 0.75), Math.floor(pStats.attackPower * 1.15));
  if (Math.random() < pStats.crit) {
    damage = Math.floor(damage * pStats.critDamageMultiplier);
    addLog('会心の一撃！');
  }
  return Math.max(1, damage);
}

function onEnemyDefeated() {
  const enemy = state.enemy;
  if (!enemy) return;

  state.gold += enemy.gold;
  state.kills += 1;
  gainExp(enemy.exp);
  addLog(`${enemy.name} を倒した！ ${enemy.gold}G と ${enemy.exp}EXP を獲得。`);

  const drop = rollDrop();
  if (drop) {
    state.bag.unshift(drop);
    addLog(`ドロップ: ${bagItemName(drop)} を入手！`);
  }

  const dungeon = currentDungeon();
  if (enemy.isBoss) {
    if (!state.clearedDungeons[dungeon.key]) {
      state.clearedDungeons[dungeon.key] = true;
      state.autoBattle = false;
      addLog(`${dungeon.name}をクリアした！`);

      const nextKey = nextDungeonKey(dungeon.key);
      if (nextKey && !state.unlockedDungeons[nextKey]) {
        state.unlockedDungeons[nextKey] = true;
        addLog(`${dungeonMaster[nextKey].name} が解放された！`);
      }
    }
  } else {
    setCurrentStage(currentStage() + 1);
    addLog(`${dungeon.name} の ${currentStage()} 階へ進んだ。`);
  }

  state.enemy = null;
  if (state.autoBattle) {
    ensureEnemy(true);
  }
  markDirty('battle', 'bag', 'equipment', 'status', 'options', 'dungeon');
}

function onPlayerDefeated() {
  state.autoBattle = false;
  state.player.hp = Math.max(1, Math.floor(state.player.maxHp * 0.5));
  addLog('力尽きた……。HPを半分回復して戦闘停止。');
  markDirty('battle', 'visibility', 'options');
  renderAll();
}

function gainExp(amount) {
  state.player.exp += amount;
  while (state.player.exp >= state.player.expToNext) {
    state.player.exp -= state.player.expToNext;
    state.player.level += 1;
    state.player.statPoints += 4;
    state.player.expToNext = Math.floor(state.player.expToNext * 1.25 + 8);
    recalcPlayer(state);
    state.player.hp = state.player.maxHp;
    addLog(`レベルアップ！ Lv${state.player.level} になり、ステータスポイントを4獲得。`);
  }
}

function rollDrop() {
  if (Math.random() > 0.72) return null;
  const optionCount = rollOptionCount();
  const stage = currentStage();
  const roll = Math.random();
  if (roll < 1 / 3) return makeWeapon(state, stage, optionCount);
  if (roll < 2 / 3) return makeArmor(state, stage, optionCount);
  return makeAccessory(state, stage, optionCount);
}

function makeWeapon(sourceState, stage, optionCount = 1, forcedBase = null) {
  const basePool = currentDungeon(sourceState).key === 'cave'
    ? [weaponBases[1], weaponBases[0], weaponBases[3], weaponBases[2]]
    : weaponBases;
  const base = forcedBase || basePool[rand(0, basePool.length - 1)];
  const scale = 1 + stage * 0.11;

  const item = {
    id: ++sourceState.lastItemId,
    slot: 'weapon',
    rarity: '',
    optionCount: 0,
    options: [],
    name: base.name,
    baseName: base.name,
    atk: Math.floor(rand(base.minAtk, base.maxAtk) * scale),
    attackInterval: base.attackInterval,
    hp: 0,
    def: 0,
    str: 0,
    vit: 0,
    agi: 0,
    price: Math.floor(rand(base.minAtk, base.maxAtk) * 6 * scale),
    weaponType: base.weaponType,
  };
  applyRandomOptions(item, stage, optionCount);
  item.price += item.options.reduce((sum, opt) => sum + opt.value * 10, 0);
  return item;
}

function makeArmor(sourceState, stage, optionCount = 1, forcedBase = null) {
  const base = forcedBase || armorBases[rand(0, armorBases.length - 1)];
  const scale = 1 + stage * 0.09;

  const item = {
    id: ++sourceState.lastItemId,
    slot: 'armor',
    rarity: '',
    optionCount: 0,
    options: [],
    name: base.name,
    baseName: base.name,
    atk: 0,
    hp: Math.floor(base.hp * scale),
    def: Math.max(1, Math.floor(rand(base.minDef, base.maxDef) * scale)),
    str: 0,
    vit: 0,
    agi: 0,
    price: Math.floor((base.hp + base.maxDef * 16) * scale),
  };
  applyRandomOptions(item, stage, optionCount);
  item.price += item.options.reduce((sum, opt) => sum + opt.value * 10, 0);
  return item;
}

function makeAccessory(sourceState, stage, optionCount = 1, forcedBase = null) {
  const base = forcedBase || accessoryBases[rand(0, accessoryBases.length - 1)];
  const scale = 1 + stage * 0.1;

  const item = {
    id: ++sourceState.lastItemId,
    slot: 'accessory',
    rarity: '',
    optionCount: 0,
    options: [],
    name: base.name,
    baseName: base.name,
    atk: 0,
    hp: Math.floor((base.hp || 0) * scale),
    def: Math.floor((base.def || 0) * scale),
    str: Math.floor((base.str || 0) * scale),
    vit: Math.floor((base.vit || 0) * scale),
    agi: Math.floor((base.agi || 0) * scale),
    price: Math.floor(((base.hp || 0) + (base.def || 0) * 8 + 20) * scale),
  };
  applyRandomOptions(item, stage, optionCount);
  item.price += item.options.reduce((sum, opt) => sum + opt.value * 10, 0);
  return item;
}

function getItemById(id, sourceState = state) {
  if (!id) return null;
  return sourceState.bag.find((item) => item.id === id) || null;
}

function canEquip(item, slot) {
  if (!item) return false;
  if (slot === 'weapon') return item.slot === 'weapon';
  if (slot === 'armor') return item.slot === 'armor';
  if (slot === 'accessory') return item.slot === 'accessory';
  return false;
}

function equipItem(itemId, slot) {
  const item = getItemById(itemId);
  if (!canEquip(item, slot)) return;
  state.equipment[slot] = itemId;
  recalcPlayer(state);
  addLog(`${slotLabel(slot)} に ${bagItemName(item)} を装備。`);
  markDirty('bag', 'equipment', 'status', 'battle', 'options');
  renderAll();
}

function sellItem(itemId) {
  if (Object.values(state.equipment).includes(itemId)) {
    addLog('装備中のアイテムは売却できません。');
    return;
  }
  const index = state.bag.findIndex((item) => item.id === itemId);
  if (index < 0) return;
  const [item] = state.bag.splice(index, 1);
  state.gold += Math.max(1, Math.floor(item.price * 0.5));
  addLog(`${bagItemName(item)} を売却した。`);
  markDirty('bag', 'equipment', 'options');
  renderAll();
}

function addStat(statKey, delta = 1) {
  if (!(statKey in state.player.stats)) return;
  if (delta > 0) {
    if (state.player.statPoints <= 0) return;
    state.player.stats[statKey] += 1;
    state.player.statPoints -= 1;
  } else {
    if (state.player.stats[statKey] <= 0) return;
    state.player.stats[statKey] -= 1;
    state.player.statPoints += 1;
  }
  recalcPlayer(state);
  markDirty('status', 'battle', 'options');
  renderAll();
}

function selectDungeon(key) {
  const dungeon = dungeonMaster[key];
  if (!dungeon) return;
  if (!state.unlockedDungeons[dungeon.key]) {
    addLog(`${dungeon.name} はまだ解放されていない。`);
    return;
  }
  if (state.autoBattle) {
    addLog('戦闘中はダンジョンを変更できません。');
    return;
  }

  if (state.currentDungeon !== key) {
    clearLogs();
  }
  state.currentDungeon = key;
  state.dungeonProgress[key] = 1;
  state.enemy = null;
  playerAttackCooldown = 0;
  enemyAttackCooldown = 0;
  recalcPlayer(state);
  state.player.hp = state.player.maxHp;
  state.autoBattle = true;
  addLog(`ダンジョンを ${dungeon.name} に変更。`);
  addLog('1階から探索を開始。');
  addLog('HPが全回復した。');
  addLog('自動戦闘を開始。');
  ensureEnemy(true);
  markDirty('battle', 'dungeon', 'status', 'equipment', 'bag', 'options', 'visibility');
  renderAll();
}

function clearLogs() {
  pendingLogs.length = 0;
  if (els.log) {
    els.log.innerHTML = '';
  }
  if (els.battleLog) {
    els.battleLog.innerHTML = '';
  }
}

function setText(el, value) {
  if (el) el.textContent = String(value);
}

function setWidth(el, value) {
  if (el) el.style.width = value;
}

function renderAll() {
  recalcPlayer(state);
  updateTabVisibility();

  if (dirty.battle) {
    renderBattleSummary();
    dirty.battle = false;
  }

  if ((currentTab === 'dungeon' && dirty.dungeon) || dirty.visibility) {
    renderDungeons();
    dirty.dungeon = false;
  }

  if ((currentTab === 'status' && dirty.status) || dirty.visibility) {
    renderStatus();
    dirty.status = false;
  }

  if ((currentTab === 'bag' && (dirty.bag || dirty.equipment)) || dirty.visibility) {
    renderEquipment();
    renderBag();
    dirty.equipment = false;
    dirty.bag = false;
  }

  dirty.visibility = false;
}

function updateTabVisibility() {
  const inBattle = state.autoBattle;
  const tabsRoot = document.querySelector('.tabs');
  tabsRoot?.classList.toggle('hidden', inBattle);
  els.heroCard?.classList.toggle('hidden', !inBattle);

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('hidden', inBattle);
  });

  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.toggle('hidden', inBattle);
  });

  els.battleLogPanel?.classList.toggle('hidden', !inBattle);

  if (!inBattle) {
    activateTab(currentTab);
  }
}

function activateTab(tabName) {
  currentTab = tabName;
  document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
  const tabButton = document.querySelector(`.tab[data-tab="${tabName}"]`);
  const targetPanel = document.getElementById(`tab-${tabName}`);
  tabButton?.classList.add('active');
  targetPanel?.classList.add('active');
}

function renderBattleSummary() {
  if (!els.dungeonNameLabel) return;
  const stats = getDerivedStats(state);
  const inBattle = state.autoBattle;
  const attackSpeedLabel = `${stats.attackInterval.toFixed(2)}秒/回`;
  const dpsValue = Math.floor(stats.attackPower / Math.max(0.2, stats.attackInterval));
  const playerHpRate = state.player.maxHp > 0 ? (state.player.hp / state.player.maxHp) * 100 : 0;
  const expRate = state.player.expToNext > 0 ? (state.player.exp / state.player.expToNext) * 100 : 0;

  setText(els.dungeonNameLabel, currentDungeon().name);
  setText(els.dungeonLevelText, currentDungeon().rec);
  setText(els.stageLabel, currentStage());
  setText(els.playerHpText, `${Math.floor(state.player.hp)} / ${state.player.maxHp}`);
  setWidth(els.playerHpBar, `${playerHpRate}%`);
  setText(els.expText, `${state.player.exp} / ${state.player.expToNext}`);
  setWidth(els.expBar, `${expRate}%`);
  setText(els.toggleBattleBtn, state.autoBattle ? '戦闘停止' : '戦闘開始');
  setText(els.levelText, state.player.level);
  setText(els.playerLevelTop, state.player.level);
  setText(els.goldText, state.gold);
  setText(els.attackSpeedText, attackSpeedLabel);
  setText(els.attackSpeedTextInfo, attackSpeedLabel);
  setText(els.dpsText, dpsValue);
  setText(els.dpsTextInfo, dpsValue);
  setText(els.killCountText, state.kills);

  document.querySelector('.battle-panel')?.classList.toggle('hidden', !inBattle);

  if (inBattle) {
    ensureEnemy();
  }

  if (state.enemy && inBattle) {
    const enemyHpRate = state.enemy.maxHp > 0 ? (state.enemy.hp / state.enemy.maxHp) * 100 : 0;
    const enemyAttackSpeedLabel = `${state.enemy.attackInterval.toFixed(2)}秒/回`;
    setText(els.enemyHpText, `${Math.floor(state.enemy.hp)} / ${state.enemy.maxHp}`);
    setWidth(els.enemyHpBar, `${enemyHpRate}%`);
    setText(els.enemyNameText, state.enemy.name);
    setText(els.enemyNameTextInfo, state.enemy.name);
    setText(els.enemyAttackSpeedTextInfo, enemyAttackSpeedLabel);
    setText(els.enemyRankText, state.enemy.rank);
    setText(els.enemyRankTextInfo, state.enemy.rank);
  } else {
    setText(els.enemyHpText, '-');
    setWidth(els.enemyHpBar, '0%');
    setText(els.enemyNameText, '-');
    setText(els.enemyNameTextInfo, '-');
    setText(els.enemyAttackSpeedTextInfo, '-');
    setText(els.enemyRankText, '-');
    setText(els.enemyRankTextInfo, '-');
  }
}

function renderDungeons() {
  if (!els.dungeonList || !els.dungeonCardTemplate) return;
  const fragment = document.createDocumentFragment();

  Object.values(dungeonMaster).forEach((dungeon) => {
    const node = els.dungeonCardTemplate.content.firstElementChild.cloneNode(true);
    const unlocked = !!state.unlockedDungeons[dungeon.key];

    node.classList.toggle('active', dungeon.key === state.currentDungeon);
    node.classList.toggle('locked', !unlocked);
    node.querySelector('.dungeon-card-name').textContent = dungeon.name;
    node.addEventListener('click', () => selectDungeon(dungeon.key));
    fragment.appendChild(node);
  });

  els.dungeonList.replaceChildren(fragment);
}

function renderStatus() {
  if (!els.statusLevel || !els.statList) return;
  const stats = getDerivedStats(state);
  const statDefs = [
    ['atk', '攻撃力', '1ポイントごとに攻撃力+2'],
    ['maxHp', '最大HP', '1ポイントごとに最大HP+8'],
    ['def', '防御力', '1ポイントごとに防御計算値+1.5（表示は切り捨て）'],
    ['evasion', '回避率', '1ポイントごとに回避率+0.4%'],
    ['crit', '会心率', '1ポイントごとに会心率+0.5%'],
    ['critDamage', '会心ダメージ', '1ポイントごとに会心倍率+3%'],
    ['attackSpeed', '攻撃速度', '1ポイントごとに攻撃速度+2%（攻撃間隔短縮）'],
    ['lifeSteal', 'HP吸収', '1ポイントごとにHP吸収+1%'],
  ];

  els.statusLevel.textContent = state.player.level;
  els.maxHpText.textContent = stats.maxHp;
  els.defText.textContent = stats.def;
  els.atkText.textContent = stats.attackPower;
  els.critText.textContent = `${Math.floor(stats.crit * 100)}%`;
  els.evaText.textContent = `${Math.floor(stats.evasion * 100)}%`;
  els.critDamageText.textContent = `${Math.floor(stats.critDamageMultiplier * 100)}%`;
  els.attackSpeedTotalText.textContent = `${Math.floor(stats.attackSpeed * 100)}%`;
  els.lifeStealText.textContent = `${Math.floor(stats.lifeSteal * 100)}%`;
  els.pointsText.textContent = state.player.statPoints;
  els.statList.innerHTML = '';

  statDefs.forEach(([key, label, desc]) => {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <div>
        <div class="stat-name">${label}</div>
        <div class="stat-desc">${desc}</div>
      </div>
      <strong>${state.player.stats[key]}</strong>
      <div class="stat-actions">
        <button class="minus-btn">-1</button>
        <button class="plus-btn">+1</button>
      </div>
    `;
    const plusButton = row.querySelector('.plus-btn');
    const minusButton = row.querySelector('.minus-btn');
    plusButton.disabled = state.player.statPoints <= 0;
    minusButton.disabled = state.player.stats[key] <= 0;
    plusButton.addEventListener('click', () => addStat(key, 1));
    minusButton.addEventListener('click', () => addStat(key, -1));
    els.statList.appendChild(row);
  });
}


function normalizePlayerStats(sourceState = state) {
  const current = sourceState?.player?.stats || {};
  if ('atk' in current) {
    sourceState.player.stats = {
      atk: Math.max(0, current.atk || 0),
      maxHp: Math.max(0, current.maxHp || 0),
      def: Math.max(0, current.def || 0),
      evasion: Math.max(0, current.evasion || 0),
      crit: Math.max(0, current.crit || 0),
      critDamage: Math.max(0, current.critDamage || 0),
      attackSpeed: Math.max(0, current.attackSpeed || 0),
      lifeSteal: Math.max(0, current.lifeSteal || 0),
    };
    return sourceState.player.stats;
  }

  const str = Math.max(0, current.str || 0);
  const vit = Math.max(0, current.vit || 0);
  const agi = Math.max(0, current.agi || 0);
  sourceState.player.stats = {
    atk: str,
    maxHp: vit,
    def: vit,
    evasion: agi,
    crit: agi,
    critDamage: 0,
    attackSpeed: Math.floor(agi / 2),
    lifeSteal: 0,
  };
  return sourceState.player.stats;
}

function renderEquipment() {
  if (!els.equipWeaponBtn) return;
  const weapon = getItemById(state.equipment.weapon);
  const armor = getItemById(state.equipment.armor);
  const accessory = getItemById(state.equipment.accessory);
  els.equipWeaponBtn.textContent = weapon ? bagItemName(weapon) : '未装備';
  els.equipArmorBtn.textContent = armor ? bagItemName(armor) : '未装備';
  els.equipAccessoryBtn.textContent = accessory ? bagItemName(accessory) : '未装備';
}

function renderBag() {
  if (!els.bagList) return;
  els.bagCountText.textContent = state.bag.length;

  if (!state.bag.length) {
    els.bagList.innerHTML = '<div class="empty">バッグは空です。</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  const sortedBag = [...state.bag].sort((a, b) => Number(isEquipped(b.id)) - Number(isEquipped(a.id)));

  sortedBag.forEach((item) => {
    const actions = [];
    if (isEquipped(item.id)) {
      actions.push(statusButton('装備中'));
    } else {
      if (item.slot === 'weapon') {
        actions.push(actionButton('武器装備', 'equip-weapon', item.id));
      } else if (item.slot === 'armor') {
        actions.push(actionButton('防具装備', 'equip-armor', item.id));
      } else {
        actions.push(actionButton('装飾品装備', 'equip-accessory', item.id));
      }
    }
    actions.push(actionButton('売却', 'sell', item.id));
    fragment.appendChild(createItemCard(item, actions));
  });

  els.bagList.replaceChildren(fragment);
}

function createItemCard(item, actions) {
  const node = els.itemCardTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector('.item-name').textContent = bagItemName(item);
  const equipLabel = equippedSlotOf(item.id);
  node.querySelector('.item-meta').textContent = `${item.slot === 'weapon' ? '武器' : item.slot === 'armor' ? '防具' : '装飾品'}${equipLabel ? ' / ' + equipLabel : ''}`;
  const rarityNode = node.querySelector('.item-rarity');
  if (rarityNode) rarityNode.textContent = item.rarity || '';
  node.querySelector('.item-stats').innerHTML = itemStatText(item);
  const wrap = node.querySelector('.item-actions');
  actions.forEach((button) => wrap.appendChild(button));
  return node;
}

function actionButton(label, action, itemId) {
  const button = document.createElement('button');
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.itemId = String(itemId);
  return button;
}

function statusButton(label) {
  const button = document.createElement('button');
  button.textContent = label;
  button.className = 'status-btn';
  button.disabled = true;
  return button;
}

function bagItemName(item) {
  if (!item) return '';
  const baseName = item.baseName || item.name || '';
  const prefix = `${item.rarity} `;
  return item.rarity && baseName.startsWith(prefix) ? baseName.slice(prefix.length) : baseName;
}

function itemStatText(item) {
  const fixed = [];
  if (item.atk) fixed.push(`攻撃 +${item.atk}`);
  if (item.slot === 'weapon' && item.weaponType) fixed.push(`武器種 ${item.weaponType}`);
  if (item.slot === 'weapon' && item.attackInterval) fixed.push(`攻撃間隔 ${item.attackInterval.toFixed(1)}秒`);
  if (item.hp) fixed.push(`HP +${item.hp}`);
  if (item.def) fixed.push(`防御 +${item.def}`);
  if (item.str) fixed.push(`ちから +${item.str}`);
  if (item.vit) fixed.push(`たいりょく +${item.vit}`);
  if (item.agi) fixed.push(`すばやさ +${item.agi}`);

  const options = [];
  if (Array.isArray(item.options) && item.options.length) {
    item.options.forEach((opt) => options.push(`${opt.label} +${opt.value}`));
  } else if (item.optionCount) {
    options.push(`${item.optionCount}個`);
  }

  const lines = [];
  if (fixed.length) lines.push(`<div class="stat-inline"><span class="stat-label">固有能力</span><span>${fixed.join(' / ')}</span></div>`);
  if (options.length) lines.push(`<div class="stat-inline"><span class="stat-label">オプション</span><span>${options.join(' / ')}</span></div>`);
  return lines.join('');
}

function equippedSlotOf(itemId) {
  const labels = [];
  Object.entries(state.equipment).forEach(([slot, id]) => {
    if (id === itemId) labels.push(slotLabel(slot));
  });
  return labels.length ? `装備中: ${labels.join(' / ')}` : '';
}

function isEquipped(itemId) {
  return Object.values(state.equipment).includes(itemId);
}

function slotLabel(slot) {
  return slot === 'weapon' ? '武器' : slot === 'armor' ? '防具' : '装飾品';
}

function appendLogLine(container, text) {
  if (!container) return;
  const line = document.createElement('div');
  line.className = 'log-line';
  line.textContent = text;
  container.prepend(line);
  while (container.childNodes.length > 80) container.removeChild(container.lastChild);
}

function addLog(text) {
  if (!els.log && !els.battleLog) {
    pendingLogs.unshift(text);
    while (pendingLogs.length > 80) pendingLogs.pop();
    return;
  }
  appendLogLine(els.log, text);
  appendLogLine(els.battleLog, text);
}

function flushPendingLogs() {
  if ((!els.log && !els.battleLog) || !pendingLogs.length) return;
  const logs = [...pendingLogs].reverse();
  pendingLogs.length = 0;
  logs.forEach((text) => addLog(text));
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    addLog('セーブに失敗しました。');
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isValidSaveData(parsed)) return null;
    recalcPlayer(parsed);
    return parsed;
  } catch {
    return null;
  }
}

function isValidSaveData(data) {
  return !!(
    data &&
    typeof data === 'object' &&
    data.player &&
    data.player.stats &&
    typeof data.player.level === 'number' &&
    typeof data.player.exp === 'number' &&
    typeof data.player.expToNext === 'number' &&
    typeof data.player.statPoints === 'number' &&
    Array.isArray(data.bag) &&
    data.equipment &&
    data.dungeonProgress &&
    data.unlockedDungeons &&
    data.clearedDungeons &&
    typeof data.lastItemId === 'number' &&
    dungeonMaster[data.currentDungeon]
  );
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
