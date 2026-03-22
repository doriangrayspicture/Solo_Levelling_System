// ============================================================
//  HUNTER PROTOCOL — SHOP SCREEN
//  app/(tabs)/shop.tsx
//
//  Fixes:
//  ✓ Reads shopUnlocked from store directly (not prop)
//  ✓ Currency reads live from player selector
//  ✓ Purchase button responds immediately via optimistic update
//  ✓ Active boosts panel reads live from store
// ============================================================

import React, { useRef, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Animated, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useGameStore,
  usePlayer,
  useShopUnlocked,
  useLevelDef,
} from '../../store/useGameStore';
import { COLORS, FONTS, SPACING, RADIUS, RARITY_COLOR } from '../../constants/theme';
import { useAudio } from '../../hooks/useAudio';
import type { ShopItem } from '../../config/SystemConfig';

// ─────────────────────────────────────────────────────────────
//  LOCKED SHOP UI
// ─────────────────────────────────────────────────────────────

function LockedShop({
  completedCount,
  minRequired,
}: {
  completedCount: number;
  minRequired: number;
}) {
  const lockPulse = useRef(new Animated.Value(1)).current;
  const scanAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(lockPulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(lockPulse, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 2000, useNativeDriver: true })
    ).start();
  }, []);

  const remaining = Math.max(0, minRequired - completedCount);

  return (
    <View style={lockedStyles.root}>
      {/* Scan line */}
      <Animated.View
        pointerEvents="none"
        style={[
          lockedStyles.scanLine,
          {
            transform: [{
              translateY: scanAnim.interpolate({
                inputRange: [0, 1], outputRange: [-400, 400],
              }),
            }],
          },
        ]}
      />

      <Animated.View style={[lockedStyles.lockIcon, { transform: [{ scale: lockPulse }] }]}>
        <Text style={lockedStyles.lockEmoji}>🔒</Text>
      </Animated.View>

      <Text style={lockedStyles.lockedTitle}>SHOP ACCESS DENIED</Text>
      <Text style={lockedStyles.lockedSub}>MINIMUM DAILY REQUIREMENT NOT MET</Text>

      <View style={lockedStyles.requirementBox}>
        <Text style={lockedStyles.reqText}>TASKS COMPLETED TODAY</Text>
        <View style={lockedStyles.reqCountRow}>
          {Array.from({ length: minRequired }).map((_, i) => (
            <View
              key={i}
              style={[
                lockedStyles.reqDot,
                i < completedCount && lockedStyles.reqDotFilled,
              ]}
            />
          ))}
        </View>
        <Text style={lockedStyles.reqCountText}>{completedCount} / {minRequired}</Text>
        <Text style={lockedStyles.reqRemaining}>
          {remaining} MORE TASK{remaining !== 1 ? 'S' : ''} REQUIRED
        </Text>
      </View>

      <Text style={lockedStyles.flavorText}>
        "The System rewards those who honor their obligations.{'\n'}
        Return when you have proven your commitment."
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  SHOP ITEM CARD
// ─────────────────────────────────────────────────────────────

function ShopItemCard({
  item,
  canAfford,
  owned,
  onBuy,
}: {
  item: ShopItem;
  canAfford: boolean;
  owned: boolean;
  onBuy: () => void;
}) {
  const rarityColor = RARITY_COLOR[item.rarity] ?? COLORS.neonBlue;
  const shimmer     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (item.rarity === 'Legendary') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  const getEffectDescription = () => {
    switch (item.effect.type) {
      case 'xpMultiplier':
        return `${item.effect.multiplier}× ${item.effect.stat} XP for ${item.effect.durationHours}h`;
      case 'currencyBoost':
        return `${item.effect.multiplier}× all currency for ${item.effect.durationHours}h`;
      case 'unlockCosmetic':
        return `Unlocks cosmetic: ${item.effect.cosmeticId}`;
      case 'restorePenalty':
        return 'Instantly clears Penalty Zone status';
    }
  };

  return (
    <Animated.View
      style={[
        shopStyles.itemCard,
        { borderColor: rarityColor },
        item.rarity === 'Legendary' && {
          shadowColor:  rarityColor,
          shadowOpacity: shimmer.interpolate({
            inputRange: [0, 1], outputRange: [0.3, 0.9],
          }) as any,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 0 },
        },
      ]}
    >
      <View style={[shopStyles.rarityStripe, { backgroundColor: rarityColor }]} />

      <View style={shopStyles.itemInner}>
        {/* Top row */}
        <View style={shopStyles.itemHeader}>
          <Text style={shopStyles.itemIcon}>{item.icon}</Text>
          <View style={shopStyles.itemTitles}>
            <Text style={[shopStyles.itemName, { color: rarityColor }]}>{item.name}</Text>
            <Text style={[shopStyles.rarityTag, { color: rarityColor }]}>
              [{item.rarity.toUpperCase()}] · {item.category.toUpperCase()}
            </Text>
          </View>
          {owned && (
            <View style={shopStyles.ownedBadge}>
              <Text style={shopStyles.ownedText}>OWNED</Text>
            </View>
          )}
        </View>

        {/* Description */}
        <Text style={shopStyles.itemDesc}>{item.description}</Text>

        {/* Effect */}
        <View style={shopStyles.effectRow}>
          <Text style={shopStyles.effectLabel}>EFFECT: </Text>
          <Text style={[shopStyles.effectValue, { color: rarityColor }]}>
            {getEffectDescription()}
          </Text>
        </View>

        {/* Buy row */}
        <View style={shopStyles.buyRow}>
          <View style={shopStyles.costPill}>
            <Text style={shopStyles.costText}>◈ {item.cost}</Text>
          </View>
          <TouchableOpacity
            onPress={onBuy}
            disabled={!canAfford || owned}
            activeOpacity={0.8}
            style={[
              shopStyles.buyBtn,
              { borderColor: rarityColor },
              (!canAfford || owned) && shopStyles.buyBtnDisabled,
            ]}
          >
            <Text style={[
              shopStyles.buyBtnText,
              { color: canAfford && !owned ? rarityColor : COLORS.textDim },
            ]}>
              {owned ? 'ACQUIRED' : canAfford ? 'PURCHASE' : 'INSUFFICIENT ◈'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
//  ACTIVE BOOSTS PANEL
// ─────────────────────────────────────────────────────────────

function ActiveBoostsPanel({ boosts }: { boosts: any }) {
  const activeEntries = Object.entries(boosts).filter(([_, v]: any) => {
    if (!v?.expiresAt) return false;
    return new Date(v.expiresAt) > new Date();
  });

  if (activeEntries.length === 0) return null;

  return (
    <View style={shopStyles.boostsPanel}>
      <Text style={shopStyles.boostsPanelTitle}>◈ ACTIVE BOOSTS</Text>
      {activeEntries.map(([key, val]: any) => {
        const remaining = Math.max(
          0,
          Math.round(
            (new Date(val.expiresAt).getTime() - Date.now()) / 3600000 * 10
          ) / 10
        );
        return (
          <View key={key} style={shopStyles.boostRow}>
            <Text style={shopStyles.boostKey}>{key}</Text>
            <Text style={shopStyles.boostVal}>{val.multiplier}×</Text>
            <Text style={shopStyles.boostExpiry}>{remaining}h remaining</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN SHOP SCREEN
// ─────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const audio  = useAudio();

  // ── Store slices ──────────────────────────────────────────
  const player       = usePlayer();
  const levelDef     = useLevelDef();
  const shopUnlocked = useShopUnlocked();
  const completedDailyCount = useGameStore(s => s.dailyState.completedDailyCount);

  const purchase  = useGameStore(s => s.purchaseShopItem);
  const isLoading = useGameStore(s => s.isLoading);

  const handleBuy = useCallback(async (item: ShopItem) => {
    await purchase(item);
    audio.onShopPurchase();
  }, [purchase, audio]);

  if (!player || !levelDef) return null;

  const minRequired = levelDef.dailyMinimumTasks;

  return (
    <View style={[shopStyles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={shopStyles.header}>
        <View>
          <Text style={shopStyles.headerLabel}>// SYSTEM SHOP</Text>
          <Text style={shopStyles.headerTitle}>REWARD TERMINAL</Text>
        </View>
        <View style={shopStyles.currencyBadge}>
          <Text style={shopStyles.currencyText}>◈ {player.systemCurrency}</Text>
        </View>
      </View>

      {!shopUnlocked ? (
        <LockedShop
          completedCount={completedDailyCount}
          minRequired={minRequired}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={shopStyles.scrollContent}
        >
          {/* Unlocked banner */}
          <View style={shopStyles.unlockedBanner}>
            <Text style={shopStyles.unlockedText}>
              ✓ SHOP ACCESS GRANTED — DAILY MINIMUM MET
            </Text>
          </View>

          {/* Active boosts */}
          <ActiveBoostsPanel boosts={player.activeBoosts} />

          {/* Inventory */}
          <Text style={shopStyles.inventoryTitle}>◈ AVAILABLE INVENTORY</Text>

          {levelDef.shopItems.map(item => {
            const canAfford = player.systemCurrency >= item.cost;
            const owned     = item.effect.type === 'unlockCosmetic'
              ? player.unlockedCosmetics.includes(item.effect.cosmeticId)
              : false;
            return (
              <ShopItemCard
                key={item.id}
                item={item}
                canAfford={canAfford}
                owned={owned}
                onBuy={() => handleBuy(item)}
              />
            );
          })}

          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  STYLES
// ─────────────────────────────────────────────────────────────

const lockedStyles = StyleSheet.create({
  root:            { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.xl, overflow: 'hidden' },
  scanLine:        { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: COLORS.neonBlue, opacity: 0.06 },
  lockIcon:        { marginBottom: SPACING.lg },
  lockEmoji:       { fontSize: 64 },
  lockedTitle:     { fontFamily: FONTS.display, color: COLORS.neonBlue, fontSize: 18, letterSpacing: 3, textAlign: 'center', marginBottom: SPACING.sm, textShadowColor: COLORS.neonBlue, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  lockedSub:       { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 10, letterSpacing: 2, textAlign: 'center', marginBottom: SPACING.xl },
  requirementBox:  { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.bgBorder, padding: SPACING.lg, alignItems: 'center', width: '100%', marginBottom: SPACING.xl },
  reqText:         { fontFamily: FONTS.display, color: COLORS.textSecondary, fontSize: 9, letterSpacing: 2, marginBottom: SPACING.md },
  reqCountRow:     { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  reqDot:          { width: 16, height: 16, borderRadius: RADIUS.full, backgroundColor: COLORS.bgBorder, borderWidth: 1, borderColor: COLORS.textDim },
  reqDotFilled:    { backgroundColor: COLORS.neonBlue, borderColor: COLORS.neonBlue, shadowColor: COLORS.neonBlue, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  reqCountText:    { fontFamily: FONTS.display, color: COLORS.neonBlue, fontSize: 24, letterSpacing: 4 },
  reqRemaining:    { fontFamily: FONTS.body, color: COLORS.neonRed, fontSize: 10, letterSpacing: 1, marginTop: SPACING.sm },
  flavorText:      { fontFamily: FONTS.body, color: COLORS.textDim, fontSize: 10, fontStyle: 'italic', textAlign: 'center', lineHeight: 18 },
});

const shopStyles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: COLORS.bg },
  scrollContent:    { paddingHorizontal: SPACING.md },
  header:           { paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.bgBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLabel:      { fontFamily: FONTS.body, color: COLORS.neonBlue, fontSize: 9, letterSpacing: 2 },
  headerTitle:      { fontFamily: FONTS.display, color: COLORS.textPrimary, fontSize: 18, letterSpacing: 3, marginTop: 4 },
  currencyBadge:    { backgroundColor: '#1A1200', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.neonGold, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  currencyText:     { fontFamily: FONTS.display, color: COLORS.neonGold, fontSize: 14, letterSpacing: 2 },
  unlockedBanner:   { backgroundColor: '#040D0A', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.neonGreen, padding: SPACING.md, alignItems: 'center', marginVertical: SPACING.md },
  unlockedText:     { fontFamily: FONTS.display, color: COLORS.neonGreen, fontSize: 9, letterSpacing: 2 },
  boostsPanel:      { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.neonPurple, padding: SPACING.md, marginBottom: SPACING.md, shadowColor: COLORS.neonPurple, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  boostsPanelTitle: { fontFamily: FONTS.display, color: COLORS.neonPurple, fontSize: 10, letterSpacing: 2, marginBottom: SPACING.sm },
  boostRow:         { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  boostKey:         { fontFamily: FONTS.bodyBold, color: COLORS.textPrimary, fontSize: 10, flex: 1 },
  boostVal:         { fontFamily: FONTS.display, color: COLORS.neonPurple, fontSize: 10, marginHorizontal: SPACING.sm },
  boostExpiry:      { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 9 },
  inventoryTitle:   { fontFamily: FONTS.display, color: COLORS.neonBlue, fontSize: 11, letterSpacing: 3, marginBottom: SPACING.md, marginTop: SPACING.sm },
  itemCard:         { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, marginBottom: SPACING.md, overflow: 'hidden', flexDirection: 'row' },
  rarityStripe:     { width: 3, alignSelf: 'stretch' },
  itemInner:        { flex: 1, padding: SPACING.md },
  itemHeader:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm },
  itemIcon:         { fontSize: 24, marginRight: SPACING.sm },
  itemTitles:       { flex: 1 },
  itemName:         { fontFamily: FONTS.display, fontSize: 12, letterSpacing: 1 },
  rarityTag:        { fontFamily: FONTS.body, fontSize: 8, letterSpacing: 1, marginTop: 3 },
  ownedBadge:       { backgroundColor: COLORS.bgBorder, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.sm },
  ownedText:        { fontFamily: FONTS.display, color: COLORS.neonGreen, fontSize: 8, letterSpacing: 1 },
  itemDesc:         { fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 10, lineHeight: 16, marginBottom: SPACING.sm },
  effectRow:        { flexDirection: 'row', marginBottom: SPACING.md, flexWrap: 'wrap' },
  effectLabel:      { fontFamily: FONTS.bodyBold, color: COLORS.textSecondary, fontSize: 9, letterSpacing: 1 },
  effectValue:      { fontFamily: FONTS.body, fontSize: 9, flex: 1 },
  buyRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  costPill:         { backgroundColor: '#1A1200', borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderWidth: 1, borderColor: COLORS.neonGold },
  costText:         { fontFamily: FONTS.display, color: COLORS.neonGold, fontSize: 12, letterSpacing: 1 },
  buyBtn:           { borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  buyBtnDisabled:   { borderColor: COLORS.textDim, opacity: 0.5 },
  buyBtnText:       { fontFamily: FONTS.display, fontSize: 9, letterSpacing: 2 },
});