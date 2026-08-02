// ================= DOCUMENTATION ------------------------------------------
// Script: IndeterDetailSemanal
// Purpose: Visão consolidada semanal do Tempo Indeterminado com gráfico de barras.
// Relationships: vw_c_indeterminado
// ==========================================================================

import React, { useEffect, useMemo, useState } from 'react';
import DateSelectorCOA from '../../../components/COACenter/DateSelectorCOA';
import { supabase } from '../../../lib/supabaseClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

/* ==========================================================================
   CONFIG
   ========================================================================== */

const INDETER_META = 10; // <= 10% Verde, > 10% Vermelho
const PAGE_SIZE = 1000;

const DEFAULT_CATEGORIES = ['AGRÍCOLA', 'APOIO'];
const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA', 'EMPACOTAMENTO'];

const MAIN_COLUMNS = [
  'data',
  'cod_equip',
  'desc_equip',
  'desc_area',
  'desc_grupo',
  'categoria',
  'hrs_indeter_seg',
  'hrs_operacionais_seg'
].join(',');

/* ==========================================================================
   HELPERS
   ========================================================================== */

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

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const brDateToSortValue = (brDate) => {
  if (!brDate || typeof brDate !== 'string' || !brDate.includes('/')) return 0;
  const [dd, mm, yyyy] = brDate.split('/');
  return Number(`${yyyy}${mm}${dd}`);
};

const getDayName = (brDate) => {
  if (!brDate || typeof brDate !== 'string' || !brDate.includes('/')) return 'Dia';
  const [dd, mm, yyyy] = brDate.split('/');
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[date.getUTCDay()] || 'Dia';
};

const getDayShortName = (brDate) => {
  if (!brDate || typeof brDate !== 'string' || !brDate.includes('/')) return 'DIA';
  const [dd, mm, yyyy] = brDate.split('/');
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  const days = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
  return days[date.getUTCDay()] || 'DIA';
};

const getIsoWeekInfo = (isoDate) => {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const target = new Date(date.valueOf());
  const dayNr = (date.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const isoYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const week = 1 + Math.round((target - firstThursday) / (7 * 24 * 3600 * 1000));
  return { semana_iso: week, ano: isoYear };
};

const getIsoWeekDatesFromIso = (isoDate) => {
  const base = new Date(`${isoDate}T12:00:00Z`);
  const dayNr = (base.getUTCDay() + 6) % 7;
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() - dayNr);

  const dates = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);

    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    const full = `${dd}/${mm}/${yyyy}`;

    dates.push({
      full,
      label: `${dd}/${mm}`,
      dia_semana: getDayName(full),
      dia_curto: getDayShortName(full),
    });
  }
  return dates;
};

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatInt = (value) => `${Math.round(Number(value || 0))}`;
const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;

const formatHHMM = (valueInHours) => {
  const totalMinutes = Math.max(0, Math.round(Number(valueInHours || 0) * 60));
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const getIndeterColor = (value) => {
  return Number(value || 0) <= INDETER_META ? 'var(--coa-success)' : 'var(--coa-danger)';
};

const getIndeterTint = (value, alpha = 0.10) => {
  return Number(value || 0) <= INDETER_META 
    ? `rgba(61,220,151,${alpha})` 
    : `rgba(239,68,68,${alpha})`;
};

/* ==========================================================================
   NORMALIZAÇÃO E AGRUPAMENTOS
   ========================================================================== */

const normalizeRow = (row = {}) => {
  const hrsOperacionais = toNumber(row.hrs_operacionais_seg) / 3600;
  const hrsIndeter = toNumber(row.hrs_indeter_seg) / 3600;

  return {
    ...row,
    categoria: row.categoria || 'NÃO MAPEADA',
    desc_area: row.desc_area || 'NÃO MAPEADA',
    desc_grupo: row.desc_grupo || 'SEM FRENTE',
    cod_equip: row.cod_equip || 'SEM CÓDIGO',
    desc_equip: row.desc_equip || 'SEM DESCRIÇÃO',
    hrs_operacionais: hrsOperacionais,
    hrs_indeter: hrsIndeter,
  };
};

const aggregateRows = (rows = []) => {
  const total = rows.reduce(
    (acc, row) => {
      acc.hrs_operacionais += row.hrs_operacionais;
      acc.hrs_indeter += row.hrs_indeter;
      return acc;
    },
    { hrs_operacionais: 0, hrs_indeter: 0 }
  );

  const uniqueEquips = new Set(rows.map((r) => r.cod_equip).filter(Boolean)).size;
  const perc_indeter = total.hrs_operacionais > 0 ? (total.hrs_indeter / total.hrs_operacionais) * 100 : 0;

  return {
    ...total,
    perc_indeter,
    qnt_equip: uniqueEquips,
  };
};

const groupAndAggregate = (rows = [], keyGetter) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyGetter(row) || 'NÃO MAPEADO';
    if (!map.has(key)) map.set(key, { key, rows: [] });
    map.get(key).rows.push(row);
  });
  return [...map.values()].map((item) => ({
    ...item,
    ...aggregateRows(item.rows),
  }));
};

