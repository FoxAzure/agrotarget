// ================================= DOCUMENTATION ------------------------------------------
// Script: PreparoDetailDiario
// Purpose: Detalhamento diario das avaliacoes de Preparo de Solo.
// Relationships: vw_q_preparo_datas, vw_q_preparo_geral, vw_q_preparo_ano
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DateSelectorQualyFlow from '../../../components/QualyFlow/DateSelectorQualyFlow';
import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const DETAIL_LAYOUT = {
  barSize: 38, chartLabelSize: 11, chartValueSize: 11,
  fontBase: 12, fontTitle: 12, fontHeader: 10, fontTable: 10, fontValue: 11, fontSmall: 9, fontFooter: 9,
  fontFieldTitle: 11, fontFieldSubtitle: 9, fontMetricLabel: 8, fontMetricValue: 11,
  mobileFontBase: 12, mobileFontTitle: 13, mobileFontHeader: 10, mobileFontTable: 10, mobileFontValue: 11,
  mobileFontSmall: 11, mobileFontFooter: 11, mobileFontFieldTitle: 11, mobileFontFieldSubtitle: 10,
  mobileFontMetricLabel: 10, mobileFontMetricValue: 12, mobileChartLabelSize: 12, mobileChartValueSize: 12,
};

const COLORS = { good: '#22c55e', warning: '#f59e0b', danger: '#ef4444', muted: '#94a3b8' };

const METRICS = [
  { key: 'profund_haste', yearKey: 'profund_haste', label: 'Profundidade da Haste', target: 'Minimo 23 cm', decimals: 0, averageDecimals: 1, meta: 90, attention: 80, compliance: value => Number.isFinite(value) && value >= 23 },
  { key: 'profund_cana', yearKey: 'profund_cana', label: 'Profundidade da Cana', target: 'Minimo 18 cm', decimals: 0, averageDecimals: 1, meta: 90, attention: 80, compliance: value => Number.isFinite(value) && value >= 18 },
  { key: 'paralelismo_sulco', yearKey: 'paralelismo_sulco', label: 'Paralelismo entre Sulcos', target: 'Entre 1,45 e 1,55', decimals: 2, averageDecimals: 2, meta: 80, attention: 70, compliance: value => Number.isFinite(value) && value >= 1.45 && value <= 1.55 },
  { key: 'paralelismo_fita', yearKey: 'paralelismo_fita', label: 'Paralelismo entre Fitas', target: 'Entre 2,15 e 2,25', decimals: 2, averageDecimals: 2, meta: 80, attention: 70, compliance: value => Number.isFinite(value) && value >= 2.15 && value <= 2.25 },
  { key: 'profund_fita', yearKey: 'profund_fita', label: 'Profundidade da Fita', target: 'Minimo 18 cm', decimals: 0, averageDecimals: 1, meta: 90, attention: 80, compliance: value => Number.isFinite(value) && value >= 18 },
];

const asArray = value => Array.isArray(value) ? value : [];
const num = (value, fallback = null) => { if (value === null || value === undefined || value === '') return fallback; const parsed = Number(String(value).replace(',', '.')); return Number.isFinite(parsed) ? parsed : fallback; };
const text = (value, fallback = '') => String(value ?? '').trim() || fallback;
const normalizeInitialDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date().toISOString().slice(0, 10);
const formatValue = (value, decimals = 1) => { const numeric = num(value); return numeric === null ? '—' : numeric.toFixed(decimals).replace('.', ','); };
const formatPercent = value => { const numeric = num(value); return numeric === null ? '—' : `${numeric.toFixed(1).replace('.', ',')}%`; };
const resultColor = (value, metric) => { const numeric = num(value); if (numeric === null) return COLORS.muted; if (numeric >= metric.meta) return COLORS.good; if (numeric >= metric.attention) return COLORS.warning; return COLORS.danger; };
const valueColor = (value, metric) => { const numeric = num(value); if (numeric === null) return COLORS.muted; return metric.compliance(numeric) ? COLORS.good : COLORS.danger; };
const mean = values => { const valid = values.map(value => num(value)).filter(value => value !== null && value !== 0); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null; };
const calculateCompliance = (rows, metric) => { const values = rows.map(row => num(row[metric.key])).filter(value => value !== null && value !== 0); return values.length ? (values.filter(metric.compliance).length / values.length) * 100 : null; };
const fieldKey = row => text(row.codigo_campo, row.campo);

