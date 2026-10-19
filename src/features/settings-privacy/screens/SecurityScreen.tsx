import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, TextField, Txt, useTheme } from "@/design";
import { ScreenShell } from "@/lib/screen-shell";
import { useSession } from "@/state";

export function SecurityScreen() {
  const t = useTheme();
  const { session, user } = useSession();
  const [secret, setSecret] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const enabled = user?.totpEnabled === true;

  return (
    <ScreenShell title="Security">
      {error ? <Banner tone="danger" title={error} /> : null}
      <Txt variant="body" color={t.c.inkMuted}>
        Authenticator is optional. Sign-up never requires it.
      </Txt>
      {enabled ? (
        <View style={{ gap: t.space.space3 }}>
          <Txt>Authenticator is on.</Txt>
          <TextField label="Code to turn off" value={code} onChangeText={setCode} />
          <Button
            onPress={() => {
              void session.disableTotp(code).catch((e: Error) => setError(e.message));
            }}
          >
            Turn off MFA
          </Button>
        </View>
      ) : (
        <View style={{ gap: t.space.space3 }}>
          <Button
            onPress={() => {
              void session
                .startTotp()
                .then((res) => setSecret(res.data.secret))
                .catch((e: Error) => setError(e.message));
            }}
          >
            Turn on authenticator
          </Button>
          {secret ? <Txt selectable>Secret {secret}</Txt> : null}
          {secret ? (
            <>
              <TextField label="6-digit code" value={code} onChangeText={setCode} />
              <Button
                onPress={() => {
                  void session
                    .confirmTotp(code)
                    .then((res) => setCodes(res.data.backupCodes))
                    .catch((e: Error) => setError(e.message));
                }}
              >
                Confirm authenticator
              </Button>
            </>
          ) : null}
        </View>
      )}
      {codes.length ? (
        <View>
          <Txt variant="label">Backup codes</Txt>
          {codes.map((c) => (
            <Txt key={c}>{c}</Txt>
          ))}
        </View>
      ) : null}
    </ScreenShell>
  );
}
