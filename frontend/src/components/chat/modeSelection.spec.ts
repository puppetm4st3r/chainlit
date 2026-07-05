import { describe, expect, it } from 'vitest';

import type { IMode } from '@chainlit/react-client';

import {
  buildSelectedModesPayload,
  getSelectedModeOptionIds,
  hasSelectedModes
} from './modeSelection';

describe('modeSelection helpers', () => {
  it('keeps multiple selected options for multi-select modes', () => {
    const mode: IMode = {
      id: 'reasoning',
      name: 'Reasoning',
      multi: true,
      options: [
        { id: 'high', name: 'High', selected: true },
        { id: 'medium', name: 'Medium', selected: true },
        { id: 'low', name: 'Low', selected: false }
      ]
    };

    expect(getSelectedModeOptionIds(mode)).toEqual(['high', 'medium']);
  });

  it('falls back to the first option for single-select modes', () => {
    const mode: IMode = {
      id: 'model',
      name: 'Model',
      options: [
        { id: 'gpt-5', name: 'GPT-5' },
        { id: 'gpt-4.1', name: 'GPT-4.1' }
      ]
    };

    expect(getSelectedModeOptionIds(mode)).toEqual(['gpt-5']);
  });

  it('builds the websocket payload using selected option arrays', () => {
    const modes: IMode[] = [
      {
        id: 'model',
        name: 'Model',
        options: [
          { id: 'gpt-5', name: 'GPT-5', selected: true },
          { id: 'gpt-4.1', name: 'GPT-4.1', selected: false }
        ]
      },
      {
        id: 'reasoning',
        name: 'Reasoning',
        multi: true,
        options: [
          { id: 'high', name: 'High', selected: true },
          { id: 'medium', name: 'Medium', selected: true }
        ]
      }
    ];

    expect(buildSelectedModesPayload(modes)).toEqual({
      model: ['gpt-5'],
      reasoning: ['high', 'medium']
    });
    expect(hasSelectedModes(modes)).toBe(true);
  });
});
