// ================================= DOCUMENTATION ------------------------------------------
// Script: HidrorollDetailHistorico
// Purpose: Histórico anual do Hidroroll com detalhamento por campo, lote e ponto.
// Relationships: vw_q_hidroroll_campo | vw_q_hidroroll_dia | vw_q_hidroroll_ponto
// ==========================================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import YearSelectorQualyFlow from '../../../components/QualyFlow/YearSelectorQualyFlow';
import { Bar, CartesianGrid, Cell, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const HISTORY_LAYOUT = {
  barSize: 34,
  chartHeight: 250,
  sampleScaleMin: 25,
  sampleChartMinWidth: 520,

  // Fontes da pagina historica
  fontBase: 10,
  fontTitle: 10,
  fontHeader: 8,
  fontTable: 9,
  fontValue: 11,
  fontSmall: 7,

  // Fontes exclusivas do modal
  modalFontBase: 12,
  modalFontTitle: 12,
  modalFontHeader: 10,
  modalFontTable: 10,
  modalFontValue: 12,
  modalFontSmall: 9,
  modalFieldTitle: 16,
  modalClose: 18,
  modalSampleValue: 9,
};
const COLORS = { good: '#22c55e', warning: '#f59e0b', danger: '#ef4444', water: '#1677ff', muted: '#94a3b8', dark: '#334155' };

const asArray = value => Array.isArray(value) ? value : [];
const num = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const text = (value, fallback = '') => String(value ?? '').trim() || fallback;
const formatValue = (value, decimals = 1) => num(value) === null ? '—' : num(value).toFixed(decimals).replace('.', ',');
const formatPercent = (value, decimals = 1) => {
  const numeric = num(value);
  if (numeric === null) return '—';
  return `${(numeric <= 1 ? numeric * 100 : numeric).toFixed(decimals).replace('.', ',')}%`;
};
const formatDate = value => {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw || '—';
  const [year, month, day] = raw.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};
const infiltrationColor = value => {
  const v = num(value);
  if (v === null) return COLORS.muted;
  if (v >= 18) return COLORS.good;
  if (v >= 14) return COLORS.warning;
  return COLORS.danger;
};
const percentageColor = value => {
  const v = num(value);
  if (v === null) return COLORS.muted;
  const p = v <= 1 ? v * 100 : v;
  if (p >= 90) return COLORS.good;
  if (p >= 80) return COLORS.warning;
  return COLORS.danger;
};
const mean = values => {
  const valid = values.map(num).filter(value => value !== null);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};
const uniformity = values => {
  const valid = values.map(num).filter(value => value !== null);
  if (!valid.length) return null;
  const average = mean(valid);
  if (!average) return null;
  return 1 - valid.reduce((sum, value) => sum + Math.abs(value - average), 0) / (valid.length * average);
};
const weightedAverage = (rows, valueKey, weightKey = 'avaliado') => {
  const valid = rows.map(row => ({ value: num(row[valueKey]), weight: num(row[weightKey], 0) })).filter(item => item.value !== null && item.weight > 0);
  const weight = valid.reduce((sum, item) => sum + item.weight, 0);
  return weight ? valid.reduce((sum, item) => sum + item.value * item.weight, 0) / weight : null;
};

const buildPointRows = rows => {
  const map = new Map();
  rows.forEach(row => {
    const key = `${row.data_apontamento}|${row.lote}|${row.ponto}`;
    if (!map.has(key)) map.set(key, { key, data_apontamento: text(row.data_apontamento), lote: text(row.lote, '—'), ponto: num(row.ponto, 1), samples: [] });
    map.get(key).samples.push(row);
  });
  return [...map.values()].map(point => {
    const samples = point.samples.slice().sort((a, b) => num(a.ordem_amostra, 0) - num(b.ordem_amostra, 0));
    const infiltration = samples.map(row => row.infiltracao);
    const evaluated = infiltration.map(num).filter(value => value !== null).length;
    const standard = samples.filter(row => num(row.atingiu_padrao) === 1).length;
    return { ...point, samples, media_infiltracao: mean(infiltration), media_cana: mean(samples.map(row => row.cana_media)), uniformidade: uniformity(infiltration), avaliado: evaluated, padrao: standard, perc_padrao: evaluated ? standard / evaluated : null };
  }).sort((a, b) => b.data_apontamento.localeCompare(a.data_apontamento) || String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true }) || a.ponto - b.ponto);
};

