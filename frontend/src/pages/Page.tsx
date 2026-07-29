import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useRecoilValue } from 'recoil';

import { sideViewState, useAuth, useChatData, useConfig } from '@chainlit/react-client';

import ChatSettingsSidebar from '@/components/ChatSettings/ChatSettingsSidebar';
import ElementFloatingView from '@/components/ElementFloatingView';
import ElementSideView from '@/components/ElementSideView';
import LeftSidebar from '@/components/LeftSidebar';
import { TaskList } from '@/components/Tasklist';
import { Header } from '@/components/header';
import ChatSidebarOpenControl from '@/components/header/ChatSidebarOpenControl';
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import { userEnvState } from 'state/user';

type Props = {
  children: JSX.Element;
};

const DEFAULT_TASKLIST_PANEL_SIZE = 30;
const DEFAULT_SIDE_VIEW_PANEL_SIZE = 70;

/**
 * Temporary: keep the chat Header mounted but hidden so the chat column
 * (and full-height side panels) reclaim its vertical space. Flip to true to
 * restore the top bar without putting the component back by hand.
 */
const CHAT_HEADER_VISIBLE = false;

const Page = ({ children }: Props) => {
  const { config } = useConfig();
  const { data } = useAuth();
  const { conversationHistoryVisible } = useChatData();
  const userEnv = useRecoilValue(userEnvState);
  const sideView = useRecoilValue(sideViewState);
  const defaultSidePanelSize = sideView
    ? DEFAULT_SIDE_VIEW_PANEL_SIZE
    : DEFAULT_TASKLIST_PANEL_SIZE;
  const [desktopPanelSizes, setDesktopPanelSizes] = useState<number[]>([
    100 - defaultSidePanelSize,
    defaultSidePanelSize
  ]);

  useEffect(() => {
    setDesktopPanelSizes([100 - defaultSidePanelSize, defaultSidePanelSize]);
  }, [defaultSidePanelSize]);

  if (config?.userEnv) {
    for (const key of config.userEnv || []) {
      if (!userEnv[key]) return <Navigate to="/env" />;
    }
  }

  const showSettingsSidebar = config?.ui?.chat_settings_location === 'sidebar';
  const sidePanelSize = desktopPanelSizes[1] ?? defaultSidePanelSize;
  const historyEnabled = config?.dataPersistence && data?.requireLogin;
  const sidebarHidden = config?.ui?.default_sidebar_state === 'hidden';
  const showConversationHistory =
    historyEnabled && !sidebarHidden && conversationHistoryVisible !== false;

  // Side view keeps a full-width header grid (title/actions over the right pane).
  // TaskList docks like the threads sidebar: full viewport height and pushes the
  // chat header so icons are not drawn above the task panel.
  const header = (
    <div
      className={CHAT_HEADER_VISIBLE ? undefined : 'hidden'}
      aria-hidden={CHAT_HEADER_VISIBLE ? undefined : true}
    >
      <Header sidePanelSize={sideView ? sidePanelSize : 0} />
    </div>
  );

  const chatColumn = (
    <div className="relative flex min-h-0 flex-grow flex-col">
      {!CHAT_HEADER_VISIBLE && showConversationHistory ? (
        <ChatSidebarOpenControl />
      ) : null}
      <div className="flex min-h-0 flex-grow flex-row overflow-auto">
        {children}
      </div>
    </div>
  );

  const mainContent = (
    <div className="flex h-full w-full flex-col">
      {sideView ? (
        <>
          {header}
          <ResizablePanelGroup
            key="side-view-layout"
            direction="horizontal"
            className="flex min-h-0 flex-grow flex-row"
            onLayout={setDesktopPanelSizes}
          >
            <ResizablePanel
              className="flex h-full w-full flex-col"
              minSize={20}
              defaultSize={100 - defaultSidePanelSize}
            >
              {chatColumn}
            </ResizablePanel>
            <ElementSideView />
            {showSettingsSidebar && <ChatSettingsSidebar />}
          </ResizablePanelGroup>
        </>
      ) : (
        <ResizablePanelGroup
          key="tasklist-layout"
          direction="horizontal"
          className="flex h-full min-h-0 flex-grow flex-row"
          onLayout={setDesktopPanelSizes}
        >
          <ResizablePanel
            className="flex h-full min-h-0 w-full flex-col"
            minSize={20}
            defaultSize={100 - defaultSidePanelSize}
          >
            <div className="flex h-full min-h-0 flex-col">
              {header}
              {chatColumn}
            </div>
          </ResizablePanel>
          <TaskList isMobile={false} />
          {showSettingsSidebar && <ChatSettingsSidebar />}
        </ResizablePanelGroup>
      )}
      <ElementFloatingView />
    </div>
  );

  return (
    <SidebarProvider
      defaultOpen={config?.ui.default_sidebar_state !== 'closed'}
    >
      {showConversationHistory ? (
        <>
          <LeftSidebar />
          <SidebarInset className="max-h-svh min-w-0">
            {mainContent}
          </SidebarInset>
        </>
      ) : (
        <div className="h-screen w-screen flex">{mainContent}</div>
      )}
    </SidebarProvider>
  );
};

export default Page;
