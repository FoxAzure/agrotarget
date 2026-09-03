// ================================= DOCUMENTATION ==========================================
// Script: DashCUC.jsx
// Purpose: Dashboard histórico de CUC, vazão, entupimento e análise por lote.
// Data sources: vw_q_cucgeral e tb_q_agrotarget.
// Business rules: rulesCUC.js.
// Visual standard: QualyFlow Dashboard Dark/Green V2.
// Shared styles: BaseDash.css + bloco CUC ao final do arquivo.
// Future modules: visão por DEPA pode ser adicionada abaixo do bloco principal.
// ==========================================================================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart,
  Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { supabase } from '../../../lib/supabaseClient';
import {
  CUC_RULES, getCucColor, getEntupColor, getVazaoColor,
  getComparison, getMetricMetaLabel
} from '../../../components/QualyFlow/rulesCUC';
import './BaseDash.css';

// ================================= CONFIGURATION ==========================================
const DASH_CONFIG = {
  sidebarWidth: 240,
  contentGap: 9,
  headerHeight: 218,
  lotChartHeight: 230,
  bottomHeight: 330,
  visibleLots: 25,
  minimumLotWidth: 34,
  evaluationCardWidth: 108,
  donutInnerRadius: '65%',
  donutOuterRadius: '86%',
  animationDuration: 800,
};

const CUC_OCORRENCIAS = ['CUC - Gotejo', 'CUC - Gotejo 9E'];
const EMISSORES_VALIDOS = Array.from({ length: 12 }, (_, i) => `${i + 1}º Emissor`);
const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const FLOW_BANDS = [
  { key: 'lt08', label: '<0,8 L/h', short: '<0,8', color: '#ef4444' },
  { key: 'b08_09', label: '0,8 a 0,9 L/h', short: '0,8–0,9', color: '#f97316' },
  { key: 'b09_11', label: '0,9 a 1,1 L/h', short: '0,9–1,1', color: '#10b981' },
  { key: 'b11_12', label: '1,1 a 1,2 L/h', short: '1,1–1,2', color: '#f59e0b' },
  { key: 'gt12', label: '>1,2 L/h', short: '>1,2', color: '#3b82f6' },
];

// ================================= HELPERS =================================================
const num = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const text = (value, fallback = '') => String(value ?? fallback).trim();
const formatValue = (value, decimals = 1) => {
  if (value === null || value === undefined || value === '') return '-';
  return num(value).toFixed(decimals).replace('.', ',');
};
const formatDate = value => {
  const raw = text(value);
  if (!raw) return '-';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [y, m, d] = raw.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return raw;
};
const monthYear = value => {
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return `${MONTHS[num(raw.slice(5, 7)) - 1]}/${raw.slice(0, 4)}`;
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return `${MONTHS[num(raw.slice(3, 5)) - 1]}/${raw.slice(6, 10)}`;
  return '-';
};
const dateTime = value => {
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return new Date(`${raw.slice(0, 10)}T12:00:00`).getTime();
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
    const [d, m, y] = raw.slice(0, 10).split('/');
    return new Date(`${y}-${m}-${d}T12:00:00`).getTime();
  }
  return 0;
};
const fieldKey = row => text(row?.codigo_campo || row?.campo);
const evaluationKey = row => row ? `${fieldKey(row)}|${row.ano}|${row.avaliacao}|${text(row.dt_final)}` : '';
const sortOldest = (a, b) => dateTime(a.dt_final) - dateTime(b.dt_final) || num(a.ano) - num(b.ano) || num(a.avaliacao) - num(b.avaliacao);
const sortNewest = (a, b) => sortOldest(b, a);
const calculateCuc = values => {
  const valid = (values || []).map(v => num(v, NaN)).filter(v => Number.isFinite(v) && v > 0);
  if (!valid.length) return null;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  const deviation = valid.reduce((sum, value) => sum + Math.abs(value - mean), 0);
  return 100 * (1 - deviation / (valid.length * mean));
};
const bandFor = lh => lh < 0.8 ? 'lt08' : lh < 0.9 ? 'b08_09' : lh <= 1.1 ? 'b09_11' : lh <= 1.2 ? 'b11_12' : 'gt12';