/* ==========================================================================
   UI BASE
   ========================================================================== */

const WeeklyBadge = ({ children, color }) => (
  <span
    className="coa-badge"
    style={{
      color: color || 'var(--coa-text-soft)',
      borderColor: color || 'var(--coa-divider)',
      background: color ? `${color}14` : 'rgba(255,255,255,0.02)',
    }}
  >
    {children}
  </span>
);

const SectionTitle = ({ eyebrow, title, subtitle }) => (
  <div className="flex flex-col gap-1">
    {eyebrow && <span className="coa-text-micro">{eyebrow}</span>}
    <h2 className="text-[1.15rem] md:text-[1.3rem] font-black uppercase tracking-tight leading-none text-[var(--coa-text)]">
      {title}
    </h2>
    {subtitle && (
      <span className="text-sm font-bold text-[var(--coa-text-soft)]">
        {subtitle}
      </span>
    )}
  </div>
);

const MetricCard = ({ label, value, color = 'var(--coa-text)', hint }) => (
  <div
    className="rounded-[14px] border px-3 py-3 bg-[rgba(255,255,255,0.02)]"
    style={{ borderColor: 'var(--coa-divider)' }}
  >
    <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)] mb-1">
      {label}
    </span>
    <span className="block text-[1.1rem] md:text-[1.2rem] font-black tracking-tight leading-none" style={{ color }}>
      {value}
    </span>
    {hint && (
      <span className="block mt-1 text-[11px] font-bold text-[var(--coa-text-soft)]">
        {hint}
      </span>
    )}
  </div>
);

const ProgressBarIndeterminado = ({ perc, hrs }) => {
  const safePerc = Number(perc) || 0;
  const barColor = getIndeterColor(safePerc);

  return (
    <div
      className="rounded-[14px] border px-4 py-4 bg-[rgba(255,255,255,0.02)] flex flex-col gap-3 shadow-sm transition-all"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
          Indeterminado
        </span>
        <div className="flex items-center gap-2 text-[1rem] md:text-[1.1rem] font-black tracking-tight">
          
          <span className="transition-colors" style={{ color: barColor }}>
            {formatPercent(safePerc)}
          </span>
        </div>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden flex bg-[rgba(255,255,255,0.05)] shadow-inner">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(safePerc, 100)}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
};

const CategoryFilter = ({ categoryOptions = [], selectedCategories = [], onToggle, isOpen, onToggleOpen }) => (
  <div className="coa-panel p-3 md:p-4 flex flex-col gap-3">
    <button
      type="button"
      onClick={onToggleOpen}
      className="w-full flex items-center justify-between gap-3 text-left"
    >
      <div className="flex flex-col gap-1">
        <span className="coa-text-micro">Filtro</span>
        <span className="text-sm font-black text-[var(--coa-text)]">Categorias</span>
      </div>
      <span className="coa-badge">
        {isOpen ? 'Ocultar' : `${selectedCategories.length} ativas`}
      </span>
    </button>

    {isOpen && (
      <div className="flex flex-col gap-2">
        {categoryOptions.map((category) => {
          const checked = selectedCategories.includes(category);
          return (
            <label
              key={category}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-[14px] border text-sm font-bold cursor-pointer transition-colors"
              style={{
                borderColor: checked ? 'rgba(61,220,151,0.28)' : 'var(--coa-border)',
                background: checked ? 'rgba(61,220,151,0.10)' : 'rgba(255,255,255,0.02)',
                color: checked ? 'var(--coa-text)' : 'var(--coa-text-soft)',
              }}
            >
              <input type="checkbox" className="hidden" checked={checked} onChange={() => onToggle(category)} />
              <span>{category}</span>
            </label>
          );
        })}
      </div>
    )}
  </div>
);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  if (row.perc_indeter == null) return null;

  return (
    <div className="coa-panel p-3 border shadow-lg" style={{ borderColor: 'var(--coa-divider)' }}>
      <p className="coa-text-micro mb-2">{row.data || row.label}</p>
      <p className="text-sm font-black" style={{ color: getIndeterColor(row.perc_indeter) }}>
        % Indeterminado: {formatPercent(row.perc_indeter)}
      </p>
      <p className="text-xs font-bold text-[var(--coa-text-soft)] mt-1">
        Operacional: {formatHHMM(row.hrs_operacionais)}
      </p>
      <p className="text-xs font-bold text-[var(--coa-text-soft)] mt-1">
        Indeterminado: {formatHHMM(row.hrs_indeter)}
      </p>
    </div>
  );
};

