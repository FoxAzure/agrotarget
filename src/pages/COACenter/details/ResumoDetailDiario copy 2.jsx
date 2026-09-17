import React, { useEffect, useMemo, useState } from 'react';
import DateSelectorCOA from '../../../components/COACenter/DateSelectorCOA';
import { supabase } from '../../../lib/supabaseClient';

// ================================= VARIABLES & CONSTANTS ---------------------------------
const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA', 'EMPACOTAMENTO'];
const OFFENDER_GROUPS = ['AUXILIAR', 'IMPRODUTIVO'];

const RESUMO_COLUMNS = [
  'data',
  'semana',
  'mes',
  'ano',
  'desc_area',
  'categoria',
  'hrs_total_seg',
  'hrs_disp_seg',
  'hrs_produtivas_seg',
  'hrs_s_apont_seg',
  'hrs_indeter_seg',
  'hrs_manutencao_seg',
  'hrs_deslocamento_seg',
  'hrs_total',
  'hrs_disp',
  'hrs_produtivas',
  'hrs_s_apont',
  'hrs_indeter',
  'hrs_manutencao',
  'hrs_deslocamento',
  'ef_op',
  'ef_real',
  'perc_s_apont',
  'perc_indeter',
  'disp_mec',
].join(',');

const OCIOSO_AREA_COLUMNS = ['data', 'desc_area', 'categoria', 'qnt_equip'].join(',');

const OFFENDERS_COLUMNS = [
  'data',
  'desc_area',
  'desc_grupo_op',
  'desc_operacao',
  'hrs_operacionais_seg',
].join(',');

// ================================= HELPERS -----------------------------------------------
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

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const clampPercent = (value) => Math.max(0, Math.min(100, Number(value || 0)));
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatInt = (value) => `${Math.round(Number(value || 0))}`;

