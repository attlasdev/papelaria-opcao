import { useEffect, useState } from 'react'
import type { Boleto, Falha, FiltroBoletos, ListaBoletos, SituacaoBoleto } from '../../../comum/contrato'
import { DIAS_AVISO_BOLETO } from '../../../comum/regras/boleto'
import { JanelaAssinatura } from '../../componentes/assinatura/JanelaAssinatura'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao, BotaoIcone } from '../../componentes/botao/Botao'
import { ModalMotivo } from '../../componentes/modal/ModalMotivo'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { SeloCompacto, type Tom } from '../../componentes/selo/Selo'
import { Icone } from '../../componentes/icone/Icone'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { dataCurta, dataHora, reais } from '../../formatar'
import { useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { JanelaBoleto } from './JanelaBoleto'
import './boletos.css'

const tom: Record<SituacaoBoleto, Tom> = { pago: 'ok', vencido: 'critico', vencendo: 'atencao', 'a-vencer': 'neutro' }
/** O fundo da linha acompanha o tom do selo, como no Estoque. */
const linha: Partial<Record<SituacaoBoleto, string>> = { vencido: 'linha--critica', vencendo: 'linha--atencao' }

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const mensagem = (r: Falha) => (r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)

/** "vence hoje", "vence amanhã", "vence em 3 dias", "venceu há 2 dias". */
function prazo(dias: number) {
  if (dias === 0) return 'vence hoje'
  if (dias === 1) return 'vence amanhã'
  if (dias > 1) return `vence em ${dias} dias`
  return dias === -1 ? 'venceu ontem' : `venceu há ${-dias} dias`
}

/** O dia de São Paulo de um instante, para a coluna "Cadastrado em". */
const diaDoInstante = (instante: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instante))

/**
 * Boletos da loja, só anotados (`2026-10-23`): descrição, valor, número do
 * arquivo físico e vencimento. O sino avisa os vencidos e os que vencem em até
 * `DIAS_AVISO_BOLETO` dias. Pagar não lança nada no Financeiro.
 */
export function Boletos() {
  const [filtro, setFiltro] = useState<FiltroBoletos>('a-pagar')
  const [busca, setBusca] = useState('')
  // undefined: fechada; null: novo boleto; um boleto: editar.
  const [janela, setJanela] = useState<Boleto | null | undefined>(undefined)
  // A busca vai ao back depois de uma pausa na digitação.
  const [buscaEnviada, setBuscaEnviada] = useState('')
  useEffect(() => {
    const espera = setTimeout(() => setBuscaEnviada(busca.trim()), 250)
    return () => clearTimeout(espera)
  }, [busca])
  const [carga, setCarga] = useState<{ dado: ListaBoletos | null; erro: string | null }>({ dado: null, erro: null })
  const [tentativa, setTentativa] = useState(0)
  const recarregar = () => setTentativa((n) => n + 1)
  // Fase 2: o sino ainda lê a base da demonstração; a lista relê quando ela muda.
  const base = useEstadoDemonstracao()
  useEffect(() => {
    let vivo = true
    void api().listarBoletos(filtro, buscaEnviada).then((r) => {
      if (!vivo) return
      setCarga((atual) => (r.ok ? { dado: r.dado, erro: null } : { ...atual, erro: mensagem(r) }))
    })
    return () => { vivo = false }
  }, [filtro, buscaEnviada, base, tentativa])

  const dado = carga.dado
  const resumo = dado?.resumo
  const lista = dado?.boletos ?? []
  const nenhum = dado?.contagem.todos === 0

  return (
    <Tela
      titulo="Boletos"
      subtitulo="Boletos da loja a pagar, com aviso no sino perto do vencimento."
      acaoCabecalho={
        <Botao variante="primario" icone="mais" onClick={() => setJanela(null)}>
          Cadastrar boleto
        </Botao>
      }
    >
      {carga.erro && (
        <div className="boletos__falha" role="alert">
          <span>{carga.erro}</span>
          <Botao tamanho="pequeno" onClick={recarregar}>Tentar de novo</Botao>
        </div>
      )}
      <div className="grade-resumo">
        <CartaoResumo rotulo="Vencidos" icone="alerta" tom={resumo?.vencidos.quantidade ? 'critico' : 'neutro'} valor={resumo ? reais(resumo.vencidos.valor) : '—'} nota={resumo ? plural(resumo.vencidos.quantidade, 'boleto', 'boletos') : undefined} />
        <CartaoResumo rotulo={`Vencem em até ${DIAS_AVISO_BOLETO} dias`} icone="relogio" tom={resumo?.vencendo.quantidade ? 'atencao' : 'neutro'} valor={resumo ? reais(resumo.vencendo.valor) : '—'} nota={resumo ? plural(resumo.vencendo.quantidade, 'boleto', 'boletos') : undefined} />
        <CartaoResumo rotulo="A pagar" icone="documento" valor={resumo ? reais(resumo.aPagar.valor) : '—'} nota={resumo ? plural(resumo.aPagar.quantidade, 'boleto em aberto', 'boletos em aberto') : undefined} />
      </div>

      <div className="boletos__filtros">
        <Filtros
          rotulo="Filtrar boletos"
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[
            { valor: 'a-pagar', rotulo: 'A pagar', contagem: dado?.contagem['a-pagar'] },
            { valor: 'vencidos', rotulo: 'Vencidos', contagem: dado?.contagem.vencidos },
            { valor: 'pagos', rotulo: 'Pagos', contagem: dado?.contagem.pagos },
            { valor: 'todos', rotulo: 'Todos', contagem: dado?.contagem.todos },
          ]}
        />
        <label className="boletos__busca">
          <Icone nome="busca" tamanho={18} />
          <input type="search" placeholder="Buscar por descrição ou número..." value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar boletos" />
        </label>
      </div>

      <Painel colado titulo="Boletos">
        <Tabela larguraMinima={860} className="boletos__tabela">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Descrição</th>
              <th>Vencimento</th>
              <th className="celula--numero">Valor</th>
              <th>Cadastrado em</th>
              <th className="celula--acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((boleto) => {
              const { situacao } = boleto
              const textoPrazo = prazo(boleto.dias)
              return (
                <tr key={boleto.id} className={linha[situacao]}>
                  <td className="codigo">{boleto.numero}</td>
                  <td><span className="boletos__descricao" title={boleto.descricao}>{boleto.descricao}</span></td>
                  <td>
                    <div className="boletos__vencimento">
                      <span className="numero">{dataCurta(boleto.vencimento)}</span>
                      {/* Pago: dia/mês, para caber no selo; a data inteira fica no balão. */}
                      <span title={boleto.pago ? `Pago em ${dataCurta(boleto.pago.dia)} por ${boleto.pago.operador}` : undefined}>
                        <SeloCompacto tom={tom[situacao]}>
                          {boleto.pago ? `Pago em ${dataCurta(boleto.pago.dia).slice(0, 5)}` : textoPrazo.charAt(0).toUpperCase() + textoPrazo.slice(1)}
                        </SeloCompacto>
                      </span>
                    </div>
                  </td>
                  <td className="celula--numero">{reais(boleto.valor)}</td>
                  <td className="numero" title={dataHora(boleto.cadastradoEm)}>{dataCurta(diaDoInstante(boleto.cadastradoEm))}</td>
                  <td className="celula--acoes">
                    <AcaoPagar boleto={boleto} destaque={situacao === 'vencido' || situacao === 'vencendo'} aoMudar={recarregar} />
                    <BotaoIcone icone="editar" rotulo={`Editar ${boleto.descricao}`} onClick={() => setJanela(boleto)} />
                  </td>
                </tr>
              )
            })}
            {dado && lista.length === 0 && (
              <tr><td colSpan={6} className="boletos__vazio">
                {nenhum ? 'Nenhum boleto anotado. Use "Cadastrar boleto" para começar.' : 'Nenhum boleto corresponde à busca ou ao filtro selecionado.'}
              </td></tr>
            )}
            {!dado && (
              <tr><td colSpan={6} className="boletos__vazio">
                {carga.erro ? 'Não foi possível carregar os boletos.' : 'Carregando os boletos…'}
              </td></tr>
            )}
          </tbody>
        </Tabela>
      </Painel>

      {janela !== undefined && <JanelaBoleto atual={janela ?? undefined} aoFechar={() => setJanela(undefined)} aoMudar={recarregar} />}
    </Tela>
  )
}

