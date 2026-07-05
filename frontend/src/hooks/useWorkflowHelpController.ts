import { useCallback, useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { IWorkflowHelp, workflowHelpState } from '@chainlit/react-client';

import {
  workflowHelpDialogOpenState,
  workflowHelpDialogReasonState
} from '@/state/project';

type WorkflowHelpCloseOptions = {
  acknowledgeAutoOpen?: boolean;
  suppressAutoOpen?: boolean;
};

const buildDismissStorageKey = (preferenceKey: string): string =>
  `workflow-help-dismissed::${preferenceKey}`;

const buildSessionAckStorageKey = (help: IWorkflowHelp): string =>
  `workflow-help-ack::${help.threadId}::${help.preferenceKey}`;

const getStorage = (
  kind: 'localStorage' | 'sessionStorage'
): Storage | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window[kind];
};

const hasPersistentDismissal = (help: IWorkflowHelp | undefined): boolean => {
  if (!help) {
    return false;
  }
  return (
    getStorage('localStorage')?.getItem(
      buildDismissStorageKey(help.preferenceKey)
    ) === 'true'
  );
};

const hasSessionAcknowledgement = (help: IWorkflowHelp | undefined): boolean => {
  if (!help) {
    return false;
  }
  return (
    getStorage('sessionStorage')?.getItem(buildSessionAckStorageKey(help)) ===
    'true'
  );
};

export const useWorkflowHelpController = () => {
  const activeHelp = useRecoilValue(workflowHelpState);
  const [isOpen, setIsOpen] = useRecoilState(workflowHelpDialogOpenState);
  const [openReason, setOpenReason] = useRecoilState(
    workflowHelpDialogReasonState
  );

  const isPersistentlyDismissed = hasPersistentDismissal(activeHelp);
  const isAcknowledgedForThread = hasSessionAcknowledgement(activeHelp);
  const isResumeAutoOpenBlocked =
    activeHelp?.lifecycle === 'resume' && activeHelp?.openOnResume === false;

  useEffect(() => {
    if (!activeHelp) {
      if (isOpen) {
        setIsOpen(false);
      }
      if (openReason) {
        setOpenReason(undefined);
      }
      return;
    }

    if (
      isPersistentlyDismissed ||
      isAcknowledgedForThread ||
      isResumeAutoOpenBlocked
    ) {
      return;
    }

    setOpenReason('auto');
    setIsOpen(true);
  }, [
    activeHelp,
    isAcknowledgedForThread,
    isOpen,
    isPersistentlyDismissed,
    isResumeAutoOpenBlocked,
    openReason,
    setIsOpen,
    setOpenReason
  ]);

  const openManual = useCallback(() => {
    if (!activeHelp) {
      return;
    }
    setOpenReason('manual');
    setIsOpen(true);
  }, [activeHelp, setIsOpen, setOpenReason]);

  const closeAndPersistPreferences = useCallback(
    (options?: WorkflowHelpCloseOptions) => {
      const suppressAutoOpen = options?.suppressAutoOpen === true;
      const acknowledgeAutoOpen = options?.acknowledgeAutoOpen === true;

      if (activeHelp) {
        const localStorageRef = getStorage('localStorage');
        const sessionStorageRef = getStorage('sessionStorage');
        const dismissStorageKey = buildDismissStorageKey(activeHelp.preferenceKey);
        const sessionAckStorageKey = buildSessionAckStorageKey(activeHelp);

        if (suppressAutoOpen) {
          localStorageRef?.setItem(dismissStorageKey, 'true');
        } else {
          localStorageRef?.removeItem(dismissStorageKey);
        }

        if (acknowledgeAutoOpen) {
          sessionStorageRef?.setItem(sessionAckStorageKey, 'true');
        }
      }

      setIsOpen(false);
      setOpenReason(undefined);
    },
    [activeHelp, setIsOpen, setOpenReason]
  );

  return {
    activeHelp,
    isOpen,
    openReason,
    isAutoSuppressed:
      isPersistentlyDismissed ||
      isAcknowledgedForThread ||
      isResumeAutoOpenBlocked,
    isPersistentlyDismissed,
    openManual,
    closeAndPersistPreferences
  };
};
