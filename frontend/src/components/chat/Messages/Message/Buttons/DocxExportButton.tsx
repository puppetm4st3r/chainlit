import { Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { useTranslation } from '@/components/i18n/Translator';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  buildAssistantMessageDocxBlob,
  triggerDocxDownload
} from '@/lib/docxExport';

interface Props {
  contentRef?: React.RefObject<HTMLDivElement>;
}

/**
 * Native message-action control that exports the assistant bubble (and any
 * consecutive prior assistant bubbles) as a DOCX download.
 */
const DocxExportButton = ({ contentRef }: Props) => {
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();

  const exportDocx = async () => {
    const contentElement = contentRef?.current;
    if (!contentElement || busy) {
      return;
    }

    setBusy(true);
    try {
      const stepElement = contentElement.closest('.step');
      const blob = await buildAssistantMessageDocxBlob(
        stepElement,
        contentElement
      );
      triggerDocxDownload(blob);
    } catch {
      toast.error(t('chat.messages.actions.docx.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={exportDocx}
            variant="ghost"
            size="icon"
            disabled={busy}
            className="text-muted-foreground"
            aria-label={t('chat.messages.actions.docx.button')}
          >
            <Download className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('chat.messages.actions.docx.button')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default DocxExportButton;