/**
 * Marcar como pago pede quem está fazendo; desfazer pede o motivo e depois
 * quem está fazendo (`R-BOLETO-03`). Só quem faz assina: não é gesto da dona.
 */
function AcaoPagar({ boleto, destaque, aoMudar }: { boleto: Boleto; destaque: boolean; aoMudar: () => void }) {
  const [passo, setPasso] = useState<'fechado' | 'motivo' | 'assinar'>('fechado')
  const [motivo, setMotivo] = useState('')
  const pago = Boolean(boleto.pago)
  const fechar = () => setPasso('fechado')
  return (
    <>
      <Botao
        tamanho="pequeno"
        variante={destaque ? 'primario' : 'secundario'}
        className="boletos__pagar"
        title={boleto.pago ? `Marcado por ${boleto.pago.operador}` : undefined}
        onClick={() => setPasso(pago ? 'motivo' : 'assinar')}
      >
        {pago ? 'Desfazer pagamento' : 'Marcar como pago'}
      </Botao>
      {passo === 'motivo' && (
        <ModalMotivo
          titulo="Desfazer pagamento"
          subtitulo={`Nº ${boleto.numero} · ${boleto.descricao} · ${reais(boleto.valor)}`}
          consequencias={<ul><li>O boleto volta a ficar em aberto, e o desfazer fica no histórico dele.</li><li>Nada muda no Financeiro: o boleto é só anotação.</li></ul>}
          textoConfirmar="Continuar"
          aoConfirmar={(texto) => { setMotivo(texto); setPasso('assinar') }}
          aoFechar={fechar}
        />
      )}
      {passo === 'assinar' && (
        <JanelaAssinatura
          gesto={`${pago ? 'Desfazer o pagamento do' : 'Marcar como pago o'} boleto Nº ${boleto.numero} · ${reais(boleto.valor)}`}
          rotuloConfirmar={pago ? 'Desfazer pagamento' : 'Marcar como pago'}
          fazer={(quem) => (pago ? api().desfazerPagamentoBoleto(boleto.id, motivo, quem) : api().marcarBoletoPago(boleto.id, quem))}
          aoConcluir={() => { fechar(); aoMudar() }}
          aoFechar={fechar}
        />
      )}
    </>
  )
}
