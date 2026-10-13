import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'phc_DmT88xtTtZeJqtLN7M7k7TM2PrWUtNz3B465c9ZfTwV8';
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let isInitialized = false;

export const initPostHog = () => {
  if (isInitialized || typeof window === 'undefined') return;

  if (POSTHOG_KEY) {
    try {
      posthog.init(POSTHOG_KEY, {
        api_host: POSTHOG_HOST,
        person_profiles: 'identified_only',
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: true,
        session_recording: {
          maskAllInputs: false,
          maskInputOptions: {
            password: true
          }
        }
      });
      isInitialized = true;
    } catch (err) {
      console.warn('Erro ao inicializar PostHog:', err);
    }
  }
};

export { posthog };
