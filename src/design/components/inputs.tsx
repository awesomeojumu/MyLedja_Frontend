/* Inputs: TextField, AmountInput, AmountDisplay, Select, CategoryPicker, DatePicker. Amounts use the phone's number keyboard. */
import React, { useRef, useState } from 'react';
import { KeyboardTypeOptions, Platform, Pressable, Text, TextInput, TextInputProps, View } from 'react-native';

import { useTheme } from "@/design/theme";
import { a11yState, textContentTypeFor } from "@/design/a11y";
import { cleanAmount, EXPENSE_CATEGORIES, formatDateDMY, parseDateInput, toIsoDate } from "@/design/format";
import { IconName } from "@/design/icons";
import { CategoryIcon, Icon, Txt } from "@/design/components/foundations";
import { Chip, IconButton } from "@/design/components/actions";
import { Sheet } from "@/design/components/surfaces";

/* The web focus outline is also cleared globally in theme.tsx; RN types only allow outlineWidth here. */
const hideBrowserOutline = Platform.OS === 'web' ? { outlineWidth: 0 } : null;

function FieldShell({ label, helper, error, children }: { label?: string; helper?: string; error?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt variant="label">{label}</Txt> : null}
      {children}
      {error ? (
        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }} accessibilityRole="alert">
          <Icon name="circle-alert" size={14} color={t.c.danger} /><Txt variant="caption" color={t.c.danger}>{error}</Txt>
        </View>
      ) : helper ? <Txt variant="caption" color={t.c.inkMuted}>{helper}</Txt> : null}
    </View>
  );
}

export interface TextFieldProps { label?: string; helper?: string; error?: string; icon?: IconName; placeholder?: string; value?: string; defaultValue?: string; onChangeText?: (v: string) => void; onFocus?: () => void; keyboardType?: KeyboardTypeOptions; autoCapitalize?: 'none' | 'sentences' | 'words'; returnKeyType?: 'done' | 'next' | 'search'; secureTextEntry?: boolean;
  /** Says what the field holds, so password managers and assistive tech can fill it (WCAG 1.3.5). */
  autoComplete?: TextInputProps['autoComplete'] }
export function TextField({ label, helper, error, icon, placeholder, value, defaultValue, onChangeText, onFocus, keyboardType, autoCapitalize = 'sentences', returnKeyType, secureTextEntry, autoComplete }: TextFieldProps) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  const [hidden, setHidden] = useState(true);
  const secret = !!secureTextEntry && hidden;
  return (
    <FieldShell label={label} helper={helper} error={error}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 12, borderRadius: t.radius.radiusMd, backgroundColor: t.c.surface,
        borderWidth: focus ? 2 : 1, borderColor: error ? t.c.danger : focus ? t.c.focus : t.c.borderStrong }}>
        {icon ? <Icon name={icon} size={18} color={t.c.inkMuted} /> : null}
        <TextInput accessibilityLabel={label ?? placeholder} accessibilityHint={secureTextEntry ? 'Secure text field' : undefined} placeholder={placeholder} placeholderTextColor={t.c.inkMuted} value={value} defaultValue={defaultValue}
          onChangeText={onChangeText} onFocus={() => { setFocus(true); onFocus?.(); }} onBlur={() => setFocus(false)} keyboardType={keyboardType} autoCapitalize={autoCapitalize} returnKeyType={returnKeyType} autoComplete={autoComplete}
          textContentType={textContentTypeFor(autoComplete)}
          secureTextEntry={secret} style={[t.text('body'), { flex: 1, color: t.c.ink, paddingVertical: 10 }, hideBrowserOutline]} maxFontSizeMultiplier={2} />
        {secureTextEntry ? (
          <Pressable onPress={() => setHidden((v) => !v)} accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'} hitSlop={8}>
            <Icon name={hidden ? 'eye' : 'eye-off'} size={18} color={t.c.inkMuted} />
          </Pressable>
        ) : null}
      </View>
    </FieldShell>
  );
}

