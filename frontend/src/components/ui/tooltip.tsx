import {
  Children,
  createContext,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode
} from 'react';

import { Tooltip as OfficialTooltip, DEFAULT_DELAY_MS, normalizeTooltipPlacement } from './tooltip/Tooltip';
import type { TooltipPlacement } from './tooltip/types';

export { wrapWithTooltip } from './tooltip/wrapWithTooltip';
export { OfficialTooltip };
export const TOOLTIP_DELAY_MS = DEFAULT_DELAY_MS;
export const TOOLTIP_SKIP_DELAY_MS = 0;

type DelayContextValue = {
  delay: number;
};

const TooltipDelayContext = createContext<DelayContextValue>({
  delay: DEFAULT_DELAY_MS
});

type ProviderProps = {
  delayDuration?: number;
  skipDelayDuration?: number;
  children?: ReactNode;
};

/**
 * Supplies the default show delay to compound tooltip trees.
 */
const TooltipProvider = ({
  delayDuration = DEFAULT_DELAY_MS,
  children
}: ProviderProps) => (
  <TooltipDelayContext.Provider value={{ delay: delayDuration }}>
    {children}
  </TooltipDelayContext.Provider>
);

type OfficialProps = {
  label?: ReactNode;
  title?: ReactNode;
  tooltip?: ReactNode;
  children: ReactElement;
  delay?: number;
  placement?: TooltipPlacement | string;
  anchor?: 'trigger' | 'cursor';
  flip?: boolean;
  disabled?: boolean;
  whenOverflow?: boolean;
  className?: string;
};

type CompoundRootProps = {
  children?: ReactNode;
  delayDuration?: number;
};

function isOfficialTooltipProps(props: OfficialProps | CompoundRootProps): props is OfficialProps {
  return (
    isValidElement((props as OfficialProps).children)
    && (
      'label' in props
      || 'title' in props
      || 'tooltip' in props
    )
  );
}

/**
 * Official tooltip, plus the previous Trigger/Content compound API.
 */
function Tooltip(props: OfficialProps | CompoundRootProps) {
  const providerDelay = useContext(TooltipDelayContext).delay;

  if (isOfficialTooltipProps(props)) {
    return (
      <OfficialTooltip
        {...props}
        delay={props.delay ?? providerDelay}
      />
    );
  }

  return <CompoundTooltipRoot delay={props.delayDuration ?? providerDelay}>{props.children}</CompoundTooltipRoot>;
}

function CompoundTooltipRoot({
  children,
  delay
}: {
  children?: ReactNode;
  delay: number;
}) {
  const nodes = Children.toArray(children);
  let trigger: ReactElement | null = null;
  let label: ReactNode = null;
  let placement: TooltipPlacement = 'top';
  let hidden = false;
  let className: string | undefined;
  let whenOverflow = false;

  nodes.forEach((node) => {
    if (!isValidElement(node)) {
      return;
    }
    if (node.type === TooltipTrigger) {
      const triggerProps = node.props as TooltipTriggerProps;
      if (triggerProps.asChild && isValidElement(triggerProps.children)) {
        trigger = triggerProps.children;
        return;
      }
      trigger = (
        <button
          type={triggerProps.type ?? 'button'}
          className="inline-flex items-center justify-center border-0 bg-transparent p-0"
        >
          {triggerProps.children}
        </button>
      );
      return;
    }
    if (node.type === TooltipContent) {
      const contentProps = node.props as TooltipContentProps;
      label = contentProps.children;
      placement = normalizeTooltipPlacement(contentProps.side);
      hidden = Boolean(contentProps.hidden);
      className = contentProps.className;
      whenOverflow = Boolean(contentProps.whenOverflow);
    }
  });

  if (!trigger) {
    return <>{children}</>;
  }

  return (
    <OfficialTooltip
      label={label}
      delay={delay}
      placement={placement}
      disabled={hidden}
      whenOverflow={whenOverflow}
      className={className}
    >
      {trigger}
    </OfficialTooltip>
  );
}

type TooltipTriggerProps = {
  asChild?: boolean;
  type?: 'button' | 'submit' | 'reset';
  children: ReactNode;
};

/**
 * Compound-API trigger. The parent `Tooltip` unwraps this and attaches the official wrapper.
 */
function TooltipTrigger({ children }: TooltipTriggerProps) {
  return <>{children}</>;
}

type TooltipContentProps = {
  children?: ReactNode;
  side?: TooltipPlacement | string;
  sideOffset?: number;
  align?: string;
  hidden?: boolean;
  className?: string;
  whenOverflow?: boolean;
};

/**
 * Compound-API content. Rendered by the parent as the official tooltip label.
 */
function TooltipContent(_props: TooltipContentProps) {
  return null;
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
};

export type { OfficialProps };
