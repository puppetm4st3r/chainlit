import { useNavigate } from 'react-router-dom';

import { useChatData } from '@chainlit/react-client';

import SidebarTrigger from '@/components/header/SidebarTrigger';
import { Sidebar, SidebarHeader, SidebarRail } from '@/components/ui/sidebar';

import NewChatButton from '../header/NewChat';
import WorkspaceEditorButton from '../header/WorkspaceEditorButton';
import DeleteThreadsButton from './DeleteThreads';
import SearchChats from './Search';
import { ThreadHistory } from './ThreadHistory';

export default function LeftSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate();
  const { conversationHistoryVisible, projectId } = useChatData();

  if (conversationHistoryVisible === false) {
    return null;
  }

  return (
    <Sidebar {...props} className="border-none">
      <SidebarHeader className="flex flex-col gap-2 py-3">
        <div className="flex items-center justify-between">
          <SidebarTrigger />
          <div className="flex items-center">
            <DeleteThreadsButton />
            <SearchChats />
            <WorkspaceEditorButton />
            <NewChatButton navigate={navigate} />
          </div>
        </div>
        {projectId ? (
          <div
            className="w-full truncate rounded-md border border-sidebar-border/60 px-2 py-1.5 text-center text-sm font-medium text-sidebar-foreground"
            title={projectId}
          >
            {projectId}
          </div>
        ) : null}
      </SidebarHeader>
      <ThreadHistory />
      <SidebarRail />
    </Sidebar>
  );
}
