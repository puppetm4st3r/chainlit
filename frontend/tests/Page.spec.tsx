import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Page from '@/pages/Page';

const mockUseAuth = vi.fn();
const mockUseChatData = vi.fn();
const mockUseConfig = vi.fn();
const mockUseRecoilValue = vi.fn();

vi.mock('@chainlit/react-client', async () => {
  const actual =
    await vi.importActual<typeof import('@chainlit/react-client')>(
      '@chainlit/react-client'
    );

  return {
    ...actual,
    sideViewState: { key: 'SideView' },
    useAuth: () => mockUseAuth(),
    useChatData: () => mockUseChatData(),
    useConfig: () => mockUseConfig()
  };
});

vi.mock('recoil', async () => {
  const actual = await vi.importActual<typeof import('recoil')>('recoil');
  return {
    ...actual,
    useRecoilValue: (atom: { key?: string }) => mockUseRecoilValue(atom)
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom'
  );
  return {
    ...actual,
    Navigate: () => <div data-testid="navigate" />
  };
});

vi.mock('@/components/LeftSidebar', () => ({
  default: () => <div data-testid="left-sidebar" />
}));

vi.mock('@/components/header', () => ({
  Header: () => <div data-testid="header" />
}));

vi.mock('@/components/Tasklist', () => ({
  TaskList: () => <div data-testid="task-list" />
}));

vi.mock('@/components/ElementSideView', () => ({
  default: () => <div data-testid="element-side-view" />
}));

vi.mock('@/components/ElementFloatingView', () => ({
  default: () => <div data-testid="element-floating-view" />
}));

vi.mock('@/components/ChatSettings/ChatSettingsSidebar', () => ({
  default: () => <div data-testid="chat-settings-sidebar" />
}));

vi.mock('@/components/ui/resizable', () => ({
  ResizablePanel: ({ children }: any) => <div>{children}</div>,
  ResizablePanelGroup: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/sidebar', () => ({
  SidebarInset: ({ children }: any) => <div>{children}</div>,
  SidebarProvider: ({ children }: any) => <div>{children}</div>
}));

vi.mock('state/user', () => ({
  userEnvState: { key: 'UserEnv' }
}));

describe('Page', () => {
  const configureDefaults = () => {
    mockUseConfig.mockReturnValue({ config: { dataPersistence: true, ui: {} } });
    mockUseAuth.mockReturnValue({ data: { requireLogin: true } });
    mockUseChatData.mockReturnValue({ conversationHistoryVisible: true });
    mockUseRecoilValue.mockImplementation((atom: { key?: string }) => {
      if (atom?.key === 'SideView') {
        return undefined;
      }
      if (atom?.key === 'UserEnv') {
        return {};
      }
      return undefined;
    });
  };

  it('renders the conversation history sidebar when runtime visibility is enabled', () => {
    configureDefaults();

    render(
      <Page>
        <div data-testid="page-content" />
      </Page>
    );

    expect(screen.getByTestId('left-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('hides the conversation history sidebar when runtime visibility is disabled', () => {
    configureDefaults();
    mockUseChatData.mockReturnValue({ conversationHistoryVisible: false });

    render(
      <Page>
        <div data-testid="page-content" />
      </Page>
    );

    expect(screen.queryByTestId('left-sidebar')).not.toBeInTheDocument();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });
});
