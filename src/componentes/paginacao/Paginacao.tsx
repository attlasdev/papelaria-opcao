import { Icone } from '../icone/Icone'
import './paginacao.css'

type Props = {
  /** Texto à esquerda: "Mostrando 5 de 148 clientes". */
  resumo: string
  pagina: number
  totalPaginas: number
  aoMudar: (pagina: number) => void
}

/** Rodapé de lista: resumo e páginas (1, 2, 3 … última). */
export function Paginacao({ resumo, pagina, totalPaginas, aoMudar }: Props) {
  if (totalPaginas <= 1) return <div className="paginacao"><span className="paginacao__resumo">{resumo}</span></div>
  const visiveis = totalPaginas <= 8
    ? Array.from({ length: totalPaginas }, (_, i) => i + 1)
    : [...new Set([1, pagina - 1, pagina, pagina + 1, totalPaginas])]
        .filter((p) => p >= 1 && p <= totalPaginas)
        .sort((a, b) => a - b)

  return (
    <nav className="paginacao" aria-label="Páginas">
      <span className="paginacao__resumo">{resumo}</span>
      <div className="paginacao__paginas">
        <button type="button" className="paginacao__passo" disabled={pagina === 1} onClick={() => aoMudar(pagina - 1)}>
          <Icone nome="chevron-esquerda" tamanho={16} /> Anterior
        </button>
        {visiveis.map((p, i) => (
          <span key={p} className="paginacao__grupo">
            {i > 0 && p - visiveis[i - 1] > 1 && <span className="paginacao__reticencias">…</span>}
            <button
              type="button"
              aria-current={p === pagina ? 'page' : undefined}
              className={p === pagina ? 'paginacao__numero paginacao__numero--atual' : 'paginacao__numero'}
              onClick={() => aoMudar(p)}
            >
              {p}
            </button>
          </span>
        ))}
        <button
          type="button"
          className="paginacao__passo"
          disabled={pagina === totalPaginas}
          onClick={() => aoMudar(pagina + 1)}
        >
          Próxima <Icone nome="chevron-direita" tamanho={16} />
        </button>
      </div>
    </nav>
  )
}
