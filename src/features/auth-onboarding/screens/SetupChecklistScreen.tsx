import { Pressable, View } from "react-native";
import { Button, Icon, ProgressRing, Txt, useTheme } from "@/design";
import { AuthShell } from "@/features/auth-onboarding/components/AuthShell";
import { TextLink } from "@/features/auth-onboarding/components/TextLink";
import { EMPTY_SETUP, nextSetupStep, setupSteps, type SetupProgress } from "@/features/auth-onboarding/services/setup-progress";

export function SetupChecklistScreen({
  onBack,
  onContinue,
  onSkip,
  progress = EMPTY_SETUP,
}: {
  onBack: () => void;
  onContinue: () => void;
  onSkip: () => void;
  progress?: SetupProgress;
}) {
  const t = useTheme();
  const steps = setupSteps(progress);
  const next = nextSetupStep(progress);
  const doneCount = steps.filter((step) => step.done).length;
  return (
    <AuthShell
      brand="setup"
      step={{ label: "Set up", current: 3, total: 3 }}
      onBack={onBack}
      footer={
        <View style={{ gap: t.space.space3, alignItems: "stretch" }}>
          <Button fullWidth size="lg" icon="landmark" onPress={onContinue}>
            {next?.title ?? "Go to Home"}
          </Button>
          <View style={{ alignItems: "center" }}>
            <TextLink onPress={onSkip}>Skip for now and go to Home</TextLink>
          </View>
        </View>
      }
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: t.space.space4 }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Txt variant="titleLg" accessibilityRole="header">
            Let’s get your money in
          </Txt>
          <Txt color={t.c.inkMuted}>Five quick steps. Skip any and come back later.</Txt>
        </View>
        <ProgressRing value={doneCount} max={steps.length} label="Setup" size={56} tone="primary" />
      </View>
      <View style={{ backgroundColor: t.c.surface, borderRadius: t.radius.radiusLg, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
        {steps.map((step, i) => (
          <Pressable
            key={step.key}
            onPress={step.done ? undefined : onContinue}
            accessibilityRole="button"
            accessibilityState={{ disabled: step.done }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: t.space.space3,
              padding: t.space.space4,
              borderBottomWidth: i === steps.length - 1 ? 0 : 1,
              borderBottomColor: t.c.border,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: t.radius.radiusMd,
                backgroundColor: step.done ? t.c.positiveSoft : t.c.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={step.done ? "check" : "chevron-right"} size={18} color={step.done ? t.c.positive : t.c.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="label" style={{ fontWeight: "600" }}>
                {step.title}
              </Txt>
              <Txt variant="caption" color={t.c.inkMuted}>
                {step.body}
              </Txt>
            </View>
            <Icon name={step.done ? "circle-check" : "chevron-right"} size={18} color={step.done ? t.c.positive : t.c.inkMuted} />
          </Pressable>
        ))}
      </View>
    </AuthShell>
  );
}
