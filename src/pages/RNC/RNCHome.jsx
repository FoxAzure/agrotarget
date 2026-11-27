import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useRNCAuth } from '../../lib/RNCAuthContext';
import RNCHeader from '../../components/RNC/RNCHeader';
import RNCSideBar from '../../components/RNC/RNCSideBar';
import './RNCHome.css';

const STATUS = {
  PENDENTE: 'PENDENTE',
  ANDAMENTO: 'ANDAMENTO',
  CONCLUIDO: 'CONCLUIDO',
  CONCLUIDO_ATRASO: 'CONCLUIDO_ATRASO',
  ATRASADO: 'ATRASADO',
};

const STATUS_LABELS = {
  PENDENTE: 'Pendente',
  ANDAMENTO: 'Andamento',
  CONCLUIDO: 'Concluído',
  CONCLUIDO_ATRASO: 'Concluído com atraso',
  ATRASADO: 'Atrasado',
};

const EMPTY_FILTERS = {
  id: '',
  campo: '',
  area: '',
  tag: '',
  descricao: '',
  showCompleted: false,
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === '' || value === '[]' || value === '{}') return [];
  if (typeof value === 'number') return [value];
  if (typeof value !== 'string') return [];

  const text = value.trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    if (text.startsWith('{') && text.endsWith('}')) {
      return text
        .slice(1, -1)
        .split(',')
        .map((item) => item.replace(/^"|"$/g, '').trim())
        .filter(Boolean);
    }
    return [text];
  }
};

const brasiliaIso = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(value);

const getPlanStatus = (plan) => {
  if (!plan) return STATUS.PENDENTE;

  if ([STATUS.CONCLUIDO, STATUS.CONCLUIDO_ATRASO].includes(plan.status)) {
    if (plan.dt_conclusao && plan.dt_prazo) {
      return brasiliaIso(new Date(plan.dt_conclusao)) > plan.dt_prazo
        ? STATUS.CONCLUIDO_ATRASO
        : STATUS.CONCLUIDO;
    }
    return plan.status;
  }

  return plan.dt_prazo && plan.dt_prazo < brasiliaIso()
    ? STATUS.ATRASADO
    : STATUS.ANDAMENTO;
};

const getDeadlineInfo = (plan) => {
  if (!plan?.dt_prazo) return { text: 'PRAZO NÃO INFORMADO', tone: 'neutral' };

  if ([STATUS.CONCLUIDO, STATUS.CONCLUIDO_ATRASO].includes(plan.status)) {
    return plan.status === STATUS.CONCLUIDO_ATRASO
      ? { text: 'CONCLUÍDO APÓS O PRAZO', tone: 'warning' }
      : { text: 'CONCLUÍDO DENTRO DO PRAZO', tone: 'success' };
  }

  const today = new Date(`${brasiliaIso()}T12:00:00`);
  const deadline = new Date(`${plan.dt_prazo}T12:00:00`);
  const days = Math.round((deadline - today) / 86400000);

  if (days < 0) {
    const amount = Math.abs(days);
    return {
      text: `${amount} DIA${amount === 1 ? '' : 'S'} EM ATRASO`,
      tone: 'danger',
    };
  }

  if (days === 0) return { text: 'PRAZO VENCE HOJE', tone: 'warning' };

  return {
    text: `${days} DIA${days === 1 ? '' : 'S'} RESTANTE${days === 1 ? '' : 'S'}`,
    tone: days <= 3 ? 'warning' : 'success',
  };
};