/** Inline amount field for tables and filters. The add form uses the bigger AmountDisplay. */
export function AmountInput({ label, value, onChange, currency = 'NGN', error, helper }: { label?: string; value: string; onChange: (v: string) => void; currency?: string; error?: string; helper?: string }) {
  const t = useTheme();
  return (
    <FieldShell label={label} helper={helper} error={error}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 56, paddingHorizontal: 12, borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: error ? t.c.danger : t.c.borderStrong, backgroundColor: t.c.surface }}>
        <Txt variant="amountLg" color={t.c.inkMuted}>₦</Txt>
        <TextInput
          value={value}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0.00"
          placeholderTextColor={t.c.inkMuted}
          accessibilityLabel={label ?? `Amount in ${currency}`}
          onChangeText={(s) => {
            const raw = s.replace(/[^0-9.]/g, "");
            const dot = raw.indexOf(".");
            onChange(dot === -1 ? raw : `${raw.slice(0, dot)}.${raw.slice(dot + 1).replace(/\./g, "").slice(0, 2)}`);
          }}
          style={[t.text("amountLg"), { flex: 1, minWidth: 0, color: t.c.ink }, hideBrowserOutline]}
        />
        <Txt variant="caption" color={t.c.inkMuted} style={{ fontWeight: "600" }}>{currency}</Txt>
      </View>
    </FieldShell>
  );
}

export interface AmountDisplayProps { value?: string; defaultValue?: string; onChange?: (value: string) => void; kind?: 'expense' | 'income' | 'transfer' | 'neutral'; error?: string; hint?: string; label?: string; autoFocus?: boolean }
/** The big amount field, typed with the phone's decimal keyboard. Untyped kobo shows in grey. */
export function AmountDisplay({ value, defaultValue, onChange, kind = 'neutral', error, hint, label = 'Amount in naira', autoFocus }: AmountDisplayProps) {
  const t = useTheme();
  const input = useRef<TextInput>(null);
  const [own, setOwn] = useState(defaultValue ?? '');
  const [focus, setFocus] = useState(false);
  const v = value ?? own;
  const [whole, kobo] = v.split('.');
  const shown = (whole ? Number(whole).toLocaleString('en-NG') : '') + (kobo != null ? '.' + kobo : '');
  const ghost = !v ? '.00' : kobo == null ? '.00' : '00'.slice(kobo.length);
  const color = error ? t.c.danger : !v ? t.c.inkMuted : kind === 'income' ? t.c.positive : kind === 'transfer' ? t.c.transfer : kind === 'expense' ? t.c.negative : t.c.ink;
  const sign = v ? (kind === 'expense' ? '−' : kind === 'income' ? '+' : '') : '';
  const big = t.text('amountHero');
  const change = (s: string) => { const c = cleanAmount(s); if (value === undefined) setOwn(c); onChange?.(c); };
  return (
    <Pressable onPress={() => input.current?.focus()} accessible={false} style={{ alignItems: 'center', gap: 4, paddingVertical: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', maxWidth: '100%', minWidth: 0, paddingHorizontal: 12, paddingBottom: 4, borderBottomWidth: 2, borderBottomColor: error ? t.c.danger : focus ? t.c.focus : t.c.borderStrong }}>
        <Text style={[big, { fontSize: 40, lineHeight: 46, color }]}>{sign}</Text>
        <Text style={[big, { fontSize: 28, color, marginRight: 2 }]}>₦</Text>
        <TextInput ref={input} value={shown} onChangeText={change} keyboardType="decimal-pad" inputMode="decimal" placeholder="0" placeholderTextColor={t.c.inkMuted}
          autoFocus={autoFocus} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} accessibilityLabel={label} accessibilityHint={error ?? hint}
          style={[big, { fontSize: 40, lineHeight: 46, color, padding: 0, minWidth: 24, flexShrink: 1, textAlign: 'right' }, hideBrowserOutline]} maxFontSizeMultiplier={1.5} />
        <Text style={[big, { fontSize: 40, lineHeight: 46, color: t.c.inkMuted }]}>{ghost}</Text>
      </View>
      {error
        ? <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }} accessibilityRole="alert"><Icon name="circle-alert" size={14} color={t.c.danger} /><Txt variant="caption" color={t.c.danger}>{error}</Txt></View>
        : <Txt variant="caption" color={t.c.inkMuted}>{hint ?? 'Enter naira and kobo (e.g., ₦4,500.50)'}</Txt>}
    </Pressable>
  );
}

