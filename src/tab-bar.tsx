import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from './app-state';
import { Icon, type IconName } from './icons';
import { elevation, glowShadow, radius } from './theme';
import { Tap } from './ui';

const TAB_ICONS: Record<string, IconName> = {
  index: 'home',
  members: 'users',
  month: 'calendar',
  spin: 'wheel',
  history: 'history',
};

function centered<T extends { name: string }>(routes: T[]): T[] {
  const spin = routes.find((route) => route.name === 'spin');
  const rest = routes.filter((route) => route.name !== 'spin');
  const middle = Math.ceil(rest.length / 2);
  return [...rest.slice(0, middle), ...(spin ? [spin] : []), ...rest.slice(middle)];
}

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

export function KeshtTabBar({ state, descriptors, navigation }: TabBarProps) {
  const { colors, theme, direction } = useApp();
  const insets = useSafeAreaInsets();
  const dark = theme === 'dark';

  return (
    <View
      style={{
        direction,
        backgroundColor: 'transparent',
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 10),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          paddingVertical: 8,
          paddingHorizontal: 8,
          borderWidth: 1,
          borderColor: colors.line,
          ...elevation(theme, 3),
        }}
      >
        {centered(state.routes).map((route) => {
          const focused = state.routes[state.index]?.key === route.key;
          const title = descriptors[route.key].options.title ?? route.name;
          const icon = TAB_ICONS[route.name] ?? 'home';
          const isCenter = route.name === 'spin';

          if (isCenter) {
            return (
              <View key={route.key} style={{ flex: 1, alignItems: 'center' }}>
                <Tap
                  accessibilityRole="tab"
                  accessibilityLabel={title}
                  onPress={() => {
                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!event.defaultPrevented) navigation.navigate(route.name);
                  }}
                  haptic="select"
                >
                  <View
                    style={{
                      marginTop: -26,
                      borderRadius: radius.pill,
                      padding: 3,
                      backgroundColor: colors.surface,
                      ...glowShadow(colors.glow, dark ? 0.55 : 0.3),
                    }}
                  >
                    <LinearGradient
                      colors={colors.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: radius.pill,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name={icon} size={26} color={colors.onPrimary} strokeWidth={2} />
                    </LinearGradient>
                  </View>
                </Tap>
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 4,
                    color: focused ? colors.primary : colors.faint,
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 0.2,
                  }}
                >
                  {title}
                </Text>
              </View>
            );
          }

          return (
            <View key={route.key} style={{ flex: 1 }}>
              <Tap
                accessibilityRole="tab"
                accessibilityLabel={title}
                haptic="select"
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
              >
                <View
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    paddingVertical: 9,
                    paddingHorizontal: 4,
                    borderRadius: radius.md,
                    backgroundColor: focused ? colors.primarySoft : 'transparent',
                  }}
                >
                  <Icon name={icon} size={21} color={focused ? colors.primary : colors.faint} strokeWidth={focused ? 2.1 : 1.7} />
                  <Text
                    numberOfLines={1}
                    style={{
                      color: focused ? colors.primary : colors.faint,
                      fontSize: 10,
                      fontWeight: focused ? '800' : '600',
                      letterSpacing: 0.1,
                    }}
                  >
                    {title}
                  </Text>
                </View>
              </Tap>
            </View>
          );
        })}
      </View>
    </View>
  );
}
