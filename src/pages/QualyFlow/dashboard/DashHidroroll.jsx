// ================================= DOCUMENTATION ------------------------------------------
// Script: DashHidroroll V2
// Purpose: Dashboard geral do Hidroroll com navegação por data, ano, pontos e históricos.
// Relationships: vw_q_hidroroll_dia | vw_q_hidroroll_ponto | vw_q_hidroroll_campo
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import './BaseDash.css';
import './DashHidroroll.css';

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const HIDRO_LAYOUT = {
  sidebarWidth: 230,
  contentPadding: 10,
  gap: 8,
  topHeight: 215,
  middleHeight: 286,
  bottomHeight: 250,
  barSize: 25,
  chartFontSize: 8,
  chartValueFontSize: 9,
  titleFontSize: 10,
  tableFontSize: 8,
  sampleChartHeight: 148,
  sampleScaleMin: 25,
};

const COLORS = {
  good: '#10b981', warning: '#f59e0b', danger: '#ef4444',
  blue: '#38bdf8', blueStrong: '#1677ff', muted: '#64748b',
};

const asArray = value => Array.isArray(value) ? value : [];
const num = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const text = (value, fallback = '') => String(value ?? '').trim() || fallback;
const fmt = (value, decimals = 1) => num(value) === null ? '—' : num(value).toFixed(decimals).replace('.', ',');
const fmtPct = (value, decimals = 1) => num(value) === null ? '—' : `${(num(value) * 100).toFixed(decimals).replace('.', ',')}%`;
const fmtDate = value => {
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [year, month, day] = raw.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }
  return raw || '—';
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
const caneColor = value => {
  const v = num(value);
  if (v === null) return COLORS.muted;
  return v >= 5 && v <= 8 ? COLORS.good : COLORS.danger;
};
const mean = values => {
  const valid = values.map(num).filter(value => value !== null);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};
const cuc = values => {
  const valid = values.map(num).filter(value => value !== null);
  if (!valid.length) return null;
  const avg = mean(valid);
  if (!avg) return null;
  return 1 - valid.reduce((sum, value) => sum + Math.abs(value - avg), 0) / (valid.length * avg);
};
const weightedAverage = (rows, valueKey, weightKey = 'avaliado') => {
  const valid = rows.map(row => ({ value: num(row[valueKey]), weight: num(row[weightKey], 0) }))
    .filter(item => item.value !== null && item.weight > 0);
  const weight = valid.reduce((sum, item) => sum + item.weight, 0);
  return weight ? valid.reduce((sum, item) => sum + item.value * item.weight, 0) / weight : null;
};

const buildDateRows = rows => {
  const map = new Map();
  rows.forEach(row => {
    const date = text(row.data_apontamento);
    if (!date) return;
    if (!map.has(date)) map.set(date, { date, year: num(row.ano), fields: new Set(), points: 0 });
    const item = map.get(date);
    item.fields.add(text(row.campo, row.codigo_campo));
    item.points += Math.ceil(num(row.avaliado, 0) / 12);
  });
  return [...map.values()].map(item => ({ ...item, fieldsText: [...item.fields].join(', ') }))
    .sort((a, b) => b.date.localeCompare(a.date));
};

const buildPointRows = rows => {
  const map = new Map();
  rows.forEach(row => {
    const key = `${row.codigo_campo}|${row.lote}|${row.ponto}`;
    if (!map.has(key)) map.set(key, {
      key, codigo_campo: row.codigo_campo, campo: row.campo, lote: row.lote,
      setor: row.setor, ponto: num(row.ponto, 1), samples: [],
    });
    map.get(key).samples.push(row);
  });
  return [...map.values()].map(point => {
    const samples = point.samples.sort((a, b) => num(a.ordem_amostra, 0) - num(b.ordem_amostra, 0));
    const infiltration = samples.map(row => row.infiltracao);
    const evaluated = infiltration.map(num).filter(value => value !== null).length;
    const standard = samples.filter(row => num(row.atingiu_padrao) === 1).length;
    return {
      ...point, samples,
      media_infiltracao: mean(infiltration),
      media_min: mean(samples.map(row => row.cana_min)),
      media_max: mean(samples.map(row => row.cana_max)),
      uniformidade: cuc(infiltration), avaliado: evaluated, padrao: standard,
      perc_padrao: evaluated ? standard / evaluated : null,
    };
  }).sort((a, b) =>
    String(a.codigo_campo).localeCompare(String(b.codigo_campo), 'pt-BR', { numeric: true }) ||
    String(a.lote).localeCompare(String(b.lote), 'pt-BR', { numeric: true }) || a.ponto - b.ponto
  );
};

