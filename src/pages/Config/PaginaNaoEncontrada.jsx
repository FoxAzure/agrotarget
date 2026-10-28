// ================================= DOCUMENTATION ------------------------------------------
// Script: PaginaNaoEncontrada
// Purpose: Redirecionar automaticamente rotas inexistentes para a pagina inicial.
// Route fallback: *
// Destination: /
// ==========================================================================================

import React from 'react';
import { Navigate } from 'react-router-dom';

const PaginaNaoEncontrada = () => {
  return <Navigate to="/" replace />;
};

export default PaginaNaoEncontrada;
