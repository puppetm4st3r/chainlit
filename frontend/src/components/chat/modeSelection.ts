import type { IMode } from '@chainlit/react-client';

/**
 * Returns the selected option ids for one mode.
 * Single-select modes fall back to the first option when nothing is selected.
 */
export const getSelectedModeOptionIds = (mode: IMode): string[] => {
  const selectedIds = mode.options
    .filter((option) => option.selected)
    .map((option) => option.id);

  if (selectedIds.length > 0) {
    return selectedIds;
  }

  if (mode.multi) {
    return [];
  }

  return mode.options[0]?.id ? [mode.options[0].id] : [];
};

/**
 * Builds the websocket payload expected by Chainlit messages.
 */
export const buildSelectedModesPayload = (
  modes: IMode[]
): Record<string, string[]> | undefined => {
  const payload = modes.reduce<Record<string, string[]>>((acc, mode) => {
    const selectedIds = getSelectedModeOptionIds(mode);
    if (selectedIds.length > 0) {
      acc[mode.id] = selectedIds;
    }
    return acc;
  }, {});

  return Object.keys(payload).length > 0 ? payload : undefined;
};

/**
 * Returns true when any mode currently contributes a selected option.
 */
export const hasSelectedModes = (modes: IMode[]): boolean =>
  modes.some((mode) => getSelectedModeOptionIds(mode).length > 0);
