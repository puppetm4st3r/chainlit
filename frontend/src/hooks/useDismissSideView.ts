import {
  IMessageElement,
  elementState,
  sideViewState
} from '@chainlit/react-client';
import { useRecoilCallback } from 'recoil';

import { buildSideViewElementsSignature } from '@/lib/sideView';
import { dismissedSideViewSignatureState } from '@/state/project';

/**
 * Atomically dismisses the currently visible side view and records a
 * signature that blocks any automatic re-hydration from historical
 * `display="side"` elements still tracked in `elementState`.
 *
 * The signature intentionally covers the full set of side elements present
 * at dismissal time (not only the ones rendered in the active side view).
 * This prevents stale elements accumulated across open/close cycles (e.g.
 * repeated `CustomElement` instances whose ids are never removed by the
 * backend) from re-opening the side view after the user closed it.
 *
 * Callers may pass the active side view elements as a fallback when the
 * recoil snapshot has not propagated yet; the hook will union both sets.
 */
export function useDismissSideView(): (
  activeElements?: IMessageElement[]
) => string | undefined {
  return useRecoilCallback(
    ({ set, snapshot }) =>
      (activeElements?: IMessageElement[]) => {
        const trackedElements = snapshot
          .getLoadable(elementState)
          .getValue() as IMessageElement[];

        const sideElementsById = new Map<string, IMessageElement>();
        trackedElements
          .filter((element) => element.display === 'side')
          .forEach((element) => sideElementsById.set(element.id, element));

        (activeElements || []).forEach((element) => {
          if (!sideElementsById.has(element.id)) {
            sideElementsById.set(element.id, element);
          }
        });

        const dismissedSignature = buildSideViewElementsSignature(
          Array.from(sideElementsById.values())
        );

        set(
          dismissedSideViewSignatureState,
          dismissedSignature || undefined
        );
        set(sideViewState, undefined);
        return dismissedSignature || undefined;
      },
    []
  );
}
