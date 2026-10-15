/* MyLedja Design System: tokens for React Native. Generated from tokens.json; do not edit by hand. */
export const colors = {
  "light": {
    "bg": "#f6f7fa",
    "surface": "#ffffff",
    "surfaceAlt": "#eef1f6",
    "border": "#dde2eb",
    "borderStrong": "#7a8499",
    "ink": "#131a2b",
    "inkMuted": "#4f5a70",
    "primary": "#1e3c8f",
    "primaryHover": "#172f73",
    "onPrimary": "#ffffff",
    "primarySoft": "#e6ecfa",
    "onPrimarySoft": "#1e3c8f",
    "focus": "#2558d9",
    "positive": "#16794a",
    "positiveSoft": "#e3f3ea",
    "warning": "#975a00",
    "warningSoft": "#fcf0d9",
    "danger": "#b3261e",
    "dangerSoft": "#fbe8e5",
    "negative": "#c0362c",
    "transfer": "#5a4fb0",
    "transferSoft": "#eeecfa",
    "chart1": "#1e3c8f",
    "chart2": "#5b8def",
    "chart3": "#77839f",
    "scrim": "rgba(13,17,28,0.48)",
    "hero": "#1e3c8f",
    "onHero": "#ffffff",
    "onHeroMuted": "#c9d5f5",
    "heroDeco": "#2a4ba6",
    "catOrange": "#a84d08",
    "catOrangeSoft": "#fdeedc",
    "catTeal": "#0f766e",
    "catTealSoft": "#d9f3ef",
    "catPink": "#be185d",
    "catPinkSoft": "#fce4ef",
    "catGold": "#8a6100",
    "catGoldSoft": "#fbf0c9",
    "catGreen": "#2b7330",
    "catGreenSoft": "#e2f3e1",
    "catPurple": "#6d3fc0",
    "catPurpleSoft": "#eee6fb",
    "catSky": "#0b6aa8",
    "catSkySoft": "#dcefff",
    "catSlate": "#475569",
    "catSlateSoft": "#e8ecf1"
  },
  "dark": {
    "bg": "#0d111c",
    "surface": "#151a28",
    "surfaceAlt": "#1c2234",
    "border": "#2a3249",
    "borderStrong": "#6b7694",
    "ink": "#e9edf6",
    "inkMuted": "#a4aec3",
    "primary": "#8ba7f3",
    "primaryHover": "#a7bdf7",
    "onPrimary": "#0b1638",
    "primarySoft": "#1c2a57",
    "onPrimarySoft": "#c3d2fa",
    "focus": "#93b4ff",
    "positive": "#5ccb93",
    "positiveSoft": "#123123",
    "warning": "#f1b552",
    "warningSoft": "#33270f",
    "danger": "#f48c7b",
    "dangerSoft": "#3a1b17",
    "negative": "#f0907f",
    "transfer": "#b1a8f2",
    "transferSoft": "#251f4a",
    "chart1": "#8ba7f3",
    "chart2": "#4f78d6",
    "chart3": "#7a86a6",
    "scrim": "rgba(0,0,0,0.6)",
    "hero": "#22397f",
    "onHero": "#ffffff",
    "onHeroMuted": "#c3cff0",
    "heroDeco": "#2c4794",
    "catOrange": "#f6a35c",
    "catOrangeSoft": "#3a2414",
    "catTeal": "#4fd1c1",
    "catTealSoft": "#10302d",
    "catPink": "#f48fbf",
    "catPinkSoft": "#3a1528",
    "catGold": "#e9c35a",
    "catGoldSoft": "#352a0c",
    "catGreen": "#7fd38a",
    "catGreenSoft": "#15301a",
    "catPurple": "#b89af5",
    "catPurpleSoft": "#2a1f45",
    "catSky": "#6fb8f0",
    "catSkySoft": "#0f2a3f",
    "catSlate": "#aab6c8",
    "catSlateSoft": "#232a36"
  }
} as const;

