// ============================================================
//  HUNTER PROTOCOL — BOSS FIGHT SCREEN
//  app/boss.tsx
//
//  Fixes:
//  ✓ Uses useCompletedTaskIds() selector — task rows update
//    reactively when player completes them on dashboard
//  ✓ Boss HP bar animates correctly from store bossStates
//  ✓ Loot claim writes to store and updates locally
//  ✓ All imports use ../ (one level up from app/)
// ============================================================

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useGameStore,
  useBossStates,
  useLevelDef,
  usePlayer,
  useCompletedTaskIds,
} from '../store/useGameStore';
import { COLORS, FONTS, SPACING, RADIUS, STAT_COLOR } from '../constants/theme';
import { useAudio } from '../hooks/useAudio';

const { width: SCREEN_W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────
//  ANIMATED HP BAR
// ─────────────────────────────────────────────────────────────

function BossHpBar({
  progress,
  defeated,
}: {
  progress: number;
  defeated: boolean;
}) {
  const animWidth  = useRef(new Animated.Value(1 - progress)).current;
  const glowPulse  = useRef(new Animated.Value(1)).current;

  // Animate HP bar whenever progress changes
  useEffect(() => {
    Animated.timing(animWidth, {
      toValue:  1 - progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Glow pulse loop
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(glowPulse, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const hpColor = defeated
    ? COLORS.neonGreen
    : progress > 0.6
    ? COLORS.bossHpLow
    : COLORS.bossHpFull;

  const hpPercent = Math.max(0, Math.round((1 - progress) * 100));

  return (
    <View style={bossStyles.hpContainer}>
      <View style={bossStyles.hpLabelRow}>
        <Text style={bossStyles.hpLabel}>BOSS HP</Text>
        <Text style={[bossStyles.hpPercent, { color: hpColor }]}>
          {defeated ? '— DEFEATED —' : `${hpPercent}%`}
        </Text>
      </View>

      {/* Track */}
      <View style={bossStyles.hpTrack}>
        {/* Animated fill */}
        <Animated.View
          style={[
            bossStyles.hpFill,
            {
              backgroundColor: hpColor,
              width: animWidth.interpolate({
                inputRange:  [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
        {/* Glow overlay */}
        <Animated.View
          style={[
            bossStyles.hpGlow,
            {
              backgroundColor: hpColor,
              opacity: glowPulse.interpolate({
                inputRange:  [1, 1.4],
                outputRange: [0.15, 0.35],
              }),
              width: animWidth.interpolate({
                inputRange:  [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  REQUIRED TASK ROW
//  Reads completed state from useCompletedTaskIds() so it
//  updates immediately when the player finishes a task on
//  the dashboard — no manual refresh needed.
// ─────────────────────────────────────────────────────────────

function RequiredTaskRow({
  taskId,
  label,
  bossCompleted,
}: {
  taskId: string;
  label: string;
  bossCompleted: boolean;
}) {
  // Check both the boss's stored completion AND today's live completions
  const completedTodaySet = useCompletedTaskIds();
  const completedToday    = completedTodaySet.has(taskId);
  const completed         = bossCompleted || completedToday;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!completed) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 1200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [completed]);

  return (
    <View style={bossStyles.reqRow}>
      <Animated.View
        style={[
          bossStyles.reqIndicator,
          {
            backgroundColor: completed ? COLORS.neonGreen : COLORS.neonRed,
            shadowColor:     completed ? COLORS.neonGreen : COLORS.neonRed,
            opacity:         completed ? 1 : pulseAnim,
          },
        ]}
      />
      <Text style={[
        bossStyles.reqLabel,
        completed && bossStyles.reqLabelDone,
      ]}>
        {completed ? '✓ ' : '◆ '}{label}
      </Text>
      {completed && (
        <Text style={bossStyles.reqDoneTag}>DONE</Text>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  WARNING BORDER
// ─────────────────────────────────────────────────────────────

function SystemWarningBorder() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[bossStyles.warningBorder, { opacity: anim }]}
    />
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN BOSS SCREEN
// ─────────────────────────────────────────────────────────────

export default function BossScreen() {
  const safeInsets = useSafeAreaInsets();
  const router     = useRouter();
  const { bossId } = useLocalSearchParams<{ bossId: string }>();

  // ── Store slices ──────────────────────────────────────────
  const player     = usePlayer();
  const levelDef   = useLevelDef();
  const bossStates = useBossStates();
  const claimLoot  = useGameStore(s => s.claimBossLoot);
  const isLoading  = useGameStore(s => s.isLoading);
  const audio      = useAudio();

  // ── Entrance animations ───────────────────────────────────
  const titleSlam   = useRef(new Animated.Value(0)).current;
  const bossEnter   = useRef(new Animated.Value(0)).current;
  const warningAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.spring(bossEnter, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
      Animated.spring(titleSlam, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(warningAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(warningAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── Resolve boss data ─────────────────────────────────────
  const bossConfig = levelDef?.bosses.find(b => b.id === bossId);
  const bossState  = bossStates.find(b => b.bossId === bossId);

  if (!bossConfig || !levelDef) {
    return (
      <View style={[bossStyles.root, { paddingTop: safeInsets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={bossStyles.backBtn}>
          <Text style={bossStyles.backBtnText}>← RETREAT</Text>
        </TouchableOpacity>
        <View style={bossStyles.errorContainer}>
          <Text style={bossStyles.errorText}>BOSS DATA NOT FOUND</Text>
        </View>
      </View>
    );
  }

  // ── Compute HP progress ───────────────────────────────────
  // progress = fraction of required tasks completed
  // 0 = full HP, 1 = dead
  const bossCompletedIds = bossState?.completedTaskIds ?? [];
  const totalRequired    = bossConfig.requiredTaskIds.length;
  const completedCount   = bossConfig.requiredTaskIds.filter(
    id => bossCompletedIds.includes(id)
  ).length;
  const progress   = totalRequired > 0 ? completedCount / totalRequired : 0;
  const defeated   = bossState?.status === 'defeated';
  const lootClaimed = bossState?.lootClaimed ?? false;

  const handleClaimLoot = useCallback(async () => {
    if (!bossId || lootClaimed || isLoading) return;
    await claimLoot(bossId);
    audio.onBossDefeated();
  }, [bossId, lootClaimed, isLoading, claimLoot, audio]);

  return (
    <View style={[bossStyles.root, { paddingTop: safeInsets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bossBg} />

      {!defeated && <SystemWarningBorder />}
      <View style={bossStyles.bgGlow} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={bossStyles.scrollContent}
      >
        {/* SYSTEM WARNING HEADER */}
        <Animated.View style={[bossStyles.warningHeader, { opacity: warningAnim }]}>
          <Text style={bossStyles.warningText}>
            ⚠ SYSTEM WARNING — BOSS ENCOUNTER DETECTED ⚠
          </Text>
        </Animated.View>

        {/* BACK */}
        <TouchableOpacity onPress={() => router.back()} style={bossStyles.backBtn}>
          <Text style={bossStyles.backBtnText}>← RETREAT</Text>
        </TouchableOpacity>

        {/* MONSTER IMAGE SLOT ─────────────────────────────────
          Replace the View below with your Image:

          <Image
            source={require('../assets/monsters/lv1_boss_the_slug.png')}
            style={bossStyles.monsterImage}
            resizeMode="contain"
          />

          File name = bossId + .png
          Must have transparent background.
          Recommended: 600×600px minimum.
        ────────────────────────────────────────────────────── */}
        <Animated.View
          style={[
            bossStyles.monsterContainer,
            {
              opacity: bossEnter,
              transform: [{
                translateY: bossEnter.interpolate({
                  inputRange: [0, 1], outputRange: [40, 0],
                }),
              }],
            },
          ]}
        >
          <View style={bossStyles.monsterImagePlaceholder}>
            <Text style={bossStyles.monsterPlaceholderIcon}>{bossConfig.icon}</Text>
            <Text style={bossStyles.monsterPlaceholderText}>
              [ INSERT MONSTER PNG ]
            </Text>
            <Text style={bossStyles.monsterPlaceholderSub}>
              assets/monsters/{bossId}.png
            </Text>
          </View>

          {/* Boss name */}
          <Animated.Text
            style={[
              bossStyles.bossName,
              {
                color:   defeated ? COLORS.neonGreen : COLORS.neonRed,
                opacity: titleSlam,
                transform: [{
                  scale: titleSlam.interpolate({
                    inputRange: [0, 1], outputRange: [1.3, 1],
                  }),
                }],
              },
            ]}
          >
            {bossConfig.name}
          </Animated.Text>

          <Text style={bossStyles.bossTitle}>{bossConfig.title}</Text>
          <Text style={bossStyles.bossRarity}>[{bossConfig.rarity.toUpperCase()}]</Text>
        </Animated.View>

        {/* HP BAR */}
        <View style={bossStyles.hpSection}>
          <BossHpBar progress={progress} defeated={defeated} />
        </View>

        {/* LORE */}
        <View style={bossStyles.loreBlock}>
          <View style={bossStyles.loreBorder} />
          <Text style={bossStyles.loreText}>{bossConfig.lore}</Text>
          <View style={bossStyles.loreBorder} />
        </View>

        {/* REQUIRED TASKS */}
        <View style={bossStyles.reqSection}>
          <Text style={bossStyles.reqSectionTitle}>◈ DEFEAT CONDITIONS</Text>
          <Text style={bossStyles.reqSectionSub}>
            {bossConfig.daysToComplete
              ? `Complete across ${bossConfig.daysToComplete} days`
              : 'Complete in a single session'}
          </Text>
          <Text style={bossStyles.reqSectionSub}>
            {completedCount}/{totalRequired} tasks done
          </Text>

          {bossConfig.requiredTaskIds.map(taskId => {
            const taskDef    = levelDef.dailyTasks.find(t => t.id === taskId);
            const bossHasIt  = bossCompletedIds.includes(taskId);
            return (
              <RequiredTaskRow
                key={taskId}
                taskId={taskId}
                label={taskDef?.name ?? taskId}
                bossCompleted={bossHasIt}
              />
            );
          })}
        </View>

        {/* REWARDS */}
        <View style={bossStyles.rewardsBlock}>
          <Text style={bossStyles.rewardsSectionTitle}>◈ DEFEAT REWARDS</Text>
          <View style={bossStyles.rewardsGrid}>
            <View style={bossStyles.rewardItem}>
              <Text style={bossStyles.rewardItemIcon}>◈</Text>
              <Text style={bossStyles.rewardItemValue}>+{bossConfig.rewards.currencyBonus}</Text>
              <Text style={bossStyles.rewardItemLabel}>CREDITS</Text>
            </View>
            {bossConfig.rewards.titleUnlock && (
              <View style={bossStyles.rewardItem}>
                <Text style={bossStyles.rewardItemIcon}>👑</Text>
                <Text style={bossStyles.rewardItemValue}>{bossConfig.rewards.titleUnlock}</Text>
                <Text style={bossStyles.rewardItemLabel}>TITLE</Text>
              </View>
            )}
            <View style={bossStyles.rewardItem}>
              <Text style={bossStyles.rewardItemIcon}>🌟</Text>
              <Text style={bossStyles.rewardItemValue}>SKILL NODE</Text>
              <Text style={bossStyles.rewardItemLabel}>UNLOCKED</Text>
            </View>
          </View>
          {bossConfig.rewards.statBonuses.map(b => (
            <View key={b.stat} style={bossStyles.statBonusRow}>
              <Text style={[bossStyles.statBonusLabel, { color: STAT_COLOR[b.stat] }]}>
                {b.stat}
              </Text>
              <Text style={[bossStyles.statBonusXp, { color: STAT_COLOR[b.stat] }]}>
                +{b.xp} XP
              </Text>
            </View>
          ))}
        </View>

        {/* CLAIM LOOT BUTTON */}
        {defeated && !lootClaimed && (
          <TouchableOpacity
            onPress={handleClaimLoot}
            disabled={isLoading}
            activeOpacity={0.8}
            style={[
              bossStyles.claimBtn,
              isLoading && { opacity: 0.6 },
            ]}
          >
            <View style={bossStyles.claimBtnInner}>
              <Text style={bossStyles.claimBtnText}>
                {isLoading ? 'CLAIMING...' : '⬡ CLAIM LOOT ⬡'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {lootClaimed && (
          <View style={bossStyles.lootClaimedBanner}>
            <Text style={bossStyles.lootClaimedText}>
              ✓ LOOT CLAIMED — BOSS ARCHIVED
            </Text>
          </View>
        )}

        {/* Days info */}
        {!defeated && bossConfig.daysToComplete && (
          <View style={bossStyles.daysInfoBlock}>
            <Text style={bossStyles.daysInfoText}>
              ◈ This is a {bossConfig.daysToComplete}-day raid boss.{'\n'}
              Complete the required tasks across {bossConfig.daysToComplete} days.{'\n'}
              Progress is saved after each daily completion.
            </Text>
          </View>
        )}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────

const bossStyles = StyleSheet.create({
  root:                    { flex: 1, backgroundColor: COLORS.bossBg },
  scrollContent:           { paddingHorizontal: SPACING.md },
  errorContainer:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText:               { color: COLORS.neonRed, fontFamily: FONTS.display, fontSize: 16, textAlign: 'center' },
  bgGlow:                  { position: 'absolute', top: 0, left: 0, right: 0, height: 400, backgroundColor: COLORS.bossAccentRed, opacity: 0.03 },
  warningBorder:           { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2, borderColor: COLORS.neonRed, zIndex: 999, pointerEvents: 'none', shadowColor: COLORS.neonRed, shadowOpacity: 1, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  warningHeader:           { backgroundColor: COLORS.neonRed, paddingVertical: SPACING.sm, alignItems: 'center', marginBottom: SPACING.sm },
  warningText:             { fontFamily: FONTS.display, color: COLORS.bg, fontSize: 9, letterSpacing: 2 },
  backBtn:                 { paddingVertical: SPACING.sm, marginBottom: SPACING.md },
  backBtnText:             { fontFamily: FONTS.display, color: COLORS.textSecondary, fontSize: 10, letterSpacing: 2 },

  // Monster
  monsterContainer:        { alignItems: 'center', marginBottom: SPACING.lg },
  monsterImage:            { width: SCREEN_W * 0.7, height: SCREEN_W * 0.7, shadowColor: COLORS.neonRed, shadowOpacity: 0.9, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
  monsterImagePlaceholder: { width: SCREEN_W * 0.7, height: SCREEN_W * 0.55, borderWidth: 2, borderColor: COLORS.neonRed, borderStyle: 'dashed', borderRadius: RADIUS.lg, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0005', marginBottom: SPACING.lg, shadowColor: COLORS.neonRed, shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  monsterPlaceholderIcon:  { fontSize: 64, marginBottom: SPACING.sm },
  monsterPlaceholderText:  { fontFamily: FONTS.display, color: COLORS.neonRed, fontSize: 10, letterSpacing: 2, opacity: 0.7 },
  monsterPlaceholderSub:   { fontFamily: FONTS.body, color: COLORS.textDim, fontSize: 9, marginTop: 4 },
  bossName:                { fontFamily: FONTS.display, fontSize: 32, letterSpacing: 4, textAlign: 'center', textShadowColor: COLORS.neonRed, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 },
  bossTitle:               { fontFamily: FONTS.body, color: COLORS.bossAccentPurple, fontSize: 12, letterSpacing: 2, textAlign: 'center', marginTop: 4, textShadowColor: COLORS.bossAccentPurple, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  bossRarity:              { fontFamily: FONTS.display, color: COLORS.neonGold, fontSize: 9, letterSpacing: 3, textAlign: 'center', marginTop: 6 },

  // HP Bar
  hpSection:               { marginBottom: SPACING.lg },
  hpContainer:             { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.neonRed, padding: SPACING.md, shadowColor: COLORS.neonRed, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  hpLabelRow:              { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  hpLabel:                 { fontFamily: FONTS.display, color: COLORS.textSecondary, fontSize: 10, letterSpacing: 3 },
  hpPercent:               { fontFamily: FONTS.display, fontSize: 12, letterSpacing: 2 },
  hpTrack:                 { height: 20, backgroundColor: COLORS.bgBorder, borderRadius: RADIUS.sm, overflow: 'hidden', position: 'relative' },
  hpFill:                  { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: RADIUS.sm, shadowColor: COLORS.neonRed, shadowOpacity: 1, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  hpGlow:                  { position: 'absolute', left: 0, top: 0, bottom: 0, height: 20, borderRadius: RADIUS.sm },

  // Lore
  loreBlock:               { marginBottom: SPACING.lg, paddingHorizontal: SPACING.sm },
  loreBorder:              { height: 1, backgroundColor: COLORS.bossAccentPurple, marginVertical: SPACING.md, opacity: 0.4 },
  loreText:                { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 11, lineHeight: 20, fontStyle: 'italic', textAlign: 'center' },

  // Required tasks
  reqSection:              { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bgBorder, padding: SPACING.md, marginBottom: SPACING.lg, shadowColor: COLORS.bossAccentPurple, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  reqSectionTitle:         { fontFamily: FONTS.display, color: COLORS.bossAccentPurple, fontSize: 11, letterSpacing: 3, marginBottom: 4, textShadowColor: COLORS.bossAccentPurple, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  reqSectionSub:           { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 9, letterSpacing: 1, marginBottom: 4 },
  reqRow:                  { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.bgBorder },
  reqIndicator:            { width: 8, height: 8, borderRadius: RADIUS.full, marginRight: SPACING.md, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  reqLabel:                { fontFamily: FONTS.body, color: COLORS.textPrimary, fontSize: 11, flex: 1, lineHeight: 18 },
  reqLabelDone:            { color: COLORS.neonGreen, textDecorationLine: 'line-through', opacity: 0.7 },
  reqDoneTag:              { fontFamily: FONTS.display, color: COLORS.neonGreen, fontSize: 8, letterSpacing: 1 },

  // Rewards
  rewardsBlock:            { backgroundColor: '#0A0510', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.neonGold, padding: SPACING.md, marginBottom: SPACING.lg, shadowColor: COLORS.neonGold, shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  rewardsSectionTitle:     { fontFamily: FONTS.display, color: COLORS.neonGold, fontSize: 11, letterSpacing: 3, marginBottom: SPACING.md, textShadowColor: COLORS.neonGold, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  rewardsGrid:             { flexDirection: 'row', justifyContent: 'space-around', marginBottom: SPACING.md },
  rewardItem:              { alignItems: 'center', flex: 1 },
  rewardItemIcon:          { fontSize: 24, marginBottom: 4, color: COLORS.neonGold },
  rewardItemValue:         { fontFamily: FONTS.display, color: COLORS.neonGold, fontSize: 10, letterSpacing: 1, textAlign: 'center' },
  rewardItemLabel:         { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 8, letterSpacing: 1, marginTop: 2 },
  statBonusRow:            { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: COLORS.bgBorder },
  statBonusLabel:          { fontFamily: FONTS.display, fontSize: 9, letterSpacing: 1 },
  statBonusXp:             { fontFamily: FONTS.bodyBold, fontSize: 10 },

  // Claim loot
  claimBtn:                { marginBottom: SPACING.lg, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 2, borderColor: COLORS.neonGold, shadowColor: COLORS.neonGold, shadowOpacity: 0.8, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  claimBtnInner:           { paddingVertical: SPACING.lg, alignItems: 'center', backgroundColor: '#1A1200' },
  claimBtnText:            { fontFamily: FONTS.display, color: COLORS.neonGold, fontSize: 16, letterSpacing: 4, textShadowColor: COLORS.neonGold, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 15 },
  lootClaimedBanner:       { backgroundColor: '#040D0A', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.neonGreen, padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.lg },
  lootClaimedText:         { fontFamily: FONTS.display, color: COLORS.neonGreen, fontSize: 11, letterSpacing: 2 },

  // Days info
  daysInfoBlock:           { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bgBorder, padding: SPACING.md, marginBottom: SPACING.lg },
  daysInfoText:            { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 10, lineHeight: 18, textAlign: 'center' },
});