const formatHHMMFromSeconds = (seconds) => {
  const safeSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const getEfColor = (value) => {
  const safe = Number(value || 0);
  if (safe >= 65) return 'var(--coa-success)';
  if (safe >= 50) return 'var(--coa-warning)';
  return 'var(--coa-danger)';
};

const getKpiColor = (type, value) => {
  const safe = Number(value || 0);
  if (type === 'sapont') return safe <= 2 ? 'var(--coa-success)' : 'var(--coa-danger)';
  if (type === 'indeter') return safe <= 10 ? 'var(--coa-success)' : 'var(--coa-danger)';
  if (type === 'disp_mec') {
    if (safe >= 90) return 'var(--coa-success)';
    if (safe >= 80) return 'var(--coa-warning)';
    return 'var(--coa-danger)';
  }
  return 'var(--coa-text)';
};

const getKpiMetaLabel = (type) => {
  if (type === 'sapont') return 'Meta: ≤ 2%';
  if (type === 'indeter') return 'Meta: ≤ 10%';
  if (type === 'disp_mec') return 'Meta: 90% a 100%';
  return '';
};

// ================================= DATA NORMALIZERS --------------------------------------
const normalizeResumoRow = (row = {}) => ({
  ...row,
  semana: toNumber(row.semana),
  mes: toNumber(row.mes),
  ano: toNumber(row.ano),
  hrs_total_seg: toNumber(row.hrs_total_seg),
  hrs_disp_seg: toNumber(row.hrs_disp_seg),
  hrs_produtivas_seg: toNumber(row.hrs_produtivas_seg),
  hrs_s_apont_seg: toNumber(row.hrs_s_apont_seg),
  hrs_indeter_seg: toNumber(row.hrs_indeter_seg),
  hrs_manutencao_seg: toNumber(row.hrs_manutencao_seg),
  hrs_deslocamento_seg: toNumber(row.hrs_deslocamento_seg),
  hrs_total: toNumber(row.hrs_total),
  hrs_disp: toNumber(row.hrs_disp),
  hrs_produtivas: toNumber(row.hrs_produtivas),
  hrs_s_apont: toNumber(row.hrs_s_apont),
  hrs_indeter: toNumber(row.hrs_indeter),
  hrs_manutencao: toNumber(row.hrs_manutencao),
  hrs_deslocamento: toNumber(row.hrs_deslocamento),
  ef_op: toNumber(row.ef_op),
  ef_real: toNumber(row.ef_real),
  perc_s_apont: toNumber(row.perc_s_apont),
  perc_indeter: toNumber(row.perc_indeter),
  disp_mec: toNumber(row.disp_mec),
});

const normalizeAreaRow = (row = {}) => ({
  ...row,
  qnt_equip: toNumber(row.qnt_equip),
});

const normalizeOffenderRow = (row = {}) => ({
  ...row,
  hrs_operacionais_seg: toNumber(row.hrs_operacionais_seg),
});

// ================================= AGGREGATORS -------------------------------------------
const aggregateSummaryRows = (rows = []) => {
  const acc = rows.reduce(
    (sum, row) => {
      sum.hrs_total_seg += toNumber(row.hrs_total_seg);
      sum.hrs_disp_seg += toNumber(row.hrs_disp_seg);
      sum.hrs_produtivas_seg += toNumber(row.hrs_produtivas_seg);
      sum.hrs_s_apont_seg += toNumber(row.hrs_s_apont_seg);
      sum.hrs_indeter_seg += toNumber(row.hrs_indeter_seg);
      sum.hrs_deslocamento_seg += toNumber(row.hrs_deslocamento_seg);
      return sum;
    },
    {
      hrs_total_seg: 0,
      hrs_disp_seg: 0,
      hrs_produtivas_seg: 0,
      hrs_s_apont_seg: 0,
      hrs_indeter_seg: 0,
      hrs_deslocamento_seg: 0,
    }
  );

  const ef_op = acc.hrs_disp_seg > 0 ? (acc.hrs_produtivas_seg / acc.hrs_disp_seg) * 100 : 0;
  const ef_real = acc.hrs_total_seg > 0 ? (acc.hrs_produtivas_seg / acc.hrs_total_seg) * 100 : 0;
  const perc_s_apont = acc.hrs_total_seg > 0 ? (acc.hrs_s_apont_seg / acc.hrs_total_seg) * 100 : 0;
  const perc_indeter = acc.hrs_total_seg > 0 ? (acc.hrs_indeter_seg / acc.hrs_total_seg) * 100 : 0;
  const disp_mec = acc.hrs_total_seg > 0 ? (acc.hrs_disp_seg / acc.hrs_total_seg) * 100 : 0;
  const hrs_produtivo_liquido_seg = Math.max(0, acc.hrs_produtivas_seg - acc.hrs_deslocamento_seg);
  const hrs_restante_seg = Math.max(0, acc.hrs_total_seg - acc.hrs_produtivas_seg);

  return {
    ...acc,
    ef_op,
    ef_real,
    perc_s_apont,
    perc_indeter,
    disp_mec,
    hrs_produtivo_liquido_seg,
    hrs_restante_seg,
  };
};

// ================================= SUB-COMPONENTS ----------------------------------------
const CategoryFilter = ({
  categoryOptions = [],
  selectedCategories = [],
  onToggle,
  isOpen,
  onToggleOpen,
}) => (
  <div className="coa-panel p-3 flex flex-col gap-3">
    <button
      type="button"
      onClick={onToggleOpen}
      className="w-full flex items-center justify-between gap-3 text-left"
    >
      <div className="flex flex-col gap-1">
        <span className="coa-text-micro">Filtro</span>
        <span className="text-sm font-black text-[var(--coa-text)]">Categorias</span>
      </div>

      <span className="coa-badge">{isOpen ? 'Ocultar' : `${selectedCategories.length} ativas`}</span>
    </button>

    {isOpen && (
      <div className="flex flex-wrap gap-2">
        {categoryOptions.map((category) => {
          const checked = selectedCategories.includes(category);

          return (
            <label
              key={category}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-[14px] border text-xs font-bold cursor-pointer"
              style={{
                borderColor: checked ? 'rgba(61,220,151,0.28)' : 'var(--coa-border)',
                background: checked ? 'rgba(61,220,151,0.10)' : 'rgba(255,255,255,0.02)',
                color: checked ? 'var(--coa-text)' : 'var(--coa-text-soft)',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(category)}
                className="hidden"
              />
              <span>{category}</span>
            </label>
          );
        })}
      </div>
    )}
  </div>
);

const AreaFilterTable = ({ rows = [], selectedAreas = [], onToggleArea }) => (
  <div className="coa-panel p-0 overflow-hidden coa-area-table-home">
    <div
      className="grid grid-cols-[1.5fr_0.5fr_0.6fr_0.7fr] gap-2 px-4 py-2.5 border-b"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <span className="coa-text-micro">Área</span>
      <span className="coa-text-micro text-right">Qnt</span>
      <span className="coa-text-micro text-right">Ef. Op</span>
      <span className="coa-text-micro text-right">S. Apont.</span>
    </div>

    <div className="coa-area-table-home__body">
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm font-bold text-[var(--coa-text-muted)]">
          Nenhuma área encontrada para os filtros selecionados.
        </div>
      ) : (
        rows.map((row) => {
          const active = selectedAreas.includes(row.desc_area);

          return (
            <button
              key={row.desc_area}
              type="button"
              onClick={() => onToggleArea(row.desc_area)}
              className="w-full text-left grid grid-cols-[1.5fr_0.5fr_0.6fr_0.7fr] gap-2 px-4 py-2.5 border-b transition-colors"
              style={{
                borderColor: 'var(--coa-divider)',
                background: active ? 'rgba(61,220,151,0.08)' : 'transparent',
              }}
            >
              <span className="text-[12px] font-black text-[var(--coa-text)] truncate pr-2">
                {row.desc_area}
              </span>

              <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)]">
                {formatInt(row.qnt_equip)}
              </span>

              <span
                className="text-[12px] font-black text-right"
                style={{ color: getEfColor(row.ef_op) }}
              >
                {formatPercent(row.ef_op)}
              </span>

              <span
                className="text-[12px] font-black text-right"
                style={{ color: getKpiColor('sapont', row.perc_s_apont) }}
              >
                {formatPercent(row.perc_s_apont)}
              </span>
            </button>
          );
        })
      )}
    </div>
  </div>
);

