import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, Share, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import * as DocumentPicker from 'expo-document-picker';

import { ApiError } from '@/api/client';
import { type RestorePreview, securityApi } from '@/api/security';
import { Button, Checkbox, CodeInput, Confirm, Footer, InlineError, Sheet, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useAuth } from '@/features/auth/AuthProvider';
import { PasswordStrength } from '@/features/auth/PasswordStrength';
import { checkPassword, EMAIL_PATTERN } from '@/features/auth/password';
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

function defaultDeviceName(): string {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    if (/Mac/i.test(ua)) return 'Mac';
    if (/Windows/i.test(ua)) return 'Windows PC';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad/i.test(ua)) return 'iPhone';
    return 'This browser';
  }
  if (Platform.OS === 'ios') return 'iPhone';
  if (Platform.OS === 'android') return 'Android';
  return 'This device';
}

/**
 * Sensitive actions ask again after 15 minutes (PU-57 / DESIGN.md 10.6).
 * `guard` runs an action; when the server answers recheck_needed it opens "Confirm it's you"
 * and runs the action again once the person has confirmed.
 */
export function useRecheck(opts?: { actionLabel?: string; googleOnly?: boolean }) {
  const api = useSecurityApi();
  const pending = useRef<(() => Promise<void>) | null>(null);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(opts?.actionLabel ?? t('security.recheckActionDefault'));

  const guard = useCallback(async (action: () => Promise<void>, forAction?: string) => {
    try {
      await action();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403 && e.body?.code === 'recheck_needed') {
        pending.current = action;
        if (forAction) setLabel(forAction);
        setOpen(true);
        return;
      }
      throw e;
    }
  }, []);

  const sheet = (
    <RecheckSheet
      visible={open}
      actionLabel={label}
      googleOnly={opts?.googleOnly}
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
  actionLabel,
  googleOnly = false,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirmed: () => Promise<void>;
  api: ReturnType<typeof securityApi>;
  actionLabel: string;
  /** Accounts made with Google and no password (PU-57). */
  googleOnly?: boolean;
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
      width={420}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="recheck-confirm"
            label={t('security.recheckContinue')}
            disabled={busy || (googleOnly ? false : !password)}
            onPress={() =>
              void run(() => (googleOnly ? api.recheckGoogle() : api.recheck({ password })))
            }
          />
        </Footer>
      }
    >
      <Text tone="textSecondary">{t('security.recheckBodyFor', { action: actionLabel })}</Text>
      {googleOnly ? (
        <Text tone="textSecondary">{t('security.recheckGoogle')}</Text>
      ) : (
        <TextInput testID="recheck-password" label={t('auth.password')} value={password} onChangeText={setPassword} secure autoComplete="current-password" />
      )}
      {googleOnly ? (
        <Button
          testID="recheck-google"
          kind="secondary"
          label={t('security.recheckGoogle')}
          disabled={busy}
          onPress={() => void run(() => api.recheckGoogle())}
        />
      ) : null}
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

