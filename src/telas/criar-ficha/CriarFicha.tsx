import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { Assinatura, Cobranca, Falha, FichaConcluida, MeioCobranca, PagamentoVenda, RascunhoFicha, Venda } from '../../../comum/contrato'
import { MENSAGENS } from '../../../comum/regras/operador'
import { MENSAGENS_PRODUTO } from '../../../comum/regras/produto'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao } from '../../componentes/botao/Botao'
import { Painel } from '../../componentes/painel/Painel'
import { useSemDestino } from '../../componentes/aviso/Aviso'
import { JanelaAssinatura } from '../../componentes/assinatura/JanelaAssinatura'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { dataCurta, reais } from '../../formatar'
import { agoraHorario, hojeISO, NOME_MEIO, ROTULO_SEM_IDENTIFICACAO, somarDias, type Meio } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import { ClienteFicha, clienteDaFicha } from './cliente/ClienteFicha'
import { ItensFicha, itemDoProduto } from './itens/ItensFicha'
import { PagamentoFicha } from './pagamento/PagamentoFicha'
import { JanelaCobranca } from './cobranca/JanelaCobranca'
import { JanelaServicoFicha } from './servicos/JanelaServicoFicha'
import { ServicosFicha } from './servicos/ServicosFicha'
import type { Maquininha, ModalidadeCartao, ServicoVenda } from '../../mock/base/tipos'
import { semIdentificacao, type EscolhaCliente, type FormaPagamento, type ItemFicha } from './tipos'
import './criar-ficha.css'

const nomeForma: Record<FormaPagamento, string> = { ...NOME_MEIO, misto: 'Misto', notinha: 'Notinha' }
const divisaoVazia = (): Record<Meio, number> => ({ dinheiro: 0, pix: 0, cartao: 0 })

/** O serviço da tela (formato da base) para o contrato, e de volta. */
const servicoParaContrato = (s: ServicoVenda) => ({ nome: s.nome, valor: s.valor, perdas: s.perdas?.quantidade ?? null, observacao: s.observacao ?? null })
const servicoDoContrato = (s: RascunhoFicha['servicos'][number]): ServicoVenda =>
  ({ nome: s.nome, valor: s.valor, ...(s.perdas ? { perdas: { quantidade: s.perdas } } : {}), ...(s.observacao ? { observacao: s.observacao } : {}) })

const mensagem = (r: Falha) => (r.causa === 'validacao' || r.causa === 'conflito' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)

/** Recusa da assinatura (pessoa, PIN): fica na janela, para tentar de novo. O resto é da venda e volta para a ficha. */
const daAssinatura = (r: Falha) => r.causa === 'permissao' || r.erro === MENSAGENS_PRODUTO.semAssinatura ||
  Object.values(MENSAGENS).some((m) => typeof m === 'string' && m === r.erro) || r.erro.startsWith('Muitas tentativas erradas')

/** Cliente e itens do rascunho, lidos de novo do cadastro. Produto desativado depois não volta. */
async function restaurar(r: RascunhoFicha, novo?: string) {
  let cliente: EscolhaCliente | null = r.semIdentificacao ? semIdentificacao : null
  if (r.clienteId) {
    const c = await api().obterCliente(r.clienteId)
    if (c.ok) cliente = clienteDaFicha(c.dado)
  }
  const pedidos = novo && !r.itens.some((i) => i.produtoId === novo) ? [...r.itens, { produtoId: novo, quantidade: 1 }] : r.itens
  const lidos = await Promise.all(pedidos.map(async (i) => {
    const p = await api().obterProduto(i.produtoId)
    return p.ok && p.dado.ativo ? [itemDoProduto(p.dado, i.quantidade)] : []
  }))
  return { cliente, itens: lidos.flat() }
}

const RASCUNHO_VAZIO: RascunhoFicha = {
  clienteId: null, semIdentificacao: false, itens: [], servicos: [], desconto: 0, forma: 'dinheiro', recebido: 0,
  vencimento: '', entrada: 0, meioEntrada: 'dinheiro', divisao: divisaoVazia(), recebidoMisto: 0,
  cartao: 'credito', maquininhaCartao: 'mercado-pago', pixNaMaquininha: true,
}

