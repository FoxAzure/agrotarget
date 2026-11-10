import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRNCAuth } from '../../../lib/RNCAuthContext';
import RNCHeader from '../../../components/RNC/RNCHeader';
import RNCSideBar from '../../../components/RNC/RNCSideBar';
import './RNCTags.css';

const DEFAULT_COLOR = '#64748B';

const EMPTY_FORM = {
  nome: '',
  cor: DEFAULT_COLOR,
  status: 'ativo',
};

const normalizeColor = (value) => {
  const color = String(value || '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(color) ? color : DEFAULT_COLOR;
};

const RNCTags = () => {
  const { user } = useRNCAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');

  const selectedTag = useMemo(
    () => tags.find((item) => item.id === editingId) || null,
    [tags, editingId]
  );

  const filteredTags = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tags;

    return tags.filter((item) =>
      String(item.nome || '').toLowerCase().includes(term)
    );
  }, [tags, search]);

  const activeCount = useMemo(
    () => tags.filter((item) => item.status === 'ativo').length,
    [tags]
  );

  const inactiveCount = tags.length - activeCount;

  const showMessage = (type, text) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3500);
  };

  const loadTags = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc('rnc_listar_tags', {
      p_admin_id: user.id,
    });

    if (error) {
      console.error('Erro ao listar tags:', error);
      showMessage('error', 'Nao foi possivel carregar as tags.');
      setTags([]);
    } else {
      setTags(
        (data || []).map((item) => ({
          ...item,
          cor: normalizeColor(item.cor),
        }))
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: name === 'cor' ? value.toUpperCase() : value,
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!user?.id) return;

    if (form.nome.trim().length < 2) {
      showMessage('error', 'A tag deve ter pelo menos 2 caracteres.');
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc('rnc_criar_tag', {
      p_admin_id: user.id,
      p_nome: form.nome.trim(),
      p_cor: normalizeColor(form.cor),
      p_status: form.status,
    });

    if (error) {
      console.error('Erro ao criar tag:', error);
      showMessage(
        'error',
        error.message?.toLowerCase().includes('duplicate') ||
          error.message?.toLowerCase().includes('unique')
          ? 'Essa tag ja esta cadastrada.'
          : error.message || 'Nao foi possivel criar a tag.'
      );
    } else {
      setForm(EMPTY_FORM);
      showMessage('success', 'Tag criada com sucesso.');
      await loadTags();
    }

    setSaving(false);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
  };

  const cancelEdit = async () => {
    setEditingId(null);
    await loadTags();
  };

  const updateSelected = (field, value) => {
    setTags((current) =>
      current.map((item) =>
        item.id === editingId
          ? { ...item, [field]: field === 'cor' ? value.toUpperCase() : value }
          : item
      )
    );
  };

  const handleUpdate = async () => {
    if (!selectedTag || !user?.id) return;

    if (selectedTag.nome.trim().length < 2) {
      showMessage('error', 'A tag deve ter pelo menos 2 caracteres.');
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc('rnc_atualizar_tag', {
      p_admin_id: user.id,
      p_id: selectedTag.id,
      p_nome: selectedTag.nome.trim(),
      p_cor: normalizeColor(selectedTag.cor),
      p_status: selectedTag.status,
    });

    if (error) {
      console.error('Erro ao atualizar tag:', error);
      showMessage(
        'error',
        error.message?.toLowerCase().includes('duplicate') ||
          error.message?.toLowerCase().includes('unique')
          ? 'Ja existe outra tag com esse nome.'
          : error.message || 'Nao foi possivel atualizar a tag.'
      );
      await loadTags();
    } else {
      showMessage('success', 'Tag atualizada com sucesso.');
      setEditingId(null);
      await loadTags();
    }

    setSaving(false);
  };

  const handleToggleStatus = async (item) => {
    if (!user?.id) return;

    const nextStatus = item.status === 'ativo' ? 'inativo' : 'ativo';
    setSaving(true);

    const { error } = await supabase.rpc('rnc_atualizar_tag', {
      p_admin_id: user.id,
      p_id: item.id,
      p_nome: item.nome,
      p_cor: normalizeColor(item.cor),
      p_status: nextStatus,
    });

    if (error) {
      console.error('Erro ao alterar status da tag:', error);
      showMessage('error', 'Nao foi possivel alterar o status da tag.');
    } else {
      showMessage(
        'success',
        nextStatus === 'ativo'
          ? 'Tag reativada com sucesso.'
          : 'Tag inativada com sucesso.'
      );
      await loadTags();
    }

    setSaving(false);
  };

  return (
    <div className="rnc-tags-page">
      <RNCHeader onMenuOpen={() => setSidebarOpen(true)} />
      <RNCSideBar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="rnc-tags-main">
        <section className="rnc-tags-heading">
          <div>
            <span>Administracao</span>
            <h1>Gerenciar tags</h1>
            <p>Cadastre, edite, inative e defina as cores das tags utilizadas nas RNCs.</p>
          </div>

          <div className="rnc-tags-summary">
            <strong>{tags.length}<small>Total</small></strong>
            <strong className="is-active">{activeCount}<small>Ativas</small></strong>
            <strong className="is-inactive">{inactiveCount}<small>Inativas</small></strong>
          </div>
        </section>

        {message && (
          <div className={`rnc-tags-message is-${message.type}`} role="status">
            {message.text}
          </div>
        )}

        <section className="rnc-tags-create">
          <div className="rnc-tags-section-title">
            <h2>Nova tag</h2>
            <span>Cadastro administrativo</span>
          </div>

          <form onSubmit={handleCreate} className="rnc-tags-form">
            <label>
              <span>Nome da tag</span>
              <input
                name="nome"
                value={form.nome}
                onChange={handleFormChange}
                minLength={2}
                maxLength={100}
                placeholder="Ex.: Urgente"
                autoComplete="off"
                required
              />
            </label>

            <label>
              <span>Cor</span>
              <div className="rnc-tags-color-field">
                <input
                  type="color"
                  name="cor"
                  value={normalizeColor(form.cor)}
                  onChange={handleFormChange}
                  aria-label="Selecionar cor da tag"
                />
                <input
                  type="text"
                  name="cor"
                  value={form.cor}
                  onChange={handleFormChange}
                  maxLength={7}
                  pattern="#[0-9A-Fa-f]{6}"
                  placeholder="#64748B"
                  required
                />
              </div>
            </label>

            <label>
              <span>Status inicial</span>
              <select name="status" value={form.status} onChange={handleFormChange}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>

            <button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar tag'}
            </button>
          </form>
        </section>

        <section className="rnc-tags-list-section">
          <div className="rnc-tags-list-head">
            <div className="rnc-tags-section-title">
              <h2>Tags cadastradas</h2>
              <button type="button" onClick={loadTags} disabled={loading || saving}>
                Atualizar
              </button>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tag..."
              aria-label="Buscar tag"
            />
          </div>

          {loading ? (
            <div className="rnc-tags-empty">Carregando tags...</div>
          ) : filteredTags.length === 0 ? (
            <div className="rnc-tags-empty">
              {search ? 'Nenhuma tag corresponde a busca.' : 'Nenhuma tag cadastrada.'}
            </div>
          ) : (
            <div className="rnc-tags-list">
              {filteredTags.map((item) => {
                const isEditing = editingId === item.id;
                const itemColor = normalizeColor(item.cor);

                return (
                  <article className="rnc-tag-card" key={item.id}>
                    <div className="rnc-tag-card__top">
                      <span
                        className="rnc-tag-card__color"
                        style={{ '--tag-color': itemColor }}
                        aria-hidden="true"
                      />

                      <div className="rnc-tag-card__identity">
                        <strong>{item.nome}</strong>
                        <small>Tag #{item.id} | {itemColor}</small>
                      </div>

                      <span className={`rnc-tag-card__status ${item.status === 'ativo' ? 'is-active' : 'is-inactive'}`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="rnc-tag-card__preview">
                      <span style={{ '--tag-color': itemColor }}>{item.nome}</span>
                    </div>

                    {isEditing && (
                      <div className="rnc-tag-card__editor">
                        <label>
                          <span>Nome da tag</span>
                          <input
                            value={item.nome}
                            maxLength={100}
                            onChange={(event) => updateSelected('nome', event.target.value)}
                          />
                        </label>

                        <label>
                          <span>Cor</span>
                          <div className="rnc-tags-color-field">
                            <input
                              type="color"
                              value={itemColor}
                              onChange={(event) => updateSelected('cor', event.target.value)}
                              aria-label={`Selecionar cor da tag ${item.nome}`}
                            />
                            <input
                              type="text"
                              value={item.cor}
                              maxLength={7}
                              onChange={(event) => updateSelected('cor', event.target.value)}
                            />
                          </div>
                        </label>

                        <label>
                          <span>Status</span>
                          <select
                            value={item.status}
                            onChange={(event) => updateSelected('status', event.target.value)}
                          >
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                          </select>
                        </label>
                      </div>
                    )}

                    <div className="rnc-tag-card__actions">
                      {isEditing ? (
                        <>
                          <button type="button" className="is-primary" onClick={handleUpdate} disabled={saving}>
                            Salvar
                          </button>
                          <button type="button" onClick={cancelEdit} disabled={saving}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(item)} disabled={saving || editingId !== null}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className={item.status === 'ativo' ? 'is-danger' : 'is-success'}
                            onClick={() => handleToggleStatus(item)}
                            disabled={saving || editingId !== null}
                          >
                            {item.status === 'ativo' ? 'Inativar' : 'Reativar'}
                          </button>
                        </>
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

export default RNCTags;
