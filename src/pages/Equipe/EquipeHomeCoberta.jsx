// ================================= DOCUMENTATION ------------------------------------------
// Script: EquipeHomeCoberta
// Purpose: Acompanhamento anual da cobertura do plantio por campo.
// Source: vw_q_coberta_plantio
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import './EquipeHomeCoberta.css';

const VIEW_NAME = 'vw_q_coberta_plantio';
const PAGE_SIZE = 1000;
const QUERY_RETRIES = 2;
const RETRY_DELAY_MS = 900;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const numberValue = (value) => {
  const parsed = Number(String(value ?? 0).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatNumber = (value, decimals = 0) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numberValue(value));
const formatDate = (value) => {
  if (!value) return 'Não informada';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const resultTone = (evaluated, percent) => {
  if (!evaluated) return 'neutral';
  if (percent >= 90) return 'green';
  if (percent >= 80) return 'yellow';
  return 'red';
};
const averageTone = (evaluated, average) => {
  if (!evaluated) return 'neutral';
  return average >= 5 && average <= 8 ? 'green' : 'red';
};

const runWithRetry = async (queryFn) => {
  let lastError = null;
  for (let attempt = 0; attempt <= QUERY_RETRIES; attempt += 1) {
    const { data, error } = await queryFn();
    if (!error) return data;
    lastError = error;
    if (attempt < QUERY_RETRIES) await sleep(RETRY_DELAY_MS * (attempt + 1));
  }
  throw lastError;
};

const fetchYearRows = async (year) => {
  const allRows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await runWithRetry(() =>
      supabase
        .from(VIEW_NAME)
        .select('ano, semana_iso, data, tipo, codigo_campo, campo, data_min, data_max, pontos_plantio, pontos_coberta_av, pontos_coberta_padrao, coberta_media, coberta, status_coberta')
        .eq('ano', year)
        .order('data_max', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)
    );
    const pageRows = Array.isArray(page) ? page : [];
    allRows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }
  return allRows;
};

const aggregateFields = (rows) => {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = `${row.ano}-${row.codigo_campo}`;
    const current = grouped.get(key) || {
      ano: Number(row.ano), codigo_campo: row.codigo_campo, campo: row.campo,
      data_min: row.data_min, data_max: row.data_max,
      pontos_plantio: 0, pontos_coberta_av: 0, pontos_coberta_padrao: 0,
      soma_coberta_ponderada: 0, tipos: new Set(),
    };
    const pontos = numberValue(row.pontos_coberta_av);
    current.pontos_plantio += numberValue(row.pontos_plantio);
    current.pontos_coberta_av += pontos;
    current.pontos_coberta_padrao += numberValue(row.pontos_coberta_padrao);
    current.soma_coberta_ponderada += numberValue(row.coberta_media) * pontos;
    if (row.tipo) current.tipos.add(row.tipo);
    if (row.data_min && (!current.data_min || row.data_min < current.data_min)) current.data_min = row.data_min;
    if (row.data_max && (!current.data_max || row.data_max > current.data_max)) current.data_max = row.data_max;
    grouped.set(key, current);
  });

  return [...grouped.values()].map((item) => {
    const avaliado = item.pontos_coberta_av > 0;
    const coberta = avaliado ? (item.pontos_coberta_padrao / item.pontos_coberta_av) * 100 : 0;
    const media = avaliado ? item.soma_coberta_ponderada / item.pontos_coberta_av : 0;
    return {
      ...item,
      tipos: [...item.tipos].sort(),
      avaliado,
      status: avaliado ? 'AVALIADO' : 'PENDENTE',
      coberta,
      coberta_media: media,
      result_tone: resultTone(avaliado, coberta),
      average_tone: averageTone(avaliado, media),
    };
  }).sort((a, b) => String(b.data_max || '').localeCompare(String(a.data_max || '')));
};