/** Venda no balcão: cliente, itens, pagamento e revisão na mesma tela. */
export function CriarFicha() {
  const navegar = useNavigate()
  const semDestino = useSemDestino()
  // Volta do "Cadastrar produto" da ficha com o id do produto criado.
  const { state } = useLocation()
  const novo = (state as { inserir?: string } | null)?.inserir
  // Abre vazia: a pessoa no balcão escolhe o cliente e bipa os itens.
  const [cliente, setCliente] = useState<EscolhaCliente | null>(null)
  const [itens, setItens] = useState<ItemFicha[]>([])
  // Serviços prestados (cópia, impressão…): valor, perdas e observação; sem estoque.
  const [servicos, setServicos] = useState<ServicoVenda[]>([])
  const [janelaServico, setJanelaServico] = useState<{ indice?: number } | null>(null)
  // O número nasce ao concluir (`R-VENDA-10`): aqui, só a hora em que abriu.
  const [abertura] = useState(() => agoraHorario())
  const [desconto, setDesconto] = useState(0)
  const [forma, setForma] = useState<FormaPagamento>('dinheiro')
  const [recebido, setRecebido] = useState(0)
  const [vencimento, setVencimento] = useState(() => somarDias(hojeISO(), 30))
  const [entrada, setEntrada] = useState(0)
  const [meioEntrada, setMeioEntrada] = useState<Meio>('dinheiro')
  const [divisaoPagamento, setDivisaoPagamento] = useState<Record<Meio, number>>(divisaoVazia())
  const [recebidoMisto, setRecebidoMisto] = useState(0)
  // Cartão e Pix: por onde a cobrança passa (Memoria.md, maquininhas).
  const [cartao, setCartao] = useState<ModalidadeCartao>('credito')
  const [maquininhaCartao, setMaquininhaCartao] = useState<Maquininha>('mercado-pago')
  const [pixNaMaquininha, setPixNaMaquininha] = useState(true)
  // Aberta enquanto a maquininha integrada cobra; a venda só é registrada quando aprova.
  const [cobrando, setCobrando] = useState<{ meio: MeioCobranca; referencia: string } | null>(null)
  // Cobrança aprovada que ainda não virou venda (até a 4.1b): concluir de novo não cobra outra vez.
  const [aprovada, setAprovada] = useState<Cobranca | null>(null)
  const [assinando, setAssinando] = useState(false)
  const [tentouConcluir, setTentouConcluir] = useState(false)
  const [erroConclusao, setErroConclusao] = useState('')
  // Muda ao limpar e ao retomar: cliente e itens voltam ao estado de ficha nova.
  const [versao, setVersao] = useState(0)
  // O rascunho só se grava depois de lido: senão a ficha vazia apagaria o guardado.
  const [carregado, setCarregado] = useState(false)
  const [erroRascunho, setErroRascunho] = useState('')
  const guardouAlgo = useRef(false)
  const areaFicha = useRef<HTMLDivElement>(null)

  // A venda em andamento volta como estava (`R-VENDA-05`), com o produto recém-cadastrado pela ficha.
  useEffect(() => {
    let vivo = true
    void (async () => {
      const r = await api().obterRascunhoFicha()
      if (!vivo) return
      if (!r.ok) setErroRascunho(`A ficha em andamento não pôde ser lida. ${mensagem(r)}`)
      const guardado = r.ok ? r.dado : null
      const lido = guardado ?? (novo ? RASCUNHO_VAZIO : null)
      if (lido) {
        const { cliente: c, itens: i } = await restaurar(lido, novo)
        if (!vivo) return
        setCliente(c)
        setItens(i)
        setServicos(lido.servicos.map(servicoDoContrato))
        setDesconto(lido.desconto)
        setForma(lido.forma)
        setRecebido(lido.recebido)
        if (lido.vencimento) setVencimento(lido.vencimento)
        setEntrada(lido.entrada)
        setMeioEntrada(lido.meioEntrada)
        setDivisaoPagamento(lido.divisao)
        setRecebidoMisto(lido.recebidoMisto)
        setCartao(lido.cartao)
        setMaquininhaCartao(lido.maquininhaCartao)
        setPixNaMaquininha(lido.pixNaMaquininha)
        setVersao((v) => v + 1)
      }
      guardouAlgo.current = Boolean(guardado)
      setCarregado(true)
    })()
    return () => { vivo = false }
  }, [novo])

  // Inserido uma vez: tira o id do histórico para voltar/recarregar não somar de novo.
  useEffect(() => {
    if (novo && carregado) navegar(rotas.criarFicha, { replace: true, state: null })
  }, [novo, carregado, navegar])

  // A venda em andamento se guarda sozinha, depois de uma pausa: sair pelo menu,
  // busca ou sino não a perde, e o Início oferece retomar. Ficha vazia não vira rascunho.
  useEffect(() => {
    if (!carregado) return
    const temAlgo = cliente !== null || itens.length > 0 || servicos.length > 0
    if (!temAlgo && !guardouAlgo.current) return
    const espera = setTimeout(() => {
      guardouAlgo.current = temAlgo
      void api().salvarRascunhoFicha(temAlgo ? {
        clienteId: cliente && cliente !== semIdentificacao ? cliente.id : null,
        semIdentificacao: cliente === semIdentificacao,
        itens: itens.map((item) => ({ produtoId: item.produtoId, quantidade: item.quantidade })),
        servicos: servicos.map(servicoParaContrato),
        desconto, forma, recebido, vencimento, entrada, meioEntrada, divisao: divisaoPagamento, recebidoMisto,
        cartao, maquininhaCartao, pixNaMaquininha,
      } : null).then((r) => setErroRascunho(r.ok ? '' : `A ficha em andamento não foi guardada. ${mensagem(r)}`))
    }, 400)
    return () => clearTimeout(espera)
  }, [carregado, cliente, itens, desconto, forma, recebido, vencimento, entrada, meioEntrada, divisaoPagamento, recebidoMisto, cartao, maquininhaCartao, pixNaMaquininha, servicos])

  const subtotal = itens.reduce((soma, i) => soma + i.preco * i.quantidade, 0) + servicos.reduce((soma, s) => soma + s.valor, 0)
  const temConteudo = itens.length > 0 || servicos.length > 0
  const total = Math.max(0, subtotal - desconto)
  const unidades = itens.reduce((soma, i) => soma + i.quantidade, 0)
  const faltaDinheiro = forma === 'dinheiro' && recebido < total
  const notinha = forma === 'notinha'
  // O saldo de quando o item entrou: o back confere de novo ao concluir (`R-VENDA-07`).
  const semSaldo = itens.find((i) => i.saldo < i.quantidade)
  const faltaEstoque = semSaldo ? { produtoId: semSaldo.produtoId, descricao: semSaldo.descricao, disponivel: semSaldo.saldo, solicitado: semSaldo.quantidade } : null
  const totalMisto = Object.values(divisaoPagamento).reduce((soma, valor) => soma + valor, 0)
  const meiosMistos = Object.values(divisaoPagamento).filter((valor) => valor > 0).length
  const problemaMisto = forma !== 'misto' ? null
    : totalMisto !== total ? `Distribua exatamente ${reais(total)} entre os meios de pagamento.`
    : meiosMistos < 2 ? 'Escolha pelo menos dois meios com valor maior que zero.'
    : divisaoPagamento.dinheiro > 0 && recebidoMisto < divisaoPagamento.dinheiro ? 'O dinheiro entregue é menor que a parte paga em espécie.'
    : null
  const entradaNaNotinha = notinha ? entrada : 0
  const problemaNotinha = !notinha ? null
    : !vencimento ? 'Informe o vencimento da notinha.'
    : vencimento < hojeISO() ? 'O vencimento não pode ser antes de hoje.'
    : entrada >= total && total > 0 ? 'A entrada cobre o total: escolha outra forma.' : null
  const problemaDesconto = temConteudo && desconto > subtotal ? `O desconto passa do subtotal (${reais(subtotal)}).` : null
  const problema = !cliente ? 'Falta escolher o cliente.'
    : !temConteudo ? 'Inclua ao menos um item ou serviço.'
    : faltaEstoque ? `Estoque insuficiente para ${faltaEstoque.descricao}: ${faltaEstoque.disponivel} disponível, ${faltaEstoque.solicitado} na ficha.`
    : problemaDesconto ?? problemaNotinha ?? problemaMisto ?? (faltaDinheiro ? 'O valor recebido é menor que o total.' : null)
  const erroCliente = tentouConcluir && !cliente ? problema ?? undefined : undefined
  const erroItens = tentouConcluir && cliente && !temConteudo ? problema ?? undefined : undefined
  const podeMostrar = tentouConcluir && cliente && temConteudo
  // O desconto errado aparece na hora: o total que a pessoa lê já estaria errado.
  const erroDesconto = problemaDesconto ?? undefined
  const erroVencimentoNotinha = notinha && (!vencimento || vencimento < hojeISO())
  const erroVencimento = podeMostrar && !problemaDesconto && erroVencimentoNotinha ? problemaNotinha ?? undefined : undefined
  const erroEntrada = podeMostrar && !problemaDesconto && notinha && !erroVencimentoNotinha && problemaNotinha ? problemaNotinha : undefined
  const erroRecebido = podeMostrar && !problemaDesconto && forma === 'dinheiro' && faltaDinheiro ? problema ?? undefined : undefined
  const erroMisto = podeMostrar && !problemaDesconto && problemaMisto ? problemaMisto : undefined
  const semCliente = cliente === semIdentificacao
  const nomeCliente = cliente === null ? 'Nenhum escolhido' : semCliente ? ROTULO_SEM_IDENTIFICACAO : cliente.nome
  const integrada = (forma === 'cartao' && maquininhaCartao === 'mercado-pago') || (forma === 'pix' && pixNaMaquininha)

  function escolherCliente(escolha: EscolhaCliente | null) {
    setCliente(escolha)
    setTentouConcluir(false)
    // Notinha exige alguém para cobrar depois.
    if (escolha === semIdentificacao && forma === 'notinha') setForma('dinheiro')
  }

  /** Começa outra venda: nada da anterior fica, nem cliente nem forma de pagamento. */
  function limpar() {
    setCliente(null)
    setItens([])
    setServicos([])
    setDesconto(0)
    setForma('dinheiro')
    setRecebido(0)
    setVencimento(somarDias(hojeISO(), 30))
    setEntrada(0)
    setMeioEntrada('dinheiro')
    setDivisaoPagamento(divisaoVazia())
    setRecebidoMisto(0)
    setCartao('credito')
    setMaquininhaCartao('mercado-pago')
    setPixNaMaquininha(true)
    setTentouConcluir(false)
    setErroConclusao('')
    setVersao((atual) => atual + 1)
  }

  /** A venda como o back recebe; `cobranca`: a aprovada na maquininha integrada. */
  function venda(cobranca: Cobranca | null): Venda {
    const pagamento: PagamentoVenda =
      forma === 'dinheiro' ? { forma, recebido }
      : forma === 'pix' ? { forma, maquininha: pixNaMaquininha ? 'mercado-pago' : null }
      : forma === 'cartao' ? { forma, cartao, maquininha: maquininhaCartao, bandeira: cobranca?.bandeira ?? null }
      : forma === 'misto' ? { forma, parcelas: (['dinheiro', 'pix', 'cartao'] as const).map((meio) => ({ meio, valor: divisaoPagamento[meio] })), recebido: divisaoPagamento.dinheiro > 0 ? recebidoMisto : null }
      : { forma, vencimento, entrada: entradaNaNotinha > 0 ? { meio: meioEntrada, valor: entradaNaNotinha } : null }
    return {
      clienteId: cliente && cliente !== semIdentificacao ? cliente.id : null,
      itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade, precoVisto: i.preco })),
      servicos: servicos.map(servicoParaContrato),
      desconto: Math.min(desconto, subtotal),
      pagamento,
    }
  }

  function concluir() {
    setErroConclusao('')
    if (problema) {
      setTentouConcluir(true)
      const seletor = !cliente ? '.cliente-ficha__busca input'
        : !temConteudo ? '.itens-ficha__leitor input'
        : faltaEstoque ? '.itens-ficha__tabela input'
        : problemaDesconto ? '.pagamento-ficha__desconto input'
        : notinha && vencimento && vencimento >= hojeISO() ? '.pagamento-ficha__notinha .campo:nth-child(2) input'
        : notinha ? '.pagamento-ficha__notinha input'
        : forma === 'misto' ? '.pagamento-ficha__misto input' : '.pagamento-ficha__dinheiro input'
      requestAnimationFrame(() => {
        const alvo = areaFicha.current?.querySelector<HTMLInputElement>(seletor)
        alvo?.scrollIntoView({ block: 'center' })
        alvo?.focus({ preventScroll: true })
      })
      return
    }
    if (!cliente) return
    // Maquininha integrada: a venda espera a cobrança aprovar (JanelaCobranca).
    if (integrada && !aprovada) {
      setCobrando({ meio: forma === 'pix' ? 'pix' : cartao, referencia: `ficha-${Date.now()}` })
      return
    }
    if (integrada && aprovada && aprovada.valor !== total) {
      setErroConclusao(`A cobrança de ${reais(aprovada.valor)} já foi aprovada na maquininha, e o total agora é ${reais(total)}. Volte a ficha para ${reais(aprovada.valor)} para registrar a venda.`)
      return
    }
    setAssinando(true)
  }

  /** O preço mudou (`R-VENDA-11`): a ficha passa a mostrar o do cadastro, e o saldo de agora. */
  async function atualizarItens() {
    const lidos = await Promise.all(itens.map((i) => api().obterProduto(i.produtoId)))
    setItens((atuais) => atuais.map((i) => {
      const r = lidos.find((x) => x.ok && x.dado.id === i.produtoId)
      return r?.ok ? { ...i, preco: r.dado.preco, saldo: r.dado.saldo } : i
    }))
  }

  async function registrar(quem: Assinatura) {
    const r = await api().concluirFicha(venda(aprovada && integrada ? aprovada : null), quem)
    if (r.ok || daAssinatura(r)) return r
    // A recusa é da venda: a janela fecha e o motivo aparece na ficha, já corrigida.
    setAssinando(false)
    setTentouConcluir(true)
    setErroConclusao(mensagem(r) + (aprovada && integrada ? ' A cobrança já foi aprovada: conclua de novo sem cobrar outra vez.' : ''))
    if (r.causa === 'conflito' || /Estoque insuficiente/.test(r.erro)) void atualizarItens()
    return r
  }

  function concluida(ficha: FichaConcluida) {
    setAssinando(false)
    setAprovada(null)
    navegar(rotas.ficha(ficha.id))
  }

  return (
    <Tela
      titulo="Nova ficha de venda"
      subtitulo={`Aberta hoje, ${abertura}`}
      acoesTitulo={
        <Botao icone="lixeira" onClick={limpar}>
          Limpar ficha
        </Botao>
      }
    >
      <div className="criar-ficha" ref={areaFicha}>
        <div className="criar-ficha__principal">
          <Painel>
            <ClienteFicha key={versao} cliente={cliente} aoEscolher={escolherCliente} erro={erroCliente} />
          </Painel>
          <Painel>
            <ItensFicha
              key={versao}
              itens={itens}
              aoMudar={(proximos) => { setItens(proximos); setTentouConcluir(false); setErroConclusao('') }}
              erroFalta={erroItens}
              erroEstoque={faltaEstoque ?? undefined}
              acaoExtra={<Botao icone="mais" onClick={() => setJanelaServico({})}>Inserir serviço</Botao>}
              semAvisoVazio={servicos.length > 0}
              depoisDaTabela={
                <ServicosFicha
                  servicos={servicos}
                  aoEditar={(indice) => setJanelaServico({ indice })}
                  aoRemover={(indice) => setServicos((atuais) => atuais.filter((_, i) => i !== indice))}
                />
              }
            />
          </Painel>
        </div>

        {/* Abaixo dos itens, não na lateral: no monitor da loja a coluna espremia a ficha. */}
        <div className="criar-ficha__fechamento">
          <Painel>
            <PagamentoFicha
              subtotal={subtotal}
              desconto={desconto}
              aoMudarDesconto={setDesconto}
              forma={forma}
              aoMudarForma={(proxima) => { setForma(proxima); setTentouConcluir(false) }}
              recebido={recebido}
              aoMudarRecebido={(proximo) => { setRecebido(proximo); setTentouConcluir(false) }}
              notinhaBloqueada={semCliente}
              vencimento={vencimento}
              aoMudarVencimento={(proximo) => { setVencimento(proximo); setTentouConcluir(false) }}
              entrada={entrada}
              aoMudarEntrada={(proxima) => { setEntrada(proxima); setTentouConcluir(false) }}
              meioEntrada={meioEntrada}
              aoMudarMeioEntrada={setMeioEntrada}
              divisaoPagamento={divisaoPagamento}
              aoMudarDivisao={(meio, valor) => { setDivisaoPagamento((atual) => ({ ...atual, [meio]: valor })); setTentouConcluir(false) }}
              recebidoMisto={recebidoMisto}
              aoMudarRecebidoMisto={(valor) => { setRecebidoMisto(valor); setTentouConcluir(false) }}
              erroMisto={erroMisto}
              erroRecebido={erroRecebido}
              erroVencimento={erroVencimento}
              erroEntrada={erroEntrada}
              erroDesconto={erroDesconto}
              cartao={cartao}
              aoMudarCartao={setCartao}
              maquininhaCartao={maquininhaCartao}
              aoMudarMaquininhaCartao={setMaquininhaCartao}
              pixNaMaquininha={pixNaMaquininha}
              aoMudarPixNaMaquininha={setPixNaMaquininha}
            />
          </Painel>

          <Painel titulo="Revisão">
            <dl className="criar-ficha__revisao">
              <div>
                <dt>Cliente</dt>
                <dd>{nomeCliente}</dd>
              </div>
              <div>
                <dt>Itens</dt>
                <dd>
                  {itens.length} {itens.length === 1 ? 'produto' : 'produtos'} · {unidades} {unidades === 1 ? 'unidade' : 'unidades'}
                  {servicos.length > 0 && ` · ${servicos.length} ${servicos.length === 1 ? 'serviço' : 'serviços'}`}
                </dd>
              </div>
              <div>
                <dt>Pagamento</dt>
                <dd>
                  {nomeForma[forma]}
                  {forma === 'dinheiro' && recebido > 0 && !faltaDinheiro && ` · troco ${reais(recebido - total)}`}
                  {forma === 'misto' && ` · ${(['dinheiro', 'pix', 'cartao'] as const).filter((meio) => divisaoPagamento[meio] > 0).map((meio) => `${NOME_MEIO[meio]} ${reais(divisaoPagamento[meio])}`).join(' + ') || 'distribua o total'}`}
                  {forma === 'misto' && divisaoPagamento.dinheiro > 0 && recebidoMisto >= divisaoPagamento.dinheiro && ` · troco ${reais(recebidoMisto - divisaoPagamento.dinheiro)}`}
                  {notinha && (entradaNaNotinha > 0 ? ` · ${reais(Math.max(0, total - entradaNaNotinha))} em aberto` : vencimento && ` · vence ${dataCurta(vencimento)}`)}
                </dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd className="criar-ficha__total">{reais(total)}</dd>
              </div>
            </dl>

            <Botao
              variante="primario"
              icone="check"
              className="criar-ficha__concluir"
              onClick={concluir}
            >
              Concluir ficha de venda
            </Botao>
            {erroConclusao && <p className="criar-ficha__erro" role="alert">{erroConclusao}</p>}
            {erroRascunho && <p className="criar-ficha__erro" role="alert">{erroRascunho}</p>}
            {/* Sem "Salvar rascunho": a ficha em andamento já se guarda sozinha. */}
            <div className="criar-ficha__secundarias">
              <Botao tamanho="pequeno" icone="imprimir" onClick={semDestino('comprovante')}>
                Comprovante
              </Botao>
            </div>
          </Painel>
        </div>
      </div>
      {janelaServico && (
        <JanelaServicoFicha
          atual={janelaServico.indice !== undefined ? servicos[janelaServico.indice] : undefined}
          aoFechar={() => setJanelaServico(null)}
          aoSalvar={(servico) => {
            const indice = janelaServico.indice
            setServicos((atuais) => (indice !== undefined ? atuais.map((s, i) => (i === indice ? servico : s)) : [...atuais, servico]))
            setJanelaServico(null)
            setTentouConcluir(false)
            setErroConclusao('')
          }}
        />
      )}
      {cobrando && (
        <JanelaCobranca
          valor={total}
          meio={cobrando.meio}
          referencia={cobrando.referencia}
          aoAprovar={(cobranca) => { setCobrando(null); setAprovada(cobranca); setAssinando(true) }}
          aoFechar={() => setCobrando(null)}
        />
      )}
      {assinando && (
        <JanelaAssinatura
          gesto={`Concluir a venda de ${reais(total)}`}
          rotuloConfirmar="Concluir venda"
          obrigatoria={aprovada && integrada ? 'A cobrança já foi aprovada: confirme quem vendeu para registrar.' : undefined}
          fazer={(quem) => registrar(quem)}
          aoConcluir={concluida}
          aoFechar={() => setAssinando(false)}
        />
      )}
    </Tela>
  )
}