const MetricCard = ({ label, value, color = 'var(--coa-text)' }) => (
  <div
    className="rounded-[14px] border px-3 py-3 bg-[rgba(255,255,255,0.02)]"
    style={{ borderColor: 'var(--coa-divider)' }}
  >
    <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)] mb-1">
      {label}
    </span>
    <span
      className="block text-[1.02rem] md:text-[1.08rem] font-black tracking-tight leading-none"
      style={{ color }}
    >
      {value}
    </span>
  </div>
);

const DonutEfficiency = ({ value }) => {
  const safeValue = clampPercent(value);
  const color = getEfColor(safeValue);
  const angle = (safeValue / 100) * 360;

  return (
    <div className="coa-panel p-4 flex flex-col items-center justify-center gap-3">
      <span className="coa-text-micro">Eficiência Operacional</span>

      <div
        className="relative w-[134px] h-[134px] rounded-full flex items-center justify-center"
        style={{
          background: `conic-gradient(${color} 0deg ${angle}deg, rgba(255,255,255,0.08) ${angle}deg 360deg)`,
        }}
      >
        <div
          className="absolute inset-[14px] rounded-full border flex items-center justify-center bg-[rgba(3,8,20,0.96)]"
          style={{ borderColor: 'var(--coa-divider)' }}
        >
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
              Ef.Op.
            </span>
            <span className="text-[1.28rem] font-black tracking-tight" style={{ color }}>
              {formatPercent(safeValue)}
            </span>
          </div>
        </div>
      </div>

      <span className="text-[11px] font-bold text-[var(--coa-text-soft)] text-center">
        Produtivas / Disponíveis
      </span>
    </div>
  );
};

