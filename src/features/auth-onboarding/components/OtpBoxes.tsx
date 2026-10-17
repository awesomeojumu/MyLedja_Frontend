import { useRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Txt, useTheme } from "@/design";
import { OTP_LENGTH } from "@/features/auth-onboarding/otp";

export function OtpBoxes({
  value,
  onChange,
  length = OTP_LENGTH,
  label = "Security code",
}: {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  label?: string;
}) {
  const t = useTheme();
  const input = useRef<TextInput>(null);
  const digits = value.replace(/\D/g, "").slice(0, length);
  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityRole="none" style={{ position: "relative" }}>
      <View style={{ flexDirection: "row", gap: t.space.space2 }}>
        {Array.from({ length }, (_, i) => {
          const active = digits.length === i || (digits.length === length && i === length - 1);
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 56,
                borderRadius: t.radius.radiusMd,
                borderWidth: active ? 2 : 1,
                borderColor: active ? t.c.focus : t.c.borderStrong,
                backgroundColor: t.c.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Txt variant="titleMd">{digits[i] ?? ""}</Txt>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={digits}
        onChangeText={(next) => onChange(next.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        accessibilityLabel={label}
        caretHidden
        style={{ position: "absolute", opacity: 0.02, width: "100%", height: "100%" }}
      />
    </Pressable>
  );
}
