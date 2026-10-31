import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import type { Snapshot } from '@/data/workspace/repository';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { useToast } from '@/design/components';
import {
  RedesignAmount,
  RedesignButton,
  RedesignField,
  RedesignIcon,
  RedesignInlineError,
  RedesignSheet,
  RedesignText,
  RedesignTopBar,
  RedesignShell,
} from '@/design/redesign';
import { redesignLight as theme, redesignTokens as tokens } from '@/design/redesign/theme';
import { t } from '@/i18n';
import { formatNaira, parseAmount } from '@/money';
import { today } from '@/features/transactions/helpers';

import {
  activeGoals,
  goalCards,
  goalStatusKind,
  monthsBetween,
  type GoalCard,
} from './helpers';

const sp = tokens.space;
const shape = tokens.shape;

const MONTH_LONG = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: theme.surface,
        borderRadius: shape['radius-lg'],
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function monthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return `${MONTH_LONG[m] ?? m} ${y}`;
}

function monthOnly(iso: string): string {
  const m = Number(iso.slice(5, 7));
  return MONTH_LONG[m] ?? iso;
}

function dayMonth(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** Linear expected savings vs actual — used for “Behind by ₦…”. */
function behindByAmount(card: GoalCard, todayIso: string): bigint {
  if (!card.goal.targetDate || card.saved >= card.target) return 0n;
  const start = card.goal.scheduleStarts ?? todayIso.slice(0, 8) + '01';
  // Prefer created pacing from first allocation date when present; else assume start of current year.
  const totalMonths = monthsBetween(start, card.goal.targetDate);
  const elapsed = Math.min(totalMonths, monthsBetween(start, todayIso));
  const expected = (card.target * BigInt(elapsed)) / BigInt(totalMonths);
  return expected > card.saved ? expected - card.saved : 0n;
}

function goalCaption(card: GoalCard, todayIso: string): string {
  const kind = goalStatusKind(card, todayIso);
  if (kind === 'done') return t('goals.done');
  if (kind === 'paused') return t('goals.paused');
  if (kind === 'behind') {
    const amt = behindByAmount(card, todayIso);
    if (amt > 0n) return t('goals.redesign.behindBy', { amount: formatNaira(amt) });
    return t('goals.behind');
  }
  if (card.goal.targetDate) {
    const monthsLeft = monthsBetween(todayIso, card.goal.targetDate);
    if (monthsLeft <= 3) return t('goals.redesign.dueIn', { month: monthOnly(card.goal.targetDate) });
    return t('goals.redesign.onTrackFor', { when: monthYear(card.goal.targetDate) });
  }
  return t('goals.onTrack');
}

function ProgressRing({ progress, size = 48, stroke = 5 }: { progress: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, progress));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.progressTrack} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={theme.progressFill}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

