import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import DateSelectorQualyFlow from '../../../components/QualyFlow/DateSelectorQualyFlow';

const CUC_ATIVIDADES = ['CUC - Gotejo', 'CUC - Gotejo 9E'];

const normalizarData = (valor) => {
  if (!valor) return null;

  // Se vier como DD/MM/YYYY
  if (typeof valor === 'string' && valor.includes('/')) {
    const [dia, mes, ano] = valor.split('/');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }

  // Se vier como YYYY-MM-DD ou ISO
  if (typeof valor === 'string' && valor.includes('-')) {
    return valor.slice(0, 10);
  }

  return null;
};

const CucDetailDiario = ({ selectedDate, setSelectedDate }) => {
  const [availableDates, setAvailableDates] = useState([]);

  useEffect(() => {
    async function fetchDates() {
      const { data, error } = await supabase
        .from('vw_atvrealizadas')
        .select('data_apontamento, atividade')
        .in('atividade', CUC_ATIVIDADES);

      if (error) {
        console.error('Erro ao buscar datas do CUC:', error);
        return;
      }

      if (data) {
        const datasUnicas = [
          ...new Set(
            data
              .map((item) => normalizarData(item.data_apontamento))
              .filter(Boolean)
          ),
        ].sort();

        setAvailableDates(datasUnicas);
      }
    }

    fetchDates();
  }, []);

  const currentIndex = useMemo(
    () => availableDates.indexOf(selectedDate),
    [availableDates, selectedDate]
  );

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedDate(availableDates[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < availableDates.length - 1) {
      setSelectedDate(availableDates[currentIndex + 1]);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in slide-in-from-left-4 duration-300">
      <div className="flex justify-end border-b border-slate-200/60 pb-3 px-1">
        <DateSelectorQualyFlow
          date={selectedDate}
          availableDates={availableDates}
          onSelectDate={(d) => setSelectedDate(d)}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      </div>

      <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-slate-400 mt-2">
        <span className="text-3xl mb-2">💧</span>
        <span className="text-xs font-bold uppercase tracking-widest">
          Conteúdo Diário em Construção
        </span>
      </div>
    </div>
  );
};

export default CucDetailDiario;