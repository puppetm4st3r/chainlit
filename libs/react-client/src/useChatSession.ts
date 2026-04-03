import { debounce } from 'lodash';
import { useCallback, useContext, useEffect, useRef } from 'react';
import {
  useRecoilState,
  useRecoilValue,
  useResetRecoilState,
  useSetRecoilState
} from 'recoil';
import io from 'socket.io-client';
import { toast } from 'sonner';
import {
  actionState,
  askUserState,
  audioConnectionState,
  callFnState,
  chatProfileState,
  chatSettingsInputsState,
  chatSettingsValueState,
  commandsState,
  currentThreadIdState,
  elementState,
  firstUserInteraction,
  isAiSpeakingState,
  loadingState,
  mcpState,
  messagesState,
  resumeThreadErrorState,
  sessionIdState,
  sessionState,
  sideViewState,
  tasklistState,
  threadIdToResumeState,
  tokenCountState,
  wavRecorderState,
  wavStreamPlayerState
} from 'src/state';
import {
  IAction,
  ICommand,
  IElement,
  IMessageElement,
  IStep,
  ITasklistElement,
  IThread
} from 'src/types';
import {
  addMessage,
  deleteMessageById,
  updateMessageById,
  updateMessageContentById
} from 'src/utils/message';

import { OutputAudioChunk } from './types/audio';

import { ChainlitContext } from './context';
import { useLanguage } from './useLanguage';
import type { IToken } from './useChatData';

interface BufferedStreamToken extends IToken {
  key: string;
}

