import { toast } from 'sonner';

import { ChainlitAPI, ClientError } from '@chainlit/react-client';

export function makeApiClient(
  chainlitServer: string,
  additionalQueryParams: Record<string, string>
) {
  const httpEndpoint = chainlitServer;

  const on401 = () => {
    console.warn('Copilot authentication failed - 401 Unauthorized');
    toast.error('Unauthorized');
  };

  const onError = (error: ClientError) => {
    // Log CSRF-related errors with context
    if (error.status === 403) {
      console.warn('Access denied - possible CSRF protection:', {
        status: error.status,
        message: error.message,
        serverUrl: chainlitServer,
        currentOrigin: typeof window !== 'undefined' ? window.location.origin : 'unknown'
      });
    } else {
      console.warn('API error:', {
        status: error.status,
        message: error.message,
        serverUrl: chainlitServer
      });
    }
    
    toast.error(error.toString());
  };

  return new ChainlitAPI(
    httpEndpoint,
    'copilot',
    additionalQueryParams,
    on401,
    onError
  );
}
