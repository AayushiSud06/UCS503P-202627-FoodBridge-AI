/**
 * Shared plumbing for screens that call the API.
 *
 * Every action button in the app has the same three states — idle, in flight,
 * failed — and the same obligation to say what went wrong in the server's own
 * words. `useAction` is that, once, so a page can stay about its own subject.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { errorMessage } from '../context/AuthContext';
import { api } from './api';
import { toMatchAnalysis } from './adapters';
import type { MatchAnalysis } from '../types';

interface RunOptions {
  /** Shown as a toast when the call succeeds. Omit for a silent success. */
  success?: { message: string; subtitle?: string };
  /** Heading for the failure toast. The server's own message is the body. */
  errorTitle?: string;
}

/**
 * Runs one async action at a time, tracking which one is in flight by key.
 *
 * The key matters on list screens: several rows share a handler, and only the
 * row that was clicked should show a spinner.
 */
export function useAction() {
  const { showToast } = useApp();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async <T,>(key: string, action: () => Promise<T>, options: RunOptions = {}): Promise<T | null> => {
      setPendingKey(key);
      try {
        const result = await action();
        if (options.success) {
          showToast('success', options.success.message, options.success.subtitle);
        }
        return result;
      } catch (caught) {
        // The API's `detail` is written for a person — a rejected transition
        // says which one and why. Passing it through beats inventing a
        // generic apology.
        showToast('error', options.errorTitle ?? 'That did not work', errorMessage(caught));
        return null;
      } finally {
        if (mounted.current) setPendingKey(null);
      }
    },
    [showToast],
  );

  return {
    /** Key of the action currently in flight, or null. */
    pendingKey,
    isPending: (key: string) => pendingKey === key,
    isBusy: pendingKey !== null,
    run,
  };
}

/**
 * The real match analysis for a donation, from the server's ranking endpoint.
 *
 * The prototype computed this in the browser from a hard-coded organisation.
 * It has to come from the server now: the weights, the service radius and the
 * reliability history all live there, and a second implementation in the
 * client would drift from the one the decision is actually made on.
 *
 * This reports the *leading* match, which is a donor-side question: "did what I
 * posted find a home". An organisation asking how a donation scores for *itself*
 * must not use this — that number arrives on the donation as `viewerMatch`, so
 * the list and the panel showing it are reading one value rather than two live
 * calls that round apart. Answering an NGO with the leader's ranking under its
 * own heading is the contradiction this area was rebuilt around.
 */
export function useMatchAnalysis(donationId: string | null) {
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [recipientName, setRecipientName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!donationId) {
      setAnalysis(null);
      setRecipientName('');
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    api
      .getMatches(Number(donationId), 1)
      .then(matches => {
        const chosen = matches[0];
        if (cancelled) return;
        if (!chosen) {
          setAnalysis(null);
          setRecipientName('');
          return;
        }
        setAnalysis(toMatchAnalysis(chosen));
        setRecipientName(chosen.recipientName);
      })
      .catch(caught => {
        if (!cancelled) setError(errorMessage(caught));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [donationId]);

  return { analysis, recipientName, isLoading, error };
}
