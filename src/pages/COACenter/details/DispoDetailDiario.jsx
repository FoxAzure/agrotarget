import React, { useEffect, useMemo, useState } from 'react';
import DateSelectorCOA from '../../../components/COACenter/DateSelectorCOA';
import { supabase } from '../../../lib/supabaseClient';
import DispoDetailDiarioModal from './DispoDetailDiarioModal';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ================================= METAS ================================= //

const DISPO_META_VERDE = 90;
const DISPO_META_AMARELA = 80;
const INDETER_META_ALERTA = 10;

// ================================= QUERY / PAGINAÇÃO ================================= //

const MAIN_COLUMNS = [
  'id',
  'cod_equip',
  'desc_equip',
  'desc_area',
  'desc_grupo',
  'cod_op',
  'data',
  'hrs_operacionais_seg',
  'hrs_disp_seg',
  'manutencao_seg',
  'indeter_seg',
].join(',');

const PAGE_SIZE = 1000;

const fetchAllPages = async (makeQuery) => {
  let allRows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await makeQuery().range(from, to);

    if (error) throw error;

    const pageRows = data || [];
    allRows = [...allRows, ...pageRows];

    if (pageRows.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return allRows;
};

// ================================= CATEGORIAS ================================= //

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const getCategoriaMapeada = (descricao) => {
  const desc = normalizeText(descricao);

  if (!desc) return 'SEM DESCRIÇÃO';

  if (desc.includes('EMPACOTADEIRA')) return 'EMPACOTADEIRAS';

  if (
    desc.startsWith('TRATOR') ||
    desc.startsWith('TRATORES') ||
    desc.includes('TRATOR ')
  ) {
    return 'TRATORES';
  }

  if (
    desc.includes('CAMINHAO') ||
    desc.includes('CAMINHÃO') ||
    desc.startsWith('CAM ') ||
    desc.includes(' CAM ')
  ) {
    return 'CAMINHÕES';
  }

  if (desc.includes('COLHEDORA')) return 'COLHEDORAS';
  if (desc.includes('TRANSBORDO')) return 'TRANSBORDOS';

  if (
    desc.includes('CARREGADEIRA') ||
    desc.includes('PA CARREGADEIRA') ||
    desc.includes('PÁ CARREGADEIRA')
  ) {
    return 'CARREGADEIRAS';
  }

  if (desc.includes('MOTONIVELADORA')) return 'MOTONIVELADORAS';
  if (desc.includes('RETROESCAVADEIRA')) return 'RETROESCAVADEIRAS';
  if (desc.includes('ESCAVADEIRA')) return 'ESCAVADEIRAS';
  if (desc.includes('MOTOBOMBA')) return 'MOTOBOMBAS';

  if (desc.includes('APLICACAO COMPOSTO') || desc.includes('APLICAÇÃO COMPOSTO')) {
    return 'APLICAÇÃO COMPOSTO';
  }

  return String(descricao || '').trim() || 'SEM DESCRIÇÃO';
};

// ================================= HELPERS ================================= //

const isoToBr = (isoDate) => {
  if (!isoDate || typeof isoDate !== 'string' || !isoDate.includes('-')) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
};

const toIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLast7DaysFromIso = (isoDate) => {
  const datesBr = [];
  const labels = [];

  const base = new Date(`${isoDate}T12:00:00Z`);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);

    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();

    datesBr.push(`${dd}/${mm}/${yyyy}`);
    labels.push({
      full: `${dd}/${mm}/${yyyy}`,
      short: `${dd}/${mm}`,
    });
  }

  return { datesBr, labels };
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatInt = (value) => `${Math.round(Number(value || 0))}`;

