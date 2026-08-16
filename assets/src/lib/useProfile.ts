import { useEffect, useState } from 'react';
import { ApiError, createProfile, exchangeAuthCode, fetchProfile, type Profile } from '@/lib/api';
import { clearDevice, loadDevice, saveDevice } from '@/lib/device';

type ProfileState =
  | { status: 'loading'; profile: null; error: null }
  | { status: 'ready'; profile: Profile; error: null }
  | { status: 'error'; profile: null; error: string };

/**
 * Reads and strips the OAuth handoff parameters from the URL (ADR-0022):
 * `?exchange=` a recovery code to trade for device credentials,
 * `?linked=` a completed link, `?auth_error=` a failed flow. The server
 * redirects to `/#/?…`, so they live in the hash.
 */
function readAuthParams(): { exchange: string | null; authError: string | null } {
  const q = window.location.hash.indexOf('?');
  if (q === -1) {
    return { exchange: null, authError: null };
  }
  const params = new URLSearchParams(window.location.hash.slice(q + 1));
  const exchange = params.get('exchange');
  const authError = params.get('auth_error');
  const linked = params.get('linked');
  if (exchange === null && authError === null && linked === null) {
    return { exchange: null, authError: null };
  }
  // The params are single-use — strip them from the URL.
  window.history.replaceState(null, '', `${window.location.pathname}#/`);
  return { exchange, authError };
}

export function useProfile(): ProfileState {
  const [state, setState] = useState<ProfileState>({
    status: 'loading',
    profile: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    async function bootstrap() {
      // A completed OAuth recovery hands us a one-time code first.
      const { exchange, authError } = readAuthParams();
      if (exchange !== null) {
        try {
          const { profile, secret } = await exchangeAuthCode(exchange);
          saveDevice({ id: profile.id, secret });
          if (!signal.aborted) {
            setState({ status: 'ready', profile, error: null });
          }
        } catch {
          if (!signal.aborted) {
            setState({ status: 'error', profile: null, error: 'exchange_failed' });
          }
        }
        return;
      }
      if (authError !== null) {
        setState({ status: 'error', profile: null, error: authError });
        return;
      }

      const device = loadDevice();

      if (device) {
        try {
          const profile = await fetchProfile(device, signal);
          if (!signal.aborted) {
            setState({ status: 'ready', profile, error: null });
          }
          return;
        } catch (error) {
          if (error instanceof ApiError && error.code === 'unauthorized') {
            clearDevice();
          } else {
            if (!signal.aborted) {
              setState({
                status: 'error',
                profile: null,
                error: error instanceof ApiError ? error.code : 'network',
              });
            }
            return;
          }
        }
      }

      try {
        const { profile, secret } = await createProfile(signal);
        saveDevice({ id: profile.id, secret });
        if (!signal.aborted) {
          setState({ status: 'ready', profile, error: null });
        }
      } catch (error) {
        if (!signal.aborted) {
          setState({
            status: 'error',
            profile: null,
            error: error instanceof ApiError ? error.code : 'network',
          });
        }
      }
    }

    void bootstrap();

    return () => controller.abort();
  }, []);

  return state;
}
