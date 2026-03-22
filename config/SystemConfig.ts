// ============================================================
//  SYSTEM CONFIG — THE HUNTER'S GRIMOIRE
//  config/SystemConfig.ts
//
//  ⚠️  SINGLE SOURCE OF TRUTH FOR ALL GAME CONTENT
//  Edit this file directly to change tasks, bosses, shop items,
//  penalties, and rewards. The UI maps over this automatically.
//
//  v2 changes:
//  - penaltyQuest  → penaltyQuests[] (random pool, engine picks one)
//  - sideQuests now have dailyRotationCount (2 shown per day from pool of 8)
//  - getSideQuestsForToday() selector added
//  - getRandomPenaltyQuest() selector added
//  - dailySideQuestSlots added to SystemMeta
// ============================================================

// ─────────────────────────────────────────────────────────────
//  SECTION 1: TYPE DEFINITIONS & INTERFACES
// ─────────────────────────────────────────────────────────────

/**
 * The 8 core stats that define the Hunter's mastery.
 * Every task rewards XP to one or more of these stats.
 */
export type StatKey =
  | "MTech"         // Mental / Technological Acuity
  | "TechSkill"     // Technical Hard Skills
  | "SexyBody"      // Physique & Physical Fitness
  | "GlassSkin"     // Skincare & Dermal Health
  | "EliteHair"     // Hair Aesthetics & Grooming
  | "AntiAging"     // Longevity & Cellular Health
  | "Charisma"      // Social Presence & Communication
  | "GlobalPolish"; // Overall Presentation & World Readiness

