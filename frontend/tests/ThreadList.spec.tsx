import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreadList } from '@/components/LeftSidebar/ThreadList';

const mocks = vi.hoisted(() => ({
  apiClient: {
    deleteThread: vi.fn(),
    renameThread: vi.fn()
  },
  clear: vi.fn(),
  navigate: vi.fn(),
  setThreadHistory: vi.fn(),
  config: {
    dataPersistence: true,
    chatProfiles: [
      { name: 'root-profile', display_name: 'Perfil Administracion' }
    ]
  }
}));

vi.mock('@chainlit/react-client', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    ChainlitContext: React.createContext(mocks.apiClient),
    ClientError: class ClientError extends Error {},
    threadHistoryState: { key: 'ThreadHistory' },
    useChatInteract: () => ({ clear: mocks.clear }),
    useChatMessages: () => ({ threadId: undefined }),
    useChatSession: () => ({ idToResume: undefined }),
    useConfig: () => ({ config: mocks.config })
  };
});

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => mocks.navigate
}));

vi.mock('recoil', () => ({
  useSetRecoilState: () => mocks.setThreadHistory
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

vi.mock('@/components/Alert', () => ({
  default: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/Loader', () => ({
  Loader: () => <div>loading</div>
}));

vi.mock('@/components/share/ShareDialog', () => ({
  default: () => null
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children }: any) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: any) => <button>{children}</button>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarGroup: ({ children }: any) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: any) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: any) => <div>{children}</div>,
  SidebarMenu: ({ children }: any) => <div>{children}</div>,
  SidebarMenuButton: ({ children, isActive, size, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
  SidebarMenuItem: ({ children, ...props }: any) => <div {...props}>{children}</div>
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: () => null,
  TooltipProvider: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>
}));

vi.mock('@/components/i18n', () => ({
  Translator: ({ path }: { path: string }) => <span>{path}</span>
}));

vi.mock('@/components/LeftSidebar/ThreadOptions', () => ({
  default: () => <div />
}));

describe('ThreadList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.config.chatProfiles = [
      { name: 'root-profile', display_name: 'Perfil Administracion' }
    ];
  });

  it('shows the thread profile label below the thread name', () => {
    render(
      <ThreadList
        threadHistory={{
          currentThreadId: 'thread-1',
          threads: [
            {
              id: 'thread-1',
              createdAt: 0,
              name: 'Conversacion importante',
              steps: [],
              metadata: { chat_profile: 'root-profile' }
            }
          ],
          timeGroupedThreads: {
            Today: [
              {
                id: 'thread-1',
                createdAt: 0,
                name: 'Conversacion importante',
                steps: [],
                metadata: { chat_profile: 'root-profile' }
              }
            ]
          }
        }}
        isFetching={false}
        isLoadingMore={false}
      />
    );

    expect(screen.getByText('Conversacion importante')).toBeInTheDocument();
    expect(screen.getByText('Perfil Administracion')).toBeInTheDocument();
  });

  it('reads the thread profile from serialized metadata', () => {
    mocks.config.chatProfiles = [{ name: 'ops-profile' }];

    render(
      <ThreadList
        threadHistory={{
          currentThreadId: 'thread-2',
          threads: [
            {
              id: 'thread-2',
              createdAt: 0,
              name: 'Conversacion tecnica',
              steps: [],
              metadata: JSON.stringify({ chat_profile: 'ops-profile' })
            }
          ],
          timeGroupedThreads: {
            Today: [
              {
                id: 'thread-2',
                createdAt: 0,
                name: 'Conversacion tecnica',
                steps: [],
                metadata: JSON.stringify({ chat_profile: 'ops-profile' })
              }
            ]
          }
        }}
        isFetching={false}
        isLoadingMore={false}
      />
    );

    expect(screen.getByText('ops-profile')).toBeInTheDocument();
  });

  it('falls back to tags when metadata does not include the profile', () => {
    mocks.config.chatProfiles = [{ name: 'ops-profile' }];

    render(
      <ThreadList
        threadHistory={{
          currentThreadId: 'thread-3',
          threads: [
            {
              id: 'thread-3',
              createdAt: 0,
              name: 'Conversacion con tags',
              steps: [],
              tags: ['ops-profile']
            }
          ],
          timeGroupedThreads: {
            Today: [
              {
                id: 'thread-3',
                createdAt: 0,
                name: 'Conversacion con tags',
                steps: [],
                tags: ['ops-profile']
              }
            ]
          }
        }}
        isFetching={false}
        isLoadingMore={false}
      />
    );

    expect(screen.getByText('ops-profile')).toBeInTheDocument();
  });

  it('shows placeholder when the thread has no profile data', () => {
    mocks.config.chatProfiles = [{ name: 'ops-profile' }];

    render(
      <ThreadList
        threadHistory={{
          currentThreadId: 'thread-4',
          threads: [
            {
              id: 'thread-4',
              createdAt: 0,
              name: 'Conversacion sin perfil',
              steps: []
            }
          ],
          timeGroupedThreads: {
            Today: [
              {
                id: 'thread-4',
                createdAt: 0,
                name: 'Conversacion sin perfil',
                steps: []
              }
            ]
          }
        }}
        isFetching={false}
        isLoadingMore={false}
      />
    );

    expect(screen.getByText('---')).toBeInTheDocument();
  });

  it('collapses and expands thread groups from the date header', () => {
    render(
      <ThreadList
        threadHistory={{
          currentThreadId: 'thread-5',
          threads: [
            {
              id: 'thread-5',
              createdAt: 0,
              name: 'Conversacion colapsable',
              steps: [],
              metadata: { chat_profile: 'root-profile' }
            }
          ],
          timeGroupedThreads: {
            Today: [
              {
                id: 'thread-5',
                createdAt: 0,
                name: 'Conversacion colapsable',
                steps: [],
                metadata: { chat_profile: 'root-profile' }
              }
            ]
          }
        }}
        isFetching={false}
        isLoadingMore={false}
      />
    );

    const toggleButton = screen.getByRole('button', {
      name: 'threadHistory.sidebar.timeframes.today'
    });

    expect(screen.getByText('Conversacion colapsable')).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(
      screen.queryByText('Conversacion colapsable')
    ).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByText('Conversacion colapsable')).toBeInTheDocument();
  });
});
