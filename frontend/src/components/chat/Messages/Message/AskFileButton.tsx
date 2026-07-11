import { MessageContext } from 'contexts/MessageContext';
import { X } from 'lucide-react';
import { useContext, useEffect, useRef, useState } from 'react';

import { IAsk, IFileRef } from '@chainlit/react-client';

import { Translator } from '@/components/i18n';
import { useTranslation } from '@/components/i18n/Translator';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import { useUpload } from 'hooks/useUpload';

type StagedUpload = {
  progress: number;
  done: boolean;
  cancel: () => void;
};

type AcceptSpec = string[] | Record<string, string[]> | undefined | null;

/**
 * Normalize AskFile accept values into sorted unique extension chips for the UI.
 */
function formatAcceptExtensions(accept: AcceptSpec): string[] {
  if (accept == null) {
    return [];
  }

  const extensions = new Set<string>();

  const normalizeExt = (value: string): string => {
    const lower = value.toLowerCase();
    return lower.startsWith('.') ? lower : `.${lower}`;
  };

  if (Array.isArray(accept)) {
    for (const entry of accept) {
      if (typeof entry !== 'string' || entry.includes('/')) {
        continue;
      }
      extensions.add(normalizeExt(entry));
    }
  } else if (typeof accept === 'object') {
    for (const exts of Object.values(accept)) {
      if (!Array.isArray(exts) || exts.length === 0) {
        continue;
      }
      for (const ext of exts) {
        if (typeof ext === 'string' && ext.length > 0) {
          extensions.add(normalizeExt(ext));
        }
      }
    }
  }

  return Array.from(extensions).sort((a, b) => a.localeCompare(b));
}

/**
 * Format a byte size for the staging list.
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

interface _AskFileButtonProps {
  askUser: IAsk;
  /** Workflow upload instruction (`AskFileMessage.content` / node `pr_prompt`). */
  instruction?: string;
  uploadFile: (
    file: File,
    onProgress: (progress: number) => void,
    parentId?: string
  ) => {
    xhr: XMLHttpRequest;
    promise: Promise<IFileRef>;
  };
  onError: (error: string) => void;
}

/**
 * AskFile overlay: auto-opens a staging dialog. There is no inline CTA in the
 * message thread. Cancel / dismiss resolves the ask with an empty payload so
 * the backend treats it like a timeout (workflow node gets an error).
 */
