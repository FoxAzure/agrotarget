// ================================= DOCUMENTATION ------------------------------------------
// Script: EquipeHomeMetas
// Purpose: CRUD de atividades e metas da Equipe de Qualidade Agricola no Supabase.
// Relationships:
//   - public.tb_q_equipemetas
//   - supabaseClient
// Notes:
//   - Uma unica leitura inicial carrega ativos e historico.
//   - Busca, listagem e timeline trabalham com cache em memoria.
//   - Nova meta inativa a anterior pelo trigger do banco.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const TABLE_NAME = 'tb_q_equipemetas';
const CACHE_TTL_MS = 5 * 60 * 1000;
const QUERY_RETRIES = 2;
const RETRY_DELAY_MS = 900;

let metasCache = null;
let metasCacheAt = 0;

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const createEmptyForm = () => {
  const currentDate = new Date();

  return {
    atividade: '',
    meta: '',
    mes: currentDate.getMonth() + 1,
    ano: currentDate.getFullYear(),
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runWithRetry = async (queryFn) => {
  let lastError = null;

  for (let attempt = 0; attempt <= QUERY_RETRIES; attempt += 1) {
    const result = await queryFn();
    if (!result.error) return result.data;

    lastError = result.error;
    if (attempt < QUERY_RETRIES) {
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }

  throw lastError;
};

const normalizeActivityKey = (value) =>
  String(value ?? '').trim().toLocaleLowerCase('pt-BR');

const normalizeRow = (row) => ({
  ...row,
  id: Number(row.id),
  meta: Number(row.meta ?? 0),
  mes: Number(row.mes),
  ano: Number(row.ano),
  atividade: String(row.atividade ?? '').trim(),
  status: String(row.status ?? '').trim().toUpperCase(),
});

const sortHistory = (rows) => [...rows].sort((a, b) =>
  (b.ano - a.ano) ||
  (b.mes - a.mes) ||
  (b.id - a.id)
);

const formatNumber = (value) => Number(value ?? 0).toLocaleString('pt-BR', {
  minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 2,
  maximumFractionDigits: 2,
});

const formatDateTime = (value) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

const getDefaultUser = async () => {
  const savedUser = localStorage.getItem('qf_equipe_usuario');
  if (savedUser?.trim()) return savedUser.trim();

  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;
  const metadata = user?.user_metadata || {};

  const resolved =
    metadata.full_name ||
    metadata.name ||
    metadata.display_name ||
    user?.email ||
    'USUARIO_WEB';

  localStorage.setItem('qf_equipe_usuario', resolved);
  return resolved;
};

const loadRows = async ({ force = false } = {}) => {
  const cacheValid =
    Array.isArray(metasCache) &&
    Date.now() - metasCacheAt < CACHE_TTL_MS;

  if (!force && cacheValid) return [...metasCache];

  const data = await runWithRetry(() =>
    supabase
      .from(TABLE_NAME)
      .select('id, atividade, meta, mes, ano, atualizado, usuario, status')
      .order('atividade', { ascending: true })
      .order('ano', { ascending: false })
      .order('mes', { ascending: false })
      .order('id', { ascending: false })
  );

  metasCache = (data || []).map(normalizeRow);
  metasCacheAt = Date.now();
  return [...metasCache];
};

const updateLocalCacheAfterSave = (savedRow) => {
  const saved = normalizeRow(savedRow);
  const savedActivityKey = normalizeActivityKey(saved.atividade);
  const current = Array.isArray(metasCache) ? metasCache : [];

  metasCache = current.map((row) => {
    if (row.id === saved.id) return saved;

    const sameActivity =
      normalizeActivityKey(row.atividade) === savedActivityKey;

    if (sameActivity && saved.status === 'ATIVO') {
      return { ...row, status: 'INATIVO' };
    }

    return row;
  });

  if (!metasCache.some((row) => row.id === saved.id)) {
    metasCache.push(saved);
  }

  metasCacheAt = Date.now();
  return [...metasCache];
};

const EquipeModal = ({ title, eyebrow, children, onClose, wide = false }) => (
  <div
    className="equipe-modal-backdrop"
    role="presentation"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <section
      className={`equipe-modal ${wide ? 'is-wide' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="equipe-modal__header">
        <div>
          <span className="equipe-page__eyebrow">{eyebrow}</span>
          <h3>{title}</h3>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar">×</button>
      </header>
      {children}
    </section>
  </div>
);

const EquipeHomeMetas = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [modalMode, setModalMode] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [form, setForm] = useState(createEmptyForm);
  const [currentUser, setCurrentUser] = useState('USUARIO_WEB');

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      setLoading(true);
      setError('');

      try {
        const [loadedRows, resolvedUser] = await Promise.all([
          loadRows(),
          getDefaultUser(),
        ]);

        if (!active) return;
        setRows(loadedRows);
        setCurrentUser(resolvedUser);
      } catch (loadError) {
        if (active) setError(loadError?.message || 'Erro ao carregar as metas.');
      } finally {
        if (active) setLoading(false);
      }
    };

    initialize();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(''), 2800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && !isSaving) setModalMode(null);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSaving]);

  const activeActivities = useMemo(() => {
    const latestActiveByActivity = new Map();

    sortHistory(rows)
      .filter((row) => row.status === 'ATIVO')
      .forEach((row) => {
        const activityKey = normalizeActivityKey(row.atividade);

        if (activityKey && !latestActiveByActivity.has(activityKey)) {
          latestActiveByActivity.set(activityKey, row);
        }
      });

    return [...latestActiveByActivity.values()].sort((a, b) =>
      a.atividade.localeCompare(b.atividade, 'pt-BR')
    );
  }, [rows]);

  const filteredActivities = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase('pt-BR');
    if (!search) return activeActivities;

    return activeActivities.filter((item) =>
      item.atividade.toLocaleLowerCase('pt-BR').includes(search)
    );
  }, [activeActivities, searchTerm]);

  const timelineRows = useMemo(() => {
    const selectedKey = normalizeActivityKey(selectedActivity);

    return sortHistory(
      rows.filter((row) => normalizeActivityKey(row.atividade) === selectedKey)
    );
  }, [rows, selectedActivity]);

  const closeModal = () => {
    if (isSaving) return;
    setModalMode(null);
    setSelectedActivity('');
    setForm(createEmptyForm());
    setError('');
  };

  const closeModalAfterSave = () => {
    setModalMode(null);
    setSelectedActivity('');
    setForm(createEmptyForm());
    setError('');
  };

  const openNewActivity = () => {
    setSelectedActivity('');
    setForm(createEmptyForm());
    setError('');
    setModalMode('new-activity');
  };

  const openNewGoal = (item) => {
    const currentDate = new Date();

    setSelectedActivity(item.atividade);
    setForm({
      atividade: item.atividade,
      meta: String(item.meta),
      mes: currentDate.getMonth() + 1,
      ano: currentDate.getFullYear(),
    });
    setError('');
    setModalMode('new-goal');
  };

  const openTimeline = (item) => {
    setSelectedActivity(item.atividade);
    setError('');
    setModalMode('timeline');
  };

  const saveMeta = async (event) => {
    event.preventDefault();

    const atividade = form.atividade.trim();
    const meta = Number(form.meta);
    const mes = Number(form.mes);
    const ano = Number(form.ano);

    if (!atividade) return setError('Informe o nome da atividade.');
    if (!Number.isFinite(meta) || meta < 0) return setError('Informe uma meta valida.');
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) return setError('Mes invalido.');
    if (!Number.isInteger(ano) || ano < 2020 || ano > 2100) return setError('Ano invalido.');

    setSaving(true);
    setError('');

    try {
      const payload = {
        atividade,
        meta,
        mes,
        ano,
        usuario: currentUser,
        status: 'ATIVO',
      };

      const saved = await runWithRetry(() =>
        supabase
          .from(TABLE_NAME)
          .upsert(payload, { onConflict: 'atividade,ano,mes' })
          .select('id, atividade, meta, mes, ano, atualizado, usuario, status')
          .single()
      );

      const updatedRows = updateLocalCacheAfterSave(saved);
      setRows(updatedRows);
      setFeedback(
        modalMode === 'new-activity'
          ? 'Atividade criada com sucesso.'
          : 'Nova meta salva com sucesso.'
      );
      closeModalAfterSave();
    } catch (saveError) {
      setError(saveError?.message || 'Nao foi possivel salvar a meta.');
    } finally {
      setSaving(false);
    }
  };

  const forceRefresh = async () => {
    setLoading(true);
    setError('');

    try {
      const refreshed = await loadRows({ force: true });
      setRows(refreshed);
      setFeedback('Dados atualizados.');
    } catch (refreshError) {
      setError(refreshError?.message || 'Nao foi possivel atualizar os dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="equipe-page equipe-metas">
      <div className="equipe-page__toolbar">
        <div>
          <span className="equipe-page__eyebrow">Administracao</span>
          <h2>Metas e atividades</h2>
        </div>

        <div className="equipe-toolbar-actions">
          <button
            type="button"
            className="equipe-button equipe-button--ghost"
            onClick={forceRefresh}
            disabled={isLoading || isSaving}
          >
            Atualizar
          </button>

          <button
            type="button"
            className="equipe-button equipe-button--primary"
            onClick={openNewActivity}
          >
            <span aria-hidden="true">+</span>
            Nova atividade
          </button>
        </div>
      </div>

      {error && !modalMode && (
        <div className="equipe-message is-error">{error}</div>
      )}

      <div className="equipe-panel">
        <div className="equipe-panel__toolbar">
          <label className="equipe-search">
            <span className="sr-only">Buscar atividade</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar atividade"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')} aria-label="Limpar busca">×</button>
            )}
          </label>

          <span className="equipe-panel__count">
            {filteredActivities.length} atividade(s)
          </span>
        </div>

        <div className="equipe-table-scroll">
          <table className="equipe-table">
            <thead>
              <tr>
                <th>Atividade</th>
                <th>Meta vigente</th>
                <th>Inicio da vigencia</th>
                <th>Status</th>
                <th>Atualizado</th>
                <th>Acoes</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr><td colSpan="6" className="equipe-table__empty">Carregando metas...</td></tr>
              ) : filteredActivities.map((item) => (
                <tr key={item.id}>
                  <td className="equipe-table__activity">{item.atividade}</td>
                  <td className="equipe-table__number">{formatNumber(item.meta)}</td>
                  <td>{MONTHS[item.mes - 1]}/{item.ano}</td>
                  <td><span className="equipe-status is-active">ATIVO</span></td>
                  <td>{formatDateTime(item.atualizado)}</td>
                  <td>
                    <div className="equipe-table__actions">
                      <button type="button" className="equipe-action-button" onClick={() => openTimeline(item)}>Linha do tempo</button>
                      <button type="button" className="equipe-action-button is-highlighted" onClick={() => openNewGoal(item)}>Nova meta</button>
                    </div>
                  </td>
                </tr>
              ))}

              {!isLoading && filteredActivities.length === 0 && (
                <tr><td colSpan="6" className="equipe-table__empty">Nenhuma atividade ativa encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {feedback && <div className="equipe-toast">{feedback}</div>}

      {(modalMode === 'new-activity' || modalMode === 'new-goal') && (
        <EquipeModal
          eyebrow={modalMode === 'new-activity' ? 'Cadastro' : 'Nova vigencia'}
          title={modalMode === 'new-activity' ? 'Nova atividade' : selectedActivity}
          onClose={closeModal}
        >
          <form className="equipe-meta-form" onSubmit={saveMeta}>
            <label>
              <span>Atividade</span>
              <input
                value={form.atividade}
                onChange={(event) => setForm((current) => ({ ...current, atividade: event.target.value }))}
                disabled={modalMode === 'new-goal'}
                maxLength="120"
                autoFocus={modalMode === 'new-activity'}
              />
            </label>

            <div className="equipe-meta-form__grid">
              <label>
                <span>Meta</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.meta}
                  onChange={(event) => setForm((current) => ({ ...current, meta: event.target.value }))}
                  autoFocus={modalMode === 'new-goal'}
                />
              </label>

              <label>
                <span>Usuario</span>
                <input value={currentUser} disabled />
              </label>
            </div>

            <div className="equipe-meta-form__grid">
              <label>
                <span>Mes inicial</span>
                <select
                  value={form.mes}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    mes: Number(event.target.value),
                  }))}
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Ano</span>
                <input
                  type="number"
                  min="2020"
                  max="2100"
                  value={form.ano}
                  onChange={(event) => setForm((current) => ({
                    ...current,
                    ano: Number(event.target.value),
                  }))}
                />
              </label>
            </div>

            <p className="equipe-meta-form__note">
              A nova meta passa a valer a partir do periodo informado. A vigencia ativa anterior sera inativada automaticamente pelo banco.
            </p>

            {error && <div className="equipe-message is-error">{error}</div>}

            <footer className="equipe-modal__footer">
              <button type="button" className="equipe-button equipe-button--ghost" onClick={closeModal} disabled={isSaving}>Cancelar</button>
              <button type="submit" className="equipe-button equipe-button--primary" disabled={isSaving}>{isSaving ? 'Salvando...' : 'Salvar meta'}</button>
            </footer>
          </form>
        </EquipeModal>
      )}

      {modalMode === 'timeline' && (
        <EquipeModal eyebrow="Historico de metas" title={selectedActivity} onClose={closeModal} wide>
          <div className="equipe-timeline">
            {timelineRows.map((item, index) => (
              <article className="equipe-timeline__item" key={item.id}>
                <span className="equipe-timeline__marker">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <div className="equipe-timeline__top">
                    <strong>{MONTHS[item.mes - 1]} de {item.ano}</strong>
                    <span className={`equipe-status ${item.status === 'ATIVO' ? 'is-active' : 'is-inactive'}`}>{item.status}</span>
                  </div>
                  <b>Meta {formatNumber(item.meta)}</b>
                  <small>Atualizada em {formatDateTime(item.atualizado)} por {item.usuario || '—'}</small>
                </div>
              </article>
            ))}
          </div>
        </EquipeModal>
      )}
    </section>
  );
};

export default EquipeHomeMetas;