const buildMonthlyData = (rows, year) => Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  const monthRows = rows.filter(row => num(row.ano) === year && num(row.mes) === month);
  return {
    month,
    label: MONTHS[index],
    infiltracao: weightedAverage(monthRows, 'media_infiltracao'),
    cana: weightedAverage(monthRows, 'media_cana'),
  };
});

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return <div className="hidro-tooltip"><strong>{label}</strong>{payload.map(item => (
    <span key={item.dataKey} style={{ color: item.color }}>{item.name}: {fmt(item.value, 2)} cm</span>
  ))}</div>;
}

function DonutKpi({ title, value, subtitle }) {
  const safe = Math.max(0, Math.min(1, num(value, 0)));
  const color = percentageColor(safe);
  return <section className="hidro-panel hidro-donut-card">
    <div className="hidro-panel-title">{title}</div>
    <div className="hidro-donut" style={{ '--donut-value': `${safe * 360}deg`, '--donut-color': color }}>
      <div><strong style={{ color }}>{fmtPct(safe)}</strong><small>{subtitle}</small></div>
    </div>
    <div className="hidro-scale-caption"><span>Meta</span><b>90%</b></div>
  </section>;
}

function InfiltrationKpi({ dayValue, yearValue }) {
  const data = [{ name: 'Dia', value: dayValue }, { name: 'Ano', value: yearValue }];
  return <section className="hidro-panel hidro-kpi-chart">
    <div className="hidro-panel-title">Profundidade Infiltração</div>
    <div className="hidro-chart-body"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 25, right: 2, left: 2, bottom: 1 }}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: HIDRO_LAYOUT.chartFontSize, fontWeight: 800 }} />
        <YAxis hide domain={[0, max => Math.max(25, max * 1.2)]} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,.035)' }} content={<ChartTooltip />} />
        <ReferenceLine y={14} stroke={COLORS.danger} strokeDasharray="3 3" />
        <ReferenceLine y={18} stroke={COLORS.good} strokeDasharray="3 3" />
        <Bar dataKey="value" name="Infiltração" barSize={HIDRO_LAYOUT.barSize} radius={[5, 5, 1, 1]}>
          {data.map(row => <Cell key={row.name} fill={infiltrationColor(row.value)} />)}
          <LabelList dataKey="value" position="top" formatter={value => fmt(value)} fill="#e2e8f0" fontSize={HIDRO_LAYOUT.chartValueFontSize} fontWeight={900} />
        </Bar>
      </BarChart>
    </ResponsiveContainer></div>
    <div className="hidro-kpi-legend"><span className="is-danger">14</span><span className="is-good">18</span></div>
  </section>;
}