const useChatSession = () => {
  const client = useContext(ChainlitContext);
  const sessionId = useRecoilValue(sessionIdState);
  const { language } = useLanguage();

  const [session, setSession] = useRecoilState(sessionState);
  const setIsAiSpeaking = useSetRecoilState(isAiSpeakingState);
  const setAudioConnection = useSetRecoilState(audioConnectionState);
  const resetChatSettingsValue = useResetRecoilState(chatSettingsValueState);
  const setChatSettingsValue = useSetRecoilState(chatSettingsValueState);
  const setFirstUserInteraction = useSetRecoilState(firstUserInteraction);
  const setLoading = useSetRecoilState(loadingState);
  const setMcps = useSetRecoilState(mcpState);
  const wavStreamPlayer = useRecoilValue(wavStreamPlayerState);
  const wavRecorder = useRecoilValue(wavRecorderState);
  const setMessages = useSetRecoilState(messagesState);
  const setAskUser = useSetRecoilState(askUserState);
  const setCallFn = useSetRecoilState(callFnState);
  const setCommands = useSetRecoilState(commandsState);
  const setSideView = useSetRecoilState(sideViewState);
  const setElements = useSetRecoilState(elementState);
  const setTasklists = useSetRecoilState(tasklistState);
  const setActions = useSetRecoilState(actionState);
  const setChatSettingsInputs = useSetRecoilState(chatSettingsInputsState);
  const setTokenCount = useSetRecoilState(tokenCountState);
  const [chatProfile, setChatProfile] = useRecoilState(chatProfileState);
  const idToResume = useRecoilValue(threadIdToResumeState);
  const setThreadResumeError = useSetRecoilState(resumeThreadErrorState);

  const [currentThreadId, setCurrentThreadId] =
    useRecoilState(currentThreadIdState);
  const bufferedStreamTokensRef = useRef<Map<string, BufferedStreamToken>>(
    new Map()
  );
  const streamFlushHandleRef = useRef<number | null>(null);

  const mergeChatSettingsInputs = useCallback(
    (inputs: any[], values: Record<string, any>): any[] => {
      if (!Array.isArray(inputs)) {
        return inputs;
      }

      return inputs.map((input) => {
        if (!input) {
          return input;
        }

        if (Array.isArray(input.inputs) && input.inputs.length > 0) {
          return {
            ...input,
            inputs: mergeChatSettingsInputs(input.inputs, values)
          };
        }

        if (input.id === undefined || !Object.prototype.hasOwnProperty.call(values, input.id)) {
          return input;
        }

        const rawValue = values[input.id];
        const nextInitial =
          rawValue && typeof rawValue === 'object' && Object.prototype.hasOwnProperty.call(rawValue, 'value')
            ? rawValue.value
            : rawValue;

        return {
          ...input,
          initial: nextInitial,
          description:
            rawValue && typeof rawValue === 'object' && typeof rawValue.description === 'string'
              ? rawValue.description
              : input.description
        };
      });
    },
    []
  );

  const cancelScheduledStreamFlush = useCallback(() => {
    if (streamFlushHandleRef.current === null) {
      return;
    }
    if (typeof window !== 'undefined') {
      window.cancelAnimationFrame(streamFlushHandleRef.current);
    }
    streamFlushHandleRef.current = null;
  }, []);

  const flushBufferedStreamTokens = useCallback(() => {
    cancelScheduledStreamFlush();
    const bufferedTokens = Array.from(bufferedStreamTokensRef.current.values());
    bufferedStreamTokensRef.current.clear();

    if (!bufferedTokens.length) {
      return;
    }

    setMessages((oldMessages) => {
      let nextMessages = oldMessages;
      for (const { id, token, isSequence, isInput } of bufferedTokens) {
        nextMessages = updateMessageContentById(
          nextMessages,
          id,
          token,
          isSequence,
          isInput
        );
      }
      return nextMessages;
    });
  }, [cancelScheduledStreamFlush, setMessages]);

  const scheduleStreamFlush = useCallback(() => {
    if (streamFlushHandleRef.current !== null) {
      return;
    }

    if (typeof window === 'undefined') {
      flushBufferedStreamTokens();
      return;
    }

    streamFlushHandleRef.current = window.requestAnimationFrame(() => {
      streamFlushHandleRef.current = null;
      flushBufferedStreamTokens();
    });
  }, [flushBufferedStreamTokens]);

  const enqueueBufferedStreamToken = useCallback(
    ({ id, token, isSequence, isInput }: IToken) => {
      const key = `${id}:${isInput ? 'input' : 'output'}`;
      const existingToken = bufferedStreamTokensRef.current.get(key);

      if (!existingToken) {
        bufferedStreamTokensRef.current.set(key, {
          id,
          token,
          isSequence,
          isInput,
          key
        });
      } else if (isSequence) {
        bufferedStreamTokensRef.current.set(key, {
          id,
          token,
          isSequence: true,
          isInput,
          key
        });
      } else {
        bufferedStreamTokensRef.current.set(key, {
          ...existingToken,
          token: existingToken.token + token,
          isSequence: existingToken.isSequence
        });
      }

      scheduleStreamFlush();
    },
    [scheduleStreamFlush]
  );

  useEffect(() => {
    return () => {
      cancelScheduledStreamFlush();
      bufferedStreamTokensRef.current.clear();
    };
  }, [cancelScheduledStreamFlush]);

  // Use currentThreadId as thread id in websocket header
  useEffect(() => {
    if (session?.socket) {
      session.socket.auth['threadId'] = currentThreadId || '';
    }
  }, [currentThreadId]);

  const _connect = useCallback(
    async ({
      transports,
      userEnv
    }: {
      transports?: string[];
      userEnv: Record<string, string>;
    }) => {
      const { protocol, host, pathname } = new URL(client.httpEndpoint);
      const uri = `${protocol}//${host}`;
      const path =
        pathname && pathname !== '/'
          ? `${pathname}/ws/socket.io`
          : '/ws/socket.io';

      try {
        await client.stickyCookie(sessionId);
      } catch (err) {
        console.error(`Failed to set sticky session cookie: ${err}`);
      }

      // Add CSRF headers when protections are active
      const extraHeaders: Record<string, string> = {};
      extraHeaders['X-Requested-With'] = 'XMLHttpRequest';

      if (language) {
        extraHeaders['X-Prompt-Language'] = language;
      }
      
      // Add origin validation
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
      if (currentOrigin) {
        extraHeaders['X-Client-Origin'] = currentOrigin;
      }

      const socket = io(uri, {
        path,
        withCredentials: true,
        transports,
        extraHeaders,
        auth: {
          clientType: client.type,
          sessionId,
          threadId: idToResume || '',
          userEnv: JSON.stringify(userEnv),
          chatProfile: chatProfile ? encodeURIComponent(chatProfile) : ''
        }
      });
      setSession((old) => {
        old?.socket?.removeAllListeners();
        old?.socket?.close();
        return {
          socket
        };
      });

      socket.on('connect', () => {
        socket.emit('connection_successful');
        setSession((s) => ({ ...s!, error: false }));
        setMcps((prev) =>
          prev.map((mcp) => {
            let promise;
            if (mcp.clientType === 'sse') {
              promise = client.connectSseMCP(sessionId, mcp.name, mcp.url!);
            } else if (mcp.clientType === 'streamable-http') {
              promise = client.connectStreamableHttpMCP(
                sessionId,
                mcp.name,
                mcp.url!,
                mcp.headers || {}
              );
            } else {
              promise = client.connectStdioMCP(
                sessionId,
                mcp.name,
                mcp.command!
              );
            }
            promise
              .then(async ({ success, mcp }) => {
                setMcps((prev) =>
                  prev.map((existingMcp) => {
                    if (existingMcp.name === mcp.name) {
                      return {
                        ...existingMcp,
                        status: success ? 'connected' : 'failed',
                        tools: mcp ? mcp.tools : existingMcp.tools
                      };
                    }
                    return existingMcp;
                  })
                );
              })
              .catch(() => {
                setMcps((prev) =>
                  prev.map((existingMcp) => {
                    if (existingMcp.name === mcp.name) {
                      return {
                        ...existingMcp,
                        status: 'failed'
                      };
                    }
                    return existingMcp;
                  })
                );
              });
            return { ...mcp, status: 'connecting' };
          })
        );
      });

      socket.on('connect_error', (_) => {
        setSession((s) => ({ ...s!, error: true }));
      });

      socket.on('task_start', () => {
        setLoading(true);
      });

      socket.on('task_end', () => {
        setLoading(false);
      });

      socket.on('reload', () => {
        socket.emit('clear_session');
        window.location.reload();
      });

      socket.on('audio_connection', async (state: 'on' | 'off') => {
        if (state === 'on') {
          let isFirstChunk = true;
          const startTime = Date.now();
          const mimeType = 'pcm16';
          // Connect to microphone
          await wavRecorder.begin();
          await wavStreamPlayer.connect();
          await wavRecorder.record(async (data) => {
            const elapsedTime = Date.now() - startTime;
            socket.emit('audio_chunk', {
              isStart: isFirstChunk,
              mimeType,
              elapsedTime,
              data: data.mono
            });
            isFirstChunk = false;
          });
          wavStreamPlayer.onStop = () => setIsAiSpeaking(false);
        } else {
          await wavRecorder.end();
          await wavStreamPlayer.interrupt();
        }
        setAudioConnection(state);
      });

      socket.on('audio_chunk', (chunk: OutputAudioChunk) => {
        wavStreamPlayer.add16BitPCM(chunk.data, chunk.track);
        setIsAiSpeaking(true);
      });

      socket.on('audio_interrupt', () => {
        wavStreamPlayer.interrupt();
      });

      socket.on('resume_thread', (thread: IThread) => {
        const isReadOnlyView = Boolean((thread as any)?.metadata?.viewer_read_only);
        if (!isReadOnlyView && idToResume && thread.id !== idToResume) {
          window.location.href = `/thread/${thread.id}`;
        }
        if (!isReadOnlyView && idToResume) {
          setCurrentThreadId(thread.id);
        }
        let messages: IStep[] = [];
        for (const step of thread.steps) {
          messages = addMessage(messages, step);
        }
        if (thread.metadata?.chat_profile) {
          setChatProfile(thread.metadata?.chat_profile);
        }
        if (thread.metadata?.chat_settings) {
          setChatSettingsValue(thread.metadata?.chat_settings);
        }
        setMessages(messages);
        const elements = thread.elements || [];
        setTasklists(
          (elements as ITasklistElement[]).filter((e) => e.type === 'tasklist')
        );
        setElements(
          (elements as IMessageElement[]).filter(
            (e) => ['avatar', 'tasklist'].indexOf(e.type) === -1
          )
        );
      });

      socket.on('resume_thread_error', (error?: string) => {
        setThreadResumeError(error);
      });

      socket.on('new_message', (message: IStep) => {
        flushBufferedStreamTokens();
        setMessages((oldMessages) => addMessage(oldMessages, message));
      });

      socket.on(
        'first_interaction',
        (event: { interaction: string; thread_id: string }) => {
          setFirstUserInteraction(event.interaction);
          setCurrentThreadId(event.thread_id);
        }
      );

      socket.on('update_message', (message: IStep) => {
        flushBufferedStreamTokens();
        setMessages((oldMessages) =>
          updateMessageById(oldMessages, message.id, message)
        );
      });

      socket.on('delete_message', (message: IStep) => {
        flushBufferedStreamTokens();
        setMessages((oldMessages) =>
          deleteMessageById(oldMessages, message.id)
        );
      });

      socket.on('stream_start', (message: IStep) => {
        flushBufferedStreamTokens();
        setMessages((oldMessages) => addMessage(oldMessages, message));
      });

      socket.on('stream_token', (payload: IToken) => {
        enqueueBufferedStreamToken(payload);
      });

      socket.on('ask', ({ msg, spec }, callback) => {
        flushBufferedStreamTokens();
        setAskUser({ spec, callback, parentId: msg.parentId });
        setMessages((oldMessages) => addMessage(oldMessages, msg));

        setLoading(false);
      });

      socket.on('ask_timeout', () => {
        setAskUser(undefined);
        setLoading(false);
      });

      socket.on('clear_ask', () => {
        setAskUser(undefined);
      });

      socket.on('call_fn', ({ name, args }, callback) => {
        setCallFn({ name, args, callback });
      });

      socket.on('clear_call_fn', () => {
        setCallFn(undefined);
      });

      socket.on('call_fn_timeout', () => {
        setCallFn(undefined);
      });

      socket.on('chat_settings', (inputs: any) => {
        setChatSettingsInputs(inputs);
        resetChatSettingsValue();
      });

      socket.on('chat_settings_values', (values: Record<string, any>) => {
        setChatSettingsInputs((previousInputs) =>
          mergeChatSettingsInputs(previousInputs, values)
        );
        setChatSettingsValue((previousValues) => ({
          ...previousValues,
          ...Object.fromEntries(
            Object.entries(values).map(([key, value]) => {
              if (
                value &&
                typeof value === 'object' &&
                Object.prototype.hasOwnProperty.call(value, 'value')
              ) {
                return [key, value.value];
              }
              return [key, value];
            })
          )
        }));
      });

      socket.on('set_commands', (commands: ICommand[]) => {
        setCommands(commands);
      });

      socket.on('set_chat_profile', (profileName: string) => {
        setChatProfile(profileName);
      });

      socket.on('set_sidebar_title', (title: string) => {
        setSideView((prev) => {
          if (prev?.title === title) return prev;
          return { title, elements: prev?.elements || [] };
        });
      });

      socket.on(
        'set_sidebar_elements',
        ({ elements, key }: { elements: IMessageElement[]; key?: string }) => {
          if (!elements.length) {
            setSideView(undefined);
          } else {
            elements.forEach((element) => {
              if (!element.url && element.chainlitKey) {
                element.url = client.getElementUrl(
                  element.chainlitKey,
                  sessionId
                );
              }
            });
            setSideView((prev) => {
              if (prev?.key === key) return prev;
              return { title: prev?.title || '', elements: elements, key };
            });
          }
        }
      );

      socket.on('element', (element: IElement) => {
        if (!element.url && element.chainlitKey) {
          element.url = client.getElementUrl(element.chainlitKey, sessionId);
        }

        if (element.type === 'tasklist') {
          setTasklists((old) => {
            const index = old.findIndex((e) => e.id === element.id);
            if (index === -1) {
              return [...old, element];
            } else {
              return [...old.slice(0, index), element, ...old.slice(index + 1)];
            }
          });
        } else {
          setElements((old) => {
            const index = old.findIndex((e) => e.id === element.id);
            if (index === -1) {
              return [...old, element];
            } else {
              return [...old.slice(0, index), element, ...old.slice(index + 1)];
            }
          });
        }
      });

      socket.on('remove_element', (remove: { id: string }) => {
        setElements((old) => {
          return old.filter((e) => e.id !== remove.id);
        });
        setTasklists((old) => {
          return old.filter((e) => e.id !== remove.id);
        });
      });

      socket.on('action', (action: IAction) => {
        setActions((old) => [...old, action]);
      });

      socket.on('remove_action', (action: IAction) => {
        setActions((old) => {
          const index = old.findIndex((a) => a.id === action.id);
          if (index === -1) return old;
          return [...old.slice(0, index), ...old.slice(index + 1)];
        });
      });

      socket.on('token_usage', (count: number) => {
        setTokenCount((old) => old + count);
      });

      socket.on('window_message', (data: any) => {
        if (window.parent) {
          window.parent.postMessage(data, '*');
        }
      });

      socket.on('toast', (data: { message: string; type: string }) => {
        if (!data.message) {
          console.warn('No message received for toast.');
          return;
        }

        switch (data.type) {
          case 'info':
            toast.info(data.message);
            break;
          case 'error':
            toast.error(data.message);
            break;
          case 'success':
            toast.success(data.message);
            break;
          case 'warning':
            toast.warning(data.message);
            break;
          default:
            toast(data.message);
            break;
        }
      });
    },
    [
      setSession,
      sessionId,
      idToResume,
      chatProfile,
      language,
      enqueueBufferedStreamToken,
      flushBufferedStreamTokens
    ]
  );

  const connect = useCallback(debounce(_connect, 200), [_connect]);

  const disconnect = useCallback(() => {
    cancelScheduledStreamFlush();
    bufferedStreamTokensRef.current.clear();
    if (session?.socket) {
      session.socket.removeAllListeners();
      session.socket.close();
    }
  }, [cancelScheduledStreamFlush, session]);

  return {
    connect,
    disconnect,
    session,
    sessionId,
    chatProfile,
    idToResume,
    setChatProfile
  };
};

export { useChatSession };
