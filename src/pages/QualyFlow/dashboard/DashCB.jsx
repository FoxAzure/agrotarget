import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
  BarChart, Bar, Cell, LabelList, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import './BaseDash.css';
import './DashCB.css';

const MONTHS = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

const FONT_SIZE = { base: 10, xs: 8, md: 10, chart: 9 };

const DASH_LAYOUT = {
  sidebarWidth: 230,
  contentPadding: 10,
  gap: 8,
  topHeight: 112,
  middleHeight: 246,
  bottomHeight: 250,
  barWidth: 24,
};

const num = (value, fallback = NaN) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const text = (value, fallback = '') => {
  const result = String(value ?? '').trim();
  return result || fallback;
};

const normalize = value => text(value)
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const isConforme = value => normalize(value) === 'conforme';

const formatPercent = value => {
  const parsed = num(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(1).replace('.', ',')}%` : '—';
};

const formatNumber = (value, decimals = 0) => {
  const parsed = num(value);
  return Number.isFinite(parsed) ? parsed.toFixed(decimals).replace('.', ',') : '—';
};

const formatDate = value => {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw || '—';
  const [year, month, day] = raw.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

const performanceColor = value => {
  const parsed = num(value);
  if (!Number.isFinite(parsed)) return 'var(--cb-muted)';
  if (parsed >= 90) return 'var(--q-green)';
  if (parsed >= 80) return 'var(--q-warning)';
  return 'var(--q-danger)';
};

const statusColor = value => isConforme(value) ? 'var(--q-green)' : 'var(--q-danger)';

const limpezaStatus = row => [
  row.adub_orgniz,
  row.adub_placas,
  row.adub_pallets,
  row.limp_ext,
  row.limp_int,
  row.limp_geral,
].every(isConforme) ? 'Conforme' : 'Não Conforme';

const isEvaluationConforme = row =>
  num(row.perc_telas, 0) >= 90 &&
  num(row.perc_cx, 0) >= 90 &&
  limpezaStatus(row) === 'Conforme';

const average = values => {
  const valid = values.map(value => num(value)).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

function KpiCard({ label, value, detail, tone = 'neutral' }) {
  return (
    <div className={`cb-kpi-card is-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function MonthlyChart({ title, dataKey, monthlyData }) {
  const data = MONTHS.map((month, index) => {
    const row = monthlyData.find(item => item.month === index + 1);
    return { month, value: row ? row[dataKey] : null };
  });

  return (
    <section className="cb-panel cb-chart-panel">
      <div className="cb-panel-title">{title}</div>
      <div className="cb-chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 5, left: 5, bottom: 0 }}>
            <XAxis dataKey="month" axisLine={false} tickLine={false}
              tick={{ fill: 'var(--cb-muted)', fontSize: FONT_SIZE.chart, fontWeight: 800 }} />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,.035)' }}
              formatter={value => [formatPercent(value), 'Resultado']}
              contentStyle={{ background: '#172234', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#cbd5e1' }}
              itemStyle={{ color: '#f8fafc' }}
            />
            <ReferenceLine y={90} stroke="var(--q-green)" strokeDasharray="3 3" />
            <Bar dataKey="value" barSize={DASH_LAYOUT.barWidth} radius={[4,4,1,1]}>
              {data.map((entry, index) => (
                <Cell key={`${dataKey}-${index}`} fill={Number.isFinite(num(entry.value)) ? performanceColor(entry.value) : 'transparent'} />
              ))}
              <LabelList dataKey="value" position="top"
                formatter={value => Number.isFinite(num(value)) ? `${formatNumber(value, 0)}%` : ''}
                fill="var(--cb-text)" fontSize={FONT_SIZE.chart} fontWeight={900} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function AttentionChart({ monthlyData }) {
  const data = MONTHS.map((month, index) => {
    const row = monthlyData.find(item => item.month === index + 1);
    return { month, value: row ? row.attention : null };
  });

  return (
    <section className="cb-panel cb-chart-panel">
      <div className="cb-panel-title">Não conformidades por mês</div>
      <div className="cb-chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 5, left: 5, bottom: 0 }}>
            <XAxis dataKey="month" axisLine={false} tickLine={false}
              tick={{ fill: 'var(--cb-muted)', fontSize: FONT_SIZE.chart, fontWeight: 800 }} />
            <YAxis hide allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,.035)' }}
              formatter={value => [formatNumber(value, 0), 'Avaliações']}
              contentStyle={{ background: '#172234', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#f8fafc' }}
            />
            <Bar dataKey="value" barSize={DASH_LAYOUT.barWidth} fill="var(--q-danger)" radius={[4,4,1,1]}>
              <LabelList dataKey="value" position="top"
                formatter={value => Number.isFinite(num(value)) && num(value) > 0 ? formatNumber(value, 0) : ''}
                fill="var(--cb-text)" fontSize={FONT_SIZE.chart} fontWeight={900} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function EvaluationTable({ rows }) {
  return (
    <section className="cb-panel cb-table-panel">
      <div className="cb-table-title">
        <span>Avaliações do dia</span>
        <small>{rows.length} registro(s)</small>
      </div>
      <div className="cb-table-scroll">
        <table className="cb-table">
          <thead>
            <tr>
              <th>CB</th><th>DEPA</th><th>Setor</th><th>Telas</th><th>Caixas</th>
              <th>Limpeza</th><th>Danif.</th><th>Falt.</th><th>Sujas</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const limpeza = limpezaStatus(row);
              const conforme = isEvaluationConforme(row);
              return (
                <tr key={`${row.data_ref}-${row.nro_eb}-${index}`}>
                  <td className="cb-name-cell" title={text(row.desc_eb)}>{text(row.desc_eb, `CB ${row.nro_eb}`)}</td>
                  <td>{text(row.depa, '—')}</td>
                  <td>{text(row.setor, '—')}</td>
                  <td style={{ color: performanceColor(row.perc_telas) }}>{formatPercent(row.perc_telas)}</td>
                  <td style={{ color: performanceColor(row.perc_cx) }}>{formatPercent(row.perc_cx)}</td>
                  <td style={{ color: statusColor(limpeza) }}>{limpeza}</td>
                  <td className={num(row.telas_danificadas, 0) > 0 ? 'is-alert' : 'is-ok'}>{formatNumber(row.telas_danificadas)}</td>
                  <td className={num(row.telas_faltando, 0) > 0 ? 'is-alert' : 'is-ok'}>{formatNumber(row.telas_faltando)}</td>
                  <td className={num(row.telas_suja, 0) > 0 ? 'is-warning' : 'is-ok'}>{formatNumber(row.telas_suja)}</td>
                  <td><span className={`cb-status-badge ${conforme ? 'is-good' : 'is-bad'}`}>{conforme ? 'Conforme' : 'Atenção'}</span></td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan="10" className="cb-empty-row">Nenhuma avaliação encontrada nesta data.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function DashCB() {
  const [dateItems, setDateItems] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [search, setSearch] = useState('');
  const [dayData, setDayData] = useState([]);
  const [yearData, setYearData] = useState([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadDates = async () => {
      setLoadingDates(true);
      setError('');
      const { data, error: requestError } = await supabase
        .from('vw_q_cbgeral')
        .select('data_ref,nro_eb,desc_eb')
        .order('data_ref', { ascending: false });
      if (!active) return;
      if (requestError) {
        setError(requestError.message || 'Erro ao consultar as datas das Casas de Bomba.');
        setLoadingDates(false);
        return;
      }
      const grouped = new Map();
      (data || []).forEach(row => {
        const date = text(row.data_ref).slice(0, 10);
        if (!date) return;
        if (!grouped.has(date)) grouped.set(date, { date, evaluations: 0, names: new Set() });
        const item = grouped.get(date);
        item.evaluations += 1;
        item.names.add(text(row.desc_eb, `CB ${row.nro_eb}`));
      });
      const normalized = Array.from(grouped.values()).map(item => ({
        date: item.date,
        evaluations: item.evaluations,
        names: Array.from(item.names).join(', '),
      }));
      setDateItems(normalized);
      if (normalized.length) setSelectedDate(current => normalized.some(item => item.date === current) ? current : normalized[0].date);
      setLoadingDates(false);
    };
    loadDates();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    let active = true;
    const loadData = async () => {
      setLoadingData(true);
      setError('');
      const year = Number(selectedDate.slice(0, 4));
      const [dayResponse, yearResponse] = await Promise.all([
        supabase.from('vw_q_cbgeral').select('*').eq('data_ref', selectedDate).order('nro_eb', { ascending: true }),
        supabase.from('vw_q_cbgeral').select('*').eq('ano', year).order('data_ref', { ascending: true }),
      ]);
      if (!active) return;
      if (dayResponse.error) {
        setError(dayResponse.error.message || 'Erro ao carregar avaliações do dia.');
        setDayData([]); setYearData([]); setLoadingData(false); return;
      }
      setDayData(dayResponse.data || []);
      setYearData(yearResponse.error ? [] : (yearResponse.data || []));
      setLoadingData(false);
    };
    loadData();
    return () => { active = false; };
  }, [selectedDate]);

  const filteredDates = useMemo(() => {
    const term = normalize(search);
    if (!term) return dateItems;
    return dateItems.filter(item => normalize(`${item.date} ${item.names}`).includes(term));
  }, [dateItems, search]);

  const daySummary = useMemo(() => {
    const total = dayData.length;
    const conformes = dayData.filter(isEvaluationConforme).length;
    const attention = total - conformes;
    return {
      total,
      houses: new Set(dayData.map(row => text(row.nro_eb || row.desc_eb))).size,
      screens: average(dayData.map(row => row.perc_telas)),
      boxes: average(dayData.map(row => row.perc_cx)),
      conformes,
      attention,
    };
  }, [dayData]);

  const monthlyData = useMemo(() => MONTHS.map((_, index) => {
    const month = index + 1;
    const rows = yearData.filter(row => num(row.mes) === month);
    return {
      month,
      screens: average(rows.map(row => row.perc_telas)),
      boxes: average(rows.map(row => row.perc_cx)),
      attention: rows.filter(row => !isEvaluationConforme(row)).length,
    };
  }), [yearData]);

  if (loadingDates && !dateItems.length) return <div className="cb-loading">Carregando datas das Casas de Bomba...</div>;
  if (error && !selectedDate) return <div className="cb-loading is-error"><strong>Erro no Dashboard de Casas de Bomba</strong><span>{error}</span></div>;

  return (
    <div className="dash-cb" style={{
      '--cb-sidebar-width': `${DASH_LAYOUT.sidebarWidth}px`,
      '--cb-content-padding': `${DASH_LAYOUT.contentPadding}px`,
      '--cb-gap': `${DASH_LAYOUT.gap}px`,
      '--cb-top-height': `${DASH_LAYOUT.topHeight}px`,
      '--cb-middle-height': `${DASH_LAYOUT.middleHeight}px`,
      '--cb-bottom-height': `${DASH_LAYOUT.bottomHeight}px`,
      '--cb-font-base': `${FONT_SIZE.base}px`,
      '--cb-font-xs': `${FONT_SIZE.xs}px`,
      '--cb-font-md': `${FONT_SIZE.md}px`,
    }}>
      <aside className="cb-sidebar">
        <div className="cb-sidebar-head"><strong>DATAS</strong><span>{filteredDates.length}</span></div>
        <div className="cb-search-wrap">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar CB..." />
          {search && <button type="button" onClick={() => setSearch('')}>×</button>}
        </div>
        <div className="cb-sidebar-hint">Pesquise uma Casa de Bomba para localizar as datas avaliadas.</div>
        <div className="cb-date-list">
          {filteredDates.map(item => (
            <button type="button" key={item.date}
              className={`cb-date-row ${item.date === selectedDate ? 'is-selected' : ''}`}
              onClick={() => setSelectedDate(item.date)}>
              <span><strong>{formatDate(item.date)}</strong><small title={item.names}>{item.names}</small></span>
              <b>{item.evaluations}</b>
            </button>
          ))}
          {!filteredDates.length && <div className="cb-sidebar-empty">Nenhuma data encontrada.</div>}
        </div>
      </aside>

      <main className="cb-main">
        {loadingData ? <div className="cb-data-loading">Atualizando Casas de Bomba...</div> : <>
          <section className="cb-kpi-grid">
            <KpiCard label="Avaliações" value={daySummary.total} detail={`${daySummary.houses} CB(s)`} />
            <KpiCard label="Média Telas" value={formatPercent(daySummary.screens)} detail="Meta mínima 90%" tone={num(daySummary.screens, 0) >= 90 ? 'good' : 'bad'} />
            <KpiCard label="Média Caixas" value={formatPercent(daySummary.boxes)} detail="Meta mínima 90%" tone={num(daySummary.boxes, 0) >= 90 ? 'good' : 'bad'} />
            <KpiCard label="Conformes" value={daySummary.conformes} detail="Telas, caixas e limpeza" tone="good" />
            <KpiCard label="Atenção" value={daySummary.attention} detail="Alguma não conformidade" tone={daySummary.attention ? 'bad' : 'good'} />
          </section>

          <EvaluationTable rows={dayData} />

          <section className="cb-chart-grid">
            <MonthlyChart title="Histórico Mensal: Telas" dataKey="screens" monthlyData={monthlyData} />
            <MonthlyChart title="Histórico Mensal: Caixas" dataKey="boxes" monthlyData={monthlyData} />
            <AttentionChart monthlyData={monthlyData} />
          </section>
        </>}
      </main>
    </div>
  );
}
