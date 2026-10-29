import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Card, Text } from '@/design/components';
import { DONUT_COLOURS } from '@/design/components/charts';
import tokens from '@/design/tokens.json';
import { useDesign, useTheme } from '@/design/ThemeProvider';
import { formatNaira, PRIVACY_MASK } from '@/money';
import { t } from '@/i18n';

const sp = tokens.spacing;
const c = tokens.color;
const HEIGHT = 160;
const MAX = 7; // top 6 + Other (DESIGN.md page 5)

type Point = { label: string; value: bigint };

/** Local donut so Dashboard can show 6 groups + Other without racing shared DonutChart (5-cap). */
export function WhereItWentChart({ rows, total }: { rows: Point[]; total: bigint }) {
  const theme = useTheme();
  const { privacy } = useDesign();
  const slice = rows.slice(0, MAX);
  const sum = slice.reduce((s, p) => s + (p.value > 0n ? p.value : 0n), 0n);
  const colour = (i: number) => DONUT_COLOURS[i] ?? c.hairline;
  const size = HEIGHT;

  return (
    <Card style={{ gap: sp['spacing-sm'] }}>
      <Text variant="heading-sm">{t('dashboard.whereItWent')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-lg'] }}>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
            <Circle cx={size / 2} cy={size / 2} r={size / 2 - 12} stroke={theme.border} strokeWidth={16} fill="none" />
            {(() => {
              const radius = size / 2 - 12;
              const circumference = 2 * Math.PI * radius;
              const dashes = slice.map((p) => {
                const share = sum === 0n ? 0 : Number((p.value * 10_000n) / sum) / 10_000;
                return share * circumference;
              });
              return slice.map((p, i) => {
                const dash = dashes[i]!;
                const offset = dashes.slice(0, i).reduce((s, d) => s + d, 0);
                return (
                  <Circle
                    key={p.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={colour(i)}
                    strokeWidth={16}
                    fill="none"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-offset}
                  />
                );
              });
            })()}
          </Svg>
          <Text variant="body-tabular">{privacy ? PRIVACY_MASK : formatNaira(total)}</Text>
        </View>
        <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
          {slice.map((p, i) => (
            <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'] }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colour(i) }} />
              <Text style={{ flex: 1 }}>{p.label}</Text>
              <Text style={{ fontVariant: ['tabular-nums'] }}>{privacy ? PRIVACY_MASK : formatNaira(p.value)}</Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}
