import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppStateProvider, useApp } from '../src/app-state';
import { Icon } from '../src/icons';
import { glowShadow, radius } from '../src/theme';

function Splash() {
  const { colors, theme, t } = useApp();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: colors.bg }}>
      <Animated.View
        style={{
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
          borderRadius: radius.pill,
          padding: 3,
          backgroundColor: colors.surfaceAlt,
          ...glowShadow(colors.glow, theme === 'dark' ? 0.55 : 0.3),
        }}
      >
        <LinearGradient
          colors={colors.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 78, height: 78, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="coins" size={36} color={colors.onPrimary} strokeWidth={1.7} />
        </LinearGradient>
      </Animated.View>
      <Text style={{ color: colors.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 }}>{t('appName')}</Text>
      <Text style={{ color: colors.faint, fontSize: 13, fontWeight: '600' }}>{t('tagline')}</Text>
    </View>
  );
}

function Gate() {
  const { ready, colors, theme } = useApp();

  useEffect(() => {
    if (Platform.OS === 'web') document.body.style.backgroundColor = colors.bg;
    else void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {ready ? <Stack screenOptions={{ headerShown: false, animation: 'fade' }} /> : <Splash />}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <View style={{ flex: 1 }}>
          <Gate />
        </View>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
