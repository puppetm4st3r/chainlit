/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';

import { isPointerOverTrigger } from './visibility';

describe('tooltip dismiss hit-test', () => {
  it('treats a point inside the trigger rect as still over the trigger', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Row';
    document.body.append(trigger);
    Object.defineProperty(trigger, 'getBoundingClientRect', {
      value: () => ({
        left: 10,
        top: 10,
        right: 110,
        bottom: 40,
        width: 100,
        height: 30,
        x: 10,
        y: 10,
        toJSON: () => ({}),
      }),
    });

    expect(isPointerOverTrigger(trigger, 50, 20, document.body)).toBe(true);
    expect(isPointerOverTrigger(trigger, 400, 400, document.body)).toBe(false);
    trigger.remove();
  });
});
