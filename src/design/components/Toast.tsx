import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { t } from '@/i18n';
import tokens from '../tokens.json';
import { useTheme } from '../ThemeProvider';
import { useSizeClass } from '../size';
import { Button } from './Button';
import { Text } from './Text';

type ToastItem = { id: number; message: string; onUndo?: () => void };
type ToastApi = { show: (message: string, onUndo?: () => void) => void };

const Ctx = createContext<ToastApi | null>(null);
const MAX = 3;
export const TOAST_MS = 4000;
export const TOAST_UNDO_MS = 8000;

/** Confirmations only. Errors never go here (DESIGN.md 2.12). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const phone = useSizeClass() === 'phone';
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((x) => x.id !== id)), []);
  const show = useCallback(
    (message: string, onUndo?: () => void) => {
      const id = nextId.current++;
      setItems((all) => [...all, { id, message, onUndo }].slice(-MAX));
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        dismiss(id);
      }, onUndo ? TOAST_UNDO_MS : TOAST_MS);
      timers.current.add(timer);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <View
        pointerEvents="box-none"
        accessibilityLiveRegion="polite"
        style={{
          position: 'absolute',
          bottom: tokens.spacing['spacing-xl'] + (phone ? tokens.frame['bottom-bar'] : 0),
          right: phone ? undefined : tokens.spacing['spacing-xl'],
          left: phone ? 0 : undefined,
          width: phone ? '100%' : undefined,
          alignItems: 'center',
          gap: tokens.spacing['spacing-sm'],
        }}
      >
        {items.map((item) => (
          <View
            key={item.id}
            testID="toast"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: tokens.spacing['spacing-md'],
              backgroundColor: theme.card,
              borderRadius: tokens.radius['rounded-lg'],
              paddingHorizontal: tokens.spacing['spacing-lg'],
              paddingVertical: tokens.spacing['spacing-sm'],
              boxShadow: tokens.elevation['elevation-2'],
            }}
          >
            <Text>{item.message}</Text>
            {item.onUndo ? (
              <Button
                kind="link"
                accessibilityRole="button"
                label={t('common.undo')}
                onPress={() => {
                  item.onUndo?.();
                  dismiss(item.id);
                }}
              />
            ) : null}
          </View>
        ))}
      </View>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('ToastProvider missing');
  return v;
}
