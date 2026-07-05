import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecoilRoot, atom } from 'recoil';

const mockedRecoilState = vi.hoisted(() => ({
  workflowHelpState: undefined as any
}));

type IWorkflowHelp = {
  automataId: string;
  title: string;
  url: string;
  buttonLabel: string;
  preferenceKey: string;
  effectiveVersion: string;
  threadId: string;
  openOnResume: boolean;
  lifecycle: 'start' | 'resume';
};

vi.mock('@chainlit/react-client', async () => {
  const { atom } = await import('recoil');
  mockedRecoilState.workflowHelpState = atom({
    key: 'testWorkflowHelpState',
    default: undefined as IWorkflowHelp | undefined
  });
  return {
    workflowHelpState: mockedRecoilState.workflowHelpState
  };
});

import { useWorkflowHelpController } from '@/hooks/useWorkflowHelpController';

const baseWorkflowHelp: IWorkflowHelp = {
  automataId: 'agent-a',
  title: 'Workflow guide',
  url: '/doc/agent-a/index.html',
  buttonLabel: 'Guide',
  preferenceKey: 'workflow-help::agent-a::definition:12::v1',
  effectiveVersion: 'v1',
  threadId: 'thread-1',
  openOnResume: true,
  lifecycle: 'start'
};

const ControllerProbe = () => {
  const {
    activeHelp,
    closeAndPersistPreferences,
    isAutoSuppressed,
    isOpen,
    openManual,
    openReason
  } = useWorkflowHelpController();

  return (
    <div>
      <div data-testid="active-help">{activeHelp?.title || 'none'}</div>
      <div data-testid="is-open">{String(isOpen)}</div>
      <div data-testid="open-reason">{openReason || 'none'}</div>
      <div data-testid="is-auto-suppressed">{String(isAutoSuppressed)}</div>
      <button onClick={openManual}>open-manual</button>
      <button
        onClick={() =>
          closeAndPersistPreferences({
            suppressAutoOpen: false,
            acknowledgeAutoOpen: false
          })
        }
      >
        close
      </button>
    </div>
  );
};

const renderController = (workflowHelp: IWorkflowHelp = baseWorkflowHelp) =>
  render(
    <RecoilRoot
      initializeState={({ set }) => {
        set(mockedRecoilState.workflowHelpState, workflowHelp);
      }}
    >
      <ControllerProbe />
    </RecoilRoot>
  );

describe('useWorkflowHelpController', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('auto-opens when no dismissal or acknowledgement exists', async () => {
    renderController();

    await waitFor(() =>
      expect(screen.getByTestId('is-open')).toHaveTextContent('true')
    );
    expect(screen.getByTestId('open-reason')).toHaveTextContent('auto');
    expect(screen.getByTestId('is-auto-suppressed')).toHaveTextContent('false');
  });

  it('suppresses auto-open when the workflow is persistently dismissed', async () => {
    window.localStorage.setItem(
      `workflow-help-dismissed::${baseWorkflowHelp.preferenceKey}`,
      'true'
    );

    renderController();

    await waitFor(() =>
      expect(screen.getByTestId('is-auto-suppressed')).toHaveTextContent('true')
    );
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    expect(screen.getByTestId('open-reason')).toHaveTextContent('none');
  });

  it('suppresses auto-open after acknowledgement on the same thread', async () => {
    window.sessionStorage.setItem(
      `workflow-help-ack::${baseWorkflowHelp.threadId}::${baseWorkflowHelp.preferenceKey}`,
      'true'
    );

    renderController();

    await waitFor(() =>
      expect(screen.getByTestId('is-auto-suppressed')).toHaveTextContent('true')
    );
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('keeps manual reopen available even when auto-open is suppressed', async () => {
    window.localStorage.setItem(
      `workflow-help-dismissed::${baseWorkflowHelp.preferenceKey}`,
      'true'
    );

    renderController();

    await waitFor(() =>
      expect(screen.getByTestId('is-auto-suppressed')).toHaveTextContent('true')
    );

    fireEvent.click(screen.getByText('open-manual'));

    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('open-reason')).toHaveTextContent('manual');
  });
});
