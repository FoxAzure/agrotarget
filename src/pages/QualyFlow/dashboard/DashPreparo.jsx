import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { BarChart, Bar, Cell, LabelList, LineChart, Line, Dot, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import './BaseDash.css';
import './DashPreparo.css';

const MONTHS = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const FONT_SIZE = { base:10, xs:10, sm:10, md:11, lg:12, title:11, chartLabel:10, chartValue:10, tableValue:12 };
const METAS_PREPARO = {
  profundidade:{ meta:90, atencao:80 },
  paralelismo:{ meta:80, atencao:70 },
};
const DASH_LAYOUT = {
  sidebarWidth:210, contentPadding:7, gap:6,
  table:1.63, dayYear:.36, monthly:.96,
  rowHeight:190, BAR_WIDTH:24, dayYearBarGap:6, dayYearCategoryGap:'26%',
};
const METRICS = [
  { key:'profund_haste', label:'Profund. Haste', tableTitle:'Profundidade da Haste (Mín 23cm)', unitDecimals:0, monthlyKey:'profund_haste', metaGroup:'profundidade', compliance:v=>Number.isFinite(v)&&v>=23, targetText:'≥ 23 cm', unit:'cm' },
  { key:'profund_cana', label:'Profund. Cana', tableTitle:'Profundidade da Cana (Mín 18cm)', unitDecimals:0, monthlyKey:'profund_cana', metaGroup:'profundidade', compliance:v=>Number.isFinite(v)&&v>=18, targetText:'≥ 18 cm', unit:'cm' },
  { key:'paralelismo_sulco', label:'Paralelismo Sulco', tableTitle:'Paralelismo entre Sulcos (Entre 1,45 a 1,55cm)', unitDecimals:2, monthlyKey:'paralelismo_sulco', metaGroup:'paralelismo', compliance:v=>Number.isFinite(v)&&v>=1.45&&v<=1.55, targetText:'1,45–1,55 cm', unit:'cm' },
  { key:'paralelismo_fita', label:'Paralelismo Fita', tableTitle:'Paralelismo entre Fitas (Entre 2,15 a 2,25cm)', unitDecimals:2, monthlyKey:'paralelismo_fita', metaGroup:'paralelismo', compliance:v=>Number.isFinite(v)&&v>=2.15&&v<=2.25, targetText:'2,15–2,25 cm', unit:'cm' },
];

const num=(value,fallback=NaN)=>{ if(value===null||value===undefined||value==='')return fallback; const n=Number(String(value).replace(',','.')); return Number.isFinite(n)?n:fallback; };
const text=(value,fallback='')=>String(value??'').trim()||fallback;
const formatNumber=(value,d=2)=>{const n=num(value);return Number.isFinite(n)?n.toFixed(d).replace('.',','):'—';};
const formatPercent=value=>{const n=num(value);return Number.isFinite(n)?`${n.toFixed(1).replace('.',',')}%`:'—';};
const formatDate=value=>{const raw=text(value);if(!raw)return'—';if(/^\d{4}-\d{2}-\d{2}/.test(raw)){const[y,m,d]=raw.slice(0,10).split('-');return`${d}/${m}/${y}`;}return raw.slice(0,10);};
const getMetricMeta=metric=>METAS_PREPARO[metric.metaGroup]||METAS_PREPARO.profundidade;
const complianceColor=(value,metric)=>{const v=num(value);if(!Number.isFinite(v))return'var(--text-muted)';const m=getMetricMeta(metric);return v>=m.meta?'var(--q-green)':v>=m.atencao?'var(--q-warning)':'var(--q-danger)';};
const complianceSoft=(value,metric)=>{const v=num(value);if(!Number.isFinite(v))return'rgba(100,116,139,.12)';const m=getMetricMeta(metric);return v>=m.meta?'var(--q-green-glow)':v>=m.atencao?'rgba(245,158,11,.14)':'var(--q-danger-glow)';};

const calculateTableSummary=(items,metric)=>{
  const values=(items||[]).flatMap(i=>(i.points||[]).map(p=>num(p.value))).filter(Number.isFinite);
  if(!values.length)return{measuredCount:0,average:null,standardCount:0};
  return{measuredCount:values.length,average:values.reduce((a,b)=>a+b,0)/values.length,standardCount:values.filter(metric.compliance).length};
};

const buildMetricRows=(rows,metric)=>{
  const grouped=new Map();
  (rows||[]).forEach(row=>{const field=text(row.campo,'SEM CAMPO');const lot=text(row.lote,'—');const key=`${field}||${lot}`;if(!grouped.has(key))grouped.set(key,{field,lot,rows:[]});grouped.get(key).rows.push(row);});
  const result=[];
  Array.from(grouped.values()).sort((a,b)=>a.field.localeCompare(b.field,'pt-BR')||a.lot.localeCompare(b.lot,'pt-BR',{numeric:true})).forEach(group=>{
    const measured=group.rows.slice().sort((a,b)=>num(a.ponto,999999)-num(b.ponto,999999)).map(row=>({sourcePoint:num(row.ponto),value:num(row[metric.key])})).filter(i=>Number.isFinite(i.value)&&i.value!==0);
    for(let start=0;start<measured.length;start+=12){const chunk=measured.slice(start,start+12);const standardCount=chunk.filter(i=>metric.compliance(i.value)).length;result.push({id:`${group.field}-${group.lot}-${metric.key}-${start}`,field:group.field,lot:group.lot,points:chunk.map((i,index)=>({point:index+1,...i})),standardCount,measuredCount:chunk.length,percentage:(standardCount/chunk.length)*100});}
  });
  return result;
};

function ComplianceBadge({value,metric}){const color=complianceColor(value,metric);return <span className="preparo-compliance-badge" style={{color,background:complianceSoft(value,metric),borderColor:color}}>{formatPercent(value)}</span>;}

function DayYearChart({metric,dayValue,yearValue,yearLabel}){
  const meta=getMetricMeta(metric);
  const data=[{name:'Dia',value:dayValue,color:complianceColor(dayValue,metric)},{name:String(yearLabel||'Ano'),value:yearValue,color:complianceColor(yearValue,metric)}];
  return <div className="preparo-chart-panel preparo-dayyear-panel">
    <div className="preparo-panel-title">{metric.label}</div>
    <div className="preparo-chart-body"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{top:20,right:2,left:2,bottom:0}} barGap={DASH_LAYOUT.dayYearBarGap} barCategoryGap={DASH_LAYOUT.dayYearCategoryGap}>
      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'var(--text-muted)',fontSize:FONT_SIZE.chartLabel,fontWeight:800}}/><YAxis domain={[0,100]} hide/><ReferenceLine y={meta.meta} stroke="var(--q-green)" strokeDasharray="3 3"/>
      <Bar dataKey="value" barSize={DASH_LAYOUT.BAR_WIDTH} radius={[5,5,1,1]}>{data.map((e,i)=><Cell key={i} fill={e.color}/>)}<LabelList dataKey="value" position="top" formatter={v=>Number.isFinite(num(v))?`${formatNumber(v,1)}%`:''} fill="var(--text-main)" fontSize={FONT_SIZE.chartValue} fontWeight={900}/></Bar>
    </BarChart></ResponsiveContainer></div>
  </div>;
}
function MonthlyDot({cx,cy,payload,metric}){return Number.isFinite(payload?.value)?<Dot cx={cx} cy={cy} r={3.5} fill={complianceColor(payload.value,metric)} stroke="var(--preparo-panel)" strokeWidth={1.5}/>:null;}
function MonthlyChart({metric,data}){
  const meta=getMetricMeta(metric);
  const safeData=Array.from({length:12},(_,i)=>{const row=(data||[]).find(r=>num(r.mes)===i+1);return{mesLabel:MONTHS[i],value:row?num(row[metric.monthlyKey]):null};});
  return <div className="preparo-chart-panel preparo-monthly-panel">
    <div className="preparo-panel-title preparo-monthly-title"><span>Histórico Mensal - {metric.label}</span><small>{metric.targetText} • {meta.meta}%</small></div>
    <div className="preparo-chart-body"><ResponsiveContainer width="100%" height="100%"><LineChart data={safeData} margin={{top:18,right:5,left:5,bottom:0}}>
      <XAxis dataKey="mesLabel" interval={0} axisLine={false} tickLine={false} tick={{fill:'var(--text-muted)',fontSize:FONT_SIZE.chartLabel,fontWeight:800}}/><YAxis domain={[0,100]} hide/><ReferenceLine y={meta.meta} stroke="var(--q-green)" strokeDasharray="4 4"/>
      <Line type="monotone" dataKey="value" connectNulls stroke="var(--q-green)" strokeWidth={2.5} dot={props=><MonthlyDot {...props} metric={metric}/>} activeDot={false} isAnimationActive={false}><LabelList dataKey="value" position="top" formatter={v=>Number.isFinite(num(v))?`${formatNumber(v,0)}%`:''} fill="var(--text-main)" fontSize={FONT_SIZE.chartValue} fontWeight={900}/></Line>
    </LineChart></ResponsiveContainer></div>
  </div>;
}

