import { useEffect, useState } from 'react'
import type { PaginaCaixas } from '../../../comum/contrato'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { Botao } from '../../componentes/botao/Botao'
import { ComIcone } from '../../componentes/icone/Icone'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { Tabela } from '../../componentes/tabela/Tabela'
import { api } from '../../dados/api'
import { dataCurta, dataHora, reais } from '../../formatar'
import { mensagemDe, seloDoCaixa, ultimosSeteDias } from './comum'

const porPagina = 5

/** Os fechamentos dos últimos sete dias (`R-CAIXA-07`). `versao` muda a cada gesto no caixa: a lista relê. */
export function FechamentosRecentes({ versao, aoVer, aoConsultar }: { versao: number; aoVer: (id: string) => void; aoConsultar: () => void }) {
  const hoje = hojeEmSaoPaulo()
  const periodo = ultimosSeteDias(hoje)
  const [pagina, setPagina] = useState(1)
  const [carga, setCarga] = useState<{ dado: PaginaCaixas | null; erro: string | null }>({ dado: null, erro: null })
  useEffect(() => {
    let vivo = true
    void api().listarCaixas(periodo, true, pagina, porPagina).then((r) => {
      if (!vivo) return
      setCarga((atual) => (r.ok ? { dado: r.dado, erro: null } : { ...atual, erro: mensagemDe(r) }))
      if (r.ok && r.dado.pagina !== pagina) setPagina(r.dado.pagina)
    })
    return () => { vivo = false }
  }, [periodo.de, periodo.ate, pagina, versao])
  const lista = carga.dado?.caixas ?? []
  const total = carga.dado?.total ?? 0
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const inicio = ((carga.dado?.pagina ?? pagina) - 1) * porPagina

  return <section className="caixa-atual__recentes" aria-label="Fechamentos dos últimos sete dias">
    <div className="caixa-atual__historico-topo">
      <div><h3><ComIcone icone="historico">Fechamentos dos últimos 7 dias</ComIcone></h3><p>{dataCurta(periodo.de)} a {dataCurta(hoje)}</p></div>
      <Botao tamanho="pequeno" icone="calendario" onClick={aoConsultar}>Consultar outro período</Botao>
    </div>
    <Tabela larguraMinima={520}>
      <thead><tr><th>Fechamento</th><th className="celula--numero">Dinheiro contado</th><th>Situação</th><th className="celula--acoes">Ações</th></tr></thead>
      <tbody>
        {lista.map((caixa) => {
          const selo = seloDoCaixa(caixa)
          return <tr key={caixa.id}>
            <td><span className="celula-principal numero">{dataHora(caixa.fechamento!.registradoEm)}</span><span className="celula-secundaria">{caixa.fechamento!.operador}</span></td>
            <td className="celula--numero numero">{reais(caixa.fechamento!.contado)}</td>
            <td><SeloCompacto tom={selo.tom}>{selo.texto}</SeloCompacto></td>
            <td className="celula--acoes"><Botao tamanho="pequeno" aria-label={`Ver fechamento de ${dataHora(caixa.fechamento!.registradoEm)}`} onClick={() => aoVer(caixa.id)}>Ver</Botao></td>
          </tr>
        })}
        {carga.dado && !lista.length && <tr><td colSpan={4} className="caixa-atual__vazio">Nenhum fechamento nos últimos 7 dias.</td></tr>}
        {!carga.dado && <tr><td colSpan={4} className="caixa-atual__vazio">{carga.erro ?? 'Carregando os fechamentos…'}</td></tr>}
      </tbody>
    </Tabela>
    {paginas > 1 && <Paginacao pagina={carga.dado?.pagina ?? pagina} totalPaginas={paginas} aoMudar={setPagina} resumo={`Mostrando ${inicio + 1}–${Math.min(inicio + porPagina, total)} de ${total} fechamentos`} />}
  </section>
}
