// ================================= DOCUMENTATION ------------------------------------------
// Script: PlantioMecDetailDiario
// Purpose: Detalhamento diario responsivo das avaliacoes do Plantio Mecanizado.
// Relationships:
//   - vw_q_plantiomec_detalhe
//   - vw_q_plantiomec_gemas
//   - vw_q_plantiomec_coberta
//   - vw_q_plantiomec_profundidade
//   - vw_q_plantiomec_paralelismo (opcional)
//   - DateSelectorQualyFlow
//   - rulesPlantioMec.js
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DateSelectorQualyFlow from '../../../components/QualyFlow/DateSelectorQualyFlow';
import {
  getRegraHistogramaParaData,
  getFaixaGemas,
  getCorFaixaGemas,
} from '../../../components/QualyFlow/rulesPlantioMec';

// ================================= CONFIGURACOES ------------------------------------------

const DETAIL_LAYOUT = {
  fontBase: 12,
  fontTitle: 12,
  fontHeader: 12,
  fontTable: 12,
  fontValue: 12,
  fontSmall: 10,
  donutRadius: 48,
  donutSize: 144,
};

const COLORS = {
  good: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  muted: '#94a3b8',
  blue: '#1677ff',
};

// ================================= HELPERS ------------------------------------------------

const asArray = value => Array.isArray(value) ? value : [];
const num = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const text = (value, fallback = '') => String(value ?? '').trim() || fallback;
const formatValue = (value, decimals = 1) => {
  const numeric = num(value);
  return numeric === null ? '—' : numeric.toFixed(decimals).replace('.', ',');
};
const formatPercent = (value, decimals = 1) => {
  const numeric = num(value);
  return numeric === null ? '—' : `${(numeric <= 1 ? numeric * 100 : numeric).toFixed(decimals).replace('.', ',')}%`;
};
const safeRatio = (numerator, denominator) => {
  const top = num(numerator, 0);
  const bottom = num(denominator, 0);
  return bottom > 0 ? top / bottom : null;
};
const normalizeInitialDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
const fieldKey = row => text(row.codigo_campo, text(row.campo, 'SEM-CAMPO'));
const pointKey = row => [fieldKey(row), text(row.lote, '—'), text(row.turno, '—'), num(row.ponto, 1)].join('|');
const sortSamples = rows => [...rows].sort((a, b) => num(a.amostra, 0) - num(b.amostra, 0));
const gemStatus = (value, rule) => getFaixaGemas(value, rule)?.status || 'neutral';
const qualityStatus = (type, value) => {
  const numeric = num(value);
  if (numeric === null) return 'neutral';
  if (type === 'coberta') return numeric >= 5 && numeric <= 8 ? 'good' : 'danger';
  if (type === 'profundidade') return numeric >= 18 ? 'good' : 'danger';
  if (type === 'paralelismo') return numeric >= 1.45 && numeric <= 1.55 ? 'good' : 'danger';
  return 'neutral';
};
const qualityValue = (row, type) => {
  if (!row) return null;
  if (type === 'coberta') return num(row.coberta_media_plantio);
  if (type === 'profundidade') return num(row.profundidade);
  return num(row.paralelismo ?? row.paralelismo_medio ?? row.distancia);
};
const qualityRule = type => type === 'coberta' ? '5 a 8 cm' : type === 'profundidade' ? '18 cm ou mais' : '1,45 a 1,55 m';
const qualityUnit = type => type === 'paralelismo' ? 'm' : 'cm';

const summarizeDetails = rows => rows.reduce((acc, row) => {
  acc.gemasTotais += num(row.gemas_totais, 0);
  acc.gemasViaveis += num(row.gemas_viaveis, 0);
  acc.gemasDanificadas += num(row.gemas_danificadas, 0);
  acc.falhaAvaliado += num(row.falha_avaliado, 0);
  acc.falhaMetro += num(row.falha_metro, 0);
  return acc;
}, { gemasTotais: 0, gemasViaveis: 0, gemasDanificadas: 0, falhaAvaliado: 0, falhaMetro: 0 });

