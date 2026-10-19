// ================================= DOCUMENTATION ------------------------------------------
// Script: PreparoDetailHistorico
// Purpose: Historico mensal, acumulado anual e resumo dos campos por mes.
// Relationships:
//   - vw_q_preparo_ano
//   - vw_q_preparo_mensal
//   - vw_q_preparo_geral
//   - YearSelectorQualyFlow
// ==========================================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import YearSelectorQualyFlow from '../../../components/QualyFlow/YearSelectorQualyFlow';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// ================================= CONFIGURACOES ------------------------------------------

const DETAIL_LAYOUT = {
  barSize: 32, chartHeight: 235, chartLabelSize: 10, chartValueSize: 10,
  fontBase: 12, fontTitle: 12, fontValue: 12, fontSmall: 9,
  modalFontTitle: 14, modalFontHeader: 9, modalFontValue: 11, modalFontSmall: 9,
  mobileBarSize: 23, mobileChartHeight: 220, mobileChartLabelSize: 9, mobileChartValueSize: 9,
  mobileFontBase: 12, mobileFontTitle: 13, mobileFontValue: 12, mobileFontSmall: 10,
  mobileModalFontTitle: 14, mobileModalFontHeader: 9, mobileModalFontValue: 11, mobileModalFontSmall: 9,
};

const COLORS = { good: '#22c55e', warning: '#f59e0b', danger: '#ef4444', muted: '#94a3b8', neutral: '#64748b', grid: '#eef2f7' };
const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const METRICS = [
  { key: 'profund_haste', label: 'Profundidade da Haste', shortLabel: 'Haste', target: 'Mínimo 23 cm', meta: 90, attention: 80, decimals: 0, averageDecimals: 1, compliance: value => Number.isFinite(value) && value >= 23 },
  { key: 'profund_cana', label: 'Profundidade da Cana', shortLabel: 'Cana', target: 'Mínimo 18 cm', meta: 90, attention: 80, decimals: 0, averageDecimals: 1, compliance: value => Number.isFinite(value) && value >= 18 },
  { key: 'paralelismo_sulco', label: 'Paralelismo entre Sulcos', shortLabel: 'P. Sulco', target: 'Entre 1,45 e 1,55', meta: 80, attention: 70, decimals: 2, averageDecimals: 2, compliance: value => Number.isFinite(value) && value >= 1.45 && value <= 1.55 },
  { key: 'paralelismo_fita', label: 'Paralelismo entre Fitas', shortLabel: 'P. Fita', target: 'Entre 2,15 e 2,25', meta: 80, attention: 70, decimals: 2, averageDecimals: 2, compliance: value => Number.isFinite(value) && value >= 2.15 && value <= 2.25 },
  { key: 'profund_fita', label: 'Profundidade da Fita', shortLabel: 'Profund. Fita', target: 'Mínimo 18 cm', meta: 90, attention: 80, decimals: 0, averageDecimals: 1, compliance: value => Number.isFinite(value) && value >= 18 },
];

// ================================= HELPERS ------------------------------------------------

const asArray = value => Array.isArray(value) ? value : [];
const num = (value, fallback = null) => { if (value === null || value === undefined || value === '') return fallback; const parsed = Number(String(value).replace(',', '.')); return Number.isFinite(parsed) ? parsed : fallback; };
const text = (value, fallback = '') => String(value ?? '').trim() || fallback;
const formatValue = (value, decimals = 1) => { const numeric = num(value); return numeric === null ? '—' : numeric.toFixed(decimals).replace('.', ','); };
const formatPercent = value => { const numeric = num(value); return numeric === null ? '—' : `${numeric.toFixed(1).replace('.', ',')}%`; };
const resultColor = (value, metric) => { const numeric = num(value); if (numeric === null) return COLORS.muted; if (numeric >= metric.meta) return COLORS.good; if (numeric >= metric.attention) return COLORS.warning; return COLORS.danger; };
const normalizeInitialYear = value => { const numeric = Number(value); return Number.isInteger(numeric) && numeric >= 2000 ? numeric : new Date().getFullYear(); };
const buildMonthlyData = (rows, metric) => Array.from({ length: 12 }, (_, index) => { const month = index + 1; const row = rows.find(item => num(item.mes) === month); return { month, name: MONTHS[index], value: row ? num(row[metric.key]) : null }; });