/** Figma Mobile: Phone / Goals (4:2041) + empty / add / detail. */
export function RedesignGoalsScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ goal?: string; allocate?: string; take?: string }>();
  const { snapshot, repo } = useWorkspace();
  const todayIso = today();

  const cards = useMemo(() => (snapshot ? goalCards(snapshot, todayIso) : []), [snapshot, todayIso]);
  const active = activeGoals(cards);
  const totalSaved = active.reduce((s, c) => s + c.saved, 0n);
  const addOpen = params.goal === 'new';
  const detailId = typeof params.goal === 'string' && params.goal !== 'new' ? params.goal : null;
  const detailCard = detailId ? cards.find((c) => c.goal.id === detailId) ?? null : null;
  const allocateOpen = typeof params.allocate === 'string';
  const takeOpen = typeof params.take === 'string';

  if (detailCard && snapshot) {
    return (
      <GoalDetailView
        snapshot={snapshot}
        card={detailCard}
        todayIso={todayIso}
        onBack={() => router.setParams({ goal: undefined, allocate: undefined, take: undefined })}
        onEdit={() => router.setParams({ goal: 'new' /* edit via sheet with existing below */ })}
        allocateOpen={allocateOpen}
        takeOpen={takeOpen}
        onOpenAllocate={() => router.setParams({ allocate: detailCard.goal.id })}
        onOpenTake={() => router.setParams({ take: detailCard.goal.id })}
        onCloseMoney={() => router.setParams({ allocate: undefined, take: undefined })}
        onAllocate={async (amount, fromAccountId) => {
          const r = await repo.allocateToGoal(detailCard.goal.id, {
            amount,
            date: todayIso,
            fromAccountId,
          });
          if (r.ok) {
            toast.show(t('goals.redesign.moneyAdded'));
            router.setParams({ allocate: undefined });
          }
        }}
        onSpend={async (amount, accountId) => {
          const r = await repo.spendFromGoal(detailCard.goal.id, {
            amount,
            date: todayIso,
            accountId,
            categoryId: detailCard.goal.categoryId ?? snapshot.categories.find((c) => c.kind === 'expense')!.id,
          });
          if (r.ok) {
            toast.show(t('goals.redesign.moneyTaken'));
            router.setParams({ take: undefined });
          }
        }}
      />
    );
  }

  return (
    <RedesignShell><SafeAreaView testID="redesign-goals" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
      <RedesignTopBar
        title={t('goals.title')}
        onBack={() => router.push('/more')}
        trailing={
          <Pressable
            testID="goals-redesign-add"
            accessibilityRole="button"
            accessibilityLabel={t('goals.redesign.addAGoal')}
            onPress={() => router.setParams({ goal: 'new' })}
            style={{
              width: tokens.density.touch.minTarget,
              height: tokens.density.touch.minTarget,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RedesignIcon name="plus" size={24} color={theme.text} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, paddingBottom: sp.xxl }}>
        {active.length === 0 ? (
          <Card testID="goals-redesign-empty">
            <View style={{ alignItems: 'center', gap: sp.md, padding: sp.xl }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: theme.surfaceMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RedesignIcon name="target" size={28} color={theme.text} />
              </View>
              <RedesignText variant="headline" accessibilityRole="header">
                {t('goals.redesign.emptyTitle')}
              </RedesignText>
              <RedesignText tone="textSecondary" style={{ textAlign: 'center' }}>
                {t('goals.redesign.emptyBody')}
              </RedesignText>
              <RedesignButton
                testID="goals-redesign-empty-add"
                label={t('goals.redesign.addAGoal')}
                onPress={() => router.setParams({ goal: 'new' })}
              />
            </View>
          </Card>
        ) : (
          <>
            <Card testID="goals-redesign-total">
              <View style={{ padding: sp.lg, gap: sp.sm }}>
                <RedesignText variant="label" tone="textSecondary">
                  {t('goals.redesign.savedForGoals')}
                </RedesignText>
                <RedesignAmount testID="goals-redesign-total-amount" text={formatNaira(totalSaved)} sizeVariant="display" />
                <RedesignText>{t('goals.redesign.across', { count: String(active.length) })}</RedesignText>
              </View>
            </Card>

            {active.map((card) => (
              <Pressable
                key={card.goal.id}
                testID={`goals-row-${card.goal.id}`}
                accessibilityRole="button"
                onPress={() => router.setParams({ goal: card.goal.id })}
              >
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.md, padding: sp.lg }}>
                    <ProgressRing progress={card.progress} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <RedesignText variant="label">{card.goal.name}</RedesignText>
                      <RedesignText variant="helper" tone="textSecondary">
                        {t('goals.redesign.of', {
                          saved: formatNaira(card.saved),
                          target: formatNaira(card.target),
                        })}
                      </RedesignText>
                      <RedesignText variant="helper" tone="textSecondary">
                        {goalCaption(card, todayIso)}
                      </RedesignText>
                    </View>
                    <RedesignIcon name="chevron-right" size={20} color={theme.textSecondary} />
                  </View>
                </Card>
              </Pressable>
            ))}

            <RedesignButton
              testID="goals-redesign-add-bottom"
              kind="secondary"
              label={t('goals.redesign.addAGoal')}
              fullWidth
              onPress={() => router.setParams({ goal: 'new' })}
            />
          </>
        )}
      </ScrollView>

      {addOpen && snapshot ? (
        <AddGoalSheet
          snapshot={snapshot}
          onClose={() => router.setParams({ goal: undefined })}
          onSave={async (input) => {
            const r = await repo.addGoal(input);
            if (r.ok) {
              toast.show(t('goals.redesign.goalSaved'));
              router.setParams({ goal: undefined });
            }
          }}
        />
      ) : null}
    </SafeAreaView></RedesignShell>
  );
}

