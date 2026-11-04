import { Tabs } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { View, type ColorValue } from 'react-native';

import { useTheme } from '@/ui/useTheme';

function TabIcon({ name, color }: { name: SFSymbol; color: ColorValue }) {
  return (
    <SymbolView
      name={name}
      tintColor={color}
      size={24}
      fallback={<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />}
    />
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => (
            <TabIcon name="figure.strengthtraining.traditional" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color }) => <TabIcon name="list.bullet.rectangle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <TabIcon name="chart.bar.xaxis" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon name="gearshape" color={color} />,
        }}
      />
    </Tabs>
  );
}
