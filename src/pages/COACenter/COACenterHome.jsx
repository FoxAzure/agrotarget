import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// Componentes
import COAHeader from '../../components/COACenter/COAHeader';
import COASidebar from '../../components/COACenter/COASidebar';
import COADateSelector from '../../components/COACenter/COADateSelector';
import COAAreaCard from '../../components/COACenter/COAAreaCard'; 

// Dados
import coaMockData from '../../data/mockData_coa.json';

// Helpers de Tempo
const timeToSeconds = (t) => {
  if (!t || typeof t !== 'string') return 0;
  const p = t.split(':');
  return (+p[0] || 0) * 3600 + (+p[1] || 0) * 60 + (+p[2] || 0);
};

const COACenterHome = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const availableDates = useMemo(() => {
    const dates = [...new Set(coaMockData.map(i => i.DATA ? i.DATA.substring(0, 10) : null).filter(Boolean))];
    return dates.sort((a, b) => b.split('/').reverse().join('-').localeCompare(a.split('/').reverse().join('-')));
  }, []);

  const [dateIndex, setDateIndex] = useState(0);
  const selectedDate = availableDates[dateIndex] || "";

  // MOTOR DE CÁLCULO REFINADO
  const processedCards = useMemo(() => {
    if (!selectedDate) return [];

    const filtered = coaMockData.filter(i => i.DATA && i.DATA.startsWith(selectedDate));
    const groups = {};

    filtered.forEach(item => {
      const area = item.AREA_MAP || "NÃO MAPEADO";
      if (!groups[area]) {
        groups[area] = {
          areaName: area,
          equips: new Set(),
          totalSecs: 0,
          produtivoSecs: 0,
          descontosSecs: 0, // Soma de Manutenção + Clima + Sem Turno + Fabrica
          motorSecs: 0,
          ociosoSecs: 0,
          semApontSecs: 0,
          indeterminadoSecs: 0,
          ofensoresMap: {},
          isSafraActive: false
        };
      }

      const g = groups[area];
      
      const grupoNome = (item.DESC_GRUPO_OPERACAO || "").toUpperCase();
      const opNome = (item.DESC_OPERACAO || "").toUpperCase();
      const estado = item.ESTADO || "";

      const secs = timeToSeconds(item.HRS_OPERACIONAIS);
      const motorSecs = timeToSeconds(item.HRS_MOTOR_LIGADO);
      
      // REGRA CORRIGIDA: Usa as Horas de Motor Ligado quando o Estado é F e não é Produtivo
      const isOcioso = estado === 'F' && grupoNome !== 'PRODUTIVO';
      const ociosoSecs = isOcioso ? motorSecs : 0;
      
      g.equips.add(item.COD_EQUIP);
      g.totalSecs += secs;
      g.motorSecs += motorSecs;
      g.ociosoSecs += ociosoSecs;

      // CÁLCULOS DE GRUPOS
      if (grupoNome === 'PRODUTIVO') {
        g.produtivoSecs += secs;
      }
      
      // HORAS QUE NÃO ENTRAM NA CONTA DA EFICIÊNCIA OPERACIONAL
      if (
        grupoNome.includes('MANUTEN') || 
        grupoNome.includes('CLIMA') || 
        grupoNome.includes('SEM TURNO') || 
        grupoNome.includes('INDUSTRIA') || 
        grupoNome.includes('FABRICA') ||
        opNome.includes('CHUVA')
      ) {
        g.descontosSecs += secs;
      }

      if (grupoNome === 'SEM APONTAMENTO') g.semApontSecs += secs;
      if (grupoNome === 'INDETERMINADO') g.indeterminadoSecs += secs;

      // OFENSORES: Apenas Improdutivos e Auxiliares
      if (['IMPRODUTIVO', 'AUXILIAR'].includes(grupoNome) && secs > 0) {
        g.ofensoresMap[opNome] = (g.ofensoresMap[opNome] || 0) + secs;
      }

      // FLAG DE SAFRA (Deixando engatilhado para você usar futuramente)
      if (area === "CCT" && item.DESC_EQUIP === "COLHEDORA" && opNome === "CORTE MECANIZADO") {
        g.isSafraActive = true;
      }
    });

    return Object.values(groups).map(g => {
      const totalH = g.totalSecs / 3600;
      const disponiveisSecs = g.totalSecs - g.descontosSecs;
      
      // MATEMÁTICA CORRIGIDA
      // Eficiência Op: (Produtivo / Disponíveis)
      const efOp = disponiveisSecs > 0 ? (g.produtivoSecs / disponiveisSecs) * 100 : 0;
      
      // Eficiência Real: (Produtivo / Total Bruto)
      const efReal = g.totalSecs > 0 ? (g.produtivoSecs / g.totalSecs) * 100 : 0;

      return {
        areaName: g.areaName,
        isSafra: g.isSafraActive, // Pode usar isso no map abaixo para renderizar outro card futuramente
        totalSecs: g.totalSecs,
        stats: {
          qtdEquipamentos: g.equips.size,
          totalHoras: totalH,
          horasDisponiveis: disponiveisSecs / 3600,
          horasProdutivas: g.produtivoSecs / 3600,       
          horasSemApontamento: g.semApontSecs / 3600,   
          horasMotor: g.motorSecs / 3600,
          horasOcioso: g.ociosoSecs / 3600,
          percSemApontamento: g.totalSecs > 0 ? (g.semApontSecs / g.totalSecs) * 100 : 0,
          percIndeterminado: g.totalSecs > 0 ? (g.indeterminadoSecs / g.totalSecs) * 100 : 0,
          
          // CORREÇÃO CRÍTICA AQUI: Base de cálculo alterada para g.totalSecs (Horas Operacionais)
          percMotorOcioso: g.totalSecs > 0 ? (g.ociosoSecs / g.totalSecs) * 100 : 0,
          
          eficienciaOperacional: efOp,
          eficienciaReal: efReal,
          ofensores: Object.entries(g.ofensoresMap)
            .map(([nome, s]) => ({ nome, horas: s / 3600 }))
            .sort((a, b) => b.horas - a.horas)
            .slice(0, 3)
        }
      };
    }).sort((a, b) => b.totalSecs - a.totalSecs);
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

        {/* ALARGAMENTO DO CONTAINER PRINCIPAL PARA O CARD FICAR MAIOR */}
        <div className="w-full max-w-lg flex flex-col items-center gap-6 mt-2">
          {processedCards.map((card, idx) => {
            // Lógica futura: if (card.isSafra) return <COACCTCard ... />
            
            return (
              <COAAreaCard 
                key={idx}
                areaName={card.areaName}
                stats={card.stats}
                to={`/coacenter/detalhe?area=${card.areaName}&date=${selectedDate}`}
              />
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default COACenterHome;