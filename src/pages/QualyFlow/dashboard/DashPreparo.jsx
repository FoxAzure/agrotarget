// ==========================================================================================
// DASH PREPARO — V1
// Estrutura modular no padrão visual QualyFlow / Dash Perdas.
// Fontes:
//   - vw_q_preparo_datas
//   - vw_q_preparo_geral
//   - vw_q_preparo_ano
//   - vw_q_preparo_mensal
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
  BarChart,
  Bar,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import './BaseDash.css';

// ==========================================================================================
// CONFIGURAÇÕES
// ==========================================================================================

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

// ================================= TIPOGRAFIA =================================
// Ajuste centralizado das fontes. O padrão visual principal usa 10px.
const FONT_SIZE = {
  base: 10,
  xs: 8,
  sm: 9,
  md: 10,
  lg: 12,
  title: 10,
  chartLabel: 9,
  chartValue: 9,
};

// ================================= METAS =====================================
// Regras de resultado expressas em percentual de conformidade.
// Profundidades: >= 90% verde | 80–89,99% amarelo | < 80% vermelho.
// Paralelismos: >= 80% verde | 70–79,99% amarelo | < 70% vermelho.
const METAS_PREPARO = {
  profundidade: {
    meta: 90,
    atencao: 80,
    label: 'Meta 90%',
  },
  paralelismo: {
    meta: 80,
    atencao: 70,
    label: 'Meta 80%',
  },
};

// Ajuste somente aqui para experimentar proporções sem precisar alterar o CSS.
const DASH_LAYOUT = {
  sidebarWidth: 230,
  contentPadding: 10,
  gap: 8,

  // 3 colunas de cada uma das 4 linhas:
  // 1 = tabela | 2 = Dia x Ano | 3 = Histórico Mensal
  table: 2.1,
  dayYear: 0.52,
  monthly: 1.18,

  // Altura padronizada de cada linha/seção.
  rowHeight: 222,

  // Largura padronizada das colunas dos gráficos.
  BAR_WIDTH: 26,

  // Espaçamentos dos gráficos.
  dayYearBarGap: 7,
  dayYearCategoryGap: '24%',
  monthlyBarGap: 2,
  monthlyCategoryGap: '26%',
};



// As quatro métricas desta etapa.
const METRICS = [
  {
    key: 'profund_haste',
    label: 'Profundidade da Haste',
    tableTitle: 'Profundidade da Haste (Mín 23cm)',
    unitDecimals: 0,
    monthlyKey: 'profund_haste',
    metaGroup: 'profundidade',
    compliance: value => Number.isFinite(value) && value >= 23,
    targetText: '≥ 23 cm',
  },
  {
    key: 'profund_cana',
    label: 'Profundidade da Cana',
    tableTitle: 'Profundidade da Cana (Mín 18cm)',
    unitDecimals: 0,
    monthlyKey: 'profund_cana',
    metaGroup: 'profundidade',
    compliance: value => Number.isFinite(value) && value >= 18,
    targetText: '≥ 18 cm',
  },
  {
    key: 'paralelismo_sulco',
    label: 'Paralelismo entre Sulcos',
    tableTitle: 'Paralelismo entre Sulcos (Entre 1,45 a 1,55cm)',
    unitDecimals: 2,
    monthlyKey: 'paralelismo_sulco',
    metaGroup: 'paralelismo',
    compliance: value => Number.isFinite(value) && value >= 1.45 && value <= 1.55,
    targetText: '1,45–1,55 cm',
  },
  {
    key: 'paralelismo_fita',
    label: 'Paralelismo entre Fitas',
    tableTitle: 'Paralelismo entre Fitas (Entre 2,15 a 2,25cm)',
    unitDecimals: 2,
    monthlyKey: 'paralelismo_fita',
    metaGroup: 'paralelismo',
    compliance: value => Number.isFinite(value) && value >= 2.15 && value <= 2.25,
    targetText: '2,15–2,25 cm',
  },
];

// ==========================================================================================
// HELPERS
// ==========================================================================================

const num = (value, fallback = NaN) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const text = (value, fallback = '') => {
  const result = String(value ?? '').trim();
  return result || fallback;
};

