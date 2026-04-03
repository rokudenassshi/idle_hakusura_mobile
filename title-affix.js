const TITLE_DROP_RATE = 1.0001;
const TITLE_AFFIX_TABLE = [
  {
    key: "vitality",
    prefix: "体力の",
    hpMultiplier: 0.3,
    statText: "HP +30%",
  },
  {
    key: "strength",
    prefix: "力の",
    attackMultiplier: 0.5,
    statText: "攻撃力 +50%",
  },
  {
    key: "guard",
    prefix: "護りの",
    defMultiplier: 0.5,
    statText: "防御力 +50%",
  },
  {
    key: "gale",
    prefix: "疾風の",
    attackIntervalReduction: 0.2,
    statText: "攻撃間隔 -0.2秒",
  },
  {
    key: "keen",
    prefix: "会心の",
    critChanceBonus: 0.2,
    statText: "クリティカル率 +20%",
  },
];

function maybeApplyTitleAffix(item) {
  if (!item || Math.random() > TITLE_DROP_RATE) return item;
  const affix =
    TITLE_AFFIX_TABLE[Math.floor(Math.random() * TITLE_AFFIX_TABLE.length)];
  item.titleAffix = {
    key: affix.key,
    prefix: affix.prefix,
    hpMultiplier: affix.hpMultiplier || 0,
    attackMultiplier: affix.attackMultiplier || 0,
    defMultiplier: affix.defMultiplier || 0,
    attackIntervalReduction: affix.attackIntervalReduction || 0,
    critChanceBonus: affix.critChanceBonus || 0,
    statText: affix.statText,
  };
  item.price = Math.floor(item.price * 4.5);
  return item;
}

function collectTitleAffixBonus(equipItems) {
  return equipItems.reduce(
    (acc, item) => {
      const titleAffix = item.titleAffix;
      if (!titleAffix) return acc;
      acc.hpMultiplier += titleAffix.hpMultiplier || 0;
      acc.attackMultiplier += titleAffix.attackMultiplier || 0;
      acc.defMultiplier += titleAffix.defMultiplier || 0;
      acc.attackIntervalReduction += titleAffix.attackIntervalReduction || 0;
      acc.critChanceBonus += titleAffix.critChanceBonus || 0;
      return acc;
    },
    {
      hpMultiplier: 0,
      attackMultiplier: 0,
      defMultiplier: 0,
      attackIntervalReduction: 0,
      critChanceBonus: 0,
    },
  );
}

function titleAffixPrefix(item) {
  return item?.titleAffix?.prefix || "";
}

function titleAffixStatText(item) {
  return item?.titleAffix?.statText || "";
}
