// ============================================================
//  HUNTER PROTOCOL — PENALTY ZONE SCREEN
//  app/penalty.tsx
//
//  Fixes:
//  ✓ Uses useActivePenalty() and usePenaltyProgress() selectors
//  ✓ Progress reads live from store — updates on every tap
//  ✓ Null guard prevents crash while data loads
//  ✓ Falls back to config shape if DB progress is empty
// ============================================================

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useGameStore,
  usePlayer,
  useLevelDef,
  useActivePenalty,
  usePenaltyProgress,
} from '../store/useGameStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { useAudio } from '../hooks/useAudio';

// ─────────────────────────────────────────────────────────────
//  RED SCANLINES
// ─────────────────────────────────────────────────────────────

function RedScanlines() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true })
    ).start();
  }, []);
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            penStyles.scanLine,
            {
              top: `${i * 25}%` as any,
              transform: [{
                translateY: anim.interpolate({
                  inputRange: [0, 1], outputRange: [-60, 60],
                }),
              }],
            },
          ]}
        />
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
//  GLITCH TEXT
// ─────────────────────────────────────────────────────────────

function GlitchText({ text, style }: { text: string; style?: any }) {
  const glitch1 = useRef(new Animated.Value(0)).current;
  const glitch2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = () => {
      const delay = 2000 + Math.random() * 3000;
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(glitch1, { toValue: 1, duration: 50, useNativeDriver: true }),
          Animated.timing(glitch1, { toValue: 0, duration: 50, useNativeDriver: true }),
          Animated.timing(glitch2, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(glitch2, { toValue: 0, duration: 80, useNativeDriver: true }),
        ]).start(run);
      }, delay);
    };
    run();
  }, []);

  return (
    <View>
      <Animated.Text
        style={[
          style,
          penStyles.glitchGhost,
          {
            opacity:   glitch1.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
            transform: [{ translateX: glitch1.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
          },
        ]}
      >
        {text}
      </Animated.Text>
      <Animated.Text
        style={[
          style,
          penStyles.glitchGhost2,
          {
            opacity:   glitch2.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }),
            transform: [{ translateX: glitch2.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }],
          },
        ]}
      >
        {text}
      </Animated.Text>
      <Text style={style}>{text}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  PENALTY STEP CARD
//  Reads its completed state from penaltyProgress prop
//  which comes directly from the store selector — always fresh.
// ─────────────────────────────────────────────────────────────

function PenaltyStepCard({
  step,
  index,
  completed,
  onComplete,
}: {
  step: { taskId: string; label: string; description: string };
  index: number;
  completed: boolean;
  onComplete: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (completed) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start(() => onComplete());
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={completed}
        activeOpacity={0.85}
        style={[
          penStyles.stepCard,
          completed && penStyles.stepCardDone,
        ]}
      >
        {/* Step number / checkmark */}
        <View style={[
          penStyles.stepNumber,
          completed && penStyles.stepNumberDone,
        ]}>
          <Text style={penStyles.stepNumberText}>
            {completed ? '✓' : String(index + 1).padStart(2, '0')}
          </Text>
        </View>

        <View style={penStyles.stepContent}>
          <Text style={[
            penStyles.stepLabel,
            completed && penStyles.stepLabelDone,
          ]}>
            {step.label}
          </Text>
          <Text style={penStyles.stepDesc}>{step.description}</Text>
        </View>

        {completed && (
          <View style={penStyles.stepCheckBadge}>
            <Text style={penStyles.stepCheckText}>DONE</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
//  LOADING STATE
// ─────────────────────────────────────────────────────────────

function PenaltyLoading() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={penStyles.loadingRoot}>
      <Animated.Text style={[penStyles.loadingText, { opacity: pulse }]}>
        ⚠ LOADING PENALTY DATA...
      </Animated.Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN PENALTY ZONE SCREEN
// ─────────────────────────────────────────────────────────────

export default function PenaltyZoneScreen() {
  const insets = useSafeAreaInsets();
  const audio  = useAudio();

  // ── Store selectors — each reactive independently ──────────
  const player             = usePlayer();
  const levelDef           = useLevelDef();
  const activePenaltyQuest = useActivePenalty();

  // This selector reads player.penaltyQuestProgress directly
  // and re-renders this component every time it changes —
  // including after the optimistic update in completePenaltyStep
  const penaltyProgress = usePenaltyProgress();

  const completeStep = useGameStore(s => s.completePenaltyStep);

  // ── Animations ────────────────────────────────────────────
  const headerAnim   = useRef(new Animated.Value(0)).current;
  const contentAnim  = useRef(new Animated.Value(0)).current;
  const borderPulse  = useRef(new Animated.Value(0)).current;
  const warningPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    audio.onPenaltyActivate();

    Animated.stagger(300, [
      Animated.spring(headerAnim,  { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.spring(contentAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(borderPulse,  { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(borderPulse,  { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(warningPulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(warningPulse, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleStepComplete = useCallback(async (taskId: string) => {
    await completeStep(taskId);
  }, [completeStep]);

  // ── Guard — wait for data ─────────────────────────────────
  if (!player || !levelDef || !activePenaltyQuest) {
    return <PenaltyLoading />;
  }

  // ── Derive progress ───────────────────────────────────────
  // Uses penaltyProgress from the store selector (always live).
  // Falls back to config shape if array is empty (e.g. first render
  // before DB has synced the progress array).
  const progress = penaltyProgress.length > 0
    ? penaltyProgress
    : activePenaltyQuest.tasks.map(t => ({ taskId: t.taskId, completed: false }));

  const completedCount = progress.filter(p => p.completed).length;
  const totalSteps     = activePenaltyQuest.tasks.length;
  const progressRatio  = totalSteps > 0 ? completedCount / totalSteps : 0;
  const activeSince    = player.penaltyActivatedAt
    ? new Date(player.penaltyActivatedAt).toLocaleString()
    : 'Unknown';

  return (
    <View style={[penStyles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.penaltyBg} />

      <RedScanlines />

      {/* Pulsing red border */}
      <Animated.View
        pointerEvents="none"
        style={[
          penStyles.borderOverlay,
          {
            borderColor: COLORS.penaltyAccent,
            opacity:     borderPulse,
          },
        ]}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={penStyles.scrollContent}
      >

        {/* ALERT HEADER */}
        <Animated.View style={[penStyles.alertHeader, { opacity: warningPulse }]}>
          <Text style={penStyles.alertHeaderText}>
            ██ SYSTEM ALERT — PENALTY ZONE ACTIVE ██
          </Text>
        </Animated.View>

        {/* TITLE */}
        <Animated.View
          style={[
            penStyles.titleBlock,
            {
              opacity: headerAnim,
              transform: [{
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1], outputRange: [-30, 0],
                }),
              }],
            },
          ]}
        >
          <Text style={penStyles.penaltyIcon}>{activePenaltyQuest.icon}</Text>
          <GlitchText text="PENALTY ZONE" style={penStyles.penaltyTitle} />
          <Text style={penStyles.penaltySubtitle}>{activePenaltyQuest.name}</Text>
        </Animated.View>

        {/* TIMESTAMP */}
        <View style={penStyles.timestampRow}>
          <Text style={penStyles.timestampLabel}>ACTIVATED: </Text>
          <Text style={penStyles.timestampValue}>{activeSince}</Text>
        </View>

        {/* LORE */}
        <Animated.View
          style={[
            penStyles.loreBlock,
            {
              opacity: contentAnim,
              transform: [{
                translateY: contentAnim.interpolate({
                  inputRange: [0, 1], outputRange: [20, 0],
                }),
              }],
            },
          ]}
        >
          <Text style={penStyles.loreText}>{activePenaltyQuest.lore}</Text>
        </Animated.View>

        {/* STATUS EFFECTS */}
        <View style={penStyles.statusEffects}>
          <Text style={penStyles.statusTitle}>ACTIVE PENALTIES</Text>
          {[
            'Shop access: REVOKED',
            'UI protocol: RED',
            'Progression: SUSPENDED',
            'XP: PRESERVED — no loss',
          ].map(s => (
            <View key={s} style={penStyles.statusRow}>
              <View style={penStyles.statusDot} />
              <Text style={penStyles.statusText}>{s}</Text>
            </View>
          ))}
        </View>

        {/* PROGRESS BAR */}
        <View style={penStyles.progressBlock}>
          <View style={penStyles.progressHeader}>
            <Text style={penStyles.progressLabel}>ATONEMENT PROGRESS</Text>
            <Text style={[
              penStyles.progressCount,
              completedCount === totalSteps && { color: COLORS.neonGreen },
            ]}>
              {completedCount} / {totalSteps}
            </Text>
          </View>
          <View style={penStyles.progressTrack}>
            <View
              style={[
                penStyles.progressFill,
                { width: `${progressRatio * 100}%` as any },
                completedCount === totalSteps && {
                  backgroundColor: COLORS.neonGreen,
                  shadowColor:     COLORS.neonGreen,
                },
              ]}
            />
          </View>
          {completedCount === totalSteps && (
            <Text style={penStyles.completeHint}>
              ✓ ALL TASKS COMPLETE — ESCAPING PENALTY ZONE...
            </Text>
          )}
        </View>

        {/* ATONEMENT TASKS */}
        <Text style={penStyles.stepsTitle}>◈ ATONEMENT TASKS</Text>
        <Text style={penStyles.stepsSub}>{activePenaltyQuest.description}</Text>

        {activePenaltyQuest.tasks.map((task, i) => {
          const stepProgress = progress.find(p => p.taskId === task.taskId);
          const completed    = stepProgress?.completed ?? false;
          return (
            <PenaltyStepCard
              key={task.taskId}
              step={task}
              index={i}
              completed={completed}
              onComplete={() => handleStepComplete(task.taskId)}
            />
          );
        })}

        {/* ESCAPE REWARD PREVIEW */}
        <View style={penStyles.rewardPreview}>
          <Text style={penStyles.rewardPreviewTitle}>
            ◈ ESCAPE REWARD (ON COMPLETION)
          </Text>
          <Text style={penStyles.rewardPreviewItem}>
            +{activePenaltyQuest.escapeReward.currencyBonus} System Credits
          </Text>
          {activePenaltyQuest.escapeReward.statBonuses.map(b => (
            <Text key={b.stat} style={penStyles.rewardPreviewItem}>
              +{b.xp} {b.stat} XP
            </Text>
          ))}
          <Text style={penStyles.rewardPreviewNote}>
            UI RESTORED · SHOP UNLOCKED · RED PROTOCOL DEACTIVATED
          </Text>
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────

const penStyles = StyleSheet.create({
  root:               { flex: 1, backgroundColor: COLORS.penaltyBg, overflow: 'hidden' },
  loadingRoot:        { flex: 1, backgroundColor: COLORS.penaltyBg, justifyContent: 'center', alignItems: 'center' },
  loadingText:        { fontFamily: FONTS.display, color: COLORS.neonRed, fontSize: 12, letterSpacing: 2 },
  scrollContent:      { paddingHorizontal: SPACING.md },
  scanLine:           { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: COLORS.penaltyAccent, opacity: 0.08, zIndex: 998, pointerEvents: 'none' },
  borderOverlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 3, zIndex: 999, pointerEvents: 'none', shadowOpacity: 1, shadowRadius: 25, shadowOffset: { width: 0, height: 0 } },
  alertHeader:        { backgroundColor: COLORS.penaltyAccent, paddingVertical: SPACING.sm, alignItems: 'center', marginBottom: SPACING.lg },
  alertHeaderText:    { fontFamily: FONTS.display, color: COLORS.bg, fontSize: 9, letterSpacing: 2 },
  titleBlock:         { alignItems: 'center', marginBottom: SPACING.lg },
  penaltyIcon:        { fontSize: 56, marginBottom: SPACING.md },
  penaltyTitle:       { fontFamily: FONTS.display, color: COLORS.penaltyAccent, fontSize: 36, letterSpacing: 4, textAlign: 'center', textShadowColor: COLORS.penaltyGlow, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 },
  penaltySubtitle:    { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 10, letterSpacing: 2, textAlign: 'center', marginTop: SPACING.sm },
  glitchGhost:        { position: 'absolute', color: '#00C2FF' },
  glitchGhost2:       { position: 'absolute', color: '#8B5CF6' },
  timestampRow:       { flexDirection: 'row', justifyContent: 'center', marginBottom: SPACING.lg },
  timestampLabel:     { fontFamily: FONTS.bodyBold, color: COLORS.textSecondary, fontSize: 9, letterSpacing: 1 },
  timestampValue:     { fontFamily: FONTS.body, color: COLORS.penaltyAccent, fontSize: 9, letterSpacing: 1 },
  loreBlock:          { backgroundColor: '#120008', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.penaltyAccent, padding: SPACING.md, marginBottom: SPACING.lg, shadowColor: COLORS.penaltyAccent, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  loreText:           { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 11, lineHeight: 20, fontStyle: 'italic' },
  statusEffects:      { backgroundColor: '#0D0005', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bgBorder, padding: SPACING.md, marginBottom: SPACING.lg },
  statusTitle:        { fontFamily: FONTS.display, color: COLORS.penaltyAccent, fontSize: 10, letterSpacing: 3, marginBottom: SPACING.sm },
  statusRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  statusDot:          { width: 6, height: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.penaltyAccent, marginRight: SPACING.sm, shadowColor: COLORS.penaltyAccent, shadowOpacity: 0.8, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  statusText:         { fontFamily: FONTS.body, color: COLORS.textPrimary, fontSize: 10, letterSpacing: 0.5 },
  progressBlock:      { marginBottom: SPACING.lg },
  progressHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  progressLabel:      { fontFamily: FONTS.display, color: COLORS.textSecondary, fontSize: 9, letterSpacing: 2 },
  progressCount:      { fontFamily: FONTS.display, color: COLORS.penaltyAccent, fontSize: 11 },
  progressTrack:      { height: 6, backgroundColor: COLORS.bgBorder, borderRadius: RADIUS.full, overflow: 'hidden' },
  progressFill:       { height: 6, backgroundColor: COLORS.penaltyAccent, borderRadius: RADIUS.full, shadowColor: COLORS.penaltyAccent, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  completeHint:       { fontFamily: FONTS.body, color: COLORS.neonGreen, fontSize: 9, letterSpacing: 1, marginTop: SPACING.sm, textAlign: 'center' },
  stepsTitle:         { fontFamily: FONTS.display, color: COLORS.penaltyAccent, fontSize: 11, letterSpacing: 3, marginBottom: 4 },
  stepsSub:           { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 10, marginBottom: SPACING.md, lineHeight: 16 },
  stepCard:           { flexDirection: 'row', backgroundColor: '#0D0005', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.penaltyAccent, padding: SPACING.md, marginBottom: SPACING.sm, alignItems: 'flex-start', shadowColor: COLORS.penaltyAccent, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  stepCardDone:       { backgroundColor: '#040D0A', borderColor: COLORS.neonGreen, shadowColor: COLORS.neonGreen },
  stepNumber:         { width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.penaltyAccent, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md, flexShrink: 0, shadowColor: COLORS.penaltyAccent, shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  stepNumberDone:     { backgroundColor: COLORS.neonGreen, shadowColor: COLORS.neonGreen },
  stepNumberText:     { fontFamily: FONTS.display, color: COLORS.bg, fontSize: 10, letterSpacing: 1 },
  stepContent:        { flex: 1 },
  stepLabel:          { fontFamily: FONTS.display, color: COLORS.penaltyAccent, fontSize: 11, letterSpacing: 1, marginBottom: 4, lineHeight: 18 },
  stepLabelDone:      { color: COLORS.neonGreen, textDecorationLine: 'line-through', opacity: 0.7 },
  stepDesc:           { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 10, lineHeight: 16 },
  stepCheckBadge:     { backgroundColor: '#040D0A', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.neonGreen, alignSelf: 'flex-start', marginLeft: SPACING.sm },
  stepCheckText:      { fontFamily: FONTS.display, color: COLORS.neonGreen, fontSize: 8, letterSpacing: 1 },
  rewardPreview:      { backgroundColor: '#040D0A', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.neonGreen, padding: SPACING.md, marginTop: SPACING.lg, opacity: 0.7 },
  rewardPreviewTitle: { fontFamily: FONTS.display, color: COLORS.neonGreen, fontSize: 9, letterSpacing: 2, marginBottom: SPACING.sm },
  rewardPreviewItem:  { fontFamily: FONTS.bodyBold, color: COLORS.textPrimary, fontSize: 10, marginBottom: 2 },
  rewardPreviewNote:  { fontFamily: FONTS.body, color: COLORS.neonGreen, fontSize: 8, letterSpacing: 1, marginTop: SPACING.sm, opacity: 0.7 },
});