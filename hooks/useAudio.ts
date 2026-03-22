// ============================================================
//  HUNTER PROTOCOL — AUDIO ENGINE
//  hooks/useAudio.ts
//
//  TTS works on both web (browser Speech API) and mobile (expo-speech)
//  SFX placeholder system — replace __PLACEHOLDER__ paths when ready
// ============================================================

import { useCallback } from 'react';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { SYSTEM_META } from '../config/SystemConfig';

// ─────────────────────────────────────────────────────────────
//  WEB TTS — uses browser SpeechSynthesis API directly
//  More reliable on web than expo-speech
// ─────────────────────────────────────────────────────────────

function speakWeb(text: string) {
  if (typeof window === 'undefined') return;
  if (!('speechSynthesis' in window)) return;

  // Cancel anything currently speaking
  window.speechSynthesis.cancel();

  const utterance       = new SpeechSynthesisUtterance(text);
  utterance.rate        = SYSTEM_META.ttsConfig.rate;
  utterance.pitch       = SYSTEM_META.ttsConfig.pitch;
  utterance.volume      = SYSTEM_META.ttsConfig.volume;

  // Try to find a robotic / deep voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.name.toLowerCase().includes('google uk english male') ||
    v.name.toLowerCase().includes('microsoft david') ||
    v.name.toLowerCase().includes('daniel') ||
    v.name.toLowerCase().includes('alex')
  );
  if (preferred) utterance.voice = preferred;

  window.speechSynthesis.speak(utterance);
}

// ─────────────────────────────────────────────────────────────
//  MOBILE TTS — expo-speech
// ─────────────────────────────────────────────────────────────

function speakMobile(text: string) {
  Speech.stop();
  Speech.speak(text, {
    rate:   SYSTEM_META.ttsConfig.rate,
    pitch:  SYSTEM_META.ttsConfig.pitch,
    volume: SYSTEM_META.ttsConfig.volume,
  });
}

// ─────────────────────────────────────────────────────────────
//  CORE SPEAK FUNCTION
//  Routes to web or mobile based on platform
// ─────────────────────────────────────────────────────────────

function speakLine(text: string) {
  if (!SYSTEM_META.ttsConfig.enabled) return;
  if (!text) return;

  if (Platform.OS === 'web') {
    // Browser requires voices to be loaded first
    // If getVoices() is empty, wait for the voiceschanged event
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          speakWeb(text);
        }, { once: true });
      } else {
        speakWeb(text);
      }
    }
  } else {
    speakMobile(text);
  }
}

// ─────────────────────────────────────────────────────────────
//  SFX ENGINE
//  Placeholder — drop real MP3s in assets/sfx/ and update
//  SystemConfig.sfxConfig.tracks to point to them
// ─────────────────────────────────────────────────────────────

function playSfx(trackKey: keyof typeof SYSTEM_META.sfxConfig.tracks) {
  if (!SYSTEM_META.sfxConfig.enabled) return;
  const path = SYSTEM_META.sfxConfig.tracks[trackKey];
  if (!path || path === '__PLACEHOLDER__') {
    if (__DEV__) console.log(`[SFX] Would play: ${trackKey}`);
    return;
  }
  // TODO: uncomment when you have real audio files
  // import { Audio } from 'expo-av';
  // const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
  // sound.setOnPlaybackStatusUpdate(status => {
  //   if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
  // });
}

// ─────────────────────────────────────────────────────────────
//  MAIN HOOK
// ─────────────────────────────────────────────────────────────

export function useAudio() {

  const speak = useCallback((eventKey: string) => {
    const line = SYSTEM_META.ttsConfig.lines[eventKey];
    if (line) speakLine(line);
  }, []);

  const speakRaw = useCallback((text: string) => {
    speakLine(text);
  }, []);

  const stop = useCallback(() => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      Speech.stop();
    }
  }, []);

  const play = useCallback((
    trackKey: keyof typeof SYSTEM_META.sfxConfig.tracks
  ) => {
    playSfx(trackKey);
  }, []);

  // ── Event hooks ───────────────────────────────────────────

  const onAppOpen = useCallback(() => {
    playSfx('taskComplete'); // use taskComplete sfx as placeholder
    speakLine(SYSTEM_META.ttsConfig.lines['appOpen'] ?? 'Welcome back, Hunter.');
  }, []);

  const onTaskComplete = useCallback(() => {
    playSfx('taskComplete');
    speakLine(SYSTEM_META.ttsConfig.lines['taskComplete'] ?? 'Task complete.');
  }, []);

  const onSideQuestComplete = useCallback(() => {
    playSfx('sideQuestComplete');
    speakLine(SYSTEM_META.ttsConfig.lines['sideQuestComplete'] ?? 'Side quest cleared.');
  }, []);

  const onGuildTaskComplete = useCallback(() => {
    playSfx('guildTaskComplete');
    speakLine(SYSTEM_META.ttsConfig.lines['guildTaskComplete'] ?? 'Guild task complete.');
  }, []);

  const onBossDefeated = useCallback(() => {
    playSfx('bossDefeated');
    speakLine(SYSTEM_META.ttsConfig.lines['bossDefeated'] ?? 'Boss eliminated.');
  }, []);

  const onLevelUp = useCallback(() => {
    playSfx('levelUp');
    speakLine(SYSTEM_META.ttsConfig.lines['levelUp'] ?? 'Level up.');
  }, []);

  const onShopUnlocked = useCallback(() => {
    playSfx('shopUnlocked');
    speakLine(SYSTEM_META.ttsConfig.lines['shopUnlocked'] ?? 'Shop access granted.');
  }, []);

  const onShopPurchase = useCallback(() => {
    playSfx('shopPurchase');
    speakLine(SYSTEM_META.ttsConfig.lines['shopPurchase'] ?? 'Transaction complete.');
  }, []);

  const onPenaltyActivate = useCallback(() => {
    playSfx('penaltyActivate');
    speakLine(SYSTEM_META.ttsConfig.lines['penaltyActivate'] ?? 'Penalty Zone activated.');
  }, []);

  const onPenaltyEscape = useCallback(() => {
    playSfx('penaltyEscape');
    speakLine(SYSTEM_META.ttsConfig.lines['penaltyEscape'] ?? 'Penalty quest complete.');
  }, []);

  const onGuildBoardUnlocked = useCallback(() => {
    playSfx('guildBoardUnlocked');
    speakLine(SYSTEM_META.ttsConfig.lines['guildBoardUnlocked'] ?? 'Guild Board unlocked.');
  }, []);

  const onError = useCallback(() => {
    playSfx('error');
    speakLine(SYSTEM_META.ttsConfig.lines['error'] ?? 'System error detected.');
  }, []);

  return {
    speak,
    speakRaw,
    stop,
    play,
    onAppOpen,
    onTaskComplete,
    onSideQuestComplete,
    onGuildTaskComplete,
    onBossDefeated,
    onLevelUp,
    onShopUnlocked,
    onShopPurchase,
    onPenaltyActivate,
    onPenaltyEscape,
    onGuildBoardUnlocked,
    onError,
  };
}