const formatNumber = (value, decimals = 2) => {
  const n = num(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(decimals).replace('.', ',');
};

const formatPercent = value => {
  const n = num(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(1).replace('.', ',')}%`;
};

const formatDate = value => {
  const raw = text(value);
  if (!raw) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [year, month, day] = raw.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return raw.slice(0, 10);
  return raw;
};

const getMonthLabel = month => {
  const index = num(month);
  return index >= 1 && index <= 12 ? MONTHS[index - 1] : '—';
};

const getMetricMeta = metric => METAS_PREPARO[metric.metaGroup] || METAS_PREPARO.profundidade;

const complianceColor = (value, metric) => {
  const v = num(value);
  if (!Number.isFinite(v)) return 'var(--text-muted)';
  const meta = getMetricMeta(metric);
  if (v >= meta.meta) return 'var(--q-green)';
  if (v >= meta.atencao) return 'var(--q-warning)';
  return 'var(--q-danger)';
};

const complianceSoft = (value, metric) => {
  const v = num(value);
  if (!Number.isFinite(v)) return 'rgba(100,116,139,.12)';
  const meta = getMetricMeta(metric);
  if (v >= meta.meta) return 'var(--q-green-glow)';
  if (v >= meta.atencao) return 'rgba(245,158,11,.14)';
  return 'var(--q-danger-glow)';
};

const getMetric = key => METRICS.find(metric => metric.key === key);

const isMetricValueValid = (metric, value) => {
  const n = num(value);
  return Number.isFinite(n) && metric.compliance(n);
};

const calculateCompliance = (metric, values) => {
  const validValues = (Array.isArray(values) ? values : [])
    .map(num)
    .filter(Number.isFinite);

  if (!validValues.length) return null;

  const onStandard = validValues.filter(value => metric.compliance(value)).length;
  return (onStandard / validValues.length) * 100;
};

// Valores null/ausentes nunca entram no denominador ou no numerador da conformidade.
// O slot físico permanece vazio somente para preservar a posição dos 12 pontos.
// Divide a field/lote sequence em blocos de 12 pontos.
// Isso mantém o padrão visual da avaliação 12x12 e aceita 24, 36, 48... pontos.
const buildMetricRows = (rows, metric) => {
  const grouped = new Map();

  (Array.isArray(rows) ? rows : []).forEach(row => {
    const field = text(row.campo, 'SEM CAMPO');
    const lot = text(row.lote, '—');
    const key = `${field}||${lot}`;

    if (!grouped.has(key)) {
      grouped.set(key, { field, lot, rows: [] });
    }

    grouped.get(key).rows.push(row);
  });

  const result = [];

  Array.from(grouped.values())
    .sort((a, b) =>
      a.field.localeCompare(b.field, 'pt-BR') ||
      a.lot.localeCompare(b.lot, 'pt-BR', { numeric: true })
    )
    .forEach(group => {
      // Primeiro removemos tudo que não foi efetivamente avaliado para ESTA métrica.
      // Assim null/undefined/vazio nunca ocupam posição nem entram no cálculo.
      const measuredRows = group.rows
        .slice()
        .sort((a, b) => num(a.ponto, 999999) - num(b.ponto, 999999))
        .map(row => ({
          sourcePoint: num(row.ponto, NaN),
          value: num(row[metric.key]),
        }))
        .filter(item => Number.isFinite(item.value) && item.value !== 0);

      if (!measuredRows.length) return;

      // A apresentação é sempre em blocos de NO MÁXIMO 12 valores.
      // Os pontos nulos são descartados antes do agrupamento; portanto,
      // se houver 27 medições reais, teremos 12 + 12 + 3.
      for (let start = 0; start < measuredRows.length; start += 12) {
        const chunk = measuredRows.slice(start, start + 12);
        const standardCount = chunk.filter(item => metric.compliance(item.value)).length;
        const percentage = (standardCount / chunk.length) * 100;

        result.push({
          id: `${group.field}-${group.lot}-${metric.key}-${start}`,
          field: group.field,
          lot: group.lot,
          block: Math.floor(start / 12) + 1,
          points: chunk.map((item, index) => ({
            // A coluna exibida é 1..12. O ponto original permanece apenas
            // como referência no tooltip.
            point: index + 1,
            sourcePoint: item.sourcePoint,
            value: item.value,
          })),
          standardCount,
          measuredCount: chunk.length,
          percentage,
        });
      }
    });

  return result;
};

// ==========================================================================================
// COMPONENTES VISUAIS
// ==========================================================================================

function ComplianceBadge({ value, metric }) {
  const color = complianceColor(value, metric);
  const background = complianceSoft(value, metric);

  return (
    <span
      className="preparo-compliance-badge"
      style={{
        color,
        background,
        borderColor: color,
      }}
    >
      {formatPercent(value)}
    </span>
  );
}

function DayYearChart({ metric, dayValue, yearValue }) {
  const meta = getMetricMeta(metric);
  const data = [
    { name: 'Dia', value: dayValue, color: complianceColor(dayValue, metric) },
    { name: 'Ano', value: yearValue, color: complianceColor(yearValue, metric) },
  ];

  return (
    <div className="preparo-chart-panel">
      <div className="preparo-panel-title">{metric.label}</div>

      <div className="preparo-chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 22, right: 3, left: 0, bottom: 0 }}
            barGap={DASH_LAYOUT.dayYearBarGap}
            barCategoryGap={DASH_LAYOUT.dayYearCategoryGap}
          >
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: 'var(--text-muted)',
                fontSize: FONT_SIZE.chartLabel,
                fontWeight: 700,
              }}
            />

            <YAxis
              domain={[0, 100]}
              hide
            />

            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,.035)' }}
              contentStyle={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                borderRadius: 8,
              }}
              formatter={value => [formatPercent(value), 'Resultado']}
            />

            <ReferenceLine
              y={meta.meta}
              stroke="var(--q-green)"
              strokeDasharray="3 3"
              label={{
                position: 'insideTopLeft',
                value: `Meta: ${meta.meta}%`,
                fill: 'var(--q-green)',
                fontSize: 8,
                fontWeight: 800,
              }}
            />

            <Bar
              dataKey="value"
              barSize={DASH_LAYOUT.BAR_WIDTH}
              radius={[5, 5, 1, 1]}
            >
              {data.map((entry, index) => (
                <Cell key={`day-year-${index}`} fill={entry.color} />
              ))}

              <LabelList
                dataKey="value"
                position="top"
                formatter={value => Number.isFinite(num(value)) ? `${formatNumber(value, 1)}%` : ''}
                fill="var(--text-main)"
                fontSize={FONT_SIZE.chartValue}
                fontWeight={800}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MonthlyChart({ metric, data }) {
  const meta = getMetricMeta(metric);
  const safeData = Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1;
    const existing = (Array.isArray(data) ? data : [])
      .find(row => num(row.mes) === monthNumber);

    return {
      mes: monthNumber,
      mesLabel: MONTHS[index],
      value: existing ? num(existing[metric.monthlyKey]) : null,
    };
  });

  return (
    <div className="preparo-chart-panel">
      <div className="preparo-panel-title">Histórico Mensal - {metric.label}</div>

      <div className="preparo-chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={safeData}
            margin={{ top: 22, right: 1, left: 0, bottom: 0 }}
            barGap={DASH_LAYOUT.monthlyBarGap}
            barCategoryGap={DASH_LAYOUT.monthlyCategoryGap}
          >
            <XAxis
              dataKey="mesLabel"
              interval={0}
              axisLine={false}
              tickLine={false}
              tick={{
                fill: 'var(--text-muted)',
                fontSize: FONT_SIZE.chartLabel,
                fontWeight: 700,
              }}
            />

            <YAxis
              domain={[0, 100]}
              hide
            />

            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,.035)' }}
              contentStyle={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                color: '#fff',
                borderRadius: 8,
              }}
              labelFormatter={label => `Mês: ${label}`}
              formatter={value => [formatPercent(value), 'Resultado']}
            />

            <ReferenceLine
              y={meta.meta}
              stroke="var(--q-green)"
              strokeDasharray="3 3"
            />

            <Bar
              dataKey="value"
              barSize={DASH_LAYOUT.BAR_WIDTH}
              radius={[4, 4, 1, 1]}
            >
              {safeData.map((entry, index) => (
                <Cell
                  key={`month-${metric.key}-${index}`}
                  fill={Number.isFinite(entry.value) ? complianceColor(entry.value, metric) : 'transparent'}
                />
              ))}

              <LabelList
                dataKey="value"
                position="top"
                formatter={value => Number.isFinite(num(value)) ? `${formatNumber(value, 1)}%` : ''}
                fill="var(--text-main)"
                fontSize={FONT_SIZE.chartValue}
                fontWeight={800}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MetricTable({ metric, rows }) {
  const items = buildMetricRows(rows, metric);
  // A tabela sempre mantém exatamente as 12 colunas estruturais de medição.
  const displayPoints = Array.from({ length: 12 }, (_, index) => index + 1);

  return (
    <div className="preparo-table-panel">
      <div className="preparo-table-title">
        <span>{metric.tableTitle}</span>
        <small>{metric.targetText}</small>
      </div>

      <div className="preparo-table-scroll">
        <table className="preparo-table">
          <thead>
            <tr>
              <th>Campo</th>
              <th>Lote</th>
              {displayPoints.map(point => (
                <th key={`${metric.key}-point-${point}`}>{point}</th>
              ))}
              <th>Padrão</th>
              <th>%</th>
            </tr>
          </thead>

          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td className="preparo-field-cell" title={item.field}>
                  {item.field}
                </td>

                <td className="preparo-lot-cell">
                  {item.lot}
                </td>

                {displayPoints.map(pointNumber => {
                  const point = item.points[pointNumber - 1];

                  // Linhas finais com menos de 12 medições mantêm apenas o
                  // espaço estrutural restante, sem valor fictício.
                  if (!point) {
                    return <td key={`${item.id}-${pointNumber}`} className="preparo-value-cell is-not-measured" />;
                  }

                  const value = point.value;
                  const inStandard = metric.compliance(value);

                  return (
                    <td
                      key={`${item.id}-${pointNumber}`}
                      className={`preparo-value-cell ${inStandard ? 'is-good' : 'is-bad'}`}
                      title={`Ponto ${point.sourcePoint}: ${formatNumber(value, metric.unitDecimals)} ${metric.targetText}`}
                    >
                      {formatNumber(value, metric.unitDecimals)}
                    </td>
                  );
                })}

                <td className="preparo-standard-cell">
                  {item.measuredCount ? item.standardCount : '—'}
                </td>

                <td className="preparo-percent-cell">
                  <ComplianceBadge value={item.percentage} metric={metric} />
                </td>
              </tr>
            ))}

            {!items.length && (
              <tr>
                <td colSpan={displayPoints.length + 4} className="preparo-empty-row">
                  Nenhum dado disponível para esta métrica nesta data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="preparo-table-footer">
        <span>
          {items.reduce((sum, item) => sum + item.measuredCount, 0)} ponto(s) avaliados
        </span>
        <span>
          Padrão: {metric.targetText}
        </span>
      </div>
    </div>
  );
}

function MetricSection({ metric, dayRows, yearData, monthlyData }) {
  const dayValue = useMemo(
    () => calculateCompliance(metric, dayRows.map(row => row[metric.key])),
    [metric, dayRows],
  );

  const yearValue = num(yearData?.[metric.key], NaN);

  return (
    <div className="preparo-metric-row">
      <MetricTable metric={metric} rows={dayRows} />
      <DayYearChart
        metric={metric}
        dayValue={dayValue}
        yearValue={yearValue}
      />
      <MonthlyChart
        metric={metric}
        data={monthlyData}
      />
    </div>
  );
}

// ==========================================================================================
// DASH PRINCIPAL
// ==========================================================================================

export default function DashPreparo() {
  const [sidebarDates, setSidebarDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [search, setSearch] = useState('');

  const [dayData, setDayData] = useState([]);
  const [yearData, setYearData] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);

  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');

  // --------------------------------------------------------------------------
  // 1. DATAS DA SIDEBAR
  // --------------------------------------------------------------------------
  useEffect(() => {
    let active = true;

    const loadDates = async () => {
      setLoadingDates(true);
      setError('');

      const response = await supabase
        .from('vw_q_preparo_datas')
        .select('data,pontos,campos')
        .order('data', { ascending: false });

      if (!active) return;

      if (response.error) {
        setError(response.error.message || 'Erro ao consultar vw_q_preparo_datas.');
        setSidebarDates([]);
        setLoadingDates(false);
        return;
      }

      const normalized = (Array.isArray(response.data) ? response.data : [])
        .map(row => ({
          date: text(row.data),
          points: num(row.pontos, 0),
          fields: text(row.campos, 'SEM CAMPO'),
        }))
        .filter(row => row.date);

      setSidebarDates(normalized);

      if (normalized.length && !normalized.some(item => item.date === selectedDate)) {
        setSelectedDate(normalized[0].date);
      }

      setLoadingDates(false);
    };

    loadDates();

    return () => {
      active = false;
    };
  }, []);

  // --------------------------------------------------------------------------
  // 2. BUSCA DA DATA SELECIONADA
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedDate) return;

    let active = true;

    const loadData = async () => {
      setLoadingData(true);
      setError('');

      const currentYear = Number(String(selectedDate).slice(0, 4));

      const [resDay, resYear, resMonthly] = await Promise.all([
        supabase
          .from('vw_q_preparo_geral')
          .select('*')
          .eq('data', selectedDate)
          .order('campo', { ascending: true })
          .order('lote', { ascending: true })
          .order('ponto', { ascending: true }),

        supabase
          .from('vw_q_preparo_ano')
          .select('*')
          .eq('ano', currentYear)
          .maybeSingle(),

        supabase
          .from('vw_q_preparo_mensal')
          .select('*')
          .eq('ano', currentYear)
          .order('mes', { ascending: true }),
      ]);

      if (!active) return;

      if (resDay.error) {
        setError(resDay.error.message || 'Erro ao consultar vw_q_preparo_geral.');
        setDayData([]);
        setYearData(null);
        setMonthlyData([]);
        setLoadingData(false);
        return;
      }

      setDayData(Array.isArray(resDay.data) ? resDay.data : []);
      setYearData(resYear.error ? null : (resYear.data || null));
      setMonthlyData(resMonthly.error ? [] : (Array.isArray(resMonthly.data) ? resMonthly.data : []));
      setLoadingData(false);
    };

    loadData();

    return () => {
      active = false;
    };
  }, [selectedDate]);

  const filteredDates = useMemo(() => {
    const term = search.toLowerCase().trim();

    if (!term) return sidebarDates;

    return sidebarDates.filter(item =>
      `${item.fields} ${item.date}`.toLowerCase().includes(term)
    );
  }, [sidebarDates, search]);


  if (loadingDates && !sidebarDates.length) {
    return (
      <div className="preparo-loading">
        Carregando datas de preparo...
      </div>
    );
  }

  if (error && !selectedDate) {
    return (
      <div className="preparo-loading is-error">
        <strong>Erro ao carregar Dashboard de Preparo</strong>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div
      className="dash-preparo"
      style={{
        '--preparo-grid-gap': `${DASH_LAYOUT.gap}px`,
        '--preparo-row-height': `${DASH_LAYOUT.rowHeight}px`,
        '--preparo-sidebar-width': `${DASH_LAYOUT.sidebarWidth}px`,
        '--preparo-bar-width': `${DASH_LAYOUT.BAR_WIDTH}px`,
        '--preparo-font-base': `${FONT_SIZE.base}px`,
        '--preparo-font-xs': `${FONT_SIZE.xs}px`,
        '--preparo-font-sm': `${FONT_SIZE.sm}px`,
        '--preparo-font-md': `${FONT_SIZE.md}px`,
        '--preparo-font-lg': `${FONT_SIZE.lg}px`,
        '--preparo-font-title': `${FONT_SIZE.title}px`,
        '--preparo-chart-label': `${FONT_SIZE.chartLabel}px`,
        '--preparo-chart-value': `${FONT_SIZE.chartValue}px`,
      }}
    >
      {/* ====================================================================
          SIDEBAR
      ==================================================================== */}
      <aside className="preparo-sidebar">
        <div className="preparo-sidebar-head">
          <div>
            <strong>DATAS</strong>
            <span>{filteredDates.length}</span>
          </div>
        </div>

        <div className="preparo-search-wrap">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Pesquisar campo..."
            aria-label="Pesquisar campo"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
            >
              ×
            </button>
          )}
        </div>

        <div className="preparo-sidebar-hint">
          Pesquise um campo para exibir somente as datas em que ele foi avaliado.
        </div>

        <div className="preparo-date-list">
          {filteredDates.map(item => {
            const selected = item.date === selectedDate;

            return (
              <button
                type="button"
                key={item.date}
                className={`preparo-date-row ${selected ? 'is-selected' : ''}`}
                onClick={() => setSelectedDate(item.date)}
              >
                <span>
                  <strong>{formatDate(item.date)}</strong>
                  <small>{item.fields}</small>
                </span>

                <b>{item.points}</b>
              </button>
            );
          })}

          {!filteredDates.length && (
            <div className="preparo-sidebar-empty">
              Nenhuma data encontrada.
            </div>
          )}
        </div>
      </aside>

      {/* ====================================================================
          CONTEÚDO MODULAR
          Hoje: 4 linhas.
          Futuramente novos módulos podem entrar depois deste bloco.
      ==================================================================== */}
      <main className="preparo-main">
        {loadingData ? (
          <div className="preparo-data-loading">
            Atualizando matriz de preparo...
          </div>
        ) : (
          <div
            className="preparo-metric-grid"
            style={{
              '--preparo-col-table': `${DASH_LAYOUT.table}fr`,
              '--preparo-col-dayyear': `${DASH_LAYOUT.dayYear}fr`,
              '--preparo-col-monthly': `${DASH_LAYOUT.monthly}fr`,
              '--preparo-grid-gap': `${DASH_LAYOUT.gap}px`,
            }}
          >
            {METRICS.map(metric => (
              <MetricSection
                key={metric.key}
                metric={metric}
                dayRows={dayData}
                yearData={yearData}
                monthlyData={monthlyData}
              />
            ))}
          </div>
        )}

        {/* Espaço proposital para futuros módulos desta tela. */}
        <section className="preparo-future-slot" aria-hidden="true" />
      </main>
    </div>
  );
}
