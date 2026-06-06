import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

const DEFAULT_CATEGORIES = ['AGRÍCOLA', 'APOIO'];
const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA', 'EMPACOTAMENTO'];

const OCIOSO_COLUMNS = [
  'data',
  'semana',
  'mes',
  'ano',
  'desc_area',
  'categoria',
  'qnt_equip',
  'hrs_total_seg',
  'hrs_motor_ligado_seg',
  'hrs_efetivo_seg',
  'hrs_ocioso_seg',
  'hrs_total',
  'hrs_motor_ligado',
  'hrs_efetivo',
  'hrs_ocioso',
  'perc_ocioso',
].join(',');

const isoToBr = (isoDate) => {
  if (!isoDate || typeof isoDate !== 'string' || !isoDate.includes('-')) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeRow = (row = {}) => ({
  ...row,
  semana: toNumber(row.semana),
  mes: toNumber(row.mes),
  ano: toNumber(row.ano),
  qnt_equip: toNumber(row.qnt_equip),
  hrs_total_seg: toNumber(row.hrs_total_seg),
  hrs_motor_ligado_seg: toNumber(row.hrs_motor_ligado_seg),
  hrs_efetivo_seg: toNumber(row.hrs_efetivo_seg),
  hrs_ocioso_seg: toNumber(row.hrs_ocioso_seg),
  hrs_total: toNumber(row.hrs_total),
  hrs_motor_ligado: toNumber(row.hrs_motor_ligado),
  hrs_efetivo: toNumber(row.hrs_efetivo),
  hrs_ocioso: toNumber(row.hrs_ocioso),
  perc_ocioso: toNumber(row.perc_ocioso),
});

const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatInt = (value) => `${Math.round(Number(value || 0))}`;

const getOciosoColor = (value) => {
  const safe = Number(value || 0);
  return safe <= 5 ? 'var(--coa-success)' : 'var(--coa-danger)';
};

const aggregateRows = (rows = []) => {
  return rows.reduce(
    (acc, row) => {
      acc.qnt_equip += toNumber(row.qnt_equip);
      acc.hrs_total += toNumber(row.hrs_total);
      acc.hrs_motor_ligado += toNumber(row.hrs_motor_ligado);
      acc.hrs_efetivo += toNumber(row.hrs_efetivo);
      acc.hrs_ocioso += toNumber(row.hrs_ocioso);
      acc.hrs_total_seg += toNumber(row.hrs_total_seg);
      acc.hrs_ocioso_seg += toNumber(row.hrs_ocioso_seg);
      return acc;
    },
    {
      qnt_equip: 0,
      hrs_total: 0,
      hrs_motor_ligado: 0,
      hrs_efetivo: 0,
      hrs_ocioso: 0,
      hrs_total_seg: 0,
      hrs_ocioso_seg: 0,
    }
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
        <div className="flex flex-col gap-2">
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

const AreaTableOcioso = ({ rows = [] }) => {
  return (
    <div className="coa-panel p-0 overflow-hidden coa-area-table-home">
      <div
        className="grid grid-cols-[1.45fr_0.7fr_0.9fr_0.8fr] gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--coa-divider)' }}
      >
        <span className="coa-text-micro">Área</span>
        <span className="coa-text-micro text-right">Qnt</span>
        <span className="coa-text-micro text-right">Ocioso</span>
        <span className="coa-text-micro text-right">%</span>
      </div>

      <div className="coa-area-table-home__body">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm font-bold text-[var(--coa-text-muted)]">
            Nenhuma área encontrada para os filtros selecionados.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.desc_area}
              className="grid grid-cols-[1.45fr_0.7fr_0.9fr_0.8fr] gap-2 px-4 py-3 border-b"
              style={{ borderColor: 'var(--coa-divider)' }}
            >
              <span className="text-[12px] font-black text-[var(--coa-text)] truncate pr-2">
                {row.desc_area}
              </span>

              <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)]">
                {formatInt(row.qnt_equip)}
              </span>

              <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)]">
                {formatHours(row.hrs_ocioso)}
              </span>

              <span
                className="text-[12px] font-black text-right"
                style={{ color: getOciosoColor(row.perc_ocioso) }}
              >
                {formatPercent(row.perc_ocioso)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const CardOcioso = ({ selectedDate }) => {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(DEFAULT_CATEGORIES);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const startedAt = performance.now();

      try {
        setLoading(true);
        setError('');

        const selectedBrDate = isoToBr(selectedDate);

        const { data, error } = await supabase
          .from('vw_c_ociosogeral')
          .select(OCIOSO_COLUMNS)
          .eq('data', selectedBrDate);

        if (error) {
          throw error;
        }

        const normalized = (data || [])
          .map(normalizeRow)
          .filter(
            (row) =>
              row.desc_area !== 'EMPACOTAMENTO' &&
              row.categoria !== 'EMPACOTAMENTO'
          )
          .sort((a, b) => (a.desc_area || '').localeCompare(b.desc_area || '', 'pt-BR'));

        const elapsed = Math.round(performance.now() - startedAt);

        console.log('[COA] vw_c_ociosogeral carregada', {
          linhas: normalized.length,
          data: selectedBrDate,
          ms: elapsed,
        });

        if (!mounted) return;
        setRows(normalized);
      } catch (err) {
        const elapsed = Math.round(performance.now() - startedAt);

        console.error('[COA] Erro ao carregar vw_c_ociosogeral', {
          ms: elapsed,
          message: err?.message,
          details: err?.details,
          hint: err?.hint,
          code: err?.code,
          raw: err,
        });

        if (!mounted) return;
        setError(err?.message || 'Falha ao carregar o card de motor ocioso.');
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

  const totalAgg = useMemo(() => {
    const base = aggregateRows(rowsByCategory);

    const perc_ocioso =
      base.hrs_total_seg > 0 ? (base.hrs_ocioso_seg / base.hrs_total_seg) * 100 : 0;

    return {
      ...base,
      perc_ocioso,
    };
  }, [rowsByCategory]);

  const areaRows = useMemo(() => {
    return [...rowsByCategory].sort((a, b) => b.perc_ocioso - a.perc_ocioso);
  }, [rowsByCategory]);

  const handleCategoryToggle = (category) => {
    setSelectedCategories((prev) => {
      const exists = prev.includes(category);

      if (exists) {
        return prev.filter((item) => item !== category);
      }

      return [...prev, category];
    });
  };

  const navState = {
    selectedDate,
    selectedCategories,
  };

  if (loading) {
    return (
      <section className="coa-section">
        <div className="coa-card coa-card--resumo-home">
          <div className="coa-card__body flex items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <div className="coa-loader-dots" aria-label="Carregando">
                <span />
                <span />
                <span />
              </div>
              <span className="coa-loader-text">Carregando motor ocioso...</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="coa-section">
        <div className="coa-card coa-card--resumo-home">
          <div className="coa-card__body flex items-center justify-center">
            <div className="py-10">
              <div className="coa-empty">{error}</div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!rows.length) {
    return (
      <section className="coa-section">
        <div className="coa-card coa-card--resumo-home">
          <div className="coa-card__body flex items-center justify-center">
            <div className="py-10">
              <div className="coa-empty">Nenhum dado encontrado para a data selecionada.</div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="coa-section">
      <div className="coa-card coa-card--resumo-home">
        <div className="coa-card__header">
          <h2 className="coa-text-title !mb-0">Motor Ocioso</h2>
        </div>

        <div className="coa-card__body flex flex-col gap-4">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <MetricCard label="Horas Operacionais" value={formatHours(totalAgg.hrs_total)} />
            <MetricCard label="Horas Efetivas" value={formatHours(totalAgg.hrs_efetivo)} />
            <MetricCard label="Motor Ligado" value={formatHours(totalAgg.hrs_motor_ligado)} />
            <MetricCard label="Horas Ociosas" value={formatHours(totalAgg.hrs_ocioso)} />
            <MetricCard label="Equipamentos" value={formatInt(totalAgg.qnt_equip)} />
            <MetricCard
              label="% Motor Ocioso"
              value={formatPercent(totalAgg.perc_ocioso)}
              color={getOciosoColor(totalAgg.perc_ocioso)}
            />
          </div>

          <CategoryFilter
            categoryOptions={categoryOptions}
            selectedCategories={selectedCategories}
            onToggle={handleCategoryToggle}
            isOpen={isCategoryOpen}
            onToggleOpen={() => setIsCategoryOpen((prev) => !prev)}
          />

          <AreaTableOcioso rows={areaRows} />

          <div className="pt-1 flex justify-end">
            <button
              className="coa-btn coa-btn--ghost min-w-[130px]"
              type="button"
              onClick={() => navigate('/coacenter/ocioso', { state: navState })}
            >
              Detalhado
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CardOcioso;