import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { Runner } from 'react-runner';
import { useRecoilValue } from 'recoil';
import { v4 as uuidv4 } from 'uuid';

import {
  ChainlitContext,
  IAction,
  ICustomElement,
  IElement,
  sessionIdState,
  useAuth,
  useChatData,
  useChatInteract
} from '@chainlit/react-client';

import Alert from '@/components/Alert';
import { useTranslation } from '@/components/i18n/Translator';
import { Loader } from '@/components/Loader';
import { useDismissFloatingView } from '@/hooks/useDismissFloatingView';
import { Translator } from 'components/i18n';

import { useFetch } from 'hooks/useFetch';

import Imports from './Imports';
import { loadCustomElementModuleTree } from './moduleLoader';
import * as Renderer from './Renderer';

const CONTENT_DEFERRED_KEY = '_contentDeferred';
const CONTENT_REVISION_KEY = '_contentRevision';

/**
 * True when the socket event omitted oversized props (e.g. a PDF data URL).
 */
function isDeferredCustomElementProps(
  props: Record<string, unknown> | undefined
): boolean {
  return Boolean(props && props[CONTENT_DEFERRED_KEY] === true);
}

/**
 * Build the blob URL used to hydrate deferred CustomElement props.
 *
 * The revision query busts SWR when ArtifactPreview (or any host) updates
 * the persisted JSON behind a stable chainlit key.
 */
