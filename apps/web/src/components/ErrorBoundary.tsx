import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router';
import styles from './ErrorBoundary.module.css';

/* What each engine says when a lazy route's chunk can't be loaded — almost always because a deploy
   replaced the hashed file a still-open tab's bundle points at. The last one is Vite's own
   preload helper failing on the chunk's CSS; the MIME one is what a missing asset looks like here
   specifically, since apps/server/src/index.ts's SPA fallback answers any unknown non-/api path
   with index.html. */
const CHUNK_LOAD_PATTERNS = [
  /Failed to fetch dynamically imported module/i, // Chrome
  /Importing a module script failed/i, // Safari
  /error loading dynamically imported module/i, // Firefox
  /is not a valid JavaScript MIME type/i,
  /Unable to preload CSS/i,
];

export const CHUNK_RELOAD_KEY = 'asohav:chunkReloadAt';
export const CHUNK_RELOAD_WINDOW_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return CHUNK_LOAD_PATTERNS.some((re) => re.test(message));
}

type ReloadGuardStorage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Whether a chunk-load failure may trigger an automatic reload, stamping the attempt if so. One
 * reload fetches a fresh index.html and with it the current chunk names, which fixes the stale-tab
 * case outright; if the same failure is back within the window, a reload is evidently not what
 * fixes it, and reloading again would loop forever — so the fallback shows instead.
 *
 * `Math.abs` so a clock that moved backwards can't leave the guard stuck "recent" for hours. No
 * storage, or storage that throws (blocked site data, some private modes), means the guard can't
 * be recorded — and an unrecorded guard is exactly the loop this exists to prevent, so the answer
 * is no.
 */
export function claimChunkReload(storage: ReloadGuardStorage | null, now: number): boolean {
  if (!storage) return false;
  try {
    const last = Number(storage.getItem(CHUNK_RELOAD_KEY));
    if (last > 0 && Math.abs(now - last) < CHUNK_RELOAD_WINDOW_MS) return false;
    storage.setItem(CHUNK_RELOAD_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

function sessionStorageOrNull(): Storage | null {
  // Merely reading `window.sessionStorage` throws a SecurityError where site data is blocked.
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

interface Props {
  /** Changing this clears a caught error — App passes the pathname, so navigating away recovers. */
  resetKey: string;
  children: ReactNode;
}

interface State {
  error: unknown;
  hasError: boolean;
  resetKey: string;
  reloading: boolean;
}

/**
 * Catches a render error anywhere in the routed content, so one broken page shows what broke
 * instead of unmounting the whole tree to a blank screen. Before this the app had no boundary at
 * all: Adventure Prep was reported as "a blank page every time", and the message that would have
 * named the cause was only ever in a console the reporter had no reason to open.
 *
 * A class because React 19 still has no hook for this. Reset by `resetKey` rather than by App
 * keying the boundary on the pathname: a key remounts everything below it on *every* navigation,
 * which would throw away page state React Router deliberately keeps when only a param changes
 * (Content Admin's `/admin/:view/:id?` pane, for one). This only resets when there is an error to
 * clear.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, hasError: false, resetKey: this.props.resetKey, reloading: false };

  /* `reloading` is decided optimistically here, before the guard is consulted, so the reload case
     never paints the error card first; componentDidCatch below either reloads or takes it back. */
  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error, hasError: true, reloading: isChunkLoadError(error) };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey === state.resetKey) return null;
    return { error: null, hasError: false, resetKey: props.resetKey, reloading: false };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ErrorBoundary] A page failed to render:', error, info.componentStack);
    if (!isChunkLoadError(error)) return;
    if (claimChunkReload(sessionStorageOrNull(), Date.now())) window.location.reload();
    else this.setState({ reloading: false });
  }

  render() {
    const { hasError, error, reloading } = this.state;
    if (!hasError) return this.props.children;
    // The page is about to be replaced; the error card flashing up first would only alarm.
    if (reloading) return <p className={styles.reloading}>Loading the latest version…</p>;

    return (
      <div className={styles.wrap}>
        <div className={styles.card} role="alert">
          <h1 className={styles.title}>Something went wrong on this page</h1>
          <p className={styles.lead}>Reloading usually clears it. If it keeps happening, this is the message to pass on:</p>
          <p className={styles.message}>{errorMessage(error)}</p>
          <div className={`tap-row ${styles.actions}`}>
            <button type="button" className={`tap-inline ${styles.primary}`} onClick={() => window.location.reload()}>
              Reload
            </button>
            {/* Navigating away already resets via resetKey; the explicit reset covers the one case
                it can't — the page that broke *is* the home page, so the path doesn't change. */}
            <Link to="/" className={`tap-inline ${styles.secondary}`} onClick={() => this.setState({ error: null, hasError: false })}>
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
