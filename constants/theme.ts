// ============================================================
//  HUNTER PROTOCOL — DESIGN SYSTEM
//  constants/theme.ts
// ============================================================

export const COLORS = {
  // Backgrounds
  bg:           '#04050A',
  bgCard:       '#090C14',
  bgElevated:   '#0E1220',
  bgBorder:     '#151B2E',

  // Neon Accents
  neonBlue:     '#00C2FF',
  neonPurple:   '#8B5CF6',
  neonGreen:    '#00FF94',
  neonRed:      '#FF2D55',
  neonGold:     '#FFD700',
  neonOrange:   '#FF6B00',

  // Text
  textPrimary:  '#E8EAF6',
  textSecondary:'#6B7DB3',
  textDim:      '#2E3A5C',

  // Rarity
  rarityCommon:    '#6B7DB3',
  rarityRare:      '#00C2FF',
  rarityEpic:      '#8B5CF6',
  rarityLegendary: '#FFD700',

  // Stat Colors
  statMTech:        '#7C3AED',
  statTechSkill:    '#2563EB',
  statSexyBody:     '#059669',
  statGlassSkin:    '#06B6D4',
  statEliteHair:    '#D97706',
  statAntiAging:    '#BE185D',
  statCharisma:     '#F59E0B',
  statGlobalPolish: '#10B981',

  // Penalty Zone
  penaltyBg:     '#0D0005',
  penaltyAccent: '#FF2D55',
  penaltyGlow:   '#FF003C',

  // Boss Fight
  bossBg:           '#06000F',
  bossAccentRed:    '#FF2D55',
  bossAccentPurple: '#8B5CF6',
  bossHpFull:       '#FF2D55',
  bossHpLow:        '#FF6B00',
} as const;

export const FONTS = {
  display:    'Orbitron_700Bold',
  displayMed: 'Orbitron_500Medium',
  body:       'SpaceMono_400Regular',
  bodyBold:   'SpaceMono_700Bold',
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
  sm:   6,
  md:   10,
  lg:   16,
  xl:   24,
  full: 999,
} as const;

export const RARITY_COLOR: Record<string, string> = {
  Common:    COLORS.rarityCommon,
  Rare:      COLORS.rarityRare,
  Epic:      COLORS.rarityEpic,
  Legendary: COLORS.rarityLegendary,
};

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