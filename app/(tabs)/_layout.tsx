// ============================================================
//  HUNTER PROTOCOL — TABS LAYOUT
//  app/(tabs)/_layout.tsx
// ============================================================

import { Tabs } from 'expo-router';
import { COLORS, FONTS } from '../../constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bgCard,
          borderTopColor: COLORS.bgBorder,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor:   COLORS.neonBlue,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          fontFamily: FONTS.display,
          fontSize: 8,
          letterSpacing: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'MISSIONS', tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="shop"
        options={{ title: 'SHOP', tabBarIcon: () => null }}
      />
    </Tabs>
  );
}