const groupLots = points => {
  const map = new Map();
  points.forEach(point => {
    const key = text(point.lote, '—');
    if (!map.has(key)) map.set(key, { key, lote: key, points: [] });
    map.get(key).points.push(point);
  });
  return [...map.values()].map(lot => {
    const dates = lot.points.map(point => point.data_apontamento).sort();
    const evaluated = lot.points.reduce((sum, point) => sum + point.avaliado, 0);
    return { ...lot, dataMin: dates[0] || '', dataMax: dates.at(-1) || '', media_infiltracao: weightedAverage(lot.points, 'media_infiltracao'), uniformidade: uniformity(lot.points.flatMap(point => point.samples.map(row => row.infiltracao))), perc_padrao: evaluated ? lot.points.reduce((sum, point) => sum + point.padrao, 0) / evaluated : null };
  }).sort((a, b) => String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true }));
};

function HistoryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="qf-hidro-hst-tooltip"><strong>{label}</strong>{payload.map(item => <span key={item.dataKey} style={{ color: item.color }}>{item.name}: {formatValue(item.value, 2)} cm</span>)}</div>;
}

function HistorySampleBar({ sample, scale }) {
  const infiltration = Math.max(0, Math.min(scale, num(sample.infiltracao, 0)));
  const caneMin = Math.max(0, Math.min(scale, num(sample.cana_min, 0)));
  const caneMax = Math.max(0, Math.min(scale, num(sample.cana_max, 0)));
  const reached = num(sample.atingiu_padrao) === 1;
  return <div className="qf-hidro-hst-sample">
    <strong style={{ color: infiltrationColor(sample.infiltracao) }}>{formatValue(sample.infiltracao, 0)}</strong>
    <div className="qf-hidro-hst-depth-track">
      <i className={reached ? 'is-reached' : 'is-not-reached'} style={{ height: `${infiltration / scale * 100}%` }} />
      <span className="is-minimum" style={{ top: `${caneMin / scale * 100}%` }} />
      <span className="is-maximum" style={{ top: `${caneMax / scale * 100}%` }} />
    </div>
    <small>{sample.ordem_amostra}</small>
  </div>;
}

function PointDepthPanel({ point }) {
  if (!point) return null;
  const scale = Math.ceil(Math.max(HISTORY_LAYOUT.sampleScaleMin, ...point.samples.flatMap(row => [num(row.infiltracao, 0), num(row.cana_max, 0)])) / 5) * 5;
  const samples = Array.from({ length: 12 }, (_, index) => point.samples.find(row => num(row.ordem_amostra) === index + 1) || { ordem_amostra: index + 1 });
  return <div className="qf-hidro-hst-inline-depth">
    <div className="qf-hidro-hst-inline-depth-head"><div><strong>Profundidades do ponto</strong><small>{formatDate(point.data_apontamento)} • P{point.ponto}</small></div><span>Escala {scale} cm</span></div>
    <div className="qf-hidro-hst-samples-scroll"><div className="qf-hidro-hst-samples-grid">{samples.map(sample => <HistorySampleBar key={sample.ordem_amostra} sample={sample} scale={scale} />)}</div></div>
    <div className="qf-hidro-hst-point-legend"><span><i className="is-water" />Infiltração</span><span><i className="is-minimum" />Cana mín.</span><span><i className="is-maximum" />Cana máx.</span></div>
  </div>;
}

