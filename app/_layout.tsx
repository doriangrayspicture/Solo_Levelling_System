// ============================================================
//  HUNTER PROTOCOL — ROOT LAYOUT
//  app/_layout.tsx
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
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

  // null  = no session
  // object = has session
  // undefined = not checked yet (show spinner)
  const [session, setSession] = useState<any>(undefined);

  const handleSession = useCallback(async (newSession: any) => {
    setSession(newSession);
    if (newSession) {
      // Wait for DB trigger to finish creating player_profile
      await new Promise(r => setTimeout(r, 800));
      await initialize();
      // Speak the app open line after everything loads
      setTimeout(() => {
        audio.onAppOpen();
      }, 500);
    }
  }, [initialize, audio]);

  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        handleSession(newSession);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Routing logic ─────────────────────────────────────────
  useEffect(() => {
    if (session === undefined) return;
    if (!segments) return;

    const currentSegment = segments[0] as string | undefined;

    if (!session) {
      if (currentSegment !== 'auth') {
        router.replace('/auth');
      }
      return;
    }

    if (!isInitialized) return;

    if (isPenalty) {
      if (currentSegment !== 'penalty') {
        router.replace('/penalty');
      }
      return;
    }

    if (currentSegment === 'auth' || currentSegment === 'penalty') {
      router.replace('/');
      return;
    }

    if (!currentSegment) {
      router.replace('/');
    }

  }, [session, isInitialized, isPenalty, segments]);

  // Show spinner while checking session
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