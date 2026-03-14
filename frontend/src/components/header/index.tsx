import { sideViewState, useAudio, useAuth, useConfig } from '@chainlit/react-client';
import { ArrowLeft } from 'lucide-react';
import { memo } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';

import AudioPresence from '@/components/AudioPresence';
import ButtonLink from '@/components/ButtonLink';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';

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
  const { open, openMobile, isMobile } = useSidebar();
  const sideView = useRecoilValue(sideViewState);
  const setSideView = useSetRecoilState(sideViewState);

  const sidebarOpen = isMobile ? openMobile : open;
  const mainPanelSize = Math.max(0, 100 - sidePanelSize);
  const desktopSideView = !isMobile ? sideView : undefined;

  const historyEnabled = data?.requireLogin && config?.dataPersistence;
  const links = config?.ui?.header_links || [];
  const actions = (
    <div className="flex items-center gap-1 shrink-0">
      <ShareButton />
      <ReadmeButton />
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
      <ThemeToggle />
      <UserNav />
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
          {historyEnabled ? !sidebarOpen ? <SidebarTrigger /> : null : null}
          {historyEnabled ? (
            !sidebarOpen ? (
              <NewChatButton navigate={navigate} />
            ) : null
          ) : (
            <NewChatButton navigate={navigate} />
          )}

          <ChatProfiles navigate={navigate} />
        </div>

        <div className="flex min-w-0 items-center justify-between gap-2 pr-4">
          <div
            id="side-view-title"
            className="flex min-w-0 items-center pl-6 text-lg font-semibold text-foreground"
          >
            <Button
              className="-ml-2 shrink-0"
              onClick={() => setSideView(undefined)}
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
        {historyEnabled ? !sidebarOpen ? <SidebarTrigger /> : null : null}
        {historyEnabled ? (
          !sidebarOpen ? (
            <NewChatButton navigate={navigate} />
          ) : null
        ) : (
          <NewChatButton navigate={navigate} />
        )}

        <ChatProfiles navigate={navigate} />
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