// ================================= COMPONENTS =============================================
function Comparison({ current, previous, metric }) {
  const result = getComparison(metric, current, previous);
  return (
    <div className={`cuc-comparison ${result.tone}`}>
      <span className="cuc-comparison-icon">{result.icon}</span>
      <strong>{result.label}</strong>
    </div>
  );
}

function EvaluationCard({ row, selected, onSelect }) {
  return (
    <button className={`cuc-eval-card ${selected ? 'active' : ''}`} onClick={onSelect}>
      <span>{row.avaliacao}ª Av/{row.ano}</span>
      <strong style={{ color: getCucColor(row.cuc) }}>{formatValue(row.cuc)}%</strong>
      <small>{monthYear(row.dt_final)}</small>
    </button>
  );
}

function MetricDonut({ title, value, previous, metric, decimals = 1, unit = '%' }) {
  const safeValue = Number.isFinite(num(value, NaN)) ? num(value) : 0;
  const max = metric === 'vazao' ? 1.5 : 100;
  const progress = Math.max(0, Math.min(max, safeValue));
  const color = metric === 'cuc' ? getCucColor(value) : metric === 'vazao' ? getVazaoColor(value) : getEntupColor(value);
  const data = [{ value: progress }, { value: Math.max(0, max - progress) }];
  return (
    <div className="q-panel cuc-header-cell cuc-metric-card">
      <div className="q-panel-title indicator-title"><span>{title}</span><small>{getMetricMetaLabel(metric)}</small></div>
      <div className="cuc-donut-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" startAngle={90} endAngle={-270}
              innerRadius={DASH_CONFIG.donutInnerRadius} outerRadius={DASH_CONFIG.donutOuterRadius}
              stroke="transparent" isAnimationActive animationDuration={DASH_CONFIG.animationDuration}>
              <Cell fill={color} /><Cell fill="rgba(148,163,184,.13)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="cuc-donut-value"><strong style={{ color }}>{formatValue(value, decimals)}</strong><span>{unit}</span></div>
      </div>
      <Comparison current={value} previous={previous} metric={metric} />
    </div>
  );
}

