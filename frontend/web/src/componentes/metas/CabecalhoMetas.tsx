import { linkMetaNova } from '../../formatacao/linksApp';
import { BotaoLink } from '../base/BotaoLink';
import estilos from './CabecalhoMetas.module.css';

/** Cabeçalho da lista de metas: o título e o atalho para criar uma meta. */
export function CabecalhoMetas({ somenteLeitura }: { somenteLeitura?: boolean }) {
  return (
    <header className={estilos.cabecalho}>
      <h1 className={estilos.titulo}>Metas</h1>
      {somenteLeitura ? null : (
        <div className={estilos.acoes}>
          <BotaoLink para={linkMetaNova()} variante="secundario" icone="mais">
            Nova meta
          </BotaoLink>
        </div>
      )}
    </header>
  );
}