const buildFields = rows => {
  const map = new Map();
  rows.forEach(row => {
    const key = fieldKey(row);
    if (!map.has(key)) map.set(key, { key, codigo_campo: text(row.codigo_campo, '—'), campo: text(row.campo, key), setor: text(row.setor, '—'), depa: text(row.depa, '—'), rows: [] });
    map.get(key).rows.push(row);
  });
  return [...map.values()].map(field => ({ ...field, ...summarizeDetails(field.rows) })).sort((a, b) => a.campo.localeCompare(b.campo, 'pt-BR', { numeric: true }));
};

const buildPoints = rows => {
  const map = new Map();
  rows.forEach(row => {
    const key = pointKey(row);
    if (!map.has(key)) map.set(key, { key, codigo_campo: fieldKey(row), campo: text(row.campo), lote: text(row.lote, '—'), turno: text(row.turno, '—'), ponto: num(row.ponto, 1), samples: [] });
    map.get(key).samples.push(row);
  });
  return [...map.values()].map(point => ({ ...point, samples: sortSamples(point.samples) })).sort((a, b) => String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true }) || a.turno.localeCompare(b.turno, 'pt-BR', { numeric: true }) || a.ponto - b.ponto);
};

const buildHistogram = (rows, rule) => {
  const values = rows.map(row => num(row.gemas_viaveis)).filter(value => value !== null);
  const ranges = asArray(rule?.faixas).map(range => ({ ...range, count: values.filter(value => value >= range.min && (range.max === null || value <= range.max)).length }));
  return { ranges, evaluated: values.length, max: Math.max(1, ...ranges.map(range => range.count)) };
};

// ================================= COMPONENTES VISUAIS ------------------------------------

function Donut({ value, color, label }) {
  const safe = Math.max(0, Math.min(1, num(value, 0)));
  const radius = DETAIL_LAYOUT.donutRadius;
  const circumference = 2 * Math.PI * radius;
  return <div className="qf-pmd-donut-wrap"><svg viewBox="0 0 120 120" style={{ width: DETAIL_LAYOUT.donutSize, height: DETAIL_LAYOUT.donutSize }} aria-hidden="true"><circle cx="60" cy="60" r={radius} className="qf-pmd-donut-track" /><circle cx="60" cy="60" r={radius} className="qf-pmd-donut-value" stroke={color} strokeDasharray={circumference} strokeDashoffset={circumference - safe * circumference} /></svg><div className="qf-pmd-donut-center"><strong style={{ color }}>{formatPercent(safe)}</strong><small>{label}</small></div></div>;
}

function SummaryTable({ rows }) {
  return <div className="qf-pmd-summary-table">{rows.map(row => <div key={row.label}><span>{row.label}</span><strong className={row.className || ''}>{row.value}</strong></div>)}</div>;
}

function FieldFilter({ fields, selected, onToggle }) {
  return <section className="qf-pmd-field-filter"><div className="qf-pmd-filter-head"><strong>Campos avaliados</strong><span>{selected.length} de {fields.length} selecionado(s)</span></div><div className="qf-pmd-field-list">{fields.map(field => { const active = selected.includes(field.key); const percent = safeRatio(field.gemasViaveis, field.gemasTotais); return <button type="button" key={field.key} className={active ? 'is-selected' : ''} onClick={() => onToggle(field.key)}><span><b>{field.campo}</b><small>{field.codigo_campo} • {field.setor}</small></span><em><small>Gemas</small><b style={{ color: percent === null ? COLORS.muted : percent >= .8 ? COLORS.good : percent >= .7 ? COLORS.warning : COLORS.danger }}>{formatPercent(percent)}</b></em></button>; })}</div></section>;
}

