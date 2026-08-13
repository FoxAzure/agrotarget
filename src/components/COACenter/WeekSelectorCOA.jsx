// ================================= DOCUMENTATION ------------------------------------------
// Script: WeekSelectorCOA
// Purpose: Componente visual para selecionar semanas consumindo a vw_c_semana.
// Relationships: Consulta vw_c_semana.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// ================================= HELPERS ------------------------------------------------

const formatBr = (isoDate) => {
  if (!isoDate) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}`;
};

// ================================= EXECUTOR -----------------------------------------------

const WeekSelectorCOA = ({ value, onChange }) => {
  const [weeks, setWeeks] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchWeeks = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('vw_c_semana')
          .select('*')
          .order('ano', { ascending: false })
          .order('semana_iso', { ascending: false })
          .limit(20);

        if (error) throw error;

        if (mounted && data) {
          const formattedWeeks = data.map((row) => {
            // A regra de ouro: se tem menos de 7 dias na view, é parcial!
            const isParcial = row.dias < 7;
            const startStr = formatBr(row.dt_inicio);
            const endStr = formatBr(row.dt_final);
            const numSemana = String(row.semana_iso).padStart(2, '0');

            return {
              id: `${row.ano}-${row.semana_iso}`,
              semana: row.semana_iso,
              ano: row.ano,
              isParcial,
              label: `Semana ${numSemana}/${row.ano}`, // Formato explícito pedido
              labelModal: `Semana ${numSemana}`,
              periodo: `${startStr} a ${endStr}`,
              searchStr: `${row.semana_iso} ${row.ano} ${startStr} ${endStr}`.toLowerCase(),
            };
          });

          setWeeks(formattedWeeks);

          // Procura a primeira semana que NÃO é parcial (dias == 7) para ser a padrão
          if (!value && formattedWeeks.length > 0) {
            const lastCompleted = formattedWeeks.find(w => !w.isParcial) || formattedWeeks[0];
            onChange?.(lastCompleted);
          }
        }
      } catch (err) {
        console.error('[COA] Erro ao buscar vw_c_semana:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchWeeks();

    return () => { mounted = false; };
  }, []);

  const safeValue = value || weeks[0];
  const currentIndex = weeks.findIndex((w) => w.id === safeValue?.id);
  
  const disableNext = currentIndex <= 0;
  const disablePrev = currentIndex === -1 || currentIndex >= weeks.length - 1;

  const handlePrev = () => {
    if (!disablePrev) onChange?.(weeks[currentIndex + 1]);
  };

  const handleNext = () => {
    if (!disableNext) onChange?.(weeks[currentIndex - 1]);
  };

  const filteredWeeks = useMemo(() => {
    if (!searchTerm) return weeks;
    const lower = searchTerm.toLowerCase();
    return weeks.filter(w => w.searchStr.includes(lower));
  }, [weeks, searchTerm]);

  return (
    <div className="coa-date-shell relative">
      <div className="coa-date-inline">
        <button
          type="button"
          onClick={handlePrev}
          disabled={disablePrev || loading}
          className="coa-btn coa-date-nav"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={() => !loading && setIsOpen(true)}
          className="coa-btn coa-date-chip flex gap-2 items-center min-w-[150px] justify-center"
        >
          {loading ? (
            <span className="opacity-50">Carregando...</span>
          ) : (
            <>
              {/* O Card agora exibe exatamente "Semana XX/YYYY" */}
              <span className="font-black">{safeValue?.label}</span>
              
              {safeValue?.isParcial && (
                <span className="bg-[var(--coa-accent)] text-black text-[9px] px-1.5 py-0.5 rounded-[4px] font-black uppercase tracking-wider ml-1">
                  Parcial
                </span>
              )}
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={disableNext || loading}
          className="coa-btn coa-date-nav"
        >
          ›
        </button>
      </div>

      {isOpen && (
        <div className="coa-calendar-backdrop z-50" onClick={() => setIsOpen(false)}>
          <div
            className="coa-calendar coa-fade-in flex flex-col w-[320px] h-[420px] rounded-xl shadow-2xl bg-[var(--coa-bg)] border overflow-hidden"
            style={{ borderColor: 'var(--coa-divider)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex flex-col gap-3 shrink-0" style={{ borderColor: 'var(--coa-divider)' }}>
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="coa-text-overline">Selecionar Período</span>
                  <span className="coa-text-subtitle">Últimas Semanas (ISO)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[rgba(255,255,255,0.05)] text-lg transition-colors"
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                placeholder="Buscar semana ou ano..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[rgba(255,255,255,0.03)] border rounded-lg px-3 py-2 text-sm text-[var(--coa-text)] outline-none focus:border-[var(--coa-accent)] transition-colors"
                style={{ borderColor: 'var(--coa-divider)' }}
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
              {filteredWeeks.length === 0 ? (
                <div className="p-4 text-center text-xs font-medium text-[var(--coa-text-muted)]">
                  Nenhuma semana encontrada.
                </div>
              ) : (
                filteredWeeks.map((week) => {
                  const isSelected = safeValue?.id === week.id;
                  return (
                    <button
                      key={week.id}
                      type="button"
                      onClick={() => {
                        onChange?.(week);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left flex items-center justify-between p-3 rounded-lg transition-all ${
                        isSelected 
                          ? 'bg-[rgba(61,220,151,0.12)] border-[rgba(61,220,151,0.3)] border' 
                          : 'hover:bg-[rgba(255,255,255,0.03)] border border-transparent'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${isSelected ? 'text-[var(--coa-success)]' : 'text-[var(--coa-text)]'}`}>
                            {week.labelModal}
                          </span>
                          <span className="text-[10px] font-bold text-[var(--coa-text-muted)] mt-0.5">
                            {week.ano}
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--coa-text-soft)] font-medium">
                          {week.periodo}
                        </span>
                      </div>
                      
                      {week.isParcial && (
                        <span className="bg-[var(--coa-accent)] text-black text-[9px] px-2 py-1 rounded-[4px] font-black uppercase tracking-widest">
                          Parcial
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeekSelectorCOA;