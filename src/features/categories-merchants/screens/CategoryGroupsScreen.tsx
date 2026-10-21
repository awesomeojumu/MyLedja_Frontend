import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Icon, Sheet, SpringPressable, TextField, Txt, maxWidth, useTheme, type IconName } from "@/design";
import { ApiError } from "@/api/client";
import { LiveNotice } from "@/lib/live-notice";
import { DefaultLoading } from "@/lib/screen-state";
import { useActiveWorkspace, useScrollTopOnFocus } from "@/lib/ui";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

interface Category {
  id: string;
  name: string;
  kind: string;
  groupId: string | null;
}
interface Group {
  id: string;
  name: string;
  kind: string;
}

const EMPTY: { categories: Category[]; groups: Group[] } = { categories: [], groups: [] };

/** Spending groups A–Z, then income groups, then whatever isn't grouped. */
export function sections(categories: Category[], groups: Group[]): { group: Group | null; items: Category[] }[] {
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
  const ordered = [...groups].sort((a, b) => (a.kind === b.kind ? byName(a, b) : a.kind === "income" ? 1 : -1));
  const known = new Set(groups.map((g) => g.id));
  const out: { group: Group | null; items: Category[] }[] = ordered.map((g) => ({ group: g, items: categories.filter((c) => c.groupId === g.id).sort(byName) }));
  const loose = categories.filter((c) => !c.groupId || !known.has(c.groupId)).sort(byName);
  if (loose.length) out.push({ group: null, items: loose });
  return out;
}

function HeaderButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <SpringPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: t.c.heroDeco, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name={icon} size={18} color={t.c.onHero} />
    </SpringPressable>
  );
}

function OptionRow({ label, selected, onPress, last }: { label: string; selected: boolean; onPress: () => void; last?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={{ flexDirection: "row", alignItems: "center", minHeight: 48, paddingHorizontal: t.space.space4, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.c.border, backgroundColor: selected ? t.c.primarySoft : "transparent" }}
    >
      <Txt variant="body" color={selected ? t.c.onPrimarySoft : t.c.ink} style={{ flex: 1, fontWeight: selected ? "600" : "400" }}>{label}</Txt>
      {selected ? <Icon name="check" size={18} color={t.c.onPrimarySoft} /> : null}
    </Pressable>
  );
}

/** The server's own sentence when it sent one ("There's already a group with that name."), else a fallback. */
function errorText(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError) {
    if (caught.status === 0) return caught.message;
    if (caught.reason && !/^http \d+$/.test(caught.reason)) return caught.reason;
  }
  return fallback;
}

