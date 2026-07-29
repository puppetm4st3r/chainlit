import { uniqBy } from 'lodash';
import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';

import {
  ChainlitContext,
  threadHistoryState,
  useChatData,
  useChatMessages
} from '@chainlit/react-client';

import {
  SidebarContent,
  SidebarGroup,
  SidebarMenu
} from '@/components/ui/sidebar';

import { ThreadList } from './ThreadList';

const BATCH_SIZE = 35;
let _scrollTop = 0;

export function ThreadHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const apiClient = useContext(ChainlitContext);
  const { firstInteraction, messages, threadId } = useChatMessages();
  const { projectId } = useChatData();
  const [threadHistory, setThreadHistory] = useRecoilState(threadHistoryState);
  const [error, setError] = useState<string>();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [shouldLoadMore, setShouldLoadMore] = useState(false);
  const prevMessageCountRef = useRef(0);
  // firstInteraction / scroll effects may close over an older fetchThreads;
  // keep project scope current for every listThreads call.
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  // Restore scroll position
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = _scrollTop;
    }
  }, []);

  // Handle first interaction
  useEffect(() => {
    const handleFirstInteraction = async () => {
      if (!firstInteraction) return;

      const isActualResume =
        firstInteraction === 'resume' &&
        messages[0]?.output.toLowerCase() !== 'resume';

      if (isActualResume) {
        return;
      }

      await fetchThreads(undefined, true);

      const currentPage = new URL(window.location.href);
      if (threadId && currentPage.pathname === '/') {
        navigate({
          pathname: `/thread/${threadId}`,
          search: window.location.search
        });
      }
    };

    handleFirstInteraction();
  }, [firstInteraction]);

  // Reorder thread to top when a new message is sent in the current thread
  useEffect(() => {
    const currentCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = currentCount;

    if (
      threadId &&
      currentCount > prevCount &&
      prevCount > 0 &&
      threadHistory?.threads
    ) {
      const lastMessage = messages[currentCount - 1];
      if (lastMessage?.type === 'user_message') {
        setThreadHistory((prev) => {
          if (!prev?.threads) return prev;
          const threadIndex = prev.threads.findIndex((t) => t.id === threadId);
          if (threadIndex <= 0) return prev; // Already at top or not found
          const updatedThreads = [...prev.threads];
          updatedThreads[threadIndex] = {
            ...updatedThreads[threadIndex],
            createdAt: new Date().toISOString()
          };
          return { ...prev, threads: updatedThreads };
        });
      }
    }
  }, [messages.length, threadId]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollHeight, clientHeight, scrollTop } = scrollRef.current;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 10;

    _scrollTop = scrollTop;
    setShouldLoadMore(atBottom);
  };

  const fetchThreads = async (
    cursor?: string | number,
    isLoadingMore = false
  ) => {
    try {
      setIsLoadingMore(!!cursor || isLoadingMore);
      setIsFetching(!cursor && !isLoadingMore);

      const { pageInfo, data } = await apiClient.listThreads(
        { first: BATCH_SIZE, cursor },
        { projectId: projectIdRef.current }
      );

      setError(undefined);

      // Prevent duplicate threads
      const allThreads = uniqBy(
        cursor ? threadHistory?.threads?.concat(data) : data,
        'id'
      );

      if (allThreads) {
        setThreadHistory((prev) => ({
          ...prev,
          pageInfo,
          threads: allThreads
        }));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('common.status.error.default')
      );
    } finally {
      setShouldLoadMore(false);
      setIsLoadingMore(false);
      setIsFetching(false);
    }
  };

  // Initial fetch and refetch when project scope changes (set_project clears threads).
  useEffect(() => {
    if (!isFetching && !threadHistory?.threads && !error) {
      fetchThreads();
    }
  }, [isFetching, threadHistory, error, projectId]);

  // Handle infinite scroll
  useEffect(() => {
    if (threadHistory?.pageInfo) {
      const { hasNextPage, endCursor } = threadHistory.pageInfo;

      if (shouldLoadMore && !isLoadingMore && hasNextPage && endCursor) {
        fetchThreads(endCursor);
      }
    }
  }, [shouldLoadMore, isLoadingMore, threadHistory]);

  return (
    <SidebarContent
      onScroll={handleScroll}
      ref={scrollRef}
    >
      <SidebarGroup>
        <SidebarMenu>
          {threadHistory ? (
            <div id="thread-history" className="flex-grow">
              <ThreadList
                threadHistory={threadHistory}
                error={error}
                isFetching={isFetching}
                isLoadingMore={isLoadingMore}
              />
            </div>
          ) : null}
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  );
}
