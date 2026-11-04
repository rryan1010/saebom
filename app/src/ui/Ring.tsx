import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/ui/useTheme';

type Props = {
  size: number;
  /** 0 to 1. */
  progress: number;
  /** Read by VoiceOver, e.g. "4 of 15 sets done". */
  label: string;
  strokeWidth?: number;
  children?: ReactNode;
};

/** One ring in Saebom's accent color, never nested in threes (Apple guideline 5.2.5). */
export function Ring({ size, progress, label, strokeWidth, children }: Props) {
  const { colors } = useTheme();
  const stroke = strokeWidth ?? Math.max(6, Math.round(size / 13));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const amount = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const center = size / 2;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(amount * 100) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        {amount > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.accent}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - amount)}
            fill="none"
          />
        ) : null}
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}
