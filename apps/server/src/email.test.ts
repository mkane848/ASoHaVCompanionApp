import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./repo.js', () => ({
  listAuthUsers: vi.fn(),
}));

vi.mock('./supabase.js', () => ({
  supabaseAdmin: {
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(),
      },
    },
  },
}));

import * as repo from './repo.js';
import { supabaseAdmin } from './supabase.js';
import { sendInviteEmail } from './email.js';

type InviteUserByEmailResult = Awaited<ReturnType<typeof supabaseAdmin.auth.admin.inviteUserByEmail>>;

const params = { to: 'new@asohav.dev', campaignName: 'The Long Road South', code: 'ROAD-ABC123', link: 'https://asohav.example/?invite=ROAD-ABC123' };

describe('sendInviteEmail', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.INVITE_FROM_EMAIL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('routes a new address through Supabase inviteUserByEmail', async () => {
    vi.mocked(repo.listAuthUsers).mockResolvedValue([]);
    vi.mocked(supabaseAdmin.auth.admin.inviteUserByEmail).mockResolvedValue({ data: { user: {} }, error: null } as InviteUserByEmailResult);

    const result = await sendInviteEmail(params);

    expect(result).toEqual({ delivered: true, via: 'supabase' });
    expect(supabaseAdmin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(params.to, { redirectTo: params.link });
  });

  it('catches and surfaces a Supabase provider error rather than throwing', async () => {
    vi.mocked(repo.listAuthUsers).mockResolvedValue([]);
    vi.mocked(supabaseAdmin.auth.admin.inviteUserByEmail).mockResolvedValue({ data: { user: null }, error: { message: 'rate limited' } } as InviteUserByEmailResult);

    const result = await sendInviteEmail(params);

    expect(result).toEqual({ delivered: false, via: 'supabase', error: 'rate limited' });
  });

  it('routes an existing address to Resend instead of Supabase', async () => {
    vi.mocked(repo.listAuthUsers).mockResolvedValue([{ Id: 'u-1', Email: params.to, Name: 'Someone', IsAdmin: false, CreatedAt: '2026-01-01T00:00:00Z', LastSignInAt: null }]);
    process.env.RESEND_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendInviteEmail(params);

    expect(result).toEqual({ delivered: true, via: 'resend' });
    expect(supabaseAdmin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({ method: 'POST' }));
  });

  it('matches an existing address case-insensitively', async () => {
    vi.mocked(repo.listAuthUsers).mockResolvedValue([{ Id: 'u-1', Email: params.to.toUpperCase(), Name: 'Someone', IsAdmin: false, CreatedAt: '2026-01-01T00:00:00Z', LastSignInAt: null }]);
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('') }));

    const result = await sendInviteEmail(params);

    expect(result.via).toBe('resend');
  });

  it('with no RESEND_API_KEY, an existing-address send no-ops rather than failing or throwing', async () => {
    vi.mocked(repo.listAuthUsers).mockResolvedValue([{ Id: 'u-1', Email: params.to, Name: 'Someone', IsAdmin: false, CreatedAt: '2026-01-01T00:00:00Z', LastSignInAt: null }]);

    const result = await sendInviteEmail(params);

    expect(result).toEqual({ delivered: false, via: 'none' });
  });

  it('catches a Resend HTTP failure rather than throwing', async () => {
    vi.mocked(repo.listAuthUsers).mockResolvedValue([{ Id: 'u-1', Email: params.to, Name: 'Someone', IsAdmin: false, CreatedAt: '2026-01-01T00:00:00Z', LastSignInAt: null }]);
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422, text: () => Promise.resolve('bad address') }));

    const result = await sendInviteEmail(params);

    expect(result.delivered).toBe(false);
    expect(result.via).toBe('resend');
    expect(result.error).toContain('422');
  });

  it('catches a Resend network rejection rather than throwing', async () => {
    vi.mocked(repo.listAuthUsers).mockResolvedValue([{ Id: 'u-1', Email: params.to, Name: 'Someone', IsAdmin: false, CreatedAt: '2026-01-01T00:00:00Z', LastSignInAt: null }]);
    process.env.RESEND_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    const result = await sendInviteEmail(params);

    expect(result).toEqual({ delivered: false, via: 'resend', error: 'ECONNRESET' });
  });

  it('catches a lookup failure (listAuthUsers throwing) rather than propagating it', async () => {
    vi.mocked(repo.listAuthUsers).mockRejectedValue(new Error('supabase unreachable'));

    const result = await sendInviteEmail(params);

    expect(result).toEqual({ delivered: false, via: 'none', error: 'supabase unreachable' });
  });
});
