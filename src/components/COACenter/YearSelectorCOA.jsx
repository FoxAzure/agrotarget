// ================================= DOCUMENTATION ------------------------------------------
// Script: YearSelectorCOA
// Purpose: Componente para seleção de Ano, consumindo vw_c_ocioso_anogeral para opções.
// ==========================================================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const YearSelectorCOA = ({ value, onChange }) => {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchYears = async () => {
      try {
        setLoading(true);
        // Busca os anos disponíveis na view geral
        const { data, error } = await supabase
          .from('vw_c_ocioso_anogeral')
          .select('ano')
          .order('ano', { ascending: false });

        if (error) throw error;

        if (mounted && data) {
          const uniqueYears = [...new Set(data.map(d => d.ano))];
          setYears(uniqueYears);
          
          if (!value && uniqueYears.length > 0) {
            onChange(uniqueYears[0]);
          }
        }
      } catch (err) {
        console.error('[COA] Erro ao carregar anos:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchYears();
    return () => { mounted = false; };
  }, [value, onChange]);

  if (loading) {
    return (
      <div className="h-10 md:h-12 w-full bg-[rgba(255,255,255,0.03)] border border-[var(--coa-divider)] rounded-[14px] flex items-center justify-center animate-pulse">
        <span className="text-xs font-bold text-[var(--coa-text-muted)]">Carregando ano...</span>
      </div>
    );
  }

  if (years.length === 0) {
    return (
      <div className="h-10 md:h-12 w-full border border-[var(--coa-divider)] rounded-[14px] flex items-center justify-center">
        <span className="text-xs text-[var(--coa-danger)]">Sem dados</span>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <select
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-10 md:h-12 appearance-none bg-[rgba(255,255,255,0.02)] border rounded-[14px] px-4 pr-10 text-sm md:text-[15px] font-black text-[var(--coa-text)] outline-none cursor-pointer transition-all hover:bg-[rgba(255,255,255,0.04)] focus:border-[var(--coa-accent)] focus:ring-1 focus:ring-[var(--coa-accent)]"
        style={{ borderColor: 'var(--coa-border)' }}
      >
        {years.map((y) => (
          <option key={y} value={y} className="bg-slate-900 text-white">
            Safra {y}
          </option>
        ))}
      </select>
      
      {/* Ícone de Seta customizado */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--coa-text-muted)]">
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1.5 1.5L6 6L10.5 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
};

export default YearSelectorCOA;