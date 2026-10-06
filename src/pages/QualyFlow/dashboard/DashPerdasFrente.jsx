import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getMetasParaData, getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import {
  BarChart, Bar, Cell, ComposedChart, LabelList, Line,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import imgOuro from '../../../gallery/logo/medalha-de-ouro.png';
import imgPrata from '../../../gallery/logo/medalha-de-prata.png';
import imgBronze from '../../../gallery/logo/medalha-de-bronze.png';
import './DashPerdasFrente.css';

// ============================== AJUSTES VISUAIS ==============================
const FRENTE_LAYOUT = {
  frontColumnWidth: 0.92,
  fieldColumnWidth: 1.22,
  chartColumnWidth: 1.05,
  gap: 9,

  frontListPercent: 38,
  categoryPercent: 62,

  // Tabela "Indicadores por campo"
  fieldTableFontSize: 10,
  fieldTableHeaderFontSize: 9,
  fieldTableRowHeight: 31,
  fieldTableWidthPercent: 100,

  // Larguras percentuais das colunas de "Indicadores por campo".
  // Mantenha a soma em 100.
  fieldColumnFront: 9,
  fieldColumnField: 27,
  fieldColumnPoints: 8,
  fieldColumnLoss: 12,
  fieldColumnSimple: 15,
  fieldColumnDouble: 14,
  fieldColumnPullout: 15,

  // Tabela "Indicadores por frente"
  frontTableFontSize: 9,
  frontTableHeaderFontSize: 9,
  frontTablePositionFontSize: 9,
  frontTableRowHeight: 31,
  frontTableMedalSize: 25,

  // Larguras percentuais das colunas da tabela "Indicadores por frente".
  // Mantenha a soma em 100 para ocupar exatamente toda a largura da tabela.
  frontColumnPosition: 8,
  frontColumnFront: 12,
  frontColumnPoints: 10,
  frontColumnLoss: 16,
  frontColumnSimple: 18,
  frontColumnDouble: 18,
  frontColumnPullout: 18,

  monthlyBarSize: 23,
  monthlyLabelFontSize: 9,
  monthlyMonthFontSize: 7.5,

  categoryBarSize: 28,
  categoryLabelFontSize: 7.5,
  categoryAxisFontSize: 7.5,
  categoryLineWidth: 2,
  categoryLineDotSize: 3.5
};

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const MEDALHAS = [imgOuro, imgPrata, imgBronze];

const CATEGORIES = [
  { key: 'cat_canaponta', label: 'Cana Ponta' },
  { key: 'cat_toco', label: 'Toco' },
  { key: 'cat_pedacofixo', label: 'Pedaço Fixo' },
  { key: 'cat_canainteira', label: 'Cana Inteira' },
  { key: 'cat_toleterepicado', label: 'Tolete Repicado' },
  { key: 'cat_estilhaco', label: 'Estilhaço' },
  { key: 'cat_lascas', label: 'Lascas' },
  { key: 'cat_pedacosolto', label: 'Pedaço Solto' }
];

const INDICATORS = [
  { key: 'perda_perc', title: 'Perda Total (%)', metaKey: 'perda' },
  { key: 'pisoteio_simples_perc', title: 'Pisoteio Simples (%)', metaKey: 'pisoteio_simples' },
  { key: 'pisoteio_duplo_perc', title: 'Pisoteio Duplo (%)', metaKey: 'pisoteio_duplo' },
  { key: 'arranquio_perc', title: 'Arranquio de Rizoma (%)', metaKey: 'arranquio' }
];

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const nullableNum = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const percent = (numerator, denominator) => denominator > 0 ? (numerator / denominator) * 100 : null;

const formatPercent = (value, decimals = 2) => (
  value == null || !Number.isFinite(Number(value))
    ? '-'
    : `${Number(value).toFixed(decimals).replace('.', ',')}%`
);

const frontSort = (a, b) => {
  const na = Number(a), nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
};

const fetchAllRows = async (view, columns = '*', pageSize = 1000) => {
  const result = [];
  let start = 0;
  while (true) {
    const { data, error } = await supabase.from(view).select(columns).range(start, start + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    result.push(...page);
    if (page.length < pageSize) break;
    start += pageSize;
  }
  return result;
};

const interpolateColor = (start, end, amount) => {
  const source = start.match(/\w\w/g).map((value) => parseInt(value, 16));
  const target = end.match(/\w\w/g).map((value) => parseInt(value, 16));
  const ratio = Math.max(0, Math.min(1, amount));
  const rgb = source.map((value, index) => Math.round(value + (target[index] - value) * ratio));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
};

const getCategoryColor = (value, minimum, maximum) => {
  if (maximum === minimum) return '#10b981';
  const ratio = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)));
  return ratio <= 0.5
    ? interpolateColor('#10b981', '#f59e0b', ratio / 0.5)
    : interpolateColor('#f59e0b', '#ef4444', (ratio - 0.5) / 0.5);
};