const RNCHome = () => {
  const navigate = useNavigate();
  const { user, canCreateRNC, isAdmin } = useRNCAuth();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [records, setRecords] = useState([]);
  const [tagCatalog, setTagCatalog] = useState([]);
  const [areaCatalog, setAreaCatalog] = useState([]);
  const [selected, setSelected] = useState(null);
  const [zoomImage, setZoomImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [error, setError] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const loadRecords = async () => {
    setLoading(true);
    setError('');

    const [recordsResult, plansResult, tagsResult, areasResult] = await Promise.all([
      supabase.rpc('rnc_listar_registros_publico'),
      supabase.rpc('rnc_listar_planos_publico'),
      supabase.from('tb_r_tag').select('id, nome, cor, status').eq('status', 'ativo').order('nome'),
      supabase.from('tb_r_areas').select('id, area, status').eq('status', 'ativo').order('area'),
    ]);

    if (recordsResult.error) {
      setError('Não foi possível carregar as ocorrências.');
      setRecords([]);
    } else {
      const plansByRnc = new Map();

      (plansResult.data || []).forEach((plan) => {
        const rncId = Number(plan.id_rnc);
        if (!plansByRnc.has(rncId)) plansByRnc.set(rncId, plan);
      });

      const normalizedRecords = (recordsResult.data || [])
        .map((item) => {
          const plano = plansByRnc.get(Number(item.id)) || null;

          return {
            ...item,
            tags: toArray(item.tags_detalhes).length
              ? toArray(item.tags_detalhes)
              : toArray(item.tags),
            plano,
            status_rnc: getPlanStatus(plano),
          };
        })
        .sort((a, b) => {
          const dateA = new Date(a.data_criacao || a.data_ocorrencia || 0).getTime();
          const dateB = new Date(b.data_criacao || b.data_ocorrencia || 0).getTime();
          return dateB - dateA || Number(b.id) - Number(a.id);
        });

      setRecords(normalizedRecords);

      if (plansResult.error) {
        setError('As ocorrências foram carregadas, mas os planos de ação não puderam ser consultados.');
      }
    }

    setTagCatalog(tagsResult.data || []);
    setAreaCatalog(areasResult.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (zoomImage) setZoomImage(null);
      else setSelected(null);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [zoomImage]);

  const normalizeTags = (item) => {
    const value = toArray(item?.tags_detalhes).length
      ? toArray(item.tags_detalhes)
      : toArray(item?.tags);

    return value
      .map((tag) => {
        const isObject = tag && typeof tag === 'object' && !Array.isArray(tag);
        const rawId = isObject ? (tag.id ?? tag.tag_id ?? tag.tag) : tag;
        const id = Number(rawId);

        if (!Number.isFinite(id)) return null;

        const catalogTag = tagCatalog.find((entry) => Number(entry.id) === id);

        return {
          id,
          nome: (isObject && (tag.nome || tag.tag_nome)) || catalogTag?.nome || `Tag #${id}`,
          cor: (isObject && tag.cor) || catalogTag?.cor || '#64748B',
        };
      })
      .filter(Boolean)
      .filter((tag, index, list) => list.findIndex((entry) => entry.id === tag.id) === index)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  };

  const statusCounts = useMemo(() => records.reduce((acc, item) => {
    if ([STATUS.CONCLUIDO, STATUS.CONCLUIDO_ATRASO].includes(item.status_rnc)) {
      acc.CONCLUIDO += 1;
    } else {
      acc[item.status_rnc] = (acc[item.status_rnc] || 0) + 1;
    }
    return acc;
  }, { PENDENTE: 0, ANDAMENTO: 0, CONCLUIDO: 0, ATRASADO: 0 }), [records]);

  const filtered = useMemo(() => records.filter((item) => {
    const isCompleted = [STATUS.CONCLUIDO, STATUS.CONCLUIDO_ATRASO].includes(item.status_rnc);

    if (!filters.showCompleted && !statusFilter && isCompleted) return false;
    if (statusFilter === STATUS.CONCLUIDO && !isCompleted) return false;
    if (statusFilter && statusFilter !== STATUS.CONCLUIDO && item.status_rnc !== statusFilter) return false;

    const itemTags = normalizeTags(item);
    const idMatch = !filters.id || String(item.id).includes(filters.id.trim().replace('#', ''));
    const campoMatch = !filters.campo || String(item.campo || '')
      .toLocaleLowerCase('pt-BR')
      .includes(filters.campo.trim().toLocaleLowerCase('pt-BR'));
    const areaMatch = !filters.area || String(item.id_area) === filters.area;
    const tagMatch = !filters.tag || itemTags.some((tag) => String(tag.id) === filters.tag);
    const descriptionMatch = !filters.descricao || String(item.desc_rnc || '')
      .toLocaleLowerCase('pt-BR')
      .includes(filters.descricao.trim().toLocaleLowerCase('pt-BR'));

    return idMatch && campoMatch && areaMatch && tagMatch && descriptionMatch;
  }), [records, filters, statusFilter, tagCatalog]);

  const activeFilters = [filters.id, filters.campo, filters.area, filters.tag, filters.descricao]
    .filter(Boolean).length + (filters.showCompleted ? 1 : 0);

  const imageUrl = (path) => supabase.storage.from('rnc-imagens').getPublicUrl(path).data.publicUrl;

  const formatDate = (value, includeTime = false) => {
    if (!value) return 'Não informada';

    const date = new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(date);
  };

  const renderStatus = (status) => (
    <span className={`rnc-status rnc-status--${status.toLowerCase()}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );

  const renderTags = (item, compact = false) => {
    const tags = normalizeTags(item);
    const visible = compact ? tags.slice(0, 3) : tags;
    const remaining = tags.length - visible.length;

    if (!tags.length) {
      return compact ? <span className="rnc-home__no-tags">Sem tags</span> : null;
    }

    return (
      <div className={`rnc-home__tags${compact ? ' is-compact' : ''}`}>
        {visible.map((tag) => (
          <span key={tag.id} style={{ '--tag-color': tag.cor }}>
            <i />
            {tag.nome}
          </span>
        ))}
        {remaining > 0 && <span className="rnc-home__tags-more">+{remaining}</span>}
      </div>
    );
  };

  const handleRespond = () => {
    if (!user) {
      navigate('/rnc/login');
      return;
    }
    navigate(`/rnc/plano-acao?rnc=${selected.id}`, { state: { rnc: selected } });
  };

  const handleObservation = () => {
    if (!user || !selected?.plano) return;
    navigate(`/rnc/observacao?rnc=${selected.id}&plano=${selected.plano.id}`, {
      state: { rnc: selected },
    });
  };

  const handleConclude = () => {
    if (!user || !selected?.plano) return;
    navigate(`/rnc/concluir?rnc=${selected.id}&plano=${selected.plano.id}`, {
      state: { rnc: selected },
    });
  };

  const handleDeletePlan = async () => {
    if (!user || !isAdmin || !selected?.plano || deletingPlan) return;

    const confirmed = window.confirm(
      `Excluir o plano de ação #${selected.plano.id} da RNC #${selected.id}? A RNC voltará para Pendente.`
    );
    if (!confirmed) return;

    setDeletingPlan(true);
    setError('');

    const { error: deleteError } = await supabase.rpc('rnc_excluir_plano_acao', {
      p_usuario_id: Number(user.id),
      p_plano_id: Number(selected.plano.id),
    });

    if (deleteError) {
      setError(deleteError.message || 'Não foi possível excluir o plano de ação.');
      setDeletingPlan(false);
      return;
    }

    setSelected(null);
    setDeletingPlan(false);
    await loadRecords();
  };

  const toggleStatusFilter = (status) => {
    setStatusFilter((current) => current === status ? null : status);
    if (status === STATUS.CONCLUIDO) {
      setFilters((current) => ({ ...current, showCompleted: true }));
    }
  };

  const clearFilters = () => {
    setStatusFilter(null);
    setFilters(EMPTY_FILTERS);
  };

  return (
    <div className="rnc-home">
      <RNCHeader onMenuOpen={() => setSidebarOpen(true)} />
      <RNCSideBar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="rnc-home__main">
        <section className="rnc-home__welcome">
          <div>
            <span>Qualidade Agrícola</span>
            <h1>Relatórios de Não Conformidade</h1>
            <p>Consulte as ocorrências e acompanhe os respectivos planos de ação.</p>
          </div>
          {canCreateRNC && (
            <button type="button" className="rnc-home__new" onClick={() => navigate('/rnc/nova')}>
              + Nova RNC
            </button>
          )}
        </section>

        <section className="rnc-home__status-cards" aria-label="Filtros por status">
          {[
            [STATUS.PENDENTE, 'Pendentes', statusCounts.PENDENTE],
            [STATUS.ANDAMENTO, 'Andamento', statusCounts.ANDAMENTO],
            [STATUS.CONCLUIDO, 'Concluídos', statusCounts.CONCLUIDO],
            [STATUS.ATRASADO, 'Atrasados', statusCounts.ATRASADO],
          ].map(([status, label, count]) => (
            <button
              type="button"
              key={status}
              className={`rnc-home__status-card rnc-home__status-card--${status.toLowerCase()} ${statusFilter === status ? 'is-active' : ''}`}
              onClick={() => toggleStatusFilter(status)}
              aria-pressed={statusFilter === status}
            >
              <span>{label}</span>
              <strong>{count}</strong>
              <small>{statusFilter === status ? 'Filtro ativo' : 'Filtrar lista'}</small>
            </button>
          ))}
        </section>

        <section className="rnc-home__filters">
          <button
            type="button"
            className="rnc-home__filters-toggle"
            onClick={() => setFiltersOpen((current) => !current)}
            aria-expanded={filtersOpen}
          >
            <span>
              <strong>Filtros da lista</strong>
              <small>{activeFilters ? `${activeFilters} filtro(s) aplicado(s)` : 'Número, campo, área, tag e descrição'}</small>
            </span>
            <b>{filtersOpen ? '−' : '+'}</b>
          </button>

          {filtersOpen && (
            <div className="rnc-home__filters-panel">
              <label>
                <span>Número da RNC</span>
                <input type="search" inputMode="numeric" value={filters.id} onChange={(event) => setFilters({ ...filters, id: event.target.value })} placeholder="Ex.: 1" />
              </label>
              <label>
                <span>Campo</span>
                <input type="search" value={filters.campo} onChange={(event) => setFilters({ ...filters, campo: event.target.value })} placeholder="Nome do campo" />
              </label>
              <label>
                <span>Área</span>
                <select value={filters.area} onChange={(event) => setFilters({ ...filters, area: event.target.value })}>
                  <option value="">Todas as áreas</option>
                  {areaCatalog.map((area) => <option key={area.id} value={area.id}>{area.area}</option>)}
                </select>
              </label>
              <label>
                <span>Tag</span>
                <select value={filters.tag} onChange={(event) => setFilters({ ...filters, tag: event.target.value })}>
                  <option value="">Todas as tags</option>
                  {tagCatalog.map((tag) => <option key={tag.id} value={tag.id}>{tag.nome}</option>)}
                </select>
              </label>
              <label className="rnc-home__filter-description">
                <span>Descrição</span>
                <input type="search" value={filters.descricao} onChange={(event) => setFilters({ ...filters, descricao: event.target.value })} placeholder="Trecho da descrição" />
              </label>
              <label className="rnc-home__filter-check">
                <input type="checkbox" checked={filters.showCompleted} onChange={(event) => setFilters({ ...filters, showCompleted: event.target.checked })} />
                <span>Exibir RNCs concluídas</span>
              </label>
              <button type="button" className="rnc-home__filters-clear" onClick={clearFilters}>Limpar filtros</button>
            </div>
          )}
        </section>

        <section className="rnc-home__records">
          <div className="rnc-home__records-head">
            <div>
              <h2>Ocorrências</h2>
              <span>{filtered.length} de {records.length} registros</span>
            </div>
            <button type="button" className="rnc-home__refresh" onClick={loadRecords} disabled={loading}>Atualizar</button>
          </div>

          {error && <div className="rnc-home__error">{error}</div>}

          {loading ? (
            <div className="rnc-home__empty">Carregando ocorrências...</div>
          ) : filtered.length === 0 ? (
            <div className="rnc-home__empty">Nenhuma ocorrência encontrada.</div>
          ) : (
            <div className="rnc-home__record-list">
              {filtered.map((item) => {
                const firstImage = item.imagens?.[0];
                return (
                  <button type="button" className="rnc-home__record" key={item.id} onClick={() => setSelected(item)}>
                    <div className="rnc-home__record-number"><strong>#{item.id}</strong></div>
                    <div className="rnc-home__record-thumb">
                      {firstImage ? <img src={imageUrl(firstImage)} alt="" loading="lazy" /> : <span>Sem foto</span>}
                    </div>
                    <div className="rnc-home__record-content">
                      <div className="rnc-home__record-title">
                        <strong>{item.campo || 'Campo não informado'}</strong>
                        <div className="rnc-home__record-state">
                          {renderStatus(item.status_rnc)}
                          <time dateTime={item.data_ocorrencia || undefined}>{formatDate(item.data_ocorrencia)}</time>
                        </div>
                      </div>
                      <div className="rnc-home__record-subtitle">
                        <span>{item.area || 'Área não informada'}</span>
                        {item.responsavel && <span>Responsável: {item.responsavel}</span>}
                      </div>
                      <p>{item.desc_rnc}</p>
                      {renderTags(item, true)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {selected && (
        <div className="rnc-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="rnc-modal" role="dialog" aria-modal="true" aria-label={`Detalhes da RNC ${selected.id}`}>
            <div className="rnc-modal__head">
              <div className="rnc-modal__head-number"><strong>#{selected.id}</strong></div>
              <div className="rnc-modal__head-title">
                <span>Detalhes da ocorrência</span>
                <h2>{selected.campo || 'Não conformidade'}</h2>
              </div>
              <div className="rnc-modal__head-actions">
                <button type="button" className="rnc-modal__report" onClick={() => navigate(`/rnc/relatorios?rnc=${selected.id}`, { state: { rnc: selected } })}>Relatório</button>
                <button type="button" className="rnc-modal__close" onClick={() => setSelected(null)} aria-label="Fechar">×</button>
              </div>
            </div>

            <div className="rnc-modal__body">
              <div className="rnc-modal__status-line">
                {renderStatus(selected.status_rnc)}
                <span>Ocorrência em {formatDate(selected.data_ocorrencia)}</span>
              </div>

              {normalizeTags(selected).length > 0 && (
                <section className="rnc-modal__tags-section">
                  <b>Tags da ocorrência</b>
                  {renderTags(selected)}
                </section>
              )}

              <div className="rnc-modal__info">
                <span><b>Área</b>{selected.area || 'Não informada'}</span>
                <span><b>Data da ocorrência</b>{formatDate(selected.data_ocorrencia)}</span>
                <span><b>Responsável RNC</b><em>{selected.responsavel || 'Não informado'}</em></span>
                <span><b>Registrado por</b><em>{selected.usuario_criacao || 'Não informado'}</em></span>
              </div>

              <div className="rnc-modal__description">
                <b>Descrição</b>
                <p>{selected.desc_rnc}</p>
              </div>

              <div className="rnc-modal__photos">
                <div className="rnc-modal__section-title">
                  <b>Imagens da ocorrência</b>
                  <span>{selected.imagens?.length || 0}/3</span>
                </div>
                {selected.imagens?.length ? (
                  <div className="rnc-modal__photo-grid">
                    {selected.imagens.map((path, index) => {
                      const url = imageUrl(path);
                      return (
                        <button type="button" key={path} onClick={() => setZoomImage(url)}>
                          <img src={url} alt={`RNC ${selected.id}, imagem ${index + 1}`} loading="lazy" />
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rnc-modal__no-photo">Nenhuma imagem anexada.</div>
                )}
              </div>

              <section className={`rnc-modal__plan ${selected.plano ? 'has-plan' : 'no-plan'}`}>
                <div className="rnc-modal__plan-head">
                  <div>
                    <span>Tratativa da ocorrência</span>
                    <h3>Plano de ação</h3>
                  </div>
                  {renderStatus(selected.status_rnc)}
                </div>

                {selected.plano ? (
                  <>
                    <div className="rnc-modal__plan-main">
                      <article>
                        <small>Causa identificada</small>
                        <p>{selected.plano.desc_causa}</p>
                      </article>
                      <article>
                        <small>Ação definida</small>
                        <p>{selected.plano.desc_acao}</p>
                      </article>
                    </div>

                    <div className="rnc-modal__plan-summary">
                      <div>
                        <small>Responsável pela ação</small>
                        <strong>{selected.plano.responsavel || 'Não informado'}</strong>
                      </div>
                      <div>
                        <small>Prazo</small>
                        <strong>{formatDate(selected.plano.dt_prazo)}</strong>
                      </div>
                      <div className={`rnc-modal__deadline is-${getDeadlineInfo(selected.plano).tone}`}>
                        <small>Situação do prazo</small>
                        <strong>{getDeadlineInfo(selected.plano).text}</strong>
                      </div>
                      <div>
                        <small>Última atualização</small>
                        <strong>{formatDate(selected.plano.dt_atualizacao, true)}</strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rnc-modal__plan-empty">
                    <strong>Plano de ação pendente</strong>
                    <p>Esta RNC ainda não possui causa, ação corretiva, responsável e prazo definidos.</p>
                  </div>
                )}
              </section>
            </div>

            <div className="rnc-modal__actions">
              {user && !selected.plano && <button type="button" className="is-plan" onClick={handleRespond}>Responder</button>}
              {user && selected.plano && (
                <>
                  <button type="button" className="is-plan" onClick={handleObservation}>Observações</button>
                  <button type="button" className="is-primary" onClick={handleConclude}>Concluir RNC</button>
                </>
              )}
              {isAdmin && selected.plano && (
                <button type="button" className="is-danger" onClick={handleDeletePlan} disabled={deletingPlan}>
                  {deletingPlan ? 'Excluindo...' : 'Excluir plano'}
                </button>
              )}
              {canCreateRNC && <button type="button" onClick={() => navigate(`/rnc/editar/${selected.id}`)}>Editar RNC</button>}
              <button type="button" onClick={() => setSelected(null)} disabled={deletingPlan}>Fechar</button>
            </div>
          </section>
        </div>
      )}

      {zoomImage && (
        <div className="rnc-lightbox" onClick={() => setZoomImage(null)}>
          <button type="button" onClick={() => setZoomImage(null)}>×</button>
          <img src={zoomImage} alt="Imagem ampliada da RNC" />
        </div>
      )}
    </div>
  );
};

export default RNCHome;
