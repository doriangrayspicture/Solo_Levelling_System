// ============================================================
//  HUNTER PROTOCOL — AUTH SCREEN
//  app/auth.tsx
// ============================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, KeyboardAvoidingView,
  Platform, ScrollView, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '../store/useGameStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { SYSTEM_META } from '../config/SystemConfig';

export default function AuthScreen() {
  const insets    = useSafeAreaInsets();
  const signIn    = useGameStore(s => s.signIn);
  const signUp    = useGameStore(s => s.signUp);
  const isLoading = useGameStore(s => s.isLoading);
  const error     = useGameStore(s => s.error);

  const [mode, setMode]             = useState<'signin' | 'signup'>('signin');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [hunterName, setHunterName] = useState('');

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const scanAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(300, [
      Animated.spring(titleAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.spring(fadeAnim,  { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.timing(scanAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    ).start();
  }, []);

  const handleSubmit = async () => {
    if (mode === 'signin') {
      await signIn(email, password);
    } else {
      await signUp(email, password, hunterName || 'Hunter');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[authStyles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      <Animated.View
        pointerEvents="none"
        style={[
          authStyles.scanLine,
          {
            transform: [{
              translateY: scanAnim.interpolate({
                inputRange: [0, 1], outputRange: [-600, 600],
              }),
            }],
          },
        ]}
      />

      <ScrollView
        contentContainerStyle={authStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* TITLE */}
        <Animated.View
          style={[
            authStyles.titleBlock,
            {
              opacity: titleAnim,
              transform: [{
                translateY: titleAnim.interpolate({
                  inputRange: [0, 1], outputRange: [-20, 0],
                }),
              }],
            },
          ]}
        >
          <Text style={authStyles.systemLabel}>// SYSTEM BOOT SEQUENCE</Text>
          <Text style={authStyles.appName}>{SYSTEM_META.appName}</Text>
          <Text style={authStyles.appTagline}>{SYSTEM_META.appTagline}</Text>
          <View style={authStyles.divider} />
          <Text style={authStyles.versionText}>v{SYSTEM_META.version}</Text>
        </Animated.View>

        {/* FORM */}
        <Animated.View style={[authStyles.form, { opacity: fadeAnim }]}>
          {/* Mode toggle */}
          <View style={authStyles.modeToggle}>
            <TouchableOpacity
              onPress={() => setMode('signin')}
              style={[authStyles.modeBtn, mode === 'signin' && authStyles.modeBtnActive]}
            >
              <Text style={[authStyles.modeBtnText, mode === 'signin' && authStyles.modeBtnTextActive]}>
                SIGN IN
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode('signup')}
              style={[authStyles.modeBtn, mode === 'signup' && authStyles.modeBtnActive]}
            >
              <Text style={[authStyles.modeBtnText, mode === 'signup' && authStyles.modeBtnTextActive]}>
                REGISTER
              </Text>
            </TouchableOpacity>
          </View>

          {mode === 'signup' && (
            <View style={authStyles.inputGroup}>
              <Text style={authStyles.inputLabel}>HUNTER DESIGNATION</Text>
              <TextInput
                style={authStyles.input}
                value={hunterName}
                onChangeText={setHunterName}
                placeholder="Enter your hunter name..."
                placeholderTextColor={COLORS.textDim}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={authStyles.inputGroup}>
            <Text style={authStyles.inputLabel}>SYSTEM EMAIL</Text>
            <TextInput
              style={authStyles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="hunter@system.protocol"
              placeholderTextColor={COLORS.textDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={authStyles.inputGroup}>
            <Text style={authStyles.inputLabel}>ACCESS KEY</Text>
            <TextInput
              style={authStyles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textDim}
              secureTextEntry
            />
          </View>

          {error && (
            <View style={authStyles.errorBox}>
              <Text style={authStyles.errorText}>⚠ {error}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
            style={[authStyles.submitBtn, isLoading && authStyles.submitBtnLoading]}
          >
            <Text style={authStyles.submitBtnText}>
              {isLoading
                ? 'AUTHENTICATING...'
                : mode === 'signin'
                ? '▶ ACCESS SYSTEM'
                : '▶ REGISTER HUNTER'}
            </Text>
          </TouchableOpacity>

          {mode === 'signup' && (
            <Text style={authStyles.disclaimer}>
              By registering, you acknowledge that the System is watching.
              Your obligations begin immediately.
            </Text>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const authStyles = StyleSheet.create({
  root:             { flex: 1, backgroundColor: COLORS.bg, overflow: 'hidden' },
  scrollContent:    { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.xxl },
  scanLine:         { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: COLORS.neonBlue, opacity: 0.05, zIndex: 0, pointerEvents: 'none' },
  titleBlock:       { alignItems: 'center', marginBottom: SPACING.xxl },
  systemLabel:      { fontFamily: FONTS.body, color: COLORS.neonBlue, fontSize: 10, letterSpacing: 2, marginBottom: SPACING.md },
  appName:          { fontFamily: FONTS.display, color: COLORS.textPrimary, fontSize: 20, letterSpacing: 3, textAlign: 'center', textShadowColor: COLORS.neonBlue, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  appTagline:       { fontFamily: FONTS.display, color: COLORS.neonBlue, fontSize: 32, letterSpacing: 8, marginTop: SPACING.sm, textShadowColor: COLORS.neonBlue, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 },
  divider:          { width: 60, height: 1, backgroundColor: COLORS.neonBlue, marginVertical: SPACING.md, opacity: 0.5 },
  versionText:      { fontFamily: FONTS.body, color: COLORS.textDim, fontSize: 9, letterSpacing: 2 },
  form:             { gap: SPACING.md },
  modeToggle:       { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bgBorder, padding: 4, marginBottom: SPACING.sm },
  modeBtn:          { flex: 1, paddingVertical: SPACING.sm, alignItems: 'center', borderRadius: RADIUS.sm },
  modeBtnActive:    { backgroundColor: COLORS.neonBlue },
  modeBtnText:      { fontFamily: FONTS.display, color: COLORS.textSecondary, fontSize: 10, letterSpacing: 2 },
  modeBtnTextActive:{ color: COLORS.bg },
  inputGroup:       { gap: SPACING.xs },
  inputLabel:       { fontFamily: FONTS.display, color: COLORS.textSecondary, fontSize: 8, letterSpacing: 2 },
  input:            { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bgBorder, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, fontFamily: FONTS.body, color: COLORS.textPrimary, fontSize: 13 },
  errorBox:         { backgroundColor: '#120005', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.neonRed, padding: SPACING.md },
  errorText:        { fontFamily: FONTS.body, color: COLORS.neonRed, fontSize: 10, letterSpacing: 1 },
  submitBtn:        { backgroundColor: COLORS.neonBlue, borderRadius: RADIUS.md, paddingVertical: SPACING.lg, alignItems: 'center', marginTop: SPACING.sm, shadowColor: COLORS.neonBlue, shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
  submitBtnLoading: { opacity: 0.6 },
  submitBtnText:    { fontFamily: FONTS.display, color: COLORS.bg, fontSize: 13, letterSpacing: 3 },
  disclaimer:       { fontFamily: FONTS.body, color: COLORS.textDim, fontSize: 9, textAlign: 'center', lineHeight: 16, marginTop: SPACING.sm },
});