import type { IMessageElement } from '@chainlit/react-client';

export const buildSideViewElementsSignature = (
  elements: IMessageElement[]
): string => {
  try {
    return JSON.stringify(elements, (_key, value) => {
      if (Array.isArray(value) || !value || typeof value !== 'object') {
        return value;
      }

      return Object.keys(value)
        .sort()
        .reduce<Record<string, unknown>>((accumulator, currentKey) => {
          accumulator[currentKey] = (value as Record<string, unknown>)[currentKey];
          return accumulator;
        }, {});
    });
  } catch {
    return '';
  }
};
