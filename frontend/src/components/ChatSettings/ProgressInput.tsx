import { Progress } from '@/components/ui/progress';

import { InputStateHandler } from './InputStateHandler';

interface IInput {
  description?: string;
  hasError?: boolean;
  id: string;
  label?: string;
  tooltip?: string;
}

interface ProgressInputProps extends IInput {
  value?: number;
  min?: number;
  max?: number;
  precision?: number;
  suffix?: string;
  className?: string;
}

const ProgressInput = ({
  description,
  hasError,
  id,
  label,
  tooltip,
  value = 0,
  min = 0,
  max = 100,
  precision = 0,
  suffix = '%',
  className
}: ProgressInputProps) => {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max) && max > safeMin ? max : 100;
  const safeValue = Number.isFinite(value) ? value : 0;
  const clampedValue = Math.min(Math.max(safeValue, safeMin), safeMax);
  const normalizedValue =
    safeMax === safeMin
      ? 0
      : ((clampedValue - safeMin) / (safeMax - safeMin)) * 100;
  const formattedValue = `${safeValue.toFixed(precision)}${suffix || ''}`;

  return (
    <InputStateHandler
      description={description}
      hasError={hasError}
      id={id}
      label={label}
      tooltip={tooltip}
      className={className}
    >
      <div className="space-y-2">
        <Progress id={id} value={normalizedValue} aria-valuenow={clampedValue} />
        <div className="text-right text-xs text-muted-foreground">
          {formattedValue}
        </div>
      </div>
    </InputStateHandler>
  );
};

export { ProgressInput };
export type { ProgressInputProps };
