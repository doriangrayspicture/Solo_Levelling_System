// ============================================================
//  HUNTER PROTOCOL — GAME LOGIC ENGINE
//  store/useGameStore.ts  —  v4
//
//  Fixes:
//  ✓ Penalty zone re-trigger on reload fixed:
//    runMidnightCheck now skips if penalty was ALREADY escaped
//    today (checks today's penalty completion in daily_task_log)
//  ✓ New player guard uses .lt() so only prior days count
//  ✓ Skipped day correctly triggers penalty (yesterdayCount = 0)
//  ✓ All previous fixes retained
// ============================================================

import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import {
  SYSTEM_META,
  getLevelDef,
  getGuildBoardForToday,
  getSideQuestsForToday,
  getRandomPenaltyQuest,
  type StatKey,
  type GuildTask,
  type SideQuest,
  type LevelDefinition,
  type ShopItem,
  type PenaltyQuest,
} from '../config/SystemConfig';

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

export type StatXpMap = Record<StatKey, number>;

export interface ActiveBoost {
  multiplier: number;
  expiresAt: string;
}

export interface PlayerProfile {
  id: string;
  hunterName: string;
  currentTitle: string;
  currentLevel: number;
  systemCurrency: number;
  statXp: StatXpMap;
  activeBoosts: Partial<Record<StatKey, ActiveBoost>> & { currency?: ActiveBoost };
  isInPenaltyZone: boolean;
  penaltyActivatedAt: string | null;
  penaltyQuestProgress: { taskId: string; completed: boolean }[];
  activePenaltyQuestId: string | null;
  unlockedCosmetics: string[];
  activeCosmetic: string;
  unlockedSkillNodes: string[];
}

export interface DailyState {
  completedTaskIds:    string[];
  completedTaskIdsSet: Set<string>;
  completedDailyCount: number;
  allSideQuestsComplete: boolean;
  shopUnlocked: boolean;
  sideQuestsUnlocked: boolean;
  guildBoardUnlocked: boolean;
  todayGuildTasks: GuildTask[];
  todaySideQuests: SideQuest[];
}

export interface BossState {
  bossId: string;
  status: 'active' | 'defeated' | 'failed';
  completedTaskIds: string[];
  startedAt: string;
  defeatedAt: string | null;
  lootClaimed: boolean;
}

export interface GameStore {
  isLoading:          boolean;
  isInitialized:      boolean;
  error:              string | null;
  player:             PlayerProfile | null;
  dailyState:         DailyState;
  bossStates:         BossState[];
  currentLevelDef:    LevelDefinition | null;
  activePenaltyQuest: PenaltyQuest | null;