const RealEfficiencyCard = ({ value }) => (
  <div
    className="rounded-[14px] border px-3 py-3 bg-[rgba(255,255,255,0.015)]"
    style={{ borderColor: 'var(--coa-divider)' }}
  >
    <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)] mb-1">
      Eficiência Real
    </span>
    <span className="block text-[1rem] font-black tracking-tight text-[var(--coa-text)]">
      {formatPercent(value)}
    </span>
    <span className="block mt-1 text-[11px] font-bold text-[var(--coa-text-soft)]">
      Produtivas / Totais
    </span>
  </div>
);

const BreakdownBar = ({ totalSeg = 0, deslocSeg = 0, productiveNetSeg = 0, restanteSeg = 0 }) => {
  const total = Math.max(0, Number(totalSeg || 0));
  const deslocPct = total > 0 ? (Number(deslocSeg || 0) / total) * 100 : 0;
  const productivePct = total > 0 ? (Number(productiveNetSeg || 0) / total) * 100 : 0;
  const restantePct = total > 0 ? (Number(restanteSeg || 0) / total) * 100 : 0;

  return (
    <div
      className="rounded-[14px] border p-3 bg-[rgba(255,255,255,0.015)]"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
          Detalhamento Horas Produtivas
        </span>
        <span className="text-[11px] font-bold text-[var(--coa-text-soft)]">
          Total: {formatHHMMFromSeconds(totalSeg)}
        </span>
      </div>

      <div
        className="w-full h-[14px] rounded-full overflow-hidden border bg-[rgba(255,255,255,0.05)]"
        style={{ borderColor: 'var(--coa-divider)' }}
      >
        <div className="w-full h-full flex">
          <div
            title={`Deslocamento: ${formatHHMMFromSeconds(deslocSeg)}`}
            style={{ width: `${clampPercent(deslocPct)}%`, background: '#14532d' }}
          />
          <div
            title={`Produtivo: ${formatHHMMFromSeconds(productiveNetSeg)}`}
            style={{ width: `${clampPercent(productivePct)}%`, background: '#22c55e' }}
          />
          <div
            title={`Restante: ${formatHHMMFromSeconds(restanteSeg)}`}
            style={{ width: `${clampPercent(restantePct)}%`, background: 'rgba(148,163,184,0.50)' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: '#14532d' }} />
          <span className="text-[11px] font-bold text-[var(--coa-text-soft)]">
            Deslocamento ({formatHHMMFromSeconds(deslocSeg)})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
          <span className="text-[11px] font-bold text-[var(--coa-text-soft)]">
            Produtivo ({formatHHMMFromSeconds(productiveNetSeg)})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: 'rgba(148,163,184,0.60)' }} />
          <span className="text-[11px] font-bold text-[var(--coa-text-soft)]">
            Restante ({formatHHMMFromSeconds(restanteSeg)})
          </span>
        </div>
      </div>
    </div>
  );
};

const KpiProgressCard = ({ label, value, type }) => {
  const color = getKpiColor(type, value);
  const barWidth = clampPercent(value);

  return (
    <div
      className="rounded-[14px] border p-3 bg-[rgba(255,255,255,0.015)]"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--coa-text-soft)]">
          {label}
        </span>
        <span className="text-[0.95rem] font-black" style={{ color }}>
          {formatPercent(value)}
        </span>
      </div>

      <div
        className="w-full h-[10px] rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.07)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${barWidth}%`, background: color }}
        />
      </div>

      <span className="block mt-2 text-[11px] font-bold text-[var(--coa-text-muted)]">
        {getKpiMetaLabel(type)}
      </span>
    </div>
  );
};

