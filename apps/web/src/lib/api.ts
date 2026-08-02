import type {
  Bond,
  CampaignBootstrap,
  ChangeLogEntry,
  CharacterSheet,
  Library,
  MeResponse,
  Party,
  ReferencedByRow,
  ValidationIssue,
} from '@asohav/shared';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
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
    login: (email: string, password: string) => request<{ user: MeResponse['user'] }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (name: string, email: string, password: string) =>
      request<{ user: MeResponse['user'] }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
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
    bootstrap: (id: string) => request<CampaignBootstrap>(`/campaigns/${id}/bootstrap`),
    invite: (id: string, email: string) => request<{ invite: any }>(`/campaigns/${id}/invites`, { method: 'POST', body: JSON.stringify({ email }) }),
    revokeInvite: (id: string, inviteId: string) => request<{ ok: true }>(`/campaigns/${id}/invites/${inviteId}`, { method: 'DELETE' }),
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
};
