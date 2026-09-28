import { BlurView } from 'expo-blur';
import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, PanResponder, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './app-state';
import { Icon, type IconName } from './icons';
import { radius, space } from './theme';
import { Button, buzz } from './ui';

const SNAP_MS = 260;

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const { colors, theme, direction, t } = useApp();
  const insets = useSafeAreaInsets();
  const [slide] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  const [drag] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(open);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMounted(true);
  }

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.spring(slide, { toValue: 1, useNativeDriver: true, friction: 9, tension: 80 }),
        Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
      return;
    }
    if (!mounted) return;
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: SNAP_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: SNAP_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [open, mounted, slide, fade]);

  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6,
    onPanResponderMove: (_, gesture) => {
      if (gesture.dy > 0) drag.setValue(gesture.dy);
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 110 || gesture.vy > 0.7) {
        buzz('select');
        onClose();
        return;
      }
      Animated.spring(drag, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    },
  });

  if (!mounted) return null;

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [520, 0], extrapolate: 'clamp' });
  const blurBackdrop = Platform.OS === 'ios' || Platform.OS === 'web';

  return (
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, direction, justifyContent: 'flex-end', zIndex: 50 }}>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity: fade }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('close')} onPress={onClose} style={{ flex: 1 }}>
          {blurBackdrop ? (
            <BlurView
              intensity={46}
              tint={theme === 'dark' ? 'dark' : 'light'}
              style={{ flex: 1, backgroundColor: colors.overlay }}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: colors.overlay }} />
          )}
        </Pressable>
      </Animated.View>

      <Animated.View
        style={{
          transform: [{ translateY: Animated.add(translateY, drag) }],
          backgroundColor: colors.surface,
          borderTopStartRadius: radius.xl,
          borderTopEndRadius: radius.xl,
          borderWidth: 1,
          borderBottomWidth: 0,
          borderColor: colors.line,
          paddingBottom: Math.max(insets.bottom, space.lg),
          maxHeight: '86%',
          overflow: 'hidden',
        }}
      >
        <View {...pan.panHandlers} style={{ alignItems: 'center', paddingTop: space.md, paddingBottom: space.sm }}>
          <View style={{ width: 42, height: 5, borderRadius: radius.pill, backgroundColor: colors.surfacePress }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.xl, paddingBottom: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 }}>{title}</Text>
            {subtitle ? (
              <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 20, fontWeight: '500', marginTop: 4 }}>{subtitle}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            onPress={onClose}
            hitSlop={10}
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <Icon name="close" size={16} color={colors.muted} strokeWidth={2.2} />
          </Pressable>
        </View>

        {children ? (
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: space.xl, gap: space.md, paddingBottom: space.md }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : null}

        {footer ? <View style={{ paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.sm }}>{footer}</View> : null}
      </Animated.View>
    </View>
  );
}

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel,
  icon = 'alert',
  tone = 'primary',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  icon?: IconName;
  tone?: 'primary' | 'danger';
}) {
  const { colors } = useApp();
  const accent = tone === 'danger' ? colors.danger : colors.primary;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button
            label={confirmLabel}
            tone={tone === 'danger' ? 'danger' : 'primary'}
            size="lg"
            icon={icon}
            onPress={() => {
              buzz(tone === 'danger' ? 'warn' : 'success');
              onClose();
              onConfirm();
            }}
          />
          <Button label={cancelLabel} tone="ghost" onPress={onClose} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
        <View
          style={{
            width: 68,
            height: 68,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tone === 'danger' ? colors.dangerSoft : colors.primarySoft,
          }}
        >
          <Icon name={icon} size={28} color={accent} strokeWidth={1.8} />
        </View>
        <Text style={{ color: colors.muted, fontSize: 14.5, lineHeight: 22, textAlign: 'center', fontWeight: '500' }}>{body}</Text>
      </View>
    </Sheet>
  );
}
