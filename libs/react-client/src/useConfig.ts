import { useEffect } from 'react';
import { useRecoilState } from 'recoil';

import { useApi, useAuth } from './api';
import { configState } from './state';
import { IChainlitConfig } from './types';
import { useLanguage } from './useLanguage';

const useConfig = () => {
  const [config, setConfig] = useRecoilState(configState);
  const { isAuthenticated } = useAuth();
  const { language } = useLanguage();

  const { data, error, isLoading } = useApi<IChainlitConfig>(
    isAuthenticated ? `/project/settings?language=${language}` : null,
    {
      // Avoid spamming backend on focus/reconnect.
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // If we already have a config in cache, do not revalidate on mount.
      // We still want to fetch when language changes because the key changes.
      revalidateOnMount: !config,
      // Do not auto revalidate stale cache in background.
      revalidateIfStale: false,
      // Deduplicate close-in-time requests across components.
      dedupingInterval: 60000
    }
  );

  useEffect(() => {
    if (!data) return;
    setConfig(data);
  }, [data, setConfig]);

  return { config, error, isLoading, language };
};

export { useConfig };
