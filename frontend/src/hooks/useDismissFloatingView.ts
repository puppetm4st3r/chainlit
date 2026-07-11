import {
  ICustomElement,
  IMessageElement,
  elementState,
  floatingViewState
} from '@chainlit/react-client';
import { useRecoilCallback } from 'recoil';

import {
  buildFloatingElementsSignature,
  isFloatingCustom
} from '@/lib/floatingView';
import { dismissedFloatingSignatureState } from '@/state/project';

/**
 * Atomically dismisses the floating window and records a signature that
 * blocks automatic re-hydration from historical floating CustomElements
 * still tracked in elementState.
 */
export function useDismissFloatingView(): (
  activeElement?: ICustomElement
) => string | undefined {
  return useRecoilCallback(
    ({ set, snapshot }) =>
      (activeElement?: ICustomElement) => {
        const trackedElements = snapshot
          .getLoadable(elementState)
          .getValue() as IMessageElement[];

        const floatingById = new Map<string, IMessageElement>();
        trackedElements
          .filter(isFloatingCustom)
          .forEach((element) => floatingById.set(element.id, element));

        if (activeElement && !floatingById.has(activeElement.id)) {
          floatingById.set(activeElement.id, activeElement);
        }

        const dismissedSignature = buildFloatingElementsSignature(
          Array.from(floatingById.values())
        );

        set(
          dismissedFloatingSignatureState,
          dismissedSignature || undefined
        );
        set(floatingViewState, undefined);
        return dismissedSignature || undefined;
      },
    []
  );
}
