import React, { useEffect, useMemo, useState } from 'react';
import DateSelectorCOA from '../../../components/COACenter/DateSelectorCOA';
import { supabase } from '../../../lib/supabaseClient';
import OciosoDetailDiarioModal from './OciosoDetailDiarioModal';

const OCIOSO_GERAL_COLUMNS = ['desc_area', 'categoria', 'data'].join(',');

const OCIOSO_EQUIPE_COLUMNS = [
  'data',
  'semana_iso',
  'mes',
  'ano',
  'cod_equip',
  'desc_equip',
  'desc_area',
  'desc_grupo',
  'cod_op',
  'hrs_operacionais_seg',
  'hrs_disp_seg',
  'hrs_motor_ligado_seg',
  'hrs_ocioso_seg',
].join(',');

const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA', 'EMPACOTAMENTO'];

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

const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const getOciosoColor = (value) => {
  const safe = Number(value || 0);
  return safe <= 5 ? 'var(--coa-success)' : 'var(--coa-danger)';
};

const normalizeRow = (row = {}) => ({
  ...row,
  semana_iso: toNumber(row.semana_iso),
  mes: toNumber(row.mes),
  ano: toNumber(row.ano),
  hrs_operacionais_seg: toNumber(row.hrs_operacionais_seg),
  hrs_disp_seg: toNumber(row.hrs_disp_seg),
  hrs_motor_ligado_seg: toNumber(row.hrs_motor_ligado_seg),
  hrs_ocioso_seg: toNumber(row.hrs_ocioso_seg),
});

const aggregateEquipmentRows = (rows = []) => {
  const total = rows.reduce(
    (acc, row) => {
      acc.hrs_operacionais_seg += toNumber(row.hrs_operacionais_seg);
      acc.hrs_disp_seg += toNumber(row.hrs_disp_seg);
      acc.hrs_motor_ligado_seg += toNumber(row.hrs_motor_ligado_seg);
      acc.hrs_ocioso_seg += toNumber(row.hrs_ocioso_seg);
      return acc;
    },
    {
      hrs_operacionais_seg: 0,
      hrs_disp_seg: 0,
      hrs_motor_ligado_seg: 0,
      hrs_ocioso_seg: 0,
    }
  );

  const perc_ocioso =
    total.hrs_operacionais_seg > 0
      ? (total.hrs_ocioso_seg / total.hrs_operacionais_seg) * 100
      : 0;

  return {
    hrs_operacionais_seg: total.hrs_operacionais_seg,
    hrs_disp_seg: total.hrs_disp_seg,
    hrs_motor_ligado_seg: total.hrs_motor_ligado_seg,
    hrs_ocioso_seg: total.hrs_ocioso_seg,
    hrs_ocioso: total.hrs_ocioso_seg / 3600,
    hrs_motor_ligado: total.hrs_motor_ligado_seg / 3600,
    perc_ocioso,
  };
};

const SelectField = ({ label, value, onChange, options = [] }) => {
  return (
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
          <option
            key={option}
            value={option}
            style={{ background: '#0f172a', color: '#e2e8f0' }}
          >
            {option}
          </option>
        ))}
      </select>
    </div>
  );
};

const FilterPanel = ({
  isOpen,
  onToggleOpen,
  categoryFilter,
  setCategoryFilter,
  areaFilter,
  setAreaFilter,
  frenteFilter,
  setFrenteFilter,
  categoryOptions,
  areaOptions,
  frenteOptions,
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
          <span className="text-sm font-black text-[var(--coa-text)]">Resumo de Equipamentos</span>
        </div>

        <span className="coa-badge">{isOpen ? 'Ocultar' : 'Abrir'}</span>
      </button>

      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SelectField
            label="Categoria"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryOptions}
          />

          <SelectField
            label="Área"
            value={areaFilter}
            onChange={setAreaFilter}
            options={areaOptions}
          />

          <SelectField
            label="Frente"
            value={frenteFilter}
            onChange={setFrenteFilter}
            options={frenteOptions}
          />
        </div>
      )}
    </div>
  );
};

