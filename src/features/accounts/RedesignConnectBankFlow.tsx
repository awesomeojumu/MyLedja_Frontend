import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { aiApi } from '@/api/ai';
import { ApiError } from '@/api/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { openMonoConnect } from '@/features/banking/monoConnect';
import {
  RedesignButton,
  RedesignChoiceCard,
  RedesignField,
  RedesignInlineError,
  RedesignSegmented,
  RedesignSheet,
  RedesignText,
} from '@/design/redesign';
import { redesignTokens as tokens } from '@/design/redesign/theme';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { ledgerMessage, today } from '@/features/transactions/helpers';
import { t } from '@/i18n';
import { useToast } from '@/design/components';

const sp = tokens.space;

type Step = 'before' | 'waiting' | 'connecting' | 'connected' | 'error';

/**
 * Figma Phone / Bank steps after search (`11:4473`–`11:4558`).
 * Receives the bank label chosen in RedesignConnectBankSearchSheet.
 */
export function RedesignConnectBankFlow({
  bankLabel,
  onClose,
  onManual,
}: {
  bankLabel: string;
  onClose: () => void;
  /** Skip Mono and open Add account instead. */
  onManual?: () => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const { client, user } = useAuth();
  const toast = useToast();
  const api = useMemo(() => aiApi(client), [client]);
  const accounts = (snapshot?.accounts ?? []).filter(
    (a) => !a.archived && ['bank', 'savings', 'wallet', 'card'].includes(a.type),
  );

  const [step, setStep] = useState<Step>('before');
  const [monoCode, setMonoCode] = useState<string | null>(null);
  const [pickedAccountId, setPickedAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [createNew, setCreateNew] = useState(false);
  const [newName, setNewName] = useState(bankLabel ? `${bankLabel}` : '');
  const [historyMonths, setHistoryMonths] = useState<'1' | '3' | '6' | '12'>('3');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const historyDays = ({ '1': 30, '3': 90, '6': 180, '12': 365 } as const)[historyMonths];
  const linkAccountId = createNew
    ? ''
    : pickedAccountId && accounts.some((a) => a.id === pickedAccountId)
      ? pickedAccountId
      : (accounts[0]?.id ?? '');

  const cancel = () => {
    setMonoCode(null);
    onClose();
  };

  const startMono = async () => {
    setBusy(true);
    setError(null);
    setStep('waiting');
    try {
      const code = await openMonoConnect();
      if (!code) {
        setMonoCode(null);
        setStep('before');
        return;
      }
      setMonoCode(code);
      setStep('connecting');
      // Brief connecting beat so Figma `11:4522` is reachable before match.
      await new Promise((r) => setTimeout(r, 400));
      setStep('connected');
    } catch (e) {
      setError(e instanceof ApiError ? e.body.message : t('redesign.connect.failedBody', { bank: bankLabel }));
      setStep('error');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!user || !monoCode) return;
    setBusy(true);
    setError(null);
    try {
      let accountId = linkAccountId;
      if (createNew || !accountId) {
        const name = newName.trim() || t('accounts.connect.newAccountName');
        const created = await repo.addAccount({
          name,
          type: 'bank',
          institution: bankLabel,
          openingBalance: 0n,
          openingDate: today(),
        });
        if (!created.ok) {
          setError(ledgerMessage(created.error));
          return;
        }
        accountId = created.value.id;
      }
      if (!accountId) {
        setError(t('accounts.connect.chooseAccount'));
        return;
      }
      const link = await api.linkBank(user.workspaceId, { accountId, code: monoCode, historyDays });
      toast.show(t('accounts.connect.linkedImporting', { bank: link.institution || bankLabel }));
      await api.syncBank(user.workspaceId, link.id).catch(() => null);
      setMonoCode(null);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.body.message : t('redesign.connect.failedBody', { bank: bankLabel }));
      setStep('error');
    } finally {
      setBusy(false);
    }
  };

  const title =
    step === 'before'
      ? t('redesign.connect.beforeTitle', { bank: bankLabel })
      : step === 'waiting'
        ? t('redesign.connect.waitingTitle')
        : step === 'connecting'
          ? t('redesign.connect.connectingTitle')
          : step === 'connected'
            ? t('redesign.connect.connectedTitle', { bank: bankLabel })
            : t('redesign.connect.failedTitle', { bank: bankLabel });

  const footer =
    step === 'before' ? (
      <View style={{ gap: sp.sm }}>
        <RedesignButton
          testID="connect-bank-continue"
          label={t('redesign.connect.continueToBank', { bank: bankLabel })}
          onPress={() => void startMono()}
          fullWidth
        />
        <RedesignButton
          testID="connect-bank-manual"
          kind="secondary"
          label={t('redesign.connect.addManually')}
          onPress={() => {
            onClose();
            onManual?.();
          }}
          fullWidth
        />
      </View>
    ) : step === 'waiting' ? (
      <RedesignButton testID="connect-bank-waiting-cancel" kind="secondary" label={t('common.cancel')} onPress={cancel} disabled={busy} fullWidth />
    ) : step === 'connecting' ? (
      <RedesignButton testID="connect-bank-background" kind="secondary" label={t('redesign.connect.background')} onPress={cancel} fullWidth />
    ) : step === 'connected' ? (
      <RedesignButton
        testID="connect-bank-finish"
        label={t('redesign.connect.addAccount')}
        disabled={busy || !monoCode || (!createNew && !linkAccountId)}
        onPress={() => void finish()}
        fullWidth
      />
    ) : (
      <View style={{ gap: sp.sm }}>
        <RedesignButton testID="connect-bank-retry" label={t('redesign.connect.tryAgain')} onPress={() => void startMono()} fullWidth />
        <RedesignButton
          testID="connect-bank-manual-error"
          kind="secondary"
          label={t('redesign.connect.addManuallyShort')}
          onPress={() => {
            onClose();
            onManual?.();
          }}
          fullWidth
        />
      </View>
    );

  return (
    <RedesignSheet visible title={title} onClose={cancel} testID="redesign-connect-bank-flow" footer={footer}>
      <View style={{ gap: sp.lg }}>
        {step === 'before' ? (
          <>
            <RedesignText tone="textSecondary">{t('redesign.connect.beforeBody')}</RedesignText>
            <View style={{ gap: sp.sm }}>
              <RedesignText>{t('redesign.connect.canSee')}</RedesignText>
              <RedesignText>{t('redesign.connect.cannotMove')}</RedesignText>
              <RedesignText>{t('redesign.connect.canDisconnect')}</RedesignText>
            </View>
          </>
        ) : null}
        {step === 'waiting' ? (
          <RedesignText testID="connect-bank-waiting" tone="textSecondary">
            {t('redesign.connect.waitingBody', { bank: bankLabel })}
          </RedesignText>
        ) : null}
        {step === 'connecting' ? (
          <RedesignText testID="connect-bank-connecting" tone="textSecondary">
            {t('redesign.connect.connectingBody')}
          </RedesignText>
        ) : null}
        {step === 'connected' ? (
          <>
            <RedesignText tone="textSecondary">{t('redesign.connect.connectedBody')}</RedesignText>
            {accounts.map((a) => (
              <RedesignChoiceCard
                key={a.id}
                testID={`connect-match-${a.id}`}
                title={a.name}
                selected={!createNew && linkAccountId === a.id}
                onPress={() => {
                  setCreateNew(false);
                  setPickedAccountId(a.id);
                }}
              />
            ))}
            <RedesignChoiceCard
              testID="connect-match-new"
              title={t('accounts.connect.createNew')}
              selected={createNew}
              onPress={() => {
                setCreateNew(true);
                setPickedAccountId(null);
              }}
            />
            {createNew ? (
              <RedesignField
                testID="connect-bank-new-name"
                label={t('accounts.name')}
                value={newName}
                onChangeText={setNewName}
              />
            ) : null}
            <RedesignText variant="helper" tone="textSecondary">
              {t('accounts.connect.history')}
            </RedesignText>
            <RedesignSegmented
              testID="connect-bank-history"
              value={historyMonths}
              onChange={(v) => setHistoryMonths(v as '1' | '3' | '6' | '12')}
              options={[
                { key: '1', label: t('accounts.connect.months1') },
                { key: '3', label: t('accounts.connect.months3') },
                { key: '6', label: t('accounts.connect.months6') },
                { key: '12', label: t('accounts.connect.months12') },
              ]}
            />
          </>
        ) : null}
        {step === 'error' ? (
          <RedesignText testID="connect-bank-error" tone="textSecondary">
            {error ?? t('redesign.connect.failedBody', { bank: bankLabel })}
          </RedesignText>
        ) : null}
        {error && step !== 'error' ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}
