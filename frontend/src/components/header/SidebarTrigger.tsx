import { useChatData } from '@chainlit/react-client';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Translator } from 'components/i18n';

import { Sidebar } from '../icons/Sidebar';
import { useSidebar } from '../ui/sidebar';

export default function SidebarTrigger() {
  const { setOpen, open, openMobile, setOpenMobile, isMobile } = useSidebar();
  const { conversationHistoryVisible } = useChatData();

  if (conversationHistoryVisible === false) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            id="sidebar-trigger-button"
            onClick={() =>
              isMobile ? setOpenMobile(!openMobile) : setOpen(!open)
            }
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-muted-foreground"
          >
            <Sidebar className="!size-6" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {open ? (
              <Translator path="threadHistory.sidebar.actions.close" />
            ) : (
              <Translator path="threadHistory.sidebar.actions.open" />
            )}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
