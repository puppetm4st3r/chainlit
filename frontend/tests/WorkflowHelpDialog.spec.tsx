import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import WorkflowHelpDialog from '@/components/workflow-help/WorkflowHelpDialog';

const mockUseWorkflowHelpController = vi.fn();

vi.mock('@/hooks/useWorkflowHelpController', () => ({
  useWorkflowHelpController: () => mockUseWorkflowHelpController()
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({
    children,
    onEscapeKeyDown: _onEscapeKeyDown,
    onPointerDownOutside: _onPointerDownOutside,
    ...props
  }: any) => <div {...props}>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      {...props}
      checked={Boolean(checked)}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      type="checkbox"
    />
  )
}));

vi.mock('components/i18n/Translator', () => ({
  useTranslation: () => ({
    t: (path: string, options?: Record<string, unknown>) => {
      if (path === 'workflowHelp.continueCountdown') {
        return `Continue (${options?.count}s)`;
      }
      if (path === 'common.actions.continue') {
        return 'Continue';
      }
      if (path === 'workflowHelp.close') {
        return 'Close';
      }
      if (path === 'workflowHelp.openInNewTab') {
        return 'Open in new tab';
      }
      if (path === 'workflowHelp.titleFallback') {
        return 'Workflow guide';
      }
      if (path === 'workflowHelp.embedHint') {
        return 'Review this guide before continuing with the workflow.';
      }
      if (path === 'workflowHelp.fallbackNotice') {
        return 'If the page does not render correctly inside the dialog, use "Open in new tab".';
      }
      if (path === 'workflowHelp.doNotShowAutomatically') {
        return 'Do not show automatically again';
      }
      if (path === 'common.status.loading') {
        return 'Loading...';
      }
      return path;
    }
  })
}));

const baseControllerValue = {
  activeHelp: {
    automataId: 'agent-a',
    title: 'Workflow guide',
    url: '/doc/agent-a/index.html',
    buttonLabel: 'Guide',
    preferenceKey: 'workflow-help::agent-a::definition:12::v1',
    effectiveVersion: 'v1',
    threadId: 'thread-1',
    openOnResume: true,
    lifecycle: 'start' as const
  },
  isAutoSuppressed: false,
  isOpen: true,
  isPersistentlyDismissed: false,
  openManual: vi.fn(),
  openReason: 'auto' as const
};

describe('WorkflowHelpDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 900
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 900
    });
    vi.stubGlobal(
      'requestAnimationFrame',
      ((callback: FrameRequestCallback) =>
        window.setTimeout(() => {
          callback(7001);
        }, 16)) as typeof window.requestAnimationFrame
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      ((handle: number) => window.clearTimeout(handle)) as typeof window.cancelAnimationFrame
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('blocks closing in auto mode while the gating conditions are active', () => {
    const closeAndPersistPreferences = vi.fn();
    mockUseWorkflowHelpController.mockReturnValue({
      ...baseControllerValue,
      closeAndPersistPreferences
    });

    render(<WorkflowHelpDialog />);

    expect(
      screen.getByRole('button', { name: 'Continue (7s)' })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue (7s)' }));
    expect(closeAndPersistPreferences).not.toHaveBeenCalled();
  });

  it('closes immediately in manual mode', () => {
    const closeAndPersistPreferences = vi.fn();
    mockUseWorkflowHelpController.mockReturnValue({
      ...baseControllerValue,
      closeAndPersistPreferences,
      openReason: 'manual'
    });

    render(<WorkflowHelpDialog />);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    expect(closeButton).not.toBeDisabled();

    fireEvent.click(closeButton);

    expect(closeAndPersistPreferences).toHaveBeenCalledWith({
      suppressAutoOpen: false,
      acknowledgeAutoOpen: false
    });
  });
});
