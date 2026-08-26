import {
  documentWorkspaceState,
  sideViewState,
  useChatInteract
} from '@chainlit/react-client';
import { FilePenLine } from 'lucide-react';
import { useRecoilValue } from 'recoil';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Translator } from '@/components/i18n';
import { useDismissSideView } from '@/hooks/useDismissSideView';
import { dispatchCanvasShellCloseRequest } from '@/lib/canvas';

/**
 * Icon-only toggle for the active document workspace editor.
 * Placed to the left of the new-thread action; uses a file icon to stay
 * distinct from the MessageSquarePlus new-chat glyph.
 * Open path posts `canvas:open_active_workspace`; close reuses the side-view
 * X path (dismiss + shell close request) so the widget can flush content.
 */
export default function WorkspaceEditorButton() {
  const { windowMessage } = useChatInteract();
  const documentWorkspace = useRecoilValue(documentWorkspaceState);
  const sideView = useRecoilValue(sideViewState);
  const dismissSideView = useDismissSideView();

  if (!documentWorkspace?.hasActiveWorkspace) {
    return null;
  }

  const isEditorOpen = documentWorkspace.enabled === true;

  const handleToggleWorkspaceEditor = () => {
    if (isEditorOpen) {
      const elements = sideView?.elements;
      dismissSideView(elements);
      dispatchCanvasShellCloseRequest(elements);
      return;
    }
    windowMessage({ type: 'canvas:open_active_workspace' });
  };

  const button = (
    <Button
      id="document-workspace-header-button"
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={isEditorOpen}
      onClick={handleToggleWorkspaceEditor}
      className={
        isEditorOpen
          ? 'text-foreground hover:text-foreground'
          : 'text-muted-foreground hover:text-muted-foreground'
      }
    >
      <FilePenLine className="!size-6" />
    </Button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <Translator
            path={
              isEditorOpen
                ? 'chat.workspace.closeEditorWord'
                : 'chat.workspace.openEditorWord'
            }
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
