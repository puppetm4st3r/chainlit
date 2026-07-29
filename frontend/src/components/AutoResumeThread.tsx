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
    if (!config?.threadResumable) return;

    if (idToResume === id) {
      return;
    }
    
    // Check if thread exists in history before attempting to resume
    // Only redirect away if we have loaded threads and this thread is not among them
    if (threadHistory?.threads && !threadHistory.threads.some(t => t.id === id)) {
      // Thread doesn't exist (likely deleted), redirect to home
      navigate({ pathname: '/', search: window.location.search });
      return;
    }
    
    clear();
    setIdToResume(id);
    if (!config?.dataPersistence) {
      navigate({ pathname: '/', search: window.location.search });
    }
  }, [config?.threadResumable, config?.dataPersistence, id, idToResume, threadHistory, location.pathname, session]);

  useEffect(() => {
    if (id !== idToResume) {
      return;
    }
    if (session?.error) {
      toast.error("Couldn't resume chat");
      navigate({ pathname: '/', search: window.location.search });
    }
  }, [session, idToResume, id, navigate]);

  useEffect(() => {
    if (resumeThreadError) {
      toast.error("Couldn't resume chat: " + resumeThreadError);
      navigate({ pathname: '/', search: window.location.search });
      setResumeThreadError(undefined);
    }
  }, [resumeThreadError, id, navigate, setResumeThreadError]);

  return null;
}
