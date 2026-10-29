import { useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, Maximize2, MoreHorizontal, Star, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Button,
  Card,
  Confirm,
  Icon,
  Menu,
  Placeholder,
  Sheet,
  Switch,
  Tabs,
  Text,
  TextInput,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useSizeClass } from '@/design/size';
import { useTheme } from '@/design/ThemeProvider';
import type { ReportCardModel, ReportKind } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { v7 as uuidv7 } from 'uuid';
import { AppFrame } from '@/features/frame/AppFrame';
import { today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';

import { cardTitle, GALLERY, kindName, moveCard, newCard, rangeCaption, runCard, setHighlight } from './helpers';
import { ReportChartView } from './ReportView';
import { useDashboards } from './useDashboards';

const sp = tokens.spacing;

/** Reports (DESIGN.md page 19): dashboards of report cards. */
export function ReportsScreen() {
  const { snapshot } = useWorkspace();
  const router = useRouter();
  const size = useSizeClass();
  const phone = size === 'phone';
  const { dashboards, ready, save, create, remove } = useDashboards();
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [naming, setNaming] = useState<'new' | 'rename' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const onDate = today();

  const current = dashboards.find((d) => d.id === selected) ?? dashboards[0] ?? null;
  const cards = useMemo(() => current?.cards ?? [], [current]);
  const results = useMemo(
    () => (snapshot ? new Map(cards.filter((c) => !c.hidden).map((c) => [c.id, runCard(snapshot, c, onDate)])) : new Map()),
    [snapshot, cards, onDate],
  );

  const change = async (next: ReportCardModel[]) => {
    if (!current) return;
    setSelected(await save(current.id, { cards: next }));
  };
  const addCard = async (kind: ReportKind, savedReportId: string | null = null) => {
    setAdding(false);
    await change([...cards, newCard(uuidv7(), kind, cards.length, { savedReportId })]);
  };

  const header = (
    <View style={{ gap: sp['spacing-sm'], marginBottom: sp['spacing-md'] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-sm'] }}>
        <ScrollView horizontal style={{ flex: 1 }}>
          <Tabs
            testID="reports-tabs"
            value={current?.id ?? ''}
            onChange={(id) => {
              setSelected(id);
              setEditing(false);
            }}
            options={dashboards.map((d) => ({ value: d.id, label: d.name }))}
          />
        </ScrollView>
        <Button testID="reports-new-dashboard" kind="link" label={t('reports.newDashboard')} onPress={() => setNaming('new')} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'], alignItems: 'center' }}>
        <View style={{ flex: 1 }} />
        <Button
          testID="reports-edit-layout"
          kind="secondary"
          label={editing ? t('reports.doneEditing') : t('reports.editLayout')}
          onPress={() => setEditing((e) => !e)}
        />
        <Button testID="reports-add" label={t('reports.addReport')} onPress={() => setAdding(true)} />
        <Menu
          testID="reports-menu"
          trigger={(open) => (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.options')} onPress={open} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon icon={MoreHorizontal} size="nav" />
            </Pressable>
          )}
          items={[
            { key: 'rename', label: t('reports.renameDashboard'), onPress: () => setNaming('rename') },
            ...(dashboards.length > 1 ? [{ key: 'delete', label: t('reports.deleteDashboard'), onPress: () => setDeleting(true) }] : []),
          ]}
        />
      </View>
    </View>
  );

  const shown = editing ? cards : cards.filter((c) => !c.hidden);
  const body =
    !ready || !snapshot ? (
      <View style={{ gap: sp['spacing-md'] }} testID="reports-loading">
        <Placeholder height={220} />
        <Placeholder height={220} />
      </View>
    ) : shown.length === 0 ? (
      <Card style={{ gap: sp['spacing-sm'] }} testID="reports-empty">
        <Text variant="heading-sm">{t('reports.emptyTitle')}</Text>
        <Text tone="textSecondary">{t('reports.emptyBody')}</Text>
      </Card>
    ) : (
      <ScrollView>
        <View style={{ flexDirection: phone ? 'column' : 'row', flexWrap: 'wrap', marginHorizontal: phone ? 0 : -sp['spacing-sm'] / 2 }}>
          {shown.map((card, i) => {
            const result = results.get(card.id);
            return (
              <View
                key={card.id}
                style={{
                  width: phone ? '100%' : (`${(card.layout.w / 12) * 100}%` as const),
                  padding: phone ? 0 : sp['spacing-sm'] / 2,
                  marginBottom: phone ? sp['spacing-md'] : 0,
                }}
              >
                <ReportCard
                  title={cardTitle(card, snapshot.savedReports)}
                  card={card}
                  editing={editing}
                  phone={phone}
                  first={i === 0}
                  last={i === shown.length - 1}
                  result={result}
                  onOpen={() => router.push(`/reports/view/${card.id}`)}
                  onChange={(next) => void change(cards.map((c) => (c.id === card.id ? next : c)))}
                  onMove={(by) => void change(moveCard(cards, card.id, by))}
                  onHighlight={() => void change(setHighlight(cards, card.id))}
                  onRemove={() => void change(cards.filter((c) => c.id !== card.id))}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    );

  return (
    <AppFrame title={t('reports.title')}>
      {header}
      {body}
      {adding ? (
        <AddReportSheet
          saved={snapshot?.savedReports ?? []}
          onAdd={(kind, savedId) => void addCard(kind, savedId)}
          onBuild={() => {
            setAdding(false);
            router.push(current ? `/reports/build?dashboard=${current.id}` : '/reports/build');
          }}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {naming ? (
        <DashboardNameSheet
          initial={naming === 'rename' ? (current?.name ?? '') : ''}
          onClose={() => setNaming(null)}
          onSave={async (name) => {
            setNaming(null);
            if (naming === 'new') setSelected(await create(name));
            else if (current) setSelected(await save(current.id, { name }));
          }}
        />
      ) : null}
      <Confirm
        visible={deleting}
        title={t('reports.deleteDashboardTitle', { name: current?.name ?? '' })}
        body={t('reports.deleteDashboardBody')}
        confirmLabel={t('reports.deleteDashboard')}
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false);
          if (current) void remove(current.id).then(() => setSelected(null));
        }}
      />
    </AppFrame>
  );
}

function ReportCard({
  title,
  card,
  editing,
  phone,
  first,
  last,
  result,
  onOpen,
  onChange,
  onMove,
  onHighlight,
  onRemove,
}: {
  title: string;
  card: ReportCardModel;
  editing: boolean;
  phone: boolean;
  first: boolean;
  last: boolean;
  result: ReturnType<typeof runCard> | undefined;
  onOpen: () => void;
  onChange: (card: ReportCardModel) => void;
  onMove: (by: -1 | 1) => void;
  onHighlight: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const tool = (icon: typeof ArrowUp, label: string, onPress: () => void, testID: string, disabled = false, selected = false) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
    >
      <Icon icon={icon} size="row" color={selected ? theme.link : theme.textSecondary} />
    </Pressable>
  );
  return (
    <Card testID={`report-card-${card.id}`} style={{ gap: sp['spacing-sm'], opacity: card.hidden ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp['spacing-xs'] }}>
        <View style={{ flex: 1 }}>
          <Text variant="heading-sm">{title}</Text>
          {result && card.kind !== 'note' ? (
            <Text variant="caption" tone="textSecondary">
              {rangeCaption(result.range.from, result.range.to)}
            </Text>
          ) : null}
        </View>
        {editing ? null : tool(Maximize2, t('reports.openReport', { name: title }), onOpen, `report-open-${card.id}`)}
      </View>
      {editing ? (
        <View style={{ gap: sp['spacing-xs'] }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            {tool(ArrowUp, t('reports.moveUp'), () => onMove(-1), `card-up-${card.id}`, first)}
            {tool(ArrowDown, t('reports.moveDown'), () => onMove(1), `card-down-${card.id}`, last)}
            {tool(Star, t('reports.highlight'), onHighlight, `card-highlight-${card.id}`, false, !!card.highlight)}
            {tool(Trash2, t('reports.removeCard'), onRemove, `card-remove-${card.id}`)}
          </View>
          {card.kind === 'note' || card.kind === 'formula' ? (
            <CardTextField
              testID={`card-text-${card.id}`}
              label={card.kind === 'note' ? t('reports.noteText') : t('reports.formulaText')}
              value={(card.kind === 'note' ? card.text : card.formula) ?? ''}
              multiline={card.kind === 'note'}
              onSave={(v) => onChange(card.kind === 'note' ? { ...card, text: v } : { ...card, formula: v })}
            />
          ) : null}
          <Switch testID={`card-hide-${card.id}`} label={t('reports.hideCard')} value={card.hidden} onChange={(hidden) => onChange({ ...card, hidden })} />
          {phone ? null : (
            <Switch
              testID={`card-wide-${card.id}`}
              label={t('reports.fullWidth')}
              value={card.layout.w === 12}
              onChange={(wide) => onChange({ ...card, layout: { ...card.layout, w: wide ? 12 : 6 } })}
            />
          )}
        </View>
      ) : null}
      {result && !card.hidden ? (
        <ReportChartView testID={`card-chart-${card.id}`} result={result} title={title} chart={card.chart} highlight={!!card.highlight} text={card.text} />
      ) : null}
    </Card>
  );
}

/** Saves when the field loses focus, so typing doesn't write on every key. */
function CardTextField({ label, value, multiline, onSave, testID }: { label: string; value: string; multiline: boolean; onSave: (v: string) => void; testID: string }) {
  const [text, setText] = useState(value);
  return (
    <TextInput
      testID={testID}
      label={label}
      value={text}
      multiline={multiline}
      maxLength={multiline ? 2000 : 200}
      onChangeText={setText}
      onBlur={() => {
        if (text !== value) onSave(text);
      }}
    />
  );
}

function AddReportSheet({
  saved,
  onAdd,
  onBuild,
  onClose,
}: {
  saved: { id: string; name: string }[];
  onAdd: (kind: ReportKind, savedId: string | null) => void;
  onBuild: () => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const tile = (key: string, label: string, onPress: () => void) => (
    <Pressable
      key={key}
      testID={`gallery-${key}`}
      accessibilityRole="button"
      onPress={onPress}
      style={{ padding: sp['spacing-sm'], borderWidth: 1, borderColor: theme.border, borderRadius: tokens.radius['rounded-md'], minWidth: 140, flexGrow: 1 }}
    >
      <Text>{label}</Text>
    </Pressable>
  );
  return (
    <Sheet visible testID="reports-gallery" title={t('reports.addReport')} onClose={onClose} width={640}>
      {GALLERY.map((g) => (
        <View key={g.group} style={{ gap: sp['spacing-xs'], marginBottom: sp['spacing-md'] }}>
          <Text variant="heading-sm">{t(`reports.gallery.${g.group}` as TextKey)}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-sm'] }}>
            {g.kinds.map((k) => tile(k, kindName(k), () => onAdd(k, null)))}
            {g.group === 'custom' ? saved.map((s) => tile(`saved-${s.id}`, s.name, () => onAdd('custom', s.id))) : null}
          </View>
        </View>
      ))}
      <Button testID="gallery-build" kind="secondary" label={t('reports.buildYourOwn')} onPress={onBuild} />
    </Sheet>
  );
}

function DashboardNameSheet({ initial, onSave, onClose }: { initial: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(initial);
  const ok = name.trim().length > 0;
  return (
    <Sheet
      visible
      testID="dashboard-name-sheet"
      title={t('reports.dashboardName')}
      onClose={onClose}
      footer={<Button testID="dashboard-name-save" label={t('common.save')} disabled={!ok} onPress={() => onSave(name.trim())} />}
    >
      <TextInput testID="dashboard-name" label={t('reports.dashboardName')} value={name} onChangeText={setName} maxLength={60} />
    </Sheet>
  );
}
