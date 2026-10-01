import { useState } from 'react'
import { Botao } from '../../componentes/botao/Botao'
import { ComIcone } from '../../componentes/icone/Icone'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { Tabela } from '../../componentes/tabela/Tabela'
import { dataCurta, dataHora, reais } from '../../formatar'
import { fechamentosCaixaNoPeriodo, hojeISO, resumoTurnoCaixa, somarDias, useEstadoDemonstracao } from '../../mock/estado-demonstracao'

const porPagina = 5

export function FechamentosRecentes({ aoVer, aoConsultar }: { aoVer: (id: string) => void; aoConsultar: () => void }) {
  const base = useEstadoDemonstracao()
  const hoje = hojeISO()
  const de = somarDias(hoje, -6)
  const lista = fechamentosCaixaNoPeriodo(base, de, hoje)
  const [pagina, setPagina] = useState(1)
  const paginas = Math.max(1, Math.ceil(lista.length / porPagina))
  const atual = Math.min(pagina, paginas)
  const inicio = (atual - 1) * porPagina

  return <section className="caixa-atual__recentes" aria-label="Fechamentos dos últimos sete dias">
    <div className="caixa-atual__historico-topo">
      <div><h3><ComIcone icone="historico">Fechamentos dos últimos 7 dias</ComIcone></h3><p>{dataCurta(de)} a {dataCurta(hoje)}</p></div>
      <Botao tamanho="pequeno" icone="calendario" onClick={aoConsultar}>Consultar outro período</Botao>
    </div>
    <Tabela larguraMinima={520}>
      <thead><tr><th>Fechamento</th><th className="celula--numero">Dinheiro contado</th><th>Situação</th><th className="celula--acoes">Ações</th></tr></thead>
      <tbody>
        {lista.slice(inicio, inicio + porPagina).map((turno) => {
          const resumo = resumoTurnoCaixa(base, turno)
          return <tr key={turno.id}>
            <td><span className="celula-principal numero">{dataHora(turno.fechadoEm!)}</span><span className="celula-secundaria">{turno.operadorFechamento}</span></td>
            <td className="celula--numero numero">{reais(turno.contadoFechamento ?? 0)}</td>
            <td><SeloCompacto tom={resumo.diferenca === 0 ? 'ok' : 'atencao'}>{resumo.diferenca === 0 ? 'Conferido' : 'Com diferença'}</SeloCompacto></td>
            <td className="celula--acoes"><Botao tamanho="pequeno" aria-label={`Ver fechamento de ${dataHora(turno.fechadoEm!)}`} onClick={() => aoVer(turno.id)}>Ver</Botao></td>
          </tr>
        })}
        {!lista.length && <tr><td colSpan={4} className="caixa-atual__vazio">Nenhum fechamento nos últimos 7 dias.</td></tr>}
      </tbody>
    </Tabela>
    {paginas > 1 && <Paginacao pagina={atual} totalPaginas={paginas} aoMudar={setPagina} resumo={`Mostrando ${inicio + 1}–${Math.min(inicio + porPagina, lista.length)} de ${lista.length} fechamentos`} />}
  </section>
}
