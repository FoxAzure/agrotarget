// ================================= DOCUMENTATION ------------------------------------------
// Script: PreparoDetailCampos
// Purpose: Historico anual dos campos avaliados no Preparo de Solo.
// Relationships:
//   - vw_q_preparo_campo
//   - vw_q_preparo_geral
//   - vw_q_preparo_ano
//   - YearSelectorQualyFlow
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import YearSelectorQualyFlow from '../../../components/QualyFlow/YearSelectorQualyFlow';

// ================================= CONFIGURACOES ------------------------------------------

const DETAIL_LAYOUT = {
  fontBase: 12,
  fontTitle: 12,
  fontHeader: 9,
  fontValue: 11,
  fontSmall: 9,
  modalFontTitle: 14,
  modalFontHeader: 9,
  modalFontValue: 11,
  modalFontSmall: 9,
  mobileFontBase: 12,
  mobileFontTitle: 13,
  mobileFontHeader: 10,
  mobileFontValue: 12,
  mobileFontSmall: 10,
  mobileModalFontTitle: 14,
  mobileModalFontHeader: 9,
  mobileModalFontValue: 11,
  mobileModalFontSmall: 9,
};

const COLORS = { good: '#22c55e', warning: '#f59e0b', danger: '#ef4444', muted: '#94a3b8' };

const METRICS = [
  { key: 'profund_haste', label: 'Haste', fullLabel: 'Profundidade da Haste', target: 'Minimo 23 cm', meta: 90, attention: 80, decimals: 0, averageDecimals: 1, compliance: value => Number.isFinite(value) && value >= 23 },
  { key: 'profund_cana', label: 'Cana', fullLabel: 'Profundidade da Cana', target: 'Minimo 18 cm', meta: 90, attention: 80, decimals: 0, averageDecimals: 1, compliance: value => Number.isFinite(value) && value >= 18 },
  { key: 'paralelismo_sulco', label: 'P. Sulco', fullLabel: 'Paralelismo entre Sulcos', target: 'Entre 1,45 e 1,55', meta: 80, attention: 70, decimals: 2, averageDecimals: 2, compliance: value => Number.isFinite(value) && value >= 1.45 && value <= 1.55 },
  { key: 'paralelismo_fita', label: 'P. Fita', fullLabel: 'Paralelismo entre Fitas', target: 'Entre 2,15 e 2,25', meta: 80, attention: 70, decimals: 2, averageDecimals: 2, compliance: value => Number.isFinite(value) && value >= 2.15 && value <= 2.25 },
  { key: 'profund_fita', label: 'Prof. F.', fullLabel: 'Profundidade da Fita', target: 'Minimo 18 cm', meta: 90, attention: 80, decimals: 0, averageDecimals: 1, compliance: value => Number.isFinite(value) && value >= 18 },
];

// ================================= HELPERS ------------------------------------------------

