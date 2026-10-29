import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Banner, Button, Confirm, Sheet, Text } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSync } from '@/data/sync/SyncProvider';
import type { Conflict, QueuedOperation } from '@/data/sync/types';
import { t } from '@/i18n';

const sp = tokens.spacing;

/** Rejected outbox ops + money conflicts (TECH-SPEC 9.3–9.4, P11-12). */
export function useSyncIssues() {
  const { store, engine, status } = useSync();
  const [open, setOpen] = useState(false);
  const [rejected, setRejected] = useState<QueuedOperation[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void Promise.all([store.outbox(), store.conflicts()]).then(([ops, c]) => {
        if (!alive) return;
        setRejected(ops.filter((o) => o.state === 'rejected'));
        setConflicts(c);
      });
    };
    refresh();
    return store.subscribe(refresh);
  }, [store]);

  const count = rejected.length + conflicts.length || status.rejected;

  return { count, rejected, conflicts, open, setOpen, engine, store };
}

export function SyncIssuesBanner() {
  const { count, rejected, conflicts, open, setOpen, engine, store } = useSyncIssues();
  if (count === 0) return null;

  return (
    <View style={{ paddingHorizontal: sp['spacing-md'], paddingTop: sp['spacing-md'] }}>
      <Pressable testID="sync-issues-banner" accessibilityRole="button" onPress={() => setOpen(true)}>
        <Banner message={t('sync.issuesBanner', { count })} />
      </Pressable>
      {open ? (
        <SyncIssuesSheet
          rejected={rejected}
          conflicts={conflicts}
          onClose={() => setOpen(false)}
          onDiscard={async (operationId) => {
            await engine.discard(operationId);
          }}
          onDismissConflict={async (operationId) => {
            await store.dismissConflict(operationId);
          }}
        />
      ) : null}
    </View>
  );
}

export function SyncIssuesSheet({
  rejected,
  conflicts,
  onClose,
  onDiscard,
  onDismissConflict,
}: {
  rejected: QueuedOperation[];
  conflicts: Conflict[];
  onClose: () => void;
  onDiscard: (operationId: string) => Promise<void>;
  onDismissConflict: (operationId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null);

  return (
    <>
      <Sheet visible testID="sync-issues" title={t('sync.issuesTitle')} onClose={onClose}>
        <View style={{ gap: sp['spacing-lg'] }}>
          {rejected.map((op) => (
            <View key={op.operationId} testID={`sync-rejected-${op.operationId}`} style={{ gap: sp['spacing-sm'] }}>
              <Text>{t('sync.couldntSave', { error: op.error ?? t('sync.unknownError') })}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
                <Button
                  testID={`sync-fix-${op.operationId}`}
                  kind="secondary"
                  label={t('sync.fix')}
                  onPress={() => {
                    const id = typeof op.payload.id === 'string' ? op.payload.id : null;
                    onClose();
                    if (id && op.payload.collection === 'events') {
                      router.push({ pathname: '/transactions', params: { tx: id } });
                    }
                  }}
                />
                <Button
                  testID={`sync-discard-${op.operationId}`}
                  kind="secondary"
                  label={t('sync.discard')}
                  onPress={() => setConfirmDiscard(op.operationId)}
                />
              </View>
            </View>
          ))}
          {conflicts.map((c) => (
            <View key={c.operation.operationId} testID={`sync-conflict-${c.operation.operationId}`} style={{ gap: sp['spacing-sm'] }}>
              <Text>{t('sync.conflictTitle')}</Text>
              <Text tone="textSecondary">{t('sync.conflictBody')}</Text>
              <View style={{ gap: sp['spacing-xs'] }}>
                <Text variant="caption" tone="textSecondary">
                  {t('sync.yourChange')}
                </Text>
                <Text testID={`sync-conflict-yours-${c.operation.operationId}`}>{summarisePayload(c.operation.payload)}</Text>
                <Text variant="caption" tone="textSecondary">
                  {t('sync.otherDevice')}
                </Text>
                <Text testID={`sync-conflict-server-${c.operation.operationId}`}>{summarisePayload(c.server.data)}</Text>
              </View>
              <Button
                testID={`sync-conflict-keep-${c.operation.operationId}`}
                label={t('sync.keepServer')}
                onPress={() => {
                  void onDismissConflict(c.operation.operationId).then(onClose);
                }}
              />
            </View>
          ))}
          {rejected.length === 0 && conflicts.length === 0 ? <Text>{t('sync.issuesEmpty')}</Text> : null}
        </View>
      </Sheet>
      <Confirm
        visible={confirmDiscard !== null}
        title={t('sync.discardTitle')}
        body={t('sync.discardBody')}
        confirmLabel={t('sync.discard')}
        onCancel={() => setConfirmDiscard(null)}
        onConfirm={() => {
          const id = confirmDiscard;
          setConfirmDiscard(null);
          if (id) void onDiscard(id).then(onClose);
        }}
      />
    </>
  );
}

function summarisePayload(data: Record<string, unknown>): string {
  try {
    return JSON.stringify(data, null, 0).slice(0, 280);
  } catch {
    return t('sync.unknownError');
  }
}
