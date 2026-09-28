import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useApp } from './app-state';
import { Icon, type IconName } from './icons';
import { elevation, glowShadow, radius, space, type Palette } from './theme';

export type HapticKind = 'tap' | 'select' | 'success' | 'warn' | 'error';

export function buzz(kind: HapticKind = 'tap') {
  if (Platform.OS === 'web') return;
  if (kind === 'tap') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  else if (kind === 'select') void Haptics.selectionAsync();
  else if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'warn') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export function Tap({
  onPress,
  disabled,
  style,
  children,
  haptic = 'tap',
  accessibilityLabel,
  accessibilityRole = 'button',
}: {
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  haptic?: HapticKind | 'none';
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab' | 'link';
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    Animated.spring(scale, {
      toValue: pressed && !disabled ? 0.965 : 1,
      useNativeDriver: true,
      friction: 7,
      tension: 90,
    }).start();
  }, [pressed, disabled, scale]);

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={() => {
          if (haptic !== 'none') buzz(haptic);
          onPress();
        }}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={({ pressed: p }) => [{ opacity: disabled ? 0.4 : p ? 0.86 : 1 }]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function useUi(colors: Palette, theme: 'light' | 'dark') {
  return useMemo(
    () =>
      StyleSheet.create({
      root: { flex: 1, backgroundColor: colors.bg },
      headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.lg,
        paddingBottom: space.md,
        gap: space.sm,
      },
      headerTitle: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
      content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
      footer: {
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        gap: space.sm,
        backgroundColor: colors.bg,
        borderTopWidth: 1,
        borderTopColor: colors.line,
      },
      card: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: space.lg,
        gap: space.sm,
        borderWidth: 1,
        borderColor: colors.line,
        ...elevation(theme, 1),
      },
      input: {
        backgroundColor: colors.surfaceAlt,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radius.sm,
        paddingHorizontal: space.lg,
        paddingVertical: 14,
        fontSize: 16,
        color: colors.ink,
      },
    }),
    [colors, theme],
  );
}

export function Screen({
  title,
  subtitle,
  children,
  scroll = true,
  footer,
  inTabs = false,
  actions,
  showBack = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
  inTabs?: boolean;
  actions?: ReactNode;
  showBack?: boolean;
}) {
  const { direction, language, setLanguage, theme, setTheme, colors, t } = useApp();
  const styles = useUi(colors, theme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const canGoBack = router.canGoBack();

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, inTabs && { paddingBottom: 140 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.content}>{children}</View>
  );

  return (
    <View style={[styles.root, { direction, paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        {showBack && canGoBack ? (
          <IconButton icon="back" onPress={() => router.back()} label={t('back')} flip={direction === 'rtl'} />
        ) : (
          <View style={{ width: 40 }} />
        )}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={{ color: colors.faint, fontSize: 12, fontWeight: '600' }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {actions}
          <IconButton
            icon={theme === 'dark' ? 'sun' : 'moon'}
            onPress={() => void setTheme(theme === 'dark' ? 'light' : 'dark')}
            label={theme === 'dark' ? t('themeLight') : t('themeDark')}
            haptic="select"
          />
          <IconButton
            icon="globe"
            onPress={() => void setLanguage(language === 'fa' ? 'en' : 'fa')}
            label={language === 'fa' ? 'English' : 'دری'}
            text={language === 'fa' ? 'EN' : 'دری'}
            haptic="select"
          />
        </View>
      </View>
      {body}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: inTabs ? space.md : Math.max(insets.bottom, space.lg) }]}>{footer}</View>
      ) : null}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  tone = 'neutral',
  size = 40,
  disabled,
  flip,
  text,
  haptic = 'tap',
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  tone?: 'neutral' | 'primary' | 'danger';
  size?: number;
  disabled?: boolean;
  flip?: boolean;
  text?: string;
  haptic?: HapticKind | 'none';
}) {
  const { colors, theme } = useApp();
  const bg = tone === 'primary' ? colors.primarySoft : tone === 'danger' ? colors.dangerSoft : colors.surface;
  const fg = tone === 'primary' ? colors.primary : tone === 'danger' ? colors.danger : colors.muted;
  return (
    <Tap onPress={onPress} disabled={disabled} haptic={haptic} accessibilityLabel={label}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: tone === 'neutral' ? colors.line : 'transparent',
          ...elevation(theme, 1),
        }}
      >
        {text ? (
          <Text style={{ color: fg, fontSize: 12, fontWeight: '800' }}>{text}</Text>
        ) : (
          <Icon name={icon} size={Math.round(size * 0.5)} color={fg} style={flip ? { transform: [{ scaleX: -1 }] } : undefined} />
        )}
      </View>
    </Tap>
  );
}

