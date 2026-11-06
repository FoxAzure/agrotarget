import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRNCAuth } from '../../../lib/RNCAuthContext';
import RNCHeader from '../../../components/RNC/RNCHeader';
import RNCSideBar from '../../../components/RNC/RNCSideBar';
import './RNCUsuarios.css';

const EMPTY_FORM = {
  usuario: '',
  senha: '',
  nick: '',
  nivel: 'normal',
};

const RNCUsuarios = () => {
  const { user } = useRNCAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [passwordId, setPasswordId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const selectedUser = useMemo(
    () => usuarios.find((item) => item.id === editingId) || null,
    [usuarios, editingId]
  );

  const showMessage = (type, text) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3500);
  };

  const loadUsers = async () => {
    if (!user?.id) return;

    setLoading(true);

    const { data, error } = await supabase.rpc('rnc_listar_usuarios', {
      p_admin_id: user.id,
    });

    if (error) {
      console.error('Erro ao listar usuários:', error);
      showMessage('error', 'Não foi possível carregar os usuários.');
      setUsuarios([]);
    } else {
      setUsuarios(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, [user?.id]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);

    const { error } = await supabase.rpc('rnc_criar_usuario', {
      p_admin_id: user.id,
      p_usuario: form.usuario.trim(),
      p_senha: form.senha,
      p_nick: form.nick.trim(),
      p_nivel: form.nivel,
    });

    if (error) {
      console.error('Erro ao criar usuário:', error);
      showMessage('error', error.message.includes('duplicate')
        ? 'Esse usuário já está cadastrado.'
        : 'Não foi possível criar o usuário.');
    } else {
      setForm(EMPTY_FORM);
      showMessage('success', 'Usuário criado com sucesso.');
      await loadUsers();
    }

    setSaving(false);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setPasswordId(null);
    setNewPassword('');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const updateSelected = (field, value) => {
    setUsuarios((current) => current.map((item) => (
      item.id === editingId ? { ...item, [field]: value } : item
    )));
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;
    setSaving(true);

    const { error } = await supabase.rpc('rnc_atualizar_usuario', {
      p_admin_id: user.id,
      p_id: selectedUser.id,
      p_nick: selectedUser.nick.trim(),
      p_nivel: selectedUser.nivel,
      p_ativo: selectedUser.ativo,
    });

    if (error) {
      console.error('Erro ao atualizar usuário:', error);
      showMessage('error', error.message || 'Não foi possível atualizar o usuário.');
      await loadUsers();
    } else {
      showMessage('success', 'Usuário atualizado com sucesso.');
      setEditingId(null);
      await loadUsers();
    }

    setSaving(false);
  };

  const handlePassword = async (item) => {
    if (passwordId !== item.id) {
      setPasswordId(item.id);
      setEditingId(null);
      setNewPassword('');
      return;
    }

    if (newPassword.length < 6) {
      showMessage('error', 'A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc('rnc_redefinir_senha', {
      p_admin_id: user.id,
      p_id: item.id,
      p_nova_senha: newPassword,
    });

    if (error) {
      console.error('Erro ao redefinir senha:', error);
      showMessage('error', 'Não foi possível alterar a senha.');
    } else {
      setPasswordId(null);
      setNewPassword('');
      showMessage('success', 'Senha alterada com sucesso.');
    }

    setSaving(false);
  };

  const formatDate = (value) => {
    if (!value) return 'Nunca acessou';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(value));
  };

  return (
    <div className="rnc-users-page">
      <RNCHeader onMenuOpen={() => setSidebarOpen(true)} />
      <RNCSideBar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="rnc-users-main">
        <section className="rnc-users-heading">
          <div>
            <span>Administração</span>
            <h1>Gerenciar usuários</h1>
            <p>Cadastre logins, altere níveis de acesso e redefina senhas.</p>
          </div>
          <strong>{usuarios.length} usuários</strong>
        </section>

        {message && (
          <div className={`rnc-users-message is-${message.type}`} role="status">
            {message.text}
          </div>
        )}

        <section className="rnc-users-create">
          <div className="rnc-users-section-title">
            <h2>Novo usuário</h2>
            <span>Campos obrigatórios</span>
          </div>

          <form onSubmit={handleCreate} className="rnc-users-form">
            <label>
              <span>Usuário</span>
              <input
                name="usuario"
                value={form.usuario}
                onChange={handleFormChange}
                minLength={3}
                autoComplete="off"
                required
              />
            </label>

            <label>
              <span>Nome</span>
              <input
                name="nick"
                value={form.nick}
                onChange={handleFormChange}
                minLength={3}
                required
              />
            </label>

            <label>
              <span>Senha inicial</span>
              <input
                name="senha"
                type="password"
                value={form.senha}
                onChange={handleFormChange}
                minLength={6}
                autoComplete="new-password"
                required
              />
            </label>

            <label>
              <span>Nível</span>
              <select name="nivel" value={form.nivel} onChange={handleFormChange}>
                <option value="normal">Normal</option>
                <option value="gerente">Gerente</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar usuário'}
            </button>
          </form>
        </section>

        <section className="rnc-users-list-section">
          <div className="rnc-users-section-title">
            <h2>Usuários cadastrados</h2>
            <button type="button" onClick={loadUsers} disabled={loading}>
              Atualizar
            </button>
          </div>

          {loading ? (
            <div className="rnc-users-empty">Carregando usuários...</div>
          ) : usuarios.length === 0 ? (
            <div className="rnc-users-empty">Nenhum usuário encontrado.</div>
          ) : (
            <div className="rnc-users-list">
              {usuarios.map((item) => {
                const isEditing = editingId === item.id;
                const isChangingPassword = passwordId === item.id;

                return (
                  <article className="rnc-user-card" key={item.id}>
                    <div className="rnc-user-card__identity">
                      <span className={`rnc-user-card__avatar level-${item.nivel}`}>
                        {(item.nick || item.usuario).charAt(0).toUpperCase()}
                      </span>

                      <div>
                        <strong>{item.nick}</strong>
                        <small>@{item.usuario}</small>
                      </div>

                      <span className={`rnc-user-card__status ${item.ativo ? 'is-active' : 'is-inactive'}`}>
                        {item.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="rnc-user-card__meta">
                      <span><b>Nível</b>{item.nivel}</span>
                      <span><b>Último acesso</b>{formatDate(item.ultimo_acesso)}</span>
                    </div>

                    {isEditing && (
                      <div className="rnc-user-card__editor">
                        <label>
                          <span>Nome</span>
                          <input
                            value={item.nick}
                            onChange={(event) => updateSelected('nick', event.target.value)}
                          />
                        </label>

                        <label>
                          <span>Nível</span>
                          <select
                            value={item.nivel}
                            onChange={(event) => updateSelected('nivel', event.target.value)}
                          >
                            <option value="normal">Normal</option>
                            <option value="gerente">Gerente</option>
                            <option value="admin">Admin</option>
                          </select>
                        </label>

                        <label className="rnc-user-card__toggle">
                          <input
                            type="checkbox"
                            checked={item.ativo}
                            disabled={item.id === user.id}
                            onChange={(event) => updateSelected('ativo', event.target.checked)}
                          />
                          <span>Usuário ativo</span>
                        </label>
                      </div>
                    )}

                    {isChangingPassword && (
                      <div className="rnc-user-card__password">
                        <input
                          type="password"
                          placeholder="Nova senha, mínimo 6 caracteres"
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          autoComplete="new-password"
                        />
                      </div>
                    )}

                    <div className="rnc-user-card__actions">
                      {isEditing ? (
                        <>
                          <button type="button" className="is-primary" onClick={handleUpdate} disabled={saving}>
                            Salvar
                          </button>
                          <button type="button" onClick={cancelEdit}>Cancelar</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => startEdit(item)}>Editar acesso</button>
                      )}

                      <button
                        type="button"
                        className={isChangingPassword ? 'is-primary' : ''}
                        onClick={() => handlePassword(item)}
                        disabled={saving}
                      >
                        {isChangingPassword ? 'Salvar senha' : 'Alterar senha'}
                      </button>

                      {isChangingPassword && (
                        <button type="button" onClick={() => setPasswordId(null)}>Cancelar</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default RNCUsuarios;
