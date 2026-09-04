import { supabaseAdmin } from './supabase.js';
import { listAuthUsers } from './repo.js';

export type InviteEmailVia = 'supabase' | 'resend' | 'none';

export interface InviteEmailResult {
  delivered: boolean;
  via: InviteEmailVia;
  error?: string;
}

/**
 * Sends a campaign invite by whichever leg fits the address (Issue 17, WorkPlan-0.37.0.md):
 * Supabase Auth's `inviteUserByEmail` *creates an auth user*, so it only works for an address
 * with no account yet; Resend can mail anyone but can't get a brand-new user through signup.
 * Neither alone covers both cases.
 *
 * Looks the address up first to pick a leg — reusing `listAuthUsers()` (the same auth+profiles
 * join `admin.ts`'s own user list already relies on) rather than a second, separate paginated
 * `supabaseAdmin.auth.admin.listUsers()` call from this module.
 *
 * **Never throws.** A provider failure returns `delivered: false` with the message — sending an
 * invite must not fail because email is down, since the invite code still works by hand
 * regardless of what this returns.
 */
export async function sendInviteEmail({
  to,
  campaignName,
  code,
  link,
}: {
  to: string;
  campaignName: string;
  code: string;
  link: string;
}): Promise<InviteEmailResult> {
  try {
    const users = await listAuthUsers();
    const hasAccount = users.some((u) => u.Email.toLowerCase() === to.toLowerCase());
    return hasAccount ? await sendViaResend({ to, campaignName, code, link }) : await sendViaSupabase({ to, link });
  } catch (err) {
    return { delivered: false, via: 'none', error: err instanceof Error ? err.message : String(err) };
  }
}

async function sendViaSupabase({ to, link }: { to: string; link: string }): Promise<InviteEmailResult> {
  try {
    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(to, { redirectTo: link });
    if (error) return { delivered: false, via: 'supabase', error: error.message };
    return { delivered: true, via: 'supabase' };
  } catch (err) {
    return { delivered: false, via: 'supabase', error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * The HTTPS API via native `fetch`, not SMTP — raw TCP is blocked in the sandboxes this project
 * is developed in (see CLAUDE.md's "Sandbox network constraints"), so an SMTP client could never
 * even be smoke-tested here, and `fetch` is native on Node 22 so this needs no new npm
 * dependency. With `RESEND_API_KEY` unset this leg no-ops with `via: 'none'` — local dev and CI
 * must not need a mail provider configured.
 */
async function sendViaResend({
  to,
  campaignName,
  code,
  link,
}: {
  to: string;
  campaignName: string;
  code: string;
  link: string;
}): Promise<InviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { delivered: false, via: 'none' };
  const from = process.env.INVITE_FROM_EMAIL || 'invites@asohav.app';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `You're invited to ${campaignName}`,
        html:
          `<p>You've been invited to join <strong>${campaignName}</strong> on ASoHaV Companion.</p>` +
          `<p><a href="${link}">Join the campaign</a>, or enter this code by hand: <strong>${code}</strong></p>`,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { delivered: false, via: 'resend', error: `Resend responded ${res.status}${body ? `: ${body}` : ''}` };
    }
    return { delivered: true, via: 'resend' };
  } catch (err) {
    return { delivered: false, via: 'resend', error: err instanceof Error ? err.message : String(err) };
  }
}
