import React, { useState, useMemo } from 'react';
import QualyHeader from '../../components/QualyFlow/QualyHeader';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Componentes de Visualização
import { UnifiedModuleCard, IndicatorRow } from '../../components/QualyFlow/IndicatorCard';
import PerdasMecCard from '../../components/QualyFlow/PerdasMecCard'; 
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
    const dates = [...new Set(qualyflowMockData.map(item => (item.DATA_HORA || "").substring(0, 10)))];
    return dates.sort((a, b) => b.split('/').reverse().join('-').localeCompare(a.split('/').reverse().join('-')));
  }, []);

  const [dateIndex, setDateIndex] = useState(0);
  const selectedDate = availableDates[dateIndex];

  const filteredData = useMemo(() => {
    return qualyflowMockData.filter(item => (item.DATA_HORA || "").startsWith(selectedDate));
  }, [selectedDate]);

  // ===========================================================================
  // 2. CENTRAL DE CÁLCULOS (O Cérebro Blindado da Umeko)
  // ===========================================================================
  
  const stats = useMemo(() => {
    
    // --- HELPERS INTERNOS BLINDADOS ---
    const getAvgRaw = (ind) => {
      const arr = filteredData.filter(i => (i.INDICADOR || "").trim() === ind);
      return arr.length ? (arr.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / arr.length) : null;
    };

    const getSum = (ind) => filteredData.filter(i => (i.INDICADOR || "").trim() === ind).reduce((a, b) => a + (Number(b.VALOR) || 0), 0);

    const getAvgOccRaw = (occ) => {
      const arr = filteredData.filter(i => (i.OCORRENCIA || "").trim() === occ);
      return arr.length ? (arr.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / arr.length) : null;
    };

    // -------------------------------------------------------------------------
    // MÓDULO: PERDAS MECANIZADAS
    // -------------------------------------------------------------------------
    const perdasRaw = filteredData.filter(i => {
      const oc = (i.OCORRENCIA || "").trim().toUpperCase();
      return ["AVALIAÇÃO DE PERDA MECANIZADA", "ARRANQUIO MECANIZADO", "PISOTEIO MECANIZADO"].includes(oc);
    });
    
    const sumIndPerdas = (df, ind) => df.filter(i => (i.INDICADOR || "").trim() === ind).reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
    const meanIndPerdas = (df, ind) => {
      const arr = df.filter(i => (i.INDICADOR || "").trim() === ind);
      return arr.length ? arr.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / arr.length : 0;
    };

    const ptPerdas = new Set(perdasRaw.filter(i => (i.OCORRENCIA || "").trim() === "Avaliação de Perda Mecanizada").map(i => i.DATA_HORA)).size;
    const colhUnicas = new Set(perdasRaw.map(i => (i.COLHEDORA || "").split("-")[0].trim()).filter(Boolean)).size;

    const pmKgMean = meanIndPerdas(perdasRaw, "Total Perda");
    const pmTchMean = meanIndPerdas(perdasRaw, "TCH");
    const kpiPerda = (pmTchMean + pmKgMean) > 0 ? (pmKgMean / (pmTchMean + pmKgMean)) * 100 : 0;

    const pmArr = sumIndPerdas(perdasRaw, "Total de tocos arrancados");
    const pmFix = sumIndPerdas(perdasRaw, "Total de tocos fixos");
    const kpiArranquio = pmFix > 0 ? (pmArr / pmFix) * 100 : 0;

    const pmSimples = perdasRaw.filter(i => (i.ESPACAMENTO || "").trim().toUpperCase() === "SIMPLES");
    const sumPisS = sumIndPerdas(pmSimples, "Pisoteio");
    const sumEspS = sumIndPerdas(pmSimples, "Espaçamento");
    const kpiPisoteioSimples = sumEspS > 0 ? (sumPisS / sumEspS) * 100 : 0;

    const pmDuplo = perdasRaw.filter(i => (i.ESPACAMENTO || "").trim().toUpperCase() === "DUPLO");
    const sumPisD = sumIndPerdas(pmDuplo, "Pisoteio");
    const sumEspD = sumIndPerdas(pmDuplo, "Espaçamento");
    const kpiPisoteioDuplo = sumEspD > 0 ? (sumPisD / sumEspD) * 100 : 0;

    const nomesCamposPerdas = [...new Set(perdasRaw.map(i => i.CAMPO).filter(Boolean))];
    const camposPerdas = nomesCamposPerdas.map(nome => {
      const dfCampo = perdasRaw.filter(i => i.CAMPO === nome);
      const irrig = (dfCampo[0]?.TIPO_IRRIG || "").toUpperCase();
      
      const cKg = meanIndPerdas(dfCampo, "Total Perda");
      const cTch = meanIndPerdas(dfCampo, "TCH");
      const cPerda = (cTch + cKg) > 0 ? (cKg / (cTch + cKg)) * 100 : 0;

      const cPis = sumIndPerdas(dfCampo, "Pisoteio");
      const cEsp = sumIndPerdas(dfCampo, "Espaçamento");
      const cPisoteio = cEsp > 0 ? (cPis / cEsp) * 100 : 0;

      const cArrArr = sumIndPerdas(dfCampo, "Total de tocos arrancados");
      const cArrFix = sumIndPerdas(dfCampo, "Total de tocos fixos");
      const cArranquio = cArrFix > 0 ? (cArrArr / cArrFix) * 100 : 0;

      const metaPisoteio = irrig.includes("GOTEJO") ? 2.0 : 50.0;

      return { nome, perdas: cPerda, pisoteio: cPisoteio, arranquio: cArranquio, metaPisoteio };
    });

    // -------------------------------------------------------------------------
    // MÓDULO: CUC (Christiansen Uniformity)
    // -------------------------------------------------------------------------
    const activeCucPairs = [...new Set(filteredData
      .filter(i => (i.OCORRENCIA || "").trim().toUpperCase().includes("CUC - GOTEJO"))
      .map(i => `${i.CODIGO_CAMPO}|${i.EXTRA1}`)
    )];

    const cucCampos = activeCucPairs.map(pair => {
      const [codigo, visita] = pair.split('|');
      const historicData = qualyflowMockData.filter(i => 
        Number(i.CODIGO_CAMPO) === parseInt(codigo) && Number(i.EXTRA1) === parseInt(visita) && (i.OCORRENCIA || "").trim().toUpperCase().includes("CUC - GOTEJO")
      );
      const emissoresLabels = Array.from({length: 12}, (_, i) => `${i+1}º Emissor`);
      const values = historicData.filter(i => emissoresLabels.includes((i.INDICADOR || "").trim())).map(i => Number(i.VALOR) || 0);
      const n = values.length;
      const mean = n > 0 ? values.reduce((a, b) => a + b, 0) / n : 0;
      let cucValue = 0;
      if (mean > 0) {
        const s_abs = values.reduce((acc, x) => acc + Math.abs(x - mean), 0);
        cucValue = (1 - (s_abs / (n * mean))) * 100;
      }
      const entupidos = historicData.filter(i => (i.INDICADOR || "").trim().toUpperCase() === "EMISSORES ENTUPIDOS").reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
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
    const ebRaw = filteredData.filter(i => 
      (i.NIVEL_1 || "").includes("CASAS DE BOMBAS") && 
      ["Captação", "Limpeza e Organização", "Fertirrigação"].includes((i.OCORRENCIA || "").trim())
    );
    const listaEbs = [...new Set(ebRaw.map(i => i.NRO_EB).filter(Boolean))];

    const ebStats = listaEbs.map(nro => {
      const dfEb = ebRaw.filter(i => i.NRO_EB === nro);
      const totalTelas = dfEb.find(i => (i.INDICADOR || "").trim() === "Total de Telas")?.VALOR || 0;
      const telasProblema = dfEb.filter(i => ["Tela Danificada", "Tela Faltando", "Tela Suja"].includes((i.INDICADOR || "").trim())).reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
      const telasPerc = totalTelas > 0 ? (1 - (telasProblema / totalTelas)) * 100 : 100;
      const totalCaixas = dfEb.find(i => ["Total de Caixas", "Total Caixas"].includes((i.INDICADOR || "").trim()))?.VALOR || 0;
      const caixasDanificadas = dfEb.find(i => (i.INDICADOR || "").trim() === "Caixas Danificadas")?.VALOR || 0;
      const caixasPerc = totalCaixas > 0 ? (1 - (caixasDanificadas / totalCaixas)) * 100 : 100;
      const orgItems = dfEb.filter(i => ["Limpeza Externa da EB", "Limpeza Interna da EB", "Organização Geral"].includes((i.INDICADOR || "").trim()));
      const isConforme = orgItems.length > 0 && orgItems.every(i => Number(i.VALOR) === 100);

      return {
        referencia: ebMapping[nro] || nro,
        telasPerc, caixasPerc, organizacao: isConforme ? "Conforme" : "Não Conforme"
      };
    });

    // -------------------------------------------------------------------------
    // MÓDULO: CHECKLIST GOTEJO
    // -------------------------------------------------------------------------
    const chkRaw = filteredData.filter(i => ["Pressão dos Lotes", "Regulagem das Pressões"].includes((i.OCORRENCIA || "").trim()));
    const camposGotejo = [...new Set(chkRaw.map(i => i.CAMPO).filter(Boolean))];

    const checklistGotejo = camposGotejo.map(nomeCampo => {
      const dfCampo = chkRaw.filter(i => i.CAMPO === nomeCampo);
      const listaLotes = [...new Set(dfCampo.map(i => i.LOTE).filter(Boolean))];

      const lotesProcessados = listaLotes.map(lote => {
        const dfLote = dfCampo.filter(i => String(i.LOTE || "").trim() === String(lote).trim());
        const regMin = dfLote.find(i => (i.OCORRENCIA || "").trim() === "Regulagem das Pressões" && (i.INDICADOR || "").trim() === "Minima Regulada")?.VALOR;
        const norMin = dfLote.find(i => (i.OCORRENCIA || "").trim() === "Pressão dos Lotes" && (i.INDICADOR || "").trim() === "Minima")?.VALOR;
        const valMin = regMin !== undefined ? Number(regMin) : (norMin !== undefined ? Number(norMin) : null);
        
        const regMax = dfLote.find(i => (i.OCORRENCIA || "").trim() === "Regulagem das Pressões" && (i.INDICADOR || "").trim() === "Máxima Regulada")?.VALOR;
        const norMax = dfLote.find(i => (i.OCORRENCIA || "").trim() === "Pressão dos Lotes" && (i.INDICADOR || "").trim() === "Máxima")?.VALOR;
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
    const dadosPisoteio = filteredData.filter(i => (i.OCORRENCIA || "").trim() === "Pisoteio");
    const metrosPisoteados = dadosPisoteio.filter(i => (i.INDICADOR || "").trim() === "Metros Pisoteados").reduce((acc, curr) => acc + (Number(curr.VALOR) || 0), 0);
    const totalAvaliacoesPisoteio = new Set(dadosPisoteio.map(i => i.DATA_HORA)).size;
    const pisoteioCalculado = totalAvaliacoesPisoteio > 0 ? (metrosPisoteados / (totalAvaliacoesPisoteio * 40)) * 100 : 0;
    const infoGeral = filteredData[0] || {};
    const metaPisoteio = (infoGeral.TIPO_IRRIG || "").toUpperCase().includes("GOTEJO") ? 0 : 50;

    // -------------------------------------------------------------------------
    // MÓDULO: COMPOSTO, DRONE, ADUBAÇÃO
    // -------------------------------------------------------------------------
    const compostoRaw = filteredData.filter(i => (i.OCORRENCIA || "").trim() === "Controle Composto" && (i.INDICADOR || "").trim().toLowerCase() === "toneladas por ha");
    const listaImplComposto = [...new Set(compostoRaw.map(i => i.IMPLEMENTO_COMPOSTO).filter(Boolean))];
    const compostoStats = listaImplComposto.map(nome => {
      const registros = compostoRaw.filter(i => i.IMPLEMENTO_COMPOSTO === nome);
      const mediaTon = registros.reduce((acc, curr) => acc + (Number(curr.VALOR) || 0), 0) / registros.length;
      return { nome, valor: mediaTon, variacao: ((mediaTon - 25.0) / 25.0) * 100 };
    });
    const geralTonComp = compostoRaw.length ? compostoRaw.reduce((acc, curr) => acc + (Number(curr.VALOR) || 0), 0) / compostoRaw.length : 0;
    const geralVarComp = geralTonComp > 0 ? ((geralTonComp - 25.0) / 25.0) * 100 : 0;

    const droneRaw = filteredData.filter(i => (i.OCORRENCIA || "").trim() === "Avaliação Drone");
    const dronesUnicos = [...new Set(droneRaw.map(i => i.DRONES).filter(Boolean))];
    const calcVarColeta = (num) => {
      const coletas = droneRaw.filter(i => (i.INDICADOR || "").trim() === `${num}ª Coleta`);
      const vazoes = droneRaw.filter(i => (i.INDICADOR || "").trim() === "Vazão Recomendada");
      if (!coletas.length || !vazoes.length) return 0;
      const mediaColeta = coletas.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / coletas.length;
      const mediaVazao = vazoes.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / vazoes.length;
      return mediaVazao > 0 ? ((mediaColeta - mediaVazao) / mediaVazao) * 100 : 0;
    };
    const coletasDrone = [calcVarColeta(1), calcVarColeta(2), calcVarColeta(3), calcVarColeta(4)];
    const varGeralDrone = coletasDrone.reduce((a, b) => a + b, 0) / 4;

    const calcAdub = (oc_2l, oc_3l) => {
      const processar = (oc, tipo) => {
        const df = filteredData.filter(i => (i.OCORRENCIA || "").trim().toUpperCase() === oc.toUpperCase());
        if (df.length === 0) return null;
        
        const doseList = df.filter(i => (i.INDICADOR || "").trim().toUpperCase() === "DOSE 50 M");
        const dose = doseList.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / (doseList.length || 1);
        
        const lados = ["ESQUERDO", "DIREITO", ...(tipo === 3 ? ["MEIO"] : [])];
        const m_ladosList = df.filter(i => lados.includes((i.INDICADOR || "").trim().toUpperCase()));
        const m_lados = m_ladosList.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / (m_ladosList.length || 1);
        
        return dose > 0 ? ((m_lados - dose) / dose) * 100 : 0;
      };
      return { has2L: processar(oc_2l, 2) !== null, has3L: processar(oc_3l, 3) !== null, variacao2L: processar(oc_2l, 2), variacao3L: processar(oc_3l, 3) };
    };

    // -------------------------------------------------------------------------
    // MÓDULO: PREPARO E PLANTIO MECANIZADO
    // -------------------------------------------------------------------------
    const arrPara = filteredData.filter(i => (i.INDICADOR || "").trim() === "Paralelismo");
    const paraPerc = arrPara.length ? (arrPara.filter(i => Number(i.VALOR) >= 1.45 && Number(i.VALOR) <= 1.55).length / arrPara.length) * 100 : 0;
    const countFalhas = filteredData.filter(i => (i.INDICADOR || "").trim() === "Total de Falhas").length;

    // -------------------------------------------------------------------------
    // MÓDULO: PLANTIO MANUAL
    // -------------------------------------------------------------------------
    const pmGemasRaw = filteredData.filter(i => {
      const oc = (i.OCORRENCIA || "").trim().toUpperCase();
      return oc.includes("AVALIAÇÃO DE GEMAS") && oc.includes("MANUAL");
    });
    const pmFalhasRaw = filteredData.filter(i => {
      const oc = (i.OCORRENCIA || "").trim().toUpperCase();
      return oc.includes("AVALIAÇÃO DE FALHA") && oc.includes("MANUAL");
    });
    const pmCobRaw = filteredData.filter(i => {
      const oc = (i.OCORRENCIA || "").trim().toUpperCase();
      return oc.includes("AVALIAÇÃO DE COBERTA") && oc.includes("MANUAL");
    });

    const pmSumViaveis = pmGemasRaw.filter(i => (i.INDICADOR || "").trim() === "Gemas Viaveis por metro").reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
    const pmSumTotais = pmGemasRaw.filter(i => (i.INDICADOR || "").trim() === "Gemas por metro").reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
    const pmGemasPerc = pmSumTotais > 0 ? (pmSumViaveis / pmSumTotais) * 100 : 0;

    const pmCountFalhas = pmFalhasRaw.filter(i => (i.INDICADOR || "").trim() === "Total de Falhas").length;
    const pmSumFalhas = pmFalhasRaw.filter(i => (i.INDICADOR || "").trim() === "Total de Falhas").reduce((a, b) => a + (Number(b.VALOR) || 0), 0);
    const pmFalhaPerc = pmCountFalhas > 0 ? (pmSumFalhas / (pmCountFalhas * 60)) * 100 : 0;

    const pmArrViaveis = pmGemasRaw.filter(i => (i.INDICADOR || "").trim() === "Gemas Viaveis por metro");
    const pmAvgViaveis = pmArrViaveis.length ? (pmSumViaveis / pmArrViaveis.length) : null;
    
    const pmArrCob = pmCobRaw.filter(i => (i.INDICADOR || "").trim() === "Média Coberta");
    const pmAvgCob = pmArrCob.length ? (pmArrCob.reduce((a, b) => a + (Number(b.VALOR) || 0), 0) / pmArrCob.length) : null;

    // --- OBJETO DE RETORNO CONSOLIDADO ---
    return {
      perdasMec: { totais: { pontos: ptPerdas, colhedoras: colhUnicas }, kpis: { perdas: kpiPerda, arranquio: kpiArranquio, pisoteioSimples: kpiPisoteioSimples, pisoteioDuplo: kpiPisoteioDuplo }, campos: camposPerdas },
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
      plantioManual: { gemasPerc: pmGemasPerc.toFixed(1), falhaPerc: pmFalhaPerc.toFixed(1), gemasMetro: pmAvgViaveis?.toFixed(1) || 0, cob: pmAvgCob?.toFixed(1) || 0 },
      
      // Flags de visibilidade (Com proteção extra)
      hasPerdasMec: perdasRaw.length > 0,
      hasCuc: cucCampos.length > 0,
      hasSemente: filteredData.some(i => (i.OCORRENCIA || "").trim() === "Avaliação de Gemas - Semente"),
      hasComposto: compostoStats.length > 0,
      hasDrone: droneRaw.length > 0,
      hasCasaBomba: filteredData.some(i => (i.NIVEL_1 || "").includes("CASAS DE BOMBAS") && (i.OCORRENCIA || "").trim() === "Captação"), 
      hasChecklistGotejo: checklistGotejo.length > 0,
      hasAdubCob: filteredData.some(i => (i.OCORRENCIA || "").trim().toUpperCase().includes("COBERTURA")),
      hasAdubSulc: filteredData.some(i => (i.OCORRENCIA || "").trim().toUpperCase().includes("SULCAMENTO")),
      hasPreparo: filteredData.some(i => {
        const oc = (i.OCORRENCIA || "").trim().toUpperCase();
        return oc.includes("SULCAMENTO") || oc === "FITA DE GOTEJO";
      }),
      hasPlantio: filteredData.some(i => (i.OCORRENCIA || "").trim() === "Avaliação Rebolos e Gemas"),
      hasPlantioManual: pmGemasRaw.length > 0 || pmFalhasRaw.length > 0 || pmCobRaw.length > 0 
    };
  }, [filteredData]);

  // ===========================================================================
  // 3. RENDERIZAÇÃO PRINCIPAL E CONTROLE DE ORDEM
  // ===========================================================================

  const ORDEM_DOS_CARDS = [
    'PerdasMec',
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
        <div className="w-full max-w-[400px]">
          <DateSelector 
            date={selectedDate} onPrev={() => setDateIndex(di => di + 1)} onNext={() => setDateIndex(di => di - 1)} 
            disablePrev={dateIndex === availableDates.length - 1} disableNext={dateIndex === 0} 

            availableDates={availableDates}
            onSelectDate={(novaData) => {
              const idx = availableDates.indexOf(novaData);
              if (idx !== -1) setDateIndex(idx);
            }}
          />
        </div>

        <div className="w-full max-w-[400px] flex flex-col gap-6 mt-4">
          
          {ORDEM_DOS_CARDS.map(cardNome => {
            switch(cardNome) {
              case 'PerdasMec': 
                return stats.hasPerdasMec && <PerdasMecCard key="pmec" stats={stats.perdasMec} selectedDate={selectedDate} />;
              case 'CasaBomba': 
                return stats.hasCasaBomba && <CasaBombaCard key="cb" stats={stats.casaBomba} to="/qualyflow/casabomba"  selectedDate={selectedDate} />;
              case 'ChecklistGotejo': 
                return stats.hasChecklistGotejo && <ChecklistGotejoCard key="chk" stats={stats.checklistGotejo} to="/qualyflow/checklist"  selectedDate={selectedDate} />;
              case 'CUC': 
                return stats.hasCuc && <CucCard key="cuc" stats={stats.cuc} to="/qualyflow/cuc" selectedDate={selectedDate} />;
              case 'Semente': 
                return stats.hasSemente && <SementeCard key="sem" stats={stats.semente} to="/qualyflow/semente"  selectedDate={selectedDate} />;
              case 'Composto': 
                return stats.hasComposto && <CompostoCard key="comp" stats={stats.composto} to="/qualyflow/composto" selectedDate={selectedDate} />;
              case 'Drone': 
                return stats.hasDrone && <DroneCard key="drn" stats={stats.drone} to="/qualyflow/drone" selectedDate={selectedDate}/>;
              case 'AdubCob': 
                return stats.hasAdubCob && <AdubacaoCard key="adc" title="Adubação de Cobertura" stats={stats.adubCob} to="/qualyflow/adubcob"  selectedDate={selectedDate} />;
              case 'AdubSulc': 
                return stats.hasAdubSulc && <AdubacaoCard key="ads" title="Adubação de Sulcamento" stats={stats.adubSulc} to="/qualyflow/adubsulc"  selectedDate={selectedDate} />;
              case 'Preparo': 
                return stats.hasPreparo && (
                  <UnifiedModuleCard key="prep" sectionTitle="Preparo de Solo" to="/qualyflow/preparo" selectedDate={selectedDate}>
                    <IndicatorRow title="Haste" value={stats.preparo.haste} unit="cm" color={QUALY_RULES.Haste.meta(stats.preparo.haste)} />
                    <IndicatorRow title="Cana" value={stats.preparo.cana} unit="cm" color={QUALY_RULES.Cana.meta(stats.preparo.cana)} />
                    <IndicatorRow title="Fita" value={stats.preparo.fita} unit="cm" color={QUALY_RULES.Fita.meta(stats.preparo.fita)} />
                    <IndicatorRow title="Paralelismo" value={stats.preparo.para} unit="%" color={QUALY_RULES.Paralelismo.meta(stats.preparo.para)} />
                  </UnifiedModuleCard>
                );
              case 'PlantioMecanizado': 
                return stats.hasPlantio && (
                  <UnifiedModuleCard key="plnt" sectionTitle="Plantio Mecanizado" to="/qualyflow/plantiomec">
                    <IndicatorRow title="Gemas Viáveis" value={stats.plantio.gemasPerc} unit="%" color={QUALY_RULES.GemasViáveis.meta(stats.plantio.gemasPerc)} />
                    <IndicatorRow title="Falha" value={stats.plantio.falhaPerc} unit="%" color={QUALY_RULES["Falha"].meta(stats.plantio.falhaPerc)} />
                    <IndicatorRow title="Gemas/m" value={stats.plantio.gemasMetro} unit="un" color={QUALY_RULES.GemasPorMetro.meta(stats.plantio.gemasMetro)} />
                    <IndicatorRow title="Cobertura" value={stats.plantio.cob} unit="cm" color={QUALY_RULES.Cobertura.meta(stats.plantio.cob)} />
                  </UnifiedModuleCard>
                );
              case 'PlantioManual': 
                return stats.hasPlantioManual && (
                  <UnifiedModuleCard key="plntman" sectionTitle="Plantio Manual" to="/qualyflow/plantioman">
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