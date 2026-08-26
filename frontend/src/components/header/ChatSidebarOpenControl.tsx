import { useNavigate } from 'react-router-dom';

import { useChatData } from '@chainlit/react-client';

import NewChatButton from '@/components/header/NewChat';
import SidebarTrigger from '@/components/header/SidebarTrigger';
import WorkspaceEditorButton from '@/components/header/WorkspaceEditorButton';
import { useSidebar } from '@/components/ui/sidebar';

/**
 * Floating chat chrome when the main Header is hidden and the threads sidebar
 * is collapsed. Mirrors the reachable actions from the left sidebar header
 * (open history, workspace editor when staged, new thread).
 */
export default function ChatSidebarOpenControl() {
  const navigate = useNavigate();
  const { open, openMobile, isMobile } = useSidebar();
  const { conversationHistoryVisible } = useChatData();
  const sidebarOpen = isMobile ? openMobile : open;

  if (conversationHistoryVisible === false || sidebarOpen) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute left-2 top-2 z-30 flex flex-row items-center gap-0.5 rounded-[4px] border border-border bg-background p-0.5">
      <SidebarTrigger />
      <WorkspaceEditorButton />
      <NewChatButton navigate={navigate} />
    </div>
  );
}
