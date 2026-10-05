// ================================= DOCUMENTATION ------------------------------------------
// Script: EquipeHomeDash
// Purpose: Hub de dados, metas, periodo e navegacao dos dashboards da Equipe.
// Relationships:
//   - vw_q_equipe_atvrealizadas
//   - tb_q_equipemetas
//   - EquipeHomeDashDiario / Semanal / Mensal / Anual
// ==========================================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

import EquipeHomeDashDiario from './EquipeHomeDashDiario';
import EquipeHomeDashSemanal from './EquipeHomeDashSemanal';
import EquipeHomeDashMensal from './EquipeHomeDashMensal';
import EquipeHomeDashAnual from './EquipeHomeDashAnual';

const VIEW_NAME = 'vw_q_equipe_atvrealizadas';
const GOALS_TABLE = 'tb_q_equipemetas';
const PAGE_SIZE = 1000;
const QUERY_RETRIES = 2;
const RETRY_DELAY_MS = 900;
const CACHE_TTL_MS = 10 * 60 * 1000;
const DATA_CACHE = new Map();
let GOALS_CACHE = null;
let GOALS_CACHE_AT = 0;

const MONTHS = ['JANEIRO','FEVEREIRO','MARCO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
const DASH_VIEWS = [
  { id:'diario',label:'Diario',scope:'month',Component:EquipeHomeDashDiario },
  { id:'semanal',label:'Semanal',scope:'month',Component:EquipeHomeDashSemanal },
  { id:'mensal',label:'Mensal',scope:'month',Component:EquipeHomeDashMensal },
  { id:'anual',label:'Anual',scope:'year',Component:EquipeHomeDashAnual },
];

const sleep=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
const normalizeRows=(rows)=>(Array.isArray(rows)?rows:[]).map((row)=>({...row,id:Number(row.id),ano:Number(row.ano),mes:Number(row.mes),semana_iso:Number(row.semana_iso),qnt:Number(row.qnt||0)}));
const normalizeGoals=(rows)=>(Array.isArray(rows)?rows:[]).map((row)=>({...row,id:Number(row.id),ano:Number(row.ano),mes:Number(row.mes),meta:Number(row.meta||0),atividade:String(row.atividade||'').trim(),status:String(row.status||'').toUpperCase()}));

const runWithRetry=async(queryFn)=>{let lastError=null;for(let attempt=0;attempt<=QUERY_RETRIES;attempt+=1){const{data,error}=await queryFn();if(!error)return data;lastError=error;if(attempt<QUERY_RETRIES)await sleep(RETRY_DELAY_MS*(attempt+1));}throw lastError;};
const fetchAllPages=async(queryFactory,normalizer=normalizeRows)=>{const all=[];for(let from=0;;from+=PAGE_SIZE){const page=await runWithRetry(()=>queryFactory().range(from,from+PAGE_SIZE-1));const rows=Array.isArray(page)?page:[];all.push(...rows);if(rows.length<PAGE_SIZE)break;}return normalizer(all);};
const getCache=(key)=>{const cached=DATA_CACHE.get(key);if(!cached)return null;if(Date.now()-cached.savedAt>CACHE_TTL_MS){DATA_CACHE.delete(key);return null;}return cached.rows;};
const setCache=(key,rows)=>{DATA_CACHE.set(key,{rows,savedAt:Date.now()});return rows;};

const PeriodModal=({period,onApply,onClose})=>{
  const[draftMonth,setDraftMonth]=useState(period.mes);
  const[draftYear,setDraftYear]=useState(period.ano);
  return <div className="equipe-period-backdrop" onMouseDown={(event)=>{if(event.target===event.currentTarget)onClose();}}><section className="equipe-period-modal" role="dialog" aria-modal="true"><header><div><span className="equipe-page__eyebrow">Periodo de referencia</span><h3>Selecionar mes e ano</h3></div><button type="button" onClick={onClose}>×</button></header><div className="equipe-period-modal__body"><label><span>Ano</span><input type="number" min="2020" max="2100" value={draftYear||''} onChange={(event)=>setDraftYear(Number(event.target.value))}/></label><div className="equipe-period-months">{MONTHS.map((name,index)=><button key={name} type="button" className={draftMonth===index+1?'is-active':''} onClick={()=>setDraftMonth(index+1)}>{name}</button>)}</div></div><footer><button type="button" className="equipe-button equipe-button--ghost" onClick={onClose}>Cancelar</button><button type="button" className="equipe-button equipe-button--primary" onClick={()=>onApply({ano:draftYear,mes:draftMonth})} disabled={!draftYear||!draftMonth}>Aplicar</button></footer></section></div>;
};

const EquipeHomeDash=()=>{
  const[activeView,setActiveView]=useState('diario');
  const[period,setPeriod]=useState({ano:null,mes:null});
  const[rows,setRows]=useState([]);
  const[goals,setGoals]=useState([]);
  const[isLoading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[lastRefresh,setLastRefresh]=useState(null);
  const[periodOpen,setPeriodOpen]=useState(false);

  const activeConfig=useMemo(()=>DASH_VIEWS.find((view)=>view.id===activeView)||DASH_VIEWS[0],[activeView]);
  const ActiveDashboard=activeConfig.Component;

  const discoverLatestPeriod=useCallback(async()=>{const data=await runWithRetry(()=>supabase.from(VIEW_NAME).select('ano, mes').order('ano',{ascending:false}).order('mes',{ascending:false}).limit(1));const latest=data?.[0];if(!latest)throw new Error('A view de atividades realizadas esta vazia.');return{ano:Number(latest.ano),mes:Number(latest.mes)};},[]);

  const loadGoals=useCallback(async(force=false)=>{if(!force&&Array.isArray(GOALS_CACHE)&&Date.now()-GOALS_CACHE_AT<CACHE_TTL_MS)return GOALS_CACHE;const loaded=await fetchAllPages(()=>supabase.from(GOALS_TABLE).select('id, atividade, meta, mes, ano, atualizado, usuario, status').order('atividade',{ascending:true}).order('ano',{ascending:true}).order('mes',{ascending:true}),normalizeGoals);GOALS_CACHE=loaded;GOALS_CACHE_AT=Date.now();return loaded;},[]);

  const loadScope=useCallback(async({ano,mes,scope,force=false})=>{const key=scope==='year'?`year:${ano}`:`month:${ano}:${mes}`;if(!force){const cached=getCache(key);if(cached)return cached;}const loaded=await fetchAllPages(()=>{let query=supabase.from(VIEW_NAME).select('id, ano, mes, semana_iso, data_apontamento, atividade, qnt, codigo_campo, campo, nro_eb, lotes').eq('ano',ano).order('data_apontamento',{ascending:true}).order('atividade',{ascending:true});if(scope==='month')query=query.eq('mes',mes);return query;});return setCache(key,loaded);},[]);

  const loadDashboard=useCallback(async({force=false,targetPeriod=null,targetScope=null}={})=>{setLoading(true);setError('');try{const resolved=targetPeriod||(period.ano&&period.mes?period:await discoverLatestPeriod());const scope=targetScope||activeConfig.scope;const[data,goalRows]=await Promise.all([loadScope({ano:resolved.ano,mes:resolved.mes,scope,force}),loadGoals(force)]);setPeriod(resolved);setRows(data);setGoals(goalRows);setLastRefresh(new Date());}catch(loadError){setError(loadError?.message||'Erro ao carregar o dashboard.');setRows([]);}finally{setLoading(false);}},[activeConfig.scope,discoverLatestPeriod,loadGoals,loadScope,period]);

  useEffect(()=>{loadDashboard();},[activeView]);

  const applyPeriod=(nextPeriod)=>{setPeriodOpen(false);loadDashboard({targetPeriod:nextPeriod,targetScope:activeConfig.scope});};
  const dashboardProps={rows,goals,ano:period.ano,mes:period.mes,isLoading,error};

  return <section className="equipe-page equipe-dash"><div className="equipe-page__toolbar"><div><span className="equipe-page__eyebrow">Acompanhamento</span><h2>Dashboard da equipe</h2><p>{rows.length.toLocaleString('pt-BR')} registros carregados</p></div><div className="equipe-dash__toolbar-actions"><button type="button" className="equipe-period-button" onClick={()=>setPeriodOpen(true)}>{period.mes?MONTHS[period.mes-1]:'MES'} <span>/</span> {period.ano||'ANO'}</button><div className="equipe-dash__views" role="group" aria-label="Visualizacao do dashboard">{DASH_VIEWS.map((view)=><button key={view.id} type="button" className={activeView===view.id?'is-active':''} onClick={()=>setActiveView(view.id)}>{view.label}</button>)}</div><button type="button" className="equipe-button equipe-button--ghost" onClick={()=>loadDashboard({force:true})} disabled={isLoading}>{isLoading?'Carregando...':'Atualizar'}</button></div></div>{lastRefresh&&!error&&<div className="equipe-dash__cache-info">Dados em memoria · ultima carga {lastRefresh.toLocaleTimeString('pt-BR')}</div>}<ActiveDashboard {...dashboardProps}/>{periodOpen&&<PeriodModal period={period} onApply={applyPeriod} onClose={()=>setPeriodOpen(false)}/>}</section>;
};

export default EquipeHomeDash;