const _AskFileButton = ({
  askUser,
  instruction,
  uploadFile,
  onError
}: _AskFileButtonProps) => {
  const { t } = useTranslation();

  const maxFiles = askUser.spec.max_files;
  const maxSizeMb = askUser.spec.max_size_mb;
  const promptText = typeof instruction === 'string' ? instruction.trim() : '';
  const specValid =
    isPositiveFiniteNumber(maxFiles) && isPositiveFiniteNumber(maxSizeMb);

  const [open, setOpen] = useState(true);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [uploads, setUploads] = useState<StagedUpload[] | null>(null);
  const resolvedRef = useRef(false);

  useEffect(() => {
    if (!specValid) {
      onError(t('chat.fileUpload.errors.invalidSpec'));
    }
  }, [specValid, onError, t]);

  const uploading = uploads !== null;
  const remainingSlots = specValid ? maxFiles - stagedFiles.length : 0;
  const canAddFiles = specValid && !uploading && remainingSlots > 0;
  const canSubmit = specValid && !uploading && stagedFiles.length > 0;
  const acceptExtensions = formatAcceptExtensions(askUser.spec.accept);

  const { getRootProps, getInputProps, isDragActive } = useUpload({
    spec: askUser.spec,
    options: {
      disabled: !canAddFiles,
      maxFiles: remainingSlots > 0 ? remainingSlots : 0
    },
    onResolved: (files) => {
      setStagedFiles((prev) => [...prev, ...files]);
    },
    onError: (error: string) => onError(error)
  });

  if (!specValid) {
    return null;
  }

  /**
   * Resolve the ask without files. Chainlit maps an empty/falsy ask reply to
   * ``None``, which ``ui_ask_file`` surfaces as a timeout-style workflow error.
   */
  const cancelAsk = () => {
    if (resolvedRef.current || uploading) {
      return;
    }
    resolvedRef.current = true;
    setOpen(false);
    askUser.callback([]);
  };

  /**
   * Controlled dialog: only dismiss is allowed, and dismiss always cancels the ask.
   * Re-open is intentionally unsupported (no inline CTA).
   */
  const handleOpenChange = (next: boolean) => {
    if (uploading || next) {
      return;
    }
    cancelAsk();
  };

  const removeStagedFile = (index: number) => {
    if (uploading) {
      return;
    }
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startUpload = () => {
    if (!canSubmit || resolvedRef.current) {
      return;
    }

    const files = stagedFiles;
    const promises: Promise<IFileRef>[] = [];
    const nextUploads: StagedUpload[] = files.map((file, index) => {
      const { xhr, promise } = uploadFile(
        file,
        (progress) => {
          setUploads((prev) => {
            if (!prev) {
              return prev;
            }
            return prev.map((upload, i) =>
              i === index ? { ...upload, progress } : upload
            );
          });
        },
        askUser.parentId
      );
      promises.push(
        promise.then((fileRef) => {
          setUploads((prev) => {
            if (!prev) {
              return prev;
            }
            return prev.map((upload, i) =>
              i === index ? { ...upload, done: true, progress: 100 } : upload
            );
          });
          return fileRef;
        })
      );
      return {
        progress: 0,
        done: false,
        cancel: () => xhr.abort()
      };
    });

    setUploads(nextUploads);

    Promise.all(promises)
      .then((fileRefs) => {
        resolvedRef.current = true;
        askUser.callback(fileRefs);
      })
      .catch((error: unknown) => {
        nextUploads.forEach((upload) => upload.cancel());
        setUploads(null);
        const detail = error instanceof Error ? error.message : String(error);
        onError(`${t('chat.fileUpload.errors.failed')}: ${detail}`);
      });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        id="ask-upload-dialog"
        data-testid="ask-upload-dialog"
        className="max-w-lg gap-4"
      >
        <DialogHeader className="space-y-3">
          <DialogTitle>
            <Translator path="chat.fileUpload.title" />
          </DialogTitle>
          {promptText ? (
            <div
              data-testid="ask-upload-instruction"
              className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-left"
            >
              <p className="text-base font-semibold leading-snug text-foreground whitespace-pre-wrap sm:text-lg">
                {promptText}
              </p>
            </div>
          ) : null}
          <DialogDescription>
            {t('chat.fileUpload.maxFiles', { count: maxFiles })}
            {' · '}
            {t('chat.fileUpload.maxSize', { size: maxSizeMb })}
          </DialogDescription>
          {acceptExtensions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {acceptExtensions.map((ext) => (
                <span
                  key={ext}
                  className="inline-flex rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
                >
                  {ext}
                </span>
              ))}
            </div>
          ) : null}
        </DialogHeader>

        <div
          {...getRootProps()}
          className={cn(
            'flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-8 text-center',
            isDragActive && canAddFiles && 'border-primary bg-primary/5',
            !canAddFiles && 'pointer-events-none opacity-50'
          )}
        >
          <input id="ask-button-input" {...getInputProps()} />
          <p className="text-sm font-medium text-foreground">
            <Translator path="chat.fileUpload.dropHint" />
          </p>
          <Button type="button" variant="secondary" size="sm" tabIndex={-1}>
            <Translator path="chat.fileUpload.browse" />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          <Translator
            path="chat.fileUpload.selectedCount"
            options={{ count: stagedFiles.length, max: maxFiles }}
          />
        </p>

        {stagedFiles.length > 0 ? (
          <ul className="max-h-48 overflow-y-auto rounded-md border border-border">
            {stagedFiles.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                  {uploads ? (
                    <Progress
                      className="mt-1 h-1"
                      value={uploads[index].progress}
                    />
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={uploading}
                  title={t('chat.fileUpload.removeFile')}
                  aria-label={t('chat.fileUpload.removeFile')}
                  onClick={() => removeStagedFile(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <DialogFooter>
          <Button
            id="ask-upload-cancel"
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={cancelAsk}
          >
            <Translator path="common.actions.cancel" />
          </Button>
          <Button
            id="ask-upload-submit"
            type="button"
            disabled={!canSubmit}
            onClick={startUpload}
          >
            {uploading ? (
              <Translator path="chat.fileUpload.uploading" />
            ) : (
              <Translator path="chat.fileUpload.upload" />
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface AskFileButtonProps {
  messageId: string;
  /** Upload instruction from the AskFile message output / workflow prompt. */
  instruction?: string;
  onError: (error: string) => void;
}

const AskFileButton = ({ messageId, instruction, onError }: AskFileButtonProps) => {
  const messageContext = useContext(MessageContext);
  const belongsToMessage = messageContext.askUser?.spec.step_id === messageId;
  const isAskFile = messageContext.askUser?.spec.type === 'file';

  if (!belongsToMessage || !isAskFile || !messageContext?.uploadFile)
    return null;

  return (
    <_AskFileButton
      onError={onError}
      instruction={instruction}
      uploadFile={messageContext.uploadFile}
      askUser={messageContext.askUser!}
    />
  );
};

export { AskFileButton };