const buildFields = rows => {
  const map = new Map();
  rows.forEach(row => {
    const key = fieldKey(row);
    if (!map.has(key)) map.set(key, { key, codigo_campo: row.codigo_campo, campo: text(row.campo, row.codigo_campo), setor: text(row.setor, 'SEM SETOR'), rows: [], lotes: new Set() });
    const field = map.get(key); field.rows.push(row); field.lotes.add(text(row.lote, '—'));
  });
  return [...map.values()].map(field => ({ ...field, lotes: [...field.lotes].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })), pontos: field.rows.length, sulco: mean(field.rows.map(row => row.paralelismo_sulco)), fita: mean(field.rows.map(row => row.paralelismo_fita)) })).sort((a, b) => a.campo.localeCompare(b.campo, 'pt-BR', { numeric: true }));
};

const buildMetricRows = (rows, metric) => {
  const grouped = new Map();
  rows.forEach(row => {
    const key = `${fieldKey(row)}|${text(row.lote, '—')}|${metric.key}`;
    if (!grouped.has(key)) grouped.set(key, { field: text(row.campo, row.codigo_campo), lot: text(row.lote, '—'), values: [] });
    const value = num(row[metric.key]);
    if (value !== null && value !== 0) grouped.get(key).values.push({ sourcePoint: num(row.ponto), value });
  });
  const result = [];
  [...grouped.values()].forEach(group => {
    group.values.sort((a, b) => (a.sourcePoint ?? 999999) - (b.sourcePoint ?? 999999));
    for (let start = 0; start < group.values.length; start += 12) {
      const chunk = group.values.slice(start, start + 12); const standard = chunk.filter(item => metric.compliance(item.value)).length;
      result.push({ id: `${group.field}-${group.lot}-${metric.key}-${start}`, field: group.field, lot: group.lot, points: chunk, measured: chunk.length, standard, percent: chunk.length ? (standard / chunk.length) * 100 : null });
    }
  });
  return result;
};

function ChartTooltip({ active, payload, label }) { if (!active || !payload?.length) return null; return <div className="qf-preparo-day-tooltip"><strong>{label}</strong><span style={{ color: payload[0].color }}>{formatPercent(payload[0].value)}</span></div>; }

function FieldSelector({ fields, selectedKey, onSelect }) {
  return <section className="qf-preparo-day-field-filter"><div className="qf-preparo-day-field-filter-head"><strong>Campos avaliados</strong><span>{fields.length} campo(s)</span></div><div className="qf-preparo-day-field-list">{fields.map(field => <button type="button" key={field.key} className={`qf-preparo-day-field-button ${selectedKey === field.key ? 'is-selected' : ''}`} onClick={() => onSelect(field.key)}><span className="qf-preparo-day-field-name" title={field.campo}><b>{field.campo}</b><small>{field.setor} • {field.lotes.length === 1 ? `Lote ${field.lotes[0]}` : `${field.lotes.length} lotes: ${field.lotes.join(', ')}`}</small></span><span className="qf-preparo-day-field-metric"><small>Pontos</small><b>{field.pontos}</b></span><span className="qf-preparo-day-field-metric"><small>P. Sulco</small><b style={{ color: field.sulco >= 1.45 && field.sulco <= 1.55 ? COLORS.good : COLORS.danger }}>{formatValue(field.sulco, 2)}</b></span><span className="qf-preparo-day-field-metric"><small>P. Fita</small><b style={{ color: field.fita >= 2.15 && field.fita <= 2.25 ? COLORS.good : COLORS.danger }}>{formatValue(field.fita, 2)}</b></span></button>)}</div></section>;
}

function MetricTable({ metric, rows }) {
  const items = useMemo(() => buildMetricRows(rows, metric), [rows, metric]); const points = Array.from({ length: 12 }, (_, index) => index + 1);
  return <div className="qf-preparo-day-table-wrap"><div className="qf-preparo-day-table-scroll"><table className="qf-preparo-day-table"><thead><tr><th className="is-field">Campo</th><th>Lote</th>{points.map(point => <th key={point}>{point}</th>)}<th className="is-standard">Padrao</th><th className="is-percent">%</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td className="is-field" title={item.field}>{item.field}</td><td>{item.lot}</td>{points.map((pointNumber, index) => { const point = item.points[index]; return point ? <td key={pointNumber} className={metric.compliance(point.value) ? 'is-good' : 'is-bad'} title={`Ponto original ${point.sourcePoint}`}>{formatValue(point.value, metric.decimals)}</td> : <td key={pointNumber} className="is-empty">—</td>; })}<td className="is-standard">{item.standard}/{item.measured}</td><td className="is-percent" style={{ color: resultColor(item.percent, metric) }}>{formatPercent(item.percent)}</td></tr>)}{!items.length && <tr><td colSpan="16" className="qf-preparo-day-table-empty">Nenhum valor avaliado para este indicador.</td></tr>}</tbody></table></div></div>;
}

