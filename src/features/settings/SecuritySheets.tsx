import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Share, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';

import { ApiError } from '@/api/client';
import { type RestorePreview, securityApi } from '@/api/security';
import { Button, Checkbox, CodeInput, Confirm, InlineError, Sheet, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useAuth } from '@/features/auth/AuthProvider';
import { passkeyAssertion, passkeyRegistration, passkeysAvailable } from '@/features/auth/passkey';
import { t } from '@/i18n';

const sp = tokens.spacing;

export function useSecurityApi() {
  const { client } = useAuth();
  return useMemo(() => securityApi(client), [client]);
}

const messageOf = (e: unknown) => (e instanceof ApiError && e.body?.message ? e.body.message : t('errors.network'));

/** Saves text as a file on web, or opens the share sheet on a phone. */
export async function saveText(filename: string, content: string, mimeType: string) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: filename, message: content });
}

async function copyText(text: string) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) await navigator.clipboard.writeText(text);
  else await Share.share({ message: text });
}

/**
 * Sensitive actions ask again after 15 minutes (DESIGN.md 10.6). `guard` runs an action; when the server answers
 * recheck_needed it opens "Confirm it's you" and runs the action again once the person has confirmed.
 */
export function useRecheck() {
  const api = useSecurityApi();
  const pending = useRef<(() => Promise<void>) | null>(null);
  const [open, setOpen] = useState(false);

  const guard = useCallback(async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403 && e.body?.code === 'recheck_needed') {
        pending.current = action;
        setOpen(true);
        return;
      }
      throw e;
    }
  }, []);

  const sheet = (
    <RecheckSheet
      visible={open}
      onClose={() => {
        setOpen(false);
        pending.current = null;
      }}
      onConfirmed={async () => {
        setOpen(false);
        const action = pending.current;
        pending.current = null;
        if (action) await action();
      }}
      api={api}
    />
  );
  return { guard, sheet };
}

