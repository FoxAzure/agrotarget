import React, { useEffect, useMemo, useState } from 'react';
import DateSelectorCOA from '../../../components/COACenter/DateSelectorCOA';
import { supabase } from '../../../lib/supabaseClient';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

/* ==========================================================================
   CONFIG
   ========================================================================== */

const DISPO_META_VERDE = 90;
const DISPO_META_AMARELA = 80;
const INDETER_META_ALERTA = 10;
const PAGE_SIZE = 1000;

const DEFAULT_CATEGORIES = ['AGRÍCOLA', 'APOIO'];
const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA', 'EMPACOTAMENTO'];

const AREA_COLUMNS = [
  'ano',
  'semana_iso',
  'categoria',
  'desc_area',
  'qnt_equip',
  'hrs_operacionais_seg',
  'manutencao_seg',
  'indeter_seg',
  'perc_disp',
  'perc_indeter',
].join(',');

const DIA_COLUMNS = [
  'ano',
  'semana_iso',
  'categoria',
  'data',
  'qnt_equip',
  'hrs_operacionais_seg',
  'manutencao_seg',
  'indeter_seg',
  'perc_disp',
].join(',');

const EQUIP_AREA_COLUMNS = [
  'ano',
  'semana_iso',
  'categoria',
  'desc_area',
  'desc_grupo',
  'cod_equip',
  'desc_equip',
  'hrs_operacionais_seg',
  'manutencao_seg',
  'indeter_seg',
  'perc_disp',
  'perc_indeter',
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

const clampPercent = (value) => Math.max(0, Math.min(100, Number(value || 0)));

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

  return {
    semana_iso: week,
    ano: isoYear,
  };
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

/* ==========================================================================
   NORMALIZAÇÃO
   ========================================================================== */

const normalizeAreaRow = (row = {}) => {
  const hrsOperacionais = toNumber(row.hrs_operacionais_seg) / 3600;
  const hrsManutencao = toNumber(row.manutencao_seg) / 3600;
  const hrsIndeter = toNumber(row.indeter_seg) / 3600;

  return {
    ...row,
    categoria: row.categoria || 'NÃO MAPEADA',
    desc_area: row.desc_area || 'NÃO MAPEADA',
    qnt_equip: toNumber(row.qnt_equip),
    hrs_operacionais: hrsOperacionais,
    hrs_manutencao: hrsManutencao,
    hrs_disponivel: Math.max(0, hrsOperacionais - hrsManutencao),
    hrs_indeter: hrsIndeter,
    perc_disp: toNumber(row.perc_disp),
    perc_indeter: toNumber(row.perc_indeter),
  };
};

const normalizeDiaRow = (row = {}) => {
  const hrsOperacionais = toNumber(row.hrs_operacionais_seg) / 3600;
  const hrsManutencao = toNumber(row.manutencao_seg) / 3600;
  const hrsIndeter = toNumber(row.indeter_seg) / 3600;

  return {
    ...row,
    categoria: row.categoria || 'NÃO MAPEADA',
    data: row.data || '',
    dia_semana: getDayName(row.data),
    dia_curto: getDayShortName(row.data),
    qnt_equip: toNumber(row.qnt_equip),
    hrs_operacionais: hrsOperacionais,
    hrs_manutencao: hrsManutencao,
    hrs_disponivel: Math.max(0, hrsOperacionais - hrsManutencao),
    hrs_indeter: hrsIndeter,
    perc_disp: toNumber(row.perc_disp),
  };
};

const normalizeEquipRow = (row = {}) => {
  const hrsOperacionais = toNumber(row.hrs_operacionais_seg) / 3600;
  const hrsManutencao = toNumber(row.manutencao_seg) / 3600;
  const hrsIndeter = toNumber(row.indeter_seg) / 3600;

  return {
    ...row,
    categoria: row.categoria || 'NÃO MAPEADA',
    desc_area: row.desc_area || 'NÃO MAPEADA',
    desc_grupo: row.desc_grupo || 'SEM FRENTE',
    cod_equip: row.cod_equip || 'SEM CÓDIGO',
    desc_equip: row.desc_equip || 'SEM DESCRIÇÃO',
    hrs_operacionais: hrsOperacionais,
    hrs_manutencao: hrsManutencao,
    hrs_disponivel: Math.max(0, hrsOperacionais - hrsManutencao),
    hrs_indeter: hrsIndeter,
    perc_disp: toNumber(row.perc_disp),
    perc_indeter: toNumber(row.perc_indeter),
  };
};

/* ==========================================================================
   AGRUPADORES
   ========================================================================== */

const aggregateAreaRows = (rows = []) => {
  const map = new Map();

  rows.forEach((row) => {
    const key = row.desc_area || 'NÃO MAPEADA';

    if (!map.has(key)) {
      map.set(key, {
        desc_area: key,
        rows: [],
      });
    }

    map.get(key).rows.push(row);
  });

  return [...map.values()]
    .map((item) => {
      const total = item.rows.reduce(
        (acc, row) => {
          acc.qnt_equip += toNumber(row.qnt_equip);
          acc.hrs_operacionais += toNumber(row.hrs_operacionais);
          acc.hrs_manutencao += toNumber(row.hrs_manutencao);
          acc.hrs_indeter += toNumber(row.hrs_indeter);
          return acc;
        },
        {
          qnt_equip: 0,
          hrs_operacionais: 0,
          hrs_manutencao: 0,
          hrs_indeter: 0,
        }
      );

      const percDisp =
        total.hrs_operacionais > 0
          ? Math.max(0, (1 - total.hrs_manutencao / total.hrs_operacionais)) * 100
          : 0;

      const percIndeter =
        total.hrs_operacionais > 0
          ? (total.hrs_indeter / total.hrs_operacionais) * 100
          : 0;

      return {
        desc_area: item.desc_area,
        ...total,
        hrs_disponivel: Math.max(0, total.hrs_operacionais - total.hrs_manutencao),
        perc_disp: percDisp,
        perc_indeter: percIndeter,
      };
    })
    .sort((a, b) => a.perc_disp - b.perc_disp);
};

const aggregateDayRowsByDate = (rows = []) => {
  const map = new Map();

  rows.forEach((row) => {
    const key = row.data || '';

    if (!key) return;

    if (!map.has(key)) {
      map.set(key, {
        data: key,
        rows: [],
      });
    }

    map.get(key).rows.push(row);
  });

  return [...map.values()]
    .map((item) => {
      const total = item.rows.reduce(
        (acc, row) => {
          acc.qnt_equip += toNumber(row.qnt_equip);
          acc.hrs_operacionais += toNumber(row.hrs_operacionais);
          acc.hrs_manutencao += toNumber(row.hrs_manutencao);
          acc.hrs_indeter += toNumber(row.hrs_indeter);
          return acc;
        },
        {
          qnt_equip: 0,
          hrs_operacionais: 0,
          hrs_manutencao: 0,
          hrs_indeter: 0,
        }
      );

      const hasData = total.hrs_operacionais > 0;

      const percDisp = hasData
        ? Math.max(0, (1 - total.hrs_manutencao / total.hrs_operacionais)) * 100
        : null;

      return {
        data: item.data,
        dia_semana: getDayName(item.data),
        dia_curto: getDayShortName(item.data),
        ...total,
        hrs_disponivel: Math.max(0, total.hrs_operacionais - total.hrs_manutencao),
        perc_disp: percDisp,
      };
    })
    .sort((a, b) => brDateToSortValue(a.data) - brDateToSortValue(b.data));
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

    <span
      className="block text-[1.05rem] font-black tracking-tight leading-none"
      style={{ color }}
    >
      {value}
    </span>

    {hint && (
      <span className="block mt-1 text-[11px] font-bold text-[var(--coa-text-soft)]">
        {hint}
      </span>
    )}
  </div>
);

const CategoryFilter = ({
  categoryOptions = [],
  selectedCategories = [],
  onToggle,
  isOpen,
  onToggleOpen,
}) => (
  <div className="coa-panel p-3 md:p-4 flex flex-col gap-3">
    <button
      type="button"
      onClick={onToggleOpen}
      className="w-full flex items-center justify-between gap-3 text-left"
    >
      <div className="flex flex-col gap-1">
        <span className="coa-text-micro">Filtro</span>

        <span className="text-sm font-black text-[var(--coa-text)]">
          Categorias
        </span>
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
                borderColor: checked
                  ? 'rgba(61,220,151,0.28)'
                  : 'var(--coa-border)',
                background: checked
                  ? 'rgba(61,220,151,0.10)'
                  : 'rgba(255,255,255,0.02)',
                color: checked
                  ? 'var(--coa-text)'
                  : 'var(--coa-text-soft)',
              }}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={checked}
                onChange={() => onToggle(category)}
              />

              <span>{category}</span>
            </label>
          );
        })}
      </div>
    )}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0].payload;

  if (row.perc_disp == null) return null;

  return (
    <div
      className="coa-panel p-3 border shadow-lg"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <p className="coa-text-micro mb-2">{row.data || label}</p>

      <p
        className="text-sm font-black"
        style={{ color: getDispoColor(row.perc_disp) }}
      >
        Disponibilidade: {formatPercent(row.perc_disp)}
      </p>

      <p className="text-xs font-bold text-[var(--coa-danger)] mt-1">
        Manutenção: {formatHHMM(row.hrs_manutencao)}
      </p>
    </div>
  );
};