export default function EquipeHomeCoberta() {
  const [rows, setRows] = useState([]);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      setLoading(true); setError('');
      try {
        const latest = await runWithRetry(() => supabase.from(VIEW_NAME).select('ano').order('ano', { ascending: false }).limit(1));
        const latestYear = Number(latest?.[0]?.ano);
        if (!Number.isFinite(latestYear)) throw new Error('A view de cobertura está vazia.');
        const yearRows = await runWithRetry(() => supabase.from(VIEW_NAME).select('ano').order('ano', { ascending: false }));
        if (!active) return;
        const available = [...new Set((yearRows || []).map((item) => Number(item.ano)))].filter(Number.isFinite).sort((a, b) => b - a);
        setYears(available); setSelectedYear(String(latestYear));
      } catch (loadError) {
        if (active) { setError(loadError?.message || 'Não foi possível carregar os anos.'); setLoading(false); }
      }
    };
    initialize();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedYear) return undefined;
    let active = true;
    const load = async () => {
      setLoading(true); setError('');
      try {
        const data = await fetchYearRows(Number(selectedYear));
        if (active) setRows(data);
      } catch (loadError) {
        if (active) { setRows([]); setError(loadError?.message || 'Não foi possível carregar a cobertura.'); }
      } finally { if (active) setLoading(false); }
    };
    load();
    return () => { active = false; };
  }, [selectedYear]);

  const fields = useMemo(() => aggregateFields(rows), [rows]);
  const filteredFields = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return fields.filter((item) => {
      const found = !term || String(item.campo || '').toLocaleLowerCase('pt-BR').includes(term) || String(item.codigo_campo || '').includes(term);
      return found && (statusFilter === 'TODOS' || item.status === statusFilter);
    });
  }, [fields, search, statusFilter]);

  const summary = useMemo(() => {
    const evaluated = fields.filter((item) => item.avaliado).length;
    const totalPoints = fields.reduce((sum, item) => sum + item.pontos_coberta_av, 0);
    const standardPoints = fields.reduce((sum, item) => sum + item.pontos_coberta_padrao, 0);
    return {
      total: fields.length, evaluated, pending: fields.length - evaluated, totalPoints,
      result: totalPoints > 0 ? (standardPoints / totalPoints) * 100 : 0,
    };
  }, [fields]);

  const summaryTone = resultTone(summary.totalPoints > 0, summary.result);

  return (
    <div className="equipe-page equipe-coberta-page">
      <section className="equipe-coberta-toolbar">
        <div>
          <span className="equipe-page__eyebrow">Qualidade do plantio</span>
          <h2>Cobertura do Plantio</h2>
          <p>Acompanhamento da cobertura do plantio.</p>
        </div>
        <label className="equipe-coberta-year"><span>Ano</span><select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
      </section>

      <section className="equipe-coberta-summary">
        <article><span>Campos</span><strong>{summary.total}</strong><small>avaliados no plantio</small></article>
        <article className="is-evaluated"><span>Com coberta</span><strong>{summary.evaluated}</strong><small>campos avaliados</small></article>
        <article className="is-pending"><span>Pendentes</span><strong>{summary.pending}</strong><small>sem avaliação de coberta</small></article>
        <article className={`is-result is-result-${summaryTone}`}><span>Coberta padrão</span><strong>{formatNumber(summary.result, 2)}%</strong><small>{formatNumber(summary.totalPoints)} pontos de coberta</small></article>
      </section>

      <section className="equipe-coberta-controls">
        <div className="equipe-coberta-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar campo ou código..." />{search && <button type="button" onClick={() => setSearch('')}>×</button>}</div>
        <div className="equipe-coberta-filters">{['TODOS','AVALIADO','PENDENTE'].map((status) => <button key={status} type="button" className={statusFilter === status ? 'is-active' : ''} onClick={() => setStatusFilter(status)}>{status === 'TODOS' ? 'Todos' : status === 'AVALIADO' ? 'Avaliados' : 'Pendentes'}</button>)}</div>
      </section>

      {error && <div className="equipe-message is-error">{error}</div>}
      {loading ? <div className="equipe-coberta-state"><i className="equipe-coberta-loader" /><strong>Carregando cobertura...</strong></div> : filteredFields.length === 0 ? <div className="equipe-coberta-state"><strong>Nenhum campo encontrado</strong><span>Ajuste o ano, a busca ou o filtro.</span></div> : (
        <section className="equipe-coberta-grid">
          {filteredFields.map((item) => (
            <article key={`${item.ano}-${item.codigo_campo}`} className={`equipe-coberta-card ${item.avaliado ? 'is-evaluated' : 'is-pending'}`}>
              <header><div className="equipe-coberta-card__identity"><h3><span>{item.codigo_campo}</span>{item.campo}</h3></div><b>{item.status}</b></header>
              <div className="equipe-coberta-card__dates"><span><small>Primeira</small><strong>{formatDate(item.data_min)}</strong></span><span><small>Última</small><strong>{formatDate(item.data_max)}</strong></span></div>
              <div className="equipe-coberta-card__quick">
                <div className={`is-indicator-${item.result_tone}`}><span>Coberta padrão</span><strong>{item.avaliado ? `${formatNumber(item.coberta, 2)}%` : 'Pendente'}</strong></div>
                <div className={`is-indicator-${item.average_tone}`}><span>Média</span><strong>{item.avaliado ? `${formatNumber(item.coberta_media, 2)} cm` : '—'}</strong></div>
                <div><span>Pontos</span><strong>{formatNumber(item.pontos_coberta_av)}</strong></div>
              </div>
              <div className={`equipe-coberta-card__track is-indicator-${item.result_tone}`}><i style={{ width: `${item.avaliado ? Math.min(100, item.coberta) : 0}%` }} /></div>
              <footer><span>{item.avaliado ? `${formatNumber(item.pontos_coberta_padrao)}/${formatNumber(item.pontos_coberta_av)} no padrão` : `${formatNumber(item.pontos_plantio)} pontos de plantio`}</span><span>{item.tipos.join(' + ') || 'Tipo não informado'}</span></footer>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
