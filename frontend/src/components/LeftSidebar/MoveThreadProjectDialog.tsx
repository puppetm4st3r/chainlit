import _ from 'lodash';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ChainlitContext } from '@chainlit/react-client';

import { Loader } from '@/components/Loader';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { DialogTitle } from '@/components/ui/dialog';
import { Translator } from 'components/i18n';

type ProjectOption = {
  id: string;
  name: string;
};

type MoveThreadProjectDialogProps = {
  open: boolean;
  threadId?: string;
  currentProjectId?: string | null;
  onOpenChange: (open: boolean) => void;
  onMoved: (threadId: string, projectId: string) => void;
};

/**
 * Destination project picker for moving a thread out of the current history scope.
 */
export default function MoveThreadProjectDialog({
  open,
  threadId,
  currentProjectId,
  onOpenChange,
  onMoved
}: MoveThreadProjectDialogProps) {
  const { t } = useTranslation();
  const apiClient = useContext(ChainlitContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [moving, setMoving] = useState(false);

  const debouncedSearch = useMemo(
    () =>
      _.debounce(async (query: string, excludeProjectId?: string | null) => {
        setLoading(true);
        try {
          const { data } = await apiClient.searchProjects({
            search: query || undefined,
            first: 20,
            excludeProjectId: excludeProjectId || undefined
          });
          setProjects(
            (data || []).map((project) => ({
              id: project.id,
              name: project.name
            }))
          );
        } catch (_error) {
          toast.error(t('common.status.error.default'));
          setProjects([]);
        } finally {
          setLoading(false);
        }
      }, 300),
    [apiClient, t]
  );

  useEffect(() => {
    if (!open) {
      debouncedSearch.cancel();
      setSearchQuery('');
      setProjects([]);
      setMoving(false);
      return;
    }
    debouncedSearch(searchQuery, currentProjectId);
    return () => {
      debouncedSearch.cancel();
    };
  }, [open, searchQuery, currentProjectId, debouncedSearch]);

  const handleSelect = async (projectId: string) => {
    if (!threadId || moving) {
      return;
    }
    setMoving(true);
    try {
      await apiClient.moveThreadToProject(threadId, projectId);
      onMoved(threadId, projectId);
      onOpenChange(false);
      toast.success(t('threadHistory.thread.actions.moveProject.success'));
    } catch (_error) {
      toast.error(t('threadHistory.thread.actions.moveProject.error'));
    } finally {
      setMoving(false);
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <DialogTitle className="px-4 pt-4 text-sm font-semibold">
        <Translator path="threadHistory.thread.actions.moveProject.title" />
      </DialogTitle>
      <CommandInput
        placeholder={t(
          'threadHistory.thread.actions.moveProject.searchPlaceholder'
        )}
        value={searchQuery}
        onValueChange={setSearchQuery}
        disabled={moving}
      />
      <CommandList>
        {loading || moving ? (
          <div className="flex items-center justify-center p-4">
            <Loader />
          </div>
        ) : null}
        {!loading && !moving && projects.length === 0 ? (
          <CommandEmpty>
            <Translator path="threadHistory.thread.actions.moveProject.empty" />
          </CommandEmpty>
        ) : null}
        {!loading && !moving && projects.length > 0 ? (
          <CommandGroup>
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                value={project.id}
                onSelect={() => {
                  void handleSelect(project.id);
                }}
              >
                <span className="truncate">{project.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
