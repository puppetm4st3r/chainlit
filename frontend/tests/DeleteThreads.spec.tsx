import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeleteThreadsButton from '@/components/LeftSidebar/DeleteThreads';

const mocks = vi.hoisted(() => ({
  apiClient: { deleteThreads: vi.fn() },
  clear: vi.fn(),
  navigate: vi.fn(),
  setThreadHistory: vi.fn(),
  threadHistory: undefined as any,
  threadId: 'current-thread' as string | undefined,
  idToResume: undefined as string | undefined,
  useChatData: vi.fn(() => ({
    conversationHistoryVisible: true,
    conversationHistoryShowDeleteThreads: true,
    projectId: null
  }))
}));

vi.mock('@chainlit/react-client', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    ChainlitContext: React.createContext(mocks.apiClient),
    ClientError: class ClientError extends Error {},
    threadHistoryState: { key: 'ThreadHistory' },
    useChatData: () => mocks.useChatData(),
    useChatInteract: () => ({ clear: mocks.clear }),
    useChatMessages: () => ({ threadId: mocks.threadId }),
    useChatSession: () => ({ idToResume: mocks.idToResume }),
    useConfig: () => ({ config: { dataPersistence: true } })
  };
});

vi.mock('recoil', () => ({
  useRecoilState: () => [mocks.threadHistory, mocks.setThreadHistory]
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { project?: string }) => {
      if (options?.project) {
        return `${key}:${options.project}`;
      }
      return key;
    }
  })
}));

vi.mock('sonner', () => ({
  toast: {
    promise: vi.fn((_promise, handlers) => handlers.success())
  }
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  AlertDialogAction: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/i18n', () => ({
  Translator: ({ path }: { path: string }) => <span>{path}</span>
}));

describe('DeleteThreadsButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.threadId = 'current-thread';
    mocks.idToResume = undefined;
    mocks.useChatData.mockReturnValue({
      conversationHistoryVisible: true,
      conversationHistoryShowDeleteThreads: true,
      projectId: null
    });
    mocks.threadHistory = {
      currentThreadId: 'current-thread',
      threads: [{ id: 'thread-1' }, { id: 'current-thread' }],
      timeGroupedThreads: { Today: [{ id: 'thread-1' }, { id: 'current-thread' }] }
    };
    mocks.apiClient.deleteThreads.mockResolvedValue({
      success: true,
      deletedThreadCount: 1
    });
  });

  it('opens a destructive confirmation and deletes other bag threads', () => {
    render(<DeleteThreadsButton />);

    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(
      screen.getByText('threadHistory.sidebar.actions.deleteAll.bag.title')
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'threadHistory.sidebar.actions.deleteAll.bag.confirm'
      })
    );

    expect(mocks.apiClient.deleteThreads).toHaveBeenCalledWith(null, 'current-thread');
    expect(mocks.setThreadHistory).toHaveBeenCalledTimes(1);
    // Current conversation stays open.
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it('deletes only the active project scope and excludes the current thread', () => {
    mocks.useChatData.mockReturnValue({
      conversationHistoryVisible: true,
      conversationHistoryShowDeleteThreads: true,
      projectId: 'Mi Proyecto'
    });

    render(<DeleteThreadsButton />);

    fireEvent.click(screen.getByRole('button', { name: '' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'threadHistory.sidebar.actions.deleteAll.project.confirm'
      })
    );

    expect(mocks.apiClient.deleteThreads).toHaveBeenCalledWith(
      'Mi Proyecto',
      'current-thread'
    );
  });

  it('disables the action when there are no other threads to delete', () => {
    mocks.threadHistory = {
      currentThreadId: 'current-thread',
      threads: [{ id: 'current-thread' }]
    };

    render(<DeleteThreadsButton />);

    expect(screen.getByRole('button', { name: '' })).toBeDisabled();
  });

  it('excludes the sidebar/resume current thread when session threadId is not hydrated yet', () => {
    mocks.threadId = undefined;
    mocks.idToResume = 'current-thread';
    mocks.threadHistory = {
      currentThreadId: 'current-thread',
      threads: [{ id: 'thread-1' }, { id: 'current-thread' }]
    };

    render(<DeleteThreadsButton />);

    fireEvent.click(screen.getByRole('button', { name: '' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'threadHistory.sidebar.actions.deleteAll.bag.confirm'
      })
    );

    expect(mocks.apiClient.deleteThreads).toHaveBeenCalledWith(
      null,
      'current-thread'
    );
    expect(mocks.clear).not.toHaveBeenCalled();
  });

  it('returns null when runtime hides the bulk-delete action', () => {
    mocks.useChatData.mockReturnValue({
      conversationHistoryVisible: true,
      conversationHistoryShowDeleteThreads: false,
      projectId: null
    });

    const { container } = render(<DeleteThreadsButton />);
    expect(container).toBeEmptyDOMElement();
  });
});
