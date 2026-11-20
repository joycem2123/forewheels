import { Image } from 'expo-image';
import { View } from 'react-native';

import { T } from '@/components/ui';

const MARK_WHITE = require('../../assets/images/mark-white.png');
const MARK_VIOLET = require('../../assets/images/mark-violet.png');
const BADGE = require('../../assets/images/badge.png');

/**
 * Fore Wheels mark, "Ball-wheel": a tire wrapped around a dimpled golf ball, with a sparkle.
 * `onViolet` draws it in white for violet backgrounds; `badge` puts it in its violet app-icon square.
 */
export function LogoMark({ size = 56, onViolet, badge }: { size?: number; onViolet?: boolean; badge?: boolean }) {
  const source = badge ? BADGE : onViolet ? MARK_WHITE : MARK_VIOLET;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel="Fore Wheels Detailing">
      <Image source={source} style={{ width: size, height: size }} contentFit="contain" />
    </View>
  );
}

/** "Fore Wheels" with a small, widely spaced DETAILING underneath. */
export function Wordmark({ size = 30, color, detailing = true, center }: { size?: number; color?: string; detailing?: boolean; center?: boolean }) {
  return (
    <View style={{ alignItems: center ? 'center' : 'flex-start' }} accessibilityLabel="Fore Wheels Detailing">
      <T size={size} weight="bold" color={color} style={{ letterSpacing: -size * 0.02, lineHeight: size * 1.1 }}>Fore Wheels</T>
      {detailing && (
        <T size={Math.max(9, size * 0.32)} weight="semibold" color={color} style={{ letterSpacing: size * 0.22, marginTop: size * 0.06, opacity: 0.75, marginRight: center ? -size * 0.22 : 0 }}>
          DETAILING
        </T>
      )}
    </View>
  );
}