function PointAccordion({ points, openKeys, onToggle, rule }) {
  return <section className="qf-pmd-card"><div className="qf-pmd-section-head"><strong>Ponto a ponto</strong><span>{points.length} ponto(s)</span></div><div className="qf-pmd-point-list">{points.map(point => { const opened = openKeys.includes(point.key); const samples = Array.from({ length: 12 }, (_, index) => point.samples.find(row => num(row.amostra) === index + 1)); return <article className={`qf-pmd-point ${opened ? 'is-open' : ''}`} key={point.key}><button type="button" className="qf-pmd-point-toggle" onClick={() => onToggle(point.key)}><span><b>Lote {point.lote} • P{point.ponto}</b><small>{point.campo} • {point.turno}</small></span><i>{opened ? '−' : '+'}</i></button>{opened && <div className="qf-pmd-point-content"><div className="qf-pmd-sample-labels"><span>Indicador</span>{samples.map((_, index) => <b key={index}>{index + 1}</b>)}</div><div className="qf-pmd-sample-row"><strong>Totais</strong>{samples.map((row, index) => <span key={index}>{formatValue(row?.gemas_totais, 0)}</span>)}</div><div className="qf-pmd-sample-row"><strong>Viáveis</strong>{samples.map((row, index) => { const value = num(row?.gemas_viaveis); const status = gemStatus(value, rule); return <span key={index} className={`is-${status}`} style={{ color: getCorFaixaGemas(status) }}>{formatValue(value, 0)}</span>; })}</div></div>}</article>; })}</div></section>;
}

function Histogram({ data, rule }) {
  return <section className="qf-pmd-card"><div className="qf-pmd-section-head"><strong>Histograma de gemas viáveis/m</strong><span>{data.evaluated} m avaliado(s)</span></div><div className="qf-pmd-histogram">{data.ranges.map(range => { const height = range.count ? Math.max(7, range.count / data.max * 100) : 0; return <div className="qf-pmd-hist-item" key={`${rule?.data_inicio}-${range.label}`}><b className={`is-${range.status}`}>{range.count}</b><div><i className={`is-${range.status}`} style={{ height: `${height}%` }} /></div><span>{range.label}</span></div>; })}</div></section>;
}

function FailureCard({ summary }) {
  const ratio = safeRatio(summary.falhaMetro, summary.falhaAvaliado);
  const color = ratio === null ? COLORS.muted : ratio === 0 ? COLORS.good : ratio <= .01 ? COLORS.warning : COLORS.danger;
  return <section className="qf-pmd-card qf-pmd-summary-card"><div className="qf-pmd-section-head"><strong>Falha no plantio</strong><span>Resumo diário</span></div><div className="qf-pmd-summary-body"><Donut value={ratio} color={color} label="falha" /><SummaryTable rows={[{ label: 'Metros avaliados', value: `${formatValue(summary.falhaAvaliado, 1)} m` }, { label: 'Total de falha', value: `${formatValue(summary.falhaMetro, 2)} m`, className: ratio === 0 ? 'is-good' : 'is-danger' }, { label: 'Percentual', value: formatPercent(ratio), className: ratio === 0 ? 'is-good' : 'is-danger' }]} /></div></section>;
}

function QualityCard({ type, title, rows }) {
  const valid = rows.filter(row => qualityValue(row, type) !== null);
  const approved = valid.filter(row => qualityStatus(type, qualityValue(row, type)) === 'good').length;
  const ratio = valid.length ? approved / valid.length : null;
  const samples = Array.from({ length: 12 }, (_, index) => valid.find(row => num(row.amostra) === index + 1));
  return <section className="qf-pmd-card qf-pmd-quality"><div className="qf-pmd-section-head"><strong>{title}</strong><span>{qualityRule(type)}</span></div><div className="qf-pmd-progress-head"><span>Dentro do padrão</span><strong className={ratio === null ? 'is-neutral' : ratio >= .8 ? 'is-good' : 'is-danger'}>{formatPercent(ratio)}</strong></div><div className="qf-pmd-progress"><i className={ratio === null ? 'is-neutral' : ratio >= .8 ? 'is-good' : 'is-danger'} style={{ width: `${Math.max(0, Math.min(100, num(ratio, 0) * 100))}%` }} /></div><div className="qf-pmd-quality-grid"><div className="qf-pmd-quality-head">{samples.map((_, index) => <b key={index}>{index + 1}</b>)}</div><div className="qf-pmd-quality-values">{samples.map((row, index) => { const value = qualityValue(row, type); const status = qualityStatus(type, value); return <span key={index} className={`is-${status}`}>{value === null ? '—' : formatValue(value, type === 'paralelismo' ? 3 : 1)}</span>; })}</div><small>Unidade: {qualityUnit(type)}</small></div></section>;
}

// ================================= COMPONENTE PRINCIPAL -----------------------------------

