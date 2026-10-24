import { createRoot } from 'react-dom/client';
import { NOME_APP } from './app';

createRoot(document.getElementById('raiz')!).render(<h1>{NOME_APP}</h1>);