// ================================= GRÁFICO OPERACIONAL -----------------------------------
const OperationGroupsChart = ({ chartData = [] }) => {
  const maxSeg = Math.max(...chartData.map((d) => d.seg), 1);

  return (
    <div className="coa-panel p-4 flex flex-col gap-4 border border-[var(--coa-divider)] rounded-[14px] mt-0 !mt-0">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
          Distribuição por Grupo de Operação
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {chartData.map((item) => {
          const visualWidth = clampPercent((item.seg / maxSeg) * 100);

          return (
            <div key={item.label} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-[var(--coa-text-soft)]">
                <span className="tracking-wide">{item.label}</span>

                <div className="flex items-center gap-3">
                  <span>{formatHHMMFromSeconds(item.seg)}</span>
                  <span className="w-10 text-right text-[10px] text-[var(--coa-text-muted)]">
                    {item.percent.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="w-full h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${visualWidth}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ================================= OFENSORES ---------------------------------------------
const OffendersTable = ({ rows = [], totalDaySeg = 0 }) => (
  <div className="coa-panel p-0 overflow-hidden mt-0 !mt-0 border border-[rgba(239,68,68,0.18)]">
    <div
      className="px-4 py-3 border-b flex items-center justify-between gap-3"
      style={{ borderColor: 'rgba(239,68,68,0.16)' }}
    >
      <div className="flex flex-col gap-1">
        <span className="coa-text-micro">Ofensores</span>
        <span className="text-[11px] font-bold text-[var(--coa-text-soft)]">
          AUXILIAR + IMPRODUTIVO
        </span>
      </div>

      <span
        className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.12em]"
        style={{
          background: 'rgba(239,68,68,0.10)',
          color: 'var(--coa-danger)',
          border: '1px solid rgba(239,68,68,0.18)',
        }}
      >
        Impacto negativo
      </span>
    </div>

    <div
      className="grid grid-cols-[1.55fr_0.7fr_0.45fr] gap-2 px-4 py-2.5 border-b"
      style={{ borderColor: 'rgba(239,68,68,0.14)' }}
    >
      <span className="coa-text-micro">Operação</span>
      <span className="coa-text-micro text-right">Total</span>
      <span className="coa-text-micro text-right">%</span>
    </div>

    <div>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm font-bold text-[var(--coa-text-muted)]">
          Nenhum ofensor encontrado para os filtros selecionados.
        </div>
      ) : (
        rows.map((row, index) => {
          const percent = totalDaySeg > 0 ? (row.seg / totalDaySeg) * 100 : 0;
          const bgAlpha = index === 0 ? 0.10 : index < 3 ? 0.075 : 0.045;

          return (
            <div
              key={`${row.desc_operacao}-${index}`}
              className="grid grid-cols-[1.55fr_0.7fr_0.45fr] gap-2 px-4 py-2.5 border-b"
              style={{
                borderColor: 'rgba(239,68,68,0.10)',
                background: `rgba(239,68,68,${bgAlpha})`,
              }}
            >
              <span className="text-[12px] font-black text-[var(--coa-text)] truncate pr-2">
                {row.desc_operacao}
              </span>

              <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)]">
                {formatHHMMFromSeconds(row.seg)}
              </span>

              <span
                className="text-[12px] font-black text-right"
                style={{ color: 'var(--coa-danger)' }}
              >
                {formatPercent(percent)}
              </span>
            </div>
          );
        })
      )}
    </div>
  </div>
);

// ================================= MAIN EXECUTOR -----------------------------------------
const ResumoDetailDiario = ({
  selectedDate,
  setSelectedDate,
  selectedCategories,
  setSelectedCategories,
  availableDates = [],
}) => {
  const [rows, setRows] = useState([]);
  const [areaRowsRaw, setAreaRowsRaw] = useState([]);
  const [rawOpTable, setRawOpTable] = useState([]);
  const [rawOffendersTable, setRawOffendersTable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState([]);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        setSelectedAreas([]);

        const selectedBrDate = isoToBr(selectedDate);

        const [resumoRes, areaRes, offendersRes, opTableRes] = await Promise.all([
          supabase.from('vw_c_eficiencias').select(RESUMO_COLUMNS).eq('data', selectedBrDate),

          supabase.from('vw_c_ociosogeral').select(OCIOSO_AREA_COLUMNS).eq('data', selectedBrDate),

          supabase
            .from('vw_c_ociosooperacao')
            .select(OFFENDERS_COLUMNS)
            .eq('data', selectedBrDate),

          supabase.from('tb_c_geral').select('*').in('data', [selectedBrDate, selectedDate]).limit(10000),
        ]);

        if (resumoRes.error) throw resumoRes.error;
        if (areaRes.error) throw areaRes.error;
        if (offendersRes.error) throw offendersRes.error;
        if (opTableRes.error) throw opTableRes.error;

        const normalizedResumo = (resumoRes.data || [])
          .map(normalizeResumoRow)
          .sort((a, b) => (a.desc_area || '').localeCompare(b.desc_area || '', 'pt-BR'));

        const normalizedAreas = (areaRes.data || [])
          .map(normalizeAreaRow)
          .filter((row) => row.desc_area && row.categoria);

        const normalizedOffenders = (offendersRes.data || [])
          .map(normalizeOffenderRow)
          .filter((row) => row.desc_area && row.desc_operacao);

        if (!mounted) return;

        setRows(normalizedResumo);
        setAreaRowsRaw(normalizedAreas);
        setRawOpTable(opTableRes.data || []);
        setRawOffendersTable(normalizedOffenders);
      } catch (err) {
        console.error('[COA] Erro ao carregar resumo diário:', err);
        if (!mounted) return;
        setError(err?.message || 'Falha ao carregar o resumo diário.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [selectedDate]);

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

  const rowsByCategory = useMemo(() => {
    if (!selectedCategories.length) return [];
    return rows.filter((row) => selectedCategories.includes(row.categoria));
  }, [rows, selectedCategories]);

  const areaTableRows = useMemo(() => {
    const areaMap = new Map();

    areaRowsRaw
      .filter((row) => selectedCategories.includes(row.categoria))
      .forEach((row) => {
        const key = row.desc_area || 'NÃO MAPEADO';

        if (!areaMap.has(key)) {
          areaMap.set(key, {
            desc_area: key,
            qnt_equip: 0,
            hrs_total_seg: 0,
            hrs_disp_seg: 0,
            hrs_produtivas_seg: 0,
            hrs_s_apont_seg: 0,
            ef_op: 0,
            perc_s_apont: 0,
          });
        }

        areaMap.get(key).qnt_equip += toNumber(row.qnt_equip);
      });

    rowsByCategory.forEach((row) => {
      const key = row.desc_area || 'NÃO MAPEADO';

      if (!areaMap.has(key)) {
        areaMap.set(key, {
          desc_area: key,
          qnt_equip: 0,
          hrs_total_seg: 0,
          hrs_disp_seg: 0,
          hrs_produtivas_seg: 0,
          hrs_s_apont_seg: 0,
          ef_op: 0,
          perc_s_apont: 0,
        });
      }

      const current = areaMap.get(key);
      current.hrs_total_seg += toNumber(row.hrs_total_seg);
      current.hrs_disp_seg += toNumber(row.hrs_disp_seg);
      current.hrs_produtivas_seg += toNumber(row.hrs_produtivas_seg);
      current.hrs_s_apont_seg += toNumber(row.hrs_s_apont_seg);
    });

    return [...areaMap.values()]
      .map((row) => ({
        ...row,
        ef_op: row.hrs_disp_seg > 0 ? (row.hrs_produtivas_seg / row.hrs_disp_seg) * 100 : 0,
        perc_s_apont: row.hrs_total_seg > 0 ? (row.hrs_s_apont_seg / row.hrs_total_seg) * 100 : 0,
      }))
      .sort((a, b) => (a.desc_area || '').localeCompare(b.desc_area || '', 'pt-BR'));
  }, [areaRowsRaw, rowsByCategory, selectedCategories]);

  const filteredRows = useMemo(() => {
    if (!selectedAreas.length) return rowsByCategory;
    return rowsByCategory.filter((row) => selectedAreas.includes(row.desc_area));
  }, [rowsByCategory, selectedAreas]);

  const totals = useMemo(() => aggregateSummaryRows(filteredRows), [filteredRows]);

  const filteredAreaNames = useMemo(() => {
    if (selectedAreas.length > 0) {
      return selectedAreas.map((item) => (item || '').trim().toUpperCase());
    }

    return areaTableRows.map((item) => (item.desc_area || '').trim().toUpperCase());
  }, [selectedAreas, areaTableRows]);

  const compiledChartData = useMemo(() => {
    let filteredOpTable = rawOpTable;

    if (filteredAreaNames.length > 0) {
      filteredOpTable = rawOpTable.filter((r) =>
        filteredAreaNames.includes((r.desc_area || '').trim().toUpperCase())
      );
    } else {
      filteredOpTable = [];
    }

    const sums = {
      auxiliar: 0,
      clima: 0,
      fabrica_parada: 0,
      improdutivo: 0,
      indeterminado: 0,
      manutencao: 0,
      produtivo: 0,
      s_apont: 0,
      sem_turno: 0,
    };

    filteredOpTable.forEach((r) => {
      sums.auxiliar += toNumber(r.auxiliar_seg);
      sums.clima += toNumber(r.clima_seg);
      sums.fabrica_parada += toNumber(r.fabrica_parada_seg);
      sums.improdutivo += toNumber(r.improdutivo_seg);
      sums.indeterminado += toNumber(r.indeter_seg);
      sums.manutencao += toNumber(r.manutencao_seg);
      sums.produtivo += toNumber(r.produtivo_seg);
      sums.s_apont += toNumber(r.s_apont_seg);
      sums.sem_turno += toNumber(r.sem_turno_seg);
    });

    const totalGeralSeg = Object.values(sums).reduce((acc, curr) => acc + curr, 0);

    const makeEntry = (label, seg, isProd) => ({
      label,
      seg,
      percent: totalGeralSeg > 0 ? (seg / totalGeralSeg) * 100 : 0,
      color: isProd ? 'var(--coa-success)' : '#64748b',
    });

    return [
      makeEntry('AUXILIAR', sums.auxiliar, false),
      makeEntry('CLIMA', sums.clima, false),
      makeEntry('FABRICA PARADA', sums.fabrica_parada, false),
      makeEntry('IMPRODUTIVO', sums.improdutivo, false),
      makeEntry('INDETERMINADO', sums.indeterminado, false),
      makeEntry('MANUTENÇÃO', sums.manutencao, false),
      makeEntry('PRODUTIVO', sums.produtivo, true),
      makeEntry('SEM APONTAMENTO', sums.s_apont, false),
      makeEntry('SEM TURNO DE TRABALHO', sums.sem_turno, false),
    ];
  }, [rawOpTable, filteredAreaNames]);

  const offendersData = useMemo(() => {
    let filtered = rawOffendersTable;

    if (filteredAreaNames.length > 0) {
      filtered = rawOffendersTable.filter((row) =>
        filteredAreaNames.includes((row.desc_area || '').trim().toUpperCase())
      );
    } else {
      filtered = [];
    }

    filtered = filtered.filter((row) =>
      OFFENDER_GROUPS.includes((row.desc_grupo_op || '').trim().toUpperCase())
    );

    const offendersMap = new Map();

    filtered.forEach((row) => {
      const key = (row.desc_operacao || 'SEM DESCRIÇÃO').trim();

      if (!offendersMap.has(key)) {
        offendersMap.set(key, {
          desc_operacao: key,
          seg: 0,
        });
      }

      offendersMap.get(key).seg += toNumber(row.hrs_operacionais_seg);
    });

    return [...offendersMap.values()]
      .sort((a, b) => b.seg - a.seg)
      .slice(0, 15);
  }, [rawOffendersTable, filteredAreaNames]);

  const handleCategoryToggle = (category) => {
    setSelectedAreas([]);
    setSelectedCategories((prev) => {
      const exists = prev.includes(category);
      if (exists) return prev.filter((item) => item !== category);
      return [...prev, category];
    });
  };

  const handleAreaToggle = (areaName) => {
    setSelectedAreas((prev) => {
      const exists = prev.includes(areaName);
      if (exists) return prev.filter((item) => item !== areaName);
      return [...prev, areaName];
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <div className="w-full max-w-sm md:max-w-md">
            <DateSelectorCOA
              value={selectedDate}
              onChange={setSelectedDate}
              maxDate={todayIso}
              availableDates={availableDates}
            />
          </div>
        </div>

        <div className="coa-card coa-card--resumo-home">
          <div className="coa-card__body flex items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <div className="coa-loader-dots" aria-label="Carregando">
                <span />
                <span />
                <span />
              </div>
              <span className="coa-loader-text">Carregando resumo diário...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <div className="w-full max-w-sm md:max-w-md">
            <DateSelectorCOA
              value={selectedDate}
              onChange={setSelectedDate}
              maxDate={todayIso}
              availableDates={availableDates}
            />
          </div>
        </div>

        <div className="coa-card">
          <div className="coa-card__body">
            <div className="coa-empty">{error}</div>
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
            value={selectedDate}
            onChange={setSelectedDate}
            maxDate={todayIso}
            availableDates={availableDates}
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

      <AreaFilterTable
        rows={areaTableRows}
        selectedAreas={selectedAreas}
        onToggleArea={handleAreaToggle}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_320px] gap-3 items-start">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <MetricCard label="Horas Totais" value={formatHHMMFromSeconds(totals.hrs_total_seg)} />
          <MetricCard label="Disponíveis" value={formatHHMMFromSeconds(totals.hrs_disp_seg)} />
          <MetricCard
            label="Produtivas"
            value={formatHHMMFromSeconds(totals.hrs_produtivas_seg)}
            color="var(--coa-success)"
          />
          <MetricCard
            label="Deslocamento"
            value={formatHHMMFromSeconds(totals.hrs_deslocamento_seg)}
            color="var(--coa-text)"
          />
        </div>

        <div className="flex flex-col gap-3">
          <DonutEfficiency value={totals.ef_op} />
          <RealEfficiencyCard value={totals.ef_real} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <BreakdownBar
          totalSeg={totals.hrs_total_seg}
          deslocSeg={totals.hrs_deslocamento_seg}
          productiveNetSeg={totals.hrs_produtivo_liquido_seg}
          restanteSeg={totals.hrs_restante_seg}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiProgressCard label="Sem Apontamento" value={totals.perc_s_apont} type="sapont" />
          <KpiProgressCard label="Indeterminado" value={totals.perc_indeter} type="indeter" />
          <KpiProgressCard
            label="Disponibilidade Mecânica"
            value={totals.disp_mec}
            type="disp_mec"
          />
        </div>
      </div>

      {/* BLOCO PADRONIZADO PARA NÃO PARECER “COLADO DEPOIS” */}
      <div className="flex flex-col gap-3 mt-0 pt-0">
        <OperationGroupsChart chartData={compiledChartData} />
        <OffendersTable rows={offendersData} totalDaySeg={totals.hrs_total_seg} />
      </div>
    </div>
  );
};

export default ResumoDetailDiario;