function FieldModal({ field, onClose }) {
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState([]);
  const [openLots, setOpenLots] = useState([]);
  const [selectedPointKey, setSelectedPointKey] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      const response = await supabase.from('vw_q_hidroroll_ponto').select('*').eq('ano', field.ano).eq('codigo_campo', field.codigo_campo).order('data_apontamento', { ascending: false }).order('lote').order('ponto').order('ordem_amostra');
      if (!active) return;
      if (response.error) { setError(response.error.message || 'Erro ao carregar os pontos do campo.'); setPoints([]); }
      else { setPoints(buildPointRows(asArray(response.data))); setOpenLots([]); setSelectedPointKey(''); }
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [field]);

  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const lots = useMemo(() => groupLots(points), [points]);
  const totalSamples = points.reduce((sum, point) => sum + point.avaliado, 0);

  const toggleLot = lot => {
    const isOpen = openLots.includes(lot.lote);
    setOpenLots(current => isOpen ? current.filter(item => item !== lot.lote) : [...current, lot.lote]);
    if (!isOpen && lot.points.length) {
      const latest = lot.points.slice().sort((a, b) => b.data_apontamento.localeCompare(a.data_apontamento) || b.ponto - a.ponto)[0];
      setSelectedPointKey(latest.key);
    }
  };

  return <div className="qf-hidro-hst-modal-backdrop" onMouseDown={onClose}>
    <div
      className="qf-hidro-hst-modal"
      onMouseDown={event => event.stopPropagation()}
      style={{
        '--hidro-hst-modal-font-base': `${HISTORY_LAYOUT.modalFontBase}px`,
        '--hidro-hst-modal-font-title': `${HISTORY_LAYOUT.modalFontTitle}px`,
        '--hidro-hst-modal-font-header': `${HISTORY_LAYOUT.modalFontHeader}px`,
        '--hidro-hst-modal-font-table': `${HISTORY_LAYOUT.modalFontTable}px`,
        '--hidro-hst-modal-font-value': `${HISTORY_LAYOUT.modalFontValue}px`,
        '--hidro-hst-modal-font-small': `${HISTORY_LAYOUT.modalFontSmall}px`,
        '--hidro-hst-modal-field-title': `${HISTORY_LAYOUT.modalFieldTitle}px`,
        '--hidro-hst-modal-close': `${HISTORY_LAYOUT.modalClose}px`,
        '--hidro-hst-modal-sample-value': `${HISTORY_LAYOUT.modalSampleValue}px`,
        '--hidro-hst-sample-min-width': `${HISTORY_LAYOUT.sampleChartMinWidth}px`,
      }}
    >
      <header><div><span>{field.setor}</span><strong>{field.campo}</strong><small>{field.ano} • {formatDate(field.data_min)} a {formatDate(field.data_max)}</small></div><button type="button" onClick={onClose}>×</button></header>
      <main>
        {loading ? <div className="qf-hidro-hst-modal-state">Carregando detalhamento do campo...</div> : error ? <div className="qf-hidro-hst-modal-state is-error">{error}</div> : <>
          <section className="qf-hidro-hst-modal-kpis">
            <div><span>Pontos</span><strong>{points.length}</strong></div><div><span>Amostras</span><strong>{totalSamples}</strong></div>
            <div><span>Média infiltração</span><strong style={{ color: infiltrationColor(field.media_infiltracao) }}>{formatValue(field.media_infiltracao)} cm</strong></div>
            <div><span>Média da cana</span><strong>{formatValue(field.media_cana)} cm</strong></div>
            <div><span>Uniformidade</span><strong style={{ color: percentageColor(field.perc_uniformidade) }}>{formatPercent(field.perc_uniformidade)}</strong></div>
            <div><span>Padrão</span><strong style={{ color: percentageColor(field.perc_padrao) }}>{formatPercent(field.perc_padrao)}</strong></div>
          </section>

          <section className="qf-hidro-hst-modal-table-card">
            <div className="qf-hidro-hst-section-head"><strong>Resumo geral do campo</strong><span>{points.length} ponto(s)</span></div>
            <div className="qf-hidro-hst-modal-table-scroll"><table><thead><tr><th>Data</th><th>Lote</th><th>Ponto</th><th>Méd. Infil.</th><th>Méd. Cana</th><th>Uniform.</th><th>Padrão %</th></tr></thead><tbody>
              {points.map(point => <tr key={point.key}><td>{formatDate(point.data_apontamento)}</td><td>{point.lote}</td><td>P{point.ponto}</td><td style={{ color: infiltrationColor(point.media_infiltracao) }}>{formatValue(point.media_infiltracao)}</td><td>{formatValue(point.media_cana)}</td><td style={{ color: percentageColor(point.uniformidade) }}>{formatPercent(point.uniformidade)}</td><td style={{ color: percentageColor(point.perc_padrao) }}>{formatPercent(point.perc_padrao)}</td></tr>)}
            </tbody></table></div>
          </section>

          <section className="qf-hidro-hst-lots-card">
            <div className="qf-hidro-hst-section-head"><strong>Lotes e pontos</strong><span>{lots.length} lote(s)</span></div>
            <div className="qf-hidro-hst-lot-list">{lots.map(lot => {
              const opened = openLots.includes(lot.lote);
              const selectedPoint = lot.points.find(point => point.key === selectedPointKey) || lot.points.slice().sort((a, b) => b.data_apontamento.localeCompare(a.data_apontamento) || b.ponto - a.ponto)[0];
              return <div className={`qf-hidro-hst-lot ${opened ? 'is-open' : ''}`} key={lot.key}>
                <button type="button" className={opened ? 'is-open' : ''} onClick={() => toggleLot(lot)}>
                  <span><b>Lote {lot.lote}</b></span>
                  <span><small>Méd. Infil.</small><b style={{ color: infiltrationColor(lot.media_infiltracao) }}>{formatValue(lot.media_infiltracao)}</b></span>
                  <span><small>Uniform.</small><b style={{ color: percentageColor(lot.uniformidade) }}>{formatPercent(lot.uniformidade)}</b></span>
                  <span><small>Padrão</small><b style={{ color: percentageColor(lot.perc_padrao) }}>{formatPercent(lot.perc_padrao)}</b></span><i>{opened ? '−' : '+'}</i>
                </button>
                {opened && <div className="qf-hidro-hst-lot-content">
                  <div className="qf-hidro-hst-lot-points">{lot.points.map(point => <button type="button" key={point.key} className={point.key === selectedPoint?.key ? 'is-selected' : ''} onClick={() => setSelectedPointKey(point.key)}><b>P{point.ponto}</b></button>)}</div>
                  <PointDepthPanel point={selectedPoint} />
                </div>}
              </div>;
            })}</div>
          </section>
        </>}
      </main>
    </div>
  </div>;
}

