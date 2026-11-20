// Permanently delete the signed-in member's account and profile. Required by the App Store.
// Password accounts must enter their current password, checked here before anything is deleted.
// Sign in with Apple accounts confirm with Apple again just before (the sign-in must be from the last 10 minutes).
// If an Apple sign-in key is set (APPLE_SIGNIN_KEY, APPLE_SIGNIN_KEY_ID), the account is also disconnected from
// the person's Apple ID; otherwise the app tells them how to do that in Settings.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose@5';

const APPLE_CLIENT_ID = 'com.forewheelsdetailing.app';
const APPLE_TEAM_ID = Deno.env.get('APPLE_TEAM_ID') ?? 'NVKSSW8ZV6';

async function revokeApple(code: string): Promise<{ ok: boolean; detail?: string }> {
  const pem = Deno.env.get('APPLE_SIGNIN_KEY');
  const kid = Deno.env.get('APPLE_SIGNIN_KEY_ID');
  if (!pem || !kid) return { ok: false, detail: 'no-key' };
  const key = await importPKCS8(pem.replace(/\\n/g, '\n').trim(), 'ES256');
  const now = Math.floor(Date.now() / 1000);
  const secret = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid })
    .setIssuer(APPLE_TEAM_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setAudience('https://appleid.apple.com')
    .setSubject(APPLE_CLIENT_ID)
    .sign(key);
  const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  const tok = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST', headers,
    body: form({ client_id: APPLE_CLIENT_ID, client_secret: secret, code, grant_type: 'authorization_code' }),
  });
  const t = await tok.json().catch(() => ({}));
  const token: string | undefined = t.refresh_token ?? t.access_token;
  if (!tok.ok || !token) return { ok: false, detail: `token-${tok.status}` };
  const rev = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST', headers,
    body: form({ client_id: APPLE_CLIENT_ID, client_secret: secret, token, token_type_hint: t.refresh_token ? 'refresh_token' : 'access_token' }),
  });
  return rev.ok ? { ok: true } : { ok: false, detail: `revoke-${rev.status}` };
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: who } = await asUser.auth.getUser();
    if (!who.user || who.user.is_anonymous) return json({ error: 'Sign in first.' }, 401);
    const { password, appleCode } = await req.json().catch(() => ({ password: '', appleCode: '' }));
    const providers: string[] = (who.user.app_metadata?.providers as string[] | undefined) ?? [who.user.app_metadata?.provider as string].filter(Boolean);
    const noPassword = providers.length > 0 && !providers.includes('email');
    if (noPassword) {
      const last = who.user.last_sign_in_at ? Date.parse(who.user.last_sign_in_at) : 0;
      if (Date.now() - last > 10 * 60 * 1000) return json({ error: 'Confirm with Apple again, then delete.', code: 'password' }, 403);
    } else {
      if (!who.user.email || typeof password !== 'string' || !password) return json({ error: 'Enter your current password.', code: 'password' }, 400);
      const check = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error: wrong } = await check.auth.signInWithPassword({ email: who.user.email, password });
      if (wrong) return json({ error: 'That password isn’t right.', code: 'password' }, 403);
      await check.auth.signOut().catch(() => undefined);
    }
    let apple: { ok: boolean; detail?: string } | undefined;
    if (typeof appleCode === 'string' && appleCode) apple = await revokeApple(appleCode).catch(() => ({ ok: false, detail: 'error' }));
    else if (noPassword) apple = { ok: false, detail: 'no-code' };
    // Only the account itself can be deleted, so the id comes from the signed-in session.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await admin.auth.admin.deleteUser(who.user.id);
    if (error) return json({ error: 'Could not delete the account. Try again.' }, 500);
    return json({ ok: true, appleRevoked: apple?.ok, appleDetail: apple?.detail });
  } catch (e) {
    console.error('delete-account', e);
    return json({ error: 'Could not delete the account. Try again.' }, 500);
  }
});
