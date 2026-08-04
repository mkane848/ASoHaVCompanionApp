import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';

export function useMyInvites() {
  return useQuery({
    queryKey: ['invites', 'mine'],
    queryFn: () => api.invites.mine().then((r) => r.invites),
  });
}