export function Card({
  children,
  onPress,
  style,
  glow,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  glow?: boolean;
}) {
  const { colors, theme } = useApp();
  const styles = useUi(colors, theme);
  const inner = (
    <View style={[styles.card, glow && glowShadow(colors.glow, 0.28), style]}>{children}</View>
  );
  if (!onPress) return inner;
  return <Tap onPress={onPress}>{inner}</Tap>;
}

export function Button({
  label,
  onPress,
  tone = 'primary',
  size = 'md',
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'soft' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: IconName;
}) {
  const { colors, theme } = useApp();
  const padV = size === 'lg' ? 17 : size === 'sm' ? 10 : 14;
  const fontSize = size === 'lg' ? 17 : size === 'sm' ? 14 : 15;
  const iconSize = size === 'lg' ? 20 : 17;

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        paddingVertical: padV,
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
      }}
    >
      {icon ? (
        <Icon
          name={icon}
          size={iconSize}
          color={tone === 'primary' ? colors.onPrimary : tone === 'danger' ? colors.danger : colors.primary}
        />
      ) : null}
      <Text
        style={{
          color: tone === 'primary' ? colors.onPrimary : tone === 'danger' ? colors.danger : colors.ink,
          fontSize,
          fontWeight: '800',
          letterSpacing: -0.2,
        }}
      >
        {label}
      </Text>
    </View>
  );

  const wrapper =
    tone === 'primary' ? (
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius.md, overflow: 'hidden', ...glowShadow(colors.glow, theme === 'dark' ? 0.4 : 0.22) }}
      >
        {content}
      </LinearGradient>
    ) : (
      <View
        style={{
          borderRadius: radius.md,
          overflow: 'hidden',
          backgroundColor: tone === 'danger' ? colors.dangerSoft : tone === 'soft' ? colors.primarySoft : colors.surface,
          borderWidth: tone === 'ghost' ? 1 : 0,
          borderColor: colors.line,
        }}
      >
        {content}
      </View>
    );

  return (
    <Tap onPress={onPress} disabled={disabled} haptic={tone === 'danger' ? 'warn' : 'tap'}>
      {wrapper}
    </Tap>
  );
}

export function Field({
  label,
  hint,
  value,
  onChangeText,
  error,
  ...props
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
} & Omit<TextInputProps, 'value' | 'onChangeText'>) {
  const { language, colors, theme } = useApp();
  const styles = useUi(colors, theme);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 }}>{label}</Text>
        {hint ? <Text style={{ color: colors.faint, fontSize: 12, fontWeight: '600' }}>{hint}</Text> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.faint}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          { textAlign: language === 'fa' ? 'right' : 'left' },
          focused && { borderColor: colors.primary, ...glowShadow(colors.glow, 0.18) },
          error ? { borderColor: colors.danger } : null,
        ]}
        {...props}
      />
      {error ? <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>{error}</Text> : null}
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'gold' | 'danger';
  icon?: IconName;
}) {
  const { colors } = useApp();
  const bg = tone === 'primary' ? colors.primarySoft : tone === 'gold' ? colors.goldSoft : tone === 'danger' ? colors.dangerSoft : colors.surfaceAlt;
  const fg = tone === 'primary' ? colors.primary : tone === 'gold' ? colors.gold : tone === 'danger' ? colors.danger : colors.muted;
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      {icon ? <Icon name={icon} size={12} color={fg} strokeWidth={2.4} /> : null}
      <Text style={{ color: fg, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.2 }}>{label}</Text>
    </View>
  );
}

export function statusTone(status: 'draft' | 'active' | 'completed'): 'gold' | 'primary' | 'neutral' {
  return status === 'active' ? 'primary' : status === 'draft' ? 'gold' : 'neutral';
}

const AVATAR_CACHE: Record<string, number> = {};

