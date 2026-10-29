import {
  Baby,
  Banknote,
  Bus,
  Car,
  Coffee,
  Gift,
  Heart,
  Home,
  Landmark,
  PiggyBank,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Utensils,
  Wallet,
  Wifi,
  type LucideIcon,
} from 'lucide-react-native';

/** Curated Lucide set for PU-11 icon grid. */
export const CATEGORY_ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: 'Home', Icon: Home },
  { name: 'ShoppingCart', Icon: ShoppingCart },
  { name: 'ShoppingBasket', Icon: ShoppingBasket },
  { name: 'Utensils', Icon: Utensils },
  { name: 'Coffee', Icon: Coffee },
  { name: 'Car', Icon: Car },
  { name: 'Bus', Icon: Bus },
  { name: 'Heart', Icon: Heart },
  { name: 'Baby', Icon: Baby },
  { name: 'Gift', Icon: Gift },
  { name: 'PiggyBank', Icon: PiggyBank },
  { name: 'Wallet', Icon: Wallet },
  { name: 'Banknote', Icon: Banknote },
  { name: 'Landmark', Icon: Landmark },
  { name: 'Smartphone', Icon: Smartphone },
  { name: 'Wifi', Icon: Wifi },
];

export function categoryIconByName(name: string | null | undefined): LucideIcon {
  return CATEGORY_ICONS.find((i) => i.name === name)?.Icon ?? ShoppingBasket;
}

export function defaultIconForName(name: string): string {
  const n = name.toLowerCase();
  if (/rent|home|house|mortgage/.test(n)) return 'Home';
  if (/fuel|transport|uber|car/.test(n)) return 'Car';
  if (/food|market|grocer|shop/.test(n)) return 'ShoppingBasket';
  if (/salary|income|pay/.test(n)) return 'Banknote';
  if (/save|goal|emerg/.test(n)) return 'PiggyBank';
  if (/gift/.test(n)) return 'Gift';
  if (/phone|data|airtime/.test(n)) return 'Smartphone';
  return 'ShoppingBasket';
}