const Position = ({ position }) => position <= 3
  ? <img
      src={MEDALHAS[position - 1]}
      alt={`${position}º lugar`}
      title={`${position}º lugar`}
      style={{
        width: 'var(--pf-front-medal-size)',
        height: 'var(--pf-front-medal-size)',
        objectFit: 'contain',
        display: 'block',
        margin: '0 auto'
      }}
    />
  : <span style={{ fontSize: 'var(--pf-front-position-font)', fontWeight: 900 }}>{position}º</span>;

const CategoryXAxisTick = ({ x, y, payload }) => {
  const words = String(payload?.value || '').split(' ');
  const first = words[0] || '';
  const second = words.slice(1).join(' ');
  return (
    <g transform={`translate(${x},${y})`}>
      <text x="0" y="0" textAnchor="middle" fill="var(--pf-muted)" fontSize={FRENTE_LAYOUT.categoryAxisFontSize} fontWeight="900">
        <tspan x="0" dy="11">{first}</tspan>
        {second && <tspan x="0" dy="10">{second}</tspan>}
      </text>
    </g>
  );
};

const StatusValue = ({ value, meta }) => (
  <span className="frente-status-value" style={{ color: value == null ? 'var(--pf-muted)' : getStatusColor(value, meta) }}>
    {formatPercent(value)}
  </span>
);

const MonthlyTooltip = ({ active, payload, title }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="frente-tooltip"><strong>{title}</strong><span>{row.mesLabel}</span><b>{formatPercent(row.valor)}</b></div>;
};

const CategoryTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const selectionValue = num(row.valor);
  const harvestValue = num(row.safra);
  const difference = selectionValue - harvestValue;
  const isEqual = Math.abs(difference) < 0.0005;
  const selectionIsBetter = difference < 0;
  const borderColor = isEqual ? 'var(--pf-border)' : selectionIsBetter ? '#10b981' : '#ef4444';
  const selectionColor = isEqual ? 'var(--pf-text)' : selectionIsBetter ? '#10b981' : '#ef4444';
  const harvestColor = isEqual ? 'var(--pf-text)' : selectionIsBetter ? '#ef4444' : '#10b981';

  return (
    <div className={`frente-tooltip category-tooltip ${isEqual ? 'is-equal' : selectionIsBetter ? 'is-better' : 'is-worse'}`} style={{ borderColor }}>
      <strong>{row.label}</strong>
      <div><span>Seleção</span><b style={{ color: selectionColor }}>{selectionValue.toFixed(3).replace('.', ',')}</b></div>
      <div><span>Safra</span><b style={{ color: harvestColor }}>{harvestValue.toFixed(3).replace('.', ',')}</b></div>
    </div>
  );
};