function CaneKpi({ minimum, maximum, average }) {
  const data = [{ name: 'Mín.', value: minimum }, { name: 'Máx.', value: maximum }, { name: 'Média', value: average }];
  return <section className="hidro-panel hidro-kpi-chart">
    <div className="hidro-panel-title">Profundidade da Cana</div>
    <div className="hidro-chart-body"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 25, right: 2, left: 2, bottom: 1 }}>
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: HIDRO_LAYOUT.chartFontSize, fontWeight: 800 }} />
        <YAxis hide domain={[0, max => Math.max(12, max * 1.25)]} />
        <Tooltip cursor={{ fill: 'rgba(255,255,255,.035)' }} content={<ChartTooltip />} />
        <ReferenceLine y={5} stroke={COLORS.good} strokeDasharray="3 3" />
        <ReferenceLine y={8} stroke={COLORS.good} strokeDasharray="3 3" />
        <Bar dataKey="value" name="Profundidade" barSize={HIDRO_LAYOUT.barSize} radius={[5, 5, 1, 1]}>
          {data.map(row => <Cell key={row.name} fill={caneColor(row.value)} />)}
          <LabelList dataKey="value" position="top" formatter={value => fmt(value)} fill="#e2e8f0" fontSize={HIDRO_LAYOUT.chartValueFontSize} fontWeight={900} />
        </Bar>
      </BarChart>
    </ResponsiveContainer></div>
    <div className="hidro-kpi-legend"><span className="is-good">Faixa 5 a 8</span></div>
  </section>;
}

function PointTable({ rows, selectedKey, onSelect }) {
  return <section className="hidro-panel hidro-table-panel">
    <div className="hidro-section-head"><strong>Resumo Geral por Ponto</strong><span>{rows.length} ponto(s)</span></div>
    <div className="hidro-table-scroll"><table className="hidro-table">
      <thead><tr><th>Ponto</th><th>Lote</th><th>Méd. Infil.</th><th>Méd. Mín.</th><th>Méd. Máx.</th><th>Uniform.</th><th>Aval.</th><th>Padrão</th><th>% Padrão</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.key} className={row.key === selectedKey ? 'is-selected' : ''} onClick={() => onSelect(row.key)}>
        <td><b>P{row.ponto}</b></td><td>{row.lote}</td><td style={{ color: infiltrationColor(row.media_infiltracao) }}>{fmt(row.media_infiltracao)}</td>
        <td>{fmt(row.media_min)}</td><td>{fmt(row.media_max)}</td><td style={{ color: percentageColor(row.uniformidade) }}>{fmtPct(row.uniformidade)}</td>
        <td>{row.avaliado}</td><td>{row.padrao}</td><td style={{ color: percentageColor(row.perc_padrao) }}>{fmtPct(row.perc_padrao)}</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

function SampleBar({ sample, scale }) {
  const infiltration = Math.max(0, Math.min(scale, num(sample.infiltracao, 0)));
  const caneMin = Math.max(0, Math.min(scale, num(sample.cana_min, 0)));
  const caneMax = Math.max(0, Math.min(scale, num(sample.cana_max, 0)));
  return <div className="hidro-sample">
    <strong style={{ color: infiltrationColor(sample.infiltracao) }}>{fmt(sample.infiltracao, 0)}</strong>
    <div className="hidro-depth-track">
      <i className={num(sample.atingiu_padrao) === 1 ? 'is-reached' : 'is-not-reached'} style={{ height: `${infiltration / scale * 100}%` }} />
      <span className="is-min" style={{ top: `${caneMin / scale * 100}%` }} /><span className="is-max" style={{ top: `${caneMax / scale * 100}%` }} />
    </div><small>{sample.ordem_amostra}</small>
  </div>;
}

function PointDetail({ rows, selectedKey, onSelect }) {
  const selected = rows.find(row => row.key === selectedKey) || rows[0];
  if (!selected) return <section className="hidro-panel hidro-point-panel" />;
  const scale = Math.ceil(Math.max(HIDRO_LAYOUT.sampleScaleMin, ...selected.samples.flatMap(row => [num(row.infiltracao, 0), num(row.cana_max, 0)])) / 5) * 5;
  const samples = Array.from({ length: 12 }, (_, index) => selected.samples.find(row => num(row.ordem_amostra) === index + 1) || { ordem_amostra: index + 1 });
  return <section className="hidro-panel hidro-point-panel">
    <div className="hidro-section-head hidro-point-head"><strong>Detalhe do Ponto</strong><span>Lote {selected.lote} • Ponto {selected.ponto}</span></div>
    <div className="hidro-point-tabs">{rows.map(row => <button type="button" key={row.key} className={row.key === selected.key ? 'is-active' : ''} onClick={() => onSelect(row.key)}><b>P{row.ponto}</b><small>Lote {row.lote}</small></button>)}</div>
    <div className="hidro-samples-grid">{samples.map(sample => <SampleBar key={sample.ordem_amostra} sample={sample} scale={scale} />)}</div>
    <div className="hidro-point-legend"><span><i className="water" />Infiltração</span><span><i className="minimum" />Cana mín.</span><span><i className="maximum" />Cana máx.</span></div>
  </section>;
}

