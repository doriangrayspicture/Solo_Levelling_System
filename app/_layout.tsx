// ============================================================
//  HUNTER PROTOCOL — ROOT LAYOUT
//  app/_layout.tsx
//
//  Fixes:
//  ✓ Foreground resume detection — fires initialize() when
//    app comes back to focus on mobile (tab switch, home→app)
//  ✓ Page visibility API for web
//  ✓ AppState for mobile
//  ✓ App open TTS fires correctly on every real open
// ============================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, StyleSheet, ActivityIndicator, Text, AppState,
  type AppStateStatus,
} from 'react-native';
import { useRouter, useSegments, Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import {
  Orbitron_400Regular,
  Orbitron_500Medium,
  Orbitron_700Bold,
} from '@expo-google-fonts/orbitron';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';
import { supabase } from '../lib/supabase';
import { useGameStore, useIsPenaltyZone } from '../store/useGameStore';
import { useAudio } from '../hooks/useAudio';
import { COLORS } from '../constants/theme';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────
//  AUTH + PENALTY GATE
// ─────────────────────────────────────────────────────────────

function AuthAndPenaltyGate({ children }: { children: React.ReactNode }) {
  const router        = useRouter();
  const segments      = useSegments();
  const isPenalty     = useIsPenaltyZone();
  const initialize    = useGameStore(s => s.initialize);
  const isInitialized = useGameStore(s => s.isInitialized);
  const audio         = useAudio();

  const [session, setSession] = useState<any>(undefined);
  const appState              = useRef(AppState.currentState);
  const hasSpokenRef          = useRef(false);

  const handleSession = useCallback(async (newSession: any) => {
    setSession(newSession);
    if (newSession) {
      await new Promise(r => setTimeout(r, 800));
      await initialize();
      // Speak welcome only once per real session load
      if (!hasSpokenRef.current) {
        hasSpokenRef.current = true;
        setTimeout(() => audio.onAppOpen(), 600);
      }
    }
  }, [initialize, audio]);

  // Initial session check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        hasSpokenRef.current = false; // reset so next login speaks
        handleSession(newSession);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── FOREGROUND RESUME DETECTION ───────────────────────────
  // This is what fixes the phone "not welcoming" issue.
  // When user switches back to the app/tab, re-initialize
  // so daily state refreshes and midnight check runs.
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web — use Page Visibility API
      const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible') {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await initialize();
            // Only speak if it's been more than 5 minutes since last open
            // (avoids speaking every time you switch tabs briefly)
            setTimeout(() => audio.onAppOpen(), 600);
          }
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);

    } else {
      // Mobile — use React Native AppState
      const subscription = AppState.addEventListener(
        'change',
        async (nextAppState: AppStateStatus) => {
          if (
            appState.current.match(/inactive|background/) &&
            nextAppState === 'active'
          ) {
            // App came to foreground
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              await initialize();
              setTimeout(() => audio.onAppOpen(), 600);
            }
          }
          appState.current = nextAppState;
        }
      );
      return () => subscription.remove();
    }
  }, [initialize, audio]);

  // ── ROUTING ───────────────────────────────────────────────
  useEffect(() => {
    if (session === undefined) return;
    if (!segments) return;

    const currentSegment = segments[0] as string | undefined;

    if (!session) {
      if (currentSegment !== 'auth') router.replace('/auth');
      return;
    }

    if (!isInitialized) return;

    if (isPenalty) {
      if (currentSegment !== 'penalty') router.replace('/penalty');
      return;
    }

    if (currentSegment === 'auth' || currentSegment === 'penalty') {
      router.replace('/');
      return;
    }

    if (!currentSegment) router.replace('/');

  }, [session, isInitialized, isPenalty, segments]);

  // Loading spinner while checking session
  if (session === undefined) {
    return (
      <View style={rootStyles.loading}>
        <ActivityIndicator color={COLORS.neonBlue} size="large" />
        <Text style={rootStyles.loadingText}>INITIALIZING SYSTEM...</Text>
      </View>
    );
  }

  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────
//  ROOT LAYOUT
// ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Orbitron_400Regular,
    Orbitron_500Medium,
    Orbitron_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={rootStyles.loading}>
        <ActivityIndicator color={COLORS.neonBlue} size="large" />
        <Text style={rootStyles.loadingText}>INITIALIZING SYSTEM...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthAndPenaltyGate>
        <Stack
          screenOptions={{
            headerShown:  false,
            contentStyle: { backgroundColor: COLORS.bg },
            animation:    'fade',
          }}
        >
          <Stack.Screen name="(tabs)"   options={{ headerShown: false }} />
          <Stack.Screen
            name="boss"
            options={{
              headerShown:  false,
              animation:    'slide_from_bottom',
              presentation: 'fullScreenModal',
            }}
          />
          <Stack.Screen
            name="penalty"
            options={{
              headerShown:    false,
              animation:      'fade',
              gestureEnabled: false,
            }}
          />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
        </Stack>
      </AuthAndPenaltyGate>
    </SafeAreaProvider>
  );
}

const rootStyles = StyleSheet.create({
  loading: {
    flex:            1,
    backgroundColor: COLORS.bg,
    justifyContent:  'center',
    alignItems:      'center',
    gap:             20,
  },
  loadingText: {
    fontFamily:    'monospace',
    color:         COLORS.neonBlue,
    fontSize:      12,
    letterSpacing: 3,
  },
});