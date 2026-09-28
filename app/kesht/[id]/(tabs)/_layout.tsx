import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { KeshtTabBar } from '../../../../src/tab-bar';
import { useApp } from '../../../../src/app-state';

export default function KeshtTabs() {
  const { t, colors } = useApp();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <Tabs
      tabBar={(props) => <KeshtTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 108,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabOverview') }} />
      <Tabs.Screen name="members" options={{ title: t('tabPeople') }} />
      <Tabs.Screen name="month" options={{ title: t('tabMonth') }} />
      <Tabs.Screen name="spin" options={{ title: t('tabSpin') }} />
      <Tabs.Screen name="history" options={{ title: t('tabHistory') }} />
    </Tabs>
    </View>
  );
}