const formatHHMM = (valueInHours) => {
  const totalMinutes = Math.max(0, Math.round(Number(valueInHours || 0) * 60));
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const getDispoColor = (value) => {
  const safe = Number(value || 0);
  if (safe >= DISPO_META_VERDE) return 'var(--coa-success)';
  if (safe >= DISPO_META_AMARELA) return 'var(--coa-warning, #f59e0b)';
  return 'var(--coa-danger)';
};

const getDispoTint = (value, alpha = 0.10) => {
  const safe = Number(value || 0);
  if (safe >= DISPO_META_VERDE) return `rgba(61,220,151,${alpha})`;
  if (safe >= DISPO_META_AMARELA) return `rgba(245,158,11,${alpha})`;
  return `rgba(239,68,68,${alpha})`;
};

const getInsightColor = (type) => {
  if (type === 'good') return '#7ae3b5';
  if (type === 'warning') return '#f6d66d';
  if (type === 'bad') return '#ff7d7d';
  return 'var(--coa-text-soft)';
};

const getInsightBg = (type) => {
  if (type === 'good') return 'rgba(61,220,151,0.06)';
  if (type === 'warning') return 'rgba(245,158,11,0.07)';
  if (type === 'bad') return 'rgba(239,68,68,0.07)';
  return 'rgba(255,255,255,0.02)';
};

const getInsightBorder = (type) => {
  if (type === 'good') return 'rgba(61,220,151,0.20)';
  if (type === 'warning') return 'rgba(245,158,11,0.22)';
  if (type === 'bad') return 'rgba(239,68,68,0.22)';
  return 'var(--coa-divider)';
};

// ================================= MATEMÁTICA ================================= //

const normalizeRow = (row = {}) => {
  const operSeg = toNumber(row.hrs_operacionais_seg);
  const manutSeg = toNumber(row.manutencao_seg);
  const indeterSeg = toNumber(row.indeter_seg);

  return {
    ...row,
    categoria_equip: getCategoriaMapeada(row.desc_equip),
    hrs_operacionais: operSeg / 3600,
    hrs_manutencao: manutSeg / 3600,
    hrs_indeter: indeterSeg / 3600,
  };
};

const aggregateRows = (rows = []) => {
  const total = rows.reduce(
    (acc, row) => {
      acc.hrs_operacionais += toNumber(row.hrs_operacionais);
      acc.hrs_manutencao += toNumber(row.hrs_manutencao);
      acc.hrs_indeter += toNumber(row.hrs_indeter);
      return acc;
    },
    { hrs_operacionais: 0, hrs_manutencao: 0, hrs_indeter: 0 }
  );

  const uniqueEquips = new Set(rows.map((r) => r.cod_equip).filter(Boolean)).size;

  const perc_disp =
    total.hrs_operacionais > 0
      ? Math.max(0, (1 - total.hrs_manutencao / total.hrs_operacionais)) * 100
      : 0;

  const perc_manutencao =
    total.hrs_operacionais > 0
      ? (total.hrs_manutencao / total.hrs_operacionais) * 100
      : 0;

  const perc_indeter =
    total.hrs_operacionais > 0
      ? (total.hrs_indeter / total.hrs_operacionais) * 100
      : 0;

  return {
    ...total,
    perc_disp,
    perc_manutencao,
    perc_indeter,
    qnt_equip: uniqueEquips,
  };
};

const groupAndAggregate = (rows = [], keyGetter) => {
  const map = new Map();

  rows.forEach((row) => {
    const key = keyGetter(row) || 'NÃO MAPEADO';

    if (!map.has(key)) {
      map.set(key, {
        key,
        rows: [],
      });
    }

    map.get(key).rows.push(row);
  });

  return [...map.values()].map((item) => ({
    ...item,
    ...aggregateRows(item.rows),
  }));
};

// ================================= COMPONENTES UI ================================= //

const MetricCard = ({ label, value, color = 'var(--coa-text)' }) => (
  <div
    className="rounded-[14px] border px-3 py-3 bg-[rgba(255,255,255,0.02)] flex flex-col justify-between"
    style={{ borderColor: 'var(--coa-divider)' }}
  >
    <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)] mb-1">
      {label}
    </span>
    <span className="block text-[1.1rem] md:text-[1.2rem] font-black tracking-tight" style={{ color }}>
      {value}
    </span>
  </div>
);

const SelectField = ({ label, value, onChange, options = [] }) => (
  <div className="flex flex-col gap-1">
    <span className="coa-text-micro">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-[40px] rounded-[14px] border px-3 text-sm font-bold outline-none"
      style={{
        borderColor: 'var(--coa-divider)',
        background: 'rgba(15,23,42,0.88)',
        color: 'var(--coa-text)',
      }}
    >
      <option value="Todos" style={{ background: '#0f172a', color: '#e2e8f0' }}>
        Todos
      </option>
      {options.map((option) => (
        <option key={option} value={option} style={{ background: '#0f172a', color: '#e2e8f0' }}>
          {option}
        </option>
      ))}
    </select>
  </div>
);

