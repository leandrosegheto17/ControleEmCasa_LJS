import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { clienteConsulta } from './clienteConsulta';
import { iniciarEnvioAutomatico } from './dados/fila/envioAutomatico';
import { iniciarInstalacao } from './pwa/instalacao';
import { registrarSW } from './pwa/registrarSW';
import { rotas } from './rotas';
import { ligarPerdaDeSessao } from './sessaoGlobal';
import './estilo/tokens.css';
import './estilo/global.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('elemento #raiz ausente no index.html');

iniciarInstalacao();
registrarSW();

const roteador = createBrowserRouter(rotas);
ligarPerdaDeSessao(clienteConsulta, roteador);
iniciarEnvioAutomatico();

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={clienteConsulta}>
      <RouterProvider router={roteador} />
    </QueryClientProvider>
  </StrictMode>,
);