export interface StatDefinition {
  key: StatKey;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export type Rarity = "Common" | "Rare" | "Epic" | "Legendary";

export type TaskCategory =
  | "Fitness"
  | "Skincare"
  | "Grooming"
  | "Tech"
  | "Learning"
  | "Social"
  | "Wellness"
  | "Style";

export interface DailyTask {
  id: string;
  name: string;
  description: string;
  category: TaskCategory;
  rarity: Rarity;
  statRewards: { stat: StatKey; xp: number }[];
  currencyReward: number;
  countTowardDailyMinimum: boolean;
  estimatedMinutes: number;
  icon?: string;
}

/**
 * Side Quest — unlocked after dailyMinimumTasks are met.
 * Pool of 8, engine shows 2 randomly per day using a date seed.
 * dailyRotationCount controls how heavily weighted a task is in the pool.
 */
export interface SideQuest {
  id: string;
  name: string;
  description: string;
  category: TaskCategory;
  rarity: Rarity;
  statRewards: { stat: StatKey; xp: number }[];
  currencyReward: number;
  estimatedMinutes: number;
  /**
   * Weight in the daily rotation pool.
   * 1 = normal frequency. 2 = appears twice as often.
   * Engine picks SYSTEM_META.dailySideQuestSlots unique tasks per day.
   */
  dailyRotationCount: number;
  icon?: string;
}

/**
 * Guild Board Task — third daily tier.
 * Unlocked only after ALL of today's side quests are completed.
 * Pool of 6, engine shows 3 randomly per day.
 * Highest rewards. Pure grind. For the obsessive.
 *
 * FULL UNLOCK CHAIN:
 *   Tier 1 → Daily Tasks     (always visible, count toward boss + minimum)
 *         ↓  unlock when dailyMinimumTasks met
 *   Tier 2 → Side Quests     (2 random per day, higher XP/currency)
 *         ↓  unlock when ALL today's side quests completed
 *   Tier 3 → Guild Board     (3 random per day, highest rewards)
 */
export interface GuildTask {
  id: string;
  name: string;
  description: string;
  category: TaskCategory;
  rarity: Rarity;
  statRewards: { stat: StatKey; xp: number }[];
  currencyReward: number;
  /** Multiplier applied to BOTH XP and currency. e.g. 1.5 = +50% on top of base. */
  guildBonusMultiplier: number;
  dailyRotationCount: number;
  estimatedMinutes: number;
  icon?: string;
}

export interface BossEncounter {
  id: string;
  name: string;
  title: string;
  description: string;
  lore: string;
  rarity: Rarity;
  icon: string;
  requiredTaskIds: string[];
  daysToComplete: number | null;
  rewards: {
    currencyBonus: number;
    statBonuses: { stat: StatKey; xp: number }[];
    lootNodeId: string;
    titleUnlock?: string;
  };
}

export interface SkillTreeNode {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedByBossId: string;
  passiveBoost: { stat: StatKey; bonusXpPercent: number };
  position: { x: number; y: number };
  prerequisites: string[];
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: "Boost" | "Cosmetic" | "SkillTree" | "Lore";
  rarity: Rarity;
  icon: string;
  cost: number;
  effect:
    | { type: "xpMultiplier"; stat: StatKey; multiplier: number; durationHours: number }
    | { type: "currencyBoost"; multiplier: number; durationHours: number }
    | { type: "unlockCosmetic"; cosmeticId: string }
    | { type: "restorePenalty" };
}

/**
 * A single Penalty Quest entry in the pool.
 * Engine picks ONE randomly from penaltyQuests[] when penalty zone triggers.
 * Same quest all day if re-triggered — changes at midnight.
 */
export interface PenaltyQuest {
  id: string;
  name: string;
  description: string;
  lore: string;
  icon: string;
  tasks: {
    taskId: string;
    label: string;
    description: string;
  }[];
  escapeReward: {
    currencyBonus: number;
    statBonuses: { stat: StatKey; xp: number }[];
  };
}

export interface LevelDefinition {
  level: number;
  title: string;
  subtitle: string;
  description: string;
  dailyMinimumTasks: number;
  xpToNextLevel: number;
  dailyTasks: DailyTask[];
  /**
   * Full side quest pool for this level.
   * SYSTEM_META.dailySideQuestSlots of these are shown per day,
   * picked via seeded shuffle. Fresh selection every midnight.
   */
  sideQuests: SideQuest[];
  bosses: BossEncounter[];
  skillTreeNodes: SkillTreeNode[];
  shopItems: ShopItem[];
  /**
   * Pool of penalty quests for this level.
   * Engine picks ONE randomly when the penalty zone triggers.
   * Player never knows which one is coming — keeps it unpredictable.
   */
  penaltyQuests: PenaltyQuest[];
  /**
   * Guild Board task pool for this level.
   * 3 shown per day via seeded shuffle. Unlocks after all SQs done.
   */
  guildBoard: GuildTask[];
}

export interface SystemMeta {
  appName: string;
  appTagline: string;
  version: string;
  levelXpMultiplier: number;
  baseCurrencyMultiplier: number;
  /** How many side quests to show per day from the full pool */
  dailySideQuestSlots: number;
  ttsConfig: {
    enabled: boolean;
    voiceName: string;
    rate: number;
    pitch: number;
    volume: number;
    lines: Record<string, string>;
  };
  sfxConfig: {
    enabled: boolean;
    tracks: Record<
      | "taskComplete"
      | "sideQuestComplete"
      | "bossDefeated"
      | "levelUp"
      | "shopPurchase"
      | "penaltyActivate"
      | "penaltyEscape"
      | "guildBoardUnlocked"
      | "guildTaskComplete"
      | "shopUnlocked"
      | "error"
      | "uiClick"
      | "uiHover",
      string
    >;
  };
}

// ─────────────────────────────────────────────────────────────
//  SECTION 2: STAT DEFINITIONS
// ─────────────────────────────────────────────────────────────

export const STAT_DEFINITIONS: StatDefinition[] = [
  {
    key: "MTech",
    label: "MTech",
    description: "Mental sharpness, focus rituals, and technological fluency.",
    icon: "🧠",
    color: "#7C3AED",
  },
  {
    key: "TechSkill",
    label: "Tech Skill",
    description: "Hard technical skills — coding, systems, and tool mastery.",
    icon: "⚙️",
    color: "#2563EB",
  },
  {
    key: "SexyBody",
    label: "Sexy Body",
    description: "Physical fitness, body composition, and athletic performance.",
    icon: "💪",
    color: "#059669",
  },
  {
    key: "GlassSkin",
    label: "Glass Skin",
    description: "Skincare protocols, hydration, and dermal radiance.",
    icon: "✨",
    color: "#06B6D4",
  },
  {
    key: "EliteHair",
    label: "Elite Hair",
    description: "Hair health, styling mastery, and scalp care.",
    icon: "💈",
    color: "#D97706",
  },
  {
    key: "AntiAging",
    label: "Anti-Aging",
    description: "Longevity habits, sleep hygiene, and cellular recovery.",
    icon: "⏳",
    color: "#BE185D",
  },
  {
    key: "Charisma",
    label: "Charisma",
    description: "Social intelligence, presence, and communication power.",
    icon: "🗣️",
    color: "#F59E0B",
  },
  {
    key: "GlobalPolish",
    label: "Global Polish",
    description: "Presentation, world-readiness, and overall aura refinement.",
    icon: "🌐",
    color: "#10B981",
  },
];

// ─────────────────────────────────────────────────────────────
//  SECTION 3: LEVEL DEFINITIONS
// ─────────────────────────────────────────────────────────────

export const LEVELS: LevelDefinition[] = [

  // ════════════════════════════════════════════════════════════
  //  LEVEL 1 — E-RANK HUNTER: "AWAKENING PROTOCOLS"
  // ════════════════════════════════════════════════════════════
  {
    level: 1,
    title: "E-Rank Hunter",
    subtitle: "Awakening Protocols",
    description:
      "You have just awakened. Your stats are abysmal. The System has given you a chance — prove you are not a liability.",
    dailyMinimumTasks: 3,
    xpToNextLevel: 1000,

    // ── DAILY TASKS ──────────────────────────────────────────
    dailyTasks: [
      {
        id: "lv1_morning_hydration",
        name: "Morning Hydration Protocol",
        description:
          "Drink 500ml of water within 10 minutes of waking. No coffee first.",
        category: "Wellness",
        rarity: "Common",
        statRewards: [
          { stat: "GlassSkin", xp: 15 },
          { stat: "AntiAging", xp: 10 },
        ],
        currencyReward: 10,
        countTowardDailyMinimum: true,
        estimatedMinutes: 5,
        icon: "💧",
      },
      {
        id: "lv1_basic_push_ups",
        name: "30 Push-Up Initiation",
        description:
          "Complete 3 sets of 10 push-ups. Form over speed. No exceptions.",
        category: "Fitness",
        rarity: "Common",
        statRewards: [
          { stat: "SexyBody", xp: 25 },
          { stat: "AntiAging", xp: 5 },
        ],
        currencyReward: 15,
        countTowardDailyMinimum: true,
        estimatedMinutes: 10,
        icon: "🤜",
      },
      {
        id: "lv1_cleanser_routine",
        name: "Double Cleanse Protocol",
        description:
          "Oil cleanser → foam cleanser. Pat dry. No rubbing. Log completion.",
        category: "Skincare",
        rarity: "Common",
        statRewards: [
          { stat: "GlassSkin", xp: 20 },
          { stat: "GlobalPolish", xp: 5 },
        ],
        currencyReward: 12,
        countTowardDailyMinimum: true,
        estimatedMinutes: 8,
        icon: "🧼",
      },
      {
        id: "lv1_moisturizer_spf",
        name: "Moisturizer + SPF Deployment",
        description:
          "Apply moisturizer, wait 2 minutes, then apply SPF 50+ to face and neck.",
        category: "Skincare",
        rarity: "Common",
        statRewards: [
          { stat: "GlassSkin", xp: 20 },
          { stat: "AntiAging", xp: 15 },
        ],
        currencyReward: 12,
        countTowardDailyMinimum: true,
        estimatedMinutes: 5,
        icon: "🛡️",
      },
      {
        id: "lv1_scalp_massage",
        name: "3-Minute Scalp Stimulation",
        description:
          "Use fingertips (not nails) in circular motions for 3 minutes. Boosts blood flow to follicles.",
        category: "Grooming",
        rarity: "Common",
        statRewards: [
          { stat: "EliteHair", xp: 20 },
          { stat: "AntiAging", xp: 5 },
        ],
        currencyReward: 10,
        countTowardDailyMinimum: false,
        estimatedMinutes: 3,
        icon: "🧠",
      },
      {
        id: "lv1_posture_check",
        name: "Posture Recalibration",
        description:
          "Set a 1-hour timer. Each time it fires, 30-second correction: shoulders back, chin neutral, core engaged.",
        category: "Fitness",
        rarity: "Common",
        statRewards: [
          { stat: "GlobalPolish", xp: 15 },
          { stat: "SexyBody", xp: 10 },
          { stat: "Charisma", xp: 5 },
        ],
        currencyReward: 10,
        countTowardDailyMinimum: false,
        estimatedMinutes: 15,
        icon: "📐",
      },
      {
        id: "lv1_read_tech_30",
        name: "30-Min Tech Absorption",
        description:
          "Read one technical article, documentation page, or tutorial for 30 uninterrupted minutes. Log the topic.",
        category: "Tech",
        rarity: "Rare",
        statRewards: [
          { stat: "TechSkill", xp: 30 },
          { stat: "MTech", xp: 15 },
        ],
        currencyReward: 20,
        countTowardDailyMinimum: true,
        estimatedMinutes: 30,
        icon: "📡",
      },
      {
        id: "lv1_night_skin_routine",
        name: "Night Skin Regeneration Protocol",
        description:
          "Evening cleanse + retinol or niacinamide serum + occlusive moisturizer. Repair happens at night.",
        category: "Skincare",
        rarity: "Rare",
        statRewards: [
          { stat: "GlassSkin", xp: 30 },
          { stat: "AntiAging", xp: 20 },
        ],
        currencyReward: 18,
        countTowardDailyMinimum: true,
        estimatedMinutes: 10,
        icon: "🌙",
      },
      {
        id: "lv1_vocal_training",
        name: "Voice Modulation Drill",
        description:
          "Record yourself speaking for 2 minutes. Play it back. Identify one improvement: pace, tone, or filler words.",
        category: "Social",
        rarity: "Common",
        statRewards: [
          { stat: "Charisma", xp: 20 },
          { stat: "GlobalPolish", xp: 10 },
        ],
        currencyReward: 12,
        countTowardDailyMinimum: false,
        estimatedMinutes: 10,
        icon: "🎙️",
      },
      {
        id: "lv1_steps_target",
        name: "7,000 Step March",
        description:
          "Accumulate 7,000 steps. Carry yourself like a hunter, not a civilian.",
        category: "Fitness",
        rarity: "Common",
        statRewards: [
          { stat: "SexyBody", xp: 20 },
          { stat: "AntiAging", xp: 10 },
          { stat: "GlobalPolish", xp: 5 },
        ],
        currencyReward: 15,
        countTowardDailyMinimum: false,
        estimatedMinutes: 60,
        icon: "👟",
      },
    ],

    // ── SIDE QUESTS POOL ─────────────────────────────────────
    // 8 total in pool — 2 shown per day via seeded daily rotation.
    // Each has dailyRotationCount: 1 = equal weight in the shuffle.
    // Increase dailyRotationCount on a task to make it appear more often.
    sideQuests: [
      {
        id: "lv1_sq_cold_shower",
        name: "[SIDE QUEST] Cold Shower Trial",
        description:
          "End your shower with 60 seconds of cold water. Activates the vagus nerve. Builds mental fortitude. No negotiation.",
        category: "Wellness",
        rarity: "Rare",
        statRewards: [
          { stat: "AntiAging", xp: 40 },
          { stat: "SexyBody", xp: 20 },
          { stat: "MTech", xp: 15 },
        ],
        currencyReward: 50,
        dailyRotationCount: 1,
        estimatedMinutes: 5,
        icon: "🧊",
      },
      {
        id: "lv1_sq_outfit_audit",
        name: "[SIDE QUEST] Wardrobe Audit — Remove One Weak Item",
        description:
          "Identify and discard or donate one item from your wardrobe that doesn't belong on an Elite Hunter.",
        category: "Style",
        rarity: "Rare",
        statRewards: [
          { stat: "GlobalPolish", xp: 35 },
          { stat: "Charisma", xp: 15 },
        ],
        currencyReward: 40,
        dailyRotationCount: 1,
        estimatedMinutes: 20,
        icon: "🧥",
      },
      {
        id: "lv1_sq_social_interaction",
        name: "[SIDE QUEST] Deliberate Social Engagement",
        description:
          "Initiate one meaningful conversation with a stranger or acquaintance. Make eye contact. Ask one thoughtful question.",
        category: "Social",
        rarity: "Epic",
        statRewards: [
          { stat: "Charisma", xp: 50 },
          { stat: "GlobalPolish", xp: 20 },
          { stat: "MTech", xp: 10 },
        ],
        currencyReward: 60,
        dailyRotationCount: 1,
        estimatedMinutes: 15,
        icon: "🤝",
      },
      {
        id: "lv1_sq_sunscreen_reapply",
        name: "[SIDE QUEST] Midday SPF Reapplication",
        description:
          "Reapply SPF at midday — especially if you have been outdoors. Most people skip this. Most people age faster.",
        category: "Skincare",
        rarity: "Common",
        statRewards: [
          { stat: "GlassSkin", xp: 30 },
          { stat: "AntiAging", xp: 20 },
        ],
        currencyReward: 35,
        dailyRotationCount: 1,
        estimatedMinutes: 3,
        icon: "☀️",
      },
      {
        id: "lv1_sq_no_sugar_day",
        name: "[SIDE QUEST] Zero Sugar Protocol",
        description:
          "No added sugar today. No soda, no candy, no sweetened coffee. Read every label. Your skin and longevity will thank you.",
        category: "Wellness",
        rarity: "Rare",
        statRewards: [
          { stat: "GlassSkin", xp: 35 },
          { stat: "AntiAging", xp: 30 },
          { stat: "SexyBody", xp: 15 },
        ],
        currencyReward: 55,
        dailyRotationCount: 1,
        estimatedMinutes: 0,
        icon: "🚫",
      },
      {
        id: "lv1_sq_journaling",
        name: "[SIDE QUEST] System Log Entry",
        description:
          "Write 200 words minimum about today: what you did, what you felt, what you will improve. Clarity is a weapon.",
        category: "Wellness",
        rarity: "Rare",
        statRewards: [
          { stat: "MTech", xp: 35 },
          { stat: "Charisma", xp: 20 },
          { stat: "GlobalPolish", xp: 10 },
        ],
        currencyReward: 45,
        dailyRotationCount: 1,
        estimatedMinutes: 15,
        icon: "📓",
      },
      {
        id: "lv1_sq_hair_treatment",
        name: "[SIDE QUEST] Deep Hair Conditioning",
        description:
          "Apply a hair mask or deep conditioner. Leave for minimum 20 minutes. Rinse with cool water to seal cuticles.",
        category: "Grooming",
        rarity: "Rare",
        statRewards: [
          { stat: "EliteHair", xp: 50 },
          { stat: "GlobalPolish", xp: 15 },
        ],
        currencyReward: 40,
        dailyRotationCount: 1,
        estimatedMinutes: 25,
        icon: "💆",
      },
      {
        id: "lv1_sq_coding_sprint",
        name: "[SIDE QUEST] 45-Min Focus Sprint",
        description:
          "One task. One window. No notifications. 45 minutes of pure technical output. Timer starts when you open the editor.",
        category: "Tech",
        rarity: "Epic",
        statRewards: [
          { stat: "TechSkill", xp: 55 },
          { stat: "MTech", xp: 25 },
        ],
        currencyReward: 65,
        dailyRotationCount: 1,
        estimatedMinutes: 45,
        icon: "💻",
      },
    ],

    // ── BOSS ENCOUNTERS ───────────────────────────────────────
    bosses: [
      {
        id: "lv1_boss_the_slug",
        name: "THE SLUG",
        title: "Ancient Sovereign of Inertia",
        description:
          "Defeat the physical manifestation of your former sedentary self.",
        lore: "It has lived in you for years, fed by excuses and comfort. It is slow, but its roots run deep. The System has flagged it as your first true obstacle. Complete the prescribed physical conditioning tasks for 7 consecutive days to sever its hold.",
        rarity: "Rare",
        icon: "🐌",
        requiredTaskIds: [
          "lv1_basic_push_ups",
          "lv1_steps_target",
          "lv1_posture_check",
        ],
        daysToComplete: 7,
        rewards: {
          currencyBonus: 150,
          statBonuses: [
            { stat: "SexyBody", xp: 100 },
            { stat: "AntiAging", xp: 50 },
          ],
          lootNodeId: "node_iron_will",
          titleUnlock: "Slug Slayer",
        },
      },
      {
        id: "lv1_boss_the_grey_face",
        name: "THE GREY FACE",
        title: "Lord of Neglected Aesthetics",
        description:
          "Banish the dull, tired appearance that has been your default existence.",
        lore: "You have been invisible. Forgettable. The Grey Face is a mirror that shows the world what they see when they see you — nothing. Complete your skincare and grooming protocols for 7 consecutive days to shatter this reflection permanently.",
        rarity: "Rare",
        icon: "👤",
        requiredTaskIds: [
          "lv1_cleanser_routine",
          "lv1_moisturizer_spf",
          "lv1_night_skin_routine",
          "lv1_scalp_massage",
        ],
        daysToComplete: 7,
        rewards: {
          currencyBonus: 200,
          statBonuses: [
            { stat: "GlassSkin", xp: 120 },
            { stat: "EliteHair", xp: 60 },
            { stat: "GlobalPolish", xp: 40 },
          ],
          lootNodeId: "node_luminous_aura",
          titleUnlock: "The Luminous",
        },
      },
    ],

    // ── SKILL TREE NODES ──────────────────────────────────────
    skillTreeNodes: [
      {
        id: "node_iron_will",
        name: "Iron Will",
        description: "Passive: All SexyBody and AntiAging task XP increased by 10%.",
        icon: "⚔️",
        unlockedByBossId: "lv1_boss_the_slug",
        passiveBoost: { stat: "SexyBody", bonusXpPercent: 10 },
        position: { x: 30, y: 20 },
        prerequisites: [],
      },
      {
        id: "node_luminous_aura",
        name: "Luminous Aura",
        description: "Passive: All GlassSkin and EliteHair task XP increased by 10%.",
        icon: "🌟",
        unlockedByBossId: "lv1_boss_the_grey_face",
        passiveBoost: { stat: "GlassSkin", bonusXpPercent: 10 },
        position: { x: 70, y: 20 },
        prerequisites: [],
      },
    ],

    // ── SHOP ITEMS ────────────────────────────────────────────
    shopItems: [
      {
        id: "shop_lv1_xp_boost_skin",
        name: "Dermal Overcharge",
        description: "Double GlassSkin XP for 24 hours. Limited supply.",
        category: "Boost",
        rarity: "Rare",
        icon: "⚗️",
        cost: 80,
        effect: {
          type: "xpMultiplier",
          stat: "GlassSkin",
          multiplier: 2.0,
          durationHours: 24,
        },
      },
      {
        id: "shop_lv1_xp_boost_body",
        name: "Muscle Memory Injection",
        description: "Double SexyBody XP for 24 hours.",
        category: "Boost",
        rarity: "Rare",
        icon: "💉",
        cost: 80,
        effect: {
          type: "xpMultiplier",
          stat: "SexyBody",
          multiplier: 2.0,
          durationHours: 24,
        },
      },
      {
        id: "shop_lv1_xp_boost_tech",
        name: "Neural Overclock",
        description: "Double TechSkill XP for 12 hours.",
        category: "Boost",
        rarity: "Rare",
        icon: "🔌",
        cost: 90,
        effect: {
          type: "xpMultiplier",
          stat: "TechSkill",
          multiplier: 2.0,
          durationHours: 12,
        },
      },
      {
        id: "shop_lv1_currency_boost",
        name: "Credit Surge Protocol",
        description: "All task currency rewards doubled for 12 hours. Use wisely.",
        category: "Boost",
        rarity: "Epic",
        icon: "💰",
        cost: 120,
        effect: {
          type: "currencyBoost",
          multiplier: 2.0,
          durationHours: 12,
        },
      },
      {
        id: "shop_lv1_cosmetic_blue_theme",
        name: "Void Blue Interface",
        description: "Unlocks the deep-void blue UI color scheme. Purely cosmetic.",
        category: "Cosmetic",
        rarity: "Common",
        icon: "🎨",
        cost: 50,
        effect: {
          type: "unlockCosmetic",
          cosmeticId: "theme_void_blue",
        },
      },
      {
        id: "shop_lv1_penalty_pardon",
        name: "Penalty Zone Pardon",
        description:
          "Instantly clears Penalty Zone status. No quest required. Use with shame.",
        category: "Boost",
        rarity: "Legendary",
        icon: "🔑",
        cost: 300,
        effect: {
          type: "restorePenalty",
        },
      },
    ],

    // ── PENALTY QUESTS POOL ───────────────────────────────────
    // 4 quests in the pool — engine picks ONE randomly at midnight
    // using a date seed. Same quest all day. New one possible tomorrow.
    // Add more here to increase unpredictability.
    penaltyQuests: [
      {
        id: "lv1_penalty_iron_gauntlet",
        name: "⚠️ PENALTY: THE IRON GAUNTLET",
        description:
          "You failed your minimum obligations. The System does not forgive weakness — it quantifies it.",
        lore: "The dungeon gates have closed around you. Your interface has been flagged RED. You chose comfort over progress. Now you will earn your way back through iron and sweat. Begin immediately. The System is watching.",
        icon: "🔴",
        tasks: [
          {
            taskId: "pen_ig_pushups",
            label: "100 Push-Up Gauntlet",
            description:
              "Complete 100 push-ups in however many sets it takes. Non-negotiable. Non-skippable.",
          },
          {
            taskId: "pen_ig_skin",
            label: "Double Skincare Cycle",
            description:
              "Complete both the morning AND evening skincare routines back-to-back right now.",
          },
          {
            taskId: "pen_ig_tech",
            label: "1-Hour Tech Deep Dive",
            description:
              "Read technical material for a full uninterrupted 60 minutes. No phone, no music.",
          },
        ],
        escapeReward: {
          currencyBonus: 30,
          statBonuses: [
            { stat: "MTech", xp: 20 },
            { stat: "SexyBody", xp: 30 },
          ],
        },
      },
      {
        id: "lv1_penalty_the_reckoning",
        name: "⚠️ PENALTY: THE RECKONING",
        description:
          "Negligence has consequences. The System has issued a Reckoning Protocol.",
        lore: "You think you can skip days and remain stagnant while others grind? The System has seen your failure and responded. The Reckoning is not a punishment — it is a calibration. Complete the sequence and your rank will be restored.",
        icon: "🔴",
        tasks: [
          {
            taskId: "pen_rec_walk",
            label: "10,000 Step March",
            description:
              "Walk 10,000 steps today. No excuses about weather. Move.",
          },
          {
            taskId: "pen_rec_cold",
            label: "2-Minute Cold Shower",
            description:
              "Full 2 minutes of cold water. Not lukewarm. Cold. Count every second.",
          },
          {
            taskId: "pen_rec_journal",
            label: "Failure Analysis Report",
            description:
              "Write 300 words on why you failed yesterday and what changes today. Be brutally honest.",
          },
        ],
        escapeReward: {
          currencyBonus: 25,
          statBonuses: [
            { stat: "MTech", xp: 30 },
            { stat: "AntiAging", xp: 20 },
          ],
        },
      },
      {
        id: "lv1_penalty_void_protocol",
        name: "⚠️ PENALTY: VOID PROTOCOL",
        description:
          "The System has initiated Void Protocol. Your aesthetic standing has been revoked.",
        lore: "In the void there is no rank. No title. No aura. You failed to maintain the minimum and the System has stripped your visible progress. The Void Protocol demands you prove your commitment to the physical and aesthetic disciplines before restoration.",
        icon: "🔴",
        tasks: [
          {
            taskId: "pen_vp_skin_full",
            label: "Full Skincare Sequence",
            description:
              "Morning cleanse, toner, serum, moisturizer, SPF. Then evening cleanse, retinol, night cream. All steps. Right now.",
          },
          {
            taskId: "pen_vp_squats",
            label: "150 Bodyweight Squats",
            description:
              "150 squats. Any tempo. Take breaks. Finish all 150.",
          },
          {
            taskId: "pen_vp_grooming",
            label: "Complete Grooming Audit",
            description:
              "Shower, scalp massage, style hair, trim anything that needs trimming. Present yourself as if meeting someone important.",
          },
        ],
        escapeReward: {
          currencyBonus: 35,
          statBonuses: [
            { stat: "GlassSkin", xp: 40 },
            { stat: "SexyBody", xp: 25 },
            { stat: "GlobalPolish", xp: 20 },
          ],
        },
      },
      {
        id: "lv1_penalty_mind_fracture",
        name: "⚠️ PENALTY: MIND FRACTURE",
        description:
          "Cognitive delinquency detected. The System has issued a Mind Fracture Protocol.",
        lore: "Your mind has gone soft. You chose distraction over discipline and now the System has noticed the decay. The Mind Fracture Protocol targets your weakest layer — your focus and your technical edge. Sharpen both or remain in the red.",
        icon: "🔴",
        tasks: [
          {
            taskId: "pen_mf_nophone",
            label: "2-Hour No-Phone Block",
            description:
              "Phone in another room for 2 continuous hours. Work, read, or train. Log what you did.",
          },
          {
            taskId: "pen_mf_learn",
            label: "Learn One New Thing",
            description:
              "Spend 45 minutes learning something technical you do not know yet. Document it in one paragraph.",
          },
          {
            taskId: "pen_mf_meditate",
            label: "20-Minute Stillness",
            description:
              "Sit still for 20 minutes. No phone, no music, no podcast. Just you and your thoughts.",
          },
        ],
        escapeReward: {
          currencyBonus: 30,
          statBonuses: [
            { stat: "MTech", xp: 50 },
            { stat: "TechSkill", xp: 20 },
          ],
        },
      },
    ],

    // ── GUILD BOARD ───────────────────────────────────────────
    // 6 tasks in pool — 3 shown per day via seeded rotation.
    // Unlocks only after ALL of today's side quests are completed.
    guildBoard: [
      {
        id: "lv1_gb_extended_workout",
        name: "〔GUILD〕 Extended Combat Training",
        description:
          "45-minute workout: push-ups, squats, lunges, and planks in circuit format. No rest longer than 60 seconds between sets. Log every set.",
        category: "Fitness",
        rarity: "Rare",
        statRewards: [
          { stat: "SexyBody", xp: 60 },
          { stat: "AntiAging", xp: 20 },
        ],
        currencyReward: 40,
        guildBonusMultiplier: 1.5,
        dailyRotationCount: 1,
        estimatedMinutes: 45,
        icon: "⚔️",
      },
      {
        id: "lv1_gb_gua_sha",
        name: "〔GUILD〕 Gua Sha Lymphatic Drain",
        description:
          "10-minute gua sha facial protocol. Upward strokes only. Use facial oil. Reduces puffiness and stimulates collagen production.",
        category: "Skincare",
        rarity: "Rare",
        statRewards: [
          { stat: "GlassSkin", xp: 55 },
          { stat: "AntiAging", xp: 25 },
        ],
        currencyReward: 35,
        guildBonusMultiplier: 1.5,
        dailyRotationCount: 1,
        estimatedMinutes: 15,
        icon: "🪨",
      },
      {
        id: "lv1_gb_build_something",
        name: "〔GUILD〕 Build One Thing",
        description:
          "Spend 60 minutes building or coding anything — a script, a tool, a prototype, a system. Ship or commit something. Existence without output is irrelevant.",
        category: "Tech",
        rarity: "Epic",
        statRewards: [
          { stat: "TechSkill", xp: 70 },
          { stat: "MTech", xp: 30 },
        ],
        currencyReward: 60,
        guildBonusMultiplier: 1.75,
        dailyRotationCount: 1,
        estimatedMinutes: 60,
        icon: "🔧",
      },
      {
        id: "lv1_gb_mirror_audit",
        name: "〔GUILD〕 Full Mirror Audit",
        description:
          "Full-length mirror, good lighting. Audit body, posture, skin, hair, overall presentation. Write down 3 specific improvements. No self-deception.",
        category: "Style",
        rarity: "Rare",
        statRewards: [
          { stat: "GlobalPolish", xp: 40 },
          { stat: "Charisma", xp: 25 },
          { stat: "MTech", xp: 15 },
        ],
        currencyReward: 30,
        guildBonusMultiplier: 1.5,
        dailyRotationCount: 1,
        estimatedMinutes: 20,
        icon: "🪞",
      },
      {
        id: "lv1_gb_sleep_protocol",
        name: "〔GUILD〕 Elite Sleep Protocol",
        description:
          "No screens 45 minutes before bed. Magnesium glycinate taken. Room at 18–20°C. Sleep by 10:30 PM. Mark complete only the following morning if all conditions were met.",
        category: "Wellness",
        rarity: "Epic",
        statRewards: [
          { stat: "AntiAging", xp: 70 },
          { stat: "GlassSkin", xp: 30 },
          { stat: "MTech", xp: 20 },
        ],
        currencyReward: 50,
        guildBonusMultiplier: 2.0,
        dailyRotationCount: 1,
        estimatedMinutes: 480,
        icon: "🌑",
      },
      {
        id: "lv1_gb_public_presence",
        name: "〔GUILD〕 Command a Room",
        description:
          "Enter any public space — café, gym, office — and consciously project: shoulders back, deliberate pace, sustained eye contact, no phone. Maintain it for the entire duration. Others will notice.",
        category: "Social",
        rarity: "Epic",
        statRewards: [
          { stat: "Charisma", xp: 65 },
          { stat: "GlobalPolish", xp: 35 },
        ],
        currencyReward: 55,
        guildBonusMultiplier: 1.75,
        dailyRotationCount: 1,
        estimatedMinutes: 60,
        icon: "👁️",
      },
    ],
  },

  // ════════════════════════════════════════════════════════════
  //  LEVEL 2 — D-RANK HUNTER (PLACEHOLDER — FILL IN LATER)
  //  Uncomment and populate when ready to expand.
  // ════════════════════════════════════════════════════════════
  //
  // {
  //   level: 2,
  //   title: "D-Rank Hunter",
  //   subtitle: "Refinement Protocols",
  //   description: "You survived the awakening. Now the System begins to sharpen you.",
  //   dailyMinimumTasks: 4,
  //   xpToNextLevel: 2500,
  //   dailyTasks: [],
  //   sideQuests: [],
  //   bosses: [],
  //   skillTreeNodes: [],
  //   shopItems: [],
  //   penaltyQuests: [],
  //   guildBoard: [],
  // },
];

// ─────────────────────────────────────────────────────────────
//  SECTION 4: GLOBAL SYSTEM META
// ─────────────────────────────────────────────────────────────

export const SYSTEM_META: SystemMeta = {
  appName: "SYSTEM — HUNTER PROTOCOL",
  appTagline: "Arise.",
  version: "0.2.0",
  levelXpMultiplier: 1.5,
  baseCurrencyMultiplier: 1.0,
  dailySideQuestSlots: 2,

  ttsConfig: {
    enabled: true,
    voiceName: "Google UK English Male",
    rate: 0.85,
    pitch: 0.6,
    volume: 0.9,
    lines: {
      taskComplete:       "Task complete. System updated.",
      sideQuestComplete:  "Side quest cleared. Currency deposited.",
      guildTaskComplete:  "Guild task complete. Bonus credits deposited.",
      bossDefeated:       "Boss eliminated. Loot acquired.",
      levelUp:            "Level up. Your rank has been reassessed. The weak will take note.",
      shopUnlocked:       "Daily minimum achieved. Shop access granted.",
      shopPurchase:       "Transaction complete.",
      penaltyActivate:    "Warning. Daily obligations not met. Penalty Zone activated. Red protocol engaged.",
      penaltyEscape:      "Penalty quest complete. Normal protocols restored.",
      guildBoardUnlocked: "All side quests complete. Guild Board access granted. The real grind begins.",
      error:              "System error detected.",
      appOpen:            "Welcome back, Hunter. The System is watching.",
    },
  },

  sfxConfig: {
    enabled: true,
    tracks: {
      taskComplete:       "__PLACEHOLDER__",
      sideQuestComplete:  "__PLACEHOLDER__",
      bossDefeated:       "__PLACEHOLDER__",
      levelUp:            "__PLACEHOLDER__",
      shopPurchase:       "__PLACEHOLDER__",
      penaltyActivate:    "__PLACEHOLDER__",
      penaltyEscape:      "__PLACEHOLDER__",
      guildBoardUnlocked: "__PLACEHOLDER__",
      guildTaskComplete:  "__PLACEHOLDER__",
      shopUnlocked:       "__PLACEHOLDER__",
      error:              "__PLACEHOLDER__",
      uiClick:            "__PLACEHOLDER__",
      uiHover:            "__PLACEHOLDER__",
    },
  },
};

// ─────────────────────────────────────────────────────────────
//  SECTION 5: SEEDED RANDOM UTILITIES
//  Internal helpers — used by selectors below.
//  Deterministic: same seed = same result every time.
// ─────────────────────────────────────────────────────────────

/** Mulberry32 — fast seeded pseudo-random number generator. */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today as YYYYMMDD integer. Stable all day, changes at midnight. */
function todaySeed(): number {
  const d = new Date();
  return (
    d.getFullYear() * 10000 +
    (d.getMonth() + 1) * 100 +
    d.getDate()
  );
}

/** Seeded Fisher-Yates shuffle — same order for same seed. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand   = seededRandom(seed);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
//  SECTION 6: CONVENIENCE SELECTORS
//  Used by the game engine and UI components.
//  Never query LEVELS[] directly — always use these.
// ─────────────────────────────────────────────────────────────

/** Get a level definition by level number. */
export function getLevelDef(level: number): LevelDefinition | undefined {
  return LEVELS.find(l => l.level === level);
}

/** Get a stat definition by key. */
export function getStatDef(key: StatKey): StatDefinition | undefined {
  return STAT_DEFINITIONS.find(s => s.key === key);
}

/** Get a daily task by ID (searches all levels). */
export function getTaskById(id: string): DailyTask | undefined {
  for (const level of LEVELS) {
    const task = level.dailyTasks.find(t => t.id === id);
    if (task) return task;
  }
  return undefined;
}

/** Get a boss by ID (searches all levels). */
export function getBossById(id: string): BossEncounter | undefined {
  for (const level of LEVELS) {
    const boss = level.bosses.find(b => b.id === id);
    if (boss) return boss;
  }
  return undefined;
}

/** Get all tasks that count toward the daily minimum for a given level. */
export function getMinimumTasks(level: number): DailyTask[] {
  return getLevelDef(level)?.dailyTasks.filter(t => t.countTowardDailyMinimum) ?? [];
}

/** Get total XP required to reach a target level from level 1. */
export function getCumulativeXpToLevel(targetLevel: number): number {
  return LEVELS.filter(l => l.level < targetLevel).reduce(
    (sum, l) => sum + l.xpToNextLevel,
    0
  );
}

/**
 * Get today's Guild Board rotation (3 tasks from pool of 6).
 * Seed offset 0. Rotates at midnight.
 */
export function getGuildBoardForToday(level: number): GuildTask[] {
  const levelDef = getLevelDef(level);
  if (!levelDef || levelDef.guildBoard.length === 0) return [];

  const SLOTS    = 3;
  const shuffled = seededShuffle(levelDef.guildBoard, todaySeed());
  const seen     = new Set<string>();
  const result: GuildTask[] = [];

  for (const task of shuffled) {
    if (!seen.has(task.id)) {
      seen.add(task.id);
      result.push(task);
    }
    if (result.length >= SLOTS) break;
  }
  return result;
}

/**
 * Get today's Side Quest rotation.
 * Returns SYSTEM_META.dailySideQuestSlots unique tasks from the pool.
 * Seed offset +1 so it shuffles independently from guild board.
 */
export function getSideQuestsForToday(level: number): SideQuest[] {
  const levelDef = getLevelDef(level);
  if (!levelDef || levelDef.sideQuests.length === 0) return [];

  // Build weighted pool — tasks with higher dailyRotationCount appear more
  const pool: SideQuest[] = [];
  for (const sq of levelDef.sideQuests) {
    for (let i = 0; i < sq.dailyRotationCount; i++) {
      pool.push(sq);
    }
  }

  const slots    = SYSTEM_META.dailySideQuestSlots;
  const shuffled = seededShuffle(pool, todaySeed() + 1);
  const seen     = new Set<string>();
  const result: SideQuest[] = [];

  for (const sq of shuffled) {
    if (!seen.has(sq.id)) {
      seen.add(sq.id);
      result.push(sq);
    }
    if (result.length >= slots) break;
  }
  return result;
}

/**
 * Pick today's random penalty quest from the pool.
 * Seed offset +7 — independent from task rotation.
 * Same quest all day if triggered multiple times. Resets at midnight.
 */
export function getRandomPenaltyQuest(level: number): PenaltyQuest | undefined {
  const levelDef = getLevelDef(level);
  if (!levelDef || levelDef.penaltyQuests.length === 0) return undefined;

  const rand  = seededRandom(todaySeed() + 7);
  const index = Math.floor(rand() * levelDef.penaltyQuests.length);
  return levelDef.penaltyQuests[index];
}