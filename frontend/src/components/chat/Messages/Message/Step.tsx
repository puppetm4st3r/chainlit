import { cn } from '@/lib/utils';
import { PropsWithChildren, useMemo, useState, useEffect } from 'react';

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

  // Calculate duration in seconds
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  
  useEffect(() => {
    if (!step.start) return;

    const startTime = new Date(step.start).getTime();
    
    // If step is closed, calculate final duration
    if (step.end) {
      const endTime = new Date(step.end).getTime();
      const duration = Math.round((endTime - startTime) / 1000);
      setElapsedSeconds(duration);
      return;
    }
    
    // If step is still running, update counter every second
    if (using) {
      const interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.round((now - startTime) / 1000);
        setElapsedSeconds(elapsed);
      }, 1000);
      
      // Initial calculation
      const now = Date.now();
      const elapsed = Math.round((now - startTime) / 1000);
      setElapsedSeconds(elapsed);
      
      return () => clearInterval(interval);
    }
  }, [step.start, step.end, using]);

  // Format duration text (using universal "s" abbreviation for seconds)
  const durationText = elapsedSeconds > 0 
    ? ` @ ${elapsedSeconds} s.`
    : '';

  // If there's no content, render just the status text without accordion
  if (!hasContent) {
    return (
      <div className="flex flex-col flex-grow w-0" style={style}>
        <p
          className="flex items-center gap-1 font-medium"
          id={`step-${stepName}`}
        >
          <span className={cn("text-lg", using && "bulb-glow", !using && "bulb-off")}>💡</span>
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
        defaultValue={step.defaultOpen ? step.id : undefined}
        className="w-full"
      >
        <AccordionItem value={step.id} className="border-none">
          <AccordionTrigger
            className="flex items-center gap-1 justify-start transition-none p-0 hover:no-underline"
            id={`step-${stepName}`}
          >
            <span className={cn("text-lg", using && "bulb-glow", !using && "bulb-off")}>💡</span>
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
