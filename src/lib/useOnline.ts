import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** Web reads the browser's connection state; phones get a real network listener in Phase 1 (F1.1). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.onLine !== false : true,
  );
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
