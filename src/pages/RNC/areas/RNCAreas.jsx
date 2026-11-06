import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { useRNCAuth } from '../../../lib/RNCAuthContext';
import RNCHeader from '../../../components/RNC/RNCHeader';
import RNCSideBar from '../../../components/RNC/RNCSideBar';
import './RNCAreas.css';

const EMPTY_FORM = {
  area: '',
  status: 'ativo',
};

const RNCAreas = () => {
  const { user } = useRNCAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');

  const selectedArea = useMemo(
    () => areas.find((item) => item.id === editingId) || null,
    [areas, editingId]
  );

  const filteredAreas = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return areas;

    return areas.filter((item) =>
      String(item.area || '').toLowerCase().includes(term)
    );
  }, [areas, search]);

  const activeCount = useMemo(
    () => areas.filter((item) => item.status === 'ativo').length,
    [areas]
  );

  const inactiveCount = areas.length - activeCount;

  const showMessage = (type, text) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3500);
  };

  const loadAreas = async () => {
    if (!user?.id) return;

    setLoading(true);

    const { data, error } = await supabase.rpc('rnc_listar_areas', {
      p_admin_id: user.id,
    });

    if (error) {
      console.error('Erro ao listar áreas:', error);
      showMessage('error', 'Não foi possível carregar as áreas.');
      setAreas([]);
    } else {
      setAreas(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadAreas();
  }, [user?.id]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);

    const { error } = await supabase.rpc('rnc_criar_area', {
      p_admin_id: user.id,
      p_area: form.area.trim(),
      p_status: form.status,
    });

    if (error) {
      console.error('Erro ao criar área:', error);
      showMessage(
        'error',
        error.message?.toLowerCase().includes('duplicate')
          ? 'Essa área já está cadastrada.'
          : error.message || 'Não foi possível criar a área.'
      );
    } else {
      setForm(EMPTY_FORM);
      showMessage('success', 'Área criada com sucesso.');
      await loadAreas();
    }

    setSaving(false);
  };

  const startEdit = (item) => {
    setEditingId(item.id);
  };

  const cancelEdit = async () => {
    setEditingId(null);
    await loadAreas();
  };

  const updateSelected = (field, value) => {
    setAreas((current) =>
      current.map((item) =>
        item.id === editingId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleUpdate = async () => {
    if (!selectedArea) return;

    if (selectedArea.area.trim().length < 2) {
      showMessage('error', 'A área deve ter pelo menos 2 caracteres.');
      return;
    }

    setSaving(true);

    const { error } = await supabase.rpc('rnc_atualizar_area', {
      p_admin_id: user.id,
      p_id: selectedArea.id,
      p_area: selectedArea.area.trim(),
      p_status: selectedArea.status,
    });

    if (error) {
      console.error('Erro ao atualizar área:', error);
      showMessage(
        'error',
        error.message?.toLowerCase().includes('duplicate')
          ? 'Já existe outra área com esse nome.'
          : error.message || 'Não foi possível atualizar a área.'
      );
      await loadAreas();
    } else {
      showMessage('success', 'Área atualizada com sucesso.');
      setEditingId(null);
      await loadAreas();
    }

    setSaving(false);
  };

  const handleToggleStatus = async (item) => {
    const nextStatus = item.status === 'ativo' ? 'inativo' : 'ativo';
    setSaving(true);

    const { error } = await supabase.rpc('rnc_atualizar_area', {
      p_admin_id: user.id,
      p_id: item.id,
      p_area: item.area,
      p_status: nextStatus,
    });

    if (error) {
      console.error('Erro ao alterar status da área:', error);
      showMessage('error', 'Não foi possível alterar o status da área.');
    } else {
      showMessage(
        'success',
        nextStatus === 'ativo'
          ? 'Área reativada com sucesso.'
          : 'Área inativada com sucesso.'
      );
      await loadAreas();
    }

    setSaving(false);
  };

  return (
    <div className="rnc-areas-page">
      <RNCHeader onMenuOpen={() => setSidebarOpen(true)} />
      <RNCSideBar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="rnc-areas-main">
        <section className="rnc-areas-heading">
          <div>
            <span>Administração</span>
            <h1>Gerenciar áreas</h1>
            <p>Cadastre, edite, inative e visualize as áreas utilizadas nas RNCs.</p>
          </div>

          <div className="rnc-areas-summary">
            <strong>{areas.length}<small>Total</small></strong>
            <strong className="is-active">{activeCount}<small>Ativas</small></strong>
            <strong className="is-inactive">{inactiveCount}<small>Inativas</small></strong>
          </div>
        </section>

        {message && (
          <div className={`rnc-areas-message is-${message.type}`} role="status">
            {message.text}
          </div>
        )}

        <section className="rnc-areas-create">
          <div className="rnc-areas-section-title">
            <h2>Nova área</h2>
            <span>Cadastro administrativo</span>
          </div>

          <form onSubmit={handleCreate} className="rnc-areas-form">
            <label>
              <span>Nome da área</span>
              <input
                name="area"
                value={form.area}
                onChange={handleFormChange}
                minLength={2}
                maxLength={100}
                placeholder="Ex.: Irrigação"
                autoComplete="off"
                required
              />
            </label>

            <label>
              <span>Status inicial</span>
              <select name="status" value={form.status} onChange={handleFormChange}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>

            <button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Criar área'}
            </button>
          </form>
        </section>

        <section className="rnc-areas-list-section">
          <div className="rnc-areas-list-head">
            <div className="rnc-areas-section-title">
              <h2>Áreas cadastradas</h2>
              <button type="button" onClick={loadAreas} disabled={loading || saving}>
                Atualizar
              </button>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar área..."
              aria-label="Buscar área"
            />
          </div>

          {loading ? (
            <div className="rnc-areas-empty">Carregando áreas...</div>
          ) : filteredAreas.length === 0 ? (
            <div className="rnc-areas-empty">
              {search ? 'Nenhuma área corresponde à busca.' : 'Nenhuma área cadastrada.'}
            </div>
          ) : (
            <div className="rnc-areas-list">
              {filteredAreas.map((item) => {
                const isEditing = editingId === item.id;

                return (
                  <article className="rnc-area-card" key={item.id}>
                    <div className="rnc-area-card__top">
                      <span className={`rnc-area-card__icon ${item.status === 'ativo' ? 'is-active' : 'is-inactive'}`}>
                        {item.area.charAt(0).toUpperCase()}
                      </span>

                      <div className="rnc-area-card__identity">
                        <strong>{item.area}</strong>
                        <small>Área #{item.id}</small>
                      </div>

                      <span className={`rnc-area-card__status ${item.status === 'ativo' ? 'is-active' : 'is-inactive'}`}>
                        {item.status}
                      </span>
                    </div>

                    {isEditing && (
                      <div className="rnc-area-card__editor">
                        <label>
                          <span>Nome da área</span>
                          <input
                            value={item.area}
                            maxLength={100}
                            onChange={(event) => updateSelected('area', event.target.value)}
                          />
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

                    <div className="rnc-area-card__actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="is-primary"
                            onClick={handleUpdate}
                            disabled={saving}
                          >
                            Salvar
                          </button>
                          <button type="button" onClick={cancelEdit} disabled={saving}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(item)} disabled={saving}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className={item.status === 'ativo' ? 'is-danger' : 'is-success'}
                            onClick={() => handleToggleStatus(item)}
                            disabled={saving}
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

export default RNCAreas;
