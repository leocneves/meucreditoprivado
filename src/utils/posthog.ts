import posthog from 'posthog-js';

export const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'phc_DmT88xtTtZeJqtLN7M7k7TM2PrWUtNz3B465c9ZfTwV8';
export const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
export const POSTHOG_DID_STORAGE_KEY = 'fixdata_ph_did';

let isInitialized = false;

/** Synchronizes PostHog distinct_id in localStorage for non-React static pages. */
export const syncPostHogDistinctId = (did: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (did) {
      localStorage.setItem(POSTHOG_DID_STORAGE_KEY, did);
    } else {
      localStorage.removeItem(POSTHOG_DID_STORAGE_KEY);
    }
  } catch (_) {}
};

/** Captures a custom PostHog event safely without throwing or tracking admin browsers. */
export const captureEvent = (eventName: string, properties?: Record<string, unknown>) => {
  if (typeof window === 'undefined' || !isInitialized) return;
  try {
    if (localStorage.getItem('fixdata_is_admin') === 'true') return;
    posthog.capture(eventName, properties);
  } catch (_) {}
};

export const initPostHog = () => {
  if (isInitialized || typeof window === 'undefined') return;

  // Se este navegador já foi identificado como administrador, bloqueia imediatamente
  if (localStorage.getItem('fixdata_is_admin') === 'true') {
    posthog.opt_out_capturing();
    return;
  }

  if (POSTHOG_KEY) {
    try {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: 'history_change',
        capture_pageleave: true,
        autocapture: true,
        session_recording: {
          maskAllInputs: false,
          maskInputOptions: {
            password: true
          }
        },
        loaded: (ph) => {
          try {
            const did = typeof ph.get_distinct_id === 'function' ? ph.get_distinct_id() : null;
            if (did) syncPostHogDistinctId(did);
          } catch (_) {}
        }
      });
      isInitialized = true;
    } catch (err) {
      console.warn('Erro ao inicializar PostHog:', err);
    }
  }
};

export { posthog };