export type ColorScheme = keyof typeof colors;
export type ColorTokens = { [K in keyof typeof colors.light]: string };

export const space = {
  "space1": 4.0,
  "space2": 8.0,
  "space3": 12.0,
  "space4": 16.0,
  "space5": 20.0,
  "space6": 24.0,
  "space8": 32.0,
  "space12": 48.0
} as const;

export const radius = {
  "radiusSm": 10.0,
  "radiusMd": 14.0,
  "radiusLg": 20.0,
  "radiusXl": 28.0,
  "radiusFull": 999.0
} as const;

export const size = {
  "controlSm": 32.0,
  "controlMd": 40.0,
  "controlLg": 48.0,
  "touchTarget": 44.0,
  "navBottom": 64.0,
  "navRail": 80.0,
  "navSidebar": 248.0
} as const;

export const breakpoint = {
  "bpMedium": 600.0,
  "bpExpanded": 900.0,
  "bpLarge": 1200.0,
  "bpXlarge": 1600.0
} as const;

export const maxWidth = {
  "widthForm": 560.0,
  "widthReading": 720.0,
  "widthContent": 1200.0,
  "widthWide": 1560.0
} as const;

export const duration = { fast: 120, base: 200, slow: 320, roll: 520 } as const;

/** Named springs (Animated.spring config). Same feel on every screen. */
export const spring = {
  press: { stiffness: 500, damping: 30, mass: 1 },
  pop: { stiffness: 380, damping: 18, mass: 1 },
  sheet: { stiffness: 260, damping: 28, mass: 1 },
  settle: { stiffness: 180, damping: 26, mass: 1 },
} as const;

/** Which haptic each moment gets. See haptics.ts. */
export const hapticMap = {
  select: 'selection', start: 'light', success: 'success', warning: 'warning', error: 'error',
} as const;

export const type = {
  "amountHero": {
    "fontSize": 36.0,
    "lineHeight": 42.0,
    "fontWeight": "700",
    "letterSpacing": -0.9,
    "fontVariant": [
      "tabular-nums"
    ]
  },
  "amountLg": {
    "fontSize": 22.0,
    "lineHeight": 28.0,
    "fontWeight": "600",
    "letterSpacing": -0.22,
    "fontVariant": [
      "tabular-nums"
    ]
  },
  "amountMd": {
    "fontSize": 15.0,
    "lineHeight": 20.0,
    "fontWeight": "600",
    "fontVariant": [
      "tabular-nums"
    ]
  },
  "amountSm": {
    "fontSize": 13.0,
    "lineHeight": 18.0,
    "fontWeight": "500",
    "fontVariant": [
      "tabular-nums"
    ]
  },
  "titleLg": {
    "fontSize": 24.0,
    "lineHeight": 30.0,
    "fontWeight": "700",
    "letterSpacing": -0.24
  },
  "titleMd": {
    "fontSize": 17.0,
    "lineHeight": 24.0,
    "fontWeight": "600"
  },
  "titleSm": {
    "fontSize": 15.0,
    "lineHeight": 20.0,
    "fontWeight": "600"
  },
  "body": {
    "fontSize": 15.0,
    "lineHeight": 22.0,
    "fontWeight": "400"
  },
  "bodySm": {
    "fontSize": 13.0,
    "lineHeight": 18.0,
    "fontWeight": "400"
  },
  "label": {
    "fontSize": 13.0,
    "lineHeight": 16.0,
    "fontWeight": "500"
  },
  "caption": {
    "fontSize": 12.0,
    "lineHeight": 16.0,
    "fontWeight": "400"
  },
  "overline": {
    "fontSize": 11.0,
    "lineHeight": 14.0,
    "fontWeight": "600",
    "letterSpacing": 0.66
  }
} as const;

export type TypeStyle = keyof typeof type;
