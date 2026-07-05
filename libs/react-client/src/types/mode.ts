/**
 * Represents a single selectable option within a mode.
 */
export interface IModeOption {
  id: string;
  name: string;
  description?: string;
  tooltip?: string;
  icon?: string;
  selected?: boolean;
}

/**
 * Represents a mode category containing multiple selectable options.
 * Examples: Model selection, Reasoning Effort, Approach preference, etc.
 */
export interface IMode {
  id: string;
  name: string;
  description?: string;
  multi?: boolean;
  options: IModeOption[];
}
