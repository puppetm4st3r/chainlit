import { describe, expect, it } from 'vitest';

import type { ICustomElement, IMessageElement } from '@chainlit/react-client';

import {
  buildFloatingElementsSignature,
  decideFloatingAutoOpen,
  isFloatingCustom
} from '@/lib/floatingView';

const floatingCustom = (
  overrides: Partial<ICustomElement> = {}
): ICustomElement =>
  ({
    id: 'el-1',
    type: 'custom',
    name: 'Widget',
    display: 'floating',
    forId: 'msg-1',
    props: {},
    ...overrides
  }) as ICustomElement;

describe('floatingView helpers', () => {
  it('isFloatingCustom accepts only custom + floating', () => {
    expect(isFloatingCustom(floatingCustom())).toBe(true);
    expect(
      isFloatingCustom({
        ...floatingCustom(),
        display: 'side'
      } as IMessageElement)
    ).toBe(false);
    expect(
      isFloatingCustom({
        id: 'f1',
        type: 'file',
        name: 'doc',
        display: 'floating',
        forId: 'msg-1'
      } as IMessageElement)
    ).toBe(false);
  });

  it('buildFloatingElementsSignature is stable for the same id set', () => {
    const a = floatingCustom({ id: 'b', name: 'B' });
    const b = floatingCustom({ id: 'a', name: 'A' });
    expect(buildFloatingElementsSignature([a, b])).toBe(
      buildFloatingElementsSignature([b, a])
    );
    expect(buildFloatingElementsSignature([a, b])).toBe('a::A|b::B');
  });

  it('buildFloatingElementsSignature changes when ids change', () => {
    const first = buildFloatingElementsSignature([
      floatingCustom({ id: '1', name: 'One' })
    ]);
    const second = buildFloatingElementsSignature([
      floatingCustom({ id: '1', name: 'One' }),
      floatingCustom({ id: '2', name: 'Two' })
    ]);
    expect(first).not.toBe(second);
  });

  it('buildFloatingElementsSignature ignores prop-only changes', () => {
    const base = floatingCustom({ id: '1', name: 'One', props: { n: 1 } });
    const updated = floatingCustom({ id: '1', name: 'One', props: { n: 2 } });
    expect(buildFloatingElementsSignature([base])).toBe(
      buildFloatingElementsSignature([updated])
    );
  });

  it('decideFloatingAutoOpen opens the latest candidate', () => {
    const first = floatingCustom({ id: '1', name: 'One' });
    const second = floatingCustom({ id: '2', name: 'Two' });
    expect(
      decideFloatingAutoOpen({
        candidates: [first, second],
        previousIds: [],
        previousElementsById: new Map()
      })
    ).toEqual({ action: 'open', element: second });
  });

  it('decideFloatingAutoOpen suppresses after dismiss of the same set', () => {
    const el = floatingCustom({ id: '1', name: 'One' });
    const signature = buildFloatingElementsSignature([el]);
    expect(
      decideFloatingAutoOpen({
        candidates: [el],
        previousIds: [],
        previousElementsById: new Map(),
        dismissedSignature: signature
      })
    ).toEqual({ action: 'suppress' });
  });

  it('decideFloatingAutoOpen reopens when a new id arrives after dismiss', () => {
    const first = floatingCustom({ id: '1', name: 'One' });
    const second = floatingCustom({ id: '2', name: 'Two' });
    const dismissed = buildFloatingElementsSignature([first]);
    expect(
      decideFloatingAutoOpen({
        candidates: [first, second],
        previousIds: [first.id],
        previousElementsById: new Map([[first.id, first]]),
        dismissedSignature: dismissed
      })
    ).toEqual({ action: 'open', element: second });
  });

  it('decideFloatingAutoOpen syncs live updates for the open element', () => {
    const base = floatingCustom({ id: '1', name: 'One', props: { n: 1 } });
    const updated = floatingCustom({ id: '1', name: 'One', props: { n: 2 } });
    expect(
      decideFloatingAutoOpen({
        candidates: [updated],
        previousIds: [base.id],
        previousElementsById: new Map([[base.id, base]]),
        currentOpenElementId: base.id
      })
    ).toEqual({ action: 'sync', element: updated });
  });

  it('decideFloatingAutoOpen does not reopen on prop updates after dismiss', () => {
    const base = floatingCustom({ id: '1', name: 'One', props: { n: 1 } });
    const updated = floatingCustom({ id: '1', name: 'One', props: { n: 2 } });
    const dismissed = buildFloatingElementsSignature([base]);
    expect(
      decideFloatingAutoOpen({
        candidates: [updated],
        previousIds: [base.id],
        previousElementsById: new Map([[base.id, base]]),
        dismissedSignature: dismissed
      })
    ).toEqual({ action: 'noop' });
  });

  it('decideFloatingAutoOpen clears when candidates are empty', () => {
    expect(
      decideFloatingAutoOpen({
        candidates: [],
        previousIds: ['1'],
        previousElementsById: new Map()
      })
    ).toEqual({ action: 'clear' });
  });
});
