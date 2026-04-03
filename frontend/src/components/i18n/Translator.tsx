import { TOptions } from 'i18next';
import { useTranslation as usei18nextTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';

type TranslationKey = string | string[];
type TranslationOptions = TOptions;

/**
 * Normalizes i18n results to plain text because this wrapper is only used
 * in UI surfaces that expect string content.
 */
const toText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value == null) {
    return '';
  }

  return JSON.stringify(value);
};

type TranslatorProps = {
  path: TranslationKey;
  suffix?: string;
  options?: TranslationOptions;
};

const Translator = ({ path, options, suffix }: TranslatorProps) => {
  const { t, i18n } = usei18nextTranslation();

  if (!i18n.exists(path, options)) {
    return <Skeleton className="h-4 w-10" />;
  }

  return (
    <span>
      {toText(t(path, options))}
      {suffix}
    </span>
  );
};

export const useTranslation = () => {
  const { t, ready, i18n } = usei18nextTranslation();

  return {
    t: (path: TranslationKey, options?: TranslationOptions) => {
      if (!i18n.exists(path, options)) {
        return '...';
      }

      return toText(t(path, options));
    },
    ready,
    i18n
  };
};

export default Translator;
