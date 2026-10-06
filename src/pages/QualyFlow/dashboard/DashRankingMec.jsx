import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getMetasParaData, getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import { BarChart, Bar, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import imgOuro from '../../../gallery/logo/medalha-de-ouro.png';
import imgPrata from '../../../gallery/logo/medalha-de-prata.png';
import imgBronze from '../../../gallery/logo/medalha-de-bronze.png';
import './DashRankingMec.css';

const TURNOS = ['1º Turno', '2º Turno'];
const MEDALHAS = [imgOuro, imgPrata, imgBronze];

// Ajustes principais. A tabela foi reduzida de 530px para 490px.
const RANKING_LAYOUT = {
  kpiTableWidth: 490,
  gap: 8,
  chartMinWidth: 620,
  chartItemWidth: 72,
  barSize: 34,
  tableRowHeight: 34,
  tableFontSize: 10,
  chartMachineFontSize: 10,
  chartPositionFontSize: 12,
  chartValueFontSize: 10,
  titleFontSize: 10,
  tableHeaderFontSize: 9,
  tableValueFontSize: 9,
  medalSize: 28,
  tablePositionFontSize: 9
};

const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const nullableNum = (v) => v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
const fmt = (v, d = 2) => v == null || !Number.isFinite(Number(v)) ? '-' : Number(v).toFixed(d).replace('.', ',');
const shortName = (v) => v ? String(v).split(' - ')[0].trim() : 'DESC';
const normalizeShift = (v) => /^1/.test(String(v ?? '').trim()) ? '1º Turno' : /^2/.test(String(v ?? '').trim()) ? '2º Turno' : String(v ?? '').trim();
const percent = (n, d) => d > 0 ? (n / d) * 100 : null;

const Position = ({ position }) => position <= 3
  ? <img className="ranking-medal" src={MEDALHAS[position - 1]} alt={`${position}º lugar`} />
  : <span className="ranking-position">{position}º</span>;

const StatusValue = ({ value, meta }) => (
  <span className="ranking-status-value" style={{ color: value == null ? 'var(--rank-muted)' : getStatusColor(value, meta) }}>
    {value == null ? '-' : `${fmt(value)}%`}
  </span>
);


const ChartXAxisTick = ({ x, y, payload, data }) => {
  const row = data?.[payload?.index] || {};
  return (
    <g transform={`translate(${x},${y})`}>
      <text className="ranking-chart-machine-label" x="0" y="0" textAnchor="middle">
        <tspan x="0" dy="12">{row.name || payload?.value}</tspan>
      </text>
      <text className="ranking-chart-position-label" x="0" y="0" textAnchor="middle">
        <tspan x="0" dy="25">{row.position ? `${row.position}º` : ''}</tspan>
      </text>
    </g>
  );
};

const ChartTooltip = ({ active, payload, shift, meta }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="ranking-tooltip">
    <strong>{shift}</strong><span>{row.fullName}</span>
    <div><small>Perda</small><b style={{ color: getStatusColor(row.perda, meta) }}>{fmt(row.perda)}%</b></div>
    <div><small>Pontos</small><b>{row.pontos}</b></div>
  </div>;
};

const ShiftChart = ({ shift, data, meta, selectedMachine, onSelect }) => {
  const width = Math.max(RANKING_LAYOUT.chartMinWidth, data.length * RANKING_LAYOUT.chartItemWidth);
  return <section className={`ranking-chart-panel ${shift === '1º Turno' ? 'is-first' : 'is-second'}`}>
    <div className="ranking-chart-head"><div><strong>{shift}</strong></div><b>{data.length} colhedoras</b></div>
    <div className="ranking-chart-scroll"><div className="ranking-chart-canvas" style={{ width }}>
      {!data.length ? <div className="ranking-chart-empty">Sem dados para este turno</div> :
        <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 27, right: 12, left: 1, bottom: 34 }} barCategoryGap="22%">
          <XAxis dataKey="name" interval={0} axisLine={false} tickLine={false} tick={<ChartXAxisTick data={data} />} height={42} />
          <YAxis hide domain={[0, (max) => Math.max(max * 1.22, num(meta) * 1.25, 1)]} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,.035)' }} content={<ChartTooltip shift={shift} meta={meta} />} />
          <ReferenceLine y={meta} stroke="#10b981" strokeDasharray="4 4" label={{ value: `Meta ${fmt(meta)}%`, fill: '#10b981', fontSize: 8, fontWeight: 900, position: 'insideTopLeft' }} />
          <Bar dataKey="perda" barSize={RANKING_LAYOUT.barSize} radius={[5, 5, 1, 1]} onClick={(d) => onSelect(d?.machine || d?.payload?.machine)}>
            {data.map((row) => {
              const selected = selectedMachine === row.machine;
              return <Cell key={`${shift}-${row.machine}`} fill={row.perda == null ? '#64748b' : getStatusColor(row.perda, meta)} fillOpacity={selectedMachine && !selected ? .2 : 1} stroke={selected ? '#f8fafc' : 'transparent'} strokeWidth={selected ? 2 : 0} cursor="pointer" />;
            })}
            <LabelList dataKey="perda" position="top" formatter={(v) => `${fmt(v, 2)}%`} fill="#e2e8f0" fontSize={RANKING_LAYOUT.chartValueFontSize} fontWeight={900} />
          </Bar>
        </BarChart></ResponsiveContainer>}
    </div></div>
  </section>;
};

