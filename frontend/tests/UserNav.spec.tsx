import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserNav from '@/components/header/UserNav';

const mockLogout = vi.fn();
const mockUseAuth = vi.fn();
const mockUseConfig = vi.fn();
const mockSetLanguage = vi.fn();
const mockChangeLanguage = vi.fn();

vi.mock('@chainlit/react-client', () => ({
  useAuth: () => mockUseAuth(),
  useConfig: () => mockUseConfig(),
  useLanguage: () => ({ language: 'en-US', setLanguage: mockSetLanguage })
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { changeLanguage: mockChangeLanguage } })
}));

vi.mock('components/i18n', () => ({
  Translator: ({ path }: { path: string }) => <span>{path}</span>
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: any) => <div>{children}</div>,
  AvatarFallback: ({ children }: any) => <div>{children}</div>,
  AvatarImage: () => null
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ asChild, children, onSelect }: any) =>
    asChild ? <>{children}</> : <button onClick={onSelect}>{children}</button>,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuRadioGroup: ({ children }: any) => <div>{children}</div>,
  DropdownMenuRadioItem: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children }: any) => <button>{children}</button>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>
}));

describe('UserNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseConfig.mockReturnValue({
      config: { ui: { admin_url: '/public/management_app/index.html' } }
    });
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-id',
        identifier: 'user@example.com',
        metadata: { roles: ['web'] }
      },
      logout: mockLogout
    });
  });

  it('does not render administration for non-root users', () => {
    render(<UserNav />);

    expect(
      screen.queryByText('navigation.user.menu.administration')
    ).not.toBeInTheDocument();
  });

  it('renders administration for root users with the configured URL', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'root-id',
        identifier: 'root@example.com',
        metadata: { roles: ['web', 'root'] }
      },
      logout: mockLogout
    });

    render(<UserNav />);

    expect(
      screen.getByRole('link', { name: 'navigation.user.menu.administration' })
    ).toHaveAttribute('href', '/public/management_app/index.html');
  });
});