export interface SelectProps { label: string; options: { value: string; label: string }[]; value?: string; defaultValue?: string; onChange?: (v: string) => void; placeholder?: string; helper?: string; error?: string }
/** A field that opens a list in a Sheet. */
export function Select({ label, options, value, defaultValue, onChange, placeholder = 'Choose', helper, error }: SelectProps) {
  const t = useTheme();
  const [own, setOwn] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const cur = value !== undefined ? value : own;
  const chosen = options.find((o) => o.value === cur);
  return (
    <FieldShell label={label} helper={helper} error={error}>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${chosen?.label ?? placeholder}`}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 12, borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: error ? t.c.danger : t.c.borderStrong, backgroundColor: t.c.surface }}>
        <Txt style={{ flex: 1 }} color={chosen ? t.c.ink : t.c.inkMuted}>{chosen?.label ?? placeholder}</Txt>
        <Icon name="chevron-down" size={18} color={t.c.inkMuted} />
      </Pressable>
      <Sheet title={label} open={open} onClose={() => setOpen(false)}>
        <View>
          {options.map((o) => {
            const on = o.value === cur;
            return (
              <Pressable key={o.value} accessibilityRole="radio" {...a11yState({ checked: on })} onPress={() => { if (value === undefined) setOwn(o.value); onChange?.(o.value); setOpen(false); }}
                style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 8, borderRadius: t.radius.radiusSm, backgroundColor: on ? t.c.surfaceAlt : 'transparent' }}>
                <Txt style={{ flex: 1, fontWeight: on ? '600' : '400' }}>{o.label}</Txt>{on ? <Icon name="check" size={18} color={t.c.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </FieldShell>
  );
}

export interface CategoryPickerProps { label?: string; categories?: string[]; value?: string; defaultValue?: string; onChange?: (c: string) => void }
/** A field that opens the full searchable category list. */
export function CategoryPicker({ label = 'Category', categories = EXPENSE_CATEGORIES, value, defaultValue, onChange }: CategoryPickerProps) {
  const t = useTheme();
  const [own, setOwn] = useState(defaultValue ?? categories[0]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const cur = value !== undefined ? value : own;
  const pick = (c: string) => { if (value === undefined) setOwn(c); onChange?.(c); setOpen(false); setQ(''); };
  const shown = categories.filter((c) => !q || c.toLowerCase().includes(q.toLowerCase()));
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="label">{label}</Txt>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}: ${cur}. Show all ${categories.length}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, paddingHorizontal: 10, borderRadius: t.radius.radiusMd, borderWidth: 1, borderColor: t.c.borderStrong, backgroundColor: t.c.surface }}>
        <CategoryIcon category={cur} size="sm" />
        <Txt style={{ flex: 1, fontWeight: '500' }} numberOfLines={1}>{cur}</Txt>
        <Txt variant="caption" color={t.c.inkMuted}>All {categories.length}</Txt>
        <Icon name="chevron-down" size={18} color={t.c.inkMuted} />
      </Pressable>
      <Sheet title={label} open={open} onClose={() => setOpen(false)}>
        <TextField icon="search" placeholder="Search categories" value={q} onChangeText={setQ} returnKeyType="search" />
        <View>
          {shown.map((c) => {
            const on = c === cur;
            return (
              <Pressable key={c} onPress={() => pick(c)} accessibilityRole="radio" {...a11yState({ checked: on })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingHorizontal: 8, borderRadius: t.radius.radiusSm, backgroundColor: on ? t.c.surfaceAlt : 'transparent' }}>
                <CategoryIcon category={c} size="sm" /><Txt style={{ flex: 1, fontWeight: on ? '600' : '400' }}>{c}</Txt>{on ? <Icon name="check" size={18} color={t.c.primary} /> : null}
              </Pressable>
            );
          })}
          {shown.length ? null : <Txt variant="bodySm" color={t.c.inkMuted} style={{ padding: 12 }}>No category called “{q}”. Use Other and say what it was in the description.</Txt>}
        </View>
      </Sheet>
    </View>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function asIso(value?: string, fallback = new Date()): string {
  return toIsoDate(parseDateInput(value) ?? fallback);
}
export interface DatePickerProps { label?: string; value?: string; defaultValue?: string; onChange?: (isoDate: string) => void; today?: string; noFuture?: boolean; presets?: boolean }
/** Month grid, weeks start Monday, with Today/Yesterday shortcuts. Selected date reads DD/MM/YYYY. */
export function DatePicker({ label = 'Choose a date', value, defaultValue, onChange, today, noFuture, presets = true }: DatePickerProps) {
  const t = useTheme();
  const now = parseDateInput(today) ?? new Date();
  const [own, setOwn] = useState(asIso(defaultValue, now));
  const cur = parseDateInput(value) ? asIso(value, now) : own;
  const sel = parseDateInput(cur) ?? now;
  const [month, setMonth] = useState(new Date(sel.getFullYear(), sel.getMonth(), 1));
  const set = (d: Date) => { const s = toIsoDate(d); if (value === undefined) setOwn(s); onChange?.(s); };
  const first = (month.getDay() + 6) % 7, days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  return (
    <View accessibilityLabel={label} style={{ gap: 12, padding: 16, borderRadius: t.radius.radiusLg, borderWidth: 1, borderColor: t.c.borderStrong, backgroundColor: t.c.surface }}>
      {presets ? (
        <View accessibilityRole="radiogroup" accessibilityLabel="Quick dates" style={{ flexDirection: 'row', gap: 8 }}>
          {[['Today', 0], ['Yesterday', -1]].map(([l, off]) => {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (off as number));
            return <Chip key={l as string} role="radio" selected={toIsoDate(d) === cur} onPress={() => { set(d); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>{l}</Chip>;
          })}
        </View>
      ) : null}
      <Txt variant="titleSm" accessibilityLiveRegion="polite">
        {formatDateDMY(cur)}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconButton icon="chevron-left" label="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
        <Txt variant="titleSm" accessibilityLiveRegion="polite">{MONTHS[month.getMonth()]} {month.getFullYear()}</Txt>
        <IconButton icon="chevron-right" label="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <Txt key={d} variant="caption" color={t.c.inkMuted} style={{ width: '14.28%', textAlign: 'center', paddingVertical: 4 }}>{d}</Txt>)}
        {cells.map((d, i) => {
          if (!d) return <View key={'e' + i} style={{ width: '14.28%', height: 44 }} />;
          const k = toIsoDate(d), on = k === cur, isToday = k === toIsoDate(now), fut = !!noFuture && d > now;
          return (
            <Pressable key={k} disabled={fut} onPress={() => set(d)} accessibilityRole="button" {...a11yState({ selected: on, disabled: fut })}
              accessibilityLabel={`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}${isToday ? ', today' : ''}`}
              style={{ width: '14.28%', height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.c.primary : 'transparent', borderWidth: isToday && !on ? 1 : 0, borderColor: t.c.primary }}>
                <Txt variant="bodySm" color={on ? t.c.onPrimary : fut ? t.c.borderStrong : t.c.ink} style={{ fontWeight: on || isToday ? '600' : '400', fontVariant: ['tabular-nums'] }}>{d.getDate()}</Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
