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
import { useDismissFloatingView } from '@/hooks/useDismissFloatingView';

import Imports from './Imports';
import { loadCustomElementModuleTree } from './moduleLoader';
import * as Renderer from './Renderer';

const CustomElement = memo(function ({ element }: { element: ICustomElement }) {
  const apiClient = useContext(ChainlitContext);
  const sessionId = useRecoilValue(sessionIdState);
  const { sendMessage } = useChatInteract();
  const { user } = useAuth();
  // Recoil ask state works for floating hosts (outside MessageContext) and inline asks.
  const { askUser } = useChatData();
  const dismissFloatingView = useDismissFloatingView();
  const elementRef = useRef(element);
  elementRef.current = element;

  const [sourceCode, setSourceCode] = useState<string>();
  const [localImports, setLocalImports] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string>();
  const [isLoadingSource, setIsLoadingSource] = useState(false);

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
        `Loading custom element '${element.name}' timed out before the source code became available.`
      );
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
            `Failed to fetch custom element module '${publicPath}' (${response.status}).`
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
        setError(String(err));
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

  // react-runner remounts the entire tree whenever `scope` identity changes.
  // Stabilize props by value so equivalent element.props object replacements do
  // not tear down long-lived editors (canvas sidebar shells).
  const propsSignature = useMemo(
    () => JSON.stringify(element.props ?? {}),
    [element.props]
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

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!sourceCode) {
    return isLoadingSource ? (
      <Alert variant="info">
        {`Loading custom element '${element.name}'...`}
      </Alert>
    ) : (
      <Alert variant="error">
        {`Custom element '${element.name}' did not provide renderable source code.`}
      </Alert>
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
