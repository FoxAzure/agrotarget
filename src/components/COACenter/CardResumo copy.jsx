import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

const DEFAULT_CATEGORIES = ['AGRÍCOLA', 'APOIO'];
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

const brToIso = (brDate) => {
  if (!brDate || typeof brDate !== 'string' || !brDate.includes('/')) return '';
  const [dd, mm, yyyy] = brDate.split('/');
  return `${yyyy}-${mm}-${dd}`;
};

const isoToBr = (isoDate) => {
  if (!isoDate || typeof isoDate !== 'string' || !isoDate.includes('-')) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
};

const getLastNDatesBr = (selectedIso, days = 5) => {
  if (!selectedIso) return [];

  const base = new Date(`${selectedIso}T12:00:00`);
  const dates = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');

    dates.push(`${dd}/${mm}/${yyyy}`);
  }

  return dates;
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const getEfColor = (value) => {
  const safe = Number(value || 0);
  if (safe >= 65) return 'var(--coa-success)';
  if (safe >= 50) return 'var(--coa-warning)';
  return 'var(--coa-danger)';
};

const getSafeNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const aggregateRows = (rows = []) => {
  const total = rows.reduce(
    (acc, row) => {
      acc.hrs_total_seg += getSafeNumber(row.hrs_total_seg);
      acc.hrs_disp_seg += getSafeNumber(row.hrs_disp_seg);
      acc.hrs_produtivas_seg += getSafeNumber(row.hrs_produtivas_seg);
      acc.hrs_s_apont_seg += getSafeNumber(row.hrs_s_apont_seg);
      acc.hrs_indeter_seg += getSafeNumber(row.hrs_indeter_seg);
      acc.hrs_manutencao_seg += getSafeNumber(row.hrs_manutencao_seg);
      acc.hrs_deslocamento_seg += getSafeNumber(row.hrs_deslocamento_seg);
      return acc;
    },
    {
      hrs_total_seg: 0,
      hrs_disp_seg: 0,
      hrs_produtivas_seg: 0,
      hrs_s_apont_seg: 0,
      hrs_indeter_seg: 0,
      hrs_manutencao_seg: 0,
      hrs_deslocamento_seg: 0,
    }
  );

  const ef_op = total.hrs_disp_seg > 0 ? (total.hrs_produtivas_seg / total.hrs_disp_seg) * 100 : 0;
  const ef_real = total.hrs_total_seg > 0 ? (total.hrs_produtivas_seg / total.hrs_total_seg) * 100 : 0;
  const perc_s_apont = total.hrs_total_seg > 0 ? (total.hrs_s_apont_seg / total.hrs_total_seg) * 100 : 0;
  const perc_indeter = total.hrs_total_seg > 0 ? (total.hrs_indeter_seg / total.hrs_total_seg) * 100 : 0;
  const disp_mec = total.hrs_total_seg > 0 ? (1 - total.hrs_manutencao_seg / total.hrs_total_seg) * 100 : 0;

  return {
    ...total,
    ef_op,
    ef_real,
    perc_s_apont,
    perc_indeter,
    disp_mec,
  };
};

const fetchResumoByExactDates = async (datesBr = []) => {
  const uniqueDates = [...new Set(datesBr.filter(Boolean))];

  const responses = await Promise.all(
    uniqueDates.map(async (date) => {
      const { data, error } = await supabase
        .from('vw_c_eficiencias')
        .select(RESUMO_COLUMNS)
        .eq('data', date);

      if (error) {
        throw {
          ...error,
          targetDate: date,
        };
      }

      return data || [];
    })
  );

  return responses.flat().map(normalizeResumoRow);
};

const RadialGauge = ({ value = 0, size = 142, stroke = 14 }) => {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (safe / 100) * circumference;
  const color = getEfColor(safe);

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.16)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 300ms ease, stroke 300ms ease' }}
        />
        <text
          x="50%"
          y="49%"
          textAnchor="middle"
          fill="var(--coa-text)"
          fontSize="24"
          fontWeight="900"
        >
          {safe.toFixed(1)}%
        </text>
      </svg>
    </div>
  );
};