const PlantioMecDetailDiario = ({ initialDate }) => {
  const safeInitialDate = normalizeInitialDate(initialDate);
  const [selectedDate, setSelectedDate] = useState(safeInitialDate);
  const [activeYear, setActiveYear] = useState(Number(safeInitialDate.slice(0, 4)));
  const [availableDates, setAvailableDates] = useState([]);
  const [yearsList, setYearsList] = useState([]);
  const [allDetails, setAllDetails] = useState([]);
  const [dayData, setDayData] = useState({ gems: [], cover: [], depth: [], parallel: [] });
  const [selectedFields, setSelectedFields] = useState([]);
  const [openPoints, setOpenPoints] = useState([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadBase = async () => {
      setLoadingDates(true); setError('');
      const response = await supabase.from('vw_q_plantiomec_detalhe').select('*').order('data', { ascending: false });
      if (!active) return;
      if (response.error) { setError(response.error.message || 'Erro ao consultar vw_q_plantiomec_detalhe.'); setAllDetails([]); setAvailableDates([]); setYearsList([]); setLoadingDates(false); return; }
      const rows = asArray(response.data);
      const years = [...new Set(rows.map(row => num(row.ano)).filter(Boolean))].sort((a, b) => b - a);
      const preferredYear = years.includes(activeYear) ? activeYear : (years[0] || activeYear);
      const dates = [...new Set(rows.filter(row => num(row.ano) === preferredYear).map(row => text(row.data)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
      setAllDetails(rows); setYearsList(years); setActiveYear(preferredYear); setAvailableDates(dates);
      if (dates.length && !dates.includes(selectedDate)) setSelectedDate(dates[0]);
      setLoadingDates(false);
    };
    loadBase();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!allDetails.length || !activeYear) return;
    const dates = [...new Set(allDetails.filter(row => num(row.ano) === activeYear).map(row => text(row.data)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
    setAvailableDates(dates);
    if (dates.length && !dates.includes(selectedDate)) setSelectedDate(dates[0]);
  }, [activeYear, allDetails, selectedDate]);

  useEffect(() => {
    if (!selectedDate) return;
    let active = true;
    const loadDay = async () => {
      setLoadingData(true); setError('');
      const [gems, cover, depth, parallel] = await Promise.all([
        supabase.from('vw_q_plantiomec_gemas').select('*').eq('data', selectedDate).order('codigo_campo').order('lote').order('ponto').order('amostra'),
        supabase.from('vw_q_plantiomec_coberta').select('*').eq('data', selectedDate).order('codigo_campo').order('lote').order('ponto').order('amostra'),
        supabase.from('vw_q_plantiomec_profundidade').select('*').eq('data', selectedDate).order('codigo_campo').order('lote').order('ponto').order('amostra'),
        supabase.from('vw_q_plantiomec_paralelismo').select('*').eq('data', selectedDate).order('codigo_campo').order('lote').order('ponto').order('amostra'),
      ]);
      if (!active) return;
      const requiredError = gems.error || cover.error || depth.error;
      if (requiredError) { setError(requiredError.message || 'Erro ao carregar as amostras do Plantio Mecanizado.'); setDayData({ gems: [], cover: [], depth: [], parallel: [] }); }
      else setDayData({ gems: asArray(gems.data), cover: asArray(cover.data), depth: asArray(depth.data), parallel: parallel.error ? [] : asArray(parallel.data) });
      setLoadingData(false);
    };
    loadDay();
    return () => { active = false; };
  }, [selectedDate]);

  const dateDetails = useMemo(() => allDetails.filter(row => text(row.data) === selectedDate), [allDetails, selectedDate]);
  const fields = useMemo(() => buildFields(dateDetails), [dateDetails]);
  useEffect(() => { const keys = fields.map(field => field.key); setSelectedFields(current => { const maintained = current.filter(key => keys.includes(key)); return maintained.length ? maintained : keys; }); }, [fields]);
  const toggleField = key => setSelectedFields(current => current.includes(key) ? (current.length === 1 ? current : current.filter(item => item !== key)) : [...current, key]);
  const filteredDetails = useMemo(() => dateDetails.filter(row => selectedFields.includes(fieldKey(row))), [dateDetails, selectedFields]);
  const filteredGems = useMemo(() => dayData.gems.filter(row => selectedFields.includes(fieldKey(row))), [dayData.gems, selectedFields]);
  const filteredCover = useMemo(() => dayData.cover.filter(row => selectedFields.includes(fieldKey(row))), [dayData.cover, selectedFields]);
  const filteredDepth = useMemo(() => dayData.depth.filter(row => selectedFields.includes(fieldKey(row))), [dayData.depth, selectedFields]);
  const filteredParallel = useMemo(() => dayData.parallel.filter(row => selectedFields.includes(fieldKey(row))), [dayData.parallel, selectedFields]);
  const summary = useMemo(() => summarizeDetails(filteredDetails), [filteredDetails]);
  const gemRatio = safeRatio(summary.gemasViaveis, summary.gemasTotais);
  const rule = useMemo(() => getRegraHistogramaParaData(selectedDate), [selectedDate]);
  const points = useMemo(() => buildPoints(filteredGems), [filteredGems]);
  const histogram = useMemo(() => buildHistogram(filteredGems, rule), [filteredGems, rule]);
  useEffect(() => { setOpenPoints(current => current.filter(key => points.some(point => point.key === key))); }, [points]);
  const togglePoint = key => setOpenPoints(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);

  return <div className="qf-pmd-page" style={{ '--pmd-font-base': `${DETAIL_LAYOUT.fontBase}px`, '--pmd-font-title': `${DETAIL_LAYOUT.fontTitle}px`, '--pmd-font-header': `${DETAIL_LAYOUT.fontHeader}px`, '--pmd-font-table': `${DETAIL_LAYOUT.fontTable}px`, '--pmd-font-value': `${DETAIL_LAYOUT.fontValue}px`, '--pmd-font-small': `${DETAIL_LAYOUT.fontSmall}px` }}>
    <div className="qf-pmd-date-selector"><DateSelectorQualyFlow value={selectedDate} onChange={setSelectedDate} availableDates={availableDates} activeYear={activeYear} onYearChange={setActiveYear} yearsList={yearsList} isLoading={loadingDates} /></div>
    {error && <div className="qf-pmd-state is-error"><strong>Não foi possível carregar o detalhamento.</strong><span>{error}</span></div>}
    {!loadingDates && !error && !availableDates.length && <div className="qf-pmd-state">Nenhuma avaliação de Plantio Mecanizado encontrada.</div>}
    {loadingData ? <div className="qf-pmd-state">Atualizando avaliação de Plantio Mecanizado...</div> : selectedDate && availableDates.length && !error ? <div className="qf-pmd-content">
      <FieldFilter fields={fields} selected={selectedFields} onToggle={toggleField} />
      <section className="qf-pmd-card qf-pmd-summary-card"><div className="qf-pmd-section-head"><strong>Gemas viáveis</strong><span>Resumo diário</span></div><div className="qf-pmd-summary-body"><Donut value={gemRatio} color={gemRatio === null ? COLORS.muted : gemRatio >= .8 ? COLORS.good : gemRatio >= .7 ? COLORS.warning : COLORS.danger} label="viáveis" /><SummaryTable rows={[{ label: 'Gemas totais', value: formatValue(summary.gemasTotais, 0) }, { label: 'Gemas viáveis', value: formatValue(summary.gemasViaveis, 0), className: 'is-good' }, { label: 'Danificadas', value: formatValue(summary.gemasDanificadas, 0), className: 'is-danger' }]} /></div></section>
      <PointAccordion points={points} openKeys={openPoints} onToggle={togglePoint} rule={rule} />
      <Histogram data={histogram} rule={rule} />
      <FailureCard summary={summary} />
      <div className="qf-pmd-quality-stack">
        {filteredCover.length > 0 && <QualityCard type="coberta" title="Cobertura do plantio" rows={filteredCover} />}
        {filteredDepth.length > 0 && <QualityCard type="profundidade" title="Profundidade no plantio" rows={filteredDepth} />}
        {filteredParallel.length > 0 && <QualityCard type="paralelismo" title="Paralelismo no plantio" rows={filteredParallel} />}
      </div>
    </div> : null}
  </div>;
};

export default PlantioMecDetailDiario;
