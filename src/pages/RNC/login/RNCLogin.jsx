import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useRNCAuth } from '../../../lib/RNCAuthContext';
import rncLogo from '../../../gallery/logo/rnc.png';
import './RNCLogin.css';

const RNCLogin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, login } = useRNCAuth();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) {
    return <main className="rnc-login"><div className="rnc-login__loading">Validando acesso...</div></main>;
  }

  if (user) return <Navigate to="/rnc" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(usuario, senha);
      navigate('/rnc', { replace: true });
    } catch (err) {
      setError(err.message || 'Não foi possível entrar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="rnc-login">
      <form className="rnc-login__card" onSubmit={handleSubmit}>
        <button type="button" className="rnc-login__back" onClick={() => navigate('/rnc')}>
          ← Voltar
        </button>

        <img src={rncLogo} alt="RNC" className="rnc-login__logo" />
        <h1>Entrar no RNC</h1>
        <p>Informe seu usuário e senha.</p>

        <label htmlFor="rnc-usuario">Usuário</label>
        <input
          id="rnc-usuario"
          value={usuario}
          onChange={(event) => setUsuario(event.target.value)}
          autoComplete="username"
          required
          autoFocus
        />

        <label htmlFor="rnc-senha">Senha</label>
        <input
          id="rnc-senha"
          type="password"
          value={senha}
          onChange={(event) => setSenha(event.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <div className="rnc-login__error" role="alert">{error}</div>}

        <button className="rnc-login__submit" type="submit" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  );
};

export default RNCLogin;
