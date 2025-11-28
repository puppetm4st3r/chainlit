import { atom, useRecoilState } from 'recoil';

/**
 * Determine the default language for the application.
 * Order of precedence:
 * 1) Persisted user preference in localStorage ('cl:language')
 * 2) Browser language (navigator.language)
 * 3) Fallback to 'en-US'
 */
function resolveDefaultLanguage(): string {
  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('cl:language');
      if (stored) return stored;
    }
  } catch {
    // Ignore storage access issues and fallback to navigator
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en-US';
}

export const languageState = atom<string>({
  key: 'Language',
  default: resolveDefaultLanguage()
});

/**
 * React hook to get and set the UI language across the application.
 * Setting the language persists the choice in localStorage.
 */
export function useLanguage() {
  const [language, setLanguageAtom] = useRecoilState(languageState);

  const setLanguage = (lng: string) => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('cl:language', lng);
      }
    } catch {
      // Ignore storage access issues, still update state
    }
    setLanguageAtom(lng);
  };

  return { language, setLanguage };
}



