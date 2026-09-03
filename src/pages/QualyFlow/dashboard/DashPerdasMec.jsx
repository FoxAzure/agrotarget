// ================================= DOCUMENTATION ------------------------------------------
// Script: DashPerdasMec
// Purpose: Dashboard de Perdas Mecanizadas V2 (Tema Dark/Green)
// Relationships: Usa vw_q_perdamecgeral, vw_q_perdamec_ano e vw_q_perdamec_mes.
// Consome metas de rulesPerdaMec.js
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import { getMetasParaData, getStatusColor } from '../../../components/QualyFlow/rulesPerdaMec';
import {
  BarChart, Bar, PieChart, Pie, Cell, LabelList,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import './BaseDash.css';

// ================================= VARIABLES ----------------------------------------------
const CATEGORIAS = [
  { key: 'cat_canaponta', label: 'Cana Ponta' },
  { key: 'cat_toco', label: 'Toco' },
  { key: 'cat_pedacofixo', label: 'Ped. Fixo' },
  { key: 'cat_canainteira', label: 'Cana Int.' },
  { key: 'cat_toleterepicado', label: 'Tolete Rep.' },
  { key: 'cat_estilhaco', label: 'Estilhaço' },
  { key: 'cat_lascas', label: 'Lascas' },
  { key: 'cat_pedacosolto', label: 'Ped. Solto' }
];

const PIE_COLORS = [
  '#10b981', '#34d399', '#059669', '#fbbf24',
  '#f59e0b', '#ef4444', '#b91c1c', '#6366f1'
];

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

// ============================== AJUSTES DE LAYOUT ==============================
// Estas variáveis controlam diretamente as 4 colunas principais do dashboard.
// Aumente/diminua cada valor para redistribuir espaço entre as colunas.
const DASH_LAYOUT = {
  table: 1.20,
  categories: 0.82,
  dayYear: 0.68,
  monthly: 1.00,
  gap: 9,
  barSize: 28,
  dayYearBarGap: 4,
  dayYearCategoryGap: '20%'
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatPerc = (v) => typeof v === 'number' && Number.isFinite(v)
  ? `${v.toFixed(2)}%`
  : '-';

const parseColhedora = (fullName) => fullName ? fullName.split(' - ')[0] : '-';

const formatTurno = (turno) => {
  const value = String(turno ?? '').trim();
  if (/^1/.test(value)) return '1º';
  if (/^2/.test(value)) return '2º';
  return value || '-';
};

// Verde (0) -> Amarelo (meio) -> Vermelho (máximo), considerando todas as categorias.
const interpolateColor = (start, end, amount) => {
  const s = start.match(/\w\w/g).map((x) => parseInt(x, 16));
  const e = end.match(/\w\w/g).map((x) => parseInt(x, 16));
  const t = Math.max(0, Math.min(1, amount));
  const rgb = s.map((v, i) => Math.round(v + (e[i] - v) * t));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
};

const getCategoryHeatColor = (value, maxValue) => {
  if (maxValue <= 0) return '#10b981';

  const ratio = Math.max(0, Math.min(1, value / maxValue));
  if (ratio <= 0.5) {
    return interpolateColor('#10b981', '#f59e0b', ratio / 0.5);
  }
  return interpolateColor('#f59e0b', '#ef4444', (ratio - 0.5) / 0.5);
};

const CustomPieTooltip = ({ active, payload, yearCatData }) => {
  if (active && payload && payload.length) {
    const rowData = payload[0].payload;
    const val = Number(payload[0].value) || 0;
    const yearValue = yearCatData[rowData.key] || 0;
    const isWorse = val > yearValue;

    return (
      <div className="chart-tooltip" style={{ borderColor: isWorse ? 'var(--q-danger)' : 'var(--q-green)' }}>
        <strong>{rowData.name}</strong>
        <div>
          Dia:{' '}
          <span style={{ color: isWorse ? 'var(--q-danger)' : 'var(--q-green)', fontWeight: 700 }}>
            {val.toFixed(2)}%
          </span>
        </div>
        <div className="chart-tooltip-muted">Safra: {yearValue.toFixed(2)}%</div>
      </div>
    );
  }
  return null;
};

// ================================= COMPONENTES -------------------------------------------
const IndicatorCard = ({ title, variant, children }) => (
  <div className={`q-panel indicator-card ${variant || ''}`}>
    <div className="q-panel-title indicator-title">{title}</div>
    <div className="indicator-chart">
      {children}
    </div>
  </div>
);

const IndicatorDayYearChart = ({ diaValue, safraValue, limite }) => {
  const data = [
    { name: 'Dia', valor: diaValue, color: getStatusColor(diaValue, limite) },
    { name: 'Safra', valor: safraValue, color: getStatusColor(safraValue, limite) }
  ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 18, right: 4, left: 0, bottom: 0 }} barGap={DASH_LAYOUT.dayYearBarGap} barCategoryGap={DASH_LAYOUT.dayYearCategoryGap}>
        <XAxis
          dataKey="name"
          stroke="var(--border-color)"
          tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis domain={[0, (maxData) => Math.max(maxData, limite * 1.2, 1)]} hide />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-color)',
            color: '#fff',
            borderRadius: '8px'
          }}
          formatter={(v) => formatPerc(v)}
        />
        <ReferenceLine
          y={limite}
          stroke="var(--q-green)"
          strokeDasharray="3 3"
          label={{
            position: 'insideTopLeft',
            value: `Meta: ${limite}%`,
            fill: 'var(--q-green)',
            fontSize: 8,
            fontWeight: 'bold'
          }}
        />
        <Bar dataKey="valor" radius={[5, 5, 1, 1]} barSize={DASH_LAYOUT.barSize}>
          {data.map((entry, index) => (
            <Cell key={`day-year-${index}`} fill={entry.color} />
          ))}
          <LabelList
            dataKey="valor"
            position="top"
            formatter={(v) => `${num(v).toFixed(2)}%`}
            fill="var(--text-main)"
            fontSize={9}
            fontWeight="bold"
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const MonthlyIndicatorChart = ({ data, dataKey, limite }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 18, right: 0, left: 0, bottom: 0 }} barCategoryGap="24%" barGap={2}>
      <XAxis
        dataKey="mesLabel"
        interval={0}
        tick={{ fill: 'var(--text-muted)', fontSize: 7.5, fontWeight: 600 }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis domain={[0, (maxData) => Math.max(maxData, limite * 1.2, 1)]} hide />
      <Tooltip
        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        contentStyle={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          color: '#fff',
          borderRadius: '8px'
        }}
        formatter={(v) => formatPerc(v)}
        labelFormatter={(label) => `Mês: ${label}`}
      />
      <ReferenceLine y={limite} stroke="var(--q-green)" strokeDasharray="3 3" />
      <Bar dataKey={dataKey} radius={[4, 4, 1, 1]} barSize={DASH_LAYOUT.barSize}>
        {data.map((entry, index) => (
          <Cell
            key={`monthly-${dataKey}-${index}`}
            fill={entry[dataKey] == null ? 'transparent' : getStatusColor(entry[dataKey], limite)}
          />
        ))}
        <LabelList
          dataKey={dataKey}
          position="top"
          formatter={(v) => v == null ? '' : `${num(v).toFixed(1)}%`}
          fill="var(--text-main)"
          fontSize={6.5}
          fontWeight="bold"
        />
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