function Histogram({ totals }) {
  const data = FLOW_BANDS.map(band => ({ ...band, value: totals?.[band.key] || 0 }));
  return (
    <div className="q-panel cuc-header-cell">
      <div className="q-panel-title indicator-title"><span>Distribuição de Vazão</span><small>Emissores</small></div>
      <div className="cuc-header-chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 2, left: 2, bottom: 0 }} barCategoryGap="18%">
            <XAxis dataKey="short" tick={{ fill: 'var(--text-muted)', fontSize: 7, fontWeight: 700 }} axisLine={false} tickLine={false} interval={0} />
            <YAxis hide domain={[0, max => Math.max(max, 1)]} />
            <Tooltip contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-main)' }} formatter={v => [v, 'Emissores']} />
            <Bar dataKey="value" radius={[4,4,1,1]} isAnimationActive animationDuration={DASH_CONFIG.animationDuration}>
              {data.map(item => <Cell key={item.key} fill={item.color} />)}
              <LabelList dataKey="value" position="top" fill="var(--text-main)" fontSize={8} fontWeight="bold" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function LotChart({ lots, onSelect }) {
  const chartWidth = Math.max(100, lots.length * (100 / DASH_CONFIG.visibleLots));
  return (
    <div className="cuc-lot-scroll">
      <div className="cuc-lot-chart" style={{ width: `${chartWidth}%`, minWidth: `${DASH_CONFIG.visibleLots * DASH_CONFIG.minimumLotWidth}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={lots} margin={{ top: 20, right: 8, left: 0, bottom: 2 }} barCategoryGap="22%" onClick={state => state?.activePayload?.[0]?.payload && onSelect(state.activePayload[0].payload)}>
            <CartesianGrid vertical={false} stroke="rgba(51,65,85,.45)" strokeDasharray="3 3" />
            <XAxis dataKey="loteFormatado" tick={{ fill: 'var(--text-muted)', fontSize: 8, fontWeight: 700 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} hide />
            <ReferenceLine y={90} stroke="var(--q-green)" strokeDasharray="4 4" label={{ value: 'Meta 90%', fill: 'var(--q-green)', fontSize: 8, position: 'insideTopLeft' }} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,.04)' }} contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-main)' }} formatter={v => [`${formatValue(v)}%`, 'CUC']} labelFormatter={v => `Lote ${v} • clique para abrir`} />
            <Bar dataKey="cuc" radius={[4,4,1,1]} isAnimationActive animationDuration={DASH_CONFIG.animationDuration}>
              {lots.map(lot => <Cell key={lot.loteRaw} fill={getCucColor(lot.cuc)} />)}
              <LabelList dataKey="cuc" position="top" formatter={v => `${formatValue(v,0)}%`} fill="var(--text-main)" fontSize={7} fontWeight="bold" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EvolutionTooltip({ active, payload, evaluations }) {
  if (!active || !payload?.length) return null;
  const current = payload[0].payload;
  const index = evaluations.findIndex(row => evaluationKey(row) === evaluationKey(current));
  const previous = index > 0 ? evaluations[index - 1] : null;
  return (
    <div className="chart-tooltip cuc-evolution-tooltip">
      <strong>{current.avaliacao}ª Av/{current.ano}</strong>
      {!previous ? <div className="cuc-tooltip-empty">S/Histórico</div> : (
        <table><thead><tr><th>Indicador</th><th>{previous.avaliacao}ª/{previous.ano}</th><th></th><th>{current.avaliacao}ª/{current.ano}</th></tr></thead>
          <tbody>
            {[['CUC', 'cuc', '%'], ['Vazão', 'vazao', ' L/h'], ['Entup.', 'entup%', '%']].map(([label,key,unit]) => {
              const comp = getComparison(key === 'entup%' ? 'entup' : key, current[key], previous[key]);
              return <tr key={key}><td>{label}</td><td>{formatValue(previous[key], key === 'vazao' ? 2 : 1)}{unit}</td><td className={comp.tone}>{comp.icon}</td><td>{formatValue(current[key], key === 'vazao' ? 2 : 1)}{unit}</td></tr>;
            })}
          </tbody></table>
      )}
    </div>
  );
}

function EvolutionChart({ evaluations }) {
  const data = [...evaluations].sort(sortOldest).map(row => ({ ...row, label: `${row.avaliacao}ª/${row.ano}` }));
  return (
    <div className="cuc-evolution-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 22, right: 18, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="rgba(51,65,85,.45)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 8, fontWeight: 700 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis domain={[70, 100]} hide />
          <ReferenceLine y={CUC_RULES.cuc.target} stroke="var(--q-green)" strokeDasharray="4 4" />
          <Tooltip content={<EvolutionTooltip evaluations={data} />} />
          <Line type="monotone" dataKey="cuc" stroke="var(--q-green)" strokeWidth={3} dot={{ r: 4, fill: 'var(--bg-panel)', strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive animationDuration={1100} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function LotTable({ lots }) {
  const maxByBand = FLOW_BANDS.reduce((acc, band) => ({ ...acc, [band.key]: Math.max(1, ...lots.map(l => l.bands[band.key])) }), {});
  return (
    <div className="q-table-container cuc-lot-table-wrap"><table className="q-table cuc-lot-table">
      <thead><tr><th>Lote</th><th>Av.</th>{FLOW_BANDS.map(b => <th key={b.key} className={`band-head ${b.key}`}>{b.label}</th>)}<th>Média L/h</th><th>Total Entup.</th><th>Entup. %</th><th>CUC %</th></tr></thead>
      <tbody>{lots.map(lot => <tr key={lot.loteRaw}>
        <td className="text-center">{lot.loteFormatado}</td><td className="text-center">{lot.emissores.length}</td>
        {FLOW_BANDS.map(b => <td key={b.key} className="text-center cuc-heat-cell" style={{ '--heat': lot.bands[b.key] / maxByBand[b.key] }}>{lot.bands[b.key]}</td>)}
        <td className="text-right" style={{ color: getVazaoColor(lot.vazao), fontWeight: 800 }}>{formatValue(lot.vazao,2)}</td>
        <td className="text-center">{lot.entupidos}</td><td className="text-right" style={{ color: getEntupColor(lot.entupPerc), fontWeight: 800 }}>{formatValue(lot.entupPerc)}%</td>
        <td className="text-right" style={{ color: getCucColor(lot.cuc), fontWeight: 800 }}>{formatValue(lot.cuc)}%</td>
      </tr>)}</tbody>
    </table></div>
  );
}

function LoteModal({ evaluation, lot, onClose }) {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [unit, setUnit] = useState('L/h');
  useEffect(() => { let active = true; (async () => {
    setLoading(true); const { data, error } = await supabase.from('tb_q_agrotarget').select('lote,indicador,valor,turno').eq('ano', num(evaluation.ano)).eq('campo', text(evaluation.campo)).eq('extra1', text(evaluation.avaliacao)).eq('lote', text(lot.loteRaw)).in('ocorrencia', CUC_OCORRENCIAS);
    if (error) console.error('CUC lote:', error); if (active) { setRows(data || []); setLoading(false); }
  })(); return () => { active = false; }; }, [evaluation, lot]);
  const emitters = useMemo(() => rows.filter(r => EMISSORES_VALIDOS.includes(text(r.indicador))).sort((a,b) => EMISSORES_VALIDOS.indexOf(a.indicador)-EMISSORES_VALIDOS.indexOf(b.indicador)), [rows]);
  return <div className="cuc-modal-backdrop" onMouseDown={onClose}><div className="cuc-modal" onMouseDown={e => e.stopPropagation()}>
    <header><div><strong>Lote {lot.loteFormatado}</strong><small>{evaluation.campo} • {evaluation.avaliacao}ª Av/{evaluation.ano} • {lot.turno}</small></div><button onClick={onClose}>×</button></header>
    <main>{loading ? <div className="dashboard-empty">Consultando emissores...</div> : <><div className="cuc-modal-summary"><span>CUC <b style={{color:getCucColor(lot.cuc)}}>{formatValue(lot.cuc)}%</b></span><span>Vazão <b style={{color:getVazaoColor(lot.vazao)}}>{formatValue(lot.vazao,2)} L/h</b></span><span>Entup. <b style={{color:getEntupColor(lot.entupPerc)}}>{formatValue(lot.entupPerc)}%</b></span></div>
      <div className="cuc-modal-toolbar"><strong>Emissores coletados</strong><div><button className={unit==='mL'?'active':''} onClick={()=>setUnit('mL')}>mL</button><button className={unit==='L/h'?'active':''} onClick={()=>setUnit('L/h')}>L/h</button></div></div>
      <div className="cuc-emitter-grid">{emitters.map((r,i) => { const lh=num(r.valor)*.02; return <div key={`${r.indicador}-${i}`}><small>{r.indicador}</small><strong style={{color:getVazaoColor(lh)}}>{unit==='mL'?formatValue(r.valor,0):formatValue(lh,2)}</strong></div>; })}</div></>}</main>
  </div></div>;
}

// ================================= EXECUTOR ===============================================
export default function DashCUC() {
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [search, setSearch] = useState(''); const [selectedFieldKey, setSelectedFieldKey] = useState(''); const [selectedEvaluationKey, setSelectedEvaluationKey] = useState('');
  const [lots, setLots] = useState([]); const [loadingLots, setLoadingLots] = useState(false); const [selectedLot, setSelectedLot] = useState(null);
  const evaluationScrollRef = useRef(null);

  useEffect(() => { let active=true; (async()=>{ setLoading(true); setError(''); const {data,error:e}=await supabase.from('vw_q_cucgeral').select('*').order('dt_final',{ascending:false}); if(!active)return; if(e)setError(e.message); else setRows((data||[]).map(r=>({...r,ano:num(r.ano),avaliacao:text(r.avaliacao),codigo_campo:text(r.codigo_campo),campo:text(r.campo||r.codigo_campo),depa:text(r.depa,'SEM DEPA'),setor:text(r.setor,'SEM SETOR'),cuc:num(r.cuc),vazao:num(r.vazao),'entup%':num(r['entup%'])}))); setLoading(false); })(); return()=>{active=false}; },[]);

  const fields=useMemo(()=>{const map=new Map(); rows.forEach(r=>{const k=fieldKey(r);if(!k)return;if(!map.has(k))map.set(k,{key:k,campo:r.campo,codigo_campo:r.codigo_campo,depa:r.depa,setor:r.setor,evaluations:[]});map.get(k).evaluations.push(r)});map.forEach(f=>f.evaluations.sort(sortNewest));return [...map.values()].sort((a,b)=>dateTime(b.evaluations[0]?.dt_final)-dateTime(a.evaluations[0]?.dt_final));},[rows]);
  const filteredFields=useMemo(()=>{const term=search.toLowerCase().trim();return term?fields.filter(f=>`${f.campo} ${f.codigo_campo}`.toLowerCase().includes(term)):fields;},[fields,search]);
  useEffect(()=>{if(fields.length&&!fields.some(f=>f.key===selectedFieldKey))setSelectedFieldKey(fields[0].key)},[fields,selectedFieldKey]);
  const activeField=fields.find(f=>f.key===selectedFieldKey)||fields[0]||null;
  useEffect(()=>{if(activeField&&!activeField.evaluations.some(r=>evaluationKey(r)===selectedEvaluationKey))setSelectedEvaluationKey(evaluationKey(activeField.evaluations[0]))},[activeField,selectedEvaluationKey]);
  const selectedEvaluation=activeField?.evaluations.find(r=>evaluationKey(r)===selectedEvaluationKey)||activeField?.evaluations[0]||null;
  const selectedIndex=activeField?.evaluations.findIndex(r=>evaluationKey(r)===evaluationKey(selectedEvaluation))??-1;
  const previousEvaluation=selectedIndex>=0?activeField?.evaluations[selectedIndex+1]||null:null;
  const chronologicalEvaluations=useMemo(()=>activeField?[...activeField.evaluations].sort(sortOldest):[],[activeField]);
  useEffect(()=>{requestAnimationFrame(()=>{if(evaluationScrollRef.current)evaluationScrollRef.current.scrollLeft=evaluationScrollRef.current.scrollWidth})},[activeField]);

  useEffect(()=>{let active=true;(async()=>{if(!selectedEvaluation){setLots([]);return}setLoadingLots(true);const{data,error:e}=await supabase.from('tb_q_agrotarget').select('lote,indicador,valor,turno').eq('ano',num(selectedEvaluation.ano)).eq('campo',text(selectedEvaluation.campo)).eq('extra1',text(selectedEvaluation.avaliacao)).in('ocorrencia',CUC_OCORRENCIAS);if(e)console.error('CUC lotes:',e);if(!active)return;const map=new Map();(data||[]).forEach(r=>{const raw=text(r.lote,'0');if(!map.has(raw))map.set(raw,{loteRaw:raw,emissores:[],entupidos:0,turno:text(r.turno,'SEM TURNO')});const lot=map.get(raw);if(EMISSORES_VALIDOS.includes(text(r.indicador)))lot.emissores.push(num(r.valor));if(text(r.indicador)==='Emissores Entupidos')lot.entupidos+=num(r.valor)});const processed=[...map.values()].map(l=>{const avg=l.emissores.length?l.emissores.reduce((a,b)=>a+b,0)/l.emissores.length:null;const n=parseInt(l.loteRaw,10);const bands={lt08:0,b08_09:0,b09_11:0,b11_12:0,gt12:0};l.emissores.forEach(v=>{bands[bandFor(v*.02)]+=1});return{...l,bands,loteNum:Number.isNaN(n)?999999:n,loteFormatado:Number.isNaN(n)?l.loteRaw:String(n).padStart(2,'0'),cuc:calculateCuc(l.emissores),vazao:avg===null?null:avg*.02,entupPerc:l.emissores.length?(l.entupidos/l.emissores.length)*100:null}}).sort((a,b)=>a.loteNum-b.loteNum);setLots(processed);setLoadingLots(false)})();return()=>{active=false}},[selectedEvaluation]);
  const histogram=useMemo(()=>lots.reduce((acc,l)=>{FLOW_BANDS.forEach(b=>acc[b.key]+=l.bands[b.key]);return acc},{lt08:0,b08_09:0,b09_11:0,b11_12:0,gt12:0}),[lots]);
  const selectField=f=>{setSelectedFieldKey(f.key);setSelectedEvaluationKey(evaluationKey(f.evaluations[0]));setSelectedLot(null)};

  if(loading)return <div className="dashboard-loading"><h2>Carregando histórico CUC...</h2></div>;
  if(error)return <div className="dashboard-error">Erro ao carregar CUC: {error}</div>;
  if(!fields.length)return <div className="dashboard-empty">Nenhuma avaliação CUC encontrada.</div>;

  return <div className="dash-dark-container dash-cuc" style={{'--cuc-sidebar-width':`${DASH_CONFIG.sidebarWidth}px`}}>
    <aside className="dash-sidebar cuc-sidebar"><div className="sidebar-header"><h2>CAMPOS</h2></div><div className="cuc-search"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar campo..."/>{search&&<button onClick={()=>setSearch('')}>×</button>}</div><div className="sidebar-date-list">{filteredFields.map(f=>{const latest=f.evaluations[0];return <button key={f.key} className={`sidebar-date-item cuc-field-item ${f.key===activeField?.key?'active':''}`} onClick={()=>selectField(f)}><span><small>{latest.avaliacao}ª Av/{latest.ano}</small><strong>{f.campo}</strong></span><b style={{color:getCucColor(latest.cuc)}}>{formatValue(latest.cuc)}%</b></button>})}{!filteredFields.length&&<div className="dashboard-empty compact">Nenhum campo.</div>}</div></aside>
    <main className="dash-main cuc-main">
      <section className="cuc-header-grid" style={{height:DASH_CONFIG.headerHeight}}>
        <div className="q-panel cuc-header-cell cuc-field-card"><div className="cuc-field-title"><h1>{selectedEvaluation?.campo}</h1><div><span>{selectedEvaluation?.depa}</span><span>{selectedEvaluation?.setor}</span></div></div><div className="cuc-evaluation-list" ref={evaluationScrollRef}>{chronologicalEvaluations.map(row=><EvaluationCard key={evaluationKey(row)} row={row} selected={evaluationKey(row)===selectedEvaluationKey} onSelect={()=>{setSelectedEvaluationKey(evaluationKey(row));setSelectedLot(null)}}/>)}</div></div>
        <Histogram totals={histogram}/>
        <MetricDonut title="CUC Geral" value={selectedEvaluation?.cuc} previous={previousEvaluation?.cuc} metric="cuc" />
        <MetricDonut title="Vazão Média" value={selectedEvaluation?.vazao} previous={previousEvaluation?.vazao} metric="vazao" decimals={2} unit="L/h" />
        <MetricDonut title="Entupidos" value={selectedEvaluation?.['entup%']} previous={previousEvaluation?.['entup%']} metric="entup" />
      </section>
      <section className="q-panel cuc-lots-panel"><div className="q-panel-title"><span>Desempenho por Lote</span><small>{loadingLots?'Atualizando...':`${lots.length} lotes • clique para abrir os emissores`}</small></div><LotChart lots={lots} onSelect={setSelectedLot}/></section>
      <section className="cuc-bottom-grid" style={{height:DASH_CONFIG.bottomHeight}}>
        <div className="q-panel cuc-bottom-panel"><div className="q-panel-title"><span>Resultados por Lote</span><small>{lots.length} lotes</small></div><LotTable lots={lots}/></div>
        <div className="q-panel cuc-bottom-panel"><div className="q-panel-title"><span>Evolução das Avaliações</span><small>Primeira avaliação → última avaliação</small></div><EvolutionChart evaluations={activeField?.evaluations||[]}/></div>
      </section>
      {/* MÓDULO FUTURO: inserir aqui a visão por DEPA mantendo q-panel e a grade padrão. */}
    </main>
    {selectedLot&&selectedEvaluation&&<LoteModal evaluation={selectedEvaluation} lot={selectedLot} onClose={()=>setSelectedLot(null)}/>} 
  </div>;
}
