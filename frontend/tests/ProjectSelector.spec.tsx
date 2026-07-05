import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ProjectSelector from '@/components/LeftSidebar/ProjectSelector';

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>
}));

describe('ProjectSelector', () => {
  it('shows the static project label and name', () => {
    render(<ProjectSelector />);

    expect(screen.getByText('Proyecto')).toBeInTheDocument();
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Administrar base de conocimientos del proyecto'
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cambiar de proyecto' })
    ).toBeInTheDocument();
  });

  it('keeps project action buttons as no-ops for now', () => {
    render(<ProjectSelector />);

    expect(() => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Administrar base de conocimientos del proyecto'
        })
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Cambiar de proyecto' })
      );
    }).not.toThrow();
  });
});
