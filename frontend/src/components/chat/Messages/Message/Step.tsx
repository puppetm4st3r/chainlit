import { cn } from '@/lib/utils';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';

import type { IStep } from '@chainlit/react-client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';

interface Props {
  step: IStep;
  isRunning?: boolean;
  style?: React.CSSProperties;
}

export default function Step({
  step,
  children,
  isRunning,
  style
}: PropsWithChildren<Props>) {
  const using = useMemo(() => {
    return isRunning && step.start && !step.end && !step.isError;
  }, [step, isRunning]);

  const hasContent = step.input || step.output || step.steps?.length;
  const isError = step.isError;
  const stepName = step.name;

  // Keep the locally-added elapsed time feature for long-running steps.
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [openValue, setOpenValue] = useState<string>(
    step.defaultOpen ? step.id : ''
  );

  useEffect(() => {
    if (!step.start) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = new Date(step.start).getTime();

    if (step.end) {
      const endTime = new Date(step.end).getTime();
      const duration = Math.max(0, Math.round((endTime - startTime) / 1000));
      setElapsedSeconds(duration);
      return;
    }

    if (!using) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsedSeconds = () => {
      const now = Date.now();
      const elapsed = Math.max(0, Math.round((now - startTime) / 1000));
      setElapsedSeconds(elapsed);
    };

    updateElapsedSeconds();
    const interval = setInterval(updateElapsedSeconds, 1000);

    return () => clearInterval(interval);
  }, [step.start, step.end, using]);

  // Preserve upstream auto-collapse behavior when a step finishes.
  useEffect(() => {
    if (!using && step.autoCollapse) {
      setOpenValue('');
    }
  }, [using, step.autoCollapse]);

  const durationText = elapsedSeconds > 0 ? ` @ ${elapsedSeconds} s.` : '';

  if (!hasContent) {
    return (
      <div className="flex flex-col flex-grow w-0" style={style}>
        <p
          className="flex items-center gap-1 font-medium"
          id={`step-${stepName}`}
        >
          <span className={cn('text-lg', using && 'bulb-glow', !using && 'bulb-off')}>💡</span>
          <span
            className={cn(
              'ml-2',
              isError && 'text-red-500',
              !using && 'text-muted-foreground',
              using && 'loading-shimmer'
            )}
          >
            {stepName}
            {durationText}
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow w-0" style={style}>
      <Accordion
        type="single"
        collapsible
        value={openValue}
        onValueChange={(val) => setOpenValue(val)}
        className="w-full"
      >
        <AccordionItem value={step.id} className="border-none">
          <AccordionTrigger
            className="flex items-center gap-1 justify-start transition-none p-0 hover:no-underline"
            id={`step-${stepName}`}
          >
            <span className={cn('text-lg', using && 'bulb-glow', !using && 'bulb-off')}>💡</span>
            <span
              className={cn(
                'ml-2',
                isError && 'text-red-500',
                !using && 'text-muted-foreground hover:text-foreground',
                using && 'loading-shimmer'
              )}
            >
              {stepName}
              {durationText}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex-grow mt-4 ml-1 pl-4 border-l-2 border-primary">
              {children}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
