import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';

export function useLibrary() {
  return useQuery({
    queryKey: ['library'],
    queryFn: () => api.library.get().then((r) => r.library),
    staleTime: 60_000,
  });
}
