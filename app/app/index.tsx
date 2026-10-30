import { Text, useColorScheme, View } from 'react-native';

export default function Index() {
  const dark = useColorScheme() === 'dark';
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: dark ? '#000' : '#fff',
      }}
    >
      <Text accessibilityRole="header" style={{ fontSize: 32, color: dark ? '#fff' : '#000' }}>
        Saebom
      </Text>
    </View>
  );
}
