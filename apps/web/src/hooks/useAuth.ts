import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useAuth() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .get<{ authenticated: boolean }>('/api/auth/check')
      .then((r) => setAuthed(r.authenticated))
      .catch(() => setAuthed(false));
  }, []);

  const handleLogin = async (accessCode: string) => {
    await api.post('/api/auth/login', { accessCode });
    setAuthed(true);
  };

  const handleLogout = async () => {
    await api.post('/api/auth/logout').catch(() => {});
    setAuthed(false);
  };

  return { authed, handleLogin, handleLogout };
}