const CustomLabel = (props) => {
  const { x, y, width, value } = props;
  if (x === undefined || y === undefined || value === undefined || value === null) return null;
  const color = getIndeterColor(value);
  const centerX = x + width / 2;

  return (
    <text x={centerX} y={y} dy={-8} fill={color} fontSize={12} fontWeight="900" textAnchor="middle">
      {`${Number(value || 0).toFixed(1)}%`}
    </text>
  );
};

/* ==========================================================================
   TABELAS E GRÁFICOS
   ========================================================================== */

const AreaTable = ({ rows = [], onOpenArea }) => (
  <div className="coa-panel p-0 overflow-hidden">
    <div
      className="grid grid-cols-[minmax(0,1fr)_64px_76px] md:grid-cols-[minmax(0,1.35fr)_72px_98px_98px_82px] gap-2 px-3 md:px-4 py-3 border-b"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <span className="coa-text-micro">Área</span>
      <span className="coa-text-micro text-right">Equip.</span>
      <span className="coa-text-micro text-right hidden md:block">Operac.</span>
      <span className="coa-text-micro text-right hidden md:block">Indeter.</span>
      <span className="coa-text-micro text-right">% Ind.</span>
    </div>

    <div>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm font-bold text-[var(--coa-text-muted)]">
          Nenhuma área encontrada para os filtros selecionados.
        </div>
      ) : (
        rows.map((row) => (
          <button
            key={row.desc_area}
            type="button"
            onClick={() => onOpenArea(row.desc_area)}
            className="w-full text-left grid grid-cols-[minmax(0,1fr)_64px_76px] md:grid-cols-[minmax(0,1.35fr)_72px_98px_98px_82px] gap-2 px-3 md:px-4 py-3 border-b transition-all hover:bg-[rgba(255,255,255,0.035)]"
            style={{
              borderColor: 'var(--coa-divider)',
              background: getIndeterTint(row.perc_indeter, 0.055),
            }}
          >
            <div className="min-w-0 flex flex-col">
              <span className="text-[12px] md:text-[13px] font-black text-[var(--coa-text)] truncate">
                {row.desc_area}
              </span>
              <span className="text-[10px] font-bold text-[var(--coa-text-muted)] md:hidden">
                Indeter. {formatHHMM(row.hrs_indeter)}
              </span>
            </div>

            <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)] whitespace-nowrap">
              {formatInt(row.qnt_equip)}
            </span>

            <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)] whitespace-nowrap hidden md:block">
              {formatHHMM(row.hrs_operacionais)}
            </span>

            <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)] whitespace-nowrap hidden md:block">
              {formatHHMM(row.hrs_indeter)}
            </span>

            <span
              className="text-[12px] font-black text-right whitespace-nowrap"
              style={{ color: getIndeterColor(row.perc_indeter) }}
            >
              {formatPercent(row.perc_indeter)}
            </span>
          </button>
        ))
      )}
    </div>
  </div>
);

