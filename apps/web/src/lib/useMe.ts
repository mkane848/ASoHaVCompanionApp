import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from './api.js';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: api.auth.me,
    retry: false,
    throwOnError: (err) => !(err instanceof ApiError && err.status === 401),
  });
}