const buildFieldSummary = (rows, metric) => {
  const map = new Map();
  rows.forEach(row => {
    const key = text(row.codigo_campo, row.campo);
    if (!map.has(key)) map.set(key, { key, codigo_campo: row.codigo_campo, campo: text(row.campo, row.codigo_campo), setor: text(row.setor, 'SEM SETOR'), values: [], lots: new Set() });
    const field = map.get(key); const value = num(row[metric.key]);
    if (value !== null && value !== 0) field.values.push(value);
    if (row.lote !== null && row.lote !== undefined && row.lote !== '') field.lots.add(text(row.lote));
  });
  return [...map.values()].map(field => {
    const evaluated = field.values.length;
    const standard = field.values.filter(metric.compliance).length;
    const average = evaluated ? field.values.reduce((sum, value) => sum + value, 0) / evaluated : null;
    return { ...field, lots: [...field.lots].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })), evaluated, standard, average, percent: evaluated ? (standard / evaluated) * 100 : null };
  }).filter(field => field.evaluated > 0).sort((a, b) => a.campo.localeCompare(b.campo, 'pt-BR', { numeric: true }));
};

// ================================= COMPONENTES VISUAIS ------------------------------------

function HistoryTooltip({ active, payload, metric, year }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  return <div className="qf-preparo-hst-tooltip"><strong>{item?.name} / {year}</strong><span style={{ color: resultColor(item?.value, metric) }}>{formatPercent(item?.value)}</span><small>Toque para ver os campos</small></div>;
}