const DayTable = ({ rows = [] }) => (
  <div className="coa-panel p-0 overflow-hidden">
    <div
      className="grid grid-cols-[72px_68px_1fr_76px] md:grid-cols-[92px_80px_1fr_96px_82px] gap-2 px-3 md:px-4 py-3 border-b"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <span className="coa-text-micro">Dia</span>
      <span className="coa-text-micro">Data</span>
      <span className="coa-text-micro text-right hidden md:block">Operac.</span>
      <span className="coa-text-micro text-right">Indeter.</span>
      <span className="coa-text-micro text-right">% Ind.</span>
    </div>

    <div>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm font-bold text-[var(--coa-text-muted)]">
          Nenhum resultado diário encontrado nesta semana.
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={row.data}
            className="grid grid-cols-[72px_68px_1fr_76px] md:grid-cols-[92px_80px_1fr_96px_82px] gap-2 px-3 md:px-4 py-3 border-b"
            style={{
              borderColor: 'var(--coa-divider)',
              background: getIndeterTint(row.perc_indeter, 0.045),
            }}
          >
            <span className="text-[12px] font-black text-[var(--coa-text)] truncate">
              {row.dia_semana}
            </span>

            <span className="text-[12px] font-black text-[var(--coa-text-soft)] whitespace-nowrap">
              {String(row.data || '').slice(0, 5)}
            </span>

            <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)] whitespace-nowrap hidden md:block">
              {formatHHMM(row.hrs_operacionais)}
            </span>

            <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)] whitespace-nowrap">
              {formatHHMM(row.hrs_indeter)}
            </span>

            <span
              className="text-[12px] font-black text-right whitespace-nowrap"
              style={{ color: getIndeterColor(row.perc_indeter) }}
            >
              {formatPercent(row.perc_indeter)}
            </span>
          </div>
        ))
      )}
    </div>
  </div>
);

