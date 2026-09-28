import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Animated, Easing, Platform, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useApp } from './app-state';
import { glowShadow, radius } from './theme';
import { Tap, buzz } from './ui';

function mod(value: number, base: number) {
  return ((value % base) + base) % base;
}

function wedge(cx: number, cy: number, radius: number, start: number, end: number) {
  const rad = (deg: number) => (Math.PI / 180) * deg;
  const x1 = cx + radius * Math.cos(rad(start));
  const y1 = cy + radius * Math.sin(rad(start));
  const x2 = cx + radius * Math.cos(rad(end));
  const y2 = cy + radius * Math.sin(rad(end));
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
}

export function PrizeWheel({
  names,
  disabled,
  label,
  onResult,
}: {
  names: string[];
  disabled?: boolean;
  label: string;
  onResult: (index: number) => void;
}) {
  const { colors, theme } = useApp();
  const { width } = useWindowDimensions();
  const dark = theme === 'dark';

  const [rotation] = useState(() => new Animated.Value(0));
  const angle = useRef(0);
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);

  const size = Math.min(Math.round(width * 0.72), 300);
  const cx = size / 2;
  const cy = size / 2;
  const wheelRadius = size / 2 - 16;
  const slice = 360 / Math.max(names.length, 1);
  const labelColor = dark ? '#06120E' : '#FFFFFF';
  const fontSize = names.length > 10 ? 9 : names.length > 7 ? 10.5 : 13;

  const spinTo = rotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  function spin() {
    if (disabled || busy || names.length === 0) return;
    setBusy(true);
    setWinner(null);
    buzz('tap');

    const picked = Math.floor(Math.random() * names.length);
    const desired = mod(-(picked + 0.5) * slice, 360);
    const from = mod(angle.current, 360);
    let delta = desired - from;
    if (delta < 0) delta += 360;
    const next = angle.current + 360 * 5 + delta;

    if (Platform.OS !== 'web') {
      const ticks = 14;
      for (let i = 1; i <= ticks; i += 1) {
        setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid), (4200 / (ticks + 2)) * i);
      }
    }

    Animated.timing(rotation, {
      toValue: next,
      duration: 4200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      setBusy(false);
      if (!finished) return;
      angle.current = next;
      setWinner(picked);
      buzz('success');
      onResult(picked);
    });
  }

  return (
    <View style={{ alignItems: 'center', gap: 20 }}>
      <View style={{ width: size, height: size + 16, alignItems: 'center' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            zIndex: 3,
            width: 0,
            height: 0,
            borderLeftWidth: 11,
            borderRightWidth: 11,
            borderTopWidth: 20,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: colors.primary,
          }}
        />

        <View
          style={{
            marginTop: 16,
            width: size,
            height: size,
            borderRadius: wheelRadius + 16,
            padding: 8,
            backgroundColor: colors.surfaceAlt,
            borderWidth: 1,
            borderColor: colors.line,
            alignItems: 'center',
            justifyContent: 'center',
            ...glowShadow(colors.glow, dark ? 0.35 : 0.18),
          }}
        >
          <Animated.View style={{ transform: [{ rotate: spinTo }] }}>
            <Svg width={size - 16} height={size - 16}>
              <Defs>
                <RadialGradient id="sheen" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={dark ? 0.14 : 0.2} />
                  <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              {names.map((name, index) => {
                const start = -90 + index * slice;
                const end = start + slice - (names.length > 1 ? 0.6 : 0);
                const mid = start + slice / 2;
                const isWinner = winner === index;
                const fill = colors.wheel[index % colors.wheel.length];
                return (
                  <G key={`${name}-${index}`}>
                    {names.length === 1 ? (
                      <Circle cx={cx - 8} cy={cy - 8} r={wheelRadius} fill={fill} />
                    ) : (
                      <Path d={wedge(cx - 8, cy - 8, wheelRadius, start, end)} fill={fill} opacity={winner === null || isWinner ? 1 : 0.42} />
                    )}
                    <SvgText
                      x={cx - 8 + Math.cos((Math.PI / 180) * mid) * wheelRadius * 0.6}
                      y={cy - 8 + Math.sin((Math.PI / 180) * mid) * wheelRadius * 0.6}
                      fill={labelColor}
                      fontSize={fontSize}
                      fontWeight="800"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                      opacity={winner === null || isWinner ? 1 : 0.5}
                    >
                      {name.length > 9 ? `${name.slice(0, 8)}…` : name}
                    </SvgText>
                  </G>
                );
              })}
              <Circle cx={cx - 8} cy={cy - 8} r={wheelRadius} fill="url(#sheen)" />
              <Circle cx={cx - 8} cy={cy - 8} r={wheelRadius * 0.235} fill={colors.surface} />
              <Circle cx={cx - 8} cy={cy - 8} r={wheelRadius * 0.235} fill="none" stroke={colors.line} strokeWidth={1} />
              <Circle cx={cx - 8} cy={cy - 8} r={wheelRadius * 0.09} fill={colors.primary} />
            </Svg>
          </Animated.View>
        </View>
      </View>

      <Tap onPress={spin} disabled={disabled || busy} haptic="none">
        <View
          style={{
            borderRadius: radius.pill,
            backgroundColor: disabled || busy ? colors.surfaceAlt : colors.primary,
            borderWidth: 1,
            borderColor: disabled || busy ? colors.line : 'transparent',
            paddingHorizontal: 40,
            paddingVertical: 15,
            ...(disabled || busy ? {} : glowShadow(colors.glow, dark ? 0.5 : 0.28)),
          }}
        >
          <Text style={{ color: disabled || busy ? colors.faint : colors.onPrimary, fontWeight: '800', fontSize: 16, letterSpacing: -0.2 }}>
            {label}
          </Text>
        </View>
      </Tap>
    </View>
  );
}