const HidrorollDetailHistorico = ({ initialYear }) => {
  const [activeYear, setActiveYear] = useState(Number(initialYear) || new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [fields, setFields] = useState([]);
  const [dailyRows, setDailyRows] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const monthlyScrollRef = useRef(null);

  useEffect(() => {
    let active = true;
    supabase.from('vw_q_hidroroll_campo').select('ano').order('ano', { ascending: false }).then(response => {
      if (!active) return;
      if (response.error) { setError(response.error.message); setLoading(false); return; }
      const years = [...new Set(asArray(response.data).map(row => num(row.ano)).filter(Boolean))].sort((a, b) => b - a);
      setAvailableYears(years);
      if (years.length && !years.includes(activeYear)) setActiveYear(years[0]);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!activeYear) return;
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      const [fieldResult, dailyResult] = await Promise.all([
        supabase.from('vw_q_hidroroll_campo').select('*').eq('ano', activeYear).order('data_max', { ascending: false }),
        supabase.from('vw_q_hidroroll_dia').select('*').eq('ano', activeYear).order('data_apontamento'),
      ]);
      if (!active) return;
      if (fieldResult.error || dailyResult.error) { setError(fieldResult.error?.message || dailyResult.error?.message); setFields([]); setDailyRows([]); }
      else { setFields(asArray(fieldResult.data)); setDailyRows(asArray(dailyResult.data)); }
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [activeYear]);

  const monthlyData = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const rows = dailyRows.filter(row => num(row.mes) === index + 1);
    return { month: index + 1, label: MONTHS[index], infiltracao: weightedAverage(rows, 'media_infiltracao'), cana: weightedAverage(rows, 'media_cana') };
  }), [dailyRows]);

  useEffect(() => {
    const container = monthlyScrollRef.current;
    if (!container || !monthlyData.length) return;

    const lastIndex = monthlyData.reduce(
      (latest, row, index) => row.infiltracao !== null ? index : latest,
      -1,
    );

    if (lastIndex < 0) return;

    const focusLastMonth = () => {
      const chart = container.firstElementChild;
      if (!chart) return;

      const slotWidth = chart.scrollWidth / monthlyData.length;
      const targetCenter = slotWidth * (lastIndex + 0.5);
      const left = Math.max(0, targetCenter - container.clientWidth / 2);

      container.scrollTo({ left, behavior: 'smooth' });
    };

    const timer = window.setTimeout(focusLastMonth, 180);
    return () => window.clearTimeout(timer);
  }, [monthlyData, activeYear]);

  const totals = useMemo(() => {
    const samples = fields.reduce((sum, row) => sum + num(row.avaliado, 0), 0);
    return { fields: fields.length, samples, infiltration: weightedAverage(fields, 'media_infiltracao'), uniformity: weightedAverage(fields, 'perc_uniformidade'), standard: samples ? fields.reduce((sum, row) => sum + num(row.padrao, 0), 0) / samples : null };
  }, [fields]);

  return <div className="qf-hidro-hst-page" style={{ '--hidro-hst-font-base': `${HISTORY_LAYOUT.fontBase}px`, '--hidro-hst-font-title': `${HISTORY_LAYOUT.fontTitle}px`, '--hidro-hst-font-header': `${HISTORY_LAYOUT.fontHeader}px`, '--hidro-hst-font-table': `${HISTORY_LAYOUT.fontTable}px`, '--hidro-hst-font-value': `${HISTORY_LAYOUT.fontValue}px`, '--hidro-hst-font-small': `${HISTORY_LAYOUT.fontSmall}px` }}>
    <div className="qf-hidro-hst-year-selector"><YearSelectorQualyFlow value={activeYear} onChange={setActiveYear} availableYears={availableYears} isLoading={loading} /></div>
    {loading ? <div className="qf-hidro-hst-state">Carregando histórico Hidroroll...</div> : error ? <div className="qf-hidro-hst-state is-error">{error}</div> : !fields.length ? <div className="qf-hidro-hst-state">Nenhum campo avaliado no ano selecionado.</div> : <div className="qf-hidro-hst-content">
      <section className="qf-hidro-hst-kpis"><div><span>Campos</span><strong>{totals.fields}</strong></div><div><span>Amostras</span><strong>{totals.samples}</strong></div><div><span>Média infiltração</span><strong style={{ color: infiltrationColor(totals.infiltration) }}>{formatValue(totals.infiltration)} cm</strong></div><div><span>Uniformidade</span><strong style={{ color: percentageColor(totals.uniformity) }}>{formatPercent(totals.uniformity)}</strong></div><div><span>Padrão</span><strong style={{ color: percentageColor(totals.standard) }}>{formatPercent(totals.standard)}</strong></div></section>
      <section className="qf-hidro-hst-chart-card"><div className="qf-hidro-hst-section-head"><strong>Evolução mensal</strong><span>{activeYear}</span></div><div className="qf-hidro-hst-chart-scroll" ref={monthlyScrollRef}><div className="qf-hidro-hst-chart" style={{ minWidth: '720px', height: `${HISTORY_LAYOUT.chartHeight}px` }}><ResponsiveContainer width="100%" height="100%"><ComposedChart data={monthlyData} margin={{ top: 28, right: 10, left: 0, bottom: 10 }}><CartesianGrid vertical={false} stroke="#eef2f7" /><XAxis dataKey="label" interval={0} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 9, fontWeight: 900 }} /><YAxis hide domain={[0, max => Math.max(25, max * 1.2)]} /><Tooltip content={<HistoryTooltip />} /><Bar dataKey="infiltracao" name="Infiltração" barSize={HISTORY_LAYOUT.barSize} radius={[6, 6, 1, 1]}>{monthlyData.map(row => <Cell key={row.month} fill={row.infiltracao === null ? 'transparent' : infiltrationColor(row.infiltracao)} />)}<LabelList dataKey="infiltracao" position="top" formatter={value => value === null ? '' : formatValue(value)} fill="#475569" fontSize={9} fontWeight={900} /></Bar><Line type="monotone" connectNulls={false} dataKey="cana" name="Média da cana" stroke={COLORS.dark} strokeWidth={2} dot={{ r: 3, fill: COLORS.warning }} /></ComposedChart></ResponsiveContainer></div></div></section>
      <section className="qf-hidro-hst-field-card"><div className="qf-hidro-hst-section-head"><strong>Campos avaliados</strong><span>{fields.length} campo(s)</span></div><div className="qf-hidro-hst-field-header"><span>Campo</span><span>Amostras</span><span>Média Infilt.</span><span>Uniformidade</span><span>Padrão</span></div><div className="qf-hidro-hst-field-list">{fields.map(field => <button type="button" key={`${field.ano}-${field.codigo_campo}`} onClick={() => setSelectedField(field)}><span className="is-field"><b>{field.campo}</b><small>{field.setor} • {formatDate(field.data_min)} a {formatDate(field.data_max)}</small></span><span>{num(field.avaliado, 0)}</span><span style={{ color: infiltrationColor(field.media_infiltracao) }}>{formatValue(field.media_infiltracao)}</span><span style={{ color: percentageColor(field.perc_uniformidade) }}>{formatPercent(field.perc_uniformidade)}</span><span style={{ color: percentageColor(field.perc_padrao) }}>{formatPercent(field.perc_padrao)}</span></button>)}</div></section>
    </div>}
    {selectedField && <FieldModal field={selectedField} onClose={() => setSelectedField(null)} />}
  </div>;
};

export default HidrorollDetailHistorico;
