import type { ReactNode } from "react";
import { Icone, type NomeIcone } from "../icone/Icone";
import type { Tom } from "../selo/Selo";
import "./painel.css";

type Props = {
  titulo?: ReactNode;
  /** Controles no canto direito do topo do painel (filtros, legenda, ação). */
  acoes?: ReactNode;
  /** Sem espaçamento interno: para tabela que encosta nas bordas. */
  colado?: boolean;
  className?: string;
  children: ReactNode;
};

/** Bloco branco com borda: a unidade de agrupamento das telas. */
export function Painel({ titulo, acoes, colado, className, children }: Props) {
  const classes = ["painel", colado && "painel--colado", className]
    .filter(Boolean)
    .join(" ");
  return (
    <section className={classes}>
      {(titulo || acoes) && (
        <header className="painel__topo">
          {titulo && <h2 className="painel__titulo">{titulo}</h2>}
          {acoes && <div className="painel__acoes">{acoes}</div>}
        </header>
      )}
      <div className="painel__corpo">{children}</div>
    </section>
  );
}

type PropsResumo = {
  rotulo: string;
  valor: ReactNode;
  /** Linha pequena abaixo do valor. */
  nota?: ReactNode;
  /** Cor do valor: entrada (verde), saida (vermelho) ou padrão. */
  sinal?: "entrada" | "saida";
  /** Ícone grande à esquerda, sem fundo, na cor do tom. */
  icone?: NomeIcone;
  /** Cor do ícone. Padrão: neutro. */
  tom?: Tom;
  /** Comparação com o período anterior: seta e cor pela direção. */
  variacao?: { texto: string; direcao: "alta" | "baixa" };
};

/** Cartão de número-resumo: total do dia, itens com estoque baixo etc. */
export function CartaoResumo({
  rotulo,
  valor,
  nota,
  sinal,
  icone,
  tom = "neutro",
  variacao,
}: PropsResumo) {
  return (
    <div className="cartao-resumo-caixa">
      <div className="cartao-resumo">
        {icone && (
          <span
            className={`cartao-resumo__icone cartao-resumo__icone--${tom}`}
            aria-hidden
          >
            <Icone nome={icone} tamanho={36} />
          </span>
        )}
        <div className="cartao-resumo__info">
          <span className="cartao-resumo__rotulo">{rotulo}</span>
          <strong
            className={
              sinal
                ? `cartao-resumo__valor cartao-resumo__valor--${sinal}`
                : "cartao-resumo__valor"
            }
          >
            {valor}
          </strong>
          {(variacao || nota) && (
            <span className="cartao-resumo__nota">
              {variacao && (
                <span
                  className={`cartao-resumo__variacao cartao-resumo__variacao--${variacao.direcao}`}
                >
                  <Icone
                    nome={
                      variacao.direcao === "alta"
                        ? "tendencia-alta"
                        : "tendencia-baixa"
                    }
                    tamanho={14}
                  />
                  {variacao.texto}
                </span>
              )}
              {nota}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
