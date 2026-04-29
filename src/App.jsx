import React from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';

// Importando as logos
import qualyflowLogo from './gallery/logo/qualyflow.png';
import coacenterLogo from './gallery/logo/coacenter.png';

// Importando a nova página modularizada do QualyFlow
import EmDesenvolvimento from './pages/QualyFlow/EmDesenvolvimento';
import QualyFlowHome from './pages/QualyFlow/QualyFlowHome';
import CucDetails from './pages/QualyFlow/CucDetails';
import PreparoDetails from './pages/QualyFlow/PreparoDetails';
import DroneDetails from './pages/QualyFlow/DroneDetails';
import CompostoDetails from './pages/QualyFlow/CompostoDetails';
import CBDetails from './pages/QualyFlow/CBDetails';
import CheckListDetails from './pages/QualyFlow/CheckListDetails';
import SementeDetails from './pages/QualyFlow/SementeDetails';
import AdubSulDetails from './pages/QualyFlow/AdubSulDetails';
import AdubCobDetails from './pages/QualyFlow/AdubCobDetails';

// Importando Páginas do COA Center
import COACenterHome from './pages/COACenter/COACenterHome';
import Operacoes from './pages/COACenter/Operacoes';
import Detalhe from './pages/COACenter/Detalhe';
import MotorOcioso from './pages/COACenter/MotorOcioso';
import COADataAudit from './pages/COACenter/COADataAudit';
import Comboio from './pages/COACenter/Comboio';

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

// Página 1: O seu Hub AgroTarget intacto
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
        <div className="w-full max-w-2xl grid grid-cols-2 gap-4">
          <ModuleCard title="QualyFlow" logoSrc={qualyflowLogo} to="/qualyflow" />
          <ModuleCard title="COA Center" logoSrc={coacenterLogo} to="/coacenter" />
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

// Página Rascunho da aplicação COA Center (Deixaremos aqui até separarmos em pasta igual fizemos com o QualyFlow)
function COACenterPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <img src={coacenterLogo} alt="COA Center" className="w-24 mb-6 drop-shadow-md" />
      <h1 className="text-3xl font-black text-agro-green uppercase tracking-widest mb-2">COA Center</h1>
      <p className="text-slate-500 mb-8 text-center max-w-md">Área isolada para as regras de negócio de Operações. Ferramenta de alta performance.</p>
      <button onClick={() => navigate('/')} className="px-6 py-3 bg-white border-2 border-agro-orange text-agro-orange font-bold uppercase text-xs rounded-lg hover:bg-agro-orange hover:text-white transition-colors active:scale-95">
        ← Voltar ao Hub
      </button>
    </div>
  );
}

// ================================= EXECUTOR (ROUTER PRINCIPAL) ================================= //

function App() {
  return (
    <Routes>
      <Route path="/" element={<Hub />} />
      
      {/* Aqui a mágica acontece: apontamos a rota para a sua nova página modularizada! */}
      <Route path="/qualyflow" element={<QualyFlowHome />} />
      <Route path="/qualyflow/cuc" element={<CucDetails />} />
      <Route path="/qualyflow/preparo" element={<PreparoDetails />} />
      <Route path="/qualyflow/drone" element={<DroneDetails />} />

      <Route path="/qualyflow/semente" element={<SementeDetails />} />
      <Route path="/qualyflow/adubcob" element={<AdubCobDetails />} />
      <Route path="/qualyflow/adubsulc" element={<AdubSulDetails />} />
      <Route path="/qualyflow/composto" element={<CompostoDetails />} />
      <Route path="/qualyflow/plantiomanual" element={<EmDesenvolvimento />} />
      <Route path="/qualyflow/plantio" element={<EmDesenvolvimento />} />
      <Route path="/qualyflow/checklist" element={<CheckListDetails />} />
      <Route path="/qualyflow/casabomba" element={<CBDetails />} />
      
      <Route path="/coacenter" element={<COACenterHome />} />
      <Route path="/coacenter/operacoes" element={<Operacoes />} />
      <Route path="/coacenter/detalhe" element={<Detalhe />} />
      <Route path='/coacenter/motorocioso' element={<MotorOcioso />} />
      <Route path='/coacenter/audit' element={<COADataAudit />} />
      <Route path='/coacenter/comboio' element={<Comboio />} />
    </Routes>
  );
}

export default App;