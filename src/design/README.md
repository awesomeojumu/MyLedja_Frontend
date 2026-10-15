# MyLedja Design System for React Native

The same system as the web bundle, for the Expo / React Native app: 43 components with the same names and props, plus tokens, theme, money helpers, motion and haptics. Everything is generated from or follows `tokens.json`.

## Install in the app

Copy this `native/` folder into the app (for example `src/design/`), then add the dependencies:

```bash
npx expo install react-native-svg react-native-safe-area-context expo-haptics expo-font @expo-google-fonts/inter
npm install lucide-react-native@0.460.0
```

Load Inter and wrap the app once:

```tsx
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './design';

export default function App() {
  const [ready] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider font={settings.font /* 'inter' | 'system' */} haptics={settings.haptics}>
        <Root />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

## What is here

| File | Holds |
|---|---|
| `tokens.ts` | Colours for light and dark, type styles, spacing, radii, sizes, breakpoints, durations, springs, haptic map. Generated from `tokens.json`; do not edit by hand. |
| `theme.tsx` | `ThemeProvider` and `useTheme()`: follows the phone’s light/dark setting, the person’s font choice, reduce-motion, and the width class (compact, medium, expanded, large). |
| `format.ts` | `formatMoney`, `cleanAmount`, `toKobo`, the category map and lists. The only place money is formatted. |
| `motion.tsx` | `SpringPressable`, `Rise`, `useRollingNumber`. Transform and opacity only, native driver, instant under reduce-motion. |
| `haptics.ts` | `haptic('select' \| 'start' \| 'success' \| 'warning' \| 'error')`, following the brand book’s map. |
| `icons.ts` | The 74 Lucide icons MyLedja uses. Add new ones here. |
| `components/` | Foundations, actions, surfaces, inputs, money, data, navigation. |

## Components

Logo, LogoMark, Txt, Icon, CategoryIcon, Avatar, Badge, StatusBadge · Button, IconButton, SegmentedControl, Tabs, Chip, ChipGroup, FilterButton · Card, SectionHeader, Sheet, Dialog, Banner, Toast, EmptyState, Skeleton · TextField, AmountInput, AmountDisplay, Select, CategoryPicker, DatePicker · Amount, HeroBalance, StatTile, SummaryCard, ProgressBar, ProgressRing, BudgetTile, TransactionRow, TransactionDetail · CategoryBreakdown, BarChart, LineChart, DataTable · BottomNav, NavRail, Sidebar.

Differences from the web bundle, because phones work differently:

- Handlers are `onPress` instead of `onClick`.
- `Sheet` and `Dialog` take `open` and render in a native modal: a bottom sheet on phones, a centred pop-up on tablets. Android back closes them.
- `Select` and `CategoryPicker` open their lists in a `Sheet` (there is no native drop-down).
- `TextField` uses `onChangeText`; `AmountDisplay` uses the phone’s decimal keyboard and gives back a clean decimal string.
- `Txt` is the text primitive: every string goes through it so type tokens and font choice apply.

## Status

Type-checked with TypeScript (strict) against React Native 0.76, react-native-svg 15, lucide-react-native 0.460 and expo-haptics 14. Not yet run on a device: run it on one low-end Android and one iPhone before the first sprint review, and report anything that differs from the designs back into this system.
