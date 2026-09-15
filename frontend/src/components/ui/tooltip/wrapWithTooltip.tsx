import type { ReactElement, ReactNode } from 'react';

import { Tooltip } from './Tooltip';
import { isEmptyTooltipLabel, stripNativeTitle } from './merge';
import type { WrapTooltipOptions } from './types';

/**
 * Wrap a trigger with the official tooltip, or return the trigger unchanged
 * when there is no label or the tooltip is disabled.
 */
export function wrapWithTooltip(
  trigger: ReactElement,
  label: ReactNode,
  options?: WrapTooltipOptions,
): ReactElement {
  const stripped = stripNativeTitle(trigger);
  if (options?.disabled || isEmptyTooltipLabel(label)) {
    return stripped;
  }
  return (
    <Tooltip label={label} {...options}>
      {stripped}
    </Tooltip>
  );
}