/** PU-52 Set up two-factor: Scan → Confirm → Backup codes (PU-53). */
export function TwoFactorSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: (codes: string[]) => void }) {
  const api = useSecurityApi();
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  if (visible !== loadedFor) {
    setLoadedFor(visible);
    if (visible) {
      setStep(1);
      setSetup(null);
      setCode('');
      setError(null);
      setShowSecret(false);
      api.twoFactorSetup().then(setSetup, (e: unknown) => setError(messageOf(e)));
    }
  }

  const confirm = async (entered = code) => {
    setBusy(true);
    setError(null);
    try {
      const { backupCodes } = await api.twoFactorConfirm(entered);
      toast.show(t('settings.security.twoFactorTurnedOn'));
      setSetup(null);
      onDone(backupCodes);
    } catch {
      setError(t('settings.popup.twoFactorWrong'));
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
      width={480}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          {step === 1 ? (
            <Button testID="settings-2fa-continue" label={t('common.continue')} disabled={!setup} onPress={() => setStep(2)} />
          ) : (
            <Button testID="settings-2fa-confirm" label={t('settings.popup.twoFactorConfirm')} disabled={busy || code.length !== 6} onPress={() => void confirm()} />
          )}
        </Footer>
      }
    >
      {step === 1 ? (
        <>
          <Text tone="textSecondary">{t('settings.popup.twoFactorScanBody')}</Text>
          {setup ? (
            <View style={{ alignItems: 'center', gap: sp['spacing-sm'] }}>
              <View style={{ backgroundColor: tokens.color.canvas, padding: sp['spacing-sm'], borderRadius: tokens.radius['rounded-md'] }} accessibilityLabel={t('settings.popup.twoFactorQrPlaceholder')}>
                <SvgXml xml={setup.qrSvg} width={180} height={180} />
              </View>
              <Button
                kind="link"
                label={t('settings.popup.twoFactorCopyKey')}
                onPress={() => {
                  setShowSecret(true);
                  void copyText(setup.secret).then(() => toast.show(t('settings.popup.twoFactorCopied')));
                }}
              />
              {showSecret ? (
                <Text variant="caption" tone="textSecondary" selectable testID="settings-2fa-secret">
                  {setup.secret.match(/.{1,4}/g)?.join(' ') ?? setup.secret}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <>
          <Text tone="textSecondary">{t('settings.popup.twoFactorConfirmBody')}</Text>
          <CodeInput
            testID="settings-2fa-code"
            value={code}
            onChange={(next) => {
              setCode(next);
              if (next.length === 6) void confirm(next);
            }}
          />
        </>
      )}
      {error ? <InlineError message={error} /> : null}
    </Sheet>
  );
}

/** PU-53 Backup codes: 10 codes in two columns; can't close without ticking saved. */
export function BackupCodesSheet({
  codes,
  onClose,
  regenerated = false,
}: {
  codes: string[] | null;
  onClose: () => void;
  regenerated?: boolean;
}) {
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const list = codes ?? [];
  const text = list.join('\n');
  const mid = Math.ceil(list.length / 2);
  const left = list.slice(0, mid);
  const right = list.slice(mid);

  const requestClose = () => {
    if (!saved) return;
    setSaved(false);
    onClose();
  };

  return (
    <Sheet
      visible={codes !== null}
      title={t('settings.popup.backupCodesTitle')}
      onClose={requestClose}
      testID="settings-backup-codes-sheet"
      width={420}
      footer={<Button testID="settings-backup-done" label={t('settings.popup.backupCodesDone')} disabled={!saved} onPress={requestClose} />}
    >
      {regenerated ? <Text tone="textSecondary">{t('settings.popup.backupCodesOldInvalid')}</Text> : null}
      <Text tone="textSecondary">{t('settings.popup.backupCodesBody')}</Text>
      <View style={{ flexDirection: 'row', gap: sp['spacing-lg'] }} testID="settings-backup-columns">
        <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
          {left.map((c) => (
            <Text key={c} style={{ fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }} selectable>
              {c}
            </Text>
          ))}
        </View>
        <View style={{ flex: 1, gap: sp['spacing-xs'] }}>
          {right.map((c) => (
            <Text key={c} style={{ fontFamily: Platform.OS === 'web' ? 'monospace' : undefined }} selectable>
              {c}
            </Text>
          ))}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: sp['spacing-sm'], flexWrap: 'wrap' }}>
        <Button kind="secondary" label={t('settings.popup.backupCodesCopy')} onPress={() => void copyText(text).then(() => toast.show(t('settings.popup.backupCodesCopied')))} />
        <Button kind="secondary" label={t('settings.popup.backupCodesDownload')} onPress={() => void saveText('myledja-backup-codes.txt', text, 'text/plain')} />
      </View>
      <Checkbox testID="settings-backup-saved" label={t('settings.popup.backupCodesSaved')} checked={saved} onChange={setSaved} />
    </Sheet>
  );
}

/** PU-54 Add passkey. */
export function PasskeySheet({ visible, onClose, onAdded }: { visible: boolean; onClose: () => void; onAdded: () => void }) {
  const api = useSecurityApi();
  const toast = useToast();
  const [name, setName] = useState(defaultDeviceName());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);

  if (visible !== opened) {
    setOpened(visible);
    if (visible) {
      setName(defaultDeviceName());
      setError(null);
    }
  }

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const { challengeToken, options } = await api.passkeyAddOptions();
      const response = await passkeyRegistration(options);
      await api.passkeyAdd({ challengeToken, response, name: name.trim() });
      toast.show(t('settings.security.passkeyAdded'));
      onAdded();
    } catch (e) {
      setError(e instanceof ApiError ? messageOf(e) : t('settings.popup.passkeyFailed'));
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
      width={420}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="settings-passkey-add" label={t('settings.popup.passkeyAdd')} disabled={busy || !name.trim()} onPress={() => void add()} />
        </Footer>
      }
    >
      <Text tone="textSecondary">{t('settings.popup.passkeyBody')}</Text>
      <TextInput testID="settings-passkey-name" label={t('settings.popup.passkeyName')} value={name} onChangeText={setName} />
      {error ? <InlineError message={error} /> : null}
    </Sheet>
  );
}

