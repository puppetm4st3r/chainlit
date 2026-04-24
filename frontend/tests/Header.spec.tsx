import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Header } from '@/components/header';

const mockUseConfig = vi.fn();
const mockWindowMessage = vi.fn();
const mockUseRecoilValue = vi.fn();
const mockSetSideView = vi.fn();

vi.mock('@chainlit/react-client', async () => {
  const actual =
    await vi.importActual<typeof import('@chainlit/react-client')>(
      '@chainlit/react-client'
    );

  return {
    ...actual,
    useAudio: () => ({ audioConnection: 'off' }),
    useAuth: () => ({ data: { requireLogin: false } }),
    useChatData: () => ({ chatSettingsInputs: [] }),
    useChatInteract: () => ({ windowMessage: mockWindowMessage }),
    useConfig: () => mockUseConfig()
  };
});

vi.mock('recoil', async () => {
  const actual = await vi.importActual<typeof import('recoil')>('recoil');
  return {
    ...actual,
    useRecoilValue: (atom: { key?: string }) => mockUseRecoilValue(atom),
    useSetRecoilState: (atom: { key?: string }) =>
      atom?.key === 'SideView' ? mockSetSideView : vi.fn()
  };
});

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn()
}));

vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({ open: false, openMobile: false, isMobile: false })
}));

vi.mock('@/components/AudioPresence', () => ({
  default: () => <div data-testid="audio-presence" />
}));

vi.mock('@/components/ButtonLink', () => ({
  default: () => <div data-testid="header-link" />
}));

vi.mock('@/components/icons/Settings', () => ({
  Settings: () => <div data-testid="settings-icon" />
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>
}));

vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children }: any) => <>{children}</>,
  HoverCardTrigger: ({ children }: any) => <>{children}</>,
  HoverCardContent: ({ children }: any) => <>{children}</>
}));

vi.mock('components/i18n', () => ({
  Translator: ({ path }: { path: string }) => <span>{path}</span>
}));

vi.mock('@/components/header/ApiKeys', () => ({
  default: () => <div data-testid="api-keys" />
}));

vi.mock('@/components/header/ChatProfiles', () => ({
  default: () => <div data-testid="chat-profiles" />
}));

vi.mock('@/components/header/NewChat', () => ({
  default: () => <div data-testid="new-chat" />
}));

vi.mock('@/components/header/Readme', () => ({
  default: () => <div data-testid="readme-button" />
}));

vi.mock('@/components/header/Share', () => ({
  default: () => <div data-testid="share-button" />
}));

vi.mock('@/components/header/SidebarTrigger', () => ({
  default: () => <div data-testid="sidebar-trigger" />
}));

vi.mock('@/components/header/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />
}));

vi.mock('@/components/header/UserNav', () => ({
  default: () => <div data-testid="user-nav" />
}));

describe('Header', () => {
  const configureDefaultRecoilValues = () => {
    mockUseRecoilValue.mockImplementation((atom: { key?: string }) => {
      if (atom?.key === 'SideView') {
        return undefined;
      }
      if (atom?.key === 'DocumentWorkspaceState') {
        return undefined;
      }
      return undefined;
    });
  };

  it('dispatches a shell close request before hiding an open canvas side view', () => {
    mockUseConfig.mockReturnValue({ config: { ui: {} } });
    mockUseRecoilValue.mockImplementation((atom: { key?: string }) => {
      if (atom?.key === 'SideView') {
        return {
          title: 'Document',
          elements: [
            {
              id: 'canvas-1',
              type: 'custom',
              name: 'Canvas Editor',
              display: 'side',
              forId: 'message-1',
              props: {
                workspaceKey: 'workspace-1',
                widgetInstanceId: 'widget-1'
              }
            }
          ]
        };
      }
      if (atom?.key === 'DocumentWorkspaceState') {
        return undefined;
      }
      return undefined;
    });
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    render(<Header />);

    const closeButton = document.querySelector('#side-view-title button');
    expect(closeButton).not.toBeNull();

    fireEvent.click(closeButton!);

    expect(mockSetSideView).toHaveBeenCalledWith(undefined);
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const closeEvent = dispatchEventSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(closeEvent.type).toBe('chainlit:canvas-shell-close-request');
    expect(closeEvent.detail).toEqual({
      workspaceKey: 'workspace-1',
      widgetInstanceId: 'widget-1'
    });
  });

  it('renders readme button, theme toggle, chat profiles and user nav by default', () => {
    configureDefaultRecoilValues();
    mockUseConfig.mockReturnValue({ config: { ui: {} } });

    render(<Header />);

    expect(screen.getByTestId('readme-button')).toBeInTheDocument();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('chat-profiles')).toBeInTheDocument();
    expect(screen.getByTestId('user-nav')).toBeInTheDocument();
  });

  it('hides readme button, theme toggle, chat profiles and user nav when configured', () => {
    configureDefaultRecoilValues();
    mockUseConfig.mockReturnValue({
      config: { ui: { hide_topright_bar: true } }
    });

    render(<Header />);

    expect(screen.queryByTestId('readme-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('theme-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-profiles')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-nav')).not.toBeInTheDocument();
  });

  it('renders the active file editing badge and open-editor action when the workspace exists but the canvas is closed', () => {
    mockUseConfig.mockReturnValue({ config: { ui: {} } });
    mockUseRecoilValue.mockImplementation((atom: { key?: string }) => {
      if (atom?.key === 'DocumentWorkspaceState') {
        return {
          hasActiveWorkspace: true,
          enabled: false,
          filename: 'draft.docx',
          workspaceNodeName: 'Workspace Contrato'
        };
      }
      return undefined;
    });

    render(<Header />);

    expect(screen.getByText('chat.workspace.activePrimary')).toBeInTheDocument();
    expect(screen.getByText('chat.workspace.activeSecondary')).toBeInTheDocument();
    expect(screen.getByText('chat.workspace.openEditorWord')).toBeInTheDocument();

    fireEvent.click(screen.getByText('chat.workspace.openEditorWord'));

    expect(mockWindowMessage).toHaveBeenCalledWith({
      type: 'canvas:open_active_workspace'
    });
  });

  it('renders the active file editing badge without open-editor action when the canvas is already open', () => {
    mockUseConfig.mockReturnValue({ config: { ui: {} } });
    mockUseRecoilValue.mockImplementation((atom: { key?: string }) => {
      if (atom?.key === 'DocumentWorkspaceState') {
        return {
          hasActiveWorkspace: true,
          enabled: true,
          filename: 'draft.docx',
          workspaceNodeName: 'Workspace Contrato'
        };
      }
      return undefined;
    });

    render(<Header />);

    expect(screen.getByText('chat.workspace.activePrimary')).toBeInTheDocument();
    expect(screen.getByText('chat.workspace.activeSecondary')).toBeInTheDocument();
    expect(
      screen.queryByText('chat.workspace.openEditorWord')
    ).not.toBeInTheDocument();
  });
});
