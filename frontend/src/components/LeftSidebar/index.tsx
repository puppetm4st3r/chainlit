import { useNavigate } from 'react-router-dom';

import { useChatData } from '@chainlit/react-client';

import SidebarTrigger from '@/components/header/SidebarTrigger';
import { Sidebar, SidebarHeader, SidebarRail } from '@/components/ui/sidebar';

import NewChatButton from '../header/NewChat';
import DeleteThreadsButton from './DeleteThreads';
import SearchChats from './Search';
import { ThreadHistory } from './ThreadHistory';

export default function LeftSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate();
  const { conversationHistoryVisible } = useChatData();

  if (conversationHistoryVisible === false) {
    return null;
  }

  return (
    <Sidebar {...props} className="border-none">
      <SidebarHeader className="py-3">
        <div className="flex items-center justify-between">
          <SidebarTrigger />
          <div className="flex items-center">
            <DeleteThreadsButton />
            <SearchChats />
            <NewChatButton navigate={navigate} />
          </div>
        </div>
      </SidebarHeader>
      <ThreadHistory />
      <SidebarRail />
    </Sidebar>
  );
}
