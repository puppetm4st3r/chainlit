import { MessageContext } from 'contexts/MessageContext';
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  useChatInteract
} from '@chainlit/react-client';

import Alert from '@/components/Alert';

import Imports from './Imports';
import { loadCustomElementModuleTree } from './moduleLoader';
import * as Renderer from './Renderer';

const CustomElement = memo(function ({ element }: { element: ICustomElement }) {
  const apiClient = useContext(ChainlitContext);
  const sessionId = useRecoilValue(sessionIdState);
  const { sendMessage } = useChatInteract();
  const { user } = useAuth();
  const { askUser } = useContext(MessageContext);

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

  const updateElement = useCallback(
    (nextProps: Record<string, unknown>) => {
      if (!sessionId) return;
      const nextElement: IElement = { ...element, props: nextProps };
      return apiClient.updateElement(nextElement, sessionId);
    },
    [element, sessionId, apiClient]
  );

  const deleteElement = useCallback(() => {
    if (!sessionId) return;
    return apiClient.deleteElement(element, sessionId);
  }, [element, sessionId, apiClient]);

  const callAction = useCallback(
    (action: IAction) => {
      if (!sessionId) return;
      return apiClient.callAction(action, sessionId);
    },
    [sessionId, apiClient]
  );

  const sendUserMessage = useCallback(
    (message: string, command?: string) => {
      return sendMessage({
        threadId: '',
        id: uuidv4(),
        name: user?.identifier || 'User',
        type: 'user_message',
        output: message,
        createdAt: new Date().toISOString(),
        metadata: { location: window.location.href },
        command
      });
    },
    [sendMessage, user]
  );

  const submitElement = useCallback(
    (props: Record<string, unknown>) => {
      if (
        askUser?.spec.type === 'element' &&
        askUser.spec.step_id === element.forId
      ) {
        askUser.callback({ ...props, submitted: true });
      }
    },
    [askUser, element.forId]
  );

  const cancelElement = useCallback(() => {
    if (
      askUser?.spec.type === 'element' &&
      askUser.spec.step_id === element.forId
    ) {
      askUser.callback({ submitted: false });
    }
  }, [askUser, element.forId]);

  const props = useMemo(() => {
    return JSON.parse(JSON.stringify(element.props));
  }, [element.props]);

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

  return (
    <div className={`${element.display}-custom flex flex-col flex-grow`}>
      <Runner
        code={sourceCode}
        scope={{
          import: { ...baseImports, ...localImports },
          props,
          apiClient,
          updateElement,
          deleteElement,
          callAction,
          sendUserMessage,
          submitElement,
          cancelElement
        }}
        onRendered={(error) => setError(error?.message)}
      />
    </div>
  );
});

export default CustomElement;
