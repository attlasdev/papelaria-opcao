import { useState } from 'react'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Painel, CartaoResumo } from '../../componentes/painel/Painel'
import { Tabela } from '../../componentes/tabela/Tabela'
import { Filtros } from '../../componentes/filtros/Filtros'
import { dataCurta } from '../../formatar'
import { hojeISO, intervaloAtual, intervaloMesPassado, perdasServicos, somarDias, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'
import './servicos.css'

type PeriodoPerdas = 'semana' | 'mes' | 'mes-passado'

/**
 * As perdas anotadas nos serviços das fichas, para a dona conferir. Serviço não
 * tem cadastro: o nome é o que foi digitado na ficha. Nada aqui mexe no estoque
 * (`2026-10-19`).
 */
export function Servicos() {
  const base = useEstadoDemonstracao()
  const abrirFicha = useAbrirFicha()
  const [periodo, setPeriodo] = useState<PeriodoPerdas>('mes')
  const hoje = hojeISO()
  const { de, ate } = periodo === 'semana' ? { de: somarDias(hoje, -6), ate: hoje } : periodo === 'mes' ? intervaloAtual('mes', hoje) : intervaloMesPassado(hoje)
  const perdas = perdasServicos(base, de, ate)
  const totalPerdas = perdas.reduce((t, p) => t + p.quantidade, 0)

  return (
    <Tela titulo="Serviços" subtitulo="Perdas anotadas nos serviços das fichas, para conferência.">
      <Painel
        colado
        titulo="Perdas anotadas nos serviços"
        acoes={
          <Filtros
            rotulo="Período das perdas"
            valor={periodo}
            aoMudar={setPeriodo}
            opcoes={[{ valor: 'semana', rotulo: 'Últimos 7 dias' }, { valor: 'mes', rotulo: 'Este mês' }, { valor: 'mes-passado', rotulo: 'Mês passado' }]}
          />
        }
      >
        <div className="grade-resumo servicos__resumo">
          <CartaoResumo rotulo="Perdas no período" icone="alerta" tom={totalPerdas ? 'atencao' : 'neutro'} valor={`${totalPerdas} ${totalPerdas === 1 ? 'unidade' : 'unidades'}`} nota={`${perdas.length} ${perdas.length === 1 ? 'anotação' : 'anotações'}`} />
        </div>
        <Tabela larguraMinima={640}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Ficha</th>
              <th>Serviço</th>
              <th className="celula--numero">Perdas</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            {perdas.map((p, i) => (
              <tr key={`${p.ficha}-${i}`}>
                <td className="numero">{dataCurta(p.data)} · {p.horario}</td>
                <td><button type="button" className="servicos__ficha" onClick={() => abrirFicha(p.ficha)}>#{p.ficha}</button></td>
                <td>{p.servico}</td>
                <td className="celula--numero">{p.quantidade}</td>
                <td><span className="servicos__observacao" title={p.observacao}>{p.observacao ?? '—'}</span></td>
              </tr>
            ))}
            {perdas.length === 0 && <tr><td colSpan={5} className="servicos__vazio">Nenhuma perda anotada neste período.</td></tr>}
          </tbody>
        </Tabela>
      </Painel>
    </Tela>
  )
}
