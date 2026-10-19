import { useRouter } from "expo-router";
import { afterPasskey, PasskeyScreen } from "@/features/auth-onboarding";
import { useSession } from "@/state";

export default function PasskeyRoute() {
  const router = useRouter();
  const { session } = useSession();
  return (
    <PasskeyScreen
      onSkip={() => router.push(afterPasskey())}
      onCreate={async () => {
        const start = await session.passkeyStart();
        const opts = start.data;
        const challengeB64 = String(opts.challenge);
        const cred = await navigator.credentials.create({
          publicKey: {
            challenge: Uint8Array.from(atob(padB64(challengeB64)), (c) => c.charCodeAt(0)),
            rp: opts.rp as PublicKeyCredentialCreationOptions["rp"],
            user: {
              id: Uint8Array.from(String((opts.user as { id: string }).id), (c) => c.charCodeAt(0)),
              name: String((opts.user as { name: string }).name),
              displayName: String((opts.user as { displayName: string }).displayName),
            },
            pubKeyCredParams: [{ type: "public-key", alg: -7 }],
            timeout: 60_000,
            attestation: "none",
          },
        });
        if (!cred || cred.type !== "public-key") throw new Error("Passkey ceremony incomplete.");
        const pk = cred as PublicKeyCredential;
        const att = pk.response as AuthenticatorAttestationResponse;
        const b64 = (buf: ArrayBuffer) =>
          btoa(String.fromCharCode(...new Uint8Array(buf)))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");
        await session.passkeyFinish({
          id: pk.id,
          clientDataJSON: b64(att.clientDataJSON),
          publicKey: att.getPublicKey ? b64(att.getPublicKey() ?? new ArrayBuffer(0)) : "",
        });
        router.push(afterPasskey());
      }}
    />
  );
}

function padB64(value: string): string {
  const std = value.replace(/-/g, "+").replace(/_/g, "/");
  return std + "=".repeat((4 - (std.length % 4)) % 4);
}