const asArray = value => Array.isArray(value) ? value : [];
const num = (value, fallback = null) => { if (value === null || value === undefined || value === '') return fallback; const parsed = Number(String(value).replace(',', '.')); return Number.isFinite(parsed) ? parsed : fallback; };
const text = (value, fallback = '') => String(value ?? '').trim() || fallback;
const normalizeText = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const formatValue = (value, decimals = 1) => { const numeric = num(value); return numeric === null ? '—' : numeric.toFixed(decimals).replace('.', ','); };
const formatPercent = value => { const numeric = num(value); return numeric === null ? '—' : `${numeric.toFixed(1).replace('.', ',')}%`; };
const formatDate = value => { if (!value) return '—'; const parts = String(value).slice(0, 10).split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value; };
const resultColor = (value, metric) => { const numeric = num(value); if (numeric === null) return COLORS.muted; if (numeric >= metric.meta) return COLORS.good; if (numeric >= metric.attention) return COLORS.warning; return COLORS.danger; };
const resultSoft = (value, metric) => { const numeric = num(value); if (numeric === null) return '#f1f5f9'; if (numeric >= metric.meta) return '#eaf7ed'; if (numeric >= metric.attention) return '#fff7df'; return '#fdecec'; };
const normalizeInitialYear = value => { const numeric = Number(value); return Number.isInteger(numeric) && numeric >= 2000 ? numeric : new Date().getFullYear(); };
const dateTime = value => { if (!value) return 0; const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00`).getTime(); return Number.isFinite(parsed) ? parsed : 0; };

const buildLotDetails = rows => {
  const map = new Map();
  rows.forEach(row => {
    const lot = text(row.lote, '—');
    if (!map.has(lot)) map.set(lot, { lot, rows: [] });
    map.get(lot).rows.push(row);
  });
  return [...map.values()].map(group => ({ ...group, rows: group.rows.slice().sort((a, b) => num(a.ponto, 999999) - num(b.ponto, 999999)) })).sort((a, b) => a.lot.localeCompare(b.lot, 'pt-BR', { numeric: true }));
};

// ================================= COMPONENTES VISUAIS ------------------------------------

function MetricTabs({ selectedKey, onSelect, annualRow }) {
  return (
    <nav className="qf-preparo-field-tabs" aria-label="Indicadores do campo">
      {METRICS.map(metric => (
        <button type="button" key={metric.key} className={selectedKey === metric.key ? 'is-active' : ''} onClick={() => onSelect(metric.key)}>
          <span>{metric.label}</span>
          <b style={{ color: resultColor(annualRow?.[metric.key], metric) }}>{formatPercent(annualRow?.[metric.key])}</b>
        </button>
      ))}
    </nav>
  );
}

function FieldFilters({ search, onSearch, depa, onDepa, setor, onSetor, depas, setores, resultCount, onClear }) {
  const hasFilters = Boolean(search || depa || setor);
  return (
    <section className="qf-preparo-field-filters" aria-label="Busca e filtros dos campos">
      <label className="qf-preparo-field-search">
        <span aria-hidden="true">⌕</span>
        <input value={search} onChange={event => onSearch(event.target.value)} placeholder="Buscar campo, codigo ou lote..." aria-label="Buscar campo, codigo ou lote" />
        {search && <button type="button" onClick={() => onSearch('')} aria-label="Limpar busca">×</button>}
      </label>
      <label className="qf-preparo-field-filter-select"><small>DEPA</small><select value={depa} onChange={event => onDepa(event.target.value)}><option value="">Todos</option>{depas.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="qf-preparo-field-filter-select"><small>Setor</small><select value={setor} onChange={event => onSetor(event.target.value)}><option value="">Todos</option>{setores.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
      <div className="qf-preparo-field-filter-result"><b>{resultCount}</b><span>campo(s)</span>{hasFilters && <button type="button" onClick={onClear}>Limpar</button>}</div>
    </section>
  );
}

function MobileFieldCard({ row, metric, onOpen }) {
  const value = num(row[metric.key]);
  const average = num(row[`${metric.key}_media`]);
  const standard = num(row[`${metric.key}_padrao`], 0);
  const evaluated = num(row[`${metric.key}_avaliadas`], 0);
  const width = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <button type="button" className="qf-preparo-field-mobile-card" onClick={onOpen}>
      <div className="qf-preparo-field-mobile-head"><span><strong>{row.campo}</strong><small>{row.setor} • {row.lotes_avaliados} lote(s) • {formatDate(row.data_max)}</small></span><b style={{ color: resultColor(value, metric) }}>{formatPercent(value)}</b></div>
      <div className="qf-preparo-field-progress"><i style={{ width: `${width}%`, background: resultColor(value, metric) }} /></div>
      <div className="qf-preparo-field-mobile-footer"><span>Media: <b>{formatValue(average, metric.averageDecimals)}</b></span><span>Padrao: <b>{standard} / {evaluated}</b></span></div>
    </button>
  );
}

function DesktopFieldRow({ row, onOpen }) {
  return (
    <button type="button" className="qf-preparo-field-desktop-row" onClick={onOpen}>
      <span className="qf-preparo-field-desktop-info"><strong>{row.campo}</strong><small>{row.setor} • {row.lotes_avaliados} lote(s) • {row.pontos} ponto(s) • ultima {formatDate(row.data_max)}</small></span>
      {METRICS.map(metric => { const value = num(row[metric.key]); return <span key={metric.key} className="qf-preparo-field-desktop-kpi" style={{ background: resultSoft(value, metric) }}><small>{metric.label}</small><b style={{ color: resultColor(value, metric) }}>{formatPercent(value)}</b></span>; })}
      <i>›</i>
    </button>
  );
}

function FieldDetailModal({ field, rows, loading, error, selectedMetricKey, onMetricChange, annualRow, onClose }) {
  const [openLot, setOpenLot] = useState('');
  const metric = METRICS.find(item => item.key === selectedMetricKey) || METRICS[0];
  const lots = useMemo(() => buildLotDetails(rows), [rows]);
  useEffect(() => { if (lots.length && !lots.some(item => item.lot === openLot)) setOpenLot(lots[0].lot); }, [lots, openLot]);
  if (!field) return null;
  return (
    <div className="qf-preparo-field-modal-backdrop" onClick={onClose} role="presentation">
      <section className="qf-preparo-field-modal" role="dialog" aria-modal="true" aria-label={`Detalhes do campo ${field.campo}`} onClick={event => event.stopPropagation()}>
        <header><div><span>{field.codigo_campo} • {field.setor}</span><strong>{field.campo}</strong><small>{field.lotes_avaliados} lote(s) • {field.pontos} ponto(s) • {formatDate(field.data_min)} a {formatDate(field.data_max)}</small></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>
        <main>
          <MetricTabs selectedKey={selectedMetricKey} onSelect={onMetricChange} annualRow={annualRow} />
          <div className="qf-preparo-field-modal-summary"><span><small>Indicador</small><b>{metric.fullLabel}</b></span><span><small>Resultado</small><b style={{ color: resultColor(field[metric.key], metric) }}>{formatPercent(field[metric.key])}</b></span><span><small>Media</small><b>{formatValue(field[`${metric.key}_media`], metric.averageDecimals)}</b></span><span><small>Padrao</small><b>{field[`${metric.key}_padrao`] || 0} / {field[`${metric.key}_avaliadas`] || 0}</b></span></div>
          {loading ? <div className="qf-preparo-field-modal-state">Carregando pontos do campo...</div> : error ? <div className="qf-preparo-field-modal-state is-error">{error}</div> : lots.length ? (
            <div className="qf-preparo-field-lots">{lots.map(lot => { const isOpen = lot.lot === openLot; const validValues = lot.rows.map(row => num(row[metric.key])).filter(value => value !== null && value !== 0); const standard = validValues.filter(metric.compliance).length; const percent = validValues.length ? (standard / validValues.length) * 100 : null; return (
              <article key={lot.lot} className={`qf-preparo-field-lot ${isOpen ? 'is-open' : ''}`}>
                <button type="button" onClick={() => setOpenLot(isOpen ? '' : lot.lot)}><span><strong>Lote {lot.lot}</strong><small>{validValues.length} avaliacao(oes)</small></span><b style={{ color: resultColor(percent, metric) }}>{formatPercent(percent)}</b><i>{isOpen ? '−' : '+'}</i></button>
                {isOpen && <div className="qf-preparo-field-blocks">{Array.from({ length: Math.ceil(validValues.length / 12) }, (_, blockIndex) => { const block = lot.rows.map(row => ({ sourcePoint: num(row.ponto), value: num(row[metric.key]) })).filter(item => item.value !== null && item.value !== 0).sort((a, b) => (a.sourcePoint ?? 999999) - (b.sourcePoint ?? 999999)).slice(blockIndex * 12, blockIndex * 12 + 12); return (
                  <section key={`${lot.lot}-block-${blockIndex}`} className="qf-preparo-field-block"><header><strong>Amostra {blockIndex + 1}</strong><small>{block.length} ponto(s)</small></header><div className="qf-preparo-field-points">{Array.from({ length: 12 }, (_, pointIndex) => { const item = block[pointIndex]; return item ? <div key={pointIndex + 1} className={metric.compliance(item.value) ? 'is-good' : 'is-bad'} title={`Ponto original ${item.sourcePoint ?? '—'}`}><small>P{pointIndex + 1}</small><b>{formatValue(item.value, metric.decimals)}</b></div> : <div key={pointIndex + 1} className="is-empty"><small>P{pointIndex + 1}</small><b>—</b></div>; })}</div></section>
                ); })}</div>}
              </article>
            ); })}</div>
          ) : <div className="qf-preparo-field-modal-state">Nenhum ponto encontrado para este campo.</div>}
        </main>
      </section>
    </div>
  );
}

// ================================= COMPONENTE PRINCIPAL -----------------------------------

const PreparoDetailCampos = ({ initialYear }) => {
  const [activeYear, setActiveYear] = useState(normalizeInitialYear(initialYear));
  const [availableYears, setAvailableYears] = useState([]);
  const [fields, setFields] = useState([]);
  const [annualRow, setAnnualRow] = useState(null);
  const [selectedMetricKey, setSelectedMetricKey] = useState('profund_haste');
  const [selectedField, setSelectedField] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDepa, setSelectedDepa] = useState('');
  const [selectedSetor, setSelectedSetor] = useState('');

  useEffect(() => { let mounted = true; const loadYears = async () => { const response = await supabase.from('vw_q_preparo_campo').select('ano'); if (!mounted) return; if (response.error) { setError(response.error.message || 'Erro ao consultar os anos.'); return; } const years = [...new Set(asArray(response.data).map(row => num(row.ano)).filter(Boolean))].sort((a, b) => b - a); setAvailableYears(years); if (years.length && !years.includes(activeYear)) setActiveYear(years[0]); }; loadYears(); return () => { mounted = false; }; }, []);

  useEffect(() => { if (!activeYear) return; let mounted = true; const loadFields = async () => { setLoading(true); setError(''); setSelectedField(null); const [fieldsResponse, annualResponse] = await Promise.all([supabase.from('vw_q_preparo_campo').select('*').eq('ano', activeYear).order('data_max', { ascending: false, nullsFirst: false }).order('campo', { ascending: true }), supabase.from('vw_q_preparo_ano').select('*').eq('ano', activeYear).maybeSingle()]); if (!mounted) return; if (fieldsResponse.error) { setError(fieldsResponse.error.message || 'Erro ao consultar vw_q_preparo_campo.'); setFields([]); setAnnualRow(null); } else { setFields(asArray(fieldsResponse.data)); setAnnualRow(annualResponse.error ? null : (annualResponse.data || null)); } setLoading(false); }; loadFields(); return () => { mounted = false; }; }, [activeYear]);

  useEffect(() => { setSearch(''); setSelectedDepa(''); setSelectedSetor(''); }, [activeYear]);

  const openField = async field => { setSelectedField(field); setDetailRows([]); setDetailLoading(true); setDetailError(''); const response = await supabase.from('vw_q_preparo_geral').select('ano,codigo_campo,campo,setor,lote,ponto,profund_haste,profund_cana,paralelismo_sulco,paralelismo_fita,profund_fita').eq('ano', activeYear).eq('codigo_campo', field.codigo_campo).order('lote', { ascending: true }).order('ponto', { ascending: true }); if (response.error) { setDetailError(response.error.message || 'Erro ao carregar os pontos do campo.'); setDetailRows([]); } else setDetailRows(asArray(response.data)); setDetailLoading(false); };

  const selectedMetric = METRICS.find(metric => metric.key === selectedMetricKey) || METRICS[0];
  const depas = useMemo(() => [...new Set(fields.map(row => text(row.depa)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })), [fields]);
  const setores = useMemo(() => [...new Set(fields.filter(row => !selectedDepa || text(row.depa) === selectedDepa).map(row => text(row.setor)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })), [fields, selectedDepa]);

  useEffect(() => { if (selectedSetor && !setores.includes(selectedSetor)) setSelectedSetor(''); }, [setores, selectedSetor]);

  const filteredFields = useMemo(() => { const query = normalizeText(search); return fields.filter(row => { const matchesDepa = !selectedDepa || text(row.depa) === selectedDepa; const matchesSetor = !selectedSetor || text(row.setor) === selectedSetor; const searchable = normalizeText([row.codigo_campo, row.campo, row.setor, row.depa, row.lotes].filter(Boolean).join(' ')); return matchesDepa && matchesSetor && (!query || searchable.includes(query)); }).slice().sort((a, b) => dateTime(b.data_max) - dateTime(a.data_max) || text(a.campo).localeCompare(text(b.campo), 'pt-BR', { numeric: true })); }, [fields, search, selectedDepa, selectedSetor]);
  const visibleFields = useMemo(() => filteredFields.filter(row => num(row[`${selectedMetric.key}_avaliadas`], 0) > 0), [filteredFields, selectedMetric]);
  const clearFilters = () => { setSearch(''); setSelectedDepa(''); setSelectedSetor(''); };

  const styleVars = { '--preparo-field-font-base': `${DETAIL_LAYOUT.fontBase}px`, '--preparo-field-font-title': `${DETAIL_LAYOUT.fontTitle}px`, '--preparo-field-font-header': `${DETAIL_LAYOUT.fontHeader}px`, '--preparo-field-font-value': `${DETAIL_LAYOUT.fontValue}px`, '--preparo-field-font-small': `${DETAIL_LAYOUT.fontSmall}px`, '--preparo-field-modal-font-title': `${DETAIL_LAYOUT.modalFontTitle}px`, '--preparo-field-modal-font-header': `${DETAIL_LAYOUT.modalFontHeader}px`, '--preparo-field-modal-font-value': `${DETAIL_LAYOUT.modalFontValue}px`, '--preparo-field-modal-font-small': `${DETAIL_LAYOUT.modalFontSmall}px`, '--preparo-field-mobile-font-base': `${DETAIL_LAYOUT.mobileFontBase}px`, '--preparo-field-mobile-font-title': `${DETAIL_LAYOUT.mobileFontTitle}px`, '--preparo-field-mobile-font-header': `${DETAIL_LAYOUT.mobileFontHeader}px`, '--preparo-field-mobile-font-value': `${DETAIL_LAYOUT.mobileFontValue}px`, '--preparo-field-mobile-font-small': `${DETAIL_LAYOUT.mobileFontSmall}px`, '--preparo-field-mobile-modal-font-title': `${DETAIL_LAYOUT.mobileModalFontTitle}px`, '--preparo-field-mobile-modal-font-header': `${DETAIL_LAYOUT.mobileModalFontHeader}px`, '--preparo-field-mobile-modal-font-value': `${DETAIL_LAYOUT.mobileModalFontValue}px`, '--preparo-field-mobile-modal-font-small': `${DETAIL_LAYOUT.mobileModalFontSmall}px` };

  return (
    <div className="qf-preparo-field-page" style={styleVars}>
      <div className="qf-preparo-field-year-selector"><YearSelectorQualyFlow value={activeYear} onChange={setActiveYear} availableYears={availableYears} isLoading={loading} /></div>
      <FieldFilters search={search} onSearch={setSearch} depa={selectedDepa} onDepa={setSelectedDepa} setor={selectedSetor} onSetor={setSelectedSetor} depas={depas} setores={setores} resultCount={filteredFields.length} onClear={clearFilters} />
      <div className="qf-preparo-field-mobile-tabs"><MetricTabs selectedKey={selectedMetricKey} onSelect={setSelectedMetricKey} annualRow={annualRow} /></div>
      {error && <div className="qf-preparo-field-state is-error"><strong>Nao foi possivel carregar os campos.</strong><span>{error}</span></div>}
      {loading ? <div className="qf-preparo-field-state">Carregando campos da safra...</div> : !error && fields.length ? (
        <div className="qf-preparo-field-content">
          <div className="qf-preparo-field-desktop-head"><span>Campo</span>{METRICS.map(metric => <span key={metric.key}>{metric.label}</span>)}<span /></div>
          <div className="qf-preparo-field-desktop-list">{filteredFields.map(row => <DesktopFieldRow key={`${row.ano}-${row.codigo_campo}`} row={row} onOpen={() => openField(row)} />)}</div>
          <div className="qf-preparo-field-mobile-list">{visibleFields.map(row => <MobileFieldCard key={`${row.ano}-${row.codigo_campo}`} row={row} metric={selectedMetric} onOpen={() => openField(row)} />)}</div>
          {!filteredFields.length && <div className="qf-preparo-field-state">Nenhum campo encontrado com os filtros informados.</div>}
          {filteredFields.length > 0 && !visibleFields.length && <div className="qf-preparo-field-state">Nenhum campo avaliado para {selectedMetric.label} em {activeYear}.</div>}
        </div>
      ) : !error ? <div className="qf-preparo-field-state">Nenhum campo disponivel para {activeYear}.</div> : null}
      <FieldDetailModal field={selectedField} rows={detailRows} loading={detailLoading} error={detailError} selectedMetricKey={selectedMetricKey} onMetricChange={setSelectedMetricKey} annualRow={annualRow} onClose={() => setSelectedField(null)} />
    </div>
  );
};

export default PreparoDetailCampos;
