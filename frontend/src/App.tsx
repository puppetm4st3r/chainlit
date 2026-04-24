import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';
import { RouterProvider } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { router } from 'router';

import { useAuth, useChatSession, useConfig } from '@chainlit/react-client';

import ChatSettingsModal from './components/ChatSettings';
import { ThemeProvider } from './components/ThemeProvider';
import { Loader } from '@/components/Loader';
import { Toaster } from '@/components/ui/sonner';
import { useHumanInteractionNotification } from '@/hooks/useHumanInteractionNotification';

import { userEnvState } from 'state/user';

declare global {
  interface Window {
    cl_shadowRootElement?: HTMLDivElement;
    transports?: string[];
    theme?: {
      light: Record<string, string>;
      dark: Record<string, string>;
    };
  }
}

const logRootFlowDiag = (event: string, details?: Record<string, unknown>) => {
  console.warn(`[ChainlitRootFlowDiag] ${event}`, details || {});
};

const buildConnectInvocationKey = (
  sessionId: string,
  chatProfile: string | undefined,
  userEnv: Record<string, string>
): string => {
  const normalizedUserEnv = Object.keys(userEnv)
    .sort()
    .reduce<Record<string, string>>((accumulator, key) => {
      accumulator[key] = userEnv[key];
      return accumulator;
    }, {});

  return JSON.stringify({
    sessionId,
    chatProfile: chatProfile || '',
    userEnv: normalizedUserEnv
  });
};

function App() {
  const { config } = useConfig();

  const { isAuthenticated, data, isReady } = useAuth();
  const userEnv = useRecoilValue(userEnvState);
  const { connect, chatProfile, setChatProfile, sessionId } = useChatSession();
  useHumanInteractionNotification();
  const connectRef = useRef(connect);
  const lastConnectInvocationKeyRef = useRef<string>();

  const configLoaded = !!config;

  const chatProfileOk = configLoaded
    ? config.chatProfiles.length
      ? !!chatProfile
      : true
    : false;

  useEffect(() => {
    connectRef.current = connect;
    logRootFlowDiag('app:connect_ref_updated', {
      sessionId,
      pathname:
        typeof window !== 'undefined' ? window.location.pathname : undefined
    });
  }, [connect]);

  useEffect(() => {
    logRootFlowDiag('app:connect_effect', {
      isAuthenticated,
      isReady,
      chatProfileOk,
      sessionId,
      pathname:
        typeof window !== 'undefined' ? window.location.pathname : undefined
    });
    if (!isAuthenticated || !isReady || !chatProfileOk) {
      logRootFlowDiag('app:connect_skipped', {
        isAuthenticated,
        isReady,
        chatProfileOk,
        sessionId
      });
      return;
    }

    logRootFlowDiag('app:connect_attempt', {
      sessionId,
      pathname:
        typeof window !== 'undefined' ? window.location.pathname : undefined
    });
    const connectInvocationKey = buildConnectInvocationKey(
      sessionId,
      chatProfile,
      userEnv
    );
    if (lastConnectInvocationKeyRef.current === connectInvocationKey) {
      logRootFlowDiag('app:connect_duplicate_skipped', {
        sessionId,
        pathname:
          typeof window !== 'undefined' ? window.location.pathname : undefined
      });
      return;
    }
    lastConnectInvocationKeyRef.current = connectInvocationKey;
    logRootFlowDiag('app:connect_invoked', {
      sessionId,
      pathname:
        typeof window !== 'undefined' ? window.location.pathname : undefined
    });
    connectRef.current({
      transports: window.transports,
      userEnv
    });
  }, [userEnv, isAuthenticated, isReady, chatProfileOk, sessionId]);

  useEffect(() => {
    if (
      !configLoaded ||
      !config ||
      !config.chatProfiles?.length ||
      chatProfile
    ) {
      return;
    }

    const defaultChatProfile = config.chatProfiles.find(
      (profile) => profile.default
    );

    if (defaultChatProfile) {
      setChatProfile(defaultChatProfile.name);
    } else {
      setChatProfile(config.chatProfiles[0].name);
    }
  }, [configLoaded, config, chatProfile, setChatProfile]);

  if (!configLoaded && isAuthenticated) return null;

  return (
    <ThemeProvider
      storageKey="vite-ui-theme"
      defaultTheme={data?.default_theme}
    >
      <Toaster richColors className="toast" position="top-right" />

      <ChatSettingsModal />
      <RouterProvider router={router} />

      <div
        className={cn(
          'bg-[hsl(var(--background))] flex items-center justify-center fixed size-full p-2 top-0',
          isReady && 'hidden'
        )}
      >
        <Loader className="!size-6" />
      </div>
    </ThemeProvider>
  );
}

export default App;
