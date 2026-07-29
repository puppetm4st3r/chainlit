import { useEffect, useRef } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

import { useApi, useAuth } from './api';
import { chatProfileState, configState } from './state';
import { IChainlitConfig } from './types';
import { useLanguage } from './useLanguage';

const useConfig = () => {
  const [config, setConfig] = useRecoilState(configState);
  const { isAuthenticated } = useAuth();
  const chatProfile = useRecoilValue(chatProfileState);
  const { language } = useLanguage();
  // Profile the currently loaded config belongs to. Used to soft-refetch without
  // clearing config (clearing unmounts App and reconnects the socket mid-ask).
  const loadedForProfileRef = useRef<string | undefined>(undefined);

  const normalizedProfile = chatProfile || '';

  // Build the API URL with optional chat profile parameter
  const apiUrl = isAuthenticated
    ? `/project/settings?language=${language}${chatProfile ? `&chat_profile=${encodeURIComponent(chatProfile)}` : ''}`
    : null;

  // Fetch when missing config, or when the active chat profile changed.
  // Keep the previous config mounted so socket asks (Motd, forms) stay alive.
  const needsFetch =
    isAuthenticated &&
    (!config || loadedForProfileRef.current !== normalizedProfile);

  const { data, error, isLoading } = useApi<IChainlitConfig>(
    needsFetch ? apiUrl : null
  );

  useEffect(() => {
    if (!data) return;
    setConfig(data);
    loadedForProfileRef.current = normalizedProfile;
  }, [data, setConfig, normalizedProfile]);

  return { config, error, isLoading, language };
};

export { useConfig };
