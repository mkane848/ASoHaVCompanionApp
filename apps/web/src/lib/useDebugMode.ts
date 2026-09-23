import { useDebugStore } from '../store/debugStore.js';
import { useMe } from './useMe.js';

/** True only for an admin account with Debug mode on in this browser. Regular accounts never see
 *  a debug readout, whatever the stored flag says — the repo owner's requirement for the dice-odds
 *  readout (revised V0.6 slice 9). */
export function useDebugMode(): boolean {
  const debug = useDebugStore((s) => s.debug);
  const { data } = useMe();
  return debug && data?.user.IsAdmin === true;
}