const DispoDot = (props) => {
  const { cx, cy, payload } = props;

  if (cx === undefined || cy === undefined || !payload) return null;
  if (payload.perc_disp == null) return null;

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

const DispoLabel = ({ x, y, value }) => {
  if (x == null || y == null || value == null) return null;

  const color = getDispoColor(value);

  return (
    <text
      x={x}
      y={y}
      dy={-12}
      fill={color}
      fontSize={11}
      fontWeight="900"
      textAnchor="middle"
    >
      {formatPercent(value)}
    </text>
  );
};

/* ==========================================================================
   TABELA AREAS
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
      <span className="coa-text-micro text-right hidden md:block">Manut.</span>
      <span className="coa-text-micro text-right">Disp.</span>
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
            onClick={() => onOpenArea(row)}
            className="w-full text-left grid grid-cols-[minmax(0,1fr)_64px_76px] md:grid-cols-[minmax(0,1.35fr)_72px_98px_98px_82px] gap-2 px-3 md:px-4 py-3 border-b transition-all hover:bg-[rgba(255,255,255,0.035)]"
            style={{
              borderColor: 'var(--coa-divider)',
              background: getDispoTint(row.perc_disp, 0.055),
            }}
          >
            <div className="min-w-0 flex flex-col">
              <span className="text-[12px] md:text-[13px] font-black text-[var(--coa-text)] truncate">
                {row.desc_area}
              </span>

              <span className="text-[10px] font-bold text-[var(--coa-text-muted)] md:hidden">
                Manut. {formatHHMM(row.hrs_manutencao)}
              </span>
            </div>

            <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)] whitespace-nowrap">
              {formatInt(row.qnt_equip)}
            </span>

            <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)] whitespace-nowrap hidden md:block">
              {formatHHMM(row.hrs_operacionais)}
            </span>

            <span className="text-[12px] font-black text-right text-[var(--coa-danger)] whitespace-nowrap hidden md:block">
              {formatHHMM(row.hrs_manutencao)}
            </span>

            <span
              className="text-[12px] font-black text-right whitespace-nowrap"
              style={{ color: getDispoColor(row.perc_disp) }}
            >
              {formatPercent(row.perc_disp)}
            </span>
          </button>
        ))
      )}
    </div>
  </div>
);

/* ==========================================================================
   ROSCA SEMANAL
   ========================================================================== */

const WeeklyDonut = ({ summary, weekLabel }) => {
  const safeValue = clampPercent(summary.perc_disp);
  const color = getDispoColor(safeValue);
  const angle = (safeValue / 100) * 360;

  return (
    <div className="coa-panel p-4 flex flex-col gap-4 min-w-0">
      <div className="flex flex-col gap-1">
        <h2 className="text-[1.25rem] md:text-[1.45rem] font-black uppercase tracking-tight leading-none text-[var(--coa-text)]">
          Disponibilidade Mecânica Semanal
        </h2>

        <span className="text-sm font-black text-[var(--coa-text-soft)]">
          {weekLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr] gap-4 items-center">
        <div className="flex flex-col items-center justify-center">
          <div
            className="relative w-[170px] h-[170px] md:w-[190px] md:h-[190px] rounded-full flex items-center justify-center"
            style={{
              background: `conic-gradient(${color} 0deg ${angle}deg, rgba(255,255,255,0.08) ${angle}deg 360deg)`,
            }}
          >
            <div
              className="absolute inset-[16px] md:inset-[18px] rounded-full border flex items-center justify-center bg-[rgba(3,8,20,0.96)]"
              style={{ borderColor: 'var(--coa-divider)' }}
            >
              <div className="flex flex-col items-center justify-center">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
                  Disp. Mec.
                </span>

                <span
                  className="text-[1.45rem] md:text-[1.65rem] font-black tracking-tight"
                  style={{ color }}
                >
                  {formatPercent(safeValue)}
                </span>

                <span className="text-[10px] font-bold text-[var(--coa-text-muted)] mt-1">
                  Meta: {DISPO_META_VERDE}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-1 gap-3">
          <MetricCard
            label="Operacional"
            value={formatHHMM(summary.hrs_operacionais)}
          />

          <MetricCard
            label="Disponível"
            value={formatHHMM(summary.hrs_disponivel)}
            color="var(--coa-success)"
          />

          <MetricCard
            label="Manutenção"
            value={formatHHMM(summary.hrs_manutencao)}
            color="var(--coa-danger)"
          />

          <MetricCard
            label="Indeterminado"
            value={formatHHMM(summary.hrs_indeter)}
            color={
              summary.perc_indeter > INDETER_META_ALERTA
                ? 'var(--coa-danger)'
                : '#f6d66d'
            }
            hint={`${formatPercent(summary.perc_indeter)} do período`}
          />
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   RESULTADO POR DIA
   ========================================================================== */

const DayTable = ({ rows = [] }) => (
  <div className="coa-panel p-0 overflow-hidden">
    <div
      className="grid grid-cols-[72px_68px_1fr_76px] md:grid-cols-[92px_80px_1fr_96px_82px] gap-2 px-3 md:px-4 py-3 border-b"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <span className="coa-text-micro">Dia</span>
      <span className="coa-text-micro">Data</span>
      <span className="coa-text-micro text-right hidden md:block">Operac.</span>
      <span className="coa-text-micro text-right">Manut.</span>
      <span className="coa-text-micro text-right">Disp.</span>
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
              background: getDispoTint(row.perc_disp, 0.045),
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

            <span className="text-[12px] font-black text-right text-[var(--coa-danger)] whitespace-nowrap">
              {formatHHMM(row.hrs_manutencao)}
            </span>

            <span
              className="text-[12px] font-black text-right whitespace-nowrap"
              style={{ color: getDispoColor(row.perc_disp) }}
            >
              {formatPercent(row.perc_disp)}
            </span>
          </div>
        ))
      )}
    </div>
  </div>
);

