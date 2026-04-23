import React, { useState, useMemo } from 'react';
import QualyHeader from '../../components/QualyFlow/QualyHeader';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Componentes de Visualização
import { UnifiedModuleCard, IndicatorRow } from '../../components/QualyFlow/IndicatorCard';
import SementeCard from '../../components/QualyFlow/SementeCard';
import CucCard from '../../components/QualyFlow/CucCard';
import AdubacaoCard from '../../components/QualyFlow/AdubacaoCard';
import CompostoCard from '../../components/QualyFlow/CompostoCard';
import DroneCard from '../../components/QualyFlow/DroneCard';
import CasaBombaCard from '../../components/QualyFlow/CasaBombaCard';
import ChecklistGotejoCard from '../../components/QualyFlow/ChecklistGotejoCard';

// Regras e Dados
import { QUALY_RULES } from './rules';
import qualyflowMockData from '../../data/mockData.json';
import ebMapping from '../../data/ebMapping.json'; 

const QualyFlowHome = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // ===========================================================================
  // 1. GESTÃO DE DATAS E FILTRAGEM
  // ===========================================================================
  
  const availableDates = useMemo(() => {
    const dates = [...new Set(qualyflowMockData.map(item => item.DATA_HORA.substring(0, 10)))];
    return dates.sort((a, b) => b.split('/').reverse().join('-').localeCompare(a.split('/').reverse().join('-')));
  }, []);

  const [dateIndex, setDateIndex] = useState(0);
  const selectedDate = availableDates[dateIndex];

  const filteredData = useMemo(() => {
    return qualyflowMockData.filter(item => item.DATA_HORA.startsWith(selectedDate));
  }, [selectedDate]);

  // ===========================================================================
  // 2. CENTRAL DE CÁLCULOS (O Cérebro do QualyFlow)
  // ===========================================================================
  
  const stats = useMemo(() => {
    
    // --- HELPERS INTERNOS ---
    const getAvgRaw = (ind) => {
      const arr = filteredData.filter(i => i.INDICADOR === ind);
      return arr.length ? (arr.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / arr.length) : null;
    };

    const getSum = (ind) => filteredData.filter(i => i.INDICADOR === ind).reduce((a, b) => a + (Number(b.VALOR) || 0), 0);

    const getAvgOccRaw = (occ) => {
      const arr = filteredData.filter(i => i.OCORRENCIA === occ);
      return arr.length ? (arr.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / arr.length) : null;
    };

    // -------------------------------------------------------------------------
    // MÓDULO: CUC (Christiansen Uniformity)
    // -------------------------------------------------------------------------
    const activeCucPairs = [...new Set(filteredData
      .filter(i => i.OCORRENCIA.includes("CUC - Gotejo"))
      .map(i => `${i.CODIGO_CAMPO}|${i.EXTRA1}`)
    )];

    const cucCampos = activeCucPairs.map(pair => {
      const [codigo, visita] = pair.split('|');
      const historicData = qualyflowMockData.filter(i => 
        i.CODIGO_CAMPO === parseInt(codigo) && i.EXTRA1 === parseInt(visita) && i.OCORRENCIA.includes("CUC - Gotejo")
      );
      const emissoresLabels = Array.from({length: 12}, (_, i) => `${i+1}º Emissor`);
      const values = historicData.filter(i => emissoresLabels.includes(i.INDICADOR)).map(i => Number(i.VALOR) || 0);
      const n = values.length;
      const mean = n > 0 ? values.reduce((a, b) => a + b, 0) / n : 0;
      let cucValue = 0;
      if (mean > 0) {
        const s_abs = values.reduce((acc, x) => acc + Math.abs(x - mean), 0);
        cucValue = (1 - (s_abs / (n * mean))) * 100;
      }
      const entupidos = historicData.filter(i => i.INDICADOR === "Emissores Entupidos").reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
      return {
        nome: historicData[0]?.CAMPO || "DESCONHECIDO",
        cuc: cucValue, vazao: mean * 0.02,
        entupPerc: n > 0 ? (entupidos / n) * 100 : 0,
        avaliados: n, entupidos: entupidos
      };
    });

    // -------------------------------------------------------------------------
    // MÓDULO: CASA DE BOMBA (EB)
    // -------------------------------------------------------------------------
    const ebRaw = filteredData.filter(i => ["Captação", "Limpeza e Organização", "Fertirrigação"].includes(i.OCORRENCIA));
    const listaEbs = [...new Set(ebRaw.map(i => i.NOME_EB).filter(Boolean))];

    const ebStats = listaEbs.map(nro => {
      const dfEb = ebRaw.filter(i => i.NOME_EB === nro);
      const totalTelas = dfEb.find(i => i.INDICADOR === "Total de Telas")?.VALOR || 0;
      const telasProblema = dfEb.filter(i => ["Tela Danificada", "Tela Faltando", "Tela Suja"].includes(i.INDICADOR)).reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
      const telasPerc = totalTelas > 0 ? (1 - (telasProblema / totalTelas)) * 100 : 100;
      const totalCaixas = dfEb.find(i => ["Total de Caixas", "Total Caixas"].includes(i.INDICADOR))?.VALOR || 0;
      const caixasDanificadas = dfEb.find(i => i.INDICADOR === "Caixas Danificadas")?.VALOR || 0;
      const caixasPerc = totalCaixas > 0 ? (1 - (caixasDanificadas / totalCaixas)) * 100 : 100;
      const orgItems = dfEb.filter(i => ["Limpeza Externa da EB", "Limpeza Interna da EB", "Organização Geral"].includes(i.INDICADOR));
      const isConforme = orgItems.length > 0 && orgItems.every(i => Number(i.VALOR) === 100);

      return {
        referencia: ebMapping[nro] || nro,
        telasPerc, caixasPerc, organizacao: isConforme ? "Conforme" : "Não Conforme"
      };
    });

    // -------------------------------------------------------------------------
    // MÓDULO: CHECKLIST GOTEJO
    // -------------------------------------------------------------------------
    const chkRaw = filteredData.filter(i => ["Pressão dos Lotes", "Regulagem das Pressões"].includes(i.OCORRENCIA));
    const camposGotejo = [...new Set(chkRaw.map(i => i.CAMPO).filter(Boolean))];

    const checklistGotejo = camposGotejo.map(nomeCampo => {
      const dfCampo = chkRaw.filter(i => i.CAMPO === nomeCampo);
      const listaLotes = [...new Set(dfCampo.map(i => i.LOTE).filter(Boolean))];

      const lotesProcessados = listaLotes.map(lote => {
        const dfLote = dfCampo.filter(i => i.LOTE === lote);
        const regMin = dfLote.find(i => i.OCORRENCIA === "Regulagem das Pressões" && i.INDICADOR === "Minima Regulada")?.VALOR;
        const norMin = dfLote.find(i => i.OCORRENCIA === "Pressão dos Lotes" && i.INDICADOR === "Minima")?.VALOR;
        const valMin = regMin !== undefined ? Number(regMin) : (norMin !== undefined ? Number(norMin) : null);
        const regMax = dfLote.find(i => i.OCORRENCIA === "Regulagem das Pressões" && i.INDICADOR === "Máxima Regulada")?.VALOR;
        const norMax = dfLote.find(i => i.OCORRENCIA === "Pressão dos Lotes" && i.INDICADOR === "Máxima")?.VALOR;
        const valMax = regMax !== undefined ? Number(regMax) : (norMax !== undefined ? Number(norMax) : null);
        return { lote, valMin, valMax };
      }).filter(l => l.valMin !== null || l.valMax !== null);

      const avgMin = lotesProcessados.length ? lotesProcessados.reduce((a, b) => a + (b.valMin || 0), 0) / lotesProcessados.length : 0;
      const avgMax = lotesProcessados.length ? lotesProcessados.reduce((a, b) => a + (b.valMax || 0), 0) / lotesProcessados.length : 0;
      return { campo: nomeCampo, lotes: lotesProcessados, avgMin, avgMax };
    });

    // -------------------------------------------------------------------------
    // MÓDULO: SEMENTE & PISOTEIO
    // -------------------------------------------------------------------------
    const sementeGemasV = getSum("Gemas Viáveis");
    const sementeGemasT = getSum("Total de Gemas");
    const sementeGemasPerc = sementeGemasT > 0 ? (sementeGemasV / sementeGemasT) * 100 : 0;
    const dadosPisoteio = filteredData.filter(i => i.OCORRENCIA === "Pisoteio");
    const metrosPisoteados = dadosPisoteio.filter(i => i.INDICADOR === "Metros Pisoteados").reduce((acc, curr) => acc + (Number(curr.VALOR) || 0), 0);
    const totalAvaliacoesPisoteio = new Set(dadosPisoteio.map(i => i.DATA_HORA)).size;
    const pisoteioCalculado = totalAvaliacoesPisoteio > 0 ? (metrosPisoteados / (totalAvaliacoesPisoteio * 40)) * 100 : 0;
    const infoGeral = filteredData[0] || {};
    const metaPisoteio = (infoGeral.TIPO_IRRIG || "").toUpperCase().includes("GOTEJO") ? 0 : 50;

    // -------------------------------------------------------------------------
    // MÓDULO: COMPOSTO, DRONE, ADUBAÇÃO (Mantidos Originais)
    // -------------------------------------------------------------------------
    const compostoRaw = filteredData.filter(i => i.OCORRENCIA === "Controle Composto" && i.INDICADOR.toLowerCase() === "toneladas por ha");
    const listaImplComposto = [...new Set(compostoRaw.map(i => i.IMPLEMENTO_COMPOSTO).filter(Boolean))];
    const compostoStats = listaImplComposto.map(nome => {
      const registros = compostoRaw.filter(i => i.IMPLEMENTO_COMPOSTO === nome);
      const mediaTon = registros.reduce((acc, curr) => acc + (Number(curr.VALOR) || 0), 0) / registros.length;
      return { nome, valor: mediaTon, variacao: ((mediaTon - 25.0) / 25.0) * 100 };
    });
    const geralTonComp = compostoRaw.length ? compostoRaw.reduce((acc, curr) => acc + (Number(curr.VALOR) || 0), 0) / compostoRaw.length : 0;
    const geralVarComp = geralTonComp > 0 ? ((geralTonComp - 25.0) / 25.0) * 100 : 0;

    const droneRaw = filteredData.filter(i => i.OCORRENCIA === "Avaliação Drone");
    const dronesUnicos = [...new Set(droneRaw.map(i => i.DRONES).filter(Boolean))];
    const calcVarColeta = (num) => {
      const coletas = droneRaw.filter(i => i.INDICADOR === `${num}ª Coleta`);
      const vazoes = droneRaw.filter(i => i.INDICADOR === "Vazão Recomendada");
      if (!coletas.length || !vazoes.length) return 0;
      const mediaColeta = coletas.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / coletas.length;
      const mediaVazao = vazoes.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / vazoes.length;
      return mediaVazao > 0 ? ((mediaColeta - mediaVazao) / mediaVazao) * 100 : 0;
    };
    const coletasDrone = [calcVarColeta(1), calcVarColeta(2), calcVarColeta(3), calcVarColeta(4)];
    const varGeralDrone = coletasDrone.reduce((a, b) => a + b, 0) / 4;

    const calcAdub = (oc_2l, oc_3l) => {
      const processar = (oc, tipo) => {
        const df = filteredData.filter(i => i.OCORRENCIA === oc);
        if (df.length === 0) return null;
        const dose = df.filter(i => i.INDICADOR === "Dose 50 m").reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / df.filter(i => i.INDICADOR === "Dose 50 m").length;
        const lados = ["Esquerdo", "Direito", ...(tipo === 3 ? ["Meio"] : [])];
        const m_lados = df.filter(i => lados.includes(i.INDICADOR)).reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / df.filter(i => lados.includes(i.INDICADOR)).length;
        return dose > 0 ? ((m_lados - dose) / dose) * 100 : 0;
      };
      return { has2L: processar(oc_2l, 2) !== null, has3L: processar(oc_3l, 3) !== null, variacao2L: processar(oc_2l, 2), variacao3L: processar(oc_3l, 3) };
    };

    // -------------------------------------------------------------------------
    // MÓDULO: PREPARO E PLANTIO MECANIZADO
    // -------------------------------------------------------------------------
    const arrPara = filteredData.filter(i => i.INDICADOR === "Paralelismo");
    const paraPerc = arrPara.length ? (arrPara.filter(i => i.VALOR >= 1.45 && i.VALOR <= 1.55).length / arrPara.length) * 100 : 0;
    const countFalhas = filteredData.filter(i => i.INDICADOR === "Total de Falhas").length;

    // -------------------------------------------------------------------------
    // MÓDULO: PLANTIO MANUAL (NOVO)
    // -------------------------------------------------------------------------
    // Atenção aos espaços exigidos na ocorrência!
    const pmGemasRaw = filteredData.filter(i => i.OCORRENCIA === "Avaliação de Gemas -  Manual");
    const pmFalhasRaw = filteredData.filter(i => i.OCORRENCIA === "Avaliação de Falha - Manual");
    const pmCobRaw = filteredData.filter(i => i.OCORRENCIA === "Avaliação de Coberta - Manual");

    // Gemas Viáveis (%)
    const pmSumViaveis = pmGemasRaw.filter(i => i.INDICADOR === "Gemas Viaveis por metro").reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
    const pmSumTotais = pmGemasRaw.filter(i => i.INDICADOR === "Gemas por metro").reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
    const pmGemasPerc = pmSumTotais > 0 ? (pmSumViaveis / pmSumTotais) * 100 : 0;

    // Falhas (%) - Fixado em zero se não houver dados
    const pmCountFalhas = pmFalhasRaw.filter(i => i.INDICADOR === "Total de Falhas").length;
    const pmSumFalhas = pmFalhasRaw.filter(i => i.INDICADOR === "Total de Falhas").reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
    const pmFalhaPerc = pmCountFalhas > 0 ? (pmSumFalhas / (pmCountFalhas * 60)) * 100 : 0;

    // Gemas/m e Cobertura (Médias)
    const pmArrViaveis = pmGemasRaw.filter(i => i.INDICADOR === "Gemas Viaveis por metro");
    const pmAvgViaveis = pmArrViaveis.length ? (pmSumViaveis / pmArrViaveis.length) : null;
    
    const pmArrCob = pmCobRaw.filter(i => i.INDICADOR === "Média Coberta");
    const pmAvgCob = pmArrCob.length ? (pmArrCob.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / pmArrCob.length) : null;

    // --- OBJETO DE RETORNO CONSOLIDADO ---
    return {
      cuc: { totais: { avaliados: cucCampos.reduce((a, b) => a + b.avaliados, 0), entupidos: cucCampos.reduce((a, b) => a + b.entupidos, 0) }, campos: cucCampos },
      semente: { gemasPerc: sementeGemasPerc, idade: getAvgRaw("Idade da Semente"), tamanhoMedio: getAvgOccRaw("Avaliação Rebolos"), pisoteioPerc: pisoteioCalculado, metaPisoteio, tipoIrrig: infoGeral.TIPO_IRRIG || "N/A", variedades: [...new Set(filteredData.filter(i => i.VARIEDADE).map(i => i.VARIEDADE))] },
      composto: { geralTon: geralTonComp, geralVar: geralVarComp, implementos: compostoStats },
      drone: { variacaoGeral: varGeralDrone, coletasMedia: coletasDrone, totalDrones: dronesUnicos.length },
      casaBomba: { ebs: ebStats },
      checklistGotejo,
      adubCob: calcAdub("Implemento 2 linhas - Cobertura", "Implemento 3 linhas - Cobertura"),
      adubSulc: calcAdub("Implemento 2 linhas - Sulcamento", "Implemento 3 linhas - Sulcamento"),
      preparo: { haste: getAvgRaw("Profundidade")?.toFixed(1), cana: getAvgRaw("Profundidade da Cana")?.toFixed(1), fita: getAvgRaw("Profundidade Fita Gotejadora")?.toFixed(1), para: paraPerc.toFixed(1) },
      plantio: { gemasPerc: getSum("Gemas por metro") > 0 ? ((getSum("Gemas Viaveis por metro") / getSum("Gemas por metro")) * 100).toFixed(1) : 0, falhaPerc: countFalhas > 0 ? ((getSum("Total de Falhas") / (countFalhas * 60)) * 100).toFixed(1) : 0, gemasMetro: getAvgRaw("Gemas Viaveis por metro")?.toFixed(1), cob: getAvgRaw("Coberta Média Plantio")?.toFixed(1) },
      
      // Novo Módulo Injetado [cite: 2026-02-11]
      plantioManual: { gemasPerc: pmGemasPerc.toFixed(1), falhaPerc: pmFalhaPerc.toFixed(1), gemasMetro: pmAvgViaveis?.toFixed(1) || 0, cob: pmAvgCob?.toFixed(1) || 0 },
      
      // Flags de visibilidade
      hasCuc: cucCampos.length > 0,
      hasSemente: filteredData.some(i => i.OCORRENCIA === "Avaliação de Gemas - Semente"),
      hasComposto: compostoStats.length > 0,
      hasDrone: droneRaw.length > 0,
      hasCasaBomba: filteredData.some(i => i.OCORRENCIA === "Captação"), 
      hasChecklistGotejo: checklistGotejo.length > 0,
      hasAdubCob: filteredData.some(i => i.OCORRENCIA.includes("Cobertura")),
      hasAdubSulc: filteredData.some(i => i.OCORRENCIA.includes("Sulcamento")),
      hasPreparo: filteredData.some(i => i.OCORRENCIA.includes("Sulcamento") || i.OCORRENCIA === "Fita de Gotejo"),
      hasPlantio: filteredData.some(i => i.OCORRENCIA === "Avaliação Rebolos e Gemas"),
      hasPlantioManual: pmGemasRaw.length > 0 || pmFalhasRaw.length > 0 || pmCobRaw.length > 0 // Gatilho do Manual [cite: 2026-02-11]
    };
  }, [filteredData]);

  // ===========================================================================
  // 3. RENDERIZAÇÃO PRINCIPAL E CONTROLE DE ORDEM [cite: 2026-02-11]
  // ===========================================================================

  // 🛠️ LISTA MESTRE: Basta mudar a ordem das strings abaixo para reordenar o dashboard inteiro!
  const ORDEM_DOS_CARDS = [
    'CUC',
    'CasaBomba',
    'ChecklistGotejo',
    'Preparo',
    'AdubSulc',
    'Composto',
    'Semente',
    'PlantioMecanizado',
    'PlantioManual',
    'Drone',
    'AdubCob',
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <QualyHeader onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={(p) => console.log(p)} />

      <main className="p-4 flex flex-col items-center">
        <DateSelector 
          date={selectedDate} onPrev={() => setDateIndex(di => di + 1)} onNext={() => setDateIndex(di => di - 1)} 
          disablePrev={dateIndex === availableDates.length - 1} disableNext={dateIndex === 0} 
        />

        <div className="w-full max-w-[340px] flex flex-col gap-4">
          
          {/* Loop Inteligente de Renderização */}
          {ORDEM_DOS_CARDS.map(cardNome => {
            switch(cardNome) {
              case 'CasaBomba': 
                return stats.hasCasaBomba && <CasaBombaCard key="cb" stats={stats.casaBomba} to="/qualyflow/casabomba" />;
              case 'ChecklistGotejo': 
                return stats.hasChecklistGotejo && <ChecklistGotejoCard key="chk" stats={stats.checklistGotejo} to="/qualyflow/checklist" />;
              case 'CUC': 
                return stats.hasCuc && <CucCard key="cuc" stats={stats.cuc} to="/qualyflow/cuc" />;
              case 'Semente': 
                return stats.hasSemente && <SementeCard key="sem" stats={stats.semente} to="/qualyflow/semente" />;
              case 'Composto': 
                return stats.hasComposto && <CompostoCard key="comp" stats={stats.composto} to="/qualyflow/composto" />;
              case 'Drone': 
                return stats.hasDrone && <DroneCard key="drn" stats={stats.drone} to="/qualyflow/drone" />;
              case 'AdubCob': 
                return stats.hasAdubCob && <AdubacaoCard key="adc" title="Adubação de Cobertura" stats={stats.adubCob} to="/qualyflow/adubcob" />;
              case 'AdubSulc': 
                return stats.hasAdubSulc && <AdubacaoCard key="ads" title="Adubação de Sulcamento" stats={stats.adubSulc} to="/qualyflow/adubsulc" />;
              case 'Preparo': 
                return stats.hasPreparo && (
                  <UnifiedModuleCard key="prep" sectionTitle="Preparo de Solo" to="/qualyflow/preparo">
                    <IndicatorRow title="Haste" value={stats.preparo.haste} unit="cm" color={QUALY_RULES.Haste.meta(stats.preparo.haste)} />
                    <IndicatorRow title="Cana" value={stats.preparo.cana} unit="cm" color={QUALY_RULES.Cana.meta(stats.preparo.cana)} />
                    <IndicatorRow title="Fita" value={stats.preparo.fita} unit="cm" color={QUALY_RULES.Fita.meta(stats.preparo.fita)} />
                    <IndicatorRow title="Paralelismo" value={stats.preparo.para} unit="%" color={QUALY_RULES.Paralelismo.meta(stats.preparo.para)} />
                  </UnifiedModuleCard>
                );
              case 'PlantioMecanizado': 
                return stats.hasPlantio && (
                  <UnifiedModuleCard key="plnt" sectionTitle="Plantio Mecanizado" to="/qualyflow/plantio">
                    <IndicatorRow title="Gemas Viáveis" value={stats.plantio.gemasPerc} unit="%" color={QUALY_RULES.GemasViáveis.meta(stats.plantio.gemasPerc)} />
                    <IndicatorRow title="Falha" value={stats.plantio.falhaPerc} unit="%" color={QUALY_RULES["Falha"].meta(stats.plantio.falhaPerc)} />
                    <IndicatorRow title="Gemas/m" value={stats.plantio.gemasMetro} unit="un" color={QUALY_RULES.GemasPorMetro.meta(stats.plantio.gemasMetro)} />
                    <IndicatorRow title="Cobertura" value={stats.plantio.cob} unit="cm" color={QUALY_RULES.Cobertura.meta(stats.plantio.cob)} />
                  </UnifiedModuleCard>
                );
              case 'PlantioManual': // O NOSSO NOVO CARD [cite: 2026-02-11]
                return stats.hasPlantioManual && (
                  <UnifiedModuleCard key="plntman" sectionTitle="Plantio Manual" to="/qualyflow/plantiomanual">
                    <IndicatorRow title="Gemas Viáveis" value={stats.plantioManual.gemasPerc} unit="%" color={QUALY_RULES.PlantioManual_Viaveis.meta(stats.plantioManual.gemasPerc)} />
                    <IndicatorRow title="Falha" value={stats.plantioManual.falhaPerc} unit="%" color={QUALY_RULES.PlantioManual_Falha.meta(stats.plantioManual.falhaPerc)} />
                    <IndicatorRow title="Gemas/m" value={stats.plantioManual.gemasMetro} unit="un" color={QUALY_RULES.PlantioManual_GemasMetro.meta(stats.plantioManual.gemasMetro)} />
                    <IndicatorRow title="Cobertura" value={stats.plantioManual.cob} unit="cm" color={QUALY_RULES.PlantioManual_Cobertura.meta(stats.plantioManual.cob)} />
                  </UnifiedModuleCard>
                );
              default: 
                return null;
            }
          })}
        </div>
      </main>
    </div>
  );
};

export default QualyFlowHome;