import React, { useEffect, useMemo } from 'react';
import { DefaultExtensionType, FileIcon, defaultStyles } from 'react-file-icon';

import { useTranslation } from '@/components/i18n/Translator';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

import { resolveFileChipKind, splitFileChipName } from './fileChip';

/** Horizontal file chip: muted fill, hairline stroke, hover lifts the fill. */
const attachmentCardClassName =
  'border-border/50 shadow-none transition-colors duration-150 hover:bg-accent dark:hover:bg-muted';

interface AttachmentProps {
  name: string;
  mime: string;
  children?: React.ReactNode;
  file?: File;
}

const Attachment: React.FC<AttachmentProps> = ({
  name,
  mime,
  children,
  file
}) => {
  const { t } = useTranslation();
  const isImage = useMemo(() => mime.startsWith('image/'), [mime]);
  const imageUrl = useMemo(() => {
    if (isImage && file) {
      return URL.createObjectURL(file);
    }
    return undefined;
  }, [isImage, file]);
  const { title, extension } = useMemo(() => splitFileChipName(name), [name]);
  const kind = useMemo(
    () => resolveFileChipKind(mime, extension),
    [mime, extension]
  );
  const kindLabel = t(`chat.fileChip.kind.${kind}`);
  const meta = extension
    ? t('chat.fileChip.meta', {
        kind: kindLabel,
        extension: extension.toUpperCase()
      })
    : kindLabel;

  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  if (isImage && imageUrl) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative h-[58px] w-[58px]">
              {children}
              <Card
                className={cn(
                  'group h-full p-1 flex items-center justify-center rounded-xl overflow-hidden',
                  attachmentCardClassName
                )}
              >
                <img
                  src={imageUrl}
                  alt={name}
                  className="h-full w-full object-cover transition-[filter] duration-150 group-hover:brightness-95 dark:group-hover:brightness-110"
                />
              </Card>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{name}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative w-full">
            {children}
            <Card
              className={cn(
                'flex w-full flex-row items-center gap-3 rounded-xl px-3 py-2.5',
                attachmentCardClassName
              )}
            >
              <div className="w-10 shrink-0" aria-hidden>
                <FileIcon
                  {...(defaultStyles[extension as DefaultExtensionType] || {})}
                  extension={extension || 'file'}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight text-foreground">
                  {title || name}
                </p>
                {meta ? (
                  <p className="mt-0.5 truncate text-xs leading-tight text-muted-foreground">
                    {meta}
                  </p>
                ) : null}
              </div>
            </Card>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export { Attachment };
