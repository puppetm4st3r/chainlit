import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { toast } from 'sonner';

import {
  resumeThreadErrorState,
  threadHistoryState,
  useChatInteract,
  useChatSession,
  useConfig
} from '@chainlit/react-client';

interface Props {
  id: string;
}

const logRootFlowDiag = (event: string, details?: Record<string, unknown>) => {
  console.warn(`[ChainlitRootFlowDiag] ${event}`, details || {});
};

export default function AutoResumeThread({ id }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useConfig();
  const { clear, setIdToResume } = useChatInteract();
  const { session, idToResume } = useChatSession();
  const threadHistory = useRecoilValue(threadHistoryState);
  const [resumeThreadError, setResumeThreadError] = useRecoilState(
    resumeThreadErrorState
  );

  useEffect(() => {
    logRootFlowDiag('auto_resume:effect', {
      routeThreadId: id,
      idToResume,
      pathname: location.pathname,
      threadResumable: config?.threadResumable,
      dataPersistence: config?.dataPersistence,
      knownThreadCount: threadHistory?.threads?.length ?? 0,
      hasSession: Boolean(session?.socket)
    });
    if (!config?.threadResumable) return;

    if (idToResume === id) {
      logRootFlowDiag('auto_resume:skip_same_target', {
        routeThreadId: id,
        idToResume
      });
      return;
    }
    
    // Check if thread exists in history before attempting to resume
    // Only redirect away if we have loaded threads and this thread is not among them
    if (threadHistory?.threads && !threadHistory.threads.some(t => t.id === id)) {
      logRootFlowDiag('auto_resume:thread_missing_redirect', {
        routeThreadId: id,
        knownThreadCount: threadHistory.threads.length
      });
      // Thread doesn't exist (likely deleted), redirect to home
      navigate('/');
      return;
    }
    
    logRootFlowDiag('auto_resume:clear_and_resume', {
      routeThreadId: id,
      previousIdToResume: idToResume
    });
    clear();
    setIdToResume(id);
    if (!config?.dataPersistence) {
      logRootFlowDiag('auto_resume:data_persistence_disabled_redirect', {
        routeThreadId: id
      });
      navigate('/');
    }
  }, [config?.threadResumable, config?.dataPersistence, id, idToResume, threadHistory, location.pathname, session]);

  useEffect(() => {
    if (id !== idToResume) {
      return;
    }
    if (session?.error) {
      toast.error("Couldn't resume chat");
      navigate('/');
    }
  }, [session, idToResume, id, navigate]);

  useEffect(() => {
    if (resumeThreadError) {
      toast.error("Couldn't resume chat: " + resumeThreadError);
      navigate('/');
      setResumeThreadError(undefined);
    }
  }, [resumeThreadError, id, navigate, setResumeThreadError]);

  return null;
}
