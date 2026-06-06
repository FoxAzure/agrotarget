import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// Componentes
import COAHeader from '../../components/COACenter/COAHeader';
import COASidebar from '../../components/COACenter/COASidebar';
import COADateSelector from '../../components/COACenter/COADateSelector';
import COAAreaCard from '../../components/COACenter/COAAreaCard'; 
import COAcctCard from '../../components/COACenter/COAcctCard'; 

// Regras e Engine de Negócio
import { buildHomeCardsData } from './coa_rules';

// Dados
import coaMockData from '../../data/mockData_coa.json';

const COACenterHome = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const availableDates = useMemo(() => {
    const dates = [...new Set(coaMockData.map(i => i.DATA ? i.DATA.substring(0, 10) : null).filter(Boolean))];
    return dates.sort((a, b) => b.split('/').reverse().join('-').localeCompare(a.split('/').reverse().join('-')));
  }, []);

  const [dateIndex, setDateIndex] = useState(0);
  const selectedDate = availableDates[dateIndex] || "";

  // ===========================================================================
  // MOTOR DE CÁLCULO EXTERNALIZADO (Lógica 1:1 com Python)
  // ===========================================================================
  const processedCards = useMemo(() => {
    if (!selectedDate) return [];
    const filtered = coaMockData.filter(i => i.DATA && i.DATA.startsWith(selectedDate));
    return buildHomeCardsData(filtered);
  }, [selectedDate]);

  return (
    <div className="min-h-screen bg-[#06090F] text-slate-300 font-sans pb-10">
      <COAHeader onMenuOpen={() => setSidebarOpen(true)} />
      <COASidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={() => {}} />

      <main className="p-4 flex flex-col items-center">
        <COADateSelector 
          date={selectedDate}
          onPrev={() => setDateIndex(i => Math.min(i + 1, availableDates.length - 1))}
          onNext={() => setDateIndex(i => Math.max(i - 1, 0))}
          disablePrev={dateIndex === availableDates.length - 1}
          disableNext={dateIndex === 0}
        />

        <div className="w-full max-w-lg flex flex-col items-center gap-6 mt-2">
          {processedCards.map((card, idx) => {
            // Roteamento de Detalhes
            const detalheLink = `/coacenter/detalhe?area=${card.areaName}&date=${selectedDate}`;
            
            // Renderização Condicional baseada na regra da CCT
            if (card.isSpecialCCT) {
              return (
                <COAcctCard 
                  key={`cct-${idx}`}
                  areaName={card.areaName}
                  stats={card.stats}
                  to={detalheLink}
                />
              );
            }

            return (
              <COAAreaCard 
                key={`area-${idx}`}
                areaName={card.areaName}
                stats={card.stats}
                to={detalheLink}
              />
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default COACenterHome;