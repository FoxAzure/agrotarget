// ================================= DOCUMENTATION ------------------------------------------
// Script: CardPerdaMec
// Purpose: Exibe os indicadores de Perda Mecanizada, comparando o Dia com o Ano (YTD).
// Relationships: 
//   - vw_q_perdamecgeral (Para granularidade diária e campos)
//   - vw_q_perdamec_ano  (Para consolidação anual de safra)
// ==========================================================================================

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { getMetasParaData, getStatusColor } from './rulesPerdaMec';

// ================================= HELPERS ------------------------------------------------

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  return Number.isNaN(number) ? '-' : number.toFixed(decimals).replace('.', ',');
};

const formatShortDate = (isoDate) => {
  if (!isoDate) return '-';
  const [y, m, d] = isoDate.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${d}-${meses[parseInt(m, 10) - 1]}`;
};

const LoadingSpinner = () => (
  <div className="qf-cuc-loading">
    <div className="qf-cuc-spinner" />
  </div>
);

// Componente do Triângulo Animado
const CompareTriangle = ({ daily, yearly }) => {
  if (daily === null || yearly === null) return null;
  const diff = daily - yearly;
  
  if (Math.abs(diff) < 0.01) return <span className="text-[10px] text-slate-300 font-bold text-center">-</span>;
  
  if (diff < 0) return <span className="qf-anim-triangle-down font-black text-center">▼</span>;
  return <span className="qf-anim-triangle-up font-black text-center">▲</span>;
};

// Motor de Cálculo Diário
const calcularIndicadoresDiario = (rows) => {
  let sumPerda = 0, sumTch = 0;
  let sumMtPisoteioSimples = 0, sumAvPisoteioSimples = 0;
  let sumMtPisoteioDuplo = 0, sumAvPisoteioDuplo = 0;
  let sumTocosArrancados = 0, sumTocosFixos = 0;

  rows.forEach(row => {
    sumPerda += Number(row.total_perda) || 0;
    sumTch += Number(row.tch_estimado) || 0;
    sumTocosArrancados += Number(row.tocos_arrancados) || 0;
    sumTocosFixos += Number(row.tocos_fixos) || 0;
    
    const espacamento = String(row.espacamento || '').trim().toLowerCase();
    if (espacamento === 'simples') {
      sumMtPisoteioSimples += Number(row.mt_pisoteio) || 0;
      sumAvPisoteioSimples += Number(row.av_pisoteio) || 0;
    } else if (espacamento === 'duplo') {
      sumMtPisoteioDuplo += Number(row.mt_pisoteio) || 0;
      sumAvPisoteioDuplo += Number(row.av_pisoteio) || 0;
    }
  });

  return {
    perda: sumPerda + sumTch > 0 ? (sumPerda / (sumPerda + sumTch)) * 100 : null,
    pisoteioSimples: sumAvPisoteioSimples > 0 ? (sumMtPisoteioSimples / sumAvPisoteioSimples) * 100 : null,
    pisoteioDuplo: sumAvPisoteioDuplo > 0 ? (sumMtPisoteioDuplo / sumAvPisoteioDuplo) * 100 : null,
    arranquio: sumTocosFixos > 0 ? (sumTocosArrancados / sumTocosFixos) * 100 : null,
  };
};

// ================================= COMPONENT ----------------------------------------------

const CardPerdaMec = ({ selectedDate }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  
  const [indicadoresDia, setIndicadoresDia] = useState({});
  const [indicadoresAno, setIndicadoresAno] = useState({});
  const [camposAvaliados, setCamposAvaliados] = useState([]);
  
  const metas = useMemo(() => getMetasParaData(selectedDate), [selectedDate]);
  
  const anoStr = selectedDate ? selectedDate.split('-')[0] : '-';
  const diaMouthStr = formatShortDate(selectedDate);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      setHasData(false);

      try {
        if (!selectedDate) return;
        const currentYear = parseInt(selectedDate.split('-')[0], 10);

        // Dispara as requisições em paralelo. A geral busca SÓ O DIA, a anual busca SÓ O ANO.
        const [resDia, resAno] = await Promise.all([
          supabase.from('vw_q_perdamecgeral').select('*').eq('data_apontamento', selectedDate),
          supabase.from('vw_q_perdamec_ano').select('*').eq('ano', currentYear).single()
        ]);

        if (resDia.error) throw resDia.error;
        if (resAno.error && resAno.error.code !== 'PGRST116') throw resAno.error; // Ignora se não houver consolidação do ano ainda

        const dataDia = resDia.data || [];
        const dataAno = resAno.data || null;

        if (dataDia.length === 0) {
          if (mounted) setIsLoading(false);
          return;
        }

        // Recupera os KPIs anuais calculados direto da nova View
        const indAno = dataAno ? {
          perda: dataAno.perda_perc,
          pisoteioSimples: dataAno.pisoteio_simples_perc,
          pisoteioDuplo: dataAno.pisoteio_duplo_perc,
          arranquio: dataAno.arranquio_perc
        } : { perda: null, pisoteioSimples: null, pisoteioDuplo: null, arranquio: null };

        const indDia = calcularIndicadoresDiario(dataDia);

        const mapCampos = new Map();
        dataDia.forEach(row => {
          const campo = String(row.campo || row.codigo_campo || 'Desconhecido').trim();
          if (!mapCampos.has(campo)) {
            mapCampos.set(campo, {
              campo, sumPerda: 0, sumTch: 0, 
              sumMtPisoteio: 0, sumAvPisoteio: 0, 
              sumTocosArrancados: 0, sumTocosFixos: 0,
              espacamentos: new Set()
            });
          }
          const c = mapCampos.get(campo);
          c.sumPerda += Number(row.total_perda) || 0;
          c.sumTch += Number(row.tch_estimado) || 0;
          c.sumMtPisoteio += Number(row.mt_pisoteio) || 0;
          c.sumAvPisoteio += Number(row.av_pisoteio) || 0;
          c.sumTocosArrancados += Number(row.tocos_arrancados) || 0;
          c.sumTocosFixos += Number(row.tocos_fixos) || 0;
          const espacamento = String(row.espacamento || '').trim().toLowerCase();
          if (espacamento) c.espacamentos.add(espacamento);
        });

        const listCampos = Array.from(mapCampos.values()).map(c => {
          const perdaPct = c.sumPerda + c.sumTch > 0 ? (c.sumPerda / (c.sumPerda + c.sumTch)) * 100 : null;
          const pisoteioPct = c.sumAvPisoteio > 0 ? (c.sumMtPisoteio / c.sumAvPisoteio) * 100 : null;
          const arranquioPct = c.sumTocosFixos > 0 ? (c.sumTocosArrancados / c.sumTocosFixos) * 100 : null;
          
          const isMixed = c.espacamentos.size > 1;
          let pisoteioMeta = null;
          if (!isMixed) {
            if (c.espacamentos.has('simples')) pisoteioMeta = metas.pisoteio_simples;
            else if (c.espacamentos.has('duplo')) pisoteioMeta = metas.pisoteio_duplo;
          }

          return { campo: c.campo, perda: perdaPct, pisoteio: pisoteioPct, arranquio: arranquioPct, isMixed, pisoteioMeta };
        }).sort((a, b) => a.campo.localeCompare(b.campo));

        if (!mounted) return;

        setIndicadoresDia(indDia);
        setIndicadoresAno(indAno);
        setCamposAvaliados(listCampos);
        setHasData(true);

      } catch (error) {
        console.error('🚨 [CardPerdaMec] Erro:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadData();
    return () => { mounted = false; };
  }, [selectedDate, metas]);

  if (!isLoading && !hasData) return null;
  if (isLoading) return <LoadingSpinner />;

  const KpiRow = ({ label, valDia, valAno, meta }) => {
    if (valDia === null) return null;
    return (
      <div className="qf-kpi-row">
        <span className="text-[12px] font-bold text-slate-600 text-left">{label}</span>
        
        <span className="text-[12px] font-black text-right tracking-tight" style={{ color: getStatusColor(valDia, meta) }}>
          {formatValue(valDia)}%
        </span>
        
        <div className="flex items-center justify-center">
          <CompareTriangle daily={valDia} yearly={valAno} />
        </div>
        
        <span className="text-[12px] font-black text-right tracking-tight" style={{ color: getStatusColor(valAno, meta) }}>
          {valAno !== null && valAno !== undefined ? `${formatValue(valAno)}%` : '-'}
        </span>
      </div>
    );
  };

  return (
    <section className="qf-card animate-in zoom-in-95 duration-300">
      
      <div className="qf-card-top-bar" />

      <div className="qf-card-header">
        <h2 className="qf-card-title">Perdas Mecanizada</h2>
      </div>

      <div className="qf-kpi-list">
        <div className="grid grid-cols-[1fr_60px_20px_60px] gap-2 px-1 pb-1 pt-1 border-b border-slate-200 items-end">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left">Indicador</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--q-dark)] text-right">{diaMouthStr}</span>
          <span />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">{anoStr}</span>
        </div>

        <KpiRow label="Perdas" valDia={indicadoresDia.perda} valAno={indicadoresAno.perda} meta={metas.perda} />
        <KpiRow label="Pisoteio Simples" valDia={indicadoresDia.pisoteioSimples} valAno={indicadoresAno.pisoteioSimples} meta={metas.pisoteio_simples} />
        <KpiRow label="Pisoteio Duplo" valDia={indicadoresDia.pisoteioDuplo} valAno={indicadoresAno.pisoteioDuplo} meta={metas.pisoteio_duplo} />
        <KpiRow label="Arranquio" valDia={indicadoresDia.arranquio} valAno={indicadoresAno.arranquio} meta={metas.arranquio} />
      </div>

      <div className="qf-table-wrapper">
        <div className="qf-table-container shadow-sm">
          
          <div className="qf-table-header">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Campo</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">Perda</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-center">Pisot.</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 text-right">Arran.</span>
          </div>
          
          <div className="flex flex-col max-h-[200px] overflow-y-auto custom-scrollbar">
            {camposAvaliados.map((item, idx) => (
              <div key={idx} className="qf-table-row">
                <span className="text-[10px] font-black text-slate-600 uppercase truncate self-center" title={item.campo}>{item.campo}</span>
                
                <span className="text-[10px] font-black text-center self-center" style={{ color: getStatusColor(item.perda, metas.perda) }}>
                  {formatValue(item.perda)}%
                </span>
                
                <span className="text-[10px] font-black text-center self-center" style={{ color: item.isMixed ? 'var(--q-dark)' : getStatusColor(item.pisoteio, item.pisoteioMeta) }}>
                  {item.pisoteio !== null ? `${formatValue(item.pisoteio)}%` : '-'}
                </span>
                
                <span className="text-[10px] font-black text-right self-center" style={{ color: getStatusColor(item.arranquio, metas.arranquio) }}>
                  {formatValue(item.arranquio)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="qf-card-footer">
        <button 
          onClick={() => navigate('/qualyflow/perdasmec', { state: { selectedDate } })}
          className="qf-cuc-detail-button"
        >
          Detalhado
        </button>
      </div>

    </section>
  );
};

export default CardPerdaMec;