/** PU-60 Change password. */
export function ChangePasswordSheet({
  visible,
  onClose,
  guard,
  googleOnly = false,
}: {
  visible: boolean;
  onClose: () => void;
  guard: (action: () => Promise<void>, forAction?: string) => Promise<void>;
  googleOnly?: boolean;
}) {
  const api = useSecurityApi();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = checkPassword(next);
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSave = strength.ok && confirm === next && (googleOnly || current.length > 0) && !busy;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await guard(async () => {
        await api.changePassword({
          currentPassword: googleOnly ? '' : current,
          newPassword: next,
          signOutOtherDevices: signOutOthers,
        });
        if (signOutOthers) await api.signOutOthers().catch(() => undefined);
        toast.show(t('settings.security.passwordChanged'));
        setCurrent('');
        setNext('');
        setConfirm('');
        onClose();
      }, t('security.action.changePassword'));
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title={googleOnly ? t('settings.security.setPassword') : t('settings.security.changePassword')}
      onClose={onClose}
      testID="change-password-sheet"
      width={420}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="change-password-save" label={t('settings.security.changePassword')} disabled={!canSave} onPress={() => void save()} />
        </Footer>
      }
    >
      {googleOnly ? null : (
        <TextInput testID="change-password-current" label={t('settings.security.currentPassword')} value={current} onChangeText={setCurrent} secure autoComplete="current-password" />
      )}
      <TextInput testID="change-password-new" label={t('settings.security.newPassword')} value={next} onChangeText={setNext} secure autoComplete="new-password" />
      <PasswordStrength password={next} />
      <TextInput testID="change-password-confirm" label={t('settings.security.confirmPassword')} value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" />
      {mismatch ? <InlineError message={t('settings.security.passwordMismatch')} /> : null}
      <Checkbox testID="change-password-sign-out-others" label={t('settings.security.signOutOtherDevices')} checked={signOutOthers} onChange={setSignOutOthers} />
      {error ? <InlineError message={error} /> : null}
    </Sheet>
  );
}

