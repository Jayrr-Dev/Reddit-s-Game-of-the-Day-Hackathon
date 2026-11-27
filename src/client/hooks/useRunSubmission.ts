// ===================================================================
// USE RUN SUBMISSION
// Sends a finished run to the server exactly once and tracks the result.
// ===================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { isRunOver, type RunAction, type RunState } from '../../shared/game/run';
import type { FinishRunResponse } from '../../shared/types/api';

// --- TYPES ---
export type RunSubmission =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; result: FinishRunResponse }
  | { status: 'error'; message: string };

export type UseRunSubmissionInput = {
  run: RunState;
  actions: RunAction[];
  /** Only a run played in this session is submitted (not a stale save). */
  isActive: boolean;
  finishRun: (actions: RunAction[]) => Promise<FinishRunResponse>;
  onSaved: (result: FinishRunResponse) => void;
};

// --- HOOK ---
/** Submits once when the run ends; `reset` re-arms it for the next run. */
export const useRunSubmission = ({
  run,
  actions,
  isActive,
  finishRun,
  onSaved,
}: UseRunSubmissionInput) => {
  const [submission, setSubmission] = useState<RunSubmission>({
    status: 'idle',
  });
  const hasSubmittedRef = useRef(false);
  const isFinished = isRunOver(run);

  // SUBMIT THE LOG THE MOMENT THE VILLAIN FALLS
  useEffect(() => {
    if (!isActive || !isFinished || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    setSubmission({ status: 'saving' });
    finishRun(actions)
      .then((result) => {
        setSubmission({ status: 'saved', result });
        onSaved(result);
      })
      .catch((error: unknown) =>
        setSubmission({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      );
  }, [isActive, isFinished, actions, finishRun, onSaved]);

  /** Clears the result before a new run starts. */
  const reset = useCallback(() => {
    hasSubmittedRef.current = false;
    setSubmission({ status: 'idle' });
  }, []);

  return { submission, reset } as const;
};