export default function DashRankingMec() {
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [years, setYears] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [tableFilter, setTableFilter] = useState('geral');
  const metas = useMemo(() => getMetasParaData(`${activeYear}-12-31`) || {}, [activeYear]);

  useEffect(() => {
    let active = true;
    supabase.from('vw_q_perdamec_ano').select('ano').order('ano', { ascending: false }).then(({ data, error: e }) => {
      if (!active) return;
      if (e) return setError(e.message);
      const list = [...new Set((data || []).map(r => num(r.ano)).filter(Boolean))].sort((a, b) => b - a);
      setYears(list); if (list.length && !list.includes(activeYear)) setActiveYear(list[0]);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!activeYear) return;
    let active = true; setLoading(true); setError(''); setSelectedMachine('');
    supabase.from('vw_q_perdamec_colhedora').select('*').eq('ano', activeYear).then(({ data, error: e }) => {
      if (!active) return;
      if (e) { setError(e.message); setRawData([]); } else setRawData(data || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [activeYear]);

  const processed = useMemo(() => {
    const rows = rawData.map(r => {
      const avS = num(r.av_pisoteio_simples), mtS = num(r.mt_pisoteio_simples), avD = num(r.av_pisoteio_duplo), mtD = num(r.mt_pisoteio_duplo);
      return { ...r, machine: r.colhedora || 'DESC', name: shortName(r.colhedora), fullName: r.colhedora || 'DESC', shift: normalizeShift(r.turno), perda: nullableNum(r.perda_perc), pSimples: percent(mtS, avS), pDuplo: percent(mtD, avD), arranquio: nullableNum(r.arranquio_perc), totalPerda: num(r.total_perda), tch: num(r.tch_estimado), avS, mtS, avD, mtD, arrancados: num(r.tocos_arrancados), fixos: num(r.tocos_fixos), pontos: num(r.qnt_pontos) };
    });
    const chartData = Object.fromEntries(TURNOS.map(t => [t, rows.filter(r => r.shift === t).sort((a, b) => (a.perda ?? Infinity) - (b.perda ?? Infinity)).map((r, i) => ({ ...r, position: i + 1 }))]));
    const source = tableFilter === 'geral' ? rows : rows.filter(r => r.shift === tableFilter);
    const map = new Map();
    source.forEach(r => {
      if (!map.has(r.machine)) map.set(r.machine, { machine: r.machine, name: r.name, totalPerda: 0, tch: 0, mtS: 0, avS: 0, mtD: 0, avD: 0, arrancados: 0, fixos: 0, pontos: 0, perdas: [], arr: [] });
      const x = map.get(r.machine); x.totalPerda += r.totalPerda; x.tch += r.tch; x.mtS += r.mtS; x.avS += r.avS; x.mtD += r.mtD; x.avD += r.avD; x.arrancados += r.arrancados; x.fixos += r.fixos; x.pontos += r.pontos; if (r.perda != null) x.perdas.push(r.perda); if (r.arranquio != null) x.arr.push(r.arranquio);
    });
    const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
    const tableRows = [...map.values()].map(x => ({ ...x, perda: x.totalPerda + x.tch > 0 ? x.totalPerda / (x.totalPerda + x.tch) * 100 : avg(x.perdas), pSimples: percent(x.mtS, x.avS), pDuplo: percent(x.mtD, x.avD), arranquio: x.fixos > 0 ? percent(x.arrancados, x.fixos) : avg(x.arr) })).sort((a, b) => (a.perda ?? Infinity) - (b.perda ?? Infinity)).map((x, i) => ({ ...x, position: i + 1 }));
    return { chartData, tableRows };
  }, [rawData, tableFilter]);

  const selectMachine = machine => { if (machine) setSelectedMachine(current => current === machine ? '' : machine); };

  return <div className="dash-ranking-mec" style={{ '--ranking-kpi-width': `${RANKING_LAYOUT.kpiTableWidth}px`, '--ranking-layout-gap': `${RANKING_LAYOUT.gap}px`, '--ranking-table-row-height': `${RANKING_LAYOUT.tableRowHeight}px`, '--ranking-table-font-size': `${RANKING_LAYOUT.tableFontSize}px`, '--ranking-chart-machine-font-size': `${RANKING_LAYOUT.chartMachineFontSize}px`, '--ranking-chart-position-font-size': `${RANKING_LAYOUT.chartPositionFontSize}px`, '--ranking-title-font-size': `${RANKING_LAYOUT.titleFontSize}px`, '--ranking-table-header-font-size': `${RANKING_LAYOUT.tableHeaderFontSize}px`, '--ranking-table-value-font-size': `${RANKING_LAYOUT.tableValueFontSize}px`, '--ranking-medal-size': `${RANKING_LAYOUT.medalSize}px`, '--ranking-table-position-font-size': `${RANKING_LAYOUT.tablePositionFontSize}px` }}>
    <header className="ranking-header"><div><span className="ranking-eyebrow">QUALYFLOW • PERDAS MECANIZADAS</span><h1>Ranking de Colhedoras</h1></div><div className="ranking-year-control"><label>Safra</label><select value={activeYear} onChange={e => setActiveYear(Number(e.target.value))}>{years.length ? years.map(y => <option key={y}>{y}</option>) : <option>{activeYear}</option>}</select></div></header>
    {loading ? <div className="ranking-state">Carregando ranking...</div> : error ? <div className="ranking-state is-error">{error}</div> : !rawData.length ? <div className="ranking-state">Nenhum dado encontrado.</div> :
      <main className="ranking-layout"><div className="ranking-charts-column">
        {TURNOS.map(t => <ShiftChart key={t} shift={t} data={processed.chartData[t]} meta={metas.perda} selectedMachine={selectedMachine} onSelect={selectMachine} />)}
      </div><aside className="ranking-table-panel"><div className="ranking-table-head"><div><strong>KPIs por colhedora</strong></div><div className="ranking-filter-tags">{['geral', ...TURNOS].map(f => <button key={f} className={tableFilter === f ? 'is-active' : ''} onClick={() => setTableFilter(f)}>{f === 'geral' ? 'Geral' : f}</button>)}</div></div>
        <div className="ranking-table-scroll"><table className="ranking-table"><thead><tr><th>#</th><th>Colhedora</th><th>Pontos</th><th>Perda</th><th>P. Simples</th><th>P. Duplo</th><th>Arranquio</th></tr></thead><tbody>{processed.tableRows.map(r => <tr key={r.machine} className={`${selectedMachine === r.machine ? 'is-selected' : ''} ${selectedMachine && selectedMachine !== r.machine ? 'is-dimmed' : ''}`} onClick={() => selectMachine(r.machine)}><td className="ranking-position-cell"><Position position={r.position} /></td><td className="ranking-machine-cell">{r.name}</td><td>{r.pontos}</td><td><StatusValue value={r.perda} meta={metas.perda} /></td><td><StatusValue value={r.pSimples} meta={metas.pisoteio_simples} /></td><td><StatusValue value={r.pDuplo} meta={metas.pisoteio_duplo} /></td><td><StatusValue value={r.arranquio} meta={metas.arranquio} /></td></tr>)}</tbody></table></div>
      </aside></main>}
  </div>;
}
