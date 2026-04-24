import {
  documentWorkspaceState,
  sideViewState,
  useAudio,
  useAuth,
  useChatData,
  useChatInteract,
  useConfig
} from '@chainlit/react-client';
import { ArrowLeft, SquarePen } from 'lucide-react';
import { memo } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';

import AudioPresence from '@/components/AudioPresence';
import ButtonLink from '@/components/ButtonLink';
import { Settings } from '@/components/icons/Settings';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger
} from '@/components/ui/hover-card';
import { useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Translator } from 'components/i18n';

import { dispatchCanvasShellCloseRequest } from '@/lib/canvas';
import { chatSettingsSidebarOpenState } from '@/state/project';

import ApiKeys from './ApiKeys';
import ChatProfiles from './ChatProfiles';
import NewChatButton from './NewChat';
import ReadmeButton from './Readme';
import ShareButton from './Share';
import SidebarTrigger from './SidebarTrigger';
import { ThemeToggle } from './ThemeToggle';
import UserNav from './UserNav';

type HeaderProps = {
  sidePanelSize?: number;
};

const Header = memo(({ sidePanelSize = 30 }: HeaderProps) => {
  const { audioConnection } = useAudio();
  const navigate = useNavigate();
  const { data } = useAuth();
  const { config } = useConfig();
  const { windowMessage } = useChatInteract();
  const { chatSettingsInputs } = useChatData();
  const { open, openMobile, isMobile } = useSidebar();
  const setChatSettingsSidebarOpen = useSetRecoilState(
    chatSettingsSidebarOpenState
  );
  const sideView = useRecoilValue(sideViewState);
  const documentWorkspace = useRecoilValue(documentWorkspaceState);
  const setSideView = useSetRecoilState(sideViewState);

  const sidebarOpen = isMobile ? openMobile : open;
  const mainPanelSize = Math.max(0, 100 - sidePanelSize);
  const desktopSideView = !isMobile ? sideView : undefined;

  const historyEnabled = data?.requireLogin && config?.dataPersistence;
  const sidebarHidden = config?.ui?.default_sidebar_state === 'hidden';

  const links = config?.ui?.header_links || [];
  const hideTopRightBar = config?.ui?.hide_topright_bar === true;
  const showSettingsInHeader =
    config?.ui?.chat_settings_location === 'sidebar' &&
    chatSettingsInputs.length > 0;
  const canUseSidebar = historyEnabled && !sidebarHidden;

  const workspaceBadge = documentWorkspace?.hasActiveWorkspace ? (
    <Button
      id="document-workspace-header-button"
      type="button"
      variant="ghost"
      size="sm"
      className={[
        'h-auto min-h-9 rounded-[4px] border border-border/60 bg-background/60 px-3 py-1.5',
        'text-muted-foreground shadow-sm',
        'flex items-center gap-2',
        documentWorkspace.enabled
          ? 'cursor-default hover:bg-background/60 hover:text-muted-foreground'
          : 'hover:bg-accent/50 hover:text-foreground'
      ].join(' ')}
    >
      <SquarePen className="!size-4" />
      <span className="flex flex-col items-start text-left leading-[1.05]">
        <span className="text-[12px] font-medium">
          <Translator path="chat.workspace.activePrimary" />
        </span>
        <span className="text-[11px] font-medium opacity-85">
          <Translator path="chat.workspace.activeSecondary" />
        </span>
      </span>
    </Button>
  ) : null;

  const handleOpenWorkspaceEditor = () => {
    windowMessage({ type: 'canvas:open_active_workspace' });
  };

  const handleCloseSideView = () => {
    dispatchCanvasShellCloseRequest(desktopSideView?.elements);
    setSideView(undefined);
  };

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
      {documentWorkspace?.hasActiveWorkspace ? (
        documentWorkspace.enabled ? (
          workspaceBadge
        ) : (
          <HoverCard openDelay={120} closeDelay={120}>
            <HoverCardTrigger asChild>{workspaceBadge}</HoverCardTrigger>
            <HoverCardContent
              align="end"
              sideOffset={8}
              className="w-auto rounded-md border border-border/70 bg-popover px-2 py-2 shadow-md"
            >
              <Button
                id="document-workspace-open-editor-button"
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenWorkspaceEditor}
              >
                <Translator path="chat.workspace.openEditorWord" />
              </Button>
            </HoverCardContent>
          </HoverCard>
        )
      ) : null}
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
          {canUseSidebar ? (
            !sidebarOpen ? (
              <NewChatButton navigate={navigate} />
            ) : null
          ) : (
            <NewChatButton navigate={navigate} />
          )}

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
            <span className="truncate">{desktopSideView.title}</span>
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
        {canUseSidebar ? (
          !sidebarOpen ? (
            <NewChatButton navigate={navigate} />
          ) : null
        ) : (
          <NewChatButton navigate={navigate} />
        )}

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
