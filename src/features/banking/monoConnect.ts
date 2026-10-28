import { Platform } from 'react-native';

import { config } from '@/config';

/**
 * Mono Connect (TECH-SPEC 5.8): the person signs in to their bank on Mono's own screen, and the app receives a
 * one-time code the API exchanges. Web loads Mono's widget; phones need Mono's native module (prototype T0.7), so
 * Connect bank is hidden there until that's proven.
 */
const SCRIPT = 'https://connect.withmono.com/connect.js';

type MonoWidget = { setup: () => void; open: () => void; reauthorise?: (token: string) => void };
type MonoCtor = new (opts: { key: string; onSuccess: (r: { code: string }) => void; onClose?: () => void }) => MonoWidget;

export function bankConnectAvailable(): boolean {
  return Platform.OS === 'web' && !!config.monoPublicKey;
}

function loadScript(): Promise<MonoCtor> {
  const w = window as unknown as { MonoConnect?: MonoCtor };
  if (w.MonoConnect) return Promise.resolve(w.MonoConnect);
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT;
    el.async = true;
    el.onload = () => (w.MonoConnect ? resolve(w.MonoConnect) : reject(new Error('mono_unavailable')));
    el.onerror = () => reject(new Error('mono_unavailable'));
    document.head.appendChild(el);
  });
}

/** Opens Mono's screen; resolves with the code, or null if the person closed it. A reauth token reconnects a lapsed bank. */
export async function openMonoConnect(reauthToken?: string): Promise<string | null> {
  if (!config.monoPublicKey) return null;
  const Mono = await loadScript();
  return new Promise((resolve) => {
    let done = false;
    const widget = new Mono({
      key: config.monoPublicKey!,
      onSuccess: ({ code }) => {
        done = true;
        resolve(code);
      },
      onClose: () => {
        if (!done) resolve(null);
      },
    });
    if (reauthToken && widget.reauthorise) widget.reauthorise(reauthToken);
    else widget.setup();
    widget.open();
  });
}
