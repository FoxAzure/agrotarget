import React, { useState, useMemo } from 'react';
import QualyHeader from '../../components/QualyFlow/QualyHeader';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';
import { UnifiedModuleCard, IndicatorRow } from '../../components/QualyFlow/IndicatorCard';
import SementeCard from '../../components/QualyFlow/SementeCard';
import { QUALY_RULES } from './rules';
import { qualyflowMockData } from '../../data/mockData';

const QualyFlowHome = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // 1. Mapeamento de Datas únicas
  const availableDates = useMemo(() => {
    const dates = [...new Set(qualyflowMockData.map(item => item.DATA_APONTAMENTO))];
    return dates.sort((a, b) => a.split('/').reverse().join('-').localeCompare(b.split('/').reverse().join('-')));
  }, []);

  const [dateIndex, setDateIndex] = useState(availableDates.length - 1);
  const selectedDate = availableDates[dateIndex];

  // 2. Filtragem Atômica por dia
  const filteredData = useMemo(() => {
    return qualyflowMockData.filter(item => item.DATA_APONTAMENTO === selectedDate);
  }, [selectedDate]);

  // 3. Lógica de Cálculos Centralizada (Mestrado em Dados)
  const stats = useMemo(() => {
    // Helper: Média por INDICADOR
    const getAvg = (ind) => {
      const arr = filteredData.filter(i => i.INDICADOR === ind);
      return arr.length ? (arr.reduce((a, b) => a + b.VALOR, 0) / arr.length).toFixed(1) : null;
    };

    // Helper: Soma por INDICADOR
    const getSum = (ind) => filteredData.filter(i => i.INDICADOR === ind).reduce((a, b) => a + b.VALOR, 0);

    // Helper: Média por OCORRÊNCIA (O que faltava!)
    const getAvgOcc = (occ) => {
      const arr = filteredData.filter(i => i.OCORRENCIA === occ);
      return arr.length ? (arr.reduce((a, b) => a + b.VALOR, 0) / arr.length).toFixed(1) : null;
    };

    // --- CÁLCULOS ESPECÍFICOS ---
    
    // Plantio
    const sumGemasViáveis = getSum("Gemas Viaveis por metro");
    const sumGemasTotal = getSum("Gemas por metro");
    const percGemasViáveis = sumGemasTotal > 0 ? Math.round((sumGemasViáveis / sumGemasTotal) * 100) : null;

    const sumFalhas = getSum("Total de Falhas");
    const countFalhas = filteredData.filter(i => i.INDICADOR === "Total de Falhas").length;
    const percFalha = countFalhas > 0 ? ((sumFalhas / (countFalhas * 60)) * 100).toFixed(1) : null;

    // Preparo (Paralelismo)
    const basePara = filteredData.filter(i => i.INDICADOR === "Paralelismo");
    const percPara = basePara.length ? Math.round((basePara.filter(i => i.VALOR >= 1.45 && i.VALOR <= 1.55).length / basePara.length) * 100) : null;

    // Semente (Gemas Totais e Médias)
    const sementeGemasV = getSum("Gemas Viáveis");
    const sementeGemasT = getSum("Total de Gemas");
    const sementeGemasPerc = sementeGemasT > 0 ? Math.round((sementeGemasV / sementeGemasT) * 100) : null;

    const infoGeral = filteredData[0] || {};
    const uniqueVariedades = [...new Set(filteredData.filter(i => i.VARIEDADE).map(i => i.VARIEDADE))];

    return {
      preparo: { 
        haste: getAvg("Profundidade"), 
        cana: getAvg("Profundidade da Cana"), 
        fita: getAvg("Profundidade Fita Gotejadora"), 
        para: percPara 
      },
      plantio: { 
        gemasPerc: percGemasViáveis, 
        falhaPerc: percFalha ? parseFloat(percFalha) : null, 
        gemasMetro: getAvg("Gemas Viaveis por metro"), 
        cob: getAvg("Coberta Média Plantio") 
      },
      semente: {
        gemasPerc: sementeGemasPerc,
        idade: getAvg("Idade da Semente") ? parseFloat(getAvg("Idade da Semente")) : null,
        tamanhoMedio: getAvgOcc("Avaliação Rebolos"), // Agora funciona!
        pisoteioPerc: getAvg("Pisoteio") ? parseFloat(getAvg("Pisoteio")) : 0,
        tipoIrrig: infoGeral.TIPO_IRRIG || "N/A",
        variedades: uniqueVariedades.length ? uniqueVariedades : ["N/D"]
      },
      // Gatilhos de Exibição
      hasPreparo: filteredData.some(i => i.OCORRENCIA === "Paralelismo" || i.OCORRENCIA === "Fita de Gotejo"),
      hasPlantio: filteredData.some(i => i.OCORRENCIA === "Avaliação Rebolos e Gemas"),
      hasSemente: filteredData.some(i => i.OCORRENCIA === "Avaliação de Gemas - Semente")
    };
  }, [filteredData]);

  return (
    <div className="min-h-screen bg-slate-50">
      <QualyHeader onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={(p) => console.log(p)} />

      <main className="p-4 flex flex-col items-center">
        <DateSelector 
          date={selectedDate} 
          onPrev={() => setDateIndex(di => di - 1)} 
          onNext={() => setDateIndex(di => di + 1)} 
          disablePrev={dateIndex === 0} 
          disableNext={dateIndex === availableDates.length - 1} 
        />

        <div className="w-full max-w-[340px] flex flex-col gap-4">
          
          {/* 1. CARD SEMENTE (O Destaque Visual) */}
          {stats.hasSemente && <SementeCard stats={stats.semente} />}

          {/* 2. CARD PREPARO */}
          {stats.hasPreparo && (
            <UnifiedModuleCard sectionTitle="Preparo de Solo" to="/qualyflow/preparo">
              <IndicatorRow title="Haste" value={stats.preparo.haste} unit="cm" color={QUALY_RULES["Haste"].meta(stats.preparo.haste)} />
              <IndicatorRow title="Cana" value={stats.preparo.cana} unit="cm" color={QUALY_RULES["Cana"].meta(stats.preparo.cana)} />
              <IndicatorRow title="Fita" value={stats.preparo.fita} unit="cm" color={QUALY_RULES["Fita"].meta(stats.preparo.fita)} />
              <IndicatorRow title="Paralelismo" value={stats.preparo.para} unit="%" color={QUALY_RULES["Paralelismo"].meta(stats.preparo.para)} />
            </UnifiedModuleCard>
          )}

          {/* 3. CARD PLANTIO */}
          {stats.hasPlantio && (
            <UnifiedModuleCard sectionTitle="Plantio" to="/qualyflow/plantio">
              <IndicatorRow title="Gemas Viáveis" value={stats.plantio.gemasPerc} unit="%" color={QUALY_RULES["GemasViáveis"].meta(stats.plantio.gemasPerc)} />
              <IndicatorRow title="Falha" value={stats.plantio.falhaPerc} unit="%" color={QUALY_RULES["Falha"].meta(stats.plantio.falhaPerc)} />
              <IndicatorRow title="Gemas por Metro" value={stats.plantio.gemasMetro} unit="un" color={QUALY_RULES["GemasPorMetro"].meta(stats.plantio.gemasMetro)} />
              <IndicatorRow title="Cobertura" value={stats.plantio.cob} unit="cm" color={QUALY_RULES["Cobertura"].meta(stats.plantio.cob)} />
            </UnifiedModuleCard>
          )}
        </div>
      </main>
    </div>
  );
};

export default QualyFlowHome;