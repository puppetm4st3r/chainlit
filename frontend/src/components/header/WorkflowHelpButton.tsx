import { BookOpenText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { useTranslation } from 'components/i18n/Translator';

import { useWorkflowHelpController } from '@/hooks/useWorkflowHelpController';

export default function WorkflowHelpButton() {
  const { activeHelp, openManual } = useWorkflowHelpController();
  const { t } = useTranslation();

  if (!activeHelp) {
    return null;
  }

  const buttonLabel = activeHelp.buttonLabel || t('workflowHelp.button');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            id="workflow-help-button"
            onClick={openManual}
            size="sm"
            variant="ghost"
          >
            <BookOpenText className="!size-4" />
            <span>{buttonLabel}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{buttonLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