const CategoryTableDispo = ({ rows = [], selectedCategories = [], onToggle }) => {
  return (
    <div className="coa-panel p-0 overflow-hidden coa-area-table-home">
      <div
        className="grid grid-cols-[1.45fr_0.7fr_0.9fr] gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--coa-divider)' }}
      >
        <span className="coa-text-micro">Categoria</span>
        <span className="coa-text-micro text-right">Qnt</span>
        <span className="coa-text-micro text-right">Disp.Mec</span>
      </div>

      <div className="coa-area-table-home__body max-h-[250px] overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm font-bold text-[var(--coa-text-muted)]">
            Nenhuma categoria encontrada para os filtros selecionados.
          </div>
        ) : (
          rows.map((row) => {
            const active = selectedCategories.includes(row.categoria_equip);

            return (
              <button
                key={row.categoria_equip}
                type="button"
                onClick={() => onToggle(row.categoria_equip)}
                className="w-full text-left grid grid-cols-[1.45fr_0.7fr_0.9fr] gap-2 px-4 py-3 border-b transition-colors"
                style={{
                  borderColor: 'var(--coa-divider)',
                  background: active ? 'rgba(61,220,151,0.08)' : 'transparent',
                }}
              >
                <span className="text-[12px] font-black text-[var(--coa-text)] truncate pr-2">
                  {row.categoria_equip}
                </span>

                <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)]">
                  {formatInt(row.qnt_equip)}
                </span>

                <span
                  className="text-[12px] font-black text-right"
                  style={{ color: getDispoColor(row.perc_disp) }}
                >
                  {formatPercent(row.perc_disp)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

const ExpandBlock = ({ expanded, children }) => (
  <div
    className={`grid transition-all duration-300 ease-out ${
      expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
    }`}
  >
    <div className="overflow-hidden">{children}</div>
  </div>
);

const InsightBox = ({ type = 'info', title, children }) => (
  <div
    className="rounded-[16px] border p-4 flex flex-col gap-3"
    style={{
      borderColor: getInsightBorder(type),
      background: getInsightBg(type),
    }}
  >
    <span
      className="text-[11px] font-black uppercase tracking-[0.14em]"
      style={{ color: getInsightColor(type) }}
    >
      {title}
    </span>

    <div className="text-sm font-bold leading-relaxed text-[var(--coa-text-soft)]">
      {children}
    </div>
  </div>
);

const RankingTable = ({ columns = [], rows = [], emptyText = 'Sem dados para exibir.' }) => (
  <div className="coa-panel p-0 overflow-hidden">
    <div
      className="grid gap-2 px-4 py-3 border-b"
      style={{
        borderColor: 'var(--coa-divider)',
        gridTemplateColumns: columns.map((col) => col.width || '1fr').join(' '),
      }}
    >
      {columns.map((col) => (
        <span
          key={col.key}
          className={`coa-text-micro ${col.align === 'right' ? 'text-right' : ''}`}
        >
          {col.label}
        </span>
      ))}
    </div>

    <div>
      {rows.length === 0 ? (
        <div className="px-4 py-5 text-center text-sm font-bold text-[var(--coa-text-muted)]">
          {emptyText}
        </div>
      ) : (
        rows.map((row, idx) => (
          <div
            key={row.id || `${row.name}-${idx}`}
            className="grid gap-2 px-4 py-3 border-b"
            style={{
              borderColor: 'var(--coa-divider)',
              gridTemplateColumns: columns.map((col) => col.width || '1fr').join(' '),
              background: idx === 0 ? 'rgba(239,68,68,0.05)' : 'transparent',
            }}
          >
            {columns.map((col) => (
              <span
                key={col.key}
                className={`text-[12px] font-black truncate ${
                  col.align === 'right' ? 'text-right whitespace-nowrap' : ''
                }`}
                style={{ color: col.color ? col.color(row) : 'var(--coa-text-soft)' }}
                title={String(row[col.key] || '')}
              >
                {col.render ? col.render(row, idx) : row[col.key]}
              </span>
            ))}
          </div>
        ))
      )}
    </div>
  </div>
);

const TrendTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0].payload;

  return (
    <div className="coa-panel p-3 border shadow-lg" style={{ borderColor: 'var(--coa-divider)' }}>
      <p className="coa-text-micro mb-2">{row.fullDate}</p>
      <p className="text-sm font-black" style={{ color: getDispoColor(row.perc_disp) }}>
        Disponibilidade: {formatPercent(row.perc_disp)}
      </p>
      <p className="text-xs font-bold text-[var(--coa-danger)] mt-1">
        Manutenção: {formatHHMM(row.hrs_manutencao)}
      </p>
    </div>
  );
};

const TrendDot = (props) => {
  const { cx, cy, payload } = props;

  if (cx === undefined || cy === undefined || !payload) return null;

  const color = getDispoColor(payload.perc_disp);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={color}
      stroke="var(--coa-bg-soft)"
      strokeWidth={2}
    />
  );
};

const TrendLabel = (props) => {
  const { x, y, value } = props;

  if (x === undefined || y === undefined || value === undefined) return null;

  const color = getDispoColor(value);

  return (
    <text
      x={x}
      y={y}
      dy={-12}
      fill={color}
      fontSize={12}
      fontWeight="900"
      textAnchor="middle"
    >
      {formatPercent(value)}
    </text>
  );
};

const ScreenAnalysisPanel = ({
  rows = [],
  totalAgg,
  trendRows = [],
}) => {
  const analysis = useMemo(() => {
    if (!rows.length) {
      return {
        geralType: 'warning',
        geralText: 'Não existem equipamentos no filtro atual.',
        frenteRows: [],
        equipRows: [],
        equipsBelow80: [],
        indeterRows: [],
        trendChart: [],
        trendType: 'info',
        trendText: 'Sem dados suficientes para leitura de tendência.',
      };
    }

    const frenteRows = groupAndAggregate(rows, (row) => row.desc_grupo || 'SEM FRENTE')
      .sort((a, b) => a.perc_disp - b.perc_disp)
      .slice(0, 5)
      .map((item) => ({
        id: item.key,
        name: item.key,
        qnt: item.qnt_equip,
        manut: item.hrs_manutencao,
        perc: item.perc_disp,
      }));

    const equipRows = groupAndAggregate(rows, (row) => row.cod_equip || 'SEM CÓDIGO')
      .map((equip) => {
        const first = equip.rows[0] || {};
        return {
          id: first.cod_equip || equip.key,
          cod_equip: first.cod_equip || equip.key,
          desc_equip: first.desc_equip || 'SEM DESCRIÇÃO',
          frente: first.desc_grupo || 'SEM FRENTE',
          area: first.desc_area || 'NÃO MAPEADA',
          manut: equip.hrs_manutencao,
          indeter: equip.hrs_indeter,
          perc_indeter: equip.perc_indeter,
          perc: equip.perc_disp,
        };
      })
      .sort((a, b) => a.perc - b.perc);

    const equipsBelow80 = equipRows.filter((item) => item.perc < DISPO_META_AMARELA);

    const indeterRows = equipRows
      .filter((item) => item.indeter > 0)
      .sort((a, b) => b.indeter - a.indeter)
      .slice(0, 10);

    let geralType = 'good';
    let geralText = `O escopo filtrado apresenta ${formatPercent(totalAgg.perc_disp)} de Disponibilidade Mecânica dentro da meta de ${DISPO_META_VERDE}%.`;

    if (totalAgg.perc_disp < DISPO_META_AMARELA) {
      geralType = 'bad';
      geralText = `O escopo filtrado apresenta ${formatPercent(totalAgg.perc_disp)} de Disponibilidade Mecânica abaixo da meta. Analisar equipamentos com baixos índices de disponibilidade.`;
    } else if (totalAgg.perc_disp < DISPO_META_VERDE) {
      geralType = 'warning';
      geralText = `O escopo filtrado apresenta ${formatPercent(totalAgg.perc_disp)} de Disponibilidade Mecânica em nível de atenção. Analisar equipamentos com baixos índices de disponibilidade.`;
    }

    const trendChart = trendRows;
    const validTrendDays = trendChart.filter((item) => item.hrs_operacionais > 0);
    const selectedDay = trendChart[trendChart.length - 1] || null;
    const prevDay = trendChart[trendChart.length - 2] || null;

    const avgBeforeSelectedRows = trendChart.slice(0, -1).filter((item) => item.hrs_operacionais > 0);
    const avgBeforeSelected =
      avgBeforeSelectedRows.length > 0
        ? avgBeforeSelectedRows.reduce((acc, item) => acc + item.perc_disp, 0) / avgBeforeSelectedRows.length
        : 0;

    const bestDay = [...validTrendDays].sort((a, b) => b.perc_disp - a.perc_disp)[0] || null;
    const worstDay = [...validTrendDays].sort((a, b) => a.perc_disp - b.perc_disp)[0] || null;

    let trendType = 'info';
    let trendText = 'Sem dados suficientes para leitura de tendência.';

    if (selectedDay && validTrendDays.length >= 2) {
      const diffAvg = selectedDay.perc_disp - avgBeforeSelected;
      const diffPrev = prevDay ? selectedDay.perc_disp - prevDay.perc_disp : 0;

      if (diffAvg >= 3 && diffPrev >= 0) {
        trendType = 'good';
        trendText = `A data selecionada fechou com ${formatPercent(selectedDay.perc_disp)}, acima da média dos 6 dias anteriores (${formatPercent(avgBeforeSelected)}). A tendência recente é positiva.`;
      } else if (diffAvg <= -3 && diffPrev <= 0) {
        trendType = 'bad';
        trendText = `A data selecionada fechou com ${formatPercent(selectedDay.perc_disp)}, abaixo da média dos 6 dias anteriores (${formatPercent(avgBeforeSelected)}). O resultado atual está pior que o comportamento recente.`;
      } else if (diffPrev > 3) {
        trendType = 'good';
        trendText = `A disponibilidade melhorou em relação ao dia anterior, saindo de ${formatPercent(prevDay.perc_disp)} para ${formatPercent(selectedDay.perc_disp)}.`;
      } else if (diffPrev < -3) {
        trendType = 'warning';
        trendText = `A disponibilidade caiu em relação ao dia anterior, saindo de ${formatPercent(prevDay.perc_disp)} para ${formatPercent(selectedDay.perc_disp)}.`;
      } else {
        trendType = 'info';
        trendText = `A disponibilidade da data selecionada está próxima do comportamento dos últimos dias. Resultado atual: ${formatPercent(selectedDay.perc_disp)}. Média dos 6 dias anteriores: ${formatPercent(avgBeforeSelected)}.`;
      }

      if (bestDay && worstDay) {
        trendText += ` Melhor dia do período: ${bestDay.fullDate} com ${formatPercent(bestDay.perc_disp)}. Pior dia: ${worstDay.fullDate} com ${formatPercent(worstDay.perc_disp)}.`;
      }
    }

    const top10EquipRows = equipRows.slice(0, 10);

    return {
      geralType,
      geralText,
      frenteRows,
      equipRows: top10EquipRows,
      equipsBelow80,
      indeterRows,
      trendChart,
      trendType,
      trendText,
    };
  }, [rows, totalAgg, trendRows]);

  const rankingColumns = [
    {
      key: 'name',
      label: 'Nome',
      width: 'minmax(0,1fr)',
    },
    {
      key: 'manut',
      label: 'Manut.',
      width: '82px',
      align: 'right',
      render: (row) => formatHHMM(row.manut),
      color: () => 'var(--coa-danger)',
    },
    {
      key: 'perc',
      label: 'Disp.',
      width: '72px',
      align: 'right',
      render: (row) => formatPercent(row.perc),
      color: (row) => getDispoColor(row.perc),
    },
  ];

  const equipColumns = [
    {
      key: 'cod_equip',
      label: 'Equip.',
      width: '76px',
      color: () => 'var(--coa-text)',
    },
    {
      key: 'frente',
      label: 'Frente',
      width: 'minmax(0,1fr)',
    },
    {
      key: 'manut',
      label: 'Manut.',
      width: '82px',
      align: 'right',
      render: (row) => formatHHMM(row.manut),
      color: () => 'var(--coa-danger)',
    },
    {
      key: 'perc',
      label: 'Disp.',
      width: '72px',
      align: 'right',
      render: (row) => formatPercent(row.perc),
      color: (row) => getDispoColor(row.perc),
    },
  ];

  const indeterColumns = [
    {
      key: 'cod_equip',
      label: 'Equip.',
      width: '76px',
      color: () => 'var(--coa-text)',
    },
    {
      key: 'frente',
      label: 'Frente',
      width: 'minmax(0,1fr)',
    },
    {
      key: 'indeter',
      label: 'Indeter.',
      width: '86px',
      align: 'right',
      render: (row) => formatHHMM(row.indeter),
      color: () => '#f6d66d',
    },
    {
      key: 'perc_indeter',
      label: '%',
      width: '64px',
      align: 'right',
      render: (row) => formatPercent(row.perc_indeter),
      color: (row) => row.perc_indeter > INDETER_META_ALERTA ? 'var(--coa-danger)' : '#f6d66d',
    },
  ];

  return (
    <div className="coa-panel p-4 md:p-5 flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[1.15rem] md:text-[1.25rem] font-black uppercase tracking-tight leading-none text-[var(--coa-text)]">
          Análises
        </h2>
      </div>

      <InsightBox type={analysis.geralType} title="Leitura geral">
        {analysis.geralText}
      </InsightBox>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <span className="coa-text-micro">Frentes com menor disponibilidade</span>
          <RankingTable
            columns={rankingColumns}
            rows={analysis.frenteRows}
            emptyText="Nenhuma frente encontrada no escopo atual."
          />
        </div>

        <div className="flex flex-col gap-3">
          <span className="coa-text-micro">Top 10 Equip. Menor Disponibilidade</span>
          <RankingTable
            columns={equipColumns}
            rows={analysis.equipRows}
            emptyText="Nenhum equipamento encontrado no escopo atual."
          />
        </div>
      </div>

      <InsightBox
        type={analysis.equipsBelow80.length > 0 ? 'bad' : 'good'}
        title="Equipamentos abaixo de 80%"
      >
        {analysis.equipsBelow80.length > 0 ? (
          <span>
            {analysis.equipsBelow80.length} equipamento(s) do escopo filtrado estão abaixo de {DISPO_META_AMARELA}% de disponibilidade.
          </span>
        ) : (
          <span>
            Nenhum equipamento do escopo filtrado está abaixo de {DISPO_META_AMARELA}% de disponibilidade.
          </span>
        )}
      </InsightBox>

      <InsightBox
        type={totalAgg.perc_indeter > INDETER_META_ALERTA ? 'bad' : totalAgg.hrs_indeter > 0 ? 'warning' : 'good'}
        title="Informações indeterminadas"
      >
        {totalAgg.perc_indeter > INDETER_META_ALERTA ? (
          <span>
            O escopo filtrado possui {formatPercent(totalAgg.perc_indeter)} de horas indeterminadas, acima do limite de atenção de {INDETER_META_ALERTA}%. As informações estão sujeitas a recálculos quando novos dados forem processados.
          </span>
        ) : totalAgg.hrs_indeter > 0 ? (
          <span>
            Existem {formatHHMM(totalAgg.hrs_indeter)} de horas indeterminadas, equivalentes a {formatPercent(totalAgg.perc_indeter)} do escopo. O volume ainda está controlado, mas pode alterar resultados após reprocessamento.
          </span>
        ) : (
          <span>
            Não foram identificadas horas indeterminadas no escopo filtrado. A leitura dos indicadores tende a ser mais confiável.
          </span>
        )}
      </InsightBox>

      {analysis.indeterRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="coa-text-micro">Equipamentos sujeitos a recálculo</span>
          <RankingTable
            columns={indeterColumns}
            rows={analysis.indeterRows}
            emptyText="Nenhum equipamento com horas indeterminadas."
          />
        </div>
      )}

      <InsightBox type={analysis.trendType} title="Tendência dos últimos 7 dias">
        <div className="flex flex-col gap-4">
          <span>{analysis.trendText}</span>

          <div className="h-[280px] min-h-[280px] w-full min-w-0 overflow-visible">
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={240}
            >
              <LineChart
                data={analysis.trendChart}
                margin={{
                  top: 34,
                  right: 24,
                  left: 16,
                  bottom: 8,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--coa-border)"
                  vertical={false}
                />

                <XAxis
                  dataKey="label"
                  stroke="var(--coa-text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                  interval={0}
                  minTickGap={0}
                />

                <YAxis hide domain={[0, 100]} />

                <Tooltip
                  content={<TrendTooltip />}
                  cursor={{
                    stroke: 'var(--coa-border)',
                    strokeWidth: 1,
                    strokeDasharray: '5 5',
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="perc_disp"
                  stroke="var(--coa-text-soft)"
                  strokeWidth={2}
                  dot={<TrendDot />}
                  activeDot={{
                    r: 7,
                    stroke: 'var(--coa-text)',
                    strokeWidth: 2,
                  }}
                  label={<TrendLabel />}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </InsightBox>
    </div>
  );
};

// ================================= MAIN COMPONENT ================================= //

const DispoDetailDiario = ({
  selectedDate,
  setSelectedDate,
  availableDates = [],
}) => {
  const [rows, setRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [areaFilter, setAreaFilter] = useState('Todos');
  const [frenteFilter, setFrenteFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedTableCategories, setSelectedTableCategories] = useState([]);

  const [expandedAreas, setExpandedAreas] = useState([]);
  const [expandedFrentes, setExpandedFrentes] = useState([]);

  const [selectedModalItem, setSelectedModalItem] = useState(null);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const { datesBr, labels } = useMemo(() => getLast7DaysFromIso(selectedDate), [selectedDate]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const selectedBrDate = isoToBr(selectedDate);

        const [currentDayData, historyData] = await Promise.all([
          fetchAllPages(() =>
            supabase
              .from('tb_c_geral')
              .select(MAIN_COLUMNS)
              .eq('data', selectedBrDate)
              .eq('status', 'ATIVO')
              .order('id', { ascending: true })
          ),

          fetchAllPages(() =>
            supabase
              .from('tb_c_geral')
              .select(MAIN_COLUMNS)
              .in('data', datesBr)
              .eq('status', 'ATIVO')
              .order('id', { ascending: true })
          ),
        ]);

        if (!mounted) return;

        setRows((currentDayData || []).map(normalizeRow));
        setHistoryRows((historyData || []).map(normalizeRow));
        setSelectedTableCategories([]);
        setExpandedAreas([]);
        setExpandedFrentes([]);

      } catch (err) {
        console.error('[COA] Erro ao carregar disponibilidade diária:', err);
        if (mounted) setError('Falha ao carregar os dados de disponibilidade.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [selectedDate, datesBr]);

  useEffect(() => {
    setSelectedTableCategories([]);
    setExpandedAreas([]);
    setExpandedFrentes([]);
  }, [categoryFilter, areaFilter, frenteFilter, searchTerm]);

  const categoryOptions = useMemo(
    () => [...new Set(rows.map((r) => r.categoria_equip).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [rows]
  );

  const areaOptions = useMemo(() => {
    let base = rows;
    if (categoryFilter !== 'Todos') base = base.filter((r) => r.categoria_equip === categoryFilter);
    return [...new Set(base.map((r) => r.desc_area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rows, categoryFilter]);

  const frenteOptions = useMemo(() => {
    let base = rows;
    if (categoryFilter !== 'Todos') base = base.filter((r) => r.categoria_equip === categoryFilter);
    if (areaFilter !== 'Todos') base = base.filter((r) => r.desc_area === areaFilter);
    return [...new Set(base.map((r) => r.desc_grupo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rows, categoryFilter, areaFilter]);

  const applyCurrentFilters = (baseRows = []) => {
    let base = baseRows;

    if (categoryFilter !== 'Todos') base = base.filter((r) => r.categoria_equip === categoryFilter);
    if (areaFilter !== 'Todos') base = base.filter((r) => r.desc_area === areaFilter);
    if (frenteFilter !== 'Todos') base = base.filter((r) => r.desc_grupo === frenteFilter);

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      base = base.filter((r) => {
        const cod = String(r.cod_equip || '').toLowerCase();
        const desc = String(r.desc_equip || '').toLowerCase();
        return cod.includes(term) || desc.includes(term);
      });
    }

    if (selectedTableCategories.length > 0) {
      base = base.filter((r) => selectedTableCategories.includes(r.categoria_equip));
    }

    return base;
  };

  const topFilteredRows = useMemo(() => {
    let base = rows;

    if (categoryFilter !== 'Todos') base = base.filter((r) => r.categoria_equip === categoryFilter);
    if (areaFilter !== 'Todos') base = base.filter((r) => r.desc_area === areaFilter);
    if (frenteFilter !== 'Todos') base = base.filter((r) => r.desc_grupo === frenteFilter);

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      base = base.filter((r) => {
        const cod = String(r.cod_equip || '').toLowerCase();
        const desc = String(r.desc_equip || '').toLowerCase();
        return cod.includes(term) || desc.includes(term);
      });
    }

    return base;
  }, [rows, categoryFilter, areaFilter, frenteFilter, searchTerm]);

  const categoryTableRows = useMemo(() => {
    const catMap = new Map();

    topFilteredRows.forEach((row) => {
      const cat = row.categoria_equip;
      if (!catMap.has(cat)) {
        catMap.set(cat, { categoria_equip: cat, rows: [] });
      }
      catMap.get(cat).rows.push(row);
    });

    return [...catMap.values()].map((cat) => {
      const agg = aggregateRows(cat.rows);
      return { ...cat, ...agg };
    }).sort((a, b) => a.perc_disp - b.perc_disp);
  }, [topFilteredRows]);

  const finalRows = useMemo(() => {
    if (selectedTableCategories.length === 0) return topFilteredRows;
    return topFilteredRows.filter((r) => selectedTableCategories.includes(r.categoria_equip));
  }, [topFilteredRows, selectedTableCategories]);

  const totalAgg = useMemo(() => aggregateRows(finalRows), [finalRows]);

  const trendRows = useMemo(() => {
    return labels.map((dateLabel) => {
      const dayRows = applyCurrentFilters(historyRows.filter((row) => row.data === dateLabel.full));
      const agg = aggregateRows(dayRows);

      return {
        label: dateLabel.short,
        fullDate: dateLabel.full,
        hrs_operacionais: agg.hrs_operacionais,
        hrs_manutencao: agg.hrs_manutencao,
        hrs_indeter: agg.hrs_indeter,
        perc_disp: agg.perc_disp,
        perc_indeter: agg.perc_indeter,
      };
    });
  }, [
    labels,
    historyRows,
    categoryFilter,
    areaFilter,
    frenteFilter,
    searchTerm,
    selectedTableCategories,
  ]);

  const hierarchyRows = useMemo(() => {
    const areaMap = new Map();

    finalRows.forEach((row) => {
      const areaKey = row.desc_area || 'NÃO MAPEADA';
      const frenteKey = row.desc_grupo || 'SEM FRENTE';
      const equipKey = row.cod_equip || 'SEM CÓDIGO';

      if (!areaMap.has(areaKey)) {
        areaMap.set(areaKey, { desc_area: areaKey, rows: [], frentesMap: new Map() });
      }

      const area = areaMap.get(areaKey);
      area.rows.push(row);

      if (!area.frentesMap.has(frenteKey)) {
        area.frentesMap.set(frenteKey, { desc_grupo: frenteKey, rows: [], equipamentosMap: new Map() });
      }

      const frente = area.frentesMap.get(frenteKey);
      frente.rows.push(row);

      if (!frente.equipamentosMap.has(equipKey)) {
        frente.equipamentosMap.set(equipKey, { cod_equip: row.cod_equip, desc_equip: row.desc_equip, rows: [] });
      }

      frente.equipamentosMap.get(equipKey).rows.push(row);
    });

    return [...areaMap.values()].map((area) => {
      const areaAgg = aggregateRows(area.rows);

      const frentes = [...area.frentesMap.values()].map((frente) => {
        const frenteAgg = aggregateRows(frente.rows);

        const equipamentos = [...frente.equipamentosMap.values()].map((equip) => {
          const equipAgg = aggregateRows(equip.rows);
          return { ...equip, ...equipAgg, raw_data: equip.rows };
        }).sort((a, b) => a.perc_disp - b.perc_disp);

        return { ...frente, ...frenteAgg, equipamentos };
      }).sort((a, b) => a.perc_disp - b.perc_disp);

      return { ...area, ...areaAgg, frentes };
    }).sort((a, b) => a.perc_disp - b.perc_disp);
  }, [finalRows]);

  const clearAllFilters = () => {
    setCategoryFilter('Todos');
    setAreaFilter('Todos');
    setFrenteFilter('Todos');
    setSearchTerm('');
    setSelectedTableCategories([]);
    setExpandedAreas([]);
    setExpandedFrentes([]);
  };

  const handleToggleTableCategory = (categoryName) => {
    setSelectedTableCategories((prev) =>
      prev.includes(categoryName) ? prev.filter((c) => c !== categoryName) : [...prev, categoryName]
    );
    setExpandedAreas([]);
    setExpandedFrentes([]);
  };

  const toggleArea = (areaName) => {
    setExpandedAreas((prev) => prev.includes(areaName) ? prev.filter((i) => i !== areaName) : [...prev, areaName]);
  };

  const toggleFrente = (frenteKey) => {
    setExpandedFrentes((prev) => prev.includes(frenteKey) ? prev.filter((i) => i !== frenteKey) : [...prev, frenteKey]);
  };

  if (loading || error) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <div className="w-full max-w-sm md:max-w-md">
            <DateSelectorCOA value={selectedDate} onChange={setSelectedDate} maxDate={todayIso} availableDates={availableDates} />
          </div>
        </div>

        <div className="coa-card coa-card--resumo-home">
          <div className="coa-card__body flex items-center justify-center py-10">
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="coa-loader-dots"><span /><span /><span /></div>
                <span className="coa-loader-text">Calculando Disponibilidade Mecânica...</span>
              </div>
            ) : (
              <div className="coa-empty text-[var(--coa-danger)]">{error}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">

      <div className="flex justify-end">
        <div className="w-full max-w-sm md:max-w-md">
          <DateSelectorCOA value={selectedDate} onChange={setSelectedDate} maxDate={todayIso} availableDates={availableDates} />
        </div>
      </div>

      <div className="coa-panel p-3 md:p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <span className="coa-text-micro">Controle</span>
            <span className="text-sm font-black text-[var(--coa-text)]">Filtros Globais</span>
          </div>

          <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="coa-badge hover:scale-105 transition-transform">
            {isFilterOpen ? 'Ocultar' : 'Expandir'}
          </button>
        </div>

        {isFilterOpen && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SelectField label="Categoria de Equip." value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} />
              <SelectField label="Área Operacional" value={areaFilter} onChange={setAreaFilter} options={areaOptions} />
              <SelectField label="Frente de Trabalho" value={frenteFilter} onChange={setFrenteFilter} options={frenteOptions} />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <span className="coa-text-micro">Localizar Equipamento</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Busca por Código ou Descrição"
                  className="h-[42px] rounded-[14px] border px-4 text-sm font-bold bg-[rgba(255,255,255,0.02)] text-[var(--coa-text)] outline-none focus:border-[var(--coa-accent)] transition-colors"
                  style={{ borderColor: 'var(--coa-divider)' }}
                />
              </div>

              {(categoryFilter !== 'Todos' || areaFilter !== 'Todos' || frenteFilter !== 'Todos' || searchTerm !== '' || selectedTableCategories.length > 0) && (
                <button
                  onClick={clearAllFilters}
                  className="h-[42px] w-[42px] rounded-[14px] border flex items-center justify-center text-sm font-black transition-colors"
                  style={{ borderColor: 'var(--coa-divider)', color: 'var(--coa-danger)', background: 'rgba(239,68,68,0.08)' }}
                  title="Limpar filtros"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <CategoryTableDispo
        rows={categoryTableRows}
        selectedCategories={selectedTableCategories}
        onToggle={handleToggleTableCategory}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Equipamentos" value={formatInt(totalAgg.qnt_equip)} />
        <MetricCard label="Horas Operacionais" value={formatHours(totalAgg.hrs_operacionais)} />
        <MetricCard label="Manutenção" value={formatHours(totalAgg.hrs_manutencao)} color="var(--coa-danger)" />
        <MetricCard
          label="% Disponibilidade"
          value={formatPercent(totalAgg.perc_disp)}
          color={getDispoColor(totalAgg.perc_disp)}
        />
      </div>

      <div className="flex flex-col gap-4 pt-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[1.35rem] md:text-[1.45rem] font-black uppercase tracking-tight leading-none text-[var(--coa-text)]">
            EQUIPAMENTOS
          </h2>
          <span className="text-sm font-black text-[var(--coa-text-soft)]">
            Clique para expandir
          </span>
        </div>

        {hierarchyRows.length === 0 ? (
          <div className="coa-panel p-5 text-sm font-bold text-[var(--coa-text-muted)] text-center">
            Nenhum equipamento produtivo encontrado neste escopo.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {hierarchyRows.map((area) => (
              <div key={area.desc_area} className="bg-[rgba(255,255,255,0.02)] overflow-hidden rounded-[18px]">
                <button
                  onClick={() => toggleArea(area.desc_area)}
                  className="w-full text-left px-4 py-3 transition-all"
                  style={{ background: getDispoTint(area.perc_disp, 0.13) }}
                >
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                    <div className="min-w-0 flex flex-col">
                      <span className="text-[14px] font-black text-[var(--coa-text)] truncate">{area.desc_area}</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
                        {area.qnt_equip} máquinas
                      </span>
                    </div>

                    <span className="text-[11px] font-bold text-[var(--coa-danger)] whitespace-nowrap hidden md:block">
                      {formatHours(area.hrs_manutencao)} Manut.
                    </span>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[13px] font-black whitespace-nowrap" style={{ color: getDispoColor(area.perc_disp) }}>
                        {formatPercent(area.perc_disp)}
                      </span>
                      <span className="text-[12px] font-black text-[var(--coa-text-muted)]">
                        {expandedAreas.includes(area.desc_area) ? '−' : '+'}
                      </span>
                    </div>
                  </div>
                </button>

                <ExpandBlock expanded={expandedAreas.includes(area.desc_area)}>
                  <div className="pl-5 pr-2 py-2 flex flex-col gap-1.5 bg-[rgba(255,255,255,0.01)]">
                    {area.frentes.map((frente) => {
                      const fKey = `${area.desc_area}_${frente.desc_grupo}`;

                      return (
                        <div key={fKey} className="flex flex-col">
                          <button
                            onClick={() => toggleFrente(fKey)}
                            className="w-full text-left px-3 py-2.5 transition-all"
                          >
                            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 pb-2" style={{ borderBottom: `1px solid ${getDispoColor(frente.perc_disp)}50` }}>
                              <div className="min-w-0 flex flex-col">
                                <span className="text-[12px] font-black truncate" style={{ color: getDispoColor(frente.perc_disp) }}>
                                  {frente.desc_grupo}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
                                  {frente.qnt_equip} máquinas
                                </span>
                              </div>

                              <span className="text-[11px] font-bold text-[var(--coa-danger)] whitespace-nowrap">
                                {formatHours(frente.hrs_manutencao)}
                              </span>

                              <span className="text-[12px] font-black whitespace-nowrap" style={{ color: getDispoColor(frente.perc_disp) }}>
                                {formatPercent(frente.perc_disp)}
                              </span>

                              <span className="text-[11px] font-black text-[var(--coa-text-muted)]">
                                {expandedFrentes.includes(fKey) ? '−' : '+'}
                              </span>
                            </div>
                          </button>

                          <ExpandBlock expanded={expandedFrentes.includes(fKey)}>
                            <div className="pl-6 pr-1 pt-2 flex flex-col gap-1.5">
                              {frente.equipamentos.map((equip) => (
                                <button
                                  key={equip.cod_equip}
                                  onClick={() => setSelectedModalItem(equip)}
                                  className="w-full text-left px-3 py-2.5 transition-all rounded-md hover:bg-[rgba(255,255,255,0.05)] active:scale-[0.98]"
                                  style={{ background: getDispoTint(equip.perc_disp, 0.05) }}
                                >
                                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                                    <div className="min-w-0 flex flex-col">
                                      <span className="text-[12px] font-black text-[var(--coa-text)] truncate">
                                        {equip.cod_equip}
                                      </span>
                                      <span className="text-[10px] font-medium text-[var(--coa-text-muted)] truncate">
                                        {equip.desc_equip || 'SEM DESCRIÇÃO'}
                                      </span>
                                    </div>

                                    <span className="text-[11px] font-bold text-[var(--coa-danger)] whitespace-nowrap">
                                      {formatHours(equip.hrs_manutencao)}
                                    </span>

                                    <span className="text-[12px] font-black whitespace-nowrap" style={{ color: getDispoColor(equip.perc_disp) }}>
                                      {formatPercent(equip.perc_disp)}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </ExpandBlock>
                        </div>
                      );
                    })}
                  </div>
                </ExpandBlock>
              </div>
            ))}
          </div>
        )}
      </div>

      <ScreenAnalysisPanel
        rows={finalRows}
        totalAgg={totalAgg}
        trendRows={trendRows}
      />

      {selectedModalItem && (
        <DispoDetailDiarioModal
          item={selectedModalItem}
          selectedDate={selectedDate}
          onClose={() => setSelectedModalItem(null)}
        />
      )}
    </div>
  );
};

export default DispoDetailDiario;