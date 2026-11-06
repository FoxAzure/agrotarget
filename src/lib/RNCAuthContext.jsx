import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'rnc_user';
const RNCAuthContext = createContext(null);

const readStoredUser = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const RNCAuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const validateUser = async () => {
      const storedUser = readStoredUser();

      if (!storedUser?.id) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase.rpc('rnc_validar_usuario', {
          p_id: storedUser.id,
        });

        if (!active) return;

        if (error || !data?.length) {
          localStorage.removeItem(STORAGE_KEY);
          setUser(null);
        } else {
          const currentUser = data[0];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
          setUser(currentUser);
        }
      } catch (error) {
        console.error('Erro ao validar usuário RNC:', error);
        if (active) {
          localStorage.removeItem(STORAGE_KEY);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    validateUser();

    return () => {
      active = false;
    };
  }, []);

  const login = async (usuario, senha) => {
    const { data, error } = await supabase.rpc('rnc_login', {
      p_usuario: usuario.trim(),
      p_senha: senha,
    });

    if (error) {
      console.error('Erro no login RNC:', error);
      throw new Error('Não foi possível realizar o login.');
    }

    if (!data?.length) {
      throw new Error('Usuário ou senha inválidos.');
    }

    const loggedUser = data[0];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(loggedUser));
    setUser(loggedUser);
    return loggedUser;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      isAdmin: user?.nivel === 'admin',
      isGerente: user?.nivel === 'gerente',
      isNormal: user?.nivel === 'normal',
      canCreateRNC: ['gerente', 'admin'].includes(user?.nivel),
    }),
    [user, loading]
  );

  return (
    <RNCAuthContext.Provider value={value}>
      {children}
    </RNCAuthContext.Provider>
  );
};

export const useRNCAuth = () => {
  const context = useContext(RNCAuthContext);

  if (!context) {
    throw new Error('useRNCAuth deve ser usado dentro de RNCAuthProvider.');
  }

  return context;
};