function deferredPropsUrl(
  url: string | undefined,
  revision: unknown
): string | null {
  if (!url) {
    return null;
  }
  const token = typeof revision === 'string' ? revision : '';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_cr=${encodeURIComponent(token)}`;
}

const CustomElement = memo(function ({ element }: { element: ICustomElement }) {
  const apiClient = useContext(ChainlitContext);
  const sessionId = useRecoilValue(sessionIdState);
  const { sendMessage } = useChatInteract();
  const { user } = useAuth();
  // Recoil ask state works for floating hosts (outside MessageContext) and inline asks.
  const { askUser } = useChatData();
  const dismissFloatingView = useDismissFloatingView();
  const { t } = useTranslation();
  const elementRef = useRef(element);
  elementRef.current = element;
  // Keep translator off the fetch effect deps: JSX load must not restart on
  // render identity churn (or language ticks mid-request).
  const tRef = useRef(t);
  tRef.current = t;

  const [sourceCode, setSourceCode] = useState<string>();
  const [localImports, setLocalImports] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string>();
  // Start true so the first paint never flashes the "not found" error before fetch begins.
  const [isLoadingSource, setIsLoadingSource] = useState(true);

  const baseImports = useMemo(
    () => ({
      ...Imports,
      '@/components/renderer': Renderer
    }),
    []
  );

  useEffect(() => {
    let isCancelled = false;
    const sourceLoadTimeout = window.setTimeout(() => {
      if (isCancelled) return;
      setError(
        tRef.current('chat.customElement.errors.timeout', {
          name: element.name
        })
      );
      setIsLoadingSource(false);
    }, 10000);

    setError(undefined);
    setSourceCode(undefined);
    setLocalImports({});
    setIsLoadingSource(true);

    loadCustomElementModuleTree({
      rootModulePath: `${element.name}.jsx`,
      fetchModuleSource: async (publicPath) => {
        const response = await apiClient.get(publicPath);
        if ('ok' in response && !response.ok) {
          throw new Error(
            tRef.current('chat.customElement.errors.fetchFailed', {
              path: publicPath,
              status: response.status
            })
          );
        }
        return response.text();
      },
      baseImports
    })
      .then(({ sourceCode, localImports }) => {
        if (isCancelled) return;
        window.clearTimeout(sourceLoadTimeout);
        setSourceCode(sourceCode);
        setLocalImports(localImports);
        setIsLoadingSource(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        window.clearTimeout(sourceLoadTimeout);
        setError(err instanceof Error ? err.message : String(err));
        setIsLoadingSource(false);
      });

    return () => {
      isCancelled = true;
      window.clearTimeout(sourceLoadTimeout);
    };
  }, [apiClient, baseImports, element.name]);

  const askUserRef = useRef(askUser);
  askUserRef.current = askUser;
  const dismissFloatingViewRef = useRef(dismissFloatingView);
  dismissFloatingViewRef.current = dismissFloatingView;

  const updateElement = useCallback(
    (nextProps: Record<string, unknown>) => {
      if (!sessionId) return;
      const nextElement: IElement = { ...elementRef.current, props: nextProps };
      return apiClient.updateElement(nextElement, sessionId);
    },
    [sessionId, apiClient]
  );

  const deleteElement = useCallback(() => {
    if (!sessionId) return;
    return apiClient.deleteElement(elementRef.current, sessionId);
  }, [sessionId, apiClient]);

  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;
  const userIdentifierRef = useRef(user?.identifier);
  userIdentifierRef.current = user?.identifier;

  const callAction = useCallback(
    (action: IAction) => {
      if (!sessionId) return;
      return apiClient.callAction(action, sessionId);
    },
    [sessionId, apiClient]
  );

  const sendUserMessage = useCallback((message: string, command?: string) => {
    return sendMessageRef.current({
      threadId: '',
      id: uuidv4(),
      name: userIdentifierRef.current || 'User',
      type: 'user_message',
      output: message,
      createdAt: new Date().toISOString(),
      metadata: { location: window.location.href },
      command
    });
  }, []);

  // Keep ask/dismiss out of Runner scope identity. Otherwise any askUser atom
  // update would remount every CustomElement (including canvas Toast UI) and
  // re-emit canvas:ready in a loop.
  const submitElement = useCallback((props: Record<string, unknown>) => {
    const currentElement = elementRef.current;
    const currentAskUser = askUserRef.current;
    if (
      currentAskUser?.spec.type === 'element' &&
      currentAskUser.spec.step_id === currentElement.forId
    ) {
      currentAskUser.callback({ ...props, submitted: true });
      if (currentElement.display === 'floating') {
        dismissFloatingViewRef.current(currentElement);
      }
      return true;
    }
    console.warn(
      '[ask_element] submitElement ignored: no matching active ask',
      {
        elementId: currentElement.id,
        elementForId: currentElement.forId,
        askStepId: currentAskUser?.spec?.step_id,
        askType: currentAskUser?.spec?.type
      }
    );
    return false;
  }, []);

  const cancelElement = useCallback(() => {
    const currentElement = elementRef.current;
    const currentAskUser = askUserRef.current;
    if (
      currentAskUser?.spec.type === 'element' &&
      currentAskUser.spec.step_id === currentElement.forId
    ) {
      currentAskUser.callback({ submitted: false });
      if (currentElement.display === 'floating') {
        dismissFloatingViewRef.current(currentElement);
      }
    }
  }, []);

  const socketProps = (element.props || {}) as Record<string, unknown>;
  const deferredProps = isDeferredCustomElementProps(socketProps);
  const {
    data: hydratedProps,
    error: propsLoadError,
    isLoading: isLoadingProps
  } = useFetch(
    deferredProps
      ? deferredPropsUrl(element.url, socketProps[CONTENT_REVISION_KEY])
      : null
  );

  // react-runner remounts the entire tree whenever `scope` identity changes.
  // Stabilize props by value so equivalent element.props object replacements do
  // not tear down long-lived editors (canvas sidebar shells).
  const resolvedProps = deferredProps
    ? hydratedProps && typeof hydratedProps === 'object' && !Array.isArray(hydratedProps)
      ? (hydratedProps as Record<string, unknown>)
      : null
    : socketProps;
  const propsSignature = useMemo(
    () => JSON.stringify(resolvedProps ?? {}),
    [resolvedProps]
  );
  const props = useMemo(() => {
    try {
      return JSON.parse(propsSignature);
    } catch {
      return {};
    }
  }, [propsSignature]);

  const runnerScope = useMemo(
    () => ({
      import: { ...baseImports, ...localImports },
      props,
      apiClient,
      sessionId,
      updateElement,
      deleteElement,
      callAction,
      sendUserMessage,
      submitElement,
      cancelElement
    }),
    [
      apiClient,
      baseImports,
      callAction,
      cancelElement,
      deleteElement,
      localImports,
      props,
      sendUserMessage,
      sessionId,
      submitElement,
      updateElement
    ]
  );

  if (deferredProps && !element.url) {
    return (
      <Alert variant="error">
        {t('chat.customElement.errors.fetchFailed', {
          path: element.name,
          status: 0
        })}
      </Alert>
    );
  }
  if (deferredProps && propsLoadError) {
    return (
      <Alert variant="error">
        {t('chat.customElement.errors.fetchFailed', {
          path: element.name,
          status: 0
        })}
      </Alert>
    );
  }
  if (deferredProps && (isLoadingProps || !resolvedProps)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6">
        <Loader className="!size-6" />
        <span className="text-sm text-muted-foreground">
          <Translator path="common.status.loading" />
        </span>
      </div>
    );
  }
  if (error) return <Alert variant="error">{error}</Alert>;
  if (!sourceCode) {
    // Only treat empty source as a hard failure after the fetch settled.
    if (!isLoadingSource) {
      return (
        <Alert variant="error">
          {t('chat.customElement.errors.emptySource', {
            name: element.name
          })}
        </Alert>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6">
        <Loader className="!size-6" />
        <span className="text-sm text-muted-foreground">
          <Translator path="common.status.loading" />
        </span>
      </div>
    );
  }

  // Floating hosts constrain height; fill that box so child JSX can own scroll.
  const isFloating = element.display === 'floating';

  return (
    <div
      className={
        isFloating
          ? `${element.display}-custom flex h-full min-h-0 flex-col overflow-hidden [&>*]:flex [&>*]:h-full [&>*]:min-h-0 [&>*]:flex-col [&>*]:overflow-hidden`
          : `${element.display}-custom flex flex-col flex-grow`
      }
    >
      <Runner
        code={sourceCode}
        scope={runnerScope}
        onRendered={(error) => setError(error?.message)}
      />
    </div>
  );
});

export default CustomElement;
