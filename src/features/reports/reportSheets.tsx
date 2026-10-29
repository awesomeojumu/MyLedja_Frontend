import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Footer, Select, Sheet, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { ReportCardKind, ReportDashboard, SavedReport } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

const sp = tokens.spacing;

const GALLERY: { kind: ReportCardKind; group: string; titleKey: string; bodyKey: string }[] = [
  { kind: 'spendingByCategory', group: 'spending', titleKey: 'reports.gallery.spendingTitle', bodyKey: 'reports.gallery.spendingBody' },
  { kind: 'incomeVsSpending', group: 'planning', titleKey: 'reports.gallery.incomeTitle', bodyKey: 'reports.gallery.incomeBody' },
  { kind: 'netWorth', group: 'wealth', titleKey: 'reports.gallery.netWorthTitle', bodyKey: 'reports.gallery.netWorthBody' },
  { kind: 'cashFlow', group: 'wealth', titleKey: 'reports.gallery.cashFlowTitle', bodyKey: 'reports.gallery.cashFlowBody' },
  { kind: 'budgetProgress', group: 'planning', titleKey: 'reports.gallery.budgetTitle', bodyKey: 'reports.gallery.budgetBody' },
];

/** PU-41 Add report */
export function AddReportSheet({
  dashboard,
  onClose,
  onAdd,
}: {
  dashboard: ReportDashboard;
  onClose: () => void;
  onAdd: (kind: ReportCardKind, title: string) => void;
}) {
  const { snapshot } = useWorkspace();
  const saved = snapshot?.settings.savedReports ?? [];
  const groups = ['spending', 'planning', 'wealth', 'custom'] as const;

  return (
    <Sheet visible testID="add-report-sheet" title={t('reports.addReport')} onClose={onClose}>
      <View style={{ gap: sp['spacing-lg'] }}>
        {groups.map((group) => {
          const items =
            group === 'custom'
              ? saved.map((r) => ({ kind: r.kind, title: r.name, body: t('reports.customSaved') }))
              : GALLERY.filter((g) => g.group === group).map((g) => ({
                  kind: g.kind,
                  title: t(g.titleKey as 'reports.gallery.spendingTitle'),
                  body: t(g.bodyKey as 'reports.gallery.spendingBody'),
                }));
          if (items.length === 0) return null;
          return (
            <View key={group} style={{ gap: sp['spacing-sm'] }}>
              <Text variant="heading-sm">{t(`reports.group.${group}` as 'reports.group.spending')}</Text>
              {items.map((item, i) => (
                <Pressable
                  key={`${item.kind}-${i}`}
                  testID={`add-report-${item.kind}-${i}`}
                  onPress={() => {
                    onAdd(item.kind, item.title);
                    onClose();
                  }}
                  style={{ gap: 4 }}
                >
                  <Text>{item.title}</Text>
                  <Text tone="textSecondary" variant="caption">
                    {item.body}
                  </Text>
                </Pressable>
              ))}
            </View>
          );
        })}
        <Button kind="secondary" label={t('reports.buildOwn')} onPress={onClose} />
      </View>
    </Sheet>
  );
}

/** PU-42 Dashboard name */
export function DashboardNameSheet({
  existing,
  initial,
  onClose,
  onSave,
}: {
  existing: string[];
  initial?: string;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initial ?? '');
  const clash = existing.some((n) => n.toLowerCase() === name.trim().toLowerCase() && n !== initial);
  const valid = name.trim().length > 0 && !clash;

  return (
    <Sheet
      visible
      testID="dashboard-name-sheet"
      title={initial ? t('reports.renameDashboard') : t('reports.newDashboard')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="dashboard-name-save"
            label={initial ? t('reports.renameDashboard') : t('reports.createDashboard')}
            disabled={!valid}
            onPress={() => {
              onSave(name.trim());
              onClose();
            }}
          />
        </Footer>
      }
    >
      <TextInput testID="dashboard-name" label={t('reports.dashboardName')} value={name} onChangeText={setName} error={clash ? t('reports.nameTaken') : null} />
    </Sheet>
  );
}

/** PU-43 Save report */
export function SaveReportSheet({
  defaultName,
  kind,
  onClose,
  onSave,
}: {
  defaultName: string;
  kind: ReportCardKind;
  onClose: () => void;
  onSave: (report: Omit<SavedReport, 'id'>) => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const dashboards = snapshot?.settings.reportDashboards ?? [];
  const [name, setName] = useState(defaultName);
  const [dashboardId, setDashboardId] = useState('');

  return (
    <Sheet
      visible
      testID="save-report-sheet"
      title={t('reports.saveReport')}
      onClose={onClose}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button
            testID="save-report-confirm"
            label={t('reports.saveReport')}
            disabled={!name.trim()}
            onPress={() => {
              void repo.saveSavedReport({ name: name.trim(), kind, dashboardId: dashboardId || undefined }).then(() => {
                onSave({ name: name.trim(), kind, dashboardId: dashboardId || undefined });
                toast.show(t('reports.reportSaved'));
                onClose();
              });
            }}
          />
        </Footer>
      }
    >
      <View style={{ gap: sp['spacing-md'] }}>
        <TextInput testID="save-report-name" label={t('reports.reportName')} value={name} onChangeText={setName} />
        <Select
          testID="save-report-dashboard"
          label={`${t('reports.addToDashboard')} ${t('common.optional')}`}
          value={dashboardId}
          onChange={setDashboardId}
          options={[{ value: '', label: t('reports.noDashboard') }, ...dashboards.map((d) => ({ value: d.id, label: d.name }))]}
        />
      </View>
    </Sheet>
  );
}

export function useReportGalleryKinds() {
  return useMemo(() => GALLERY, []);
}