  signUp:              (email: string, password: string, hunterName: string) => Promise<void>;
  signIn:              (email: string, password: string) => Promise<void>;
  signOut:             () => Promise<void>;
  initialize:          () => Promise<void>;
  completeTask:        (taskId: string, taskType: 'daily' | 'side_quest' | 'guild_task') => Promise<void>;
  completePenaltyStep: (taskId: string) => Promise<void>;
  claimBossLoot:       (bossId: string) => Promise<void>;
  purchaseShopItem:    (item: ShopItem) => Promise<void>;
  runMidnightCheck:    () => Promise<void>;
  _refreshDailyState:  () => Promise<void>;
  _checkBossProgress:  (taskId: string) => Promise<void>;
  _checkLevelUp:       () => Promise<void>;
  _triggerPenaltyZone: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

function rowToProfile(row: any, skillNodes: string[]): PlayerProfile {
  return {
    id:                   row.id,
    hunterName:           row.hunter_name,
    currentTitle:         row.current_title,
    currentLevel:         row.current_level,
    systemCurrency:       row.system_currency,
    statXp: {
      MTech:        row.xp_mtech,
      TechSkill:    row.xp_tech_skill,
      SexyBody:     row.xp_sexy_body,
      GlassSkin:    row.xp_glass_skin,
      EliteHair:    row.xp_elite_hair,
      AntiAging:    row.xp_anti_aging,
      Charisma:     row.xp_charisma,
      GlobalPolish: row.xp_global_polish,
    },
    activeBoosts:         row.active_boosts ?? {},
    isInPenaltyZone:      row.is_in_penalty_zone,
    penaltyActivatedAt:   row.penalty_activated_at,
    penaltyQuestProgress: row.penalty_quest_progress ?? [],
    activePenaltyQuestId: row.active_penalty_quest_id ?? null,
    unlockedCosmetics:    row.unlocked_cosmetics ?? [],
    activeCosmetic:       row.active_cosmetic,
    unlockedSkillNodes:   skillNodes,
  };
}

const STAT_TO_COLUMN: Record<StatKey, string> = {
  MTech:        'xp_mtech',
  TechSkill:    'xp_tech_skill',
  SexyBody:     'xp_sexy_body',
  GlassSkin:    'xp_glass_skin',
  EliteHair:    'xp_elite_hair',
  AntiAging:    'xp_anti_aging',
  Charisma:     'xp_charisma',
  GlobalPolish: 'xp_global_polish',
};

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getXpMultiplier(
  boosts: PlayerProfile['activeBoosts'],
  stat: StatKey
): number {
  const boost = (boosts as any)[stat] as ActiveBoost | undefined;
  if (!boost || new Date(boost.expiresAt) < new Date()) return 1.0;
  return boost.multiplier;
}

function getCurrencyMultiplier(boosts: PlayerProfile['activeBoosts']): number {
  const boost = boosts.currency as ActiveBoost | undefined;
  if (!boost || new Date(boost.expiresAt) < new Date()) return 1.0;
  return boost.multiplier;
}

function getSkillNodeBonus(
  unlockedNodeIds: string[],
  stat: StatKey,
  level: number
): number {
  const levelDef = getLevelDef(level);
  if (!levelDef) return 0;
  return levelDef.skillTreeNodes
    .filter(n => unlockedNodeIds.includes(n.id) && n.passiveBoost.stat === stat)
    .reduce((sum, n) => sum + n.passiveBoost.bonusXpPercent, 0);
}

function emptyDailyState(level: number): DailyState {
  return {
    completedTaskIds:      [],
    completedTaskIdsSet:   new Set(),
    completedDailyCount:   0,
    allSideQuestsComplete: false,
    shopUnlocked:          false,
    sideQuestsUnlocked:    false,
    guildBoardUnlocked:    false,
    todayGuildTasks:       getGuildBoardForToday(level),
    todaySideQuests:       getSideQuestsForToday(level),
  };
}

function buildDailyState(
  rows: { task_id: string; task_type: string }[],
  level: number,
  dailyMinimum: number
): DailyState {
  const completedTaskIds    = rows.map(r => r.task_id);
  const completedTaskIdsSet = new Set<string>(completedTaskIds);
  const completedDailyCount = rows.filter(r => r.task_type === 'daily').length;
  const sideQuestsUnlocked  = completedDailyCount >= dailyMinimum;
  const todaySideQuests     = getSideQuestsForToday(level);
  const allSideQuestsComplete =
    sideQuestsUnlocked &&
    todaySideQuests.every(sq => completedTaskIdsSet.has(sq.id));

  return {
    completedTaskIds,
    completedTaskIdsSet,
    completedDailyCount,
    allSideQuestsComplete,
    shopUnlocked:       sideQuestsUnlocked,
    sideQuestsUnlocked,
    guildBoardUnlocked: allSideQuestsComplete,
    todayGuildTasks:    getGuildBoardForToday(level),
    todaySideQuests,
  };
}

// ─────────────────────────────────────────────────────────────
//  STORE
// ─────────────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => ({

  isLoading:          false,
  isInitialized:      false,
  error:              null,
  player:             null,
  dailyState:         emptyDailyState(1),
  bossStates:         [],
  currentLevelDef:    getLevelDef(1) ?? null,
  activePenaltyQuest: null,

  // ─────────────────────────────────────────────────────────
  //  AUTH
  // ─────────────────────────────────────────────────────────