function GoalDetailView({
  snapshot,
  card,
  todayIso,
  onBack,
  allocateOpen,
  takeOpen,
  onOpenAllocate,
  onOpenTake,
  onCloseMoney,
  onAllocate,
  onSpend,
}: {
  snapshot: Snapshot;
  card: GoalCard;
  todayIso: string;
  onBack: () => void;
  onEdit: () => void;
  allocateOpen: boolean;
  takeOpen: boolean;
  onOpenAllocate: () => void;
  onOpenTake: () => void;
  onCloseMoney: () => void;
  onAllocate: (amount: bigint, fromAccountId: string) => Promise<void>;
  onSpend: (amount: bigint, toAccountId: string) => Promise<void>;
}) {
  const history = snapshot.allocations
    .filter((a) => a.goalId === card.goal.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
  const pct = Math.round(card.progress * 100);

  return (
    <RedesignShell><SafeAreaView testID="goals-redesign-detail" style={{ flex: 1, backgroundColor: theme.page }} edges={['top', 'bottom']}>
      <RedesignTopBar
        title={card.goal.name}
        onBack={onBack}
        trailing={
          <Pressable
            testID="goals-redesign-edit"
            accessibilityRole="button"
            accessibilityLabel={t('common.edit')}
            onPress={onBack}
            style={{
              width: tokens.density.touch.minTarget,
              height: tokens.density.touch.minTarget,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RedesignIcon name="edit" size={22} color={theme.text} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: sp.lg, gap: sp.lg, paddingBottom: 140 }}>
        <Card testID="goals-redesign-progress">
          <View style={{ padding: sp.lg, alignItems: 'center', gap: sp.md }}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <ProgressRing progress={card.progress} size={120} stroke={10} />
              <View style={{ position: 'absolute', alignItems: 'center' }}>
                <RedesignText variant="display">{String(pct)}</RedesignText>
                <RedesignText variant="caption" tone="textSecondary">
                  {t('goals.redesign.outOf100')}
                </RedesignText>
              </View>
            </View>
            <RedesignText>
              {t('goals.redesign.of', { saved: formatNaira(card.saved), target: formatNaira(card.target) })}
            </RedesignText>
            <RedesignText tone="textSecondary">{goalCaption(card, todayIso)}</RedesignText>
          </View>
        </Card>

        <Card>
          {(
            [
              [t('goals.redesign.keptIn'), card.accountName || '—'],
              [t('goals.redesign.monthlyAmount'), card.monthly ? formatNaira(card.monthly) : t('common.notSet')],
              [t('goals.redesign.targetDate'), card.goal.targetDate ? monthYear(card.goal.targetDate) : t('common.notSet')],
            ] as const
          ).map(([label, value]) => (
            <View
              key={label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingHorizontal: sp.lg,
                paddingVertical: sp.md,
                borderBottomWidth: 1,
                borderBottomColor: theme.border,
                gap: sp.md,
              }}
            >
              <RedesignText tone="textSecondary">{label}</RedesignText>
              <RedesignText style={{ flexShrink: 1, textAlign: 'right' }}>{value}</RedesignText>
            </View>
          ))}
        </Card>

        {history.length > 0 ? (
          <View>
            <RedesignText variant="label" tone="textSecondary" style={{ marginBottom: sp.xs }}>
              {t('goals.redesign.history')}
            </RedesignText>
            <Card>
              {history.map((a) => {
                const spend = a.kind === 'spend';
                const amount = BigInt(a.amountMinor);
                return (
                  <View
                    key={a.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: sp.md,
                      paddingHorizontal: sp.md,
                      paddingVertical: sp.md,
                    }}
                  >
                    <View
                      style={{
                        width: tokens.size.avatar,
                        height: tokens.size.avatar,
                        borderRadius: tokens.size.avatar / 2,
                        backgroundColor: theme.surfaceMuted,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <RedesignText variant="label">
                        {(spend ? t('goals.redesign.tookMoneyOut') : t('goals.redesign.addedMoney')).slice(0, 1)}
                      </RedesignText>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <RedesignText>
                        {spend ? t('goals.redesign.tookMoneyOut') : t('goals.redesign.addedMoney')}
                      </RedesignText>
                      <RedesignText variant="helper" tone="textSecondary">
                        {dayMonth(a.date)}
                      </RedesignText>
                    </View>
                    <RedesignText variant="label" style={{ fontVariant: ['tabular-nums'] }}>
                      {spend ? `−${formatNaira(amount)}` : `+${formatNaira(amount)}`}
                    </RedesignText>
                  </View>
                );
              })}
            </Card>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ padding: sp.lg, gap: sp.sm, backgroundColor: theme.page }}>
        <RedesignButton testID="goals-redesign-add-money" label={t('goals.redesign.addMoney')} fullWidth onPress={onOpenAllocate} />
        <RedesignButton
          testID="goals-redesign-take-money"
          kind="secondary"
          label={t('goals.redesign.takeMoneyOut')}
          fullWidth
          onPress={onOpenTake}
        />
      </View>

      {allocateOpen ? (
        <MoneySheet
          title={t('goals.redesign.addMoney')}
          confirmLabel={t('goals.redesign.confirmAdd')}
          accountLabel={t('goals.redesign.fromAccount')}
          accounts={snapshot.accounts.filter((a) => !a.archived)}
          defaultAccountId={snapshot.accounts.find((a) => a.id !== card.goal.accountId)?.id ?? snapshot.accounts[0]?.id}
          onClose={onCloseMoney}
          onConfirm={(amount, accountId) => onAllocate(amount, accountId)}
        />
      ) : null}
      {takeOpen ? (
        <MoneySheet
          title={t('goals.redesign.takeMoneyOut')}
          confirmLabel={t('goals.redesign.confirmTake')}
          accountLabel={t('goals.redesign.toAccount')}
          accounts={snapshot.accounts.filter((a) => !a.archived)}
          defaultAccountId={card.goal.accountId}
          onClose={onCloseMoney}
          onConfirm={(amount, accountId) => onSpend(amount, accountId)}
        />
      ) : null}
    </SafeAreaView></RedesignShell>
  );
}

function MoneySheet({
  title,
  confirmLabel,
  accountLabel,
  accounts,
  defaultAccountId,
  onClose,
  onConfirm,
}: {
  title: string;
  confirmLabel: string;
  accountLabel: string;
  accounts: Snapshot['accounts'];
  defaultAccountId?: string;
  onClose: () => void;
  onConfirm: (amount: bigint, accountId: string) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState('');
  const [accountId, setAccountId] = useState(defaultAccountId ?? '');
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const accountName = accounts.find((a) => a.id === accountId)?.name ?? t('goals.redesign.chooseOption');

  return (
    <RedesignSheet
      testID="goals-redesign-money-sheet"
      visible
      title={title}
      onClose={onClose}
      dirty={!!amountText}
      footer={
        <RedesignButton
          testID="goals-redesign-money-save"
          label={confirmLabel}
          fullWidth
          disabled={saving}
          onPress={() => {
            setError(null);
            const parsed = parseAmount(amountText);
            if (!parsed.ok || parsed.minor <= 0n) {
              setError(t('goals.redesign.amountHint'));
              return;
            }
            if (!accountId) {
              setError(t('goals.redesign.chooseOption'));
              return;
            }
            setSaving(true);
            void onConfirm(parsed.minor, accountId).finally(() => setSaving(false));
          }}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        <RedesignField
          testID="goals-redesign-money-amount"
          label={t('goals.redesign.amountLabel')}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{accountLabel}</RedesignText>
          <Pressable
            testID="goals-redesign-money-account"
            onPress={() => setAccountOpen((v) => !v)}
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: shape['radius-md'],
              paddingHorizontal: sp.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <RedesignText>{accountName}</RedesignText>
            <RedesignIcon name="chevron-down" size={18} color={theme.textSecondary} />
          </Pressable>
          {accountOpen
            ? accounts.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    setAccountId(a.id);
                    setAccountOpen(false);
                  }}
                  style={{ padding: sp.md }}
                >
                  <RedesignText>{a.name}</RedesignText>
                </Pressable>
              ))
            : null}
        </View>
        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}

function AddGoalSheet({
  snapshot,
  onClose,
  onSave,
}: {
  snapshot: Snapshot;
  onClose: () => void;
  onSave: (input: {
    name: string;
    targetMinor: bigint;
    accountId: string;
    targetDate?: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [targetDate, setTargetDate] = useState('2027-06-01');
  const savings = snapshot.accounts.find((a) => a.type === 'savings' && !a.archived);
  const [accountId, setAccountId] = useState(savings?.id ?? snapshot.accounts[0]?.id ?? '');
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const accountName = snapshot.accounts.find((a) => a.id === accountId)?.name ?? t('goals.redesign.chooseOption');
  const monthlyHint = (() => {
    const parsed = parseAmount(amountText);
    if (!parsed.ok || parsed.minor <= 0n || !targetDate) return null;
    const months = monthsBetween(today(), targetDate);
    const per = parsed.minor / BigInt(months) + (parsed.minor % BigInt(months) > 0n ? 1n : 0n);
    return t('goals.redesign.monthlyHint', { amount: formatNaira(per) });
  })();

  return (
    <RedesignSheet
      testID="goals-redesign-add-sheet"
      visible
      title={t('goals.redesign.newGoal')}
      onClose={onClose}
      dirty={!!name || !!amountText}
      footer={
        <RedesignButton
          testID="goals-redesign-save"
          label={t('goals.redesign.createGoal')}
          fullWidth
          disabled={saving}
          onPress={() => {
            setError(null);
            if (!name.trim()) {
              setError(t('goals.redesign.namePlaceholder'));
              return;
            }
            const parsed = parseAmount(amountText);
            if (!parsed.ok || parsed.minor <= 0n) {
              setError(t('goals.redesign.amountHint'));
              return;
            }
            if (!accountId) {
              setError(t('goals.redesign.chooseOption'));
              return;
            }
            setSaving(true);
            void onSave({
              name: name.trim(),
              targetMinor: parsed.minor,
              accountId,
              targetDate: targetDate || undefined,
            }).finally(() => setSaving(false));
          }}
        />
      }
    >
      <View style={{ gap: sp.lg, paddingHorizontal: sp.lg }}>
        <RedesignField
          testID="goals-redesign-name"
          label={t('goals.redesign.whatFor')}
          value={name}
          onChangeText={setName}
          placeholder={t('goals.redesign.namePlaceholder')}
        />
        <RedesignField
          testID="goals-redesign-target"
          label={t('goals.redesign.targetAmount')}
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <RedesignText variant="helper" tone="textSecondary">
          {t('goals.redesign.amountHint')}
        </RedesignText>
        <RedesignField
          testID="goals-redesign-date"
          label={t('goals.redesign.byWhen')}
          value={targetDate}
          onChangeText={setTargetDate}
          placeholder={t('goals.redesign.pickDate')}
        />
        <View style={{ gap: sp.xs }}>
          <RedesignText variant="label">{t('goals.redesign.keepItIn')}</RedesignText>
          <Pressable
            testID="goals-redesign-account"
            onPress={() => setAccountOpen((v) => !v)}
            style={{
              minHeight: tokens.size.field,
              borderWidth: 1,
              borderColor: theme.border,
              borderRadius: shape['radius-md'],
              paddingHorizontal: sp.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <RedesignText>{accountName}</RedesignText>
            <RedesignIcon name="chevron-down" size={18} color={theme.textSecondary} />
          </Pressable>
          {accountOpen
            ? snapshot.accounts
                .filter((a) => !a.archived)
                .map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => {
                      setAccountId(a.id);
                      setAccountOpen(false);
                    }}
                    style={{ padding: sp.md }}
                  >
                    <RedesignText>{a.name}</RedesignText>
                  </Pressable>
                ))
            : null}
        </View>
        {monthlyHint ? (
          <RedesignText variant="helper" tone="textSecondary">
            {monthlyHint}
          </RedesignText>
        ) : null}
        {error ? <RedesignInlineError message={error} /> : null}
      </View>
    </RedesignSheet>
  );
}
