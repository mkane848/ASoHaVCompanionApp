import type {
  AdminCampaignRow,
  AdminCharacterRow,
  AdminUserRow,
  Adventure,
  AdventureType,
  Bond,
  Campaign,
  CampaignBootstrap,
  CampaignPhase,
  CampaignStatus,
  ChangeLogEntry,
  Character,
  CharacterSheet,
  Clock,
  ClockKind,
  Encounter,
  Library,
  MeResponse,
  Membership,
  MyInvite,
  Party,
  ReferencedByRow,
  ValidationIssue,
} from '@asohav/shared';
import { supabase } from './supabaseClient.js';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Requests hung indefinitely with no error and no user-facing feedback when the network or
// server stalled (the fetch promise simply never settled) — this timeout turns that into a
// catchable ApiError instead. 20s comfortably covers slow requests (library import/export) while
// still failing well before a user would give up waiting.
const REQUEST_TIMEOUT_MS = 20_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session) headers.Authorization = `Bearer ${session.access_token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...init,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new ApiError(0, 'That took too long to respond. Check your connection and try again.');
    }
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export { ApiError };

export const api = {
  auth: {
    me: () => request<MeResponse>('/auth/me'),
    login: async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new ApiError(401, error.message);
    },
    register: async (name: string, email: string, password: string) => {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (error) throw new ApiError(400, error.message);
    },
    logout: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw new ApiError(500, error.message);
    },
  },
  library: {
    get: () => request<{ library: Library }>('/library'),
    validation: () => request<{ issues: ValidationIssue[] }>('/library/validation'),
    changelog: () => request<{ entries: (ChangeLogEntry & { Diffs: { field: string; before: string; after: string }[] })[] }>('/library/changelog'),
    referencedBy: (collection: string, id: string) => request<{ rows: ReferencedByRow[] }>(`/library/${collection}/${id}/referenced-by`),
    create: (collection: string, values: Record<string, unknown>) => request<{ object: any }>(`/library/${collection}`, { method: 'POST', body: JSON.stringify(values) }),
    update: (collection: string, id: string, values: Record<string, unknown>) => request<{ object: any }>(`/library/${collection}/${id}`, { method: 'PUT', body: JSON.stringify(values) }),
    remove: (collection: string, id: string) => request<{ ok: true }>(`/library/${collection}/${id}`, { method: 'DELETE' }),
    updateSettings: (values: Record<string, unknown>) => request<{ settings: any }>('/library/settings', { method: 'PUT', body: JSON.stringify(values) }),
    export: () => request<{ exportedAt: string; app: string; library: Library }>('/library/export', { method: 'POST' }),
    import: (library: Library) => request<{ library: Library }>('/library/import', { method: 'POST', body: JSON.stringify({ library }) }),
    reset: () => request<{ library: Library }>('/library/reset', { method: 'POST' }),
  },
  campaign: {
    create: (name: string) => request<{ campaign: Campaign; membership: Membership }>('/campaigns', { method: 'POST', body: JSON.stringify({ name }) }),
    bootstrap: (id: string) => request<CampaignBootstrap>(`/campaigns/${id}/bootstrap`),
    invite: (id: string, email: string) => request<{ invite: any }>(`/campaigns/${id}/invites`, { method: 'POST', body: JSON.stringify({ email }) }),
    revokeInvite: (id: string, inviteId: string) => request<{ ok: true }>(`/campaigns/${id}/invites/${inviteId}`, { method: 'DELETE' }),
    setStatus: (id: string, status: CampaignStatus) =>
      request<{ campaign: Campaign }>(`/campaigns/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    setPhase: (id: string, phase: CampaignPhase) =>
      request<{ campaign: Campaign }>(`/campaigns/${id}/phase`, { method: 'PATCH', body: JSON.stringify({ phase }) }),
    setReady: (id: string, ready: boolean) =>
      request<{ membership: Membership }>(`/campaigns/${id}/ready`, { method: 'PATCH', body: JSON.stringify({ ready }) }),
  },
  admin: {
    users: () => request<{ users: AdminUserRow[] }>('/admin/users'),
    resetPassword: (id: string) => request<{ actionLink: string }>(`/admin/users/${id}/reset-password`, { method: 'POST' }),
    campaigns: () => request<{ campaigns: AdminCampaignRow[] }>('/admin/campaigns'),
    deleteCampaign: (id: string) => request<{ ok: true }>(`/campaigns/${id}`, { method: 'DELETE' }),
    characters: () => request<{ characters: AdminCharacterRow[] }>('/admin/characters'),
    deleteCharacter: (campaignId: string, characterId: string) =>
      request<{ ok: true }>(`/campaigns/${campaignId}/characters/${characterId}`, { method: 'DELETE' }),
  },
  invites: {
    mine: () => request<{ invites: MyInvite[] }>('/invites/mine'),
    redeem: (id: string) => request<{ membership: Membership }>(`/invites/${id}/redeem`, { method: 'POST' }),
    redeemByCode: (code: string) => request<{ membership: Membership }>('/invites/redeem-by-code', { method: 'POST', body: JSON.stringify({ code }) }),
    decline: (id: string) => request<{ ok: true }>(`/invites/${id}/decline`, { method: 'POST' }),
  },
  character: {
    create: (
      campaignId: string,
      body: {
        name: string;
        playerName: string;
        virtues: { virtueId: string; score: number }[];
        looks: string[];
        motifs: { motifId?: string | null; name: string; skillTag: string; flawTag: string; quest: string }[];
      },
    ) => request<{ character: Character; sheet: CharacterSheet }>(`/campaigns/${campaignId}/characters`, { method: 'POST', body: JSON.stringify(body) }),
  },
  sheet: {
    save: (campaignId: string, characterId: string, sheet: CharacterSheet) =>
      request<{ sheet: CharacterSheet }>(`/campaigns/${campaignId}/sheets/${characterId}`, { method: 'PUT', body: JSON.stringify(sheet) }),
  },
  party: {
    save: (campaignId: string, party: Party) => request<{ party: Party }>(`/campaigns/${campaignId}/party`, { method: 'PUT', body: JSON.stringify(party) }),
  },
  bond: {
    propose: (campaignId: string, bondId: string, type: string, payload: Record<string, unknown>, note?: string) =>
      request<{ bond: Bond }>(`/campaigns/${campaignId}/bonds/${bondId}/propose`, { method: 'POST', body: JSON.stringify({ type, payload, note }) }),
    accept: (campaignId: string, bondId: string) => request<{ bond: Bond }>(`/campaigns/${campaignId}/bonds/${bondId}/accept`, { method: 'POST' }),
    reject: (campaignId: string, bondId: string, withdrawn: boolean) =>
      request<{ bond: Bond }>(`/campaigns/${campaignId}/bonds/${bondId}/reject`, { method: 'POST', body: JSON.stringify({ withdrawn }) }),
  },
  combat: {
    start: (campaignId: string, options: { combatGoal: string; initiatedByHeroes: boolean; sharedGoal: boolean; illPreparedOrOffBalance: boolean }) =>
      request<{ encounter: Encounter }>(`/campaigns/${campaignId}/combat/start`, { method: 'POST', body: JSON.stringify(options) }),
    save: (campaignId: string, encounter: Encounter) =>
      request<{ encounter: Encounter }>(`/campaigns/${campaignId}/combat/${encounter.Id}`, { method: 'PUT', body: JSON.stringify(encounter) }),
    end: (campaignId: string, encounterId: string) =>
      request<{ encounter: Encounter }>(`/campaigns/${campaignId}/combat/${encounterId}/end`, { method: 'POST' }),
  },
  clocks: {
    create: (campaignId: string, title: string, kind: ClockKind, segments?: number) =>
      request<{ clock: Clock }>(`/campaigns/${campaignId}/clocks`, { method: 'POST', body: JSON.stringify({ title, kind, segments }) }),
    save: (campaignId: string, clock: Clock) =>
      request<{ clock: Clock }>(`/campaigns/${campaignId}/clocks/${clock.Id}`, { method: 'PUT', body: JSON.stringify(clock) }),
    remove: (campaignId: string, clockId: string) =>
      request<void>(`/campaigns/${campaignId}/clocks/${clockId}`, { method: 'DELETE' }),
  },
  adventures: {
    create: (campaignId: string, concept: string, type: AdventureType | null, hook: string) =>
      request<{ adventure: Adventure }>(`/campaigns/${campaignId}/adventures`, { method: 'POST', body: JSON.stringify({ concept, type, hook }) }),
    save: (campaignId: string, adventure: Adventure) =>
      request<{ adventure: Adventure }>(`/campaigns/${campaignId}/adventures/${adventure.Id}`, { method: 'PUT', body: JSON.stringify(adventure) }),
    remove: (campaignId: string, adventureId: string) =>
      request<void>(`/campaigns/${campaignId}/adventures/${adventureId}`, { method: 'DELETE' }),
  },
};
