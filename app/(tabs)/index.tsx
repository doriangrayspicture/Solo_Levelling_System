// ============================================================
//  HUNTER PROTOCOL — DASHBOARD SCREEN
//  app/(tabs)/index.tsx
//
//  Fixes:
//  ✓ Logout works on web (uses window.confirm) and mobile (Alert)
//  ✓ Live countdown clock to midnight
//  ✓ Auto-reset at midnight
//  ✓ All reactive state fixes retained
// ============================================================

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, RefreshControl, StatusBar, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  useGameStore,
  usePlayer,
  useCompletedTaskIds,
  useBossStates,
  useLevelDef,
} from '../../store/useGameStore';
import {
  COLORS, FONTS, SPACING, RADIUS, RARITY_COLOR, STAT_COLOR,
} from '../../constants/theme';
import { STAT_DEFINITIONS } from '../../config/SystemConfig';
import { useAudio } from '../../hooks/useAudio';

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function secondsUntilMidnight(): number {
  const now      = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
//  COUNTDOWN CLOCK
// ─────────────────────────────────────────────────────────────

function MidnightClock({ onMidnight }: { onMidnight: () => void }) {
  const [seconds, setSeconds] = useState(secondsUntilMidnight());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isUrgent   = seconds < 3600;
  const isCritical = seconds < 600;

  useEffect(() => {
    if (isUrgent) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isUrgent]);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = secondsUntilMidnight();
      setSeconds(remaining);
      if (remaining <= 0) onMidnight();
    }, 1000);
    return () => clearInterval(interval);
  }, [onMidnight]);

  const clockColor = isCritical
    ? COLORS.neonRed
    : isUrgent
    ? COLORS.neonOrange
    : COLORS.neonBlue;

  return (
    <View style={clockStyles.container}>
      <Text style={clockStyles.label}>SYSTEM RESET IN</Text>
      <Animated.Text
        style={[
          clockStyles.time,
          { color: clockColor, opacity: isUrgent ? pulseAnim : 1 },
          isCritical && {
            textShadowColor:  COLORS.neonRed,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 12,
          },
        ]}
      >
        {formatCountdown(seconds)}
      </Animated.Text>
      {isCritical && (
        <Text style={clockStyles.warning}>⚠ RESET IMMINENT</Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  SCANLINE
// ─────────────────────────────────────────────────────────────

function ScanlineOverlay() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.scanline,
        {
          transform: [{
            translateY: anim.interpolate({
              inputRange: [0, 1], outputRange: [-800, 800],
            }),
          }],
        },
      ]}
    />
  );
}

// ─────────────────────────────────────────────────────────────
//  STAT BAR
// ─────────────────────────────────────────────────────────────

