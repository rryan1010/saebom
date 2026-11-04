import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SPACE, TYPE } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Props = {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
};

const REPEAT_MS = 90;

/** − value +, with press-and-hold to move fast. VoiceOver swipes it up and down. */
export function Stepper({ label, value, step, min, max, format, onChange }: Props) {
  const { colors } = useTheme();
  const latest = useRef(value);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    latest.current = value;
  }, [value]);

  useEffect(
    () => () => {
      if (repeat.current) clearInterval(repeat.current);
    },
    [],
  );

  const bump = (direction: 1 | -1) => {
    const raw = Math.round((latest.current + direction * step) * 10) / 10;
    const next = Math.min(max, Math.max(min, raw));
    if (next === latest.current) return;
    latest.current = next;
    onChange(next);
  };

  const stopRepeat = () => {
    if (repeat.current) clearInterval(repeat.current);
    repeat.current = null;
  };

  const startRepeat = (direction: 1 | -1) => {
    stopRepeat();
    bump(direction);
    repeat.current = setInterval(() => bump(direction), REPEAT_MS);
  };

  const button = (direction: 1 | -1) => {
    const atLimit = direction === 1 ? value >= max : value <= min;
    return (
      <Pressable
        importantForAccessibility="no"
        disabled={atLimit}
        onPress={() => bump(direction)}
        onLongPress={() => startRepeat(direction)}
        onPressOut={stopRepeat}
        delayLongPress={350}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: atLimit ? 0.35 : pressed ? 0.6 : 1,
        })}
      >
        <Text style={[TYPE.title, { color: colors.text, lineHeight: 30 }]}>
          {direction === 1 ? '+' : '−'}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => bump(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={{ flex: 1, gap: SPACE.xs }}
    >
      <Text style={[TYPE.caption, { color: colors.textSecondary }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
        {button(-1)}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            TYPE.title,
            { flex: 1, color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
          ]}
        >
          {format(value)}
        </Text>
        {button(1)}
      </View>
    </View>
  );
}
