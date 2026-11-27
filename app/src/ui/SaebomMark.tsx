import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { SAEBOM_MARK } from '@/ui/saebom-mark';
import { useTheme } from '@/ui/useTheme';

type Props = {
  size: number;
  /** Defaults to the theme's accent. */
  color?: string;
  /**
   * Read by VoiceOver, e.g. "Saebom". Leave it out where the name is already on screen, so the
   * mark stays decorative and VoiceOver doesn't read the name twice.
   */
  label?: string;
};

/** Saebom's logo, the one-line blossom (D78), drawn from its master SVG's geometry. */
export function SaebomMark({ size, color, label }: Props) {
  const { colors } = useTheme();
  const decorative = label === undefined;

  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={SAEBOM_MARK.viewBox}>
        <Path
          d={SAEBOM_MARK.d}
          fill="none"
          stroke={color ?? colors.accent}
          strokeWidth={SAEBOM_MARK.strokeWidth}
          strokeLinecap="butt"
          strokeLinejoin="miter"
          strokeMiterlimit={SAEBOM_MARK.strokeMiterlimit}
        />
      </Svg>
    </View>
  );
}
