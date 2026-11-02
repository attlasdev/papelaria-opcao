import { useEffect, useState } from 'react'
import type { Falha, ServicosDoPeriodo } from '../../../comum/contrato'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { Botao } from '../../componentes/botao/Botao'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Painel, CartaoResumo } from '../../componentes/painel/Painel'
import { Tabela } from '../../componentes/tabela/Tabela'
import { Filtros } from '../../componentes/filtros/Filtros'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { reais } from '../../formatar'
import { intervaloAtual, intervaloMesPassado, ROTULO_SEM_IDENTIFICACAO, somarDias, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'
import './servicos.css'

type PeriodoPerdas = 'semana' | 'mes' | 'mes-passado'

const mensagem = (r: Falha) => (r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)

/** "27/10/2026 · 14:03", no horário de São Paulo. */
const quando = (instante: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(instante)).replace(', ', ' · ')

/**
 * Os serviços feitos no período, cada um ligado à sua ficha (que pode ter
 * produtos junto), e as perdas anotadas, para a dona conferir. Serviço não tem
 * cadastro: o nome é o que foi digitado na ficha. Nada aqui mexe no estoque
 * (`2026-10-19`).
 */
export function Servicos() {
  const abrirFicha = useAbrirFicha()
  const [periodo, setPeriodo] = useState<PeriodoPerdas>('mes')
  const hoje = hojeEmSaoPaulo()
  const intervalo = periodo === 'semana' ? { de: somarDias(hoje, -6), ate: hoje } : periodo === 'mes' ? intervaloAtual('mes', hoje) : intervaloMesPassado(hoje)
  // O mês corrente vai só até hoje: o back não aceita período no futuro.
  const de = intervalo.de
  const ate = intervalo.ate > hoje ? hoje : intervalo.ate
  const [carga, setCarga] = useState<{ dado: ServicosDoPeriodo | null; erro: string | null }>({ dado: null, erro: null })
  const [tentativa, setTentativa] = useState(0)
  // Fase 2: a venda e o cancelamento gravam na base da demonstração; a tela relê quando ela muda.
  const base = useEstadoDemonstracao()
  useEffect(() => {
    let vivo = true
    void api().listarServicos({ de, ate }).then((r) => {
      if (vivo) setCarga((atual) => (r.ok ? { dado: r.dado, erro: null } : { ...atual, erro: mensagem(r) }))
    })
    return () => { vivo = false }
  }, [de, ate, base, tentativa])
  const feitos = carga.dado?.feitos ?? []
  const perdas = carga.dado?.perdas ?? []
  const resumo = carga.dado?.resumo
  const carregando = !carga.dado

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
      {carga.erro && (
        <div className="servicos__falha" role="alert">
          <span>{carga.erro}</span>
          <Botao tamanho="pequeno" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Botao>
        </div>
      )}
      <Painel colado titulo="Serviços feitos">
        <div className="grade-resumo servicos__resumo">
          <CartaoResumo rotulo="Serviços no período" icone="imprimir" valor={resumo ? reais(resumo.valorFeitos) : '—'} nota={resumo ? `${resumo.feitos} ${resumo.feitos === 1 ? 'serviço' : 'serviços'}` : undefined} />
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
              <tr key={`${f.fichaId}-${i}`}>
                <td className="numero">{quando(f.registradoEm)}</td>
                <td>
                  <button type="button" className="servicos__ficha" onClick={() => abrirFicha(f.fichaId)}>#{f.numero}</button>
                  {f.comProdutos && <span className="celula-secundaria">com produtos</span>}
                </td>
                <td>{f.cliente ?? ROTULO_SEM_IDENTIFICACAO}</td>
                <td>
                  <span className="celula-principal">{f.servico}</span>
                  {f.observacao && <span className="celula-secundaria servicos__observacao" title={f.observacao}>{f.observacao}</span>}
                </td>
                <td className="celula--numero">{f.perdas || '—'}</td>
                <td className="celula--numero">{reais(f.valor)}</td>
              </tr>
            ))}
            {feitos.length === 0 && <tr><td colSpan={6} className="servicos__vazio">{carregando ? (carga.erro ? 'Não foi possível carregar os serviços.' : 'Carregando os serviços…') : 'Nenhum serviço feito neste período.'}</td></tr>}
          </tbody>
        </Tabela>
      </Painel>

      <Painel colado titulo="Perdas anotadas nos serviços" className="servicos__perdas">
        <div className="grade-resumo servicos__resumo">
          <CartaoResumo
            rotulo="Perdas no período" icone="alerta" tom={resumo?.unidadesPerdidas ? 'atencao' : 'neutro'}
            valor={resumo ? `${resumo.unidadesPerdidas} ${resumo.unidadesPerdidas === 1 ? 'unidade' : 'unidades'}` : '—'}
            nota={resumo ? `${resumo.anotacoes} ${resumo.anotacoes === 1 ? 'anotação' : 'anotações'}` : undefined}
          />
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
              <tr key={`${p.fichaId}-${i}`}>
                <td className="numero">{quando(p.registradoEm)}</td>
                <td><button type="button" className="servicos__ficha" onClick={() => abrirFicha(p.fichaId)}>#{p.numero}</button></td>
                <td>{p.servico}</td>
                <td className="celula--numero">{p.quantidade}</td>
                <td><span className="servicos__observacao" title={p.observacao ?? undefined}>{p.observacao ?? '—'}</span></td>
              </tr>
            ))}
            {perdas.length === 0 && <tr><td colSpan={5} className="servicos__vazio">{carregando ? '—' : 'Nenhuma perda anotada neste período.'}</td></tr>}
          </tbody>
        </Tabela>
      </Painel>
    </Tela>
  )
}
