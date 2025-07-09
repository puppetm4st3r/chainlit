import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@chainlit/react-client';
import { useQuery } from 'hooks/query';

export default function AuthCallback() {
  const { user, setUserFromAPI } = useAuth();
  const navigate = useNavigate();
  const query = useQuery();

  // Fetch user in cookie-based oauth.
  useEffect(() => {
    if (!user) setUserFromAPI();
  }, []);

  useEffect(() => {
    if (user) {
      // Check if there's a redirect_to parameter
      const redirectTo = query.get('redirect_to');
      if (redirectTo) {
        // Decode and navigate to the original URL
        navigate(decodeURIComponent(redirectTo));
      } else {
        navigate('/');
      }
    }
  }, [user, query, navigate]);

  return null;
}
