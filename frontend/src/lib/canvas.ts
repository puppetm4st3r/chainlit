import type { IMessageElement } from '@chainlit/react-client';

export const CANVAS_SHELL_CLOSE_REQUEST_EVENT =
  'chainlit:canvas-shell-close-request';

export const logCanvasCloseDiag = (
  event: string,
  details?: Record<string, unknown>
) => {
  console.warn(`[CanvasCloseDiag] ${event}`, details || {});
};

type CanvasShellCloseDetail = {
  workspaceKey: string;
  widgetInstanceId: string;
};

export const isCanvasShellElement = (element?: IMessageElement): boolean => {
  if (!element || element.type !== 'custom') {
    return false;
  }

  const props =
    element.props && typeof element.props === 'object' ? element.props : {};
  return String(props.workspaceKey || '').trim().length > 0;
};

/**
 * Canvas shells are owned by ElementSidebar (`set_sidebar_elements` + key).
 * MessagesContainer must not auto-open them from accumulated `elementState`.
 */
export const excludeCanvasShellElements = (
  elements: IMessageElement[]
): IMessageElement[] => {
  return (elements || []).filter((element) => !isCanvasShellElement(element));
};

export const getCanvasShellCloseDetail = (
  elements?: IMessageElement[]
): CanvasShellCloseDetail | null => {
  if (!Array.isArray(elements)) {
    return null;
  }

  const canvasElement = elements.find(isCanvasShellElement);
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
    logCanvasCloseDiag('dispatch_skipped_no_window');
    return false;
  }

  const detail = getCanvasShellCloseDetail(elements);
  if (!detail) {
    logCanvasCloseDiag('dispatch_skipped_no_detail');
    return false;
  }

  logCanvasCloseDiag('dispatch_shell_close_request', detail);
  window.dispatchEvent(
    new CustomEvent(CANVAS_SHELL_CLOSE_REQUEST_EVENT, { detail })
  );
  return true;
};
