import type { IMessageElement } from '@chainlit/react-client';

export const CANVAS_SHELL_CLOSE_REQUEST_EVENT =
  'chainlit:canvas-shell-close-request';

type CanvasShellCloseDetail = {
  workspaceKey: string;
  widgetInstanceId: string;
};

const getCanvasShellCloseDetail = (
  elements?: IMessageElement[]
): CanvasShellCloseDetail | null => {
  if (!Array.isArray(elements)) {
    return null;
  }

  const canvasElement = elements.find(
    (element) => element.type === 'custom' && element.name === 'Canvas Editor'
  );
  if (!canvasElement || canvasElement.type !== 'custom') {
    return null;
  }

  const props =
    canvasElement.props && typeof canvasElement.props === 'object'
      ? canvasElement.props
      : {};
  const workspaceKey = String(props.workspaceKey || '').trim();
  if (!workspaceKey) {
    return null;
  }

  return {
    workspaceKey,
    widgetInstanceId: String(props.widgetInstanceId || '').trim()
  };
};

export const dispatchCanvasShellCloseRequest = (
  elements?: IMessageElement[]
): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const detail = getCanvasShellCloseDetail(elements);
  if (!detail) {
    return false;
  }

  window.dispatchEvent(
    new CustomEvent(CANVAS_SHELL_CLOSE_REQUEST_EVENT, { detail })
  );
  return true;
};
