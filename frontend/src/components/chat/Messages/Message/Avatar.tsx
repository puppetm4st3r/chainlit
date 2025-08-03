import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { useContext, useMemo } from 'react';

import {
  ChainlitContext,
  useChatSession,
  useConfig
} from '@chainlit/react-client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';

interface Props {
  author?: string;
  hide?: boolean;
  isError?: boolean;
  isStep?: boolean;
}

const MessageAvatar = ({ author, hide, isError, isStep }: Props) => {
  const apiClient = useContext(ChainlitContext);
  const { chatProfile } = useChatSession();
  const { config } = useConfig();

  const selectedChatProfile = useMemo(() => {
    return config?.chatProfiles.find((profile) => profile.name === chatProfile);
  }, [config, chatProfile]);

  const avatarUrl = useMemo(() => {
    // If it's a step, use the gear avatar that exists in backend/public/avatars/
    if (isStep) {
      return apiClient?.buildEndpoint('/avatars/gear') || '/avatars/gear';
    }
    if (config?.ui?.default_avatar_file_url) return config?.ui?.default_avatar_file_url;
    const isAssistant = !author || author === config?.ui.name;
    if (isAssistant && selectedChatProfile?.icon) {
      return selectedChatProfile.icon;
    }
    return apiClient?.buildEndpoint(`/avatars/${author || 'default'}`);
  }, [apiClient, selectedChatProfile, config, author, isStep]);

  if (isError) {
    return (
      <AlertCircle className="h-5 w-5 fill-destructive mt-[5px] text-destructive-foreground" />
    );
  }

  return (
    <span className={cn('inline-block', hide && 'invisible')}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className="h-5 w-5 mt-[3px]">
              <AvatarImage
                src={avatarUrl}
                alt={`Avatar for ${author || 'default'}`}
                className="bg-transparent"
              />
              <AvatarFallback className="bg-transparent">
                <Skeleton className="h-full w-full rounded-full" />
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            <p>{author}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
};

export { MessageAvatar };