function MetricTable({metric,rows}){
  const items=buildMetricRows(rows,metric);const points=Array.from({length:12},(_,i)=>i+1);const summary=calculateTableSummary(items,metric);
  return <div className="preparo-table-panel"><div className="preparo-table-title"><span>{metric.tableTitle}</span><small>{metric.targetText}</small></div><div className="preparo-table-scroll"><table className="preparo-table">
    <thead><tr><th>Campo</th><th>Lote</th>{points.map(p=><th key={p}>{p}</th>)}<th>Padrão</th><th>%</th></tr></thead><tbody>
    {items.map(item=><tr key={item.id}><td className="preparo-field-cell" title={item.field}>{item.field}</td><td className="preparo-lot-cell">{item.lot}</td>{points.map(n=>{const p=item.points[n-1];if(!p)return<td key={`${item.id}-${n}`} className="preparo-value-cell is-not-measured"/>;return<td key={`${item.id}-${n}`} className={`preparo-value-cell ${metric.compliance(p.value)?'is-good':'is-bad'}`} title={`Ponto ${p.sourcePoint}: ${formatNumber(p.value,metric.unitDecimals)} ${metric.unit}`}>{formatNumber(p.value,metric.unitDecimals)}</td>;})}<td className="preparo-standard-cell">{item.measuredCount?item.standardCount:'—'}</td><td className="preparo-percent-cell"><ComplianceBadge value={item.percentage} metric={metric}/></td></tr>)}
    {!items.length&&<tr><td colSpan={16} className="preparo-empty-row">Nenhum dado disponível para esta métrica nesta data.</td></tr>}
    </tbody></table></div><div className="preparo-table-footer"><span>{summary.measuredCount} ponto(s)</span><span>Média: {Number.isFinite(summary.average)?`${formatNumber(summary.average,metric.unitDecimals)} ${metric.unit}`:'—'}</span><span>Padrão: {summary.standardCount}</span></div></div>;
}

