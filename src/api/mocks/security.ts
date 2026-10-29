import type { TransportRequest, TransportResponse } from '../client';

/** Mock answers for Phase 3 security and data routes, so Settings works with the mock adapter. */
export function createSecurityMock() {
  let twoFactorOn = false;
  let rechecked = false;
  let pendingEmail: string | null = null;
  const passkeys: { id: string; name: string; createdAt: string; lastUsedAt: string | null }[] = [];
  const ok = (body: unknown = null, status = 200): TransportResponse => ({ status, body });
  const codes = () => Array.from({ length: 10 }, (_, i) => `ab${i}d-ef${i}h`);
  const status = () => ({ hasPassword: true, twoFactorOn, backupCodesLeft: twoFactorOn ? 10 : 0, passkeys, recheckedUntil: rechecked ? new Date(Date.now() + 900_000).toISOString() : null });
  const needsRecheck = (): TransportResponse | null => (rechecked ? null : { status: 403, body: { code: 'recheck_needed', message: "Confirm it's you to continue." } });

  return (req: TransportRequest): TransportResponse | null => {
    const key = `${req.method} ${req.path.split('?')[0]}`;
    switch (key) {
      case 'GET /v1/me/security':
        return ok(status());
      case 'POST /v1/auth/recheck':
      case 'POST /v1/auth/recheck/google':
        rechecked = true;
        return ok(status());
      case 'POST /v1/auth/two-factor': {
        const body = req.body as { code?: string; backupCode?: string; challengeToken?: string } | null;
        if (!body?.challengeToken) return { status: 401, body: { code: 'challenge_ended', message: 'This sign-in has timed out. Sign in again.' } };
        if (body.backupCode === 'used-once') return { status: 401, body: { code: 'code_wrong', message: "That backup code isn't right, or it was already used." } };
        if (body.code && body.code !== '123456') return { status: 401, body: { code: 'code_wrong', message: "That code isn't right. Check your authenticator app and try again." } };
        if (body.backupCode && body.backupCode !== 'abcd-efgh') return { status: 401, body: { code: 'code_wrong', message: "That backup code isn't right, or it was already used." } };
        return ok({
          accessToken: 'access-2fa',
          accessTokenExpiresIn: 900,
          refreshToken: 'refresh-2fa',
          trustedDeviceToken: 'trusted-demo',
          user: {
            id: 'user-ada',
            name: 'Ada',
            email: 'ada@example.test',
            setupComplete: true,
            workspaceId: 'ws-personal',
            workspaceName: 'Personal',
          },
        });
      }
      case 'POST /v1/auth/passkey/options':
        return ok({ challengeToken: 'passkey-challenge', options: { challenge: 'abc', rpId: 'localhost' } });
      case 'POST /v1/auth/passkey':
        return { status: 401, body: { code: 'passkey_failed', message: "That passkey didn't work. Try again or use your password." } };
      case 'POST /v1/me/two-factor/setup':
        return ok({ secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/MyLedja:ada@example.test?secret=JBSWY3DPEHPK3PXP&issuer=MyLedja', qrSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/></svg>' });
      case 'POST /v1/me/two-factor/confirm':
        twoFactorOn = true;
        return ok({ backupCodes: codes() });
      case 'POST /v1/me/two-factor/backup-codes':
        return needsRecheck() ?? ok({ backupCodes: codes() });
      case 'DELETE /v1/me/two-factor':
        if (!rechecked) return needsRecheck();
        twoFactorOn = false;
        return ok(null, 204);
      case 'GET /v1/me/sessions':
        return ok({ sessions: [{ id: '00000000-0000-7000-8000-000000000001', deviceName: 'This device', staysSignedIn: false, createdAt: new Date().toISOString(), lastUsedAt: new Date().toISOString(), current: true }] });
      case 'POST /v1/me/password':
        return ok(null, 204);
      case 'POST /v1/me/email/request': {
        const blocked = needsRecheck();
        if (blocked) return blocked;
        const email = String((req.body as { email?: string } | null)?.email ?? '').toLowerCase();
        if (email === 'taken@example.test') return { status: 409, body: { code: 'email_in_use', message: "That email can't be used" } };
        pendingEmail = email;
        return ok(null, 204);
      }
      case 'POST /v1/me/email/confirm': {
        const body = req.body as { email?: string; code?: string } | null;
        if (!pendingEmail || body?.email?.toLowerCase() !== pendingEmail) return { status: 400, body: { code: 'email_code_wrong', message: "That code doesn't match" } };
        if (body?.code !== '123456') return { status: 400, body: { code: 'email_code_wrong', message: "That code doesn't match" } };
        const email = pendingEmail;
        pendingEmail = null;
        return ok({ email });
      }
      case 'POST /v1/me/restore/preview':
        return ok({ workspaceName: 'Personal', createdAt: new Date().toISOString(), accounts: 3, transactions: 42, firstDate: '2026-10-01', lastDate: '2026-10-28', categories: 12, goals: 1, debts: 1, bills: 2 });
      case 'POST /v1/me/restore': {
        const blocked = needsRecheck();
        if (blocked) return blocked;
        const name = String((req.body as { workspaceName?: string } | null)?.workspaceName ?? 'Personal (restored)');
        return ok({ workspaceId: 'ws-restored', workspaceName: name }, 201);
      }
      case 'POST /v1/me/delete':
        return needsRecheck() ?? ok({ deletingWorkspaces: 1 }, 202);
      default:
        break;
    }
    if (req.method === 'GET' && /^\/v1\/workspaces\/[^/]+\/activity$/.test(req.path.split('?')[0]!)) return ok({ events: [], nextBefore: null });
    if (req.method === 'POST' && /\/exports\/transactions$/.test(req.path)) return needsRecheck() ?? ok({ filename: 'myledja-transactions.csv', mimeType: 'text/csv', content: 'Date,Type,Account,Category,Payee,Amount,Currency,Notes,Status' });
    if (req.method === 'POST' && /\/backups$/.test(req.path)) return needsRecheck() ?? ok({ filename: 'myledja-backup.json', mimeType: 'application/json', content: '{}' });
    if (req.method === 'DELETE' && req.path.startsWith('/v1/me/passkeys/')) return ok(null, 204);
    // Phase 4 with the mock adapter: AI and banks are off, statements can't be read without the real API.
    const path = req.path.split('?')[0]!;
    if (req.method === 'GET' && /\/ai$/.test(path)) return ok({ available: { claude: false, gemini: false }, consent: { categorize: false, statements: false, healthAdvice: false, updatedAt: null } });
    if (req.method === 'PUT' && /\/ai\/consent$/.test(path)) return ok({ available: { claude: false, gemini: false }, consent: { ...(req.body as object), updatedAt: new Date().toISOString() } });
    if (req.method === 'GET' && /\/banking\/links$/.test(path)) return ok({ links: [], available: false });
    if (req.method === 'POST' && /\/imports\/statement$/.test(path)) return { status: 400, body: { code: 'statement_unreadable', message: "MyLedja couldn't find transactions in this statement. Turn on AI statement reading in Settings, or upload a CSV." } };
    return null;
  };
}