/** PU-61 Change email: new address → 6-digit code. */
export function ChangeEmailSheet({
  visible,
  onClose,
  guard,
}: {
  visible: boolean;
  onClose: () => void;
  guard: (action: () => Promise<void>, forAction?: string) => Promise<void>;
}) {
  const api = useSecurityApi();
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opened, setOpened] = useState(false);

  if (visible !== opened) {
    setOpened(visible);
    if (visible) {
      setStep(1);
      setEmail('');
      setCode('');
      setError(null);
    }
  }

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      await guard(async () => {
        await api.requestEmailChange(email.trim());
        setStep(2);
      }, t('security.action.changeEmail'));
    } catch (e) {
      if (e instanceof ApiError && e.body?.code === 'email_in_use') setError(t('settings.popup.emailInUse'));
      else setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (entered = code) => {
    setBusy(true);
    setError(null);
    try {
      await api.confirmEmailChange(email.trim(), entered);
      if (user) setUser({ ...user, email: email.trim() });
      toast.show(t('settings.popup.emailChanged'));
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
      title={t('settings.popup.changeEmailTitle')}
      onClose={onClose}
      testID="change-email-sheet"
      width={420}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          {step === 1 ? (
            <Button
              testID="change-email-send"
              label={t('settings.popup.emailSendCode')}
              disabled={busy || !EMAIL_PATTERN.test(email.trim())}
              onPress={() => void sendCode()}
            />
          ) : (
            <Button testID="change-email-confirm" label={t('settings.popup.emailConfirm')} disabled={busy || code.length !== 6} onPress={() => void confirmCode()} />
          )}
        </Footer>
      }
    >
      {step === 1 ? (
        <TextInput testID="change-email-new" label={t('settings.popup.emailNew')} value={email} onChangeText={setEmail} autoComplete="email" keyboardType="email-address" />
      ) : (
        <>
          <Text tone="textSecondary">{t('settings.popup.emailCodeBody', { email })}</Text>
          <CodeInput
            testID="change-email-code"
            value={code}
            onChange={(next) => {
              setCode(next);
              if (next.length === 6) void confirmCode(next);
            }}
          />
        </>
      )}
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

/** PU-55 Restore backup into a new workspace. */
export function RestoreBackupSheet({
  visible,
  onClose,
  guard,
}: {
  visible: boolean;
  onClose: () => void;
  guard: (action: () => Promise<void>, forAction?: string) => Promise<void>;
}) {
  const api = useSecurityApi();
  const toast = useToast();
  const [content, setContent] = useState<string | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const text = await pickBackupText();
    if (!text) return;
    try {
      const p = await api.restorePreview(text);
      setPreview(p);
      setContent(text);
      const date = new Date(p.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      setWorkspaceName(t('settings.popup.restoreDefaultName', { date }));
    } catch {
      setError(t('settings.popup.restoreDamaged'));
      setPreview(null);
      setContent(null);
    }
  };

  const reset = () => {
    setContent(null);
    setPreview(null);
    setWorkspaceName('');
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
        width={480}
        footer={
          <Footer>
            <Button
              kind="secondary"
              label={t('common.cancel')}
              onPress={() => {
                reset();
                onClose();
              }}
            />
            {preview ? (
              <Button testID="settings-restore-confirm" label={t('settings.popup.restoreConfirm')} onPress={() => setConfirmOpen(true)} />
            ) : (
              <Button testID="settings-restore-pick" label={t('settings.popup.restorePick')} onPress={() => void pick()} />
            )}
          </Footer>
        }
      >
        <Text tone="textSecondary">{t('settings.popup.restoreBody')}</Text>
        {preview ? (
          <>
            <Text variant="caption" tone="textSecondary" testID="settings-restore-summary">
              {t('settings.popup.restoreSummary', {
                date: new Date(preview.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
                accounts: String(preview.accounts),
                transactions: String(preview.transactions),
                goals: String(preview.goals ?? 0),
              })}
            </Text>
            <TextInput testID="settings-restore-name" label={t('settings.popup.restoreWorkspaceName')} value={workspaceName} onChangeText={setWorkspaceName} />
          </>
        ) : null}
        {error ? <InlineError message={error} /> : null}
      </Sheet>
      <Confirm
        visible={confirmOpen}
        destructive
        title={t('settings.popup.restoreConfirmTitle')}
        body={t('settings.popup.restoreConfirmBodyNamed', { name: workspaceName || 'Restored' })}
        confirmLabel={t('settings.popup.restoreConfirm')}
        onConfirm={() => {
          setConfirmOpen(false);
          if (!content) return;
          void guard(async () => {
            const done = await api.restore(content, workspaceName.trim() || undefined);
            toast.show(t('settings.popup.restoreDone', { name: done.workspaceName }), () => {
              toast.show(t('settings.popup.restoreSwitchHint', { name: done.workspaceName }));
            });
            reset();
            onClose();
          }, t('security.action.restore')).catch((e: unknown) => setError(messageOf(e)));
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

/** PU-62 Delete account: consequences → type DELETE → destructive confirm. */
export function DeleteAccountSheet({
  visible,
  onClose,
  guard,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  guard: (action: () => Promise<void>, forAction?: string) => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const api = useSecurityApi();
  const toast = useToast();
  const [typed, setTyped] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  if (visible !== opened) {
    setOpened(visible);
    if (visible) {
      setTyped('');
      setError(null);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Sheet
        visible={visible}
        title={t('settings.popup.deleteAccountTitle')}
        onClose={onClose}
        testID="delete-account-sheet"
        width={480}
        footer={
          <Footer>
            <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
            <Button
              testID="delete-account-continue"
              label={t('settings.popup.deleteAccountContinue')}
              disabled={typed !== t('settings.popup.deleteAccountTypedWord')}
              onPress={() => setConfirmOpen(true)}
            />
          </Footer>
        }
      >
        <Text tone="textSecondary">{t('settings.popup.deleteAccountBody')}</Text>
        <Button
          kind="link"
          label={t('settings.popup.deleteAccountDownload')}
          onPress={() => toast.show(t('settings.popup.deleteAccountDownloadHint'))}
        />
        <TextInput
          testID="delete-account-type"
          label={t('settings.popup.deleteAccountType')}
          value={typed}
          onChangeText={setTyped}
          placeholder={t('settings.popup.deleteAccountTypedWord')}
          autoCapitalize="characters"
        />
        {error ? <InlineError message={error} /> : null}
      </Sheet>
      <Confirm
        visible={confirmOpen}
        destructive
        testID="delete-account-confirm"
        title={t('settings.importExport.deleteAccountTitle')}
        body={t('settings.popup.deleteAccountConfirmBody')}
        confirmLabel={t('settings.importExport.deleteAccountConfirm')}
        onConfirm={() => {
          setConfirmOpen(false);
          void guard(async () => {
            await api.deleteAccount();
            toast.show(t('settings.importExport.deleteAccountQueued'));
            await onDeleted();
          }, t('security.action.deleteAccount')).catch((e: unknown) => setError(messageOf(e)));
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
