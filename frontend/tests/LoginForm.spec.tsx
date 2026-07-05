import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/components/LoginForm';

vi.mock('components/i18n/Translator', () => ({
  default: ({ path }: { path: string }) => <span>{path}</span>,
  useTranslation: () => ({ t: (key: string | string[]) => key })
}));

describe('LoginForm', () => {
  const defaultProps = {
    callbackUrl: '/',
    providers: [],
    onPasswordSignIn: vi.fn()
  };

  it('renders the private integration-token bootstrap link when configured', () => {
    render(
      <LoginForm
        {...defaultProps}
        privateIntegrationTokenBootstrapUrl="/public/management_app/index.html"
      />
    );

    expect(
      screen.getByRole('link', { name: 'auth.login.privateIntegrationTokenBootstrap' })
    ).toHaveAttribute('href', '/public/management_app/index.html');
  });

  it('hides the private integration-token bootstrap link when it is not configured', () => {
    render(<LoginForm {...defaultProps} />);

    expect(
      screen.queryByText('auth.login.privateIntegrationTokenBootstrap')
    ).not.toBeInTheDocument();
  });
});