function StatBar({ statKey, xp }: { statKey: string; xp: number }) {
  const def      = STAT_DEFINITIONS.find(s => s.key === statKey);
  if (!def) return null;
  const color    = STAT_COLOR[statKey] ?? COLORS.neonBlue;
  const segments = 10;
  const filled   = Math.min(segments, Math.floor(xp / 100));
  return (
    <View style={styles.statRow}>
      <Text style={styles.statIcon}>{def.icon}</Text>
      <Text style={[styles.statLabel, { color }]}>{def.label}</Text>
      <View style={styles.statBarTrack}>
        {Array.from({ length: segments }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.statBarSegment,
              {
                backgroundColor: i < filled ? color : COLORS.bgBorder,
                shadowColor:     i < filled ? color : 'transparent',
                shadowOpacity:   i < filled ? 0.8 : 0,
                shadowRadius:    i < filled ? 4 : 0,
                shadowOffset:    { width: 0, height: 0 },
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.statXp}>{xp}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  TASK CARD
// ─────────────────────────────────────────────────────────────

function TaskCard({
  task,
  taskType,
  disabled,
  onComplete,
}: {
  task: any;
  taskType: 'daily' | 'side_quest' | 'guild_task';
  disabled?: boolean;
  onComplete: () => void;
}) {
  const completedSet = useCompletedTaskIds();
  const completed    = completedSet.has(task.id);
  const scaleAnim    = useRef(new Animated.Value(1)).current;
  const rarityColor  = RARITY_COLOR[task.rarity] ?? COLORS.neonBlue;

  const handlePress = () => {
    if (completed || disabled) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start(() => onComplete());
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        disabled={completed || disabled}
        style={[
          styles.taskCard,
          { borderColor: completed ? COLORS.neonGreen : rarityColor },
          completed && styles.taskCardCompleted,
          disabled  && styles.taskCardDisabled,
        ]}
      >
        <View style={[styles.rarityStripe, { backgroundColor: rarityColor }]} />
        <View style={styles.taskCardInner}>
          <View style={styles.taskCardHeader}>
            <Text style={styles.taskIcon}>{task.icon ?? '◆'}</Text>
            <View style={styles.taskCardTitles}>
              <Text style={[
                styles.taskName,
                completed && { color: COLORS.neonGreen },
                disabled  && { color: COLORS.textDim },
              ]}>
                {task.name}
              </Text>
              <View style={styles.taskMeta}>
                <Text style={[styles.rarityBadge, { color: rarityColor }]}>
                  [{task.rarity.toUpperCase()}]
                </Text>
                <Text style={styles.taskTime}>  ~{task.estimatedMinutes}min</Text>
              </View>
            </View>
            {completed && (
              <View style={styles.completedBadge}>
                <Text style={styles.completedCheck}>✓</Text>
              </View>
            )}
          </View>
          <Text style={[styles.taskDesc, disabled && { color: COLORS.textDim }]}>
            {task.description}
          </Text>
          <View style={styles.rewardRow}>
            <View style={styles.rewardPill}>
              <Text style={styles.rewardPillText}>
                +{task.guildBonusMultiplier
                  ? Math.round(task.currencyReward * task.guildBonusMultiplier)
                  : task.currencyReward} ◈
              </Text>
            </View>
            {task.statRewards?.map((r: any) => (
              <View
                key={r.stat}
                style={[styles.rewardPill, { borderColor: STAT_COLOR[r.stat] }]}
              >
                <Text style={[styles.rewardPillText, { color: STAT_COLOR[r.stat] }]}>
                  +{r.xp} {r.stat}
                </Text>
              </View>
            ))}
            {task.guildBonusMultiplier && (
              <View style={[styles.rewardPill, { borderColor: COLORS.neonGold }]}>
                <Text style={[styles.rewardPillText, { color: COLORS.neonGold }]}>
                  {task.guildBonusMultiplier}× BONUS
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
//  SECTION HEADER
// ─────────────────────────────────────────────────────────────

function SectionHeader({
  title, subtitle, locked, color,
}: {
  title: string; subtitle?: string; locked?: boolean; color?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={[styles.sectionLine, { backgroundColor: color ?? COLORS.neonBlue }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: color ?? COLORS.neonBlue }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {locked && (
        <View style={styles.lockedBadge}>
          <Text style={styles.lockedBadgeText}>🔒 LOCKED</Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  BOSS MINI CARD
// ─────────────────────────────────────────────────────────────

function BossMiniCard({
  boss, bossState, onPress,
}: {
  boss: any; bossState: any; onPress: () => void;
}) {
  const completedCount = bossState?.completedTaskIds.length ?? 0;
  const totalRequired  = boss.requiredTaskIds.length;
  const progress       = totalRequired > 0 ? completedCount / totalRequired : 0;
  const defeated       = bossState?.status === 'defeated';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.bossCard,
        { borderColor: defeated ? COLORS.neonGreen : COLORS.neonRed },
      ]}
    >
      <Text style={styles.bossCardIcon}>{boss.icon}</Text>
      <View style={styles.bossCardInfo}>
        <Text style={[
          styles.bossCardName,
          { color: defeated ? COLORS.neonGreen : COLORS.neonRed },
        ]}>
          {boss.name}
        </Text>
        <Text style={styles.bossCardTitle}>{boss.title}</Text>
        <View style={styles.bossHpTrack}>
          <View style={[
            styles.bossHpFill,
            {
              width:           `${(1 - progress) * 100}%` as any,
              backgroundColor: defeated ? COLORS.neonGreen : COLORS.bossHpFull,
            },
          ]} />
        </View>
        <Text style={styles.bossProgressText}>
          {defeated
            ? 'DEFEATED — CLAIM LOOT'
            : `${completedCount}/${totalRequired} tasks complete`}
        </Text>
      </View>
      <Text style={[
        styles.bossArrow,
        { color: defeated ? COLORS.neonGreen : COLORS.neonRed },
      ]}>
        ›
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
//  LOGOUT — works on both web and mobile
// ─────────────────────────────────────────────────────────────

function useLogout() {
  const signOut = useGameStore(s => s.signOut);

  return useCallback(() => {
    if (Platform.OS === 'web') {
      // window.confirm works on all browsers
      const confirmed = window.confirm(
        'GO OFFLINE\n\nThe System will remember your progress.\nDisconnect from Hunter Protocol?'
      );
      if (confirmed) signOut();
    } else {
      // React Native Alert works on iOS and Android
      Alert.alert(
        'GO OFFLINE',
        'The System will remember your progress.\nDisconnect from Hunter Protocol?',
        [
          { text: 'STAY ONLINE', style: 'cancel' },
          { text: 'GO OFFLINE', style: 'destructive', onPress: signOut },
        ],
        { userInterfaceStyle: 'dark' }
      );
    }
  }, [signOut]);
}

// ─────────────────────────────────────────────────────────────
//  MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const insets   = useSafeAreaInsets();
  const router   = useRouter();
  const audio    = useAudio();
  const logout   = useLogout();

  const player               = usePlayer();
  const levelDef             = useLevelDef();
  const bossStates           = useBossStates();
  const completedDailyCount  = useGameStore(s => s.dailyState.completedDailyCount);
  const sideQuestsUnlocked   = useGameStore(s => s.dailyState.sideQuestsUnlocked);
  const guildBoardUnlocked   = useGameStore(s => s.dailyState.guildBoardUnlocked);
  const shopUnlocked         = useGameStore(s => s.dailyState.shopUnlocked);
  const todaySideQuests      = useGameStore(s => s.dailyState.todaySideQuests);
  const todayGuildTasks      = useGameStore(s => s.dailyState.todayGuildTasks);
  const completeTask         = useGameStore(s => s.completeTask);
  const initialize           = useGameStore(s => s.initialize);

  const [refreshing, setRefreshing] = useState(false);
  const lastDateRef = useRef(todayDateString());

  // Midnight auto-reset
  const handleMidnight = useCallback(async () => {
    lastDateRef.current = todayDateString();
    await initialize();
  }, [initialize]);

  // Backup 60s interval to catch clock drift
  useEffect(() => {
    const interval = setInterval(async () => {
      const current = todayDateString();
      if (current !== lastDateRef.current) {
        lastDateRef.current = current;
        await initialize();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [initialize]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await initialize();
    setRefreshing(false);
  }, [initialize]);

  const handleComplete = useCallback(async (
    taskId: string,
    taskType: 'daily' | 'side_quest' | 'guild_task'
  ) => {
    await completeTask(taskId, taskType);
    if (taskType === 'daily')       audio.onTaskComplete();
    if (taskType === 'side_quest')  audio.onSideQuestComplete();
    if (taskType === 'guild_task')  audio.onGuildTaskComplete();
  }, [completeTask, audio]);

  if (!player || !levelDef) {
    return (
      <View style={styles.centerEmpty}>
        <Text style={styles.emptyText}>LOADING SYSTEM...</Text>
      </View>
    );
  }

  const minRequired   = levelDef.dailyMinimumTasks;
  const progressRatio = Math.min(1, completedDailyCount / minRequired);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScanlineOverlay />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.neonBlue}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.systemLabel}>// SYSTEM ONLINE</Text>
            <Text style={styles.hunterName}>{player.hunterName}</Text>
            <Text style={styles.hunterTitle}>{player.currentTitle}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.levelBadge}>LV.{player.currentLevel}</Text>
            <View style={styles.currencyRow}>
              <Text style={styles.currencyIcon}>◈</Text>
              <Text style={styles.currencyValue}>{player.systemCurrency}</Text>
            </View>
            <TouchableOpacity
              onPress={logout}
              style={styles.offlineBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.offlineBtnText}>⏻ OFFLINE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* COUNTDOWN CLOCK */}
        <MidnightClock onMidnight={handleMidnight} />

        {/* DAILY MINIMUM PROGRESS */}
        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>DAILY MINIMUM</Text>
            <Text style={[
              styles.progressCount,
              progressRatio >= 1 && { color: COLORS.neonGreen },
            ]}>
              {completedDailyCount} / {minRequired}
              {progressRatio >= 1 ? '  ✓ UNLOCKED' : ''}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[
              styles.progressFill,
              { width: `${progressRatio * 100}%` as any },
              progressRatio >= 1 && styles.progressFillComplete,
            ]} />
          </View>
          {shopUnlocked && (
            <Text style={styles.shopUnlockedHint}>
              ◈ Shop unlocked · Side quests unlocked
            </Text>
          )}
        </View>

        {/* STAT BARS */}
        <View style={styles.statsBlock}>
          <SectionHeader title="HUNTER STATS" color={COLORS.neonPurple} />
          {STAT_DEFINITIONS.map(def => (
            <StatBar
              key={def.key}
              statKey={def.key}
              xp={player.statXp[def.key] ?? 0}
            />
          ))}
        </View>

        {/* BOSS ENCOUNTERS */}
        {levelDef.bosses.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title="BOSS ENCOUNTERS"
              subtitle="Defeat all bosses to advance to next level"
              color={COLORS.neonRed}
            />
            {levelDef.bosses.map(boss => {
              const bossState = bossStates.find(b => b.bossId === boss.id);
              return (
                <BossMiniCard
                  key={boss.id}
                  boss={boss}
                  bossState={bossState}
                  onPress={() => router.push({
                    pathname: '/boss',
                    params:   { bossId: boss.id },
                  })}
                />
              );
            })}
          </View>
        )}

        {/* TIER 1: DAILY TASKS */}
        <View style={styles.section}>
          <SectionHeader
            title="DAILY TASKS"
            subtitle={`Complete ${minRequired} minimum to unlock shop + side quests`}
            color={COLORS.neonBlue}
          />
          {levelDef.dailyTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              taskType="daily"
              onComplete={() => handleComplete(task.id, 'daily')}
            />
          ))}
        </View>

        {/* TIER 2: SIDE QUESTS */}
        <View style={styles.section}>
          <SectionHeader
            title="SIDE QUESTS"
            subtitle={
              sideQuestsUnlocked
                ? `${todaySideQuests.length} quests today — complete all to unlock Guild Board`
                : `Locked — complete ${minRequired} daily tasks first`
            }
            locked={!sideQuestsUnlocked}
            color={COLORS.neonOrange}
          />
          {todaySideQuests.map(sq => (
            <TaskCard
              key={sq.id}
              task={sq}
              taskType="side_quest"
              disabled={!sideQuestsUnlocked}
              onComplete={() => handleComplete(sq.id, 'side_quest')}
            />
          ))}
        </View>

        {/* TIER 3: GUILD BOARD */}
        <View style={styles.section}>
          <SectionHeader
            title="GUILD BOARD"
            subtitle={
              guildBoardUnlocked
                ? 'Bonus tasks — highest rewards — pure grind'
                : 'Locked — complete all side quests first'
            }
            locked={!guildBoardUnlocked}
            color={COLORS.neonGold}
          />
          {guildBoardUnlocked && todayGuildTasks.length > 0 && (
            <View style={styles.guildBonusBanner}>
              <Text style={styles.guildBonusText}>
                ◈ GUILD BONUS ACTIVE — UP TO{' '}
                {Math.max(...todayGuildTasks.map(g => g.guildBonusMultiplier))}×
                MULTIPLIER
              </Text>
            </View>
          )}
          {todayGuildTasks.map(gt => (
            <TaskCard
              key={gt.id}
              task={gt}
              taskType="guild_task"
              disabled={!guildBoardUnlocked}
              onComplete={() => handleComplete(gt.id, 'guild_task')}
            />
          ))}
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────

const clockStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius:    RADIUS.md,
    borderWidth:     1,
    borderColor:     COLORS.bgBorder,
    padding:         SPACING.md,
    alignItems:      'center',
    marginBottom:    SPACING.md,
  },
  label: {
    fontFamily:    FONTS.display,
    color:         COLORS.textSecondary,
    fontSize:      9,
    letterSpacing: 3,
    marginBottom:  4,
  },
  time: {
    fontFamily:    FONTS.display,
    fontSize:      28,
    letterSpacing: 4,
  },
  warning: {
    fontFamily:    FONTS.display,
    color:         COLORS.neonRed,
    fontSize:      9,
    letterSpacing: 2,
    marginTop:     4,
  },
});

const styles = StyleSheet.create({
  root:                 { flex: 1, backgroundColor: COLORS.bg },
  scrollContent:        { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxl },
  centerEmpty:          { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  emptyText:            { fontFamily: FONTS.display, color: COLORS.neonBlue, fontSize: 14, letterSpacing: 3 },
  scanline:             { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: COLORS.neonBlue, opacity: 0.04, zIndex: 999, pointerEvents: 'none' },
  header:               { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.bgBorder, marginBottom: SPACING.md },
  systemLabel:          { fontFamily: FONTS.body, color: COLORS.neonBlue, fontSize: 10, letterSpacing: 2, marginBottom: 4 },
  hunterName:           { fontFamily: FONTS.display, color: COLORS.textPrimary, fontSize: 22, letterSpacing: 2 },
  hunterTitle:          { fontFamily: FONTS.body, color: COLORS.neonPurple, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  headerRight:          { alignItems: 'flex-end' },
  levelBadge:           { fontFamily: FONTS.display, color: COLORS.neonBlue, fontSize: 20, letterSpacing: 2 },
  currencyRow:          { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  currencyIcon:         { color: COLORS.neonGold, fontSize: 14, marginRight: 4 },
  currencyValue:        { fontFamily: FONTS.bodyBold, color: COLORS.neonGold, fontSize: 16 },
  offlineBtn:           { marginTop: SPACING.sm, borderWidth: 1, borderColor: COLORS.textDim, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  offlineBtnText:       { fontFamily: FONTS.display, color: COLORS.textDim, fontSize: 8, letterSpacing: 1 },
  progressBlock:        { marginBottom: SPACING.md },
  progressHeader:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  progressLabel:        { fontFamily: FONTS.display, color: COLORS.textSecondary, fontSize: 10, letterSpacing: 3 },
  progressCount:        { fontFamily: FONTS.bodyBold, color: COLORS.neonBlue, fontSize: 11, letterSpacing: 1 },
  progressTrack:        { height: 4, backgroundColor: COLORS.bgBorder, borderRadius: RADIUS.full, overflow: 'hidden' },
  progressFill:         { height: 4, backgroundColor: COLORS.neonBlue, borderRadius: RADIUS.full, shadowColor: COLORS.neonBlue, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  progressFillComplete: { backgroundColor: COLORS.neonGreen, shadowColor: COLORS.neonGreen },
  shopUnlockedHint:     { fontFamily: FONTS.body, color: COLORS.neonGreen, fontSize: 9, letterSpacing: 1, marginTop: SPACING.sm, textAlign: 'center' },
  statsBlock:           { marginBottom: SPACING.lg, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.bgBorder },
  statRow:              { flexDirection: 'row', alignItems: 'center', marginVertical: 5 },
  statIcon:             { fontSize: 14, width: 24 },
  statLabel:            { fontFamily: FONTS.display, fontSize: 8, letterSpacing: 1, width: 80 },
  statBarTrack:         { flex: 1, flexDirection: 'row', gap: 2, marginHorizontal: SPACING.sm },
  statBarSegment:       { flex: 1, height: 6, borderRadius: 2 },
  statXp:               { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 10, width: 36, textAlign: 'right' },
  section:              { marginBottom: SPACING.lg },
  sectionHeader:        { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: SPACING.sm },
  sectionLine:          { width: 3, height: 24, borderRadius: 2 },
  sectionTitle:         { fontFamily: FONTS.display, fontSize: 12, letterSpacing: 3 },
  sectionSubtitle:      { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 10, marginTop: 2 },
  lockedBadge:          { marginLeft: 'auto' as any, backgroundColor: COLORS.bgBorder, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.sm },
  lockedBadgeText:      { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 9, letterSpacing: 1 },
  taskCard:             { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, marginBottom: SPACING.sm, overflow: 'hidden', flexDirection: 'row' },
  taskCardCompleted:    { backgroundColor: '#040D0A' },
  taskCardDisabled:     { opacity: 0.35 },
  rarityStripe:         { width: 3, alignSelf: 'stretch' },
  taskCardInner:        { flex: 1, padding: SPACING.md },
  taskCardHeader:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm },
  taskIcon:             { fontSize: 18, marginRight: SPACING.sm, marginTop: 2 },
  taskCardTitles:       { flex: 1 },
  taskName:             { fontFamily: FONTS.display, color: COLORS.textPrimary, fontSize: 11, letterSpacing: 1, lineHeight: 16 },
  taskMeta:             { flexDirection: 'row', marginTop: 4 },
  rarityBadge:          { fontFamily: FONTS.body, fontSize: 9, letterSpacing: 1 },
  taskTime:             { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 9 },
  completedBadge:       { width: 28, height: 28, borderRadius: RADIUS.full, backgroundColor: COLORS.neonGreen, justifyContent: 'center', alignItems: 'center', marginLeft: SPACING.sm, shadowColor: COLORS.neonGreen, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  completedCheck:       { color: COLORS.bg, fontSize: 14, fontWeight: 'bold' },
  taskDesc:             { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 10, lineHeight: 16, marginBottom: SPACING.sm },
  rewardRow:            { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rewardPill:           { borderWidth: 1, borderColor: COLORS.neonGold, borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 2 },
  rewardPillText:       { fontFamily: FONTS.body, color: COLORS.neonGold, fontSize: 9, letterSpacing: 0.5 },
  bossCard:             { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.md, marginBottom: SPACING.sm },
  bossCardIcon:         { fontSize: 32, marginRight: SPACING.md },
  bossCardInfo:         { flex: 1 },
  bossCardName:         { fontFamily: FONTS.display, fontSize: 13, letterSpacing: 2 },
  bossCardTitle:        { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 9, marginBottom: SPACING.sm },
  bossHpTrack:          { height: 6, backgroundColor: COLORS.bgBorder, borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 4 },
  bossHpFill:           { height: 6, borderRadius: RADIUS.full },
  bossProgressText:     { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 9, letterSpacing: 0.5 },
  bossArrow:            { fontSize: 24, marginLeft: SPACING.sm },
  guildBonusBanner:     { backgroundColor: '#1A1200', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.neonGold, padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.sm },
  guildBonusText:       { fontFamily: FONTS.display, color: COLORS.neonGold, fontSize: 10, letterSpacing: 2 },
});