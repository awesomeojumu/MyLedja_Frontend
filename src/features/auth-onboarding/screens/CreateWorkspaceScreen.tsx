import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Icon, TextField, Txt, useTheme } from "@/design";
import type { IconName } from "@/design";
import { AuthShell } from "@/features/auth-onboarding/components/AuthShell";
import { workspaceSelectable, type WorkspaceKind } from "@/features/auth-onboarding/services/auth-flow";

const OPTIONS: { kind: WorkspaceKind; title: string; body: string; icon: IconName }[] = [
  { kind: "personal", title: "Personal", body: "Just you. Your own money, private.", icon: "house" },
  { kind: "family", title: "Family", body: "Share with your household.", icon: "users" },
  { kind: "business", title: "Business", body: "Keep business money separate.", icon: "briefcase" },
];

export function CreateWorkspaceScreen({ onBack, onSubmit }: { onBack: () => void; onSubmit: () => void }) {
  const t = useTheme();
  const [kind, setKind] = useState<WorkspaceKind>("personal");
  const [name, setName] = useState("Personal");
  return (
    <AuthShell
      brand="setup"
      step={{ label: "Set up", current: 2, total: 3 }}
      onBack={onBack}
      title="Create your workspace"
      subtitle="A workspace holds your accounts, budgets and records."
      footer={
        <Button fullWidth size="lg" onPress={onSubmit}>
          Create workspace
        </Button>
      }
    >
      <View style={{ gap: t.space.space3 }}>
        {OPTIONS.map((option) => {
          const enabled = workspaceSelectable(option.kind);
          const selected = kind === option.kind;
          return (
            <Pressable
              key={option.kind}
              onPress={enabled ? () => { setKind(option.kind); setName(option.title); } : undefined}
              disabled={!enabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: !enabled }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: t.space.space3,
                padding: t.space.space4,
                borderRadius: t.radius.radiusLg,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? t.c.primary : t.c.border,
                backgroundColor: selected ? t.c.primarySoft : t.c.surface,
                opacity: enabled ? 1 : 0.55,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: t.radius.radiusMd,
                  backgroundColor: selected ? t.c.surface : t.c.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={option.icon} size={20} color={t.c.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="label" style={{ fontWeight: "600" }}>
                  {option.title}
                </Txt>
                <Txt variant="caption" color={t.c.inkMuted}>
                  {option.body}
                </Txt>
              </View>
              {enabled ? (
                selected ? <Icon name="circle-check" size={22} color={t.c.primary} /> : null
              ) : (
                <View style={{ backgroundColor: t.c.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                  <Txt variant="caption" color={t.c.inkMuted}>
                    Coming later
                  </Txt>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <TextField label="Workspace name" value={name} onChangeText={setName} helper="Only you can see this name." />
    </AuthShell>
  );
}