function MetricSection({metric,dayRows,daySummary,yearData,monthlyData}){
  // O gráfico diário usa o percentual oficial da view: PADRAO / AVALIADAS.
  // Os pontos brutos são usados apenas para montar e colorir a tabela detalhada.
  const dayValue=num(daySummary?.[metric.key],NaN);
  return <div className="preparo-metric-row"><MetricTable metric={metric} rows={dayRows}/><DayYearChart metric={metric} dayValue={dayValue} yearValue={num(yearData?.[metric.key])} yearLabel={yearData?.ano}/><MonthlyChart metric={metric} data={monthlyData}/></div>;
}

export default function DashPreparo(){
  const[sidebarDates,setSidebarDates]=useState([]);const[selectedDate,setSelectedDate]=useState('');const[search,setSearch]=useState('');const[dayData,setDayData]=useState([]);const[yearData,setYearData]=useState(null);const[monthlyData,setMonthlyData]=useState([]);const[loadingDates,setLoadingDates]=useState(true);const[loadingData,setLoadingData]=useState(false);const[error,setError]=useState('');
  useEffect(()=>{let active=true;(async()=>{setLoadingDates(true);setError('');const response=await supabase.from('vw_q_preparo_datas').select('*').order('data',{ascending:false});if(!active)return;if(response.error){setError(response.error.message||'Erro ao consultar vw_q_preparo_datas.');setSidebarDates([]);setLoadingDates(false);return;}const normalized=(Array.isArray(response.data)?response.data:[]).map(row=>({...row,date:text(row.data),points:num(row.pontos,0),fields:text(row.campos,'SEM CAMPO')})).filter(row=>row.date);setSidebarDates(normalized);if(normalized.length)setSelectedDate(current=>normalized.some(i=>i.date===current)?current:normalized[0].date);setLoadingDates(false);})();return()=>{active=false;};},[]);
  useEffect(()=>{if(!selectedDate)return;let active=true;(async()=>{setLoadingData(true);setError('');const currentYear=Number(String(selectedDate).slice(0,4));const[resDay,resYear,resMonthly]=await Promise.all([
    supabase.from('vw_q_preparo_geral').select('*').eq('data',selectedDate).order('campo').order('lote').order('ponto'),
    supabase.from('vw_q_preparo_ano').select('*').eq('ano',currentYear).maybeSingle(),
    supabase.from('vw_q_preparo_mensal').select('*').eq('ano',currentYear).order('mes'),
  ]);if(!active)return;if(resDay.error){setError(resDay.error.message||'Erro ao consultar vw_q_preparo_geral.');setDayData([]);setYearData(null);setMonthlyData([]);setLoadingData(false);return;}setDayData(Array.isArray(resDay.data)?resDay.data:[]);setYearData(resYear.error?null:(resYear.data?{...resYear.data,ano:resYear.data.ano||currentYear}:null));setMonthlyData(resMonthly.error?[]:(Array.isArray(resMonthly.data)?resMonthly.data:[]));setLoadingData(false);})();return()=>{active=false;};},[selectedDate]);
  const selectedDaySummary=useMemo(()=>sidebarDates.find(i=>i.date===selectedDate)||null,[sidebarDates,selectedDate]);
  const filteredDates=useMemo(()=>{const term=search.toLowerCase().trim();return term?sidebarDates.filter(i=>`${i.fields} ${i.date}`.toLowerCase().includes(term)):sidebarDates;},[sidebarDates,search]);
  if(loadingDates&&!sidebarDates.length)return<div className="preparo-loading">Carregando datas de preparo...</div>;
  if(error&&!selectedDate)return<div className="preparo-loading is-error"><strong>Erro ao carregar Dashboard de Preparo</strong><span>{error}</span></div>;
  return <div className="dash-preparo" style={{'--preparo-grid-gap':`${DASH_LAYOUT.gap}px`,'--preparo-row-height':`${DASH_LAYOUT.rowHeight}px`,'--preparo-sidebar-width':`${DASH_LAYOUT.sidebarWidth}px`,'--preparo-content-padding':`${DASH_LAYOUT.contentPadding}px`,'--preparo-font-base':`${FONT_SIZE.base}px`,'--preparo-font-md':`${FONT_SIZE.md}px`,'--preparo-chart-label':`${FONT_SIZE.chartLabel}px`,'--preparo-table-value':`${FONT_SIZE.tableValue}px`}}>
    <aside className="preparo-sidebar"><div className="preparo-sidebar-head"><div><strong>DATAS</strong><span>{filteredDates.length}</span></div></div><div className="preparo-search-wrap"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar campo..." aria-label="Pesquisar campo"/>{search&&<button type="button" onClick={()=>setSearch('')} aria-label="Limpar busca">×</button>}</div><div className="preparo-date-list">{filteredDates.map(item=><button type="button" key={item.date} className={`preparo-date-row ${item.date===selectedDate?'is-selected':''}`} onClick={()=>setSelectedDate(item.date)}><span><strong>{formatDate(item.date)}</strong><small>{item.fields}</small></span><b>{item.points}</b></button>)}{!filteredDates.length&&<div className="preparo-sidebar-empty">Nenhuma data encontrada.</div>}</div></aside>
    <main className="preparo-main"><div className="preparo-mobile-date"><label htmlFor="preparo-date-select">Data da avaliação</label><select id="preparo-date-select" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}>{sidebarDates.map(i=><option key={i.date} value={i.date}>{formatDate(i.date)} • {i.fields}</option>)}</select></div>{error&&<div className="preparo-inline-error">{error}</div>}{loadingData?<div className="preparo-data-loading">Atualizando matriz de preparo...</div>:<div className="preparo-metric-grid" style={{'--preparo-col-table':`${DASH_LAYOUT.table}fr`,'--preparo-col-dayyear':`${DASH_LAYOUT.dayYear}fr`,'--preparo-col-monthly':`${DASH_LAYOUT.monthly}fr`}}>{METRICS.map(metric=><MetricSection key={metric.key} metric={metric} dayRows={dayData} daySummary={selectedDaySummary} yearData={yearData} monthlyData={monthlyData}/>)}</div>}<section className="preparo-future-slot" aria-hidden="true"/></main>
  </div>;
}
