import { SeloBase } from './SeloBase';

/** Marca a forma de pagamento preferida; a estrela é decorativa e o texto é o sinal acessível. */
export function SeloPreferida() {
  return (
    <SeloBase classes={['selo-escopo', 'casa']} icone="estrela">
      Preferida
    </SeloBase>
  );
}