function ResultChart({ metric, dayValue, yearValue, year }) {
  const data = [{ name: 'Dia', value: dayValue }, { name: String(year), value: yearValue }];
  return <div className="qf-preparo-day-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 28, right: 8, left: 8, bottom: 2 }}><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: DETAIL_LAYOUT.chartLabelSize, fontWeight: 900 }} /><YAxis hide domain={[0, 100]} /><Tooltip cursor={{ fill: 'rgba(241,245,249,.55)' }} content={<ChartTooltip />} /><ReferenceLine y={metric.meta} stroke={COLORS.good} strokeDasharray="4 4" /><Bar dataKey="value" name="Conformidade" barSize={DETAIL_LAYOUT.barSize} radius={[6, 6, 1, 1]}>{data.map(row => <Cell key={row.name} fill={resultColor(row.value, metric)} />)}<LabelList dataKey="value" position="top" formatter={formatPercent} fill="#475569" fontSize={DETAIL_LAYOUT.chartValueSize} fontWeight={900} /></Bar></BarChart></ResponsiveContainer></div>;
}

function MetricSection({ metric, rows, yearData, year }) {
  const dayValue = useMemo(() => calculateCompliance(rows, metric), [rows, metric]); const yearValue = num(yearData?.[metric.yearKey]);
  const values = rows.map(row => num(row[metric.key])).filter(value => value !== null && value !== 0); const average = mean(values); const standardCount = values.filter(metric.compliance).length;
  return <section className="qf-preparo-day-metric-card"><div className="qf-preparo-day-section-head"><div><strong>{metric.label}</strong><small>{metric.target}</small></div><span style={{ color: resultColor(dayValue, metric) }}>{formatPercent(dayValue)}</span></div><div className="qf-preparo-day-metric-body"><MetricTable metric={metric} rows={rows} /><ResultChart metric={metric} dayValue={dayValue} yearValue={yearValue} year={year} /></div><div className="qf-preparo-day-card-footer"><span>Media: <b style={{ color: valueColor(average, metric) }}>{formatValue(average, metric.averageDecimals)}</b></span><span>Padrao: <b>{standardCount} / {values.length}</b></span><span>Meta: <b>{metric.meta}%</b></span></div></section>;
}