function MetricHistoryCard({ metric, monthlyRows, annualRow, year, onMonthClick }) {
  const data = useMemo(() => buildMonthlyData(monthlyRows, metric), [monthlyRows, metric]);
  const annualValue = num(annualRow?.[metric.key]);
  const scrollRef = useRef(null);
  const chartBoxRef = useRef(null);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    const element = chartBoxRef.current;
    if (!element) return undefined;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setChartReady(rect.width > 0 && rect.height > 0);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!chartReady || !scrollRef.current) return;
    const latestIndex = data.reduce((last, item, index) => item.value !== null ? index : last, -1);
    if (latestIndex < 0) return;

    const timer = window.setTimeout(() => {
      const container = scrollRef.current;
      if (!container) return;
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      const target = latestIndex >= 11 ? maxScroll : maxScroll * (latestIndex / 11);
      container.scrollTo({ left: target, behavior: 'smooth' });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [chartReady, data, year]);

  return (
    <section className="qf-preparo-hst-card">
      <header className="qf-preparo-hst-card-head">
        <div><strong>{metric.label}</strong><small>{metric.target} • clique em um mês para detalhar</small></div>
        <span className="qf-preparo-hst-annual"><i>{year}:</i><b style={{ color: resultColor(annualValue, metric) }}>{formatPercent(annualValue)}</b></span>
      </header>
      <div className="qf-preparo-hst-chart-scroll" ref={scrollRef}>
        <div className="qf-preparo-hst-chart" ref={chartBoxRef}>
          {chartReady && (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={data} margin={{ top: 32, right: 8, left: 2, bottom: 5 }}>
                <CartesianGrid vertical={false} stroke={COLORS.grid} strokeDasharray="3 3" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tick={{ fill: COLORS.neutral, fontSize: DETAIL_LAYOUT.chartLabelSize, fontWeight: 900 }} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip cursor={{ fill: 'rgba(241,245,249,.55)' }} content={<HistoryTooltip metric={metric} year={year} />} />
                <ReferenceLine y={metric.meta} stroke={COLORS.good} strokeDasharray="4 4" label={{ position: 'insideTopLeft', value: 'Meta', fill: COLORS.good, fontSize: 9, fontWeight: 900 }} />
                <Bar dataKey="value" barSize={DETAIL_LAYOUT.barSize} radius={[6, 6, 1, 1]} cursor="pointer">
                  {data.map(item => (
                    <Cell
                      key={`${metric.key}-${item.month}`}
                      fill={item.value === null ? 'transparent' : resultColor(item.value, metric)}
                      cursor={item.value === null ? 'default' : 'pointer'}
                      onClick={() => {
                        if (item.value !== null) onMonthClick(metric, item.month);
                      }}
                    />
                  ))}
                  <LabelList dataKey="value" position="top" formatter={value => value === null || value === undefined ? '' : formatPercent(value)} fill="#475569" fontSize={DETAIL_LAYOUT.chartValueSize} fontWeight={900} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
}

function MonthFieldsModal({ modal, rows, isLoading, error, onClose }) {
  const fields = useMemo(() => modal ? buildFieldSummary(rows, modal.metric) : [], [rows, modal]);
  if (!modal) return null;
  return (
    <div className="qf-preparo-hst-modal-backdrop" onClick={onClose} role="presentation">
      <section className="qf-preparo-hst-modal" role="dialog" aria-modal="true" aria-label={`Campos avaliados em ${MONTHS[modal.month - 1]}`} onClick={event => event.stopPropagation()}>
        <header><div><span>{MONTHS[modal.month - 1]} / {modal.year}</span><strong>{modal.metric.label}</strong><small>{fields.length} campo(s) com avaliação</small></div><button type="button" onClick={onClose} aria-label="Fechar">×</button></header>
        <main>
          {isLoading ? <div className="qf-preparo-hst-modal-state">Carregando campos avaliados...</div> : error ? <div className="qf-preparo-hst-modal-state is-error">{error}</div> : fields.length ? (
            <div className="qf-preparo-hst-field-list">
              {fields.map(field => (
                <article key={field.key} className="qf-preparo-hst-field-row">
                  <div className="qf-preparo-hst-field-info"><strong>{field.campo}</strong><small>{field.setor} • {field.lots.length} lote(s)</small></div>
                  <div><small>Média</small><b>{formatValue(field.average, modal.metric.averageDecimals)}</b></div>
                  <div><small>Padrão</small><b>{field.standard} / {field.evaluated}</b></div>
                  <div><small>Resultado</small><b style={{ color: resultColor(field.percent, modal.metric) }}>{formatPercent(field.percent)}</b></div>
                </article>
              ))}
            </div>
          ) : <div className="qf-preparo-hst-modal-state">Nenhum campo avaliado neste mês.</div>}
        </main>
      </section>
    </div>
  );
}

// ================================= COMPONENTE PRINCIPAL -----------------------------------

const PreparoDetailHistorico = ({ initialYear }) => {
  const [activeYear, setActiveYear] = useState(normalizeInitialYear(initialYear));
  const [availableYears, setAvailableYears] = useState([]);
  const [annualRow, setAnnualRow] = useState(null);
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [modalRows, setModalRows] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    let mounted = true;
    const loadYears = async () => {
      const response = await supabase.from('vw_q_preparo_ano').select('ano');
      if (!mounted) return;
      if (response.error) { setError(response.error.message || 'Erro ao consultar os anos.'); return; }
      const years = [...new Set(asArray(response.data).map(row => num(row.ano)).filter(Boolean))].sort((a, b) => b - a);
      setAvailableYears(years);
      if (years.length && !years.includes(activeYear)) setActiveYear(years[0]);
    };
    loadYears();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!activeYear) return;
    let mounted = true;
    const loadHistory = async () => {
      setLoading(true); setError(''); setModal(null);
      const [annualResponse, monthlyResponse] = await Promise.all([
        supabase.from('vw_q_preparo_ano').select('*').eq('ano', activeYear).maybeSingle(),
        supabase.from('vw_q_preparo_mensal').select('*').eq('ano', activeYear).order('mes', { ascending: true }),
      ]);
      if (!mounted) return;
      if (annualResponse.error || monthlyResponse.error) { setError(annualResponse.error?.message || monthlyResponse.error?.message || 'Erro ao carregar o histórico.'); setAnnualRow(null); setMonthlyRows([]); }
      else { setAnnualRow(annualResponse.data || null); setMonthlyRows(asArray(monthlyResponse.data)); }
      setLoading(false);
    };
    loadHistory();
    return () => { mounted = false; };
  }, [activeYear]);

  const openMonth = async (metric, month) => {
    setModal({ metric, month, year: activeYear }); setModalRows([]); setModalLoading(true); setModalError('');
    const response = await supabase.from('vw_q_preparo_geral').select('codigo_campo,campo,setor,lote,ponto,profund_haste,profund_cana,paralelismo_sulco,paralelismo_fita,profund_fita').eq('ano', activeYear).eq('mes', month).order('campo', { ascending: true });
    if (response.error) { setModalError(response.error.message || 'Erro ao carregar os campos do mês.'); setModalRows([]); }
    else setModalRows(asArray(response.data));
    setModalLoading(false);
  };

  const styleVars = {
    '--preparo-hst-font-base': `${DETAIL_LAYOUT.fontBase}px`, '--preparo-hst-font-title': `${DETAIL_LAYOUT.fontTitle}px`, '--preparo-hst-font-value': `${DETAIL_LAYOUT.fontValue}px`, '--preparo-hst-font-small': `${DETAIL_LAYOUT.fontSmall}px`, '--preparo-hst-chart-height': `${DETAIL_LAYOUT.chartHeight}px`,
    '--preparo-hst-modal-font-title': `${DETAIL_LAYOUT.modalFontTitle}px`, '--preparo-hst-modal-font-header': `${DETAIL_LAYOUT.modalFontHeader}px`, '--preparo-hst-modal-font-value': `${DETAIL_LAYOUT.modalFontValue}px`, '--preparo-hst-modal-font-small': `${DETAIL_LAYOUT.modalFontSmall}px`,
    '--preparo-hst-mobile-font-base': `${DETAIL_LAYOUT.mobileFontBase}px`, '--preparo-hst-mobile-font-title': `${DETAIL_LAYOUT.mobileFontTitle}px`, '--preparo-hst-mobile-font-value': `${DETAIL_LAYOUT.mobileFontValue}px`, '--preparo-hst-mobile-font-small': `${DETAIL_LAYOUT.mobileFontSmall}px`, '--preparo-hst-mobile-chart-height': `${DETAIL_LAYOUT.mobileChartHeight}px`,
    '--preparo-hst-mobile-modal-font-title': `${DETAIL_LAYOUT.mobileModalFontTitle}px`, '--preparo-hst-mobile-modal-font-header': `${DETAIL_LAYOUT.mobileModalFontHeader}px`, '--preparo-hst-mobile-modal-font-value': `${DETAIL_LAYOUT.mobileModalFontValue}px`, '--preparo-hst-mobile-modal-font-small': `${DETAIL_LAYOUT.mobileModalFontSmall}px`,
  };

  return (
    <div className="qf-preparo-hst-page" style={styleVars}>
      <div className="qf-preparo-hst-year-selector"><YearSelectorQualyFlow value={activeYear} onChange={setActiveYear} availableYears={availableYears} isLoading={loading} /></div>
      {error && <div className="qf-preparo-hst-state is-error"><strong>Não foi possível carregar o histórico.</strong><span>{error}</span></div>}
      {loading ? <div className="qf-preparo-hst-state">Carregando safra...</div> : !error && annualRow ? <div className="qf-preparo-hst-content">{METRICS.map(metric => <MetricHistoryCard key={metric.key} metric={metric} monthlyRows={monthlyRows} annualRow={annualRow} year={activeYear} onMonthClick={openMonth} />)}</div> : !error ? <div className="qf-preparo-hst-state">Nenhum resultado disponível para {activeYear}.</div> : null}
      <MonthFieldsModal modal={modal} rows={modalRows} isLoading={modalLoading} error={modalError} onClose={() => setModal(null)} />
    </div>
  );
};

export default PreparoDetailHistorico;