const SearchBar = ({ searchTerm, setSearchTerm, showClear, onClearAll }) => {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 flex flex-col gap-1">
        <span className="coa-text-micro">Busca</span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por código ou descrição..."
          className="h-[42px] rounded-[14px] border px-4 text-sm font-bold bg-[rgba(255,255,255,0.02)] text-[var(--coa-text)] outline-none"
          style={{ borderColor: 'var(--coa-divider)' }}
        />
      </div>

      {showClear && (
        <button
          type="button"
          onClick={onClearAll}
          className="h-[42px] w-[42px] rounded-[14px] border flex items-center justify-center text-sm font-black transition-colors"
          style={{
            borderColor: 'var(--coa-divider)',
            color: 'var(--coa-danger)',
            background: 'rgba(239,68,68,0.08)',
          }}
          title="Limpar filtros"
        >
          ✕
        </button>
      )}
    </div>
  );
};

const EquipmentList = ({ rows = [], onOpen }) => {
  return (
    <div className="coa-panel p-0 overflow-hidden">
      <div
        className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 border-b"
        style={{ borderColor: 'var(--coa-divider)' }}
      >
        <span className="coa-text-micro">Equipamento</span>
        <span className="coa-text-micro text-right">Ocioso</span>
        <span className="coa-text-micro text-right">%</span>
      </div>

      <div className="max-h-[560px] overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm font-bold text-[var(--coa-text-muted)]">
            Nenhum equipamento encontrado para os filtros informados.
          </div>
        ) : (
          rows.map((row, idx) => (
            <button
              key={`${row.cod_equip}-${row.desc_grupo}-${row.desc_area}-${idx}`}
              type="button"
              onClick={() => onOpen(row)}
              className="w-full text-left grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 border-b transition-colors hover:bg-[rgba(255,255,255,0.02)]"
              style={{ borderColor: 'var(--coa-divider)' }}
            >
              <div className="min-w-0 flex flex-col">
                <span className="text-[13px] font-black text-[var(--coa-text)] truncate">
                  {row.cod_equip}
                </span>
                <span className="text-[11px] font-medium text-[var(--coa-text-muted)] truncate">
                  {row.desc_equip || 'SEM DESCRIÇÃO'} - {row.desc_grupo || 'SEM FRENTE'}
                </span>
              </div>

              <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)] whitespace-nowrap">
                {formatHours(row.hrs_ocioso)}
              </span>

              <span
                className="text-[12px] font-black text-right whitespace-nowrap"
                style={{ color: getOciosoColor(row.perc_ocioso) }}
              >
                {formatPercent(row.perc_ocioso)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

const OciosoDetailResumo = ({ selectedDate, setSelectedDate, availableDates = [] }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [areaFilter, setAreaFilter] = useState('Todos');
  const [frenteFilter, setFrenteFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModalItem, setSelectedModalItem] = useState(null);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const selectedBrDate = isoToBr(selectedDate);

        const [geralRes, equipeRes] = await Promise.all([
          supabase
            .from('vw_c_ociosogeral')
            .select(OCIOSO_GERAL_COLUMNS)
            .eq('data', selectedBrDate),
          supabase
            .from('vw_c_ociosoequipe')
            .select(OCIOSO_EQUIPE_COLUMNS)
            .eq('data', selectedBrDate),
        ]);

        if (geralRes.error) throw geralRes.error;
        if (equipeRes.error) throw equipeRes.error;

        const areaCategoryMap = new Map();

        (geralRes.data || []).forEach((item) => {
          if (
            item?.desc_area &&
            item?.categoria &&
            item.desc_area !== 'EMPACOTAMENTO' &&
            item.categoria !== 'EMPACOTAMENTO'
          ) {
            areaCategoryMap.set(item.desc_area, item.categoria);
          }
        });

        const normalizedBase = (equipeRes.data || [])
          .map(normalizeRow)
          .map((row) => ({
            ...row,
            categoria: areaCategoryMap.get(row.desc_area) || '',
          }))
          .filter(
            (row) =>
              row.desc_area !== 'EMPACOTAMENTO' &&
              row.categoria !== 'EMPACOTAMENTO'
          );

        const groupedMap = new Map();

        normalizedBase.forEach((row) => {
          const key = [
            row.cod_equip || '',
            row.desc_equip || '',
            row.desc_area || '',
            row.desc_grupo || '',
            row.categoria || '',
          ].join('|');

          if (!groupedMap.has(key)) {
            groupedMap.set(key, {
              cod_equip: row.cod_equip,
              desc_equip: row.desc_equip,
              desc_area: row.desc_area,
              desc_grupo: row.desc_grupo,
              categoria: row.categoria,
              rows: [],
            });
          }

          groupedMap.get(key).rows.push(row);
        });

        const grouped = [...groupedMap.values()]
          .map((item) => {
            const agg = aggregateEquipmentRows(item.rows);

            return {
              cod_equip: item.cod_equip,
              desc_equip: item.desc_equip,
              desc_area: item.desc_area,
              desc_grupo: item.desc_grupo,
              categoria: item.categoria,
              ...agg,
            };
          })
          .sort((a, b) => b.hrs_ocioso - a.hrs_ocioso);

        if (!mounted) return;
        setRows(grouped);
      } catch (err) {
        console.error('[COA] Erro ao carregar resumo de ocioso:', err);
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

  const areaOptions = useMemo(() => {
    let base = rows;

    if (categoryFilter !== 'Todos') {
      base = base.filter((row) => row.categoria === categoryFilter);
    }

    const values = [...new Set(base.map((row) => row.desc_area).filter(Boolean))];
    return values.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rows, categoryFilter]);

  const frenteOptions = useMemo(() => {
    let base = rows;

    if (categoryFilter !== 'Todos') {
      base = base.filter((row) => row.categoria === categoryFilter);
    }

    if (areaFilter !== 'Todos') {
      base = base.filter((row) => row.desc_area === areaFilter);
    }

    const values = [...new Set(base.map((row) => row.desc_grupo).filter(Boolean))];
    return values.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rows, categoryFilter, areaFilter]);

  const filteredRows = useMemo(() => {
    let base = rows;

    if (categoryFilter !== 'Todos') {
      base = base.filter((row) => row.categoria === categoryFilter);
    }

    if (areaFilter !== 'Todos') {
      base = base.filter((row) => row.desc_area === areaFilter);
    }

    if (frenteFilter !== 'Todos') {
      base = base.filter((row) => row.desc_grupo === frenteFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();

      base = base.filter((row) => {
        const cod = String(row.cod_equip || '').toLowerCase();
        const desc = String(row.desc_equip || '').toLowerCase();
        return cod.includes(term) || desc.includes(term);
      });
    }

    return [...base].sort((a, b) => b.hrs_ocioso - a.hrs_ocioso);
  }, [rows, categoryFilter, areaFilter, frenteFilter, searchTerm]);

  const hasActiveFilters =
    categoryFilter !== 'Todos' ||
    areaFilter !== 'Todos' ||
    frenteFilter !== 'Todos' ||
    searchTerm.trim() !== '';

  const clearAllFilters = () => {
    setCategoryFilter('Todos');
    setAreaFilter('Todos');
    setFrenteFilter('Todos');
    setSearchTerm('');
  };

  useEffect(() => {
    if (categoryFilter !== 'Todos') {
      const isAreaValid = areaOptions.includes(areaFilter);
      if (areaFilter !== 'Todos' && !isAreaValid) {
        setAreaFilter('Todos');
      }
    }
  }, [categoryFilter, areaFilter, areaOptions]);

  useEffect(() => {
    const isFrenteValid = frenteOptions.includes(frenteFilter);
    if (frenteFilter !== 'Todos' && !isFrenteValid) {
      setFrenteFilter('Todos');
    }
  }, [frenteFilter, frenteOptions]);

  if (loading) {
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
      </div>
    );
  }

  if (error) {
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

      <FilterPanel
        isOpen={isFilterOpen}
        onToggleOpen={() => setIsFilterOpen((prev) => !prev)}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        areaFilter={areaFilter}
        setAreaFilter={setAreaFilter}
        frenteFilter={frenteFilter}
        setFrenteFilter={setFrenteFilter}
        categoryOptions={categoryOptions}
        areaOptions={areaOptions}
        frenteOptions={frenteOptions}
      />

      <SearchBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showClear={hasActiveFilters}
        onClearAll={clearAllFilters}
      />

      <EquipmentList rows={filteredRows} onOpen={setSelectedModalItem} />

        {selectedModalItem && (
            <OciosoDetailDiarioModal
                item={selectedModalItem}
                selectedDate={selectedDate}
                onClose={() => setSelectedModalItem(null)}
            />
        )}
    </div>
  );
};

export default OciosoDetailResumo;