import { Briefcase, FolderOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

export default function ProjectSelector() {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="px-2 pt-1">
        <div className="flex items-center justify-between gap-2 rounded-md px-2 pb-1">
          <span className="min-w-0 truncate text-[0.9rem] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/45">
            Proyecto
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Administrar base de conocimientos del proyecto"
                  className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                  onClick={(event) => {
                    event.preventDefault();
                  }}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                Administrar base de conocimientos del proyecto
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Cambiar de proyecto"
                  className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground"
                  onClick={(event) => {
                    event.preventDefault();
                  }}
                >
                  <Briefcase className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                Cambiar de proyecto
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="px-2 pb-0">
          <div className="border-l border-sidebar-border/70 pl-3">
            <div
              className="line-clamp-2 min-h-[calc(0.9rem*1.35*2)] text-left text-[0.9rem] font-semibold leading-[1.35] tracking-[0.04em] text-sidebar-foreground/80"
            >
              General
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