const WeeklyTrend = ({ rows = [] }) => (
  <div className="coa-panel p-4 flex flex-col gap-4 min-w-0">
    <SectionTitle title="Resultado Diário" />

    <div className="h-[280px] min-h-[280px] w-full min-w-0 overflow-visible">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={240}
      >
        <LineChart
          data={rows}
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
            dataKey="dia_curto"
            stroke="var(--coa-text-muted)"
            fontSize={12}
            fontWeight={900}
            tickLine={false}
            axisLine={false}
            dy={10}
            interval={0}
            minTickGap={0}
          />

          <YAxis hide domain={[0, 100]} />

          <Tooltip
            content={<CustomTooltip />}
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
            connectNulls
            dot={<DispoDot />}
            activeDot={{
              r: 7,
              stroke: 'var(--coa-text)',
              strokeWidth: 2,
            }}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="perc_disp"
              content={<DispoLabel />}
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
);

/* ==========================================================================
   MODAL AREA
   ========================================================================== */

const AreaEquipModal = ({
  area,
  weekInfo,
  weekLabel,
  selectedCategories = [],
  onClose,
}) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedCategoriesKey = useMemo(
    () => selectedCategories.join('|'),
    [selectedCategories]
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!area?.desc_area) return;

      try {
        setLoading(true);
        setError('');

        const data = await fetchAllPages(() => {
          let query = supabase
            .from('vw_c_dispo_semanal_equip_area')
            .select(EQUIP_AREA_COLUMNS)
            .eq('ano', weekInfo.ano)
            .eq('semana_iso', weekInfo.semana_iso)
            .eq('desc_area', area.desc_area)
            .order('perc_disp', { ascending: true });

          if (selectedCategories.length > 0) {
            query = query.in('categoria', selectedCategories);
          }

          return query;
        });

        if (!mounted) return;

        setRows((data || []).map(normalizeEquipRow));
      } catch (err) {
        console.error('[COA] Erro ao carregar equipamentos da área semanal:', err);
        if (mounted) setError('Falha ao carregar equipamentos da área.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [area, weekInfo, selectedCategoriesKey]);

  if (!area) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm p-2 md:p-4">
      <div className="relative coa-card w-full max-w-5xl h-[92vh] md:h-[86vh] overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 md:top-4 md:right-4 w-9 h-9 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] border text-[var(--coa-text-soft)] hover:text-[var(--coa-text)] transition-all z-20"
          style={{ borderColor: 'var(--coa-divider)' }}
        >
          ✕
        </button>

        <div className="h-full flex flex-col min-h-0">
          <div className="coa-card__header">
            <div className="flex flex-col gap-2 pr-10">
              <span className="coa-text-micro">Equipamentos da Área na Semana</span>

              <div className="flex flex-col gap-1">
                <h2 className="coa-text-title !mb-0">
                  {area.desc_area}
                </h2>

                <span className="text-sm font-bold text-[var(--coa-text-muted)]">
                  {weekLabel}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <WeeklyBadge color={getDispoColor(area.perc_disp)}>
                  {formatPercent(area.perc_disp)}
                </WeeklyBadge>

                <WeeklyBadge>
                  {formatInt(area.qnt_equip)} equipamentos
                </WeeklyBadge>

                <WeeklyBadge color="var(--coa-danger)">
                  {formatHHMM(area.hrs_manutencao)} manutenção
                </WeeklyBadge>
              </div>
            </div>
          </div>

          <div className="coa-card__body flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <div className="coa-loader-dots">
                  <span />
                  <span />
                  <span />
                </div>

                <span className="coa-loader-text">
                  Carregando equipamentos da área...
                </span>
              </div>
            ) : error ? (
              <div className="coa-empty text-[var(--coa-danger)]">{error}</div>
            ) : (
              <div className="coa-panel p-0 overflow-hidden">
                <div
                  className="grid grid-cols-[72px_minmax(0,1fr)_70px] md:grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)_96px_82px_72px] gap-2 px-3 md:px-4 py-3 border-b"
                  style={{ borderColor: 'var(--coa-divider)' }}
                >
                  <span className="coa-text-micro">Equip.</span>
                  <span className="coa-text-micro">Descrição</span>
                  <span className="coa-text-micro hidden md:block">Frente</span>
                  <span className="coa-text-micro text-right hidden md:block">Manut.</span>
                  <span className="coa-text-micro text-right hidden md:block">Indeter.</span>
                  <span className="coa-text-micro text-right">Disp.</span>
                </div>

                <div>
                  {rows.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm font-bold text-[var(--coa-text-muted)]">
                      Nenhum equipamento encontrado para esta área nos filtros selecionados.
                    </div>
                  ) : (
                    rows.map((row) => (
                      <div
                        key={`${row.cod_equip}-${row.desc_grupo}-${row.categoria}`}
                        className="grid grid-cols-[72px_minmax(0,1fr)_70px] md:grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)_96px_82px_72px] gap-2 px-3 md:px-4 py-3 border-b"
                        style={{
                          borderColor: 'var(--coa-divider)',
                          background: getDispoTint(row.perc_disp, 0.045),
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
                            {row.desc_grupo} • Manut. {formatHHMM(row.hrs_manutencao)}
                          </span>
                        </div>

                        <span className="text-[12px] font-bold text-[var(--coa-text-soft)] truncate hidden md:block">
                          {row.desc_grupo}
                        </span>

                        <span className="text-[12px] font-black text-right text-[var(--coa-danger)] whitespace-nowrap hidden md:block">
                          {formatHHMM(row.hrs_manutencao)}
                        </span>

                        <span
                          className="text-[12px] font-black text-right whitespace-nowrap hidden md:block"
                          style={{
                            color:
                              row.perc_indeter > INDETER_META_ALERTA
                                ? 'var(--coa-danger)'
                                : '#f6d66d',
                          }}
                        >
                          {formatHHMM(row.hrs_indeter)}
                        </span>

                        <span
                          className="text-[12px] font-black text-right whitespace-nowrap"
                          style={{ color: getDispoColor(row.perc_disp) }}
                        >
                          {formatPercent(row.perc_disp)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ==========================================================================
   MAIN
   ========================================================================== */

const DispoDetailSemanal = ({
  selectedDate,
  setSelectedDate,
}) => {
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const [weeklyDate, setWeeklyDate] = useState(() => {
    return selectedDate || toIsoDate(new Date());
  });

  const [areaRows, setAreaRows] = useState([]);
  const [dayRows, setDayRows] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);

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

        const [areasData, diasData] = await Promise.all([
          fetchAllPages(() =>
            supabase
              .from('vw_c_dispo_semanal_area')
              .select(AREA_COLUMNS)
              .eq('ano', weekInfo.ano)
              .eq('semana_iso', weekInfo.semana_iso)
              .order('perc_disp', { ascending: true })
          ),

          fetchAllPages(() =>
            supabase
              .from('vw_c_dispo_semanal_dia')
              .select(DIA_COLUMNS)
              .eq('ano', weekInfo.ano)
              .eq('semana_iso', weekInfo.semana_iso)
          ),
        ]);

        if (!mounted) return;

        setAreaRows((areasData || []).map(normalizeAreaRow));

        setDayRows(
          (diasData || [])
            .map(normalizeDiaRow)
            .sort((a, b) => brDateToSortValue(a.data) - brDateToSortValue(b.data))
        );

        setSelectedArea(null);
      } catch (err) {
        console.error('[COA] Erro ao carregar disponibilidade semanal:', err);
        if (mounted) setError('Falha ao carregar disponibilidade semanal.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [weekInfo.ano, weekInfo.semana_iso]);

  const categoryOptions = useMemo(() => {
    const values = [
      ...new Set(
        [...areaRows, ...dayRows]
          .map((row) => row.categoria)
          .filter(Boolean)
      ),
    ];

    return values.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);

      if (ai === -1 && bi === -1) return a.localeCompare(b, 'pt-BR');
      if (ai === -1) return 1;
      if (bi === -1) return -1;

      return ai - bi;
    });
  }, [areaRows, dayRows]);

  const filteredAreaBaseRows = useMemo(() => {
    if (selectedCategories.length === 0) return [];

    return areaRows.filter((row) => selectedCategories.includes(row.categoria));
  }, [areaRows, selectedCategories]);

  const filteredDayBaseRows = useMemo(() => {
    if (selectedCategories.length === 0) return [];

    return dayRows.filter((row) => selectedCategories.includes(row.categoria));
  }, [dayRows, selectedCategories]);

  const areaRowsFiltered = useMemo(() => {
    return aggregateAreaRows(filteredAreaBaseRows);
  }, [filteredAreaBaseRows]);

  const dayRowsFiltered = useMemo(() => {
    return aggregateDayRowsByDate(filteredDayBaseRows);
  }, [filteredDayBaseRows]);

  const weeklySummary = useMemo(() => {
    const total = areaRowsFiltered.reduce(
      (acc, row) => {
        acc.hrs_operacionais += toNumber(row.hrs_operacionais);
        acc.hrs_manutencao += toNumber(row.hrs_manutencao);
        acc.hrs_indeter += toNumber(row.hrs_indeter);
        acc.qnt_equip += toNumber(row.qnt_equip);
        return acc;
      },
      {
        hrs_operacionais: 0,
        hrs_manutencao: 0,
        hrs_indeter: 0,
        qnt_equip: 0,
      }
    );

    const percDisp =
      total.hrs_operacionais > 0
        ? Math.max(0, (1 - total.hrs_manutencao / total.hrs_operacionais)) * 100
        : 0;

    const percIndeter =
      total.hrs_operacionais > 0
        ? (total.hrs_indeter / total.hrs_operacionais) * 100
        : 0;

    return {
      ...total,
      hrs_disponivel: Math.max(0, total.hrs_operacionais - total.hrs_manutencao),
      perc_disp: percDisp,
      perc_indeter: percIndeter,
    };
  }, [areaRowsFiltered]);

  const dayRowsComplete = useMemo(() => {
    const rowsMap = new Map();

    dayRowsFiltered.forEach((row) => {
      rowsMap.set(row.data, row);
    });

    return weekDates.map((dateInfo) => {
      const found = rowsMap.get(dateInfo.full);

      if (found) {
        return {
          ...found,
          label: dateInfo.label,
          dia_semana: dateInfo.dia_semana,
          dia_curto: dateInfo.dia_curto,
        };
      }

      return {
        data: dateInfo.full,
        label: dateInfo.label,
        dia_semana: dateInfo.dia_semana,
        dia_curto: dateInfo.dia_curto,
        qnt_equip: null,
        hrs_operacionais: null,
        hrs_manutencao: null,
        hrs_disponivel: null,
        hrs_indeter: null,
        perc_disp: null,
      };
    });
  }, [dayRowsFiltered, weekDates]);

  const trendRows = useMemo(() => {
    return dayRowsComplete;
  }, [dayRowsComplete]);

  const handleCategoryToggle = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    );

    setSelectedArea(null);
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
                  <span />
                  <span />
                  <span />
                </div>

                <span className="coa-loader-text">
                  Calculando visão semanal...
                </span>
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

      <WeeklyDonut summary={weeklySummary} weekLabel={weekLabel} />

      <WeeklyTrend rows={trendRows} />

      <div className="flex flex-col gap-3">
        <SectionTitle
          title="Disponibilidade por Área"
          subtitle="Clique em uma área para visualizar os equipamentos da semana"
        />

        <AreaTable rows={areaRowsFiltered} onOpenArea={setSelectedArea} />
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle title="Resumo Diário da Semana" />

        <DayTable rows={dayRowsFiltered} />
      </div>

      {selectedArea && (
        <AreaEquipModal
          area={selectedArea}
          weekInfo={weekInfo}
          weekLabel={weekLabel}
          selectedCategories={selectedCategories}
          onClose={() => setSelectedArea(null)}
        />
      )}
    </div>
  );
};

export default DispoDetailSemanal;