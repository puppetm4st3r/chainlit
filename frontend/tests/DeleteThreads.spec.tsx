import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DeleteThreadsButton from '@/components/LeftSidebar/DeleteThreads';

const mocks = vi.hoisted(() => ({
  apiClient: { deleteThreads: vi.fn() },
  clear: vi.fn(),
  navigate: vi.fn(),
  setThreadHistory: vi.fn(),
  threadHistory: undefined as any
}));

vi.mock('@chainlit/react-client', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    ChainlitContext: React.createContext(mocks.apiClient),
    ClientError: class ClientError extends Error {},
    threadHistoryState: { key: 'ThreadHistory' },
    useChatData: () => ({ conversationHistoryVisible: true }),
    useChatInteract: () => ({ clear: mocks.clear }),
    useChatMessages: () => ({ threadId: 'current-thread' }),
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
    t: (_key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue || _key
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
    mocks.threadHistory = {
      threads: [{ id: 'thread-1' }],
      timeGroupedThreads: { Today: [{ id: 'thread-1' }] }
    };
    mocks.apiClient.deleteThreads.mockResolvedValue({
      success: true,
      deletedThreadCount: 1
    });
  });

  it('opens a destructive confirmation and deletes all threads', () => {
    render(<DeleteThreadsButton />);

    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(screen.getByText('Delete all threads?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete all threads' }));

    expect(mocks.apiClient.deleteThreads).toHaveBeenCalledTimes(1);
    expect(mocks.setThreadHistory).toHaveBeenCalledTimes(1);
    expect(mocks.clear).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('disables the action when there are no threads', () => {
    mocks.threadHistory = { threads: [] };

    render(<DeleteThreadsButton />);

    expect(screen.getByRole('button', { name: '' })).toBeDisabled();
  });
});
