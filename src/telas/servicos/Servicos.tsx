import { useState } from 'react'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Painel, CartaoResumo } from '../../componentes/painel/Painel'
import { Tabela } from '../../componentes/tabela/Tabela'
import { Filtros } from '../../componentes/filtros/Filtros'
import { dataCurta, reais } from '../../formatar'
import { hojeISO, intervaloAtual, intervaloMesPassado, perdasServicos, servicosFeitos, somarDias, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'
import './servicos.css'

type PeriodoPerdas = 'semana' | 'mes' | 'mes-passado'

/**
 * Os serviços feitos no período, cada um ligado à sua ficha (que pode ter
 * produtos junto), e as perdas anotadas, para a dona conferir. Serviço não tem
 * cadastro: o nome é o que foi digitado na ficha. Nada aqui mexe no estoque
 * (`2026-10-19`).
 */
export function Servicos() {
  const base = useEstadoDemonstracao()
  const abrirFicha = useAbrirFicha()
  const [periodo, setPeriodo] = useState<PeriodoPerdas>('mes')
  const hoje = hojeISO()
  const { de, ate } = periodo === 'semana' ? { de: somarDias(hoje, -6), ate: hoje } : periodo === 'mes' ? intervaloAtual('mes', hoje) : intervaloMesPassado(hoje)
  const feitos = servicosFeitos(base, de, ate)
  const totalFeitos = feitos.reduce((t, f) => t + f.valor, 0)
  const perdas = perdasServicos(base, de, ate)
  const totalPerdas = perdas.reduce((t, p) => t + p.quantidade, 0)

  return (
    <Tela
      titulo="Serviços"
      subtitulo="Serviços feitos e perdas anotadas nas fichas, para conferência."
      acoesTitulo={
        <Filtros
          rotulo="Período"
          valor={periodo}
          aoMudar={setPeriodo}
          opcoes={[{ valor: 'semana', rotulo: 'Últimos 7 dias' }, { valor: 'mes', rotulo: 'Este mês' }, { valor: 'mes-passado', rotulo: 'Mês passado' }]}
        />
      }
    >
      <Painel colado titulo="Serviços feitos">
        <div className="grade-resumo servicos__resumo">
          <CartaoResumo rotulo="Serviços no período" icone="imprimir" valor={reais(totalFeitos)} nota={`${feitos.length} ${feitos.length === 1 ? 'serviço' : 'serviços'}`} />
        </div>
        <Tabela larguraMinima={760}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Ficha</th>
              <th>Cliente</th>
              <th>Serviço</th>
              <th className="celula--numero">Perdas</th>
              <th className="celula--numero">Valor</th>
            </tr>
          </thead>
          <tbody>
            {feitos.map((f, i) => (
              <tr key={`${f.ficha}-${i}`}>
                <td className="numero">{dataCurta(f.data)} · {f.horario}</td>
                <td>
                  <button type="button" className="servicos__ficha" onClick={() => abrirFicha(f.ficha)}>#{f.ficha}</button>
                  {f.comProdutos && <span className="celula-secundaria">com produtos</span>}
                </td>
                <td>{f.cliente}</td>
                <td>
                  <span className="celula-principal">{f.servico}</span>
                  {f.observacao && <span className="celula-secundaria servicos__observacao" title={f.observacao}>{f.observacao}</span>}
                </td>
                <td className="celula--numero">{f.perdas || '—'}</td>
                <td className="celula--numero">{reais(f.valor)}</td>
              </tr>
            ))}
            {feitos.length === 0 && <tr><td colSpan={6} className="servicos__vazio">Nenhum serviço feito neste período.</td></tr>}
          </tbody>
        </Tabela>
      </Painel>

      <Painel colado titulo="Perdas anotadas nos serviços" className="servicos__perdas">
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