const BarsLastDays = ({ rows = [] }) => {
  const maxValue = Math.max(100, ...rows.map((row) => getSafeNumber(row.ef_op)));

  return (
    <div className="w-full h-full flex items-end gap-2">
      {rows.map((row) => {
        const value = getSafeNumber(row.ef_op);
        const height = Math.max(8, (value / maxValue) * 90);
        const color = getEfColor(value);

        return (
          <div key={row.data} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1.5">
            <span className="text-[10px] font-black leading-none" style={{ color }}>
              {value.toFixed(0)}%
            </span>

            <div className="w-full max-w-[28px] h-[96px] flex items-end justify-center">
              <div
                className="w-full rounded-t-lg"
                style={{
                  height: `${height}px`,
                  background: `linear-gradient(180deg, ${color} 0%, ${color}CC 100%)`,
                  boxShadow: `0 8px 20px ${color}22`,
                  transition: 'height 260ms ease, background 260ms ease',
                }}
              />
            </div>

            <span className="text-[10px] font-bold text-[var(--coa-text-muted)] leading-none">
              {row.data?.slice(0, 5) || '--/--'}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const CompactMetric = ({ label, value, tone = 'default' }) => {
  let color = 'var(--coa-text)';
  if (tone === 'success') color = 'var(--coa-success)';
  if (tone === 'warning') color = 'var(--coa-warning)';
  if (tone === 'danger') color = 'var(--coa-danger)';

  return (
    <div className="rounded-[14px] border px-3 py-3 bg-[rgba(255,255,255,0.02)]"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)] mb-1">
        {label}
      </span>
      <span className="block text-[1rem] font-black tracking-tight" style={{ color }}>
        {value}
      </span>
    </div>
  );
};

const CategoryFilter = ({
  categoryOptions = [],
  selectedCategories = [],
  onToggle,
  isOpen,
  onToggleOpen,
}) => {
  return (
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
        <div className="flex flex-wrap gap-2">
          {categoryOptions.map((category) => {
            const checked = selectedCategories.includes(category);

            return (
              <label
                key={category}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-[14px] border text-sm font-bold cursor-pointer"
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
                />
                <span>{category}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AreaListCompact = ({ rows = [], selectedArea, onAreaToggle }) => {
  return (
    <div className="coa-panel p-0 overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between"
        style={{ borderColor: 'var(--coa-divider)' }}
      >
        <div className="flex flex-col gap-1">
          <span className="coa-text-micro">Áreas</span>
          <span className="text-sm font-black text-[var(--coa-text)]">Eficiência por Área</span>
        </div>
        <span className="coa-badge">{rows.length}</span>
      </div>

      <div className="flex flex-col">
        <div
          className="grid grid-cols-[1.35fr_repeat(4,0.72fr)] gap-2 px-4 py-2.5 border-b"
          style={{ borderColor: 'var(--coa-divider)' }}
        >
          <span className="coa-text-micro">Área</span>
          <span className="coa-text-micro text-right">Ef. Op</span>
          <span className="coa-text-micro text-right">Ef. Real</span>
          <span className="coa-text-micro text-right">S/Ap.</span>
          <span className="coa-text-micro text-right">Disp.</span>
        </div>

        {rows.map((row) => {
          const active = selectedArea === row.desc_area;

          return (
            <button
              key={row.desc_area}
              type="button"
              onClick={() => onAreaToggle(row.desc_area)}
              className="w-full text-left grid grid-cols-[1.35fr_repeat(4,0.72fr)] gap-2 px-4 py-3 border-b transition-colors"
              style={{
                borderColor: 'var(--coa-divider)',
                background: active ? 'rgba(61,220,151,0.08)' : 'transparent',
              }}
            >
              <span className="text-[12px] font-black text-[var(--coa-text)] truncate pr-2">
                {row.desc_area}
              </span>

              <span className="text-[12px] font-black text-right" style={{ color: getEfColor(row.ef_op) }}>
                {formatPercent(row.ef_op)}
              </span>

              <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)]">
                {formatPercent(row.ef_real)}
              </span>

              <span
                className="text-[12px] font-black text-right"
                style={{ color: row.perc_s_apont <= 2 ? 'var(--coa-success)' : 'var(--coa-danger)' }}
              >
                {formatPercent(row.perc_s_apont)}
              </span>

              <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)]">
                {formatPercent(row.disp_mec)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const CardResumo = ({ selectedDate }) => {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState(DEFAULT_CATEGORIES);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const startedAt = performance.now();

      try {
        setLoading(true);
        setError('');
        setSelectedArea(null);

        const last5DatesBr = getLastNDatesBr(selectedDate, 5);
        const normalized = await fetchResumoByExactDates(last5DatesBr);

        normalized.sort((a, b) => {
          const dateCompare = brToIso(a.data).localeCompare(brToIso(b.data));
          if (dateCompare !== 0) return dateCompare;
          return (a.desc_area || '').localeCompare(b.desc_area || '', 'pt-BR');
        });

        const elapsed = Math.round(performance.now() - startedAt);

        console.log('[COA] vw_c_eficiencias carregada', {
          linhas: normalized.length,
          datas: last5DatesBr,
          ms: elapsed,
        });

        if (!mounted) return;
        setRows(normalized);
      } catch (err) {
        const elapsed = Math.round(performance.now() - startedAt);

        console.error('[COA] Erro ao carregar vw_c_eficiencias', {
          ms: elapsed,
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          targetDate: err?.targetDate,
          raw: err,
        });

        if (!mounted) return;
        setError(
          err?.targetDate
            ? `Timeout ao consultar ${err.targetDate}.`
            : err?.message || 'Falha ao carregar o resumo.'
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  const selectedBrDate = useMemo(() => isoToBr(selectedDate), [selectedDate]);

  const availableDates = useMemo(() => {
    return [...new Set(rows.map((row) => row.data).filter(Boolean))]
      .sort((a, b) => brToIso(a).localeCompare(brToIso(b)));
  }, [rows]);

  const effectiveBrDate = useMemo(() => {
    if (!availableDates.length) return selectedBrDate;

    if (availableDates.includes(selectedBrDate)) return selectedBrDate;

    const olderOrEqualDates = availableDates.filter((date) => brToIso(date) <= selectedDate);
    if (olderOrEqualDates.length) return olderOrEqualDates[olderOrEqualDates.length - 1];

    return availableDates[availableDates.length - 1];
  }, [availableDates, selectedBrDate, selectedDate]);

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
    return rows.filter((row) => selectedCategories.includes(row.categoria));
  }, [rows, selectedCategories]);

  const rowsForCurrentDate = useMemo(() => {
    const base = rowsByCategory.filter((row) => row.data === effectiveBrDate);
    return selectedArea ? base.filter((row) => row.desc_area === selectedArea) : base;
  }, [rowsByCategory, effectiveBrDate, selectedArea]);

  const currentAgg = useMemo(() => aggregateRows(rowsForCurrentDate), [rowsForCurrentDate]);

  const last5Bars = useMemo(() => {
    const base = selectedArea
      ? rowsByCategory.filter((row) => row.desc_area === selectedArea)
      : rowsByCategory;

    const uniqueDates = [...new Set(base.map((row) => row.data))]
      .sort((a, b) => brToIso(a).localeCompare(brToIso(b)))
      .slice(-5);

    return uniqueDates.map((date) => {
      const agg = aggregateRows(base.filter((row) => row.data === date));

      return {
        data: date,
        ef_op: agg.ef_op,
      };
    });
  }, [rowsByCategory, selectedArea]);

  const areaRows = useMemo(() => {
    const currentDateRows = rowsByCategory.filter((row) => row.data === effectiveBrDate);
    const map = new Map();

    currentDateRows.forEach((row) => {
      const area = row.desc_area || 'NÃO MAPEADO';
      if (!map.has(area)) map.set(area, []);
      map.get(area).push(row);
    });

    return [...map.entries()]
      .map(([desc_area, items]) => {
        const agg = aggregateRows(items);
        return {
          desc_area,
          ...agg,
        };
      })
      .sort((a, b) => b.ef_op - a.ef_op);
  }, [rowsByCategory, effectiveBrDate]);

  const handleCategoryToggle = (category) => {
    setSelectedArea(null);

    setSelectedCategories((prev) => {
      const exists = prev.includes(category);

      if (exists) {
        const next = prev.filter((item) => item !== category);
        return next.length ? next : prev;
      }

      return [...prev, category];
    });
  };

  const handleAreaToggle = (areaName) => {
    setSelectedArea((prev) => (prev === areaName ? null : areaName));
  };

  const navState = {
    selectedDate,
    selectedArea,
    selectedCategories,
  };

  if (loading) {
    return (
      <section className="coa-section">
        <div className="coa-card">
          <div className="coa-card__body coa-card__body--centered">
            <div className="coa-loader-dots" aria-label="Carregando">
              <span />
              <span />
              <span />
            </div>
            <span className="coa-loader-text">Carregando resumo...</span>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="coa-section">
        <div className="coa-card">
          <div className="coa-card__body coa-card__body--centered">
            <div className="coa-empty">{error}</div>
          </div>
        </div>
      </section>
    );
  }

  if (!rows.length) {
    return (
      <section className="coa-section">
        <div className="coa-card">
          <div className="coa-card__body coa-card__body--centered">
            <div className="coa-empty">Nenhum dado encontrado nos últimos 5 dias.</div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="coa-section">
      <div className="coa-card">
        <div className="coa-card__header">
          <div className="flex flex-col gap-1">
            <h2 className="coa-text-title !mb-0">Resumo Geral</h2>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="coa-badge">{effectiveBrDate || '--/--/----'}</span>
            {selectedArea && <span className="coa-badge coa-badge--success">{selectedArea}</span>}
          </div>
        </div>

        <div className="coa-card__body flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr_0.7fr] gap-4 items-stretch">
            <div className="coa-panel p-3 md:p-4 flex flex-col gap-3 min-h-[210px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-black text-[var(--coa-text)]">Eficiência Operacional</span>
                <span className="coa-badge">5 dias</span>
              </div>

              <div className="flex-1 min-h-[132px]">
                <BarsLastDays rows={last5Bars} />
              </div>
            </div>

            <div className="coa-panel p-3 md:p-4 flex flex-col gap-3 justify-center">
              <span className="text-sm font-black text-[var(--coa-text)]">Resumo</span>

              <div className="grid grid-cols-2 gap-3">
                <CompactMetric
                  label="Ef. Real"
                  value={formatPercent(currentAgg.ef_real)}
                  tone="default"
                />

                <CompactMetric
                  label="S/ Apont."
                  value={formatPercent(currentAgg.perc_s_apont)}
                  tone={currentAgg.perc_s_apont <= 2 ? 'success' : 'danger'}
                />

                <CompactMetric
                  label="Indeterm."
                  value={formatPercent(currentAgg.perc_indeter)}
                  tone={currentAgg.perc_indeter <= 10 ? 'success' : 'danger'}
                />

                <CompactMetric
                  label="Disp. Mec."
                  value={formatPercent(currentAgg.disp_mec)}
                  tone="default"
                />
              </div>
            </div>

            <div className="coa-panel p-3 md:p-4 flex items-center justify-center min-h-[210px]">
              <RadialGauge value={currentAgg.ef_op} />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[0.78fr_1.22fr] gap-4 items-start">
            <CategoryFilter
              categoryOptions={categoryOptions}
              selectedCategories={selectedCategories}
              onToggle={handleCategoryToggle}
              isOpen={isCategoryOpen}
              onToggleOpen={() => setIsCategoryOpen((prev) => !prev)}
            />

            <AreaListCompact
              rows={areaRows}
              selectedArea={selectedArea}
              onAreaToggle={handleAreaToggle}
            />
          </div>

          <div className="pt-1 flex flex-wrap gap-2">
            <button
              className="coa-btn coa-btn--ghost flex-1 min-w-[110px]"
              type="button"
              onClick={() => navigate('/coacenter/resumo', { state: navState })}
            >
              Diário
            </button>

            <button
              className="coa-btn coa-btn--ghost flex-1 min-w-[110px]"
              type="button"
              onClick={() => navigate('/coacenter/resumo/semanal', { state: navState })}
            >
              Semanal
            </button>

            <button
              className="coa-btn coa-btn--ghost flex-1 min-w-[110px]"
              type="button"
              onClick={() => navigate('/coacenter/resumo/mensal', { state: navState })}
            >
              Mensal
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CardResumo;