const PreparoDetailDiario = ({ initialDate }) => {
  const safeInitialDate = normalizeInitialDate(initialDate); const [selectedDate, setSelectedDate] = useState(safeInitialDate); const [activeYear, setActiveYear] = useState(Number(safeInitialDate.slice(0, 4))); const [availableDates, setAvailableDates] = useState([]); const [yearsList, setYearsList] = useState([]); const [allDates, setAllDates] = useState([]); const [dayRows, setDayRows] = useState([]); const [yearData, setYearData] = useState(null); const [selectedFieldKey, setSelectedFieldKey] = useState(''); const [loadingDates, setLoadingDates] = useState(true); const [loadingData, setLoadingData] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let active = true; const loadDates = async () => { setLoadingDates(true); setError(''); const response = await supabase.from('vw_q_preparo_datas').select('data').order('data', { ascending: false }); if (!active) return; if (response.error) { setError(response.error.message); setLoadingDates(false); return; } const dates = [...new Set(asArray(response.data).map(row => text(row.data)).filter(Boolean))].sort((a, b) => b.localeCompare(a)); const years = [...new Set(dates.map(date => Number(date.slice(0, 4))).filter(Boolean))].sort((a, b) => b - a); const preferredYear = years.includes(activeYear) ? activeYear : (years[0] || activeYear); const yearDates = dates.filter(date => Number(date.slice(0, 4)) === preferredYear); setAllDates(dates); setYearsList(years); setActiveYear(preferredYear); setAvailableDates(yearDates); if (yearDates.length && !yearDates.includes(selectedDate)) setSelectedDate(yearDates[0]); setLoadingDates(false); }; loadDates(); return () => { active = false; }; }, []);
  useEffect(() => { if (!allDates.length || !activeYear) return; const dates = allDates.filter(date => Number(date.slice(0, 4)) === activeYear); setAvailableDates(dates); if (dates.length && !dates.includes(selectedDate)) setSelectedDate(dates[0]); }, [activeYear, allDates, selectedDate]);
  useEffect(() => { if (!selectedDate) return; let active = true; const loadData = async () => { setLoadingData(true); setError(''); const year = Number(selectedDate.slice(0, 4)); const [dayResponse, yearResponse] = await Promise.all([supabase.from('vw_q_preparo_geral').select('data,data_hora_ponto,semana_iso,mes,ano,codigo_campo,campo,setor,depa,lote,ponto,profund_haste,profund_cana,paralelismo_sulco,paralelismo_fita,profund_fita').eq('data', selectedDate).order('campo').order('lote').order('ponto'), supabase.from('vw_q_preparo_ano').select('*').eq('ano', year).maybeSingle()]); if (!active) return; if (dayResponse.error) { setError(dayResponse.error.message); setDayRows([]); setYearData(null); } else { setDayRows(asArray(dayResponse.data)); setYearData(yearResponse.error ? null : yearResponse.data); } setLoadingData(false); }; loadData(); return () => { active = false; }; }, [selectedDate]);
  const fields = useMemo(() => buildFields(dayRows), [dayRows]); useEffect(() => { setSelectedFieldKey(current => fields.some(field => field.key === current) ? current : (fields[0]?.key || '')); }, [fields]); const filteredRows = useMemo(() => selectedFieldKey ? dayRows.filter(row => fieldKey(row) === selectedFieldKey) : dayRows, [dayRows, selectedFieldKey]);
  const styleVars = { '--preparo-day-font-base': `${DETAIL_LAYOUT.fontBase}px`, '--preparo-day-font-title': `${DETAIL_LAYOUT.fontTitle}px`, '--preparo-day-font-header': `${DETAIL_LAYOUT.fontHeader}px`, '--preparo-day-font-table': `${DETAIL_LAYOUT.fontTable}px`, '--preparo-day-font-value': `${DETAIL_LAYOUT.fontValue}px`, '--preparo-day-font-small': `${DETAIL_LAYOUT.fontSmall}px`, '--preparo-day-font-footer': `${DETAIL_LAYOUT.fontFooter}px`, '--preparo-day-font-field-title': `${DETAIL_LAYOUT.fontFieldTitle}px`, '--preparo-day-font-field-subtitle': `${DETAIL_LAYOUT.fontFieldSubtitle}px`, '--preparo-day-font-metric-label': `${DETAIL_LAYOUT.fontMetricLabel}px`, '--preparo-day-font-metric-value': `${DETAIL_LAYOUT.fontMetricValue}px`, '--preparo-day-mobile-font-base': `${DETAIL_LAYOUT.mobileFontBase}px`, '--preparo-day-mobile-font-title': `${DETAIL_LAYOUT.mobileFontTitle}px`, '--preparo-day-mobile-font-header': `${DETAIL_LAYOUT.mobileFontHeader}px`, '--preparo-day-mobile-font-table': `${DETAIL_LAYOUT.mobileFontTable}px`, '--preparo-day-mobile-font-value': `${DETAIL_LAYOUT.mobileFontValue}px`, '--preparo-day-mobile-font-small': `${DETAIL_LAYOUT.mobileFontSmall}px`, '--preparo-day-mobile-font-footer': `${DETAIL_LAYOUT.mobileFontFooter}px`, '--preparo-day-mobile-font-field-title': `${DETAIL_LAYOUT.mobileFontFieldTitle}px`, '--preparo-day-mobile-font-field-subtitle': `${DETAIL_LAYOUT.mobileFontFieldSubtitle}px`, '--preparo-day-mobile-font-metric-label': `${DETAIL_LAYOUT.mobileFontMetricLabel}px`, '--preparo-day-mobile-font-metric-value': `${DETAIL_LAYOUT.mobileFontMetricValue}px` };
  return <div className="qf-preparo-day-page" style={styleVars}><div className="qf-preparo-day-date-selector"><DateSelectorQualyFlow value={selectedDate} onChange={setSelectedDate} availableDates={availableDates} activeYear={activeYear} onYearChange={setActiveYear} yearsList={yearsList} isLoading={loadingDates} /></div>{error && <div className="qf-preparo-day-state is-error"><strong>Nao foi possivel carregar o detalhamento.</strong><span>{error}</span></div>}{loadingData ? <div className="qf-preparo-day-state">Atualizando avaliacao...</div> : selectedDate && availableDates.length && !error ? <div className="qf-preparo-day-content"><FieldSelector fields={fields} selectedKey={selectedFieldKey} onSelect={setSelectedFieldKey} />{filteredRows.length ? METRICS.map(metric => <MetricSection key={metric.key} metric={metric} rows={filteredRows} yearData={yearData} year={activeYear} />) : <div className="qf-preparo-day-state">Nenhum campo disponivel.</div>}</div> : null}</div>;
};

export default PreparoDetailDiario;
