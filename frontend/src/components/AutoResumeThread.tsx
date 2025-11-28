import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { config } = useConfig();
  const { clear, setIdToResume } = useChatInteract();
  const { session, idToResume } = useChatSession();
  const threadHistory = useRecoilValue(threadHistoryState);
  const [resumeThreadError, setResumeThreadError] = useRecoilState(
    resumeThreadErrorState
  );

  useEffect(() => {
    if (!config?.threadResumable) return;
    
    // Check if thread exists in history before attempting to resume
    // Only redirect away if we have loaded threads and this thread is not among them
    if (threadHistory?.threads && !threadHistory.threads.some(t => t.id === id)) {
      // Thread doesn't exist (likely deleted), redirect to home
      navigate('/');
      return;
    }
    
    clear();
    setIdToResume(id);
    if (!config?.dataPersistence) {
      navigate('/');
    }
  }, [config?.threadResumable, id, threadHistory]);

  useEffect(() => {
    if (id !== idToResume) {
      return;
    }
    if (session?.error) {
      toast.error("Couldn't resume chat");
      navigate('/');
    }
  }, [session, idToResume, id]);

  useEffect(() => {
    if (resumeThreadError) {
      toast.error("Couldn't resume chat: " + resumeThreadError);
      navigate('/');
      setResumeThreadError(undefined);
    }
  }, [resumeThreadError]);

  return null;
}