const MonthlyChart = ({ title, data, meta }) => (
  <section className="frente-chart-panel">
    <div className="frente-panel-title"><strong>{title}</strong></div>
    <div className="frente-chart-body">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 4, left: 0, bottom: 3 }} barCategoryGap="25%">
          <XAxis dataKey="mesLabel" interval={0} axisLine={false} tickLine={false}
            tick={{ fill: 'var(--pf-muted)', fontSize: FRENTE_LAYOUT.monthlyMonthFontSize, fontWeight: 800 }} />
          <YAxis hide domain={[0, (maxValue) => Math.max(num(maxValue) * 1.22, num(meta) * 1.25, 1)]} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,.035)' }} content={<MonthlyTooltip title={title} />} />
          <ReferenceLine y={meta} stroke="#10b981" strokeDasharray="4 4"
            label={{ value: `Meta ${Number(meta || 0).toFixed(1).replace('.', ',')}%`, fill: '#10b981', fontSize: 7, fontWeight: 900, position: 'insideTopLeft' }} />
          <Bar dataKey="valor" radius={[5, 5, 1, 1]} barSize={FRENTE_LAYOUT.monthlyBarSize}>
            {data.map((row) => <Cell key={`${title}-${row.mes}`} fill={row.valor == null ? 'transparent' : getStatusColor(row.valor, meta)} />)}
            <LabelList dataKey="valor" position="top"
              formatter={(value) => value == null ? '' : `${Number(value).toFixed(1).replace('.', ',')}%`}
              fill="var(--pf-text)" fontSize={FRENTE_LAYOUT.monthlyLabelFontSize} fontWeight={900} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </section>
);