/** Categories by group: just names. Add, rename, regroup or delete; groups can be added, renamed or removed. */
export function CategoryGroupsScreen() {
  const t = useTheme();
  const scrollTop = useScrollTopOnFocus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { workspaceId } = useActiveWorkspace();

  const load = useCallback(
    async (ws: string) => {
      const categoriesRes = await session.listCategories(ws);
      const groupsRes = await session.listCategoryGroups(ws).catch(() => ({ data: [] as Group[] }));
      return {
        categories: ((categoriesRes.data ?? []) as unknown as Category[]).map((c) => ({ ...c, groupId: c.groupId ?? null })),
        groups: (groupsRes.data ?? []) as Group[],
      };
    },
    [session],
  );
  const { data, loading, known, offline, error, refresh } = useLiveQuery(load, EMPTY, "category-groups");

  // Category sheet: null = closed, "new" = adding, otherwise the category being edited.
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [moveStep, setMoveStep] = useState(false);
  const [moveTo, setMoveTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Group sheet: null = closed, "new" = adding, otherwise the group being renamed.
  const [groupSheet, setGroupSheet] = useState<Group | "new" | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupKind, setGroupKind] = useState<"expense" | "income">("expense");
  /** Which side is being edited: expense groups and categories, or income ones. */
  const [side, setSide] = useState<"expense" | "income">("expense");

  const openCategory = (c: Category | "new", presetGroup: string | null = null) => {
    setEditing(c);
    setName(c === "new" ? "" : c.name);
    setGroupId(c === "new" ? presetGroup : c.groupId);
    setMoveStep(false);
    setMoveTo(null);
    setSheetError(null);
  };
  const closeCategory = () => setEditing(null);

  const saveCategory = async () => {
    if (!workspaceId || !editing) return;
    if (!name.trim()) {
      setSheetError("Enter a name.");
      return;
    }
    setBusy(true);
    try {
      if (editing === "new") {
        const group = data.groups.find((g) => g.id === groupId);
        await session.createCategory(workspaceId, { name: name.trim(), groupId, kind: group?.kind ?? side });
      } else {
        await session.patchCategory(workspaceId, editing.id, { name: name.trim(), groupId });
      }
      closeCategory();
      refresh();
    } catch (caught) {
      setSheetError(errorText(caught, "Couldn't save. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const deleteCategory = async () => {
    if (!workspaceId || !editing || editing === "new") return;
    setBusy(true);
    setSheetError(null);
    try {
      await session.deleteCategory(workspaceId, editing.id, moveStep ? moveTo : null);
      closeCategory();
      refresh();
    } catch (caught) {
      const message = errorText(caught, "Couldn't delete. Try again.");
      // In use: ask where its transactions and budget amounts should go, then try again.
      const inUse = caught instanceof ApiError && /in use/i.test(caught.reason);
      if (!moveStep && inUse) setMoveStep(true);
      else setSheetError(message);
    } finally {
      setBusy(false);
    }
  };

  const openGroup = (g: Group | "new") => {
    setGroupSheet(g);
    setGroupName(g === "new" ? "" : g.name);
    setGroupKind(g === "new" ? side : (g.kind as "expense" | "income"));
    setSheetError(null);
  };
  const saveGroup = async () => {
    if (!workspaceId || !groupSheet) return;
    if (!groupName.trim()) {
      setSheetError("Enter a name.");
      return;
    }
    setBusy(true);
    try {
      if (groupSheet === "new") await session.createCategoryGroup(workspaceId, { name: groupName.trim(), kind: groupKind });
      else await session.renameCategoryGroup(workspaceId, groupSheet.id, groupName.trim());
      setGroupSheet(null);
      refresh();
    } catch (caught) {
      setSheetError(errorText(caught, "Couldn't save. Try again."));
    } finally {
      setBusy(false);
    }
  };
  const deleteGroup = async () => {
    if (!workspaceId || !groupSheet || groupSheet === "new") return;
    setBusy(true);
    try {
      await session.deleteCategoryGroup(workspaceId, groupSheet.id);
      setGroupSheet(null);
      refresh();
    } catch (caught) {
      setSheetError(errorText(caught, "Couldn't delete. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const list = sections(
    data.categories.filter((c) => c.kind === side),
    data.groups.filter((g) => g.kind === side),
  );
  const sideWord = side === "income" ? "income" : "expense";
  // The group picker offers groups on the same side as the category.
  const pickerKind = editing && editing !== "new" ? editing.kind : side;
  const editingCategory = editing && editing !== "new" ? editing : null;
  const moveChoices = editingCategory ? data.categories.filter((c) => c.id !== editingCategory.id && c.kind === editingCategory.kind).sort((a, b) => a.name.localeCompare(b.name)) : [];

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView ref={scrollTop} contentContainerStyle={{ paddingBottom: t.space.space12 }}>
        <View style={{ backgroundColor: t.c.hero, paddingTop: insets.top + t.space.space3, paddingHorizontal: t.space.space4, paddingBottom: t.space.space4 }}>
          <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", gap: t.space.space4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
              <HeaderButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/transactions" as never))} />
              <Txt variant="titleMd" color={t.c.onHero} accessibilityRole="header" style={{ flex: 1 }}>Categories</Txt>
              <HeaderButton icon="plus" label={`Add ${sideWord} category`} onPress={() => openCategory("new")} />
            </View>
            <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 3, borderRadius: t.radius.radiusMd, backgroundColor: t.c.heroDeco }}>
              {(["expense", "income"] as const).map((k) => {
                const on = side === k;
                const count = data.categories.filter((c) => c.kind === k).length;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setSide(k)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={{ flex: 1, height: 36, borderRadius: t.radius.radiusSm, alignItems: "center", justifyContent: "center", backgroundColor: on ? t.c.onHero : "transparent" }}
                  >
                    <Txt variant="label" color={on ? t.c.hero : t.c.onHeroMuted}>{`${k === "expense" ? "Expense" : "Income"}${known ? ` · ${count}` : ""}`}</Txt>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", paddingHorizontal: t.space.space4, paddingTop: t.space.space2, gap: t.space.space2 }}>
          <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
          {loading && !known ? (
            <DefaultLoading />
          ) : (
            <>
              {list.length === 0 ? (
                <Txt variant="body" color={t.c.inkMuted} style={{ textAlign: "center", paddingTop: t.space.space8 }}>
                  {`No ${sideWord} groups yet. Create one, then add its categories.`}
                </Txt>
              ) : null}
              {list.map(({ group, items }) => (
                <View key={group?.id ?? "loose"} style={{ gap: t.space.space2, marginTop: t.space.space4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 4 }}>
                    <Txt variant="label" color={t.c.inkMuted} accessibilityRole="header" style={{ flex: 1 }}>
                      {group ? group.name : "Not grouped"}
                    </Txt>
                    {group ? (
                      <Pressable onPress={() => openGroup(group)} accessibilityRole="button" accessibilityLabel={`Edit group ${group.name}`} hitSlop={10}>
                        <Icon name="pencil" size={16} color={t.c.inkMuted} />
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
                    {items.map((c) => (
                        <Pressable
                          key={c.id}
                          onPress={() => openCategory(c)}
                          accessibilityRole="button"
                          accessibilityLabel={`${c.name}. Edit`}
                          android_ripple={{ color: t.c.surfaceAlt }}
                          style={{ flexDirection: "row", alignItems: "center", minHeight: 52, paddingHorizontal: t.space.space4, borderBottomWidth: 1, borderBottomColor: t.c.border }}
                        >
                          <Txt variant="body" style={{ flex: 1 }}>{c.name}</Txt>
                          <Icon name="chevron-right" size={16} color={t.c.inkMuted} />
                        </Pressable>
                      ))}
                    <Pressable
                      onPress={() => openCategory("new", group?.id ?? null)}
                      accessibilityRole="button"
                      accessibilityLabel={`Add a category to ${group ? group.name : "Not grouped"}`}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48, paddingHorizontal: t.space.space4 }}
                    >
                      <Icon name="plus" size={14} color={t.c.primary} />
                      <Txt variant="bodySm" color={t.c.primary} style={{ fontWeight: "500" }}>Add category</Txt>
                    </Pressable>
                  </View>
                </View>
              ))}
              <Pressable
                onPress={() => openGroup("new")}
                accessibilityRole="button"
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: t.space.space5 }}
              >
                <Icon name="plus" size={16} color={t.c.primary} />
                <Txt variant="label" color={t.c.primary}>{`New ${sideWord} group`}</Txt>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      <Sheet
        title={editing === "new" ? `New ${sideWord} category` : moveStep ? "Move its records" : "Edit category"}
        open={editing !== null}
        onClose={closeCategory}
        footer={
          moveStep ? (
            <View style={{ gap: t.space.space2 }}>
              <Button fullWidth variant="destructive" loading={busy} disabled={!moveTo} onPress={() => void deleteCategory()}>Move and delete</Button>
              <Button fullWidth variant="tertiary" onPress={() => setMoveStep(false)}>Back</Button>
            </View>
          ) : (
            <View style={{ gap: t.space.space2 }}>
              <Button fullWidth loading={busy} onPress={() => void saveCategory()}>Save</Button>
              {editingCategory ? (
                <Button fullWidth variant="tertiary" icon="trash-2" onPress={() => void deleteCategory()}>Delete category</Button>
              ) : null}
            </View>
          )
        }
      >
        {moveStep && editingCategory ? (
          <View style={{ gap: t.space.space3 }}>
            <Txt variant="body" color={t.c.inkMuted}>
              {`${editingCategory.name} is used by transactions or budgets. Choose where they should go before it's deleted.`}
            </Txt>
            <View style={{ borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
              {moveChoices.map((c, i) => (
                <OptionRow key={c.id} label={c.name} selected={moveTo === c.id} onPress={() => setMoveTo(c.id)} last={i === moveChoices.length - 1} />
              ))}
            </View>
            {moveChoices.length === 0 ? <Txt variant="bodySm" color={t.c.danger}>Add another category of the same type first.</Txt> : null}
            {sheetError ? <Txt variant="caption" color={t.c.danger}>{sheetError}</Txt> : null}
          </View>
        ) : (
          <View style={{ gap: t.space.space4 }}>
            <TextField label="Name" value={name} onChangeText={(v) => { setName(v); setSheetError(null); }} placeholder="Groceries" error={sheetError ?? undefined} />
            <View style={{ gap: t.space.space2 }}>
              <Txt variant="label">Group</Txt>
              <View style={{ borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
                {data.groups.filter((g) => g.kind === pickerKind).sort((a, b) => a.name.localeCompare(b.name)).map((g) => (
                  <OptionRow key={g.id} label={g.name} selected={groupId === g.id} onPress={() => setGroupId(g.id)} />
                ))}
                <OptionRow label="Not grouped" selected={groupId === null} onPress={() => setGroupId(null)} last />
              </View>
            </View>
            {editingCategory ? <Txt variant="caption" color={t.c.inkMuted}>{"Changes show up everywhere this category is used."}</Txt> : null}
          </View>
        )}
      </Sheet>

      <Sheet
        title={groupSheet === "new" ? `New ${sideWord} group` : "Edit group"}
        open={groupSheet !== null}
        onClose={() => setGroupSheet(null)}
        footer={
          <View style={{ gap: t.space.space2 }}>
            <Button fullWidth loading={busy} onPress={() => void saveGroup()}>Save</Button>
            {groupSheet && groupSheet !== "new" ? (
              <Button fullWidth variant="tertiary" icon="trash-2" onPress={() => void deleteGroup()}>Delete group</Button>
            ) : null}
          </View>
        }
      >
        <View style={{ gap: t.space.space4 }}>
          <TextField label="Name" value={groupName} onChangeText={(v) => { setGroupName(v); setSheetError(null); }} placeholder="Food and home" error={sheetError ?? undefined} />
          {groupSheet === "new" ? (
            <Txt variant="caption" color={t.c.inkMuted}>{"Then add its categories with Add category inside the group."}</Txt>
          ) : (
            <Txt variant="caption" color={t.c.inkMuted}>{"Deleting a group keeps its categories; they move to Not grouped."}</Txt>
          )}
        </View>
      </Sheet>
    </View>
  );
}
