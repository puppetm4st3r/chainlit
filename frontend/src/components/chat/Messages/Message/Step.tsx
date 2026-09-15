import { cn } from '@/lib/utils';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';

import type { IStep } from '@chainlit/react-client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import {
  formatStepElapsedClock,
  getStepChildTaskCount,
  isCotRollingWindowStep
} from './cotLiveLines';

interface Props {
  step: IStep;
  isRunning?: boolean;
  style?: React.CSSProperties;
}

/**
 * Step title suffix: elapsed clock plus a subscript child-task count.
 */
function StepTitleMeta({
  durationText,
  childTaskCount
}: {
  durationText: string;
  childTaskCount: number;
}) {
  return (
    <>
      {durationText}
      {childTaskCount > 0 ? <sub className="ml-3 mr-1.5">[{childTaskCount}]</sub> : null}
    </>
  );
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
  const compactType = isCotRollingWindowStep(step);
  const childTaskCount = getStepChildTaskCount(step);

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

  const durationText = formatStepElapsedClock(elapsedSeconds);
  const titleClassName = cn(
    'ml-2',
    compactType && 'cot-step-title',
    isError && 'text-red-500',
    !using && 'text-muted-foreground',
    using && 'loading-shimmer'
  );

  if (!hasContent) {
    return (
      <div className="flex flex-col flex-grow w-0" style={style}>
        <p
          className={cn('flex items-center gap-1', !compactType && 'font-medium')}
          id={`step-${stepName}`}
        >
          <span className={cn('text-lg', using && 'bulb-glow', !using && 'bulb-off')}>💡</span>
          <span className={titleClassName}>
            {stepName}
            <StepTitleMeta
              durationText={durationText}
              childTaskCount={childTaskCount}
            />
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
            className={cn(
              'flex items-center gap-1 justify-start transition-none p-0 hover:no-underline',
              compactType && 'font-normal'
            )}
            id={`step-${stepName}`}
          >
            <span className={cn('text-lg', using && 'bulb-glow', !using && 'bulb-off')}>💡</span>
            <span
              className={cn(
                titleClassName,
                !using && 'hover:text-foreground'
              )}
            >
              {stepName}
              <StepTitleMeta
                durationText={durationText}
                childTaskCount={childTaskCount}
              />
            </span>
          </AccordionTrigger>
          <AccordionContent disableAnimation>
            <div className="flex-grow mt-4 ml-1 pl-4 border-l-2 border-primary/25">
              {children}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