function hueOf(name: string, count: number) {
  if (AVATAR_CACHE[name] === undefined) {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    AVATAR_CACHE[name] = hash % count;
  }
  return AVATAR_CACHE[name];
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function Avatar({ name, size = 44, color }: { name: string; size?: number; color?: string }) {
  const { colors } = useApp();
  const accent = color ?? colors.wheel[hueOf(name, colors.wheel.length)];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${accent}26`,
        borderWidth: 1.5,
        borderColor: `${accent}66`,
      }}
    >
      <Text style={{ color: accent, fontSize: size * 0.34, fontWeight: '800', letterSpacing: -0.3 }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

export function StatTile({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: 'neutral' | 'primary' | 'gold';
}) {
  const { colors } = useApp();
  const accent = tone === 'primary' ? colors.primary : tone === 'gold' ? colors.gold : colors.muted;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.md,
        padding: space.md,
        gap: 6,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={14} color={accent} strokeWidth={2.2} />
        <Text numberOfLines={1} style={{ color: colors.faint, fontSize: 11, fontWeight: '700' }}>
          {label}
        </Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 }}>
        {value}
      </Text>
    </View>
  );
}

export function ProgressRing({
  value,
  size = 132,
  thickness = 11,
  children,
}: {
  value: number;
  size?: number;
  thickness?: number;
  children?: ReactNode;
}) {
  const { colors, theme } = useApp();
  const clamped = Math.max(0, Math.min(1, value));
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const [progress] = useState(() => new Animated.Value(0));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = progress.addListener(({ value: v }) => setDisplay(v));
    Animated.timing(progress, {
      toValue: clamped,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => progress.removeListener(id);
  }, [clamped, progress]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfacePress} strokeWidth={thickness} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme === 'dark' ? colors.primary : colors.primaryDeep}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference * display} ${circumference}`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function ProgressBar({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'gold' }) {
  const { colors } = useApp();
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.surfacePress, overflow: 'hidden' }}>
      <LinearGradient
        colors={tone === 'primary' ? colors.gradient : [colors.gold, colors.gold]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${clamped * 100}%`, height: '100%', borderRadius: radius.pill }}
      />
    </View>
  );
}

export function SectionTitle({ title, trailing }: { title: string; trailing?: ReactNode }) {
  const { colors } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: space.xs }}>
      <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 }}>{title}</Text>
      {trailing}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  const { colors, theme } = useApp();
  return (
    <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg }}>
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primarySoft,
          borderWidth: 1,
          borderColor: colors.line,
          ...elevation(theme, 2),
        }}
      >
        <Icon name={icon} size={34} color={colors.primary} strokeWidth={1.6} />
      </View>
      <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>{title}</Text>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', fontWeight: '500' }}>{body}</Text>
      {action}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useApp();
  return (
    <Tap onPress={onPress} haptic="select">
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: radius.pill,
          backgroundColor: selected ? colors.primary : colors.surfaceAlt,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.line,
        }}
      >
        <Text style={{ color: selected ? colors.onPrimary : colors.muted, fontWeight: '700', fontSize: 13 }}>{label}</Text>
      </View>
    </Tap>
  );
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  selected,
  tone,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  tone?: 'default' | 'muted';
}) {
  const { colors, theme } = useApp();
  const inner = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
        borderRadius: radius.md,
        padding: space.md,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.line,
        ...(selected ? glowShadow(colors.glow, 0.18) : elevation(theme, 1)),
      }}
    >
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: tone === 'muted' ? colors.muted : colors.ink, fontSize: 15, fontWeight: '700' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={{ color: colors.faint, fontSize: 12.5, fontWeight: '500', lineHeight: 17 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
  if (!onPress) return inner;
  return <Tap onPress={onPress}>{inner}</Tap>;
}

export function Divider() {
  const { colors } = useApp();
  return <View style={{ height: 1, backgroundColor: colors.line }} />;
}

export function ErrorBanner({ message }: { message: string }) {
  const { colors } = useApp();
  if (!message) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        backgroundColor: colors.dangerSoft,
        borderRadius: radius.sm,
        padding: space.md,
        borderWidth: 1,
        borderColor: colors.danger,
      }}
    >
      <Icon name="alert" size={17} color={colors.danger} strokeWidth={2} />
      <Text style={{ flex: 1, color: colors.danger, fontSize: 13.5, fontWeight: '600', lineHeight: 19 }}>{message}</Text>
    </View>
  );
}
