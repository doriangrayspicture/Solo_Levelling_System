// ============================================================
//  HUNTER PROTOCOL — DESIGN SYSTEM
//  constants/theme.ts
//
//  Single source of truth for all visual tokens.
//  Every component imports from here. Never hardcode colors.
// ============================================================

export const COLORS = {
  // ── Backgrounds ──────────────────────────────────────────
  bg:           '#04050A',   // Near-void black — main background
  bgCard:       '#090C14',   // Card surfaces
  bgElevated:   '#0E1220',   // Elevated panels, modals
  bgBorder:     '#151B2E',   // Subtle borders

  // ── Neon Accents ─────────────────────────────────────────
  neonBlue:     '#00C2FF',   // Primary accent — UI chrome, active states
  neonPurple:   '#8B5CF6',   // Secondary accent — XP, skill tree
  neonGreen:    '#00FF94',   // Success, completion states
  neonRed:      '#FF2D55',   // Penalty zone, danger
  neonGold:     '#FFD700',   // Boss loot, legendary rarity
  neonOrange:   '#FF6B00',   // Guild board accent

  // ── Text ─────────────────────────────────────────────────
  textPrimary:  '#E8EAF6',   // Main text
  textSecondary:'#6B7DB3',   // Muted / secondary
  textDim:      '#2E3A5C',   // Very dim — disabled states

  // ── Rarity Colors ────────────────────────────────────────
  rarityCommon:    '#6B7DB3',
  rarityRare:      '#00C2FF',
  rarityEpic:      '#8B5CF6',
  rarityLegendary: '#FFD700',

  // ── Stat Colors (mirrors SystemConfig) ───────────────────
  statMTech:        '#7C3AED',
  statTechSkill:    '#2563EB',
  statSexyBody:     '#059669',
  statGlassSkin:    '#06B6D4',
  statEliteHair:    '#D97706',
  statAntiAging:    '#BE185D',
  statCharisma:     '#F59E0B',
  statGlobalPolish: '#10B981',

  // ── Penalty Zone ─────────────────────────────────────────
  penaltyBg:        '#0D0005',
  penaltyAccent:    '#FF2D55',
  penaltyGlow:      '#FF003C',

  // ── Boss Fight ───────────────────────────────────────────
  bossBg:           '#06000F',
  bossAccentRed:    '#FF2D55',
  bossAccentPurple: '#8B5CF6',
  bossHpFull:       '#FF2D55',
  bossHpLow:        '#FF6B00',
} as const;

export const FONTS = {
  // Display: Orbitron — aggressive, futuristic, military
  display:     'Orbitron_700Bold',
  displayMed:  'Orbitron_500Medium',
  // Body: system monospace — clean, terminal aesthetic
  body:        'SpaceMono_400Regular',
  bodyBold:    'SpaceMono_700Bold',
} as const;

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
} as const;

export const RADIUS = {
  sm:  6,
  md:  10,
  lg:  16,
  xl:  24,
  full: 999,
} as const;

// Rarity → color mapping used in multiple components
export const RARITY_COLOR: Record<string, string> = {
  Common:    COLORS.rarityCommon,
  Rare:      COLORS.rarityRare,
  Epic:      COLORS.rarityEpic,
  Legendary: COLORS.rarityLegendary,
};

// StatKey → color mapping
export const STAT_COLOR: Record<string, string> = {
  MTech:        COLORS.statMTech,
  TechSkill:    COLORS.statTechSkill,
  SexyBody:     COLORS.statSexyBody,
  GlassSkin:    COLORS.statGlassSkin,
  EliteHair:    COLORS.statEliteHair,
  AntiAging:    COLORS.statAntiAging,
  Charisma:     COLORS.statCharisma,
  GlobalPolish: COLORS.statGlobalPolish,
};