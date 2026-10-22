// ================================= DOCUMENTATION ------------------------------------------
// Script: CardTLPerdasMec
// Purpose: Matriz orgânica e animada da timeline de Colheita Mecanizada.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import { evaluateMeta, formatMetaDescription, resolveMetaForYear } from '../utils/timelineMetaUtils';
import './CardTLPerdasMec.css';

const ACTIVITY = { area: 'Colheita', name: 'Perdas na Colheita Mecanizada' };

const INDICATORS = [
  { key: 'perda_perc', parameterName: 'Perda', label: 'Perdas', direction: 'lower' },
  { key: 'pisoteio_simples_perc', parameterName: 'Pisoteio - Simples', label: 'Pisoteio Simples', direction: 'lower' },
  { key: 'pisoteio_duplo_perc', parameterName: 'Pisoteio - Duplo', label: 'Pisoteio Duplo', direction: 'lower' },
  { key: 'arranquio_perc', parameterName: 'Arranquio', label: 'Arranquio', direction: 'lower' },
];

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const formatPercent = (value) => {
  const number = toFiniteNumber(value);
  return number === null ? '—' : `${number.toFixed(2).replace('.', ',')}%`;
};

const getTrend = (currentValue, previousValue, direction = 'lower') => {
  const current = toFiniteNumber(currentValue);
  const previous = toFiniteNumber(previousValue);

  if (current === null || previous === null) return null;

  const difference = current - previous;
  if (Math.abs(difference) < 0.005) return { state: 'stable', delta: '0,00' };

  const isLower = difference < 0;
  return {
    state: (direction === 'higher' ? difference > 0 : isLower) ? 'favorable' : 'attention',
    symbol: isLower ? '▼' : '▲',
    delta: Math.abs(difference).toFixed(2).replace('.', ','),
  };
};

// ================================= STYLES =================================
// Tamanhos de referência calibrados para dar a vida e espaço à tela
const CUSTOM_SIZES = {
  '--qf-fs-ind': 'clamp(12px, 3.5vw, 12px)', // Nome do Indicador, responsivo
  '--qf-fs-year': '12px',                    // Cabeçalho dos anos
  '--qf-fs-val': 'clamp(14px, 4vw, 16px)',   // O Valor brilhou e ficou maior!
  '--qf-fs-meta': '10px',                    // Texto da meta
  '--qf-fs-diff': 'clamp(10px, 3vw, 11px)',  // Badge da diferença
  '--qf-node-w': '60px',                     // Largura fixa dos pilares (anos)
};
// ==========================================================================

const CardTLPerdasMec = ({ selectedYear }) => {
  const [annualRows, setAnnualRows] = useState([]);
  const [parameterRows, setParameterRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const year = selectedYear ? Number(selectedYear) : new Date().getFullYear();
  const timelineYears = useMemo(() => [year - 2, year - 1, year], [year]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      setHasError(false);
      try {
        console.groupCollapsed(`[SUPABASE] Buscando Timeline (${timelineYears.join(', ')})`);
        
        const [annualRes, paramRes] = await Promise.all([
          supabase.from('vw_q_perdamec_ano').select(`ano, ${INDICATORS.map(i => i.key).join(', ')}`).in('ano', timelineYears),
          supabase.from('tb_q_parametros_agricolas').select('*').eq('area', ACTIVITY.area).eq('atividade', ACTIVITY.name)
        ]);
        
        console.log('Resultados Anuais:', annualRes.data);
        console.log('Metas Baixadas:', paramRes.data);
        console.groupEnd();

        if (!mounted) return;
        if (annualRes.error) throw annualRes.error;

        setAnnualRows(annualRes.data || []);
        setParameterRows(paramRes.error ? [] : (paramRes.data || []));
      } catch (error) {
        console.error('[CardTLPerdasMec] Erro Fatal:', error);
        if (mounted) setHasError(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [year, timelineYears]);

  const rowsByYear = useMemo(() => new Map(annualRows.map(r => [Number(r.ano), r])), [annualRows]);

  if (isLoading) return <div className="qf-mx-card qf-mx-msg"><div className="qf-mx-spinner"/></div>;
  if (hasError) return <div className="qf-mx-card qf-mx-msg is-error">Erro ao carregar os dados do painel.</div>;

  return (
    <section className="qf-mx-card" style={CUSTOM_SIZES}>
      <header className="qf-mx-header">
        <h2>Colheita Mecanizada</h2>
      </header>

      <div className="qf-mx-body">
        
        {/* CABEÇALHO DOS ANOS */}
        <div className="qf-mx-row qf-mx-row-head">
          <div className="qf-mx-col-ind"></div>
          <div className="qf-mx-track">
            {timelineYears.map((y, idx) => (
              <React.Fragment key={y}>
                {idx > 0 && <div className="qf-mx-bridge-head" />}
                <div className="qf-mx-node-head">{y}</div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* LINHAS DOS INDICADORES */}
        {INDICATORS.map((ind, rowIdx) => (
          <div className="qf-mx-row" key={ind.key} style={{ animationDelay: `${rowIdx * 0.08}s` }}>
            <div className="qf-mx-col-ind">
              <strong>{ind.label}</strong>
            </div>

            <div className="qf-mx-track">
              {timelineYears.map((y, idx) => {
                const prevValue = idx > 0 ? rowsByYear.get(timelineYears[idx - 1])?.[ind.key] : null;
                const currValue = rowsByYear.get(y)?.[ind.key];
                
                const valParsed = toFiniteNumber(currValue);
                const meta = resolveMetaForYear(parameterRows, ind.parameterName, y);
                const evaluation = evaluateMeta(valParsed, meta);
                const trend = idx > 0 ? getTrend(currValue, prevValue, ind.direction) : null;

                return (
                  <React.Fragment key={y}>
                    {/* Ponte Animada (Diferença) */}
                    {idx > 0 && (
                      <div className="qf-mx-bridge">
                        <div className={`qf-mx-bridge-line is-${trend?.state || 'neutral'}`} />
                        <span className={`qf-mx-diff is-${trend?.state || 'neutral'}`}>
                          {trend ? `${trend.symbol} ${trend.delta}` : '—'}
                        </span>
                      </div>
                    )}

                    {/* Nodo (Valor e Meta) */}
                    <div className="qf-mx-node">
                      <span className={`qf-mx-val is-${evaluation.state}`}>
                        {formatPercent(valParsed)}
                      </span>
                      <span className="qf-mx-meta">
                        {meta ? formatMetaDescription(meta) : 'S/ Meta'}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ))}

      </div>
    </section>
  );
};

export default CardTLPerdasMec;