function MonthlyChart({ data, year }) {
  return <section className="hidro-panel hidro-history-panel">
    <div className="hidro-section-head"><strong>Histórico Mensal - Profundidade Infiltração</strong><span>{year}</span></div>
    <div className="hidro-history-body"><ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 23, right: 10, left: 0, bottom: 2 }}>
        <CartesianGrid vertical={false} stroke="rgba(148,163,184,.12)" />
        <XAxis dataKey="label" interval={0} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: HIDRO_LAYOUT.chartFontSize, fontWeight: 800 }} />
        <YAxis hide domain={[0, max => Math.max(25, max * 1.2)]} />
        <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 8 }} />
        <Bar dataKey="infiltracao" name="Infiltração" barSize={HIDRO_LAYOUT.barSize} radius={[5, 5, 1, 1]}>
          {data.map(row => <Cell key={row.month} fill={row.infiltracao === null ? 'transparent' : infiltrationColor(row.infiltracao)} />)}
          <LabelList dataKey="infiltracao" position="top" formatter={value => value === null ? '' : fmt(value)} fill="#e2e8f0" fontSize={HIDRO_LAYOUT.chartValueFontSize} fontWeight={900} />
        </Bar>
        <Line type="monotone" connectNulls={false} dataKey="cana" name="Prof. média da cana" stroke="#f8fafc" strokeWidth={2} dot={{ r: 3, fill: COLORS.warning, stroke: '#f8fafc' }} />
      </ComposedChart>
    </ResponsiveContainer></div>
  </section>;
}

