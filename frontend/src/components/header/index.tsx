import {
  sideViewState,
  useAudio,
  useAuth,
  useChatData,
  useConfig
} from '@chainlit/react-client';
import { ArrowLeft } from 'lucide-react';
import { memo } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';

import AudioPresence from '@/components/AudioPresence';
import ButtonLink from '@/components/ButtonLink';
import { Settings } from '@/components/icons/Settings';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Translator } from 'components/i18n';

import {
  dispatchCanvasShellCloseRequest,
  isCanvasShellElement
} from '@/lib/canvas';
import {
  chatSettingsSidebarOpenState
} from '@/state/project';
import { useDismissSideView } from '@/hooks/useDismissSideView';

import ApiKeys from './ApiKeys';
import ChatProfiles from './ChatProfiles';
import NewChatButton from './NewChat';
import ReadmeButton from './Readme';
import ShareButton from './Share';
import SidebarTrigger from './SidebarTrigger';
import { ThemeToggle } from './ThemeToggle';
import UserNav from './UserNav';
import WorkspaceEditorButton from './WorkspaceEditorButton';

type HeaderProps = {
  sidePanelSize?: number;
};

const Header = memo(({ sidePanelSize = 30 }: HeaderProps) => {
  const { audioConnection } = useAudio();
  const navigate = useNavigate();
  const { data } = useAuth();
  const { config } = useConfig();
  const { chatSettingsInputs, conversationHistoryVisible } = useChatData();
  const { open, openMobile, isMobile } = useSidebar();
  const setChatSettingsSidebarOpen = useSetRecoilState(
    chatSettingsSidebarOpenState
  );
  const dismissSideView = useDismissSideView();
  const sideView = useRecoilValue(sideViewState);

  const sidebarOpen = isMobile ? openMobile : open;
  const mainPanelSize = Math.max(0, 100 - sidePanelSize);
  const desktopSideView = !isMobile ? sideView : undefined;
  // Canvas owns its document title inside CanvasDocumentHeader; the chrome label
  // next to the close control is redundant and stays out of sync with renames.
  const desktopSideViewIsCanvas = Boolean(
    desktopSideView?.elements?.some((element) => isCanvasShellElement(element))
  );

  const historyEnabled = data?.requireLogin && config?.dataPersistence;
  const sidebarHidden = config?.ui?.default_sidebar_state === 'hidden';

  const links = config?.ui?.header_links || [];
  const hideTopRightBar = config?.ui?.hide_topright_bar === true;
  const showSettingsInHeader =
    config?.ui?.chat_settings_location === 'sidebar' &&
    chatSettingsInputs.length > 0;
  const canUseSidebar =
    historyEnabled && !sidebarHidden && conversationHistoryVisible !== false;
  // Workspace control sits immediately left of new-thread when that cluster is in the header.
  const showHeaderThreadActions = !canUseSidebar || !sidebarOpen;

  const handleCloseSideView = () => {
    dismissSideView(desktopSideView?.elements);
    dispatchCanvasShellCloseRequest(desktopSideView?.elements);
  };

  const threadActions = showHeaderThreadActions ? (
    <>
      <WorkspaceEditorButton />
      <NewChatButton navigate={navigate} />
    </>
  ) : null;

  const actions = (
    <div className="flex items-center gap-1 shrink-0">
      <ShareButton />
      {!hideTopRightBar ? <ReadmeButton /> : null}
      <ApiKeys />
      {links &&
        links.map((link, index) => (
          <ButtonLink
            key={`${link.name}-${link.url}-${index}`}
            name={link.name}
            displayName={link.display_name}
            iconUrl={link.icon_url}
            url={link.url}
            target={link.target}
          />
        ))}
      {showSettingsInHeader && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              id="chat-settings-header-button"
              onClick={() => setChatSettingsSidebarOpen(true)}
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-muted-foreground"
            >
              <Settings className="!size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <Translator path="chat.settings.title" />
          </TooltipContent>
        </Tooltip>
      )}
      {!hideTopRightBar ? <ThemeToggle /> : null}
      {!hideTopRightBar ? <UserNav /> : null}
    </div>
  );

  if (desktopSideView) {
    return (
      <div
        className="p-3 grid h-[60px] items-center gap-2 relative"
        id="header"
        style={{
          gridTemplateColumns: `minmax(0, ${mainPanelSize}%) minmax(0, ${sidePanelSize}%)`
        }}
      >
        <div className="flex min-w-0 items-center">
          {canUseSidebar ? !sidebarOpen ? <SidebarTrigger /> : null : null}
          {threadActions}

          {!hideTopRightBar ? <ChatProfiles navigate={navigate} /> : null}
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 pr-4">
          <div
            id="side-view-title"
            className="flex min-w-0 items-center pl-6 text-lg font-semibold text-foreground"
          >
            <Button
              className="-ml-2 shrink-0"
              onClick={handleCloseSideView}
              size="icon"
              variant="ghost"
            >
              <ArrowLeft />
            </Button>
            {desktopSideViewIsCanvas ? null : (
              <span className="truncate">{desktopSideView.title}</span>
            )}
          </div>
          {actions}
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          {audioConnection === 'on' ? (
            <AudioPresence
              type="server"
              height={35}
              width={70}
              barCount={4}
              barSpacing={2}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="p-3 flex h-[60px] items-center justify-between gap-2 relative"
      id="header"
    >
      <div className="flex items-center">
        {canUseSidebar ? !sidebarOpen ? <SidebarTrigger /> : null : null}
        {threadActions}

        {!hideTopRightBar ? <ChatProfiles navigate={navigate} /> : null}
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        {audioConnection === 'on' ? (
          <AudioPresence
            type="server"
            height={35}
            width={70}
            barCount={4}
            barSpacing={2}
          />
        ) : null}
      </div>

      <div />
      {actions}
    </div>
  );
});

export { Header };
