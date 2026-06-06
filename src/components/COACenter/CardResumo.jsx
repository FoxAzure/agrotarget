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

const isoToBr = (isoDate) => {
  if (!isoDate || typeof isoDate !== 'string' || !isoDate.includes('-')) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
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

const getStatusColor = (value, maxOk) => {
  return value <= maxOk ? 'var(--coa-success)' : 'var(--coa-danger)';
};

const getDispMecColor = (value) => {
  const safe = Number(value || 0);
  if (safe >= 90) return 'var(--coa-success)';
  if (safe >= 80) return 'var(--coa-warning)';
  return 'var(--coa-danger)';
};

const aggregateRows = (rows = []) => {
  const total = rows.reduce(
    (acc, row) => {
      acc.hrs_total_seg += Number(row.hrs_total_seg || 0);
      acc.hrs_disp_seg += Number(row.hrs_disp_seg || 0);
      acc.hrs_produtivas_seg += Number(row.hrs_produtivas_seg || 0);
      acc.hrs_s_apont_seg += Number(row.hrs_s_apont_seg || 0);
      acc.hrs_indeter_seg += Number(row.hrs_indeter_seg || 0);
      acc.hrs_manutencao_seg += Number(row.hrs_manutencao_seg || 0);
      return acc;
    },
    {
      hrs_total_seg: 0,
      hrs_disp_seg: 0,
      hrs_produtivas_seg: 0,
      hrs_s_apont_seg: 0,
      hrs_indeter_seg: 0,
      hrs_manutencao_seg: 0,
    }
  );

  const ef_op =
    total.hrs_disp_seg > 0 ? (total.hrs_produtivas_seg / total.hrs_disp_seg) * 100 : 0;

  const perc_s_apont =
    total.hrs_total_seg > 0 ? (total.hrs_s_apont_seg / total.hrs_total_seg) * 100 : 0;

  const disp_mec =
    total.hrs_total_seg > 0 ? (1 - total.hrs_manutencao_seg / total.hrs_total_seg) * 100 : 0;

  return {
    ef_op,
    perc_s_apont,
    disp_mec,
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

const AreaTableCompact = ({ rows = [] }) => {
  return (
    <div className="coa-panel p-0 overflow-hidden coa-area-table-home">
      <div
        className="grid grid-cols-[1.45fr_0.85fr_0.9fr_0.9fr] gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--coa-divider)' }}
      >
        <span className="coa-text-micro">Área</span>
        <span className="coa-text-micro text-right">Ef.Op.</span>
        <span className="coa-text-micro text-right">S.Apont</span>
        <span className="coa-text-micro text-right">Disp.Mec</span>
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
              className="grid grid-cols-[1.45fr_0.85fr_0.9fr_0.9fr] gap-2 px-4 py-3 border-b"
              style={{ borderColor: 'var(--coa-divider)' }}
            >
              <span className="text-[12px] font-black text-[var(--coa-text)] truncate pr-2">
                {row.desc_area}
              </span>

              <span
                className="text-[12px] font-black text-right"
                style={{ color: getEfColor(row.ef_op) }}
              >
                {formatPercent(row.ef_op)}
              </span>

              <span
                className="text-[12px] font-black text-right"
                style={{ color: getStatusColor(row.perc_s_apont, 2) }}
              >
                {formatPercent(row.perc_s_apont)}
              </span>

              <span
                className="text-[12px] font-black text-right"
                style={{ color: getDispMecColor(row.disp_mec) }}
              >
                {formatPercent(row.disp_mec)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const CardResumo = ({ selectedDate }) => {
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
          .from('vw_c_eficiencias')
          .select(RESUMO_COLUMNS)
          .eq('data', selectedBrDate);

        if (error) {
          throw error;
        }

        const normalized = (data || [])
          .map(normalizeResumoRow)
          .sort((a, b) => (a.desc_area || '').localeCompare(b.desc_area || '', 'pt-BR'));

        const elapsed = Math.round(performance.now() - startedAt);

        console.log('[COA] vw_c_eficiencias carregada', {
          linhas: normalized.length,
          data: selectedBrDate,
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
          raw: err,
        });

        if (!mounted) return;
        setError(err?.message || 'Falha ao carregar o resumo.');
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

  const areaRows = useMemo(() => {
    const map = new Map();

    rowsByCategory.forEach((row) => {
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
              <span className="coa-loader-text">Carregando resumo...</span>
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
          <h2 className="coa-text-title !mb-0">Resumo Geral</h2>
        </div>

        <div className="coa-card__body flex flex-col gap-4">
          <CategoryFilter
            categoryOptions={categoryOptions}
            selectedCategories={selectedCategories}
            onToggle={handleCategoryToggle}
            isOpen={isCategoryOpen}
            onToggleOpen={() => setIsCategoryOpen((prev) => !prev)}
          />

          <AreaTableCompact rows={areaRows} />

          <div className="pt-1 flex justify-end">
            <button
              className="coa-btn coa-btn--ghost min-w-[130px]"
              type="button"
              onClick={() => navigate('/coacenter/resumo', { state: navState })}
            >
              Detalhado
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CardResumo;