// ================================= EXECUTOR -----------------------------------------------
export default function DashPerdasMec() {
  const [sidebarDates, setSidebarDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);

  const [dayData, setDayData] = useState([]);
  const [yearData, setYearData] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);

  // 1. Busca rápida
  useEffect(() => {
    let active = true;

    const fetchSidebar = async () => {
      const { data } = await supabase
        .from('vw_q_perdamecgeral')
        .select('data_apontamento, total_perda, tch_estimado')
        .order('data_apontamento', { ascending: false })
        .limit(1000);

      if (active && data) {
        const dateMap = {};
        data.forEach((r) => {
          if (!dateMap[r.data_apontamento]) dateMap[r.data_apontamento] = { p: 0, t: 0 };
          dateMap[r.data_apontamento].p += num(r.total_perda);
          dateMap[r.data_apontamento].t += num(r.tch_estimado);
        });

        const datesProcessed = Object.keys(dateMap)
          .map((d) => ({
            date: d,
            perda: dateMap[d].p > 0
              ? (dateMap[d].p / (dateMap[d].p + dateMap[d].t)) * 100
              : 0
          }))
          .sort((a, b) => b.date.localeCompare(a.date));

        setSidebarDates(datesProcessed);
        if (datesProcessed.length > 0) setSelectedDate(datesProcessed[0].date);
      }
    };

    fetchSidebar();
    return () => { active = false; };
  }, []);

  // 2. Busca Detalhes + Dados Mensais do ano selecionado
  useEffect(() => {
    if (!selectedDate) return;
    let active = true;

    const fetchDetails = async () => {
      setLoading(true);
      const currentYear = parseInt(selectedDate.split('-')[0], 10);

      const [resDia, resAno, resMes] = await Promise.all([
        supabase
          .from('vw_q_perdamecgeral')
          .select('*')
          .eq('data_apontamento', selectedDate),
        supabase
          .from('vw_q_perdamec_ano')
          .select('*')
          .eq('ano', currentYear)
          .single(),
        supabase
          .from('vw_q_perdamec_mes')
          .select('*')
          .eq('ano', currentYear)
          .order('mes', { ascending: true })
      ]);

      if (active) {
        setDayData(resDia.data || []);
        setYearData(resAno.data || null);
        setMonthlyData(resMes.data || []);
        setLoading(false);
      }
    };

    fetchDetails();
    return () => { active = false; };
  }, [selectedDate]);

  // 3. Lógica Pesada e Memorizada
  const proc = useMemo(() => {
    if (!dayData.length) return null;

    const meta = getMetasParaData(selectedDate);
    let sPerda = 0, sTch = 0, sMtS = 0, sAvS = 0, sMtD = 0, sAvD = 0, sArr = 0, sFix = 0;

    const mapCampos = new Map();
    const sumCat = {};
    CATEGORIAS.forEach((c) => { sumCat[c.key] = 0; });

    dayData.forEach((r) => {
      sPerda += num(r.total_perda);
      sTch += num(r.tch_estimado);
      sArr += num(r.tocos_arrancados);
      sFix += num(r.tocos_fixos);

      const esp = (r.espacamento || '').toLowerCase();
      if (esp === 'simples') {
        sMtS += num(r.mt_pisoteio);
        sAvS += num(r.av_pisoteio);
      }
      if (esp === 'duplo') {
        sMtD += num(r.mt_pisoteio);
        sAvD += num(r.av_pisoteio);
      }

      CATEGORIAS.forEach((c) => { sumCat[c.key] += num(r[c.key]); });

      const campo = r.campo || 'DESC';
      if (!mapCampos.has(campo)) {
        mapCampos.set(campo, {
          nome: campo,
          pts: 0,
          p: 0,
          t: 0,
          mtS: 0,
          avS: 0,
          mtD: 0,
          avD: 0,
          arr: 0,
          fix: 0,
          tch: 0
        });
      }

      const c = mapCampos.get(campo);
      c.pts += 1;
      c.p += num(r.total_perda);
      c.t += num(r.tch_estimado);
      if (esp === 'simples') {
        c.mtS += num(r.mt_pisoteio);
        c.avS += num(r.av_pisoteio);
      }
      if (esp === 'duplo') {
        c.mtD += num(r.mt_pisoteio);
        c.avD += num(r.av_pisoteio);
      }
      c.arr += num(r.tocos_arrancados);
      c.fix += num(r.tocos_fixos);
      c.tch = num(r.tch_estimado);
    });

    const calcDia = {
      perda: (sPerda / (sPerda + sTch)) * 100 || 0,
      pisoteioS: sAvS > 0 ? (sMtS / sAvS) * 100 : 0,
      pisoteioD: sAvD > 0 ? (sMtD / sAvD) * 100 : 0,
      arranquio: sFix > 0 ? (sArr / sFix) * 100 : 0
    };

    const calcAno = yearData
      ? {
          perda: num(yearData.perda_perc),
          pisoteioS: num(yearData.pisoteio_simples_perc),
          pisoteioD: num(yearData.pisoteio_duplo_perc),
          arranquio: num(yearData.arranquio_perc)
        }
      : { perda: 0, pisoteioS: 0, pisoteioD: 0, arranquio: 0 };

    const totalCat = Object.values(sumCat).reduce((a, b) => a + b, 0);
    const rawChartCat = CATEGORIAS.map((c, idx) => ({
      name: c.label,
      key: c.key,
      mediaKg: dayData.length ? sumCat[c.key] / dayData.length : 0,
      perc: totalCat > 0 ? (sumCat[c.key] / totalCat) * 100 : 0,
      color: PIE_COLORS[idx]
    }));

    const maxMediaKg = Math.max(...rawChartCat.map((c) => c.mediaKg), 0);
    const chartCat = rawChartCat
      .map((c) => ({
        ...c,
        mediaColor: getCategoryHeatColor(c.mediaKg, maxMediaKg)
      }))
      .sort((a, b) => b.perc - a.perc);

    const yearCatData = {};
    if (yearData) {
      let totalCatAno = 0;
      CATEGORIAS.forEach((c) => { totalCatAno += num(yearData[c.key]); });
      CATEGORIAS.forEach((c) => {
        yearCatData[c.key] = totalCatAno > 0
          ? (num(yearData[c.key]) / totalCatAno) * 100
          : 0;
      });
    }

    const listaCampos = Array.from(mapCampos.values())
      .map((c) => {
        const perc = (c.p / (c.p + c.t)) * 100 || 0;
        return {
          ...c,
          perdaPerc: perc,
          ton: (perc / 100) * c.tch,
          pisoteioS: c.avS > 0 ? (c.mtS / c.avS) * 100 : null,
          pisoteioD: c.avD > 0 ? (c.mtD / c.avD) * 100 : null,
          arranquio: c.fix > 0 ? (c.arr / c.fix) * 100 : null
        };
      })
      .sort((a, b) => b.perdaPerc - a.perdaPerc);

    const listaPontos = dayData
      .map((r) => {
        const esp = (r.espacamento || '').toLowerCase();
        const p = num(r.total_perda);
        const t = num(r.tch_estimado);
        return {
          campo: r.campo || '',
          maq: parseColhedora(r.colhedora),
          turno: formatTurno(r.turno),
          perdaPerc: p > 0 ? (p / (p + t)) * 100 : 0,
          pisoteioS: esp === 'simples' && num(r.av_pisoteio) > 0
            ? (num(r.mt_pisoteio) / num(r.av_pisoteio)) * 100
            : null,
          pisoteioD: esp === 'duplo' && num(r.av_pisoteio) > 0
            ? (num(r.mt_pisoteio) / num(r.av_pisoteio)) * 100
            : null,
          arranquio: num(r.tocos_fixos) > 0
            ? (num(r.tocos_arrancados) / num(r.tocos_fixos)) * 100
            : null
        };
      })
      .sort((a, b) => a.campo.localeCompare(b.campo));

    // Garante JAN...DEZ mesmo quando alguns meses ainda não possuem registro.
    const monthlyRowByMonth = new Map(
      monthlyData.map((r) => [num(r.mes), r])
    );

    const makeMonthlyMetric = (key) => MONTHS.map((mesLabel, index) => {
      const mes = index + 1;
      const row = monthlyRowByMonth.get(mes);
      return {
        mes,
        mesLabel,
        [key]: row ? num(row[key]) : null
      };
    });

    const monthlyIndicators = {
      perda: makeMonthlyMetric('perda_perc'),
      pisoteioS: makeMonthlyMetric('pisoteio_simples_perc'),
      pisoteioD: makeMonthlyMetric('pisoteio_duplo_perc'),
      arranquio: makeMonthlyMetric('arranquio_perc')
    };

    return {
      meta,
      calcDia,
      calcAno,
      chartCat,
      yearCatData,
      listaCampos,
      listaPontos,
      monthlyIndicators
    };
  }, [dayData, yearData, monthlyData, selectedDate]);

  // ================================= RENDERS ------------------------------------------------
  return (
    <div className="dash-dark-container" style={{ height: '100%', minHeight: 0 }}>
      {/* SIDEBAR */}
      <aside className="dash-sidebar">
        <div className="sidebar-header">
          <h2>DATAS</h2>
        </div>

        <div className="sidebar-date-list">
          {sidebarDates.map((item) => (
            <div
              key={item.date}
              onClick={() => setSelectedDate(item.date)}
              className={`sidebar-date-item ${selectedDate === item.date ? 'active' : ''}`}
            >
              <strong>{item.date.split('-').reverse().join('/')}</strong>
              <span
                className="sidebar-loss-badge"
                style={{ color: item.perda > (proc?.meta.perda || 5) ? 'var(--q-danger)' : 'var(--q-green)' }}
              >
                {item.perda.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="dash-main">
        {loading || !proc ? (
          <div className="dashboard-loading">
            <h2>Carregando matriz de dados...</h2>
          </div>
        ) : (
          <div
            className="dashboard-grid"
            style={{
              gridTemplateColumns: `${DASH_LAYOUT.table}fr ${DASH_LAYOUT.categories}fr ${DASH_LAYOUT.dayYear}fr ${DASH_LAYOUT.monthly}fr`,
              gap: `${DASH_LAYOUT.gap}px`
            }}
          >
            {/* COLUNA 1: TABELAS */}
            <div className="dashboard-column table-column" style={{ gridColumn: 1, gridRow: "1 / span 4" }}>
              <div className="q-panel table-panel">
                <div className="q-panel-title">Resumo por Campo</div>
                <div className="q-table-container">
                  <table className="q-table">
                    <colgroup>
                      <col style={{ width: '27%' }} />
                      <col style={{ width: '8%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '15%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Campo</th>
                        <th className="text-center">Pts</th>
                        <th className="text-right">Perda</th>
                        <th className="text-right">Ton</th>
                        <th className="text-right">P. Simp</th>
                        <th className="text-right">P. Dup</th>
                        <th className="text-right">Arr.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proc.listaCampos.map((c, i) => (
                        <tr key={i}>
                          <td className="text-ellipsis">{c.nome}</td>
                          <td className="text-center">{c.pts}</td>
                          <td className="text-right" style={{ color: getStatusColor(c.perdaPerc, proc.meta.perda) }}>{formatPerc(c.perdaPerc)}</td>
                          <td className="text-right">{c.ton.toFixed(2)}</td>
                          <td className="text-right" style={{ color: getStatusColor(c.pisoteioS, proc.meta.pisoteio_simples) }}>{formatPerc(c.pisoteioS)}</td>
                          <td className="text-right" style={{ color: getStatusColor(c.pisoteioD, proc.meta.pisoteio_duplo) }}>{formatPerc(c.pisoteioD)}</td>
                          <td className="text-right" style={{ color: getStatusColor(c.arranquio, proc.meta.arranquio) }}>{formatPerc(c.arranquio)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="q-panel table-panel">
                <div className="q-panel-title">Ponto a Ponto</div>
                <div className="q-table-container">
                  <table className="q-table">
                    <colgroup>
                      <col style={{ width: '27%' }} />
                      <col style={{ width: '24%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Campo</th>
                        <th>Máq.</th>
                        <th>Turno</th>
                        <th className="text-right">Perda</th>
                        <th className="text-right">P. Simp</th>
                        <th className="text-right">P. Dup</th>
                        <th className="text-right">Arr.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proc.listaPontos.map((p, i) => (
                        <tr key={i}>
                          <td className="text-ellipsis">{p.campo}</td>
                          <td className="text-ellipsis">{p.maq}</td>
                          <td>
                            <span className={`turno-badge ${p.turno === '1º' ? 'turno-1' : p.turno === '2º' ? 'turno-2' : ''}`}>
                              {p.turno}
                            </span>
                          </td>
                          <td className="text-right" style={{ color: getStatusColor(p.perdaPerc, proc.meta.perda) }}>{formatPerc(p.perdaPerc)}</td>
                          <td className="text-right" style={{ color: getStatusColor(p.pisoteioS, proc.meta.pisoteio_simples) }}>{formatPerc(p.pisoteioS)}</td>
                          <td className="text-right" style={{ color: getStatusColor(p.pisoteioD, proc.meta.pisoteio_duplo) }}>{formatPerc(p.pisoteioD)}</td>
                          <td className="text-right" style={{ color: getStatusColor(p.arranquio, proc.meta.arranquio) }}>{formatPerc(p.arranquio)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* COLUNA 2: CATEGORIAS */}
            <div className="dashboard-column category-column" style={{ gridColumn: 2, gridRow: "1 / span 4" }}>
              <div className="q-panel category-panel">
                <div className="q-panel-title">Média Categorias (kg/pt)</div>
                <div className="category-chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={proc.chartCat} margin={{ top: 18, right: 4, left: -18, bottom: 38 }}>
                      <XAxis
                        dataKey="name"
                        stroke="var(--border-color)"
                        tick={{ fill: 'var(--q-gray)', fontSize: 9, fontWeight: 600 }}
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis
                        stroke="var(--border-color)"
                        tick={{ fill: 'var(--q-gray)', fontSize: 9 }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{
                          background: 'var(--bg-panel)',
                          borderColor: 'var(--border-color)',
                          color: '#fff',
                          borderRadius: '8px'
                        }}
                        formatter={(val) => [num(val).toFixed(3), 'kg/pt']}
                      />
                      <Bar dataKey="mediaKg" radius={[5, 5, 1, 1]} barSize={DASH_LAYOUT.barSize}>
                        {proc.chartCat.map((entry, index) => (
                          <Cell key={`cat-${index}`} fill={entry.mediaColor} />
                        ))}
                        <LabelList
                          dataKey="mediaKg"
                          position="top"
                          formatter={(v) => num(v).toFixed(2)}
                          fill="var(--text-main)"
                          fontSize={9}
                          fontWeight="bold"
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="q-panel category-panel">
                <div className="q-panel-title">Distribuição Categorias (%)</div>
                <div className="category-pie-content">
                  <div className="category-pie-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={proc.chartCat}
                          dataKey="perc"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius="42%"
                          outerRadius="72%"
                          paddingAngle={2}
                        >
                          {proc.chartCat.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomPieTooltip yearCatData={proc.yearCatData} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="category-legend category-legend-vertical">
                    {proc.chartCat.map((entry) => (
                      <div className="category-legend-item" key={entry.key}>
                        <span className="category-legend-dot" style={{ backgroundColor: entry.color }} />
                        <span className="category-legend-label">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* INDICADORES: grade direta 2 colunas x 4 linhas — sem cabeçalhos intermediários */}
            <div className="indicator-cell" style={{ gridColumn: 3, gridRow: 1 }}>
              <IndicatorCard title="Perda Total (%)" variant="indicator-main-card">
                <IndicatorDayYearChart
                  diaValue={proc.calcDia.perda}
                  safraValue={proc.calcAno.perda}
                  limite={proc.meta.perda}
                />
              </IndicatorCard>
            </div>
            <div className="indicator-cell" style={{ gridColumn: 4, gridRow: 1 }}>
              <IndicatorCard title="Perda Total (%)" variant="indicator-monthly-card">
                <MonthlyIndicatorChart
                  data={proc.monthlyIndicators.perda}
                  dataKey="perda_perc"
                  limite={proc.meta.perda}
                />
              </IndicatorCard>
            </div>

            <div className="indicator-cell" style={{ gridColumn: 3, gridRow: 2 }}>
              <IndicatorCard title="Pisoteio Simples (%)" variant="indicator-main-card">
                <IndicatorDayYearChart
                  diaValue={proc.calcDia.pisoteioS}
                  safraValue={proc.calcAno.pisoteioS}
                  limite={proc.meta.pisoteio_simples}
                />
              </IndicatorCard>
            </div>
            <div className="indicator-cell" style={{ gridColumn: 4, gridRow: 2 }}>
              <IndicatorCard title="Pisoteio Simples (%)" variant="indicator-monthly-card">
                <MonthlyIndicatorChart
                  data={proc.monthlyIndicators.pisoteioS}
                  dataKey="pisoteio_simples_perc"
                  limite={proc.meta.pisoteio_simples}
                />
              </IndicatorCard>
            </div>

            <div className="indicator-cell" style={{ gridColumn: 3, gridRow: 3 }}>
              <IndicatorCard title="Pisoteio Duplo (%)" variant="indicator-main-card">
                <IndicatorDayYearChart
                  diaValue={proc.calcDia.pisoteioD}
                  safraValue={proc.calcAno.pisoteioD}
                  limite={proc.meta.pisoteio_duplo}
                />
              </IndicatorCard>
            </div>
            <div className="indicator-cell" style={{ gridColumn: 4, gridRow: 3 }}>
              <IndicatorCard title="Pisoteio Duplo (%)" variant="indicator-monthly-card">
                <MonthlyIndicatorChart
                  data={proc.monthlyIndicators.pisoteioD}
                  dataKey="pisoteio_duplo_perc"
                  limite={proc.meta.pisoteio_duplo}
                />
              </IndicatorCard>
            </div>

            <div className="indicator-cell" style={{ gridColumn: 3, gridRow: 4 }}>
              <IndicatorCard title="Arranquio de Rizoma (%)" variant="indicator-main-card">
                <IndicatorDayYearChart
                  diaValue={proc.calcDia.arranquio}
                  safraValue={proc.calcAno.arranquio}
                  limite={proc.meta.arranquio}
                />
              </IndicatorCard>
            </div>
            <div className="indicator-cell" style={{ gridColumn: 4, gridRow: 4 }}>
              <IndicatorCard title="Arranquio de Rizoma (%)" variant="indicator-monthly-card">
                <MonthlyIndicatorChart
                  data={proc.monthlyIndicators.arranquio}
                  dataKey="arranquio_perc"
                  limite={proc.meta.arranquio}
                />
              </IndicatorCard>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