  signUp: async (email, password, hunterName) => {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { hunter_name: hunterName } },
      });
      if (error) throw error;
      if (!data.session) {
        const { error: siErr } = await supabase.auth.signInWithPassword({
          email, password,
        });
        if (siErr) throw siErr;
      }
    } catch (e: any) {
      console.error('[signUp]', e.message);
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email, password,
      });
      if (error) throw error;
    } catch (e: any) {
      console.error('[signIn]', e.message);
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({
      player:             null,
      dailyState:         emptyDailyState(1),
      bossStates:         [],
      currentLevelDef:    getLevelDef(1) ?? null,
      isInitialized:      false,
      activePenaltyQuest: null,
    });
  },

  // ─────────────────────────────────────────────────────────
  //  INITIALIZE
  // ─────────────────────────────────────────────────────────

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { set({ isLoading: false }); return; }

      const { data: profileRow, error: profileError } = await supabase
        .from('player_profile')
        .select('*')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;

      const { data: nodeRows } = await supabase
        .from('skill_tree_nodes')
        .select('node_id')
        .eq('player_id', user.id);
      const skillNodes = (nodeRows ?? []).map((r: any) => r.node_id);

      const player   = rowToProfile(profileRow, skillNodes);
      const levelDef = getLevelDef(player.currentLevel);
      const bossIds  = levelDef?.bosses.map(b => b.id) ?? [];
      let bossStates: BossState[] = [];

      if (bossIds.length > 0) {
        const { data: bossRows } = await supabase
          .from('boss_progress')
          .select('*')
          .eq('player_id', user.id)
          .in('boss_id', bossIds);

        bossStates = (bossRows ?? []).map((r: any) => ({
          bossId:           r.boss_id,
          status:           r.status,
          completedTaskIds: r.completed_task_ids ?? [],
          startedAt:        r.started_at,
          defeatedAt:       r.defeated_at,
          lootClaimed:      r.loot_claimed,
        }));
      }

      for (const boss of levelDef?.bosses ?? []) {
        if (!bossStates.find(b => b.bossId === boss.id)) {
          await supabase.from('boss_progress').insert({
            player_id: user.id,
            boss_id:   boss.id,
            status:    'active',
          });
          bossStates.push({
            bossId:           boss.id,
            status:           'active',
            completedTaskIds: [],
            startedAt:        new Date().toISOString(),
            defeatedAt:       null,
            lootClaimed:      false,
          });
        }
      }

      let activePenaltyQuest: PenaltyQuest | null = null;
      if (player.isInPenaltyZone) {
        activePenaltyQuest =
          (player.activePenaltyQuestId
            ? levelDef?.penaltyQuests.find(
                p => p.id === player.activePenaltyQuestId
              )
            : undefined) ??
          getRandomPenaltyQuest(player.currentLevel) ??
          null;
      }

      set({
        player,
        bossStates,
        currentLevelDef:    levelDef ?? null,
        activePenaltyQuest,
        isInitialized:      true,
      });

      await get()._refreshDailyState();
      await get().runMidnightCheck();

    } catch (e: any) {
      console.error('[initialize]', e.message);
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  // ─────────────────────────────────────────────────────────
  //  REFRESH DAILY STATE
  // ─────────────────────────────────────────────────────────

  _refreshDailyState: async () => {
    const { player, currentLevelDef } = get();
    if (!player || !currentLevelDef) return;

    const { data: rows, error } = await supabase
      .from('today_task_summary')
      .select('task_id, task_type')
      .eq('player_id', player.id);

    if (error) {
      console.error('[_refreshDailyState]', error.message);
      return;
    }

    const newState = buildDailyState(
      (rows ?? []) as { task_id: string; task_type: string }[],
      player.currentLevel,
      currentLevelDef.dailyMinimumTasks
    );

    set({ dailyState: newState });
  },

  // ─────────────────────────────────────────────────────────
  //  COMPLETE TASK
  // ─────────────────────────────────────────────────────────

  completeTask: async (taskId, taskType) => {
    const { player, dailyState, currentLevelDef } = get();
    if (!player || !currentLevelDef) return;

    if (dailyState.completedTaskIdsSet.has(taskId)) return;
    if (taskType === 'side_quest' && !dailyState.sideQuestsUnlocked) return;
    if (taskType === 'guild_task' && !dailyState.guildBoardUnlocked) return;

    console.log('[completeTask] starting:', taskId, taskType);
    set({ isLoading: true, error: null });

    try {
      let statRewards:    { stat: StatKey; xp: number }[] = [];
      let baseCurrency    = 0;
      let guildMultiplier = 1.0;

      if (taskType === 'daily') {
        const task = currentLevelDef.dailyTasks.find(t => t.id === taskId);
        if (!task) throw new Error(`Task not found: ${taskId}`);
        statRewards  = task.statRewards;
        baseCurrency = task.currencyReward;
      } else if (taskType === 'side_quest') {
        const sq = dailyState.todaySideQuests.find(s => s.id === taskId);
        if (!sq) throw new Error(`Side quest not in rotation: ${taskId}`);
        statRewards  = sq.statRewards;
        baseCurrency = sq.currencyReward;
      } else if (taskType === 'guild_task') {
        const gt = dailyState.todayGuildTasks.find(g => g.id === taskId);
        if (!gt) throw new Error(`Guild task not in rotation: ${taskId}`);
        statRewards     = gt.statRewards;
        baseCurrency    = gt.currencyReward;
        guildMultiplier = gt.guildBonusMultiplier;
      }

      const currencyMult  = getCurrencyMultiplier(player.activeBoosts);
      const finalCurrency = Math.round(
        baseCurrency * guildMultiplier * currencyMult *
        SYSTEM_META.baseCurrencyMultiplier
      );

      const xpUpdates:  Partial<Record<StatKey, number>> = {};
      const xpSnapshot: { stat: StatKey; xp: number }[] = [];

      for (const reward of statRewards) {
        const boostMult = getXpMultiplier(player.activeBoosts, reward.stat);
        const nodeBonus = getSkillNodeBonus(
          player.unlockedSkillNodes, reward.stat, player.currentLevel
        );
        const finalXp = Math.round(
          reward.xp * guildMultiplier * boostMult * (1 + nodeBonus / 100)
        );
        xpUpdates[reward.stat] = finalXp;
        xpSnapshot.push({ stat: reward.stat, xp: finalXp });
      }

      const newCurrency = player.systemCurrency + finalCurrency;
      const newStatXp   = { ...player.statXp };
      const statCols:   Record<string, number> = {};

      for (const [stat, xp] of Object.entries(xpUpdates)) {
        const newVal = (player.statXp[stat as StatKey] ?? 0) + xp!;
        statCols[STAT_TO_COLUMN[stat as StatKey]] = newVal;
        newStatXp[stat as StatKey] = newVal;
      }

      // Optimistic update — UI responds instantly
      const newCompletedIds  = [...dailyState.completedTaskIds, taskId];
      const newCompletedSet  = new Set<string>(newCompletedIds);
      const newDailyCount    = taskType === 'daily'
        ? dailyState.completedDailyCount + 1
        : dailyState.completedDailyCount;
      const min              = currentLevelDef.dailyMinimumTasks;
      const newSQUnlocked    = newDailyCount >= min;
      const newSQComplete    = newSQUnlocked &&
        dailyState.todaySideQuests.every(sq => newCompletedSet.has(sq.id));

      set(s => ({
        player: s.player ? {
          ...s.player,
          statXp:         newStatXp,
          systemCurrency: newCurrency,
        } : null,
        dailyState: {
          ...s.dailyState,
          completedTaskIds:      newCompletedIds,
          completedTaskIdsSet:   newCompletedSet,
          completedDailyCount:   newDailyCount,
          sideQuestsUnlocked:    newSQUnlocked,
          shopUnlocked:          newSQUnlocked,
          allSideQuestsComplete: newSQComplete,
          guildBoardUnlocked:    newSQComplete,
        },
      }));

      // Write to Supabase
      const { error: profileError } = await supabase
        .from('player_profile')
        .update({ ...statCols, system_currency: newCurrency })
        .eq('id', player.id);
      if (profileError) throw profileError;

      const { error: logError } = await supabase
        .from('daily_task_log')
        .insert({
          player_id:       player.id,
          task_id:         taskId,
          task_type:       taskType,
          completed_date:  todayDateString(),
          currency_earned: finalCurrency,
          xp_snapshot:     xpSnapshot,
        });
      if (logError) throw logError;

      for (const { stat, xp } of xpSnapshot) {
        await supabase.from('stat_xp_log').insert({
          player_id:        player.id,
          stat_key:         stat,
          xp_gained:        xp,
          source_type:      taskType,
          source_id:        taskId,
          boost_applied:    getXpMultiplier(player.activeBoosts, stat) > 1.0,
          boost_multiplier: getXpMultiplier(player.activeBoosts, stat),
        });
      }

      await supabase.from('currency_log').insert({
        player_id:        player.id,
        amount:           finalCurrency,
        transaction_type: taskType === 'guild_task' ? 'guild_task_reward'
                        : taskType === 'side_quest'  ? 'side_quest_reward'
                        : 'task_reward',
        source_id:        taskId,
        balance_after:    newCurrency,
      });

      console.log('[completeTask] success:', taskId, '| currency:', finalCurrency);

      await get()._refreshDailyState();
      if (taskType === 'daily') await get()._checkBossProgress(taskId);
      await get()._checkLevelUp();

    } catch (e: any) {
      console.error('[completeTask] error:', e.message);
      set({ error: e.message });
      await get()._refreshDailyState();
    } finally {
      set({ isLoading: false });
    }
  },

  // ─────────────────────────────────────────────────────────
  //  COMPLETE PENALTY STEP
  // ─────────────────────────────────────────────────────────

  completePenaltyStep: async (taskId) => {
    const { player, currentLevelDef, activePenaltyQuest } = get();
    if (!player || !currentLevelDef || !player.isInPenaltyZone) return;
    if (!activePenaltyQuest) return;

    const currentProgress =
      player.penaltyQuestProgress.length > 0
        ? [...player.penaltyQuestProgress]
        : activePenaltyQuest.tasks.map(t => ({
            taskId:    t.taskId,
            completed: false,
          }));

    const existing = currentProgress.find(s => s.taskId === taskId);
    if (existing?.completed) return;

    const stepIndex = currentProgress.findIndex(s => s.taskId === taskId);
    if (stepIndex === -1) {
      currentProgress.push({ taskId, completed: true });
    } else {
      currentProgress[stepIndex] = { taskId, completed: true };
    }

    // Optimistic update
    set(s => ({
      player: s.player ? {
        ...s.player,
        penaltyQuestProgress: [...currentProgress],
      } : null,
    }));

    const allComplete = currentProgress.every(s => s.completed);

    if (allComplete) {
      const { currencyBonus, statBonuses } = activePenaltyQuest.escapeReward;
      const newCurrency = player.systemCurrency + currencyBonus;
      const newStatXp   = { ...player.statXp };
      const statCols:   Record<string, number> = {};

      for (const b of statBonuses) {
        const newVal = (player.statXp[b.stat] ?? 0) + b.xp;
        statCols[STAT_TO_COLUMN[b.stat]] = newVal;
        newStatXp[b.stat] = newVal;
      }

      await supabase.from('player_profile').update({
        ...statCols,
        system_currency:         newCurrency,
        is_in_penalty_zone:      false,
        penalty_activated_at:    null,
        penalty_quest_progress:  [],
        active_penalty_quest_id: null,
      }).eq('id', player.id);

      // Log penalty completion so midnight check knows it was cleared today
      await supabase.from('daily_task_log').insert({
        player_id:       player.id,
        task_id:         activePenaltyQuest.id,
        task_type:       'penalty',
        completed_date:  todayDateString(),
        currency_earned: currencyBonus,
        xp_snapshot:     statBonuses,
      });

      await supabase.from('currency_log').insert({
        player_id:        player.id,
        amount:           currencyBonus,
        transaction_type: 'penalty_escape_reward',
        source_id:        activePenaltyQuest.id,
        balance_after:    newCurrency,
      });

      set(s => ({
        player: s.player ? {
          ...s.player,
          isInPenaltyZone:      false,
          penaltyActivatedAt:   null,
          penaltyQuestProgress: [],
          activePenaltyQuestId: null,
          systemCurrency:       newCurrency,
          statXp:               newStatXp,
        } : null,
        activePenaltyQuest: null,
      }));

      await get()._refreshDailyState();

    } else {
      await supabase.from('player_profile').update({
        penalty_quest_progress: currentProgress,
      }).eq('id', player.id);
    }
  },

  // ─────────────────────────────────────────────────────────
  //  CHECK BOSS PROGRESS
  // ─────────────────────────────────────────────────────────

  _checkBossProgress: async (taskId) => {
    const { player, bossStates, currentLevelDef } = get();
    if (!player || !currentLevelDef) return;

    const updated = [...bossStates];

    for (const boss of currentLevelDef.bosses) {
      if (!boss.requiredTaskIds.includes(taskId)) continue;
      const idx = updated.findIndex(b => b.bossId === boss.id);
      if (idx === -1 || updated[idx].status !== 'active') continue;
      if (updated[idx].completedTaskIds.includes(taskId)) continue;

      const newCompleted = [...updated[idx].completedTaskIds, taskId];
      const isDefeated   = boss.requiredTaskIds.every(
        id => newCompleted.includes(id)
      );
      const payload: any = { completed_task_ids: newCompleted };
      if (isDefeated) {
        payload.status      = 'defeated';
        payload.defeated_at = new Date().toISOString();
      }

      await supabase.from('boss_progress').update(payload)
        .eq('player_id', player.id)
        .eq('boss_id', boss.id);

      updated[idx] = {
        ...updated[idx],
        completedTaskIds: newCompleted,
        status:           isDefeated ? 'defeated' : 'active',
        defeatedAt:       isDefeated ? new Date().toISOString() : null,
      };
    }

    set({ bossStates: updated });
  },

  // ─────────────────────────────────────────────────────────
  //  CLAIM BOSS LOOT
  // ─────────────────────────────────────────────────────────

  claimBossLoot: async (bossId) => {
    const { player, bossStates, currentLevelDef } = get();
    if (!player || !currentLevelDef) return;

    const bossConfig = currentLevelDef.bosses.find(b => b.id === bossId);
    const bossState  = bossStates.find(b => b.bossId === bossId);
    if (!bossConfig || !bossState) return;
    if (bossState.status !== 'defeated' || bossState.lootClaimed) return;

    set({ isLoading: true });
    try {
      const { rewards }  = bossConfig;
      const newCurrency  = player.systemCurrency + rewards.currencyBonus;
      const newStatXp    = { ...player.statXp };
      const statCols:    Record<string, number> = {};

      for (const b of rewards.statBonuses) {
        const newVal = (player.statXp[b.stat] ?? 0) + b.xp;
        statCols[STAT_TO_COLUMN[b.stat]] = newVal;
        newStatXp[b.stat] = newVal;
      }

      await supabase.from('player_profile').update({
        ...statCols,
        system_currency: newCurrency,
        current_title:   rewards.titleUnlock ?? player.currentTitle,
      }).eq('id', player.id);

      await supabase.from('skill_tree_nodes').insert({
        player_id: player.id,
        node_id:   rewards.lootNodeId,
      });

      await supabase.from('boss_progress')
        .update({ loot_claimed: true })
        .eq('player_id', player.id)
        .eq('boss_id', bossId);

      await supabase.from('currency_log').insert({
        player_id:        player.id,
        amount:           rewards.currencyBonus,
        transaction_type: 'boss_reward',
        source_id:        bossId,
        balance_after:    newCurrency,
      });

      set(s => ({
        player: s.player ? {
          ...s.player,
          statXp:             newStatXp,
          systemCurrency:     newCurrency,
          currentTitle:       rewards.titleUnlock ?? s.player!.currentTitle,
          unlockedSkillNodes: [
            ...s.player!.unlockedSkillNodes,
            rewards.lootNodeId,
          ],
        } : null,
        bossStates: s.bossStates.map(b =>
          b.bossId === bossId ? { ...b, lootClaimed: true } : b
        ),
      }));

      await get()._checkLevelUp();

    } catch (e: any) {
      console.error('[claimBossLoot]', e.message);
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  // ─────────────────────────────────────────────────────────
  //  CHECK LEVEL UP
  // ─────────────────────────────────────────────────────────

  _checkLevelUp: async () => {
    const { player, bossStates, currentLevelDef } = get();
    if (!player || !currentLevelDef) return;

    const allCleared = currentLevelDef.bosses.every(boss => {
      const s = bossStates.find(b => b.bossId === boss.id);
      return s?.status === 'defeated' && s?.lootClaimed;
    });
    if (!allCleared) return;

    const nextLevel = player.currentLevel + 1;
    const nextDef   = getLevelDef(nextLevel);
    if (!nextDef) return;

    set({ isLoading: true });
    try {
      const bonus      = 500;
      const newCurrency = player.systemCurrency + bonus;

      await supabase.from('player_profile').update({
        current_level:   nextLevel,
        system_currency: newCurrency,
      }).eq('id', player.id);

      await supabase.from('level_progression_log').insert({
        player_id:           player.id,
        from_level:          player.currentLevel,
        to_level:            nextLevel,
        total_xp_at_levelup: Object.values(player.statXp)
          .reduce((a, b) => a + b, 0),
      });

      await supabase.from('currency_log').insert({
        player_id:        player.id,
        amount:           bonus,
        transaction_type: 'level_up_bonus',
        source_id:        `level_${nextLevel}`,
        balance_after:    newCurrency,
      });

      set(s => ({
        player: s.player ? {
          ...s.player,
          currentLevel:   nextLevel,
          systemCurrency: newCurrency,
        } : null,
        currentLevelDef: nextDef,
        bossStates:      [],
      }));

      await get().initialize();

    } catch (e: any) {
      console.error('[_checkLevelUp]', e.message);
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  // ─────────────────────────────────────────────────────────
  //  PURCHASE SHOP ITEM
  // ─────────────────────────────────────────────────────────

  purchaseShopItem: async (item) => {
    const { player, dailyState } = get();
    if (!player || !dailyState.shopUnlocked || player.systemCurrency < item.cost)
      return;

    set({ isLoading: true, error: null });
    try {
      const newCurrency    = player.systemCurrency - item.cost;
      const profileUpdate: any = { system_currency: newCurrency };
      let expiresAt: string | null = null;

      if (item.effect.type === 'xpMultiplier') {
        expiresAt = new Date(
          Date.now() + item.effect.durationHours * 3600000
        ).toISOString();
        profileUpdate.active_boosts = {
          ...player.activeBoosts,
          [item.effect.stat]: { multiplier: item.effect.multiplier, expiresAt },
        };
      } else if (item.effect.type === 'currencyBoost') {
        expiresAt = new Date(
          Date.now() + item.effect.durationHours * 3600000
        ).toISOString();
        profileUpdate.active_boosts = {
          ...player.activeBoosts,
          currency: { multiplier: item.effect.multiplier, expiresAt },
        };
      } else if (item.effect.type === 'unlockCosmetic') {
        profileUpdate.unlocked_cosmetics = [
          ...player.unlockedCosmetics,
          item.effect.cosmeticId,
        ];
      } else if (item.effect.type === 'restorePenalty') {
        profileUpdate.is_in_penalty_zone      = false;
        profileUpdate.penalty_activated_at    = null;
        profileUpdate.penalty_quest_progress  = [];
        profileUpdate.active_penalty_quest_id = null;
      }

      await supabase.from('player_profile')
        .update(profileUpdate)
        .eq('id', player.id);

      await supabase.from('shop_purchase_log').insert({
        player_id:       player.id,
        item_id:         item.id,
        cost_paid:       item.cost,
        effect_snapshot: item.effect,
        expires_at:      expiresAt,
      });

      await supabase.from('currency_log').insert({
        player_id:        player.id,
        amount:           -item.cost,
        transaction_type: 'shop_purchase',
        source_id:        item.id,
        balance_after:    newCurrency,
      });

      set(s => {
        if (!s.player) return {};
        const p = { ...s.player, systemCurrency: newCurrency };
        if (item.effect.type === 'xpMultiplier') {
          p.activeBoosts = {
            ...s.player.activeBoosts,
            [item.effect.stat]: {
              multiplier: item.effect.multiplier,
              expiresAt:  expiresAt!,
            },
          };
        } else if (item.effect.type === 'currencyBoost') {
          p.activeBoosts = {
            ...s.player.activeBoosts,
            currency: { multiplier: item.effect.multiplier, expiresAt: expiresAt! },
          };
        } else if (item.effect.type === 'unlockCosmetic') {
          p.unlockedCosmetics = [
            ...s.player.unlockedCosmetics,
            item.effect.cosmeticId,
          ];
        } else if (item.effect.type === 'restorePenalty') {
          p.isInPenaltyZone      = false;
          p.penaltyActivatedAt   = null;
          p.penaltyQuestProgress = [];
          p.activePenaltyQuestId = null;
        }
        return {
          player:             p,
          activePenaltyQuest: item.effect.type === 'restorePenalty'
            ? null
            : s.activePenaltyQuest,
        };
      });

    } catch (e: any) {
      console.error('[purchaseShopItem]', e.message);
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  // ─────────────────────────────────────────────────────────
  //  MIDNIGHT CHECK
  //
  //  Guard order:
  //  1. Already in penalty zone → skip (already punished)
  //  2. Escaped penalty today → skip
  //     THE KEY FIX: if player completed a penalty quest
  //     today, don't re-trigger even if yesterday had 0 tasks.
  //     This stops the reload loop after escaping.
  //  3. No daily history before today → new player, skip
  //  4. Yesterday count < minimum → penalize
  // ─────────────────────────────────────────────────────────

  runMidnightCheck: async () => {
    const { player, currentLevelDef } = get();
    if (!player || !currentLevelDef) return;

    // Guard 1 — already in penalty zone
    if (player.isInPenaltyZone) return;

    const today = todayDateString();

    // Guard 2 — THE CRITICAL FIX
    // Check if penalty was escaped today (penalty task logged today)
    // If yes, skip — player already paid their debt today
    const { count: penaltyEscapedToday } = await supabase
      .from('daily_task_log')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', player.id)
      .eq('task_type', 'penalty')
      .eq('completed_date', today);

    if (penaltyEscapedToday && penaltyEscapedToday > 0) {
      console.log('[midnightCheck] penalty escaped today — skipping re-trigger');
      return;
    }

    // Guard 3 — new player with no prior daily history
    const { count: historyBeforeToday } = await supabase
      .from('daily_task_log')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', player.id)
      .eq('task_type', 'daily')
      .lt('completed_date', today);

    if (!historyBeforeToday || historyBeforeToday === 0) {
      console.log('[midnightCheck] new player — skipping penalty check');
      return;
    }

    // Guard 4 — check yesterday's daily count
    const { count: yesterdayCount } = await supabase
      .from('daily_task_log')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', player.id)
      .eq('completed_date', yesterdayDateString())
      .eq('task_type', 'daily');

    console.log(
      '[midnightCheck] yesterday:',
      yesterdayCount,
      '| min:',
      currentLevelDef.dailyMinimumTasks
    );

    if ((yesterdayCount ?? 0) < currentLevelDef.dailyMinimumTasks) {
      await get()._triggerPenaltyZone();
    }
  },

  // ─────────────────────────────────────────────────────────
  //  TRIGGER PENALTY ZONE
  // ─────────────────────────────────────────────────────────

  _triggerPenaltyZone: async () => {
    const { player, currentLevelDef } = get();
    if (!player || !currentLevelDef) return;

    const chosenQuest = getRandomPenaltyQuest(player.currentLevel);
    if (!chosenQuest) return;

    const progress = chosenQuest.tasks.map(t => ({
      taskId:    t.taskId,
      completed: false,
    }));

    const now = new Date().toISOString();

    await supabase.from('player_profile').update({
      is_in_penalty_zone:      true,
      penalty_activated_at:    now,
      penalty_quest_progress:  progress,
      active_penalty_quest_id: chosenQuest.id,
    }).eq('id', player.id);

    set(s => ({
      player: s.player ? {
        ...s.player,
        isInPenaltyZone:      true,
        penaltyActivatedAt:   now,
        penaltyQuestProgress: progress,
        activePenaltyQuestId: chosenQuest.id,
      } : null,
      activePenaltyQuest: chosenQuest,
    }));

    console.log('[penalty] triggered:', chosenQuest.id);
  },

}));

// ─────────────────────────────────────────────────────────────
//  SELECTOR HOOKS
// ─────────────────────────────────────────────────────────────

export const usePlayer           = () => useGameStore(s => s.player);
export const useDailyState       = () => useGameStore(s => s.dailyState);
export const useBossStates       = () => useGameStore(s => s.bossStates);
export const useLevelDef         = () => useGameStore(s => s.currentLevelDef);
export const useIsPenaltyZone    = () =>
  useGameStore(s => s.player?.isInPenaltyZone ?? false);
export const useShopUnlocked     = () =>
  useGameStore(s => s.dailyState.shopUnlocked);
export const useIsLoading        = () => useGameStore(s => s.isLoading);
export const useError            = () => useGameStore(s => s.error);
export const useActivePenalty    = () => useGameStore(s => s.activePenaltyQuest);
export const useCompletedTaskIds = () =>
  useGameStore(s => s.dailyState.completedTaskIdsSet);
export const usePenaltyProgress  = () =>
  useGameStore(s => s.player?.penaltyQuestProgress ?? []);