import React from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';

// Importando o nosso espião de rolagem
import ScrollToTop from './components/Config/ScrollToTop';

// Importando as logos
import qualyflowLogo from './gallery/logo/qualyflow.png';
import coacenterLogo from './gallery/logo/coacenter.png';
import agroToolsLogo from './gallery/logo/agrotools.png'; // ➔ Logo do AgroTools adicionada!

// Importando a página principal do QualyFlow
import QualyFlowHome from './pages/QualyFlow/QualyFlowHome';
import PerdaMecDetail from './pages/QualyFlow/details/PerdaMecDetail';
import CucDetail from './pages/QualyFlow/details/CucDetail';
import PaginaNaoEncontrada from './pages/Config/PaginaNaoEncontrada';

// Importando Páginas do COA Center
import COACenterHome from './pages/COACenter/COACenterHome';
import ResumoDetail from './pages/COACenter/details/ResumoDetail';
import OciosoDetail from './pages/COACenter/details/OciosoDetail';
import DispoDetail from './pages/COACenter/details/DispoDetail';
import COAOperacoes from './pages/COACenter/COAOperacoes';
import IndeterDetail from './pages/COACenter/details/IndeterDetail';
//import Operacoes from './pages/COACenter/Operacoes';
//import Detalhe from './pages/COACenter/Detalhe';
//import MotorOcioso from './pages/COACenter/MotorOcioso';
//import COADataAudit from './pages/COACenter/COADataAudit';
//import Comboio from './pages/COACenter/Comboio';

// Importação das Páginas do AgroTools
import AgroToolsHome from './pages/AgroTools/AgroToolsHome';
import CucGotejoTools from './pages/AgroTools/details/CucGotejo';
import AdubacaoTools from './pages/AgroTools/details/Adubacao';
import PerdasColheitaTools from './pages/AgroTools/details/PerdasColheita';
import VinhacaTools from './pages/AgroTools/details/Vinhaca';
import CucPivotTools from './pages/AgroTools/details/CucPivot';


// ================================= HELPERS (COMPONENTES) ================================= //

const ModuleCard = ({ title, logoSrc, to }) => (
  <Link 
    to={to}
    className="group flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-agro-orange hover:shadow-md transition-all duration-300 cursor-pointer active:scale-95 outline-none"
  >
    <img 
      src={logoSrc} 
      alt={title} 
      className="w-16 h-16 object-contain mb-3 opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 drop-shadow-sm" 
    />
    <h2 className="text-[11px] font-black text-agro-green uppercase tracking-widest group-hover:text-agro-orange transition-colors text-center">
      {title}
    </h2>
  </Link>
);

// ================================= PÁGINAS (ROTAS) ================================= //

// Página 1: O Hub AgroTarget
function Hub() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 no-scrollbar selection:bg-agro-orange/20">
      
      <header className="w-full py-6 px-6 text-center bg-agro-green border-b-2 border-agro-orange sticky top-0 z-50 shadow-sm">
        <h1 className="text-4xl font-black tracking-tighter text-white drop-shadow-sm">
          Agro<span className="text-agro-orange">Target</span>
        </h1>
        <div className="flex items-center justify-center gap-3 mt-2">
          <div className="h-[1px] w-8 bg-white/30" />
          <p className="text-[9px] uppercase tracking-[0.5em] text-white/90 font-black">
            Inteligência Agrícola
          </p>
          <div className="h-[1px] w-8 bg-white/30" />
        </div>
      </header>

      <main className="flex-grow p-6 flex justify-center items-start pt-10">
        {/* ➔ Grid atualizado para lidar bem com os 3 cards (max-w-3xl e md:grid-cols-3) */}
        <div className="w-full max-w-3xl grid grid-cols-2 md:grid-cols-3 gap-4">
          <ModuleCard title="QualyFlow" logoSrc={qualyflowLogo} to="/qualyflow" />
          <ModuleCard title="COA Center" logoSrc={coacenterLogo} to="/coacenter" />
          <ModuleCard title="AgroTools" logoSrc={agroToolsLogo} to="/agrotools" />
        </div>
      </main>

      <footer className="w-full py-6 px-6 text-center border-t border-slate-200 bg-white">
        <div className="flex flex-col gap-1">
          <p className="text-[8px] text-slate-400 uppercase tracking-widest font-black">Desenvolvido Por</p>
          <p className="text-md font-black text-agro-green tracking-tight uppercase">
            Paulo <span className="text-agro-orange">Roberto</span>
          </p>
          <div className="flex items-center justify-center mt-2">
            <span className="text-[10px] font-mono font-bold text-slate-400">Versão 2.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ================================= EXECUTOR (ROUTER PRINCIPAL) ================================= //

function App() {
  return (
    <>
      <ScrollToTop />
      
      <Routes>
        <Route path="/" element={<Hub />} />
        
        <Route path="/qualyflow" element={<QualyFlowHome />} />
        <Route path="/qualyflow/perdasmec" element={<PerdaMecDetail />} />
        <Route path="/qualyflow/cuc" element={<CucDetail />} />

        <Route path="/coacenter" element={<COACenterHome />} />
        <Route path="/coacenter/resumo" element={<ResumoDetail />} />
        <Route path="/coacenter/ocioso" element={<OciosoDetail />} />
        <Route path="/coacenter/disponibilidade" element={<DispoDetail />} />
        <Route path="/coacenter/operacoes" element={<COAOperacoes />} />
        <Route path="/coacenter/indeterminado" element={<IndeterDetail />} />
        
        <Route path="/agrotools" element={<AgroToolsHome />} />
        <Route path="/agrotools/cuc" element={<CucGotejoTools />} />
        <Route path="/agrotools/adubacao" element={<AdubacaoTools />} />
        <Route path="/agrotools/perdas" element={<PerdasColheitaTools />} />
        <Route path="/agrotools/vinhaca" element={<VinhacaTools />} />
        <Route path="/agrotools/cucpivot" element={<CucPivotTools />} />

        {/* ROTA PADRÃO (CATCH-ALL) */}
        <Route path="*" element={<PaginaNaoEncontrada />} />
      </Routes>
    </>
  );
}

export default App;