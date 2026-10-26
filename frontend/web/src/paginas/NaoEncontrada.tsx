import { Link } from 'react-router';

export function NaoEncontrada() {
  return (
    <main>
      <h1>Página não encontrada</h1>
      <p>
        <Link to="/">Início</Link>
      </p>
    </main>
  );
}