function FieldHistoryTable({ data, year }) {
  return <section className="hidro-panel hidro-history-table-panel">
    <div className="hidro-section-head">
      <strong>Histórico dos Campos</strong>
      <span>{year} • {data.length} campo(s)</span>
    </div>

    <div className="hidro-history-table-scroll">
      <table className="hidro-history-table">
        <thead>
          <tr>
            <th>Campo</th>
            <th>Média Infiltração</th>
            <th>Uniformidade</th>
            <th>Padrão</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.key} title={`Última avaliação: ${fmtDate(row.data_max)}`}>
              <td>
                <div className="hidro-history-field">
                  <strong>{row.campo}</strong>
                  <small>{fmtDate(row.data_max)} • {row.setor}</small>
                </div>
              </td>
              <td>
                <span
                  className="hidro-history-value"
                  style={{ color: infiltrationColor(row.media_infiltracao) }}
                >
                  {fmt(row.media_infiltracao)}
                </span>
              </td>
              <td>
                <span
                  className="hidro-history-value"
                  style={{ color: percentageColor(row.perc_uniformidade) }}
                >
                  {fmtPct(row.perc_uniformidade)}
                </span>
              </td>
              <td>
                <span
                  className="hidro-history-value"
                  style={{ color: percentageColor(row.perc_padrao) }}
                >
                  {fmtPct(row.perc_padrao)}
                </span>
              </td>
            </tr>
          ))}

          {!data.length && (
            <tr>
              <td colSpan="4" className="hidro-history-empty">
                Nenhum campo avaliado no ano selecionado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>;
}

export default function DashHidroroll() {
  const [allDaily, setAllDaily] = useState([]);
  const [allField, setAllField] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(null);
  const [search, setSearch] = useState('');
  const [dayPoints, setDayPoints] = useState([]);
  const [selectedPointKey, setSelectedPointKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingDay, setLoadingDay] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('vw_q_hidroroll_dia').select('*').order('data_apontamento', { ascending: false }),
      supabase.from('vw_q_hidroroll_campo').select('*').order('ano', { ascending: false }),
    ]).then(([dailyResult, fieldResult]) => {
      if (!active) return;
      if (dailyResult.error) { setError(dailyResult.error.message); setLoading(false); return; }
      const daily = asArray(dailyResult.data);
      const field = fieldResult.error ? [] : asArray(fieldResult.data);
      const years = [...new Set([...daily.map(row => num(row.ano)), ...field.map(row => num(row.ano))].filter(Boolean))].sort((a, b) => b - a);
      const maxYear = years[0] || new Date().getFullYear();
      const dates = buildDateRows(daily).filter(item => item.year === maxYear);
      setAllDaily(daily); setAllField(field); setSelectedYear(maxYear); setSelectedDate(dates[0]?.date || ''); setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedDate) { setDayPoints([]); return; }
    let active = true; setLoadingDay(true);
    supabase.from('vw_q_hidroroll_ponto').select('*').eq('data_apontamento', selectedDate)
      .order('codigo_campo').order('lote').order('ponto').order('ordem_amostra')
      .then(response => {
        if (!active) return;
        if (response.error) setError(response.error.message);
        const built = response.error ? [] : buildPointRows(asArray(response.data));
        setDayPoints(built); setSelectedPointKey(built[0]?.key || ''); setLoadingDay(false);
      });
    return () => { active = false; };
  }, [selectedDate]);

  const years = useMemo(() => [...new Set([...allDaily.map(row => num(row.ano)), ...allField.map(row => num(row.ano))].filter(Boolean))].sort((a, b) => b - a), [allDaily, allField]);
  const sidebarDates = useMemo(() => buildDateRows(allDaily).filter(item => item.year === selectedYear), [allDaily, selectedYear]);
  const filteredDates = useMemo(() => {
    const term = search.toLowerCase().trim();
    return term ? sidebarDates.filter(item => `${item.date} ${item.fieldsText}`.toLowerCase().includes(term)) : sidebarDates;
  }, [sidebarDates, search]);

  const handleYearChange = year => {
    const nextYear = Number(year);
    const dates = buildDateRows(allDaily).filter(item => item.year === nextYear);
    setSelectedYear(nextYear); setSelectedDate(dates[0]?.date || '');
  };

  const selectedDaily = useMemo(() => allDaily.filter(row => text(row.data_apontamento) === selectedDate), [allDaily, selectedDate]);
  const yearDaily = useMemo(() => allDaily.filter(row => num(row.ano) === selectedYear), [allDaily, selectedYear]);
  const dayKpis = useMemo(() => ({
    infiltration: weightedAverage(selectedDaily, 'media_infiltracao'),
    caneMin: weightedAverage(selectedDaily, 'media_cana_min'),
    caneMax: weightedAverage(selectedDaily, 'media_cana_max'),
    caneMean: weightedAverage(selectedDaily, 'media_cana'),
    uniformity: dayPoints.length ? cuc(dayPoints.flatMap(point => point.samples.map(row => row.infiltracao))) : weightedAverage(selectedDaily, 'perc_uniformidade'),
    standard: selectedDaily.reduce((sum, row) => sum + num(row.avaliado, 0), 0)
      ? selectedDaily.reduce((sum, row) => sum + num(row.padrao, 0), 0) / selectedDaily.reduce((sum, row) => sum + num(row.avaliado, 0), 0) : null,
  }), [selectedDaily, dayPoints]);
  const monthlyData = useMemo(() => buildMonthlyData(allDaily, selectedYear), [allDaily, selectedYear]);
  const fieldHistoryData = useMemo(() => allField
    .filter(row => num(row.ano) === selectedYear)
    .map(row => ({
      key: `${row.ano}-${row.codigo_campo}`,
      campo: text(row.campo, row.codigo_campo),
      setor: text(row.setor, 'SEM SETOR'),
      data_max: text(row.data_max),
      media_infiltracao: num(row.media_infiltracao),
      perc_uniformidade: num(row.perc_uniformidade),
      perc_padrao: num(row.perc_padrao),
    }))
    .sort((a, b) => String(b.data_max).localeCompare(String(a.data_max)) ||
      a.campo.localeCompare(b.campo, 'pt-BR')),
  [allField, selectedYear]);

  if (loading) return <div className="hidro-loading">Carregando Dashboard Hidroroll...</div>;
  if (error && !allDaily.length) return <div className="hidro-loading is-error">{error}</div>;

  return <div className="dash-hidroroll" style={{
    '--hidro-sidebar-width': `${HIDRO_LAYOUT.sidebarWidth}px`, '--hidro-content-padding': `${HIDRO_LAYOUT.contentPadding}px`,
    '--hidro-gap': `${HIDRO_LAYOUT.gap}px`, '--hidro-top-height': `${HIDRO_LAYOUT.topHeight}px`,
    '--hidro-middle-height': `${HIDRO_LAYOUT.middleHeight}px`, '--hidro-bottom-height': `${HIDRO_LAYOUT.bottomHeight}px`,
    '--hidro-title-font': `${HIDRO_LAYOUT.titleFontSize}px`, '--hidro-table-font': `${HIDRO_LAYOUT.tableFontSize}px`,
    '--hidro-sample-height': `${HIDRO_LAYOUT.sampleChartHeight}px`,
  }}>
    <aside className="hidro-sidebar">
      <div className="hidro-sidebar-head"><strong>DATAS</strong><span>{filteredDates.length}</span></div>
      <div className="hidro-sidebar-year"><label>Ano</label><select value={selectedYear || ''} onChange={event => handleYearChange(event.target.value)}>{years.map(year => <option key={year} value={year}>{year}</option>)}</select></div>
      <div className="hidro-search-wrap"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar campo..." />{search && <button type="button" onClick={() => setSearch('')}>×</button>}</div>
      <div className="hidro-sidebar-hint">O ano controla os históricos e as datas disponíveis.</div>
      <div className="hidro-date-list">{filteredDates.map(item => <button type="button" key={item.date} className={`hidro-date-row ${item.date === selectedDate ? 'is-selected' : ''}`} onClick={() => setSelectedDate(item.date)}><span><strong>{fmtDate(item.date)}</strong><small>{item.fieldsText}</small></span><b>{item.points}</b></button>)}</div>
    </aside>

    <main className="hidro-main">
      <div className="hidro-year-toolbar"><div><span>Visão anual</span><strong>{selectedYear}</strong></div><select value={selectedYear || ''} onChange={event => handleYearChange(event.target.value)}>{years.map(year => <option key={year}>{year}</option>)}</select></div>
      {loadingDay ? <div className="hidro-data-loading">Atualizando avaliação Hidroroll...</div> : <>
        <section className="hidro-top-grid">
          <InfiltrationKpi dayValue={dayKpis.infiltration} yearValue={weightedAverage(yearDaily, 'media_infiltracao')} />
          <CaneKpi minimum={dayKpis.caneMin} maximum={dayKpis.caneMax} average={dayKpis.caneMean} />
          <DonutKpi title="Uniformidade da Infiltração" value={dayKpis.uniformity} subtitle="CUC do dia" />
          <DonutKpi title="Infiltração Padrão" value={dayKpis.standard} subtitle="Amostras conformes" />
        </section>
        <section className="hidro-middle-grid"><PointTable rows={dayPoints} selectedKey={selectedPointKey} onSelect={setSelectedPointKey} /><PointDetail rows={dayPoints} selectedKey={selectedPointKey} onSelect={setSelectedPointKey} /></section>
        <section className="hidro-bottom-grid"><MonthlyChart data={monthlyData} year={selectedYear} /><FieldHistoryTable data={fieldHistoryData} year={selectedYear} /></section>
      </>}
    </main>
  </div>;
}