export default function DashPerdasFrente() {
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [selectedFronts, setSelectedFronts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cache, setCache] = useState({ general: [], fields: [], frontMonths: [], generalMonths: [], annual: [] });

  useEffect(() => {
    let active = true;
    const loadDashboard = async () => {
      setLoading(true); setError('');
      try {
        const [general, fields, frontMonths, generalMonths, annual] = await Promise.all([
          fetchAllRows('vw_q_perdamec_frentegeral'),
          fetchAllRows('vw_q_perdamec_frentecampo'),
          fetchAllRows('vw_q_perdamec_frentemes'),
          fetchAllRows('vw_q_perdamec_mes'),
          fetchAllRows('vw_q_perdamec_ano')
        ]);
        if (!active) return;
        const availableYears = [...new Set(general.map((row) => num(row.ano)).filter(Boolean))].sort((a, b) => b - a);
        setCache({ general, fields, frontMonths, generalMonths, annual });
        if (availableYears.length && !availableYears.includes(activeYear)) setActiveYear(availableYears[0]);
      } catch (loadError) {
        if (active) setError(loadError?.message || 'Não foi possível carregar os dados das frentes.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadDashboard();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const years = useMemo(() => [...new Set(cache.general.map((row) => num(row.ano)).filter(Boolean))].sort((a, b) => b - a), [cache.general]);
  const metas = useMemo(() => getMetasParaData(`${activeYear}-12-31`) || {}, [activeYear]);
  const annualRow = useMemo(() => cache.annual.find((row) => num(row.ano) === activeYear) || null, [cache.annual, activeYear]);

  // Ranking das frentes: menor perda primeiro. Valores sem perda ficam no final.
  const fronts = useMemo(() => cache.general
    .filter((row) => num(row.ano) === activeYear)
    .map((row) => ({ ...row, frente: String(row.frente), pontos: num(row.pontos), perda: nullableNum(row.perda_perc) }))
    .sort((a, b) => (a.perda ?? Infinity) - (b.perda ?? Infinity) || frontSort(a.frente, b.frente))
    .map((row, index) => ({ ...row, position: index + 1 })), [cache.general, activeYear]);

  useEffect(() => {
    setSelectedFronts((current) => {
      const allowed = new Set(fronts.map((row) => row.frente));
      return current.filter((front) => allowed.has(front));
    });
  }, [fronts]);

  const categoryData = useMemo(() => {
    const selected = new Set(selectedFronts);
    const source = fronts.filter((row) => !selected.size || selected.has(row.frente));
    const totalPoints = source.reduce((sum, row) => sum + num(row.pontos), 0);
    const rows = CATEGORIES.map((category) => {
      const weightedTotal = source.reduce((sum, row) => sum + num(row[category.key]) * num(row.pontos), 0);
      return { ...category, valor: totalPoints > 0 ? weightedTotal / totalPoints : 0, safra: annualRow ? num(annualRow[category.key]) : 0 };
    }).sort((a, b) => b.valor - a.valor);
    const values = rows.map((row) => row.valor);
    const minimum = values.length ? Math.min(...values) : 0;
    const maximum = values.length ? Math.max(...values) : 0;
    return rows.map((row) => ({ ...row, color: getCategoryColor(row.valor, minimum, maximum) }));
  }, [fronts, selectedFronts, annualRow]);

  const fieldRows = useMemo(() => {
    const selected = new Set(selectedFronts);
    return cache.fields
      .filter((row) => num(row.ano) === activeYear)
      .filter((row) => !selected.size || selected.has(String(row.frente)))
      .map((row) => ({ ...row, frente: String(row.frente), pontos: num(row.pontos), perda: nullableNum(row.perda_perc),
        pSimples: nullableNum(row.pisoteio_simples_perc), pDuplo: nullableNum(row.pisoteio_duplo_perc), arranquio: nullableNum(row.arranquio_perc) }))
      .sort((a, b) => (a.perda ?? Infinity) - (b.perda ?? Infinity) || String(a.campo || '').localeCompare(String(b.campo || ''), 'pt-BR'));
  }, [cache.fields, activeYear, selectedFronts]);

  const monthlyCharts = useMemo(() => {
    let monthlyRows;
    if (!selectedFronts.length) {
      monthlyRows = cache.generalMonths.filter((row) => num(row.ano) === activeYear).map((row) => ({
        mes: num(row.mes), perda_perc: nullableNum(row.perda_perc), pisoteio_simples_perc: nullableNum(row.pisoteio_simples_perc),
        pisoteio_duplo_perc: nullableNum(row.pisoteio_duplo_perc), arranquio_perc: nullableNum(row.arranquio_perc)
      }));
    } else {
      const selected = new Set(selectedFronts), map = new Map();
      cache.frontMonths.filter((row) => num(row.ano) === activeYear && selected.has(String(row.frente))).forEach((row) => {
        const month = num(row.mes);
        if (!map.has(month)) map.set(month, { mes: month, sumPerda: 0, sumTch: 0, mtS: 0, avS: 0, mtD: 0, avD: 0, arrancados: 0, fixos: 0 });
        const target = map.get(month), points = num(row.pontos);
        target.sumPerda += num(row.total_perda) * points; target.sumTch += num(row.tch_estimado) * points;
        target.mtS += num(row.mt_pisoteio_simples); target.avS += num(row.av_pisoteio_simples);
        target.mtD += num(row.mt_pisoteio_duplo); target.avD += num(row.av_pisoteio_duplo);
        target.arrancados += num(row.tocos_arrancados); target.fixos += num(row.tocos_fixos);
      });
      monthlyRows = [...map.values()].map((row) => ({ mes: row.mes,
        perda_perc: percent(row.sumPerda, row.sumPerda + row.sumTch), pisoteio_simples_perc: percent(row.mtS, row.avS),
        pisoteio_duplo_perc: percent(row.mtD, row.avD), arranquio_perc: percent(row.arrancados, row.fixos) }));
    }
    const monthMap = new Map(monthlyRows.map((row) => [num(row.mes), row]));
    return Object.fromEntries(INDICATORS.map((indicator) => [indicator.key, MONTHS.map((mesLabel, index) => {
      const mes = index + 1, row = monthMap.get(mes);
      return { mes, mesLabel, valor: row ? nullableNum(row[indicator.key]) : null };
    })]));
  }, [cache.frontMonths, cache.generalMonths, activeYear, selectedFronts]);

  const toggleFront = (front) => setSelectedFronts((current) => current.includes(front)
    ? current.filter((item) => item !== front)
    : [...current, front].sort(frontSort));

  const frontColumnWidths = [
    FRENTE_LAYOUT.frontColumnPosition,
    FRENTE_LAYOUT.frontColumnFront,
    FRENTE_LAYOUT.frontColumnPoints,
    FRENTE_LAYOUT.frontColumnLoss,
    FRENTE_LAYOUT.frontColumnSimple,
    FRENTE_LAYOUT.frontColumnDouble,
    FRENTE_LAYOUT.frontColumnPullout
  ];

  const fieldColumnWidths = [
    FRENTE_LAYOUT.fieldColumnFront,
    FRENTE_LAYOUT.fieldColumnField,
    FRENTE_LAYOUT.fieldColumnPoints,
    FRENTE_LAYOUT.fieldColumnLoss,
    FRENTE_LAYOUT.fieldColumnSimple,
    FRENTE_LAYOUT.fieldColumnDouble,
    FRENTE_LAYOUT.fieldColumnPullout
  ];

  const fieldCellStyle = {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  return (
    <div className="dash-perdas-frente" style={{
      '--pf-front-column': `${FRENTE_LAYOUT.frontColumnWidth}fr`, '--pf-field-column': `${FRENTE_LAYOUT.fieldColumnWidth}fr`,
      '--pf-chart-column': `${FRENTE_LAYOUT.chartColumnWidth}fr`, '--pf-gap': `${FRENTE_LAYOUT.gap}px`,
      '--pf-front-list': `${FRENTE_LAYOUT.frontListPercent}fr`, '--pf-category': `${FRENTE_LAYOUT.categoryPercent}fr`,
      '--pf-table-font': `${FRENTE_LAYOUT.fieldTableFontSize}px`, '--pf-table-head-font': `${FRENTE_LAYOUT.fieldTableHeaderFontSize}px`,
      '--pf-table-row-height': `${FRENTE_LAYOUT.fieldTableRowHeight}px`, '--pf-front-table-font': `${FRENTE_LAYOUT.frontTableFontSize}px`,
      '--pf-front-table-head-font': `${FRENTE_LAYOUT.frontTableHeaderFontSize}px`, '--pf-front-table-row-height': `${FRENTE_LAYOUT.frontTableRowHeight}px`,
      '--pf-front-position-font': `${FRENTE_LAYOUT.frontTablePositionFontSize}px`, '--pf-front-medal-size': `${FRENTE_LAYOUT.frontTableMedalSize}px`
    }}>
      <header className="frente-header">
        <div><span>QUALYFLOW • PERDAS MECANIZADAS</span><h1>Desempenho por Frente</h1></div>
        <div className="frente-header-actions">
          {!!selectedFronts.length && <button type="button" onClick={() => setSelectedFronts([])}>Limpar frentes ({selectedFronts.length})</button>}
          <label>Safra</label>
          <select value={activeYear} onChange={(event) => { setActiveYear(Number(event.target.value)); setSelectedFronts([]); }}>
            {years.length ? years.map((year) => <option key={year} value={year}>{year}</option>) : <option value={activeYear}>{activeYear}</option>}
          </select>
        </div>
      </header>

      {loading ? <div className="frente-state">Carregando dados das frentes...</div>
        : error ? <div className="frente-state is-error">{error}</div>
        : !fronts.length ? <div className="frente-state">Nenhuma frente encontrada para {activeYear}.</div>
        : <main className="frente-dashboard-grid">
          <div className="frente-summary-column">
            <section className="frente-selector-panel">
              <div className="frente-panel-title"><strong>Indicadores por frente</strong></div>
              <div className="frente-list-scroll">
                <table className="frente-list-table" style={{ tableLayout: 'fixed', width: '100%', fontSize: 'var(--pf-front-table-font)' }}>
                  <colgroup>
                    {frontColumnWidths.map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
                  </colgroup>
                  <thead style={{ fontSize: 'var(--pf-front-table-head-font)' }}>
                    <tr><th>#</th><th>Frente</th><th>Pts</th><th>Perda</th><th>P. Simple</th><th>P. Duplo</th><th>Arranquio</th></tr>
                  </thead>
                  <tbody>{fronts.map((row) => {
                    const selected = selectedFronts.includes(row.frente);
                    return <tr key={row.frente} className={`${selected ? 'is-selected' : ''} ${selectedFronts.length && !selected ? 'is-dimmed' : ''}`} onClick={() => toggleFront(row.frente)}>
                      <td style={{ textAlign: 'center' }}><Position position={row.position} /></td>
                      <td className="front-number">{row.frente}</td><td>{row.pontos}</td><td><StatusValue value={row.perda} meta={metas.perda} /></td>
                      <td><StatusValue value={nullableNum(row.pisoteio_simples_perc)} meta={metas.pisoteio_simples} /></td>
                      <td><StatusValue value={nullableNum(row.pisoteio_duplo_perc)} meta={metas.pisoteio_duplo} /></td>
                      <td><StatusValue value={nullableNum(row.arranquio_perc)} meta={metas.arranquio} /></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            </section>

            <section className="frente-category-panel">
              <div className="frente-panel-title"><strong>Média das categorias</strong></div>
              <div className="frente-category-legend"><span><i className="bar-key" />Seleção</span><span><i className="line-key" />Média da safra</span></div>
              <div className="frente-category-chart"><ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={categoryData} margin={{ top: 24, right: 7, left: 0, bottom: 31 }}>
                  <XAxis dataKey="label" interval={0} axisLine={false} tickLine={false} tick={<CategoryXAxisTick />} height={31} />
                  <YAxis hide domain={[0, (maximum) => Math.max(num(maximum) * 1.18, 1)]} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,.035)' }} content={<CategoryTooltip />} />
                  <Bar dataKey="valor" radius={[5, 5, 1, 1]} barSize={FRENTE_LAYOUT.categoryBarSize}>
                    {categoryData.map((row) => <Cell key={row.key} fill={row.color} />)}
                    <LabelList dataKey="valor" position="top" formatter={(value) => num(value).toFixed(2).replace('.', ',')}
                      fill="var(--pf-text)" fontSize={FRENTE_LAYOUT.categoryLabelFontSize} fontWeight={900} />
                  </Bar>
                  <Line type="monotone" dataKey="safra" stroke="#94a3b8" strokeWidth={FRENTE_LAYOUT.categoryLineWidth}
                    dot={{ r: FRENTE_LAYOUT.categoryLineDotSize, fill: '#94a3b8', stroke: '#f8fafc', strokeWidth: 1.5 }}
                    activeDot={{ r: FRENTE_LAYOUT.categoryLineDotSize + 1 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer></div>
            </section>
          </div>

          <div className="frente-field-column" style={{ minWidth: 0, width: '100%', overflow: 'hidden' }}>
            <section className="frente-fields-panel" style={{ minWidth: 0, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
              <div className="frente-panel-title"><strong>Indicadores por campo</strong><span>Campos Avaliados: {fieldRows.length}</span></div>
              <div className="frente-table-scroll" style={{ minWidth: 0, width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
                <table className="frente-table" style={{
                  tableLayout: 'fixed',
                  width: `${FRENTE_LAYOUT.fieldTableWidthPercent}%`,
                  minWidth: 0,
                  maxWidth: '100%'
                }}>
                  <colgroup>
                    {fieldColumnWidths.map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={fieldCellStyle}>Frente</th>
                      <th style={fieldCellStyle}>Campo</th>
                      <th style={fieldCellStyle}>Pts</th>
                      <th style={fieldCellStyle}>Perda</th>
                      <th style={fieldCellStyle} title="Pisoteio Simples">P. Simples</th>
                      <th style={fieldCellStyle} title="Pisoteio Duplo">P. Duplo</th>
                      <th style={fieldCellStyle}>Arranquio</th>
                    </tr>
                  </thead>
                  <tbody>{fieldRows.map((row) => <tr key={`${row.frente}-${row.codigo_campo}-${row.campo}`}>
                    <td className="frente-table-front" style={fieldCellStyle}>{row.frente}</td>
                    <td className="frente-table-field" style={fieldCellStyle} title={`${row.codigo_campo} - ${row.campo}`}>
                      <b>{row.codigo_campo}</b><span>{row.campo}</span>
                    </td>
                    <td className="frente-table-points" style={fieldCellStyle}>{row.pontos}</td>
                    <td style={fieldCellStyle}><StatusValue value={row.perda} meta={metas.perda} /></td>
                    <td style={fieldCellStyle}><StatusValue value={row.pSimples} meta={metas.pisoteio_simples} /></td>
                    <td style={fieldCellStyle}><StatusValue value={row.pDuplo} meta={metas.pisoteio_duplo} /></td>
                    <td style={fieldCellStyle}><StatusValue value={row.arranquio} meta={metas.arranquio} /></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="frente-charts-column">{INDICATORS.map((indicator) => <MonthlyChart key={indicator.key} title={indicator.title}
            data={monthlyCharts[indicator.key]} meta={num(metas[indicator.metaKey])} />)}</div>
        </main>}
    </div>
  );
}