function RecheckSheet({
  visible,
  onClose,
  onConfirmed,
  api,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirmed: () => Promise<void>;
  api: ReturnType<typeof securityApi>;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (confirm: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await confirm();
      setPassword('');
      await onConfirmed();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 401 ? t('security.recheckWrong') : messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title={t('security.recheckTitle')}
      onClose={onClose}
      testID="recheck-sheet"
      footer={<Button testID="recheck-confirm" label={t('security.recheckConfirm')} disabled={busy || !password} onPress={() => void run(() => api.recheck({ password }))} />}
    >
      <Text tone="textSecondary">{t('security.recheckBody')}</Text>
      <TextInput testID="recheck-password" label={t('auth.password')} value={password} onChangeText={setPassword} secure autoComplete="current-password" />
      {error ? <InlineError message={error} /> : null}
      {passkeysAvailable() ? (
        <Button
          kind="link"
          label={t('security.recheckPasskey')}
          onPress={() =>
            void run(async () => {
              const { challengeToken, options } = await api.recheckPasskeyOptions();
              await api.recheck({ challengeToken, response: await passkeyAssertion(options) });
            })
          }
        />
      ) : null}
    </Sheet>
  );
}

/** #52 Set up two-factor: QR code, "Can't scan? Copy key", 6-digit confirm; then #53 shows the backup codes. */
export function TwoFactorSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: (codes: string[]) => void }) {
  const api = useSecurityApi();
  const toast = useToast();
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState(false);

  if (visible !== loadedFor) {
    setLoadedFor(visible);
    if (visible) {
      setSetup(null);
      setCode('');
      setError(null);
      api.twoFactorSetup().then(setSetup, (e: unknown) => setError(messageOf(e)));
    }
  }

  const confirm = async (entered = code) => {
    setBusy(true);
    setError(null);
    try {
      const { backupCodes } = await api.twoFactorConfirm(entered);
      toast.show(t('settings.security.twoFactorTurnedOn'));
      onDone(backupCodes);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title={t('settings.popup.twoFactorTitle')}
      onClose={onClose}
      testID="settings-2fa-sheet"
      footer={<Button label={t('settings.popup.twoFactorConfirm')} disabled={busy || code.length !== 6} onPress={() => void confirm()} />}
    >
      <Text tone="textSecondary">{t('settings.popup.twoFactorBody')}</Text>
      {setup ? (
        <View style={{ alignItems: 'center', gap: sp['spacing-sm'] }}>
          <View style={{ backgroundColor: tokens.color.canvas, padding: sp['spacing-sm'], borderRadius: tokens.radius['rounded-md'] }} accessibilityLabel={t('settings.popup.twoFactorQrPlaceholder')}>
            <SvgXml xml={setup.qrSvg} width={180} height={180} />
          </View>
          <Button
            kind="link"
            label={t('settings.popup.twoFactorCopyKey')}
            onPress={() => void copyText(setup.secret).then(() => toast.show(t('settings.popup.twoFactorCopied')))}
          />
          <Text variant="caption" tone="textSecondary" selectable>
            {setup.secret}
          </Text>
        </View>
      ) : null}
      <CodeInput
        testID="settings-2fa-code"
        value={code}
        onChange={(next) => {
          setCode(next);
          if (next.length === 6) void confirm(next);
        }}
      />
      {error ? <InlineError message={error} /> : null}
    </Sheet>
  );
}

/** #53 Backup codes: 10 codes, Copy / Download, "I've saved them". */
export function BackupCodesSheet({ codes, onClose }: { codes: string[] | null; onClose: () => void }) {
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const text = (codes ?? []).join('\n');
  return (
    <Sheet
      visible={codes !== null}
      title={t('settings.popup.backupCodesTitle')}
      onClose={onClose}
      testID="settings-backup-codes-sheet"
      footer={
        <Button
          label={t('settings.popup.backupCodesDone')}
          disabled={!saved}
          onPress={() => {
            setSaved(false);
            onClose();
          }}
        />
      }
    >
      <Text tone="textSecondary">{t('settings.popup.backupCodesBody')}</Text>
      <ScrollView style={{ maxHeight: 220 }}>
        {(codes ?? []).map((c) => (
          <Text key={c} style={{ fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }} selectable>
            {c}
          </Text>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
        <Button kind="secondary" label={t('settings.popup.backupCodesCopy')} onPress={() => void copyText(text).then(() => toast.show(t('settings.popup.backupCodesCopied')))} />
        <Button kind="secondary" label={t('settings.popup.backupCodesDownload')} onPress={() => void saveText('myledja-backup-codes.txt', text, 'text/plain')} />
      </View>
      <Checkbox testID="settings-backup-saved" label={t('settings.popup.backupCodesSaved')} checked={saved} onChange={setSaved} />
    </Sheet>
  );
}

/** #54 Add passkey: name the device, then the system's own passkey prompt. */
export function PasskeySheet({ visible, onClose, onAdded }: { visible: boolean; onClose: () => void; onAdded: () => void }) {
  const api = useSecurityApi();
  const toast = useToast();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const { challengeToken, options } = await api.passkeyAddOptions();
      const response = await passkeyRegistration(options);
      await api.passkeyAdd({ challengeToken, response, name: name.trim() });
      toast.show(t('settings.security.passkeyAdded'));
      setName('');
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? messageOf(e) : t('signIn.passkeyFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title={t('settings.popup.passkeyTitle')}
      onClose={onClose}
      testID="settings-passkey-sheet"
      footer={<Button label={t('settings.popup.passkeyAdd')} disabled={busy || !name.trim()} onPress={() => void add()} />}
    >
      <Text tone="textSecondary">{t('settings.popup.passkeyBody')}</Text>
      <TextInput testID="settings-passkey-name" label={t('settings.popup.passkeyName')} value={name} onChangeText={setName} />
      {error ? <InlineError message={error} /> : null}
    </Sheet>
  );
}

/** Change password: other devices are signed out (DESIGN page 26, P03 done state). */
export function ChangePasswordSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const api = useSecurityApi();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.changePassword({ currentPassword: current, newPassword: next });
      toast.show(t('settings.security.passwordChanged'));
      setCurrent('');
      setNext('');
      onClose();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title={t('settings.security.changePassword')}
      onClose={onClose}
      testID="change-password-sheet"
      footer={<Button label={t('settings.security.changePassword')} disabled={busy || !current || next.length < 10} onPress={() => void save()} />}
    >
      <TextInput label={t('settings.security.currentPassword')} value={current} onChangeText={setCurrent} secure autoComplete="current-password" />
      <TextInput label={t('settings.security.newPassword')} value={next} onChangeText={setNext} secure autoComplete="new-password" />
      {error ? <InlineError message={error} /> : null}
    </Sheet>
  );
}

async function pickBackupText(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (asset.file) return asset.file.text();
  return (await fetch(asset.uri)).text();
}

/** #55 Restore backup: pick a file, see what's inside, confirm. It restores into a new workspace (TECH-SPEC 11). */
export function RestoreBackupSheet({ visible, onClose, guard }: { visible: boolean; onClose: () => void; guard: (action: () => Promise<void>) => Promise<void> }) {
  const api = useSecurityApi();
  const toast = useToast();
  const [content, setContent] = useState<string | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const text = await pickBackupText();
    if (!text) return;
    try {
      setPreview(await api.restorePreview(text));
      setContent(text);
    } catch (e) {
      setError(messageOf(e));
    }
  };

  const reset = () => {
    setContent(null);
    setPreview(null);
    setError(null);
  };

  return (
    <>
      <Sheet
        visible={visible}
        title={t('settings.popup.restoreTitle')}
        onClose={() => {
          reset();
          onClose();
        }}
        testID="settings-restore-sheet"
        footer={
          preview ? (
            <Button label={t('settings.popup.restoreConfirm')} onPress={() => setConfirmOpen(true)} />
          ) : (
            <Button kind="secondary" label={t('settings.popup.restorePick')} onPress={() => void pick()} />
          )
        }
      >
        <Text tone="textSecondary">{t('settings.popup.restoreBody')}</Text>
        {preview ? (
          <Text variant="caption" tone="textSecondary">
            {t('settings.popup.restoreSummary', {
              date: new Date(preview.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
              accounts: String(preview.accounts),
              transactions: String(preview.transactions),
            })}
          </Text>
        ) : null}
        {error ? <InlineError message={error} /> : null}
      </Sheet>
      <Confirm
        visible={confirmOpen}
        title={t('settings.popup.restoreConfirmTitle')}
        body={t('settings.popup.restoreConfirmBody')}
        confirmLabel={t('settings.popup.restoreConfirm')}
        onConfirm={() => {
          setConfirmOpen(false);
          if (!content) return;
          void guard(async () => {
            const done = await api.restore(content);
            toast.show(t('settings.popup.restoreDone', { name: done.workspaceName }));
            reset();
            onClose();
          }).catch((e: unknown) => setError(messageOf(e)));
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
