import {
  documentWorkspaceState,
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

/**
 * Icon-only control that opens the active document workspace editor.
 * Placed to the left of the new-thread action; uses a file icon to stay
 * distinct from the MessageSquarePlus new-chat glyph.
 */
export default function WorkspaceEditorButton() {
  const { windowMessage } = useChatInteract();
  const documentWorkspace = useRecoilValue(documentWorkspaceState);

  if (!documentWorkspace?.hasActiveWorkspace) {
    return null;
  }

  const canOpenWorkspaceEditor = documentWorkspace.enabled !== true;

  const handleOpenWorkspaceEditor = () => {
    windowMessage({ type: 'canvas:open_active_workspace' });
  };

  const button = (
    <Button
      id="document-workspace-header-button"
      type="button"
      variant="ghost"
      size="icon"
      onClick={canOpenWorkspaceEditor ? handleOpenWorkspaceEditor : undefined}
      className={[
        'text-muted-foreground hover:text-muted-foreground',
        canOpenWorkspaceEditor ? '' : 'cursor-default'
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <FilePenLine className="!size-6" />
    </Button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          {canOpenWorkspaceEditor ? (
            <Translator path="chat.workspace.openEditorWord" />
          ) : (
            <>
              <Translator path="chat.workspace.activePrimary" />
              {' — '}
              <Translator path="chat.workspace.activeSecondary" />
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
