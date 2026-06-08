import React, { useEffect, useMemo, useState } from 'react';
import DateSelectorCOA from '../../../components/COACenter/DateSelectorCOA';
import { supabase } from '../../../lib/supabaseClient';

const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA', 'EMPACOTAMENTO'];

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

  if (type === 'sapont') {
    return safe <= 2 ? 'var(--coa-success)' : 'var(--coa-danger)';
  }

  if (type === 'indeter') {
    return safe <= 10 ? 'var(--coa-success)' : 'var(--coa-danger)';
  }

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

  const ef_op =
    acc.hrs_disp_seg > 0 ? (acc.hrs_produtivas_seg / acc.hrs_disp_seg) * 100 : 0;

  const ef_real =
    acc.hrs_total_seg > 0 ? (acc.hrs_produtivas_seg / acc.hrs_total_seg) * 100 : 0;

  const perc_s_apont =
    acc.hrs_total_seg > 0 ? (acc.hrs_s_apont_seg / acc.hrs_total_seg) * 100 : 0;

  const perc_indeter =
    acc.hrs_total_seg > 0 ? (acc.hrs_indeter_seg / acc.hrs_total_seg) * 100 : 0;

  const disp_mec =
    acc.hrs_total_seg > 0 ? (acc.hrs_disp_seg / acc.hrs_total_seg) * 100 : 0;

  const hrs_produtivo_liquido_seg = Math.max(
    0,
    acc.hrs_produtivas_seg - acc.hrs_deslocamento_seg
  );

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

const CategoryFilter = ({
  categoryOptions = [],
  selectedCategories = [],
  onToggle,
  isOpen,
  onToggleOpen,
}) => {
  return (
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

        <span className="coa-badge">
          {isOpen ? 'Ocultar' : `${selectedCategories.length} ativas`}
        </span>
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
                <input type="checkbox" checked={checked} onChange={() => onToggle(category)} />
                <span>{category}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AreaFilterTable = ({ rows = [], selectedAreas = [], onToggleArea }) => {
  return (
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
};

const MetricCard = ({ label, value, color = 'var(--coa-text)' }) => {
  return (
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
};

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

const RealEfficiencyCard = ({ value }) => {
  return (
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
};

const BreakdownBar = ({
  totalSeg = 0,
  deslocSeg = 0,
  productiveNetSeg = 0,
  restanteSeg = 0,
}) => {
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
            style={{
              width: `${clampPercent(deslocPct)}%`,
              background: '#14532d',
            }}
          />
          <div
            title={`Produtivo: ${formatHHMMFromSeconds(productiveNetSeg)}`}
            style={{
              width: `${clampPercent(productivePct)}%`,
              background: '#22c55e',
            }}
          />
          <div
            title={`Restante: ${formatHHMMFromSeconds(restanteSeg)}`}
            style={{
              width: `${clampPercent(restantePct)}%`,
              background: 'rgba(148,163,184,0.50)',
            }}
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
          <span
            className="w-3 h-3 rounded-full"
            style={{ background: 'rgba(148,163,184,0.60)' }}
          />
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
  const meta = getKpiMetaLabel(type);

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
          style={{
            width: `${barWidth}%`,
            background: color,
          }}
        />
      </div>

      <span className="block mt-2 text-[11px] font-bold text-[var(--coa-text-muted)]">
        {meta}
      </span>
    </div>
  );
};

const ResumoDetailDiario = ({
  selectedDate,
  setSelectedDate,
  selectedCategories,
  setSelectedCategories,
  availableDates = [],
}) => {
  const [rows, setRows] = useState([]);
  const [areaRowsRaw, setAreaRowsRaw] = useState([]);
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

        const [resumoRes, areaRes] = await Promise.all([
          supabase
            .from('vw_c_eficiencias')
            .select(RESUMO_COLUMNS)
            .eq('data', selectedBrDate),
          supabase
            .from('vw_c_ociosogeral')
            .select(OCIOSO_AREA_COLUMNS)
            .eq('data', selectedBrDate),
        ]);

        if (resumoRes.error) throw resumoRes.error;
        if (areaRes.error) throw areaRes.error;

        const normalizedResumo = (resumoRes.data || [])
          .map(normalizeResumoRow)
          .sort((a, b) => (a.desc_area || '').localeCompare(b.desc_area || '', 'pt-BR'));

        const normalizedAreas = (areaRes.data || [])
          .map(normalizeAreaRow)
          .filter((row) => row.desc_area && row.categoria);

        if (!mounted) return;

        setRows(normalizedResumo);
        setAreaRowsRaw(normalizedAreas);
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
        perc_s_apont:
          row.hrs_total_seg > 0 ? (row.hrs_s_apont_seg / row.hrs_total_seg) * 100 : 0,
      }))
      .sort((a, b) => (a.desc_area || '').localeCompare(b.desc_area || '', 'pt-BR'));
  }, [areaRowsRaw, rowsByCategory, selectedCategories]);

  const filteredRows = useMemo(() => {
    const base = rowsByCategory;
    if (!selectedAreas.length) return base;
    return base.filter((row) => selectedAreas.includes(row.desc_area));
  }, [rowsByCategory, selectedAreas]);

  const totals = useMemo(() => aggregateSummaryRows(filteredRows), [filteredRows]);

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
          <MetricCard
            label="Horas Totais"
            value={formatHHMMFromSeconds(totals.hrs_total_seg)}
          />

          <MetricCard
            label="Disponíveis"
            value={formatHHMMFromSeconds(totals.hrs_disp_seg)}
          />

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
          <KpiProgressCard
            label="Sem Apontamento"
            value={totals.perc_s_apont}
            type="sapont"
          />
          <KpiProgressCard
            label="Indeterminado"
            value={totals.perc_indeter}
            type="indeter"
          />
          <KpiProgressCard
            label="Disponibilidade Mecânica"
            value={totals.disp_mec}
            type="disp_mec"
          />
        </div>
      </div>
    </div>
  );
};

export default ResumoDetailDiario;