const WeeklyTrend = ({ rows = [] }) => (
  <div className="coa-panel p-4 flex flex-col gap-4 min-w-0">
    <SectionTitle title="Evolução Diária" subtitle="Comportamento do tempo indeterminado na semana" />

    <div className="h-[280px] min-h-[280px] w-full min-w-0 overflow-visible mt-2">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
        <BarChart
          data={rows}
          margin={{ top: 24, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--coa-border)" vertical={false} />
          
          <XAxis
            dataKey="dia_curto"
            stroke="var(--coa-text-muted)"
            fontSize={12}
            fontWeight={900}
            tickLine={false}
            axisLine={false}
            dy={10}
            padding={{ left: 20, right: 20 }}
          />

          <YAxis hide domain={[0, 'dataMax + 5']} />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />

          <Bar
            dataKey="perc_indeter"
            radius={[4, 4, 0, 0]}
            maxBarSize={55}
            label={<CustomLabel />}
            isAnimationActive={false}
          >
            {rows.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getIndeterColor(entry.perc_indeter)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ==========================================================================
   MODAL AREA
   ========================================================================== */

const AreaEquipModal = ({
  areaName,
  weekRows,
  weekLabel,
  onClose,
}) => {
  const areaData = useMemo(() => {
    const equipamentos = groupAndAggregate(weekRows, (row) => row.cod_equip)
      .map(item => ({
        cod_equip: item.key,
        desc_equip: item.rows[0]?.desc_equip || 'SEM DESCRIÇÃO',
        desc_grupo: item.rows[0]?.desc_grupo || 'SEM FRENTE',
        ...item
      }))
      .sort((a, b) => b.perc_indeter - a.perc_indeter);

    const agg = aggregateRows(weekRows);

    return { desc_area: areaName, equipamentos, ...agg };
  }, [areaName, weekRows]);

  if (!areaData) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-2 md:p-4 animate-in fade-in duration-200">
      <div className="relative coa-card w-full max-w-5xl h-[92vh] md:h-[86vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 md:top-4 md:right-4 w-9 h-9 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] border text-[var(--coa-text-soft)] hover:text-white hover:bg-[var(--coa-danger)] transition-all z-20"
          style={{ borderColor: 'var(--coa-divider)' }}
        >
          ✕
        </button>

        <div className="h-full flex flex-col min-h-0">
          <div className="coa-card__header">
            <div className="flex flex-col gap-2 pr-10">
              <span className="coa-text-micro">Equipamentos da Área na Semana</span>

              <div className="flex flex-col gap-1">
                <h2 className="coa-text-title !mb-0 text-[1.4rem]">
                  {areaData.desc_area}
                </h2>
                <span className="text-sm font-bold text-[var(--coa-text-muted)]">
                  {weekLabel}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <WeeklyBadge color={getIndeterColor(areaData.perc_indeter)}>
                  {formatPercent(areaData.perc_indeter)} Indeterminado
                </WeeklyBadge>

                <WeeklyBadge>
                  {formatInt(areaData.qnt_equip)} equipamentos
                </WeeklyBadge>

                <WeeklyBadge>
                  {formatHHMM(areaData.hrs_indeter)} hrs Indeter.
                </WeeklyBadge>
              </div>
            </div>
          </div>

          <div className="coa-card__body flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
            <div className="coa-panel p-0 overflow-hidden">
              <div
                className="grid grid-cols-[72px_minmax(0,1fr)_70px] md:grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)_96px_82px_72px] gap-2 px-3 md:px-4 py-3 border-b"
                style={{ borderColor: 'var(--coa-divider)' }}
              >
                <span className="coa-text-micro">Equip.</span>
                <span className="coa-text-micro">Descrição</span>
                <span className="coa-text-micro hidden md:block">Frente</span>
                <span className="coa-text-micro text-right hidden md:block">Operac.</span>
                <span className="coa-text-micro text-right hidden md:block">Indeter.</span>
                <span className="coa-text-micro text-right">% Ind.</span>
              </div>

              <div>
                {areaData.equipamentos.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm font-bold text-[var(--coa-text-muted)]">
                    Nenhum equipamento encontrado.
                  </div>
                ) : (
                  areaData.equipamentos.map((row) => (
                    <div
                      key={row.cod_equip}
                      className="grid grid-cols-[72px_minmax(0,1fr)_70px] md:grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)_96px_82px_72px] gap-2 px-3 md:px-4 py-3 border-b"
                      style={{
                        borderColor: 'var(--coa-divider)',
                        background: getIndeterTint(row.perc_indeter, 0.045),
                      }}
                    >
                      <span className="text-[12px] font-black text-[var(--coa-text)] truncate">
                        {row.cod_equip}
                      </span>

                      <div className="min-w-0 flex flex-col">
                        <span className="text-[12px] font-bold text-[var(--coa-text-soft)] truncate">
                          {row.desc_equip}
                        </span>

                        <span className="text-[10px] font-bold text-[var(--coa-text-muted)] md:hidden truncate">
                          {row.desc_grupo} • Ind. {formatHHMM(row.hrs_indeter)}
                        </span>
                      </div>

                      <span className="text-[12px] font-bold text-[var(--coa-text-soft)] truncate hidden md:block">
                        {row.desc_grupo}
                      </span>

                      <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)] whitespace-nowrap hidden md:block">
                        {formatHHMM(row.hrs_operacionais)}
                      </span>

                      <span
                        className="text-[12px] font-black text-right whitespace-nowrap hidden md:block"
                        style={{ color: getIndeterColor(row.perc_indeter) }}
                      >
                        {formatHHMM(row.hrs_indeter)}
                      </span>

                      <span
                        className="text-[12px] font-black text-right whitespace-nowrap"
                        style={{ color: getIndeterColor(row.perc_indeter) }}
                      >
                        {formatPercent(row.perc_indeter)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   MAIN COMPONENT
   ========================================================================== */

const IndeterDetailSemanal = ({
  selectedDate,
  setSelectedDate,
}) => {
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const [weeklyDate, setWeeklyDate] = useState(() => {
    return selectedDate || toIsoDate(new Date());
  });

  const [rows, setRows] = useState([]);
  const [selectedAreaName, setSelectedAreaName] = useState(null);

  const [selectedCategories, setSelectedCategories] = useState(DEFAULT_CATEGORIES);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleWeeklyDateChange = (newDate) => {
    setWeeklyDate(newDate);
    setSelectedDate?.(newDate);
  };

  const weekInfo = useMemo(() => getIsoWeekInfo(weeklyDate), [weeklyDate]);
  const weekDates = useMemo(() => getIsoWeekDatesFromIso(weeklyDate), [weeklyDate]);
  const weekDatesBr = useMemo(() => weekDates.map(d => d.full), [weekDates]);

  const weekLabel = useMemo(
    () => `Semana ${weekInfo.semana_iso}/${weekInfo.ano}`,
    [weekInfo]
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await fetchAllPages(() => 
          supabase
            .from('vw_c_indeterminado')
            .select(MAIN_COLUMNS)
            .in('data', weekDatesBr)
        );

        if (!mounted) return;

        setRows((data || []).map(normalizeRow));
        setSelectedAreaName(null);

      } catch (err) {
        console.error('[COA] Erro ao carregar detalhe semanal de indeterminado:', err);
        if (mounted) setError('Falha ao carregar os dados de tempo indeterminado.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [weekDatesBr]);

  const categoryOptions = useMemo(() => {
    const values = [...new Set(rows.map((row) => row.categoria).filter(Boolean))];
    return values.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'pt-BR');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [rows]);

  const filteredBaseRows = useMemo(() => {
    if (selectedCategories.length === 0) return [];
    return rows.filter((row) => selectedCategories.includes(row.categoria));
  }, [rows, selectedCategories]);

  const areaRowsFiltered = useMemo(() => {
    return groupAndAggregate(filteredBaseRows, (row) => row.desc_area)
      .map(item => ({ ...item, desc_area: item.key }))
      .sort((a, b) => b.perc_indeter - a.perc_indeter);
  }, [filteredBaseRows]);

  const weeklySummary = useMemo(() => aggregateRows(filteredBaseRows), [filteredBaseRows]);

  const dayRowsComplete = useMemo(() => {
    const dayGrouped = groupAndAggregate(filteredBaseRows, (row) => row.data);
    const rowsMap = new Map();
    dayGrouped.forEach((row) => rowsMap.set(row.key, row));

    return weekDates.map((dateInfo) => {
      const found = rowsMap.get(dateInfo.full);
      if (found) {
        return { ...found, data: dateInfo.full, label: dateInfo.label, dia_semana: dateInfo.dia_semana, dia_curto: dateInfo.dia_curto };
      }
      return {
        data: dateInfo.full,
        label: dateInfo.label,
        dia_semana: dateInfo.dia_semana,
        dia_curto: dateInfo.dia_curto,
        qnt_equip: null,
        hrs_operacionais: null,
        hrs_indeter: null,
        perc_indeter: null,
      };
    });
  }, [filteredBaseRows, weekDates]);

  const modalAreaRows = useMemo(() => {
    if (!selectedAreaName) return [];
    return filteredBaseRows.filter(r => r.desc_area === selectedAreaName);
  }, [filteredBaseRows, selectedAreaName]);

  const handleCategoryToggle = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    );
    setSelectedAreaName(null);
  };

  if (loading || error) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <div className="w-full max-w-sm md:max-w-md">
            <DateSelectorCOA
              value={weeklyDate}
              onChange={handleWeeklyDateChange}
              maxDate={todayIso}
              availableDates={[]}
            />
          </div>
        </div>

        <div className="coa-card coa-card--resumo-home">
          <div className="coa-card__body flex items-center justify-center py-10">
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="coa-loader-dots">
                  <span /><span /><span />
                </div>
                <span className="coa-loader-text">Calculando visão semanal...</span>
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
          <DateSelectorCOA
            value={weeklyDate}
            onChange={handleWeeklyDateChange}
            maxDate={todayIso}
            availableDates={[]}
          />
        </div>
      </div>

      <CategoryFilter
        categoryOptions={categoryOptions}
        selectedCategories={selectedCategories}
        onToggle={handleCategoryToggle}
        isOpen={isCategoryOpen}
        onToggleOpen={() => setIsCategoryOpen((prev) => !prev)}
      />

      <div className="flex flex-col gap-4">
        <SectionTitle title="Resumo Geral da Semana" subtitle={weekLabel} />
        
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Total Hrs. Operacionais" value={formatHours(weeklySummary.hrs_operacionais)} />
          <MetricCard label="Total Hrs. Indeterminadas" value={formatHours(weeklySummary.hrs_indeter)} />
        </div>
        <ProgressBarIndeterminado perc={weeklySummary.perc_indeter} hrs={weeklySummary.hrs_indeter} />
      </div>

      <WeeklyTrend rows={dayRowsComplete} />

      <div className="flex flex-col gap-3">
        <SectionTitle
          title="Indeterminado por Área"
          subtitle="Clique em uma área para visualizar os equipamentos da semana"
        />
        <AreaTable rows={areaRowsFiltered} onOpenArea={setSelectedAreaName} />
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle title="Resumo Diário da Semana" />
        <DayTable rows={dayRowsComplete.filter(r => r.hrs_operacionais !== null)} />
      </div>

      {selectedAreaName && (
        <AreaEquipModal
          areaName={selectedAreaName}
          weekRows={modalAreaRows}
          weekLabel={weekLabel}
          onClose={() => setSelectedAreaName(null)}
        />
      )}
    </div>
  );
};

export default IndeterDetailSemanal;