import { isEqual } from 'lodash';
import { AtomEffect, DefaultValue, atom, selector } from 'recoil';
import { Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

import { ICommand } from './types/command';
import { IMode } from './types/mode';

import {
  IAction,
  IAsk,
  IAuthConfig,
  ICallFn,
  IChainlitConfig,
  IMcp,
  ICustomElement,
  IMessageElement,
  IStep,
  ITasklistElement,
  IUser,
  ThreadHistory
} from './types';
import { groupByDate } from './utils/group';
import { WavRecorder, WavStreamPlayer } from './wavtools';

export interface ISession {
  socket: Socket;
  error?: boolean;
}

export type ComposerInputRestrictionMode =
  | 'mix'
  | 'only_modes'
  | 'selection_only';

export interface IComposerInputRestriction {
  mode: ComposerInputRestrictionMode;
  placeholder?: string;
}

export const DEFAULT_COMPOSER_INPUT_RESTRICTION: IComposerInputRestriction = {
  mode: 'mix'
};

export const normalizeComposerInputRestriction = (
  value?: Partial<IComposerInputRestriction> | null
): IComposerInputRestriction => {
  const rawMode = typeof value?.mode === 'string' ? value.mode.trim() : '';
  const mode: ComposerInputRestrictionMode =
    rawMode === 'only_modes' || rawMode === 'selection_only' ? rawMode : 'mix';
  const placeholder =
    typeof value?.placeholder === 'string' && value.placeholder.trim()
      ? value.placeholder.trim()
      : undefined;

  if (mode === 'mix') {
    return DEFAULT_COMPOSER_INPUT_RESTRICTION;
  }

  return {
    mode,
    ...(placeholder ? { placeholder } : {})
  };
};

export const threadIdToResumeState = atom<string | undefined>({
  key: 'ThreadIdToResume',
  default: undefined
});

export const resumeThreadErrorState = atom<string | undefined>({
  key: 'ResumeThreadErrorState',
  default: undefined
});

export const chatProfileState = atom<string | undefined>({
  key: 'ChatProfile',
  default: undefined
});

/**
 * Active conversation project scope for thread history.
 * ``null`` = global bag; a string = that project id/name.
 */
export const projectState = atom<string | null>({
  key: 'ConversationProject',
  default: null
});

const sessionIdAtom = atom<string>({
  key: 'SessionId',
  default: uuidv4()
});

export const sessionIdState = selector({
  key: 'SessionIdSelector',
  get: ({ get }) => get(sessionIdAtom),
  set: ({ set }, newValue) =>
    set(sessionIdAtom, newValue instanceof DefaultValue ? uuidv4() : newValue)
});

export const sessionState = atom<ISession | undefined>({
  key: 'Session',
  dangerouslyAllowMutability: true,
  default: undefined
});

export const actionState = atom<IAction[]>({
  key: 'Actions',
  default: []
});

export const messagesState = atom<IStep[]>({
  key: 'Messages',
  dangerouslyAllowMutability: true,
  default: []
});

export const commandsState = atom<ICommand[]>({
  key: 'Commands',
  default: []
});

export const composerInputRestrictionState = atom<IComposerInputRestriction>({
  key: 'ComposerInputRestriction',
  default: DEFAULT_COMPOSER_INPUT_RESTRICTION
});

export const spontaneousFileUploadEnabledState = atom<boolean | undefined>({
  key: 'SpontaneousFileUploadEnabled',
  default: undefined
});

export const conversationHistoryVisibleState = atom<boolean | undefined>({
  key: 'ConversationHistoryVisible',
  default: undefined
});

export const conversationHistoryShowNewThreadState = atom<boolean | undefined>({
  key: 'ConversationHistoryShowNewThread',
  default: undefined
});

export const conversationHistoryShowDeleteThreadsState = atom<
  boolean | undefined
>({
  key: 'ConversationHistoryShowDeleteThreads',
  default: undefined
});

export const newChatButtonVisibleState = conversationHistoryVisibleState;

export const modesState = atom<IMode[]>({
  key: 'Modes',
  default: []
});

export const tokenCountState = atom<number>({
  key: 'TokenCount',
  default: 0
});

export const loadingState = atom<boolean>({
  key: 'Loading',
  default: false
});

export const askUserState = atom<IAsk | undefined>({
  key: 'AskUser',
  default: undefined
});

export const wavRecorderState = atom({
  key: 'WavRecorder',
  dangerouslyAllowMutability: true,
  default: new WavRecorder()
});

export const wavStreamPlayerState = atom({
  key: 'WavStreamPlayer',
  dangerouslyAllowMutability: true,
  default: new WavStreamPlayer()
});

export const audioConnectionState = atom<'connecting' | 'on' | 'off'>({
  key: 'AudioConnection',
  default: 'off'
});

export const isAiSpeakingState = atom({
  key: 'isAiSpeaking',
  default: false
});

export const callFnState = atom<ICallFn | undefined>({
  key: 'CallFn',
  default: undefined
});

export const chatSettingsInputsState = atom<any>({
  key: 'ChatSettings',
  default: []
});

export const chatSettingsDefaultValueSelector = selector({
  key: 'ChatSettingsValue/Default',
  get: ({ get }) => {
    const chatSettings = get(chatSettingsInputsState);

    const collectInitialValues = (
      inputs: any[],
      acc: Record<string, any>
    ): Record<string, any> => {
      if (!Array.isArray(inputs)) {
        return acc;
      }

      inputs.forEach((input) => {
        if (!input) {
          return;
        }
        if (Array.isArray(input?.inputs) && input.inputs.length > 0) {
          // Handle tabs
          collectInitialValues(input.inputs, acc);
        } else if (input?.id !== undefined) {
          acc[input.id] = input.initial;
        }
      });

      return acc;
    };

    return collectInitialValues(chatSettings, {});
  }
});

export const chatSettingsValueState = atom<Record<string, any>>({
  key: 'ChatSettingsValue',
  default: chatSettingsDefaultValueSelector
});

export const elementState = atom<IMessageElement[]>({
  key: 'DisplayElements',
  default: []
});

export const tasklistState = atom<ITasklistElement[]>({
  key: 'TasklistElements',
  default: []
});

export const firstUserInteraction = atom<string | undefined>({
  key: 'FirstUserInteraction',
  default: undefined
});

export const userState = atom<IUser | undefined | null>({
  key: 'User',
  default: undefined
});

export const configState = atom<IChainlitConfig | undefined>({
  key: 'ChainlitConfig',
  default: undefined
});

export const authState = atom<IAuthConfig | undefined>({
  key: 'AuthConfig',
  default: undefined
});

export const threadHistoryState = atom<ThreadHistory | undefined>({
  key: 'ThreadHistory',
  default: {
    threads: undefined,
    currentThreadId: undefined,
    timeGroupedThreads: undefined,
    pageInfo: undefined
  },
  effects: [
    ({ setSelf, onSet }: { setSelf: any; onSet: any }) => {
      onSet(
        (
          newValue: ThreadHistory | undefined,
          oldValue: ThreadHistory | undefined
        ) => {
          let timeGroupedThreads = newValue?.timeGroupedThreads;
          if (
            newValue?.threads &&
            !isEqual(newValue.threads, oldValue?.timeGroupedThreads)
          ) {
            timeGroupedThreads = groupByDate(newValue.threads);
          }

          setSelf({
            ...newValue,
            timeGroupedThreads
          });
        }
      );
    }
  ]
});

export const sideViewState = atom<
  { title: string; elements: IMessageElement[]; key?: string } | undefined
>({
  key: 'SideView',
  default: undefined
});

export const floatingViewState = atom<
  { title: string; element: ICustomElement } | undefined
>({
  key: 'FloatingView',
  default: undefined
});

export const documentWorkspaceState = atom<
  | {
      hasActiveWorkspace: boolean;
      enabled: boolean;
      workspaceKey?: string;
      workspaceNodeId?: string;
      workspaceNodeName?: string;
      filename?: string;
      documentSource?: string;
    }
  | undefined
>({
  key: 'DocumentWorkspaceState',
  default: undefined
});

export const currentThreadIdState = atom<string | undefined>({
  key: 'CurrentThreadId',
  default: undefined
});

const localStorageEffect =
  <T>(key: string): AtomEffect<T> =>
  ({ setSelf, onSet }) => {
    // When the atom is first initialized, try to get its value from localStorage
    const savedValue = localStorage.getItem(key);
    if (savedValue != null) {
      try {
        setSelf(JSON.parse(savedValue));
      } catch (error) {
        console.error(
          `Error parsing localStorage value for key "${key}":`,
          error
        );
      }
    }

    // Subscribe to state changes and update localStorage
    onSet((newValue, _, isReset) => {
      if (isReset) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(newValue));
      }
    });
  };

export const mcpState = atom<IMcp[]>({
  key: 'Mcp',
  default: [],
  effects: [localStorageEffect<IMcp[]>('mcp_storage_key')]
});

export const favoriteMessagesState = atom<IStep[]>({
  key: 'favoriteMessagesState',
  default: []
});
