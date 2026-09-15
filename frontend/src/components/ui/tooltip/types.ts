import type { ReactElement, ReactNode } from 'react';

/**
 * Allowed sides for the official product tooltip.
 */
export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

/**
 * Whether the tooltip follows the pointer hotspot or the trigger box.
 */
export type TooltipAnchor = 'trigger' | 'cursor';

/**
 * Last known pointer position in viewport (client) coordinates.
 */
export interface PointerPoint {
  x: number;
  y: number;
}

/**
 * Axis-aligned rectangle in viewport coordinates.
 */
export interface ViewportRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Public contract for the official tooltip wrapper.
 *
 * `title` is accepted as an alias of `label` so existing management call sites
 * that used MUI Tooltip keep working. Rich `tooltip` / `label` wins over `title`.
 */
export interface TooltipProps {
  label?: ReactNode;
  title?: ReactNode;
  tooltip?: ReactNode;
  children: ReactElement;
  delay?: number;
  /** Official sides, or MUI-style values such as `bottom-start`. */
  placement?: TooltipPlacement | string;
  anchor?: TooltipAnchor;
  flip?: boolean;
  disabled?: boolean;
  whenOverflow?: boolean;
  className?: string;
}

/**
 * Options forwarded by `wrapWithTooltip`.
 */
export type WrapTooltipOptions = Omit<TooltipProps, 'label' | 'title' | 'tooltip' | 'children'>;
