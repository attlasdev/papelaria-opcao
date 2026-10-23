import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao } from '../../componentes/botao/Botao'
import { Painel } from '../../componentes/painel/Painel'
import { useSemDestino } from '../../componentes/aviso/Aviso'
import { dataCurta, reais } from '../../formatar'
import {
  agoraHorario,
  concluirFicha,
  faltaEstoqueParaVenda,
  hojeISO,
  obterBase,
  NOME_MEIO,
  prepararRascunho,
  proximoNumeroFicha,
  ROTULO_SEM_IDENTIFICACAO,
  salvarRascunhoFicha,
  somarDias,
  useEstadoDemonstracao,
  type Base,
  type Meio,
  type Pagamento,
  type RascunhoFicha,
} from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import { funcoes } from '../../funcoes'
import { ClienteFicha } from './cliente/ClienteFicha'
import { ItensFicha } from './itens/ItensFicha'
import { PagamentoFicha } from './pagamento/PagamentoFicha'
import { JanelaCobranca } from './cobranca/JanelaCobranca'
import { JanelaServicoFicha } from './servicos/JanelaServicoFicha'
import { ServicosFicha } from './servicos/ServicosFicha'
import { rotuloPagamento } from '../../dados/pagamento'
import type { Cobranca, MeioCobranca } from '../../../comum/contrato'
import type { Maquininha, ModalidadeCartao, ServicoVenda } from '../../mock/base/tipos'
import { semIdentificacao, type EscolhaCliente, type FormaPagamento, type ItemFicha } from './tipos'
import './criar-ficha.css'

const nomeForma: Record<FormaPagamento, string> = { ...NOME_MEIO, misto: 'Misto', notinha: 'Notinha' }
const divisaoVazia = (): Record<Meio, number> => ({ dinheiro: 0, pix: 0, cartao: 0 })

/** Rascunho guarda só ids e quantidades; aqui volta a ser cliente e itens da tela. */
function clienteDoRascunho(base: Base, rascunho: RascunhoFicha | null): EscolhaCliente | null {
  if (!rascunho) return null
  if (rascunho.semIdentificacao) return semIdentificacao
  return base.clientes.find((c) => c.id === rascunho.clienteId) ?? null
}

/** `novo`: produto recém-cadastrado pela ficha, que já volta inserido com 1. */
function itensDoRascunho(base: Base, rascunho: RascunhoFicha | null, novo?: string): ItemFicha[] {
  const guardados = rascunho?.itens ?? []
  const comNovo = novo && !guardados.some((item) => item.codigo === novo) ? [...guardados, { codigo: novo, quantidade: 1 }] : guardados
  return comNovo.flatMap(({ codigo, quantidade }) => {
    // Produto desativado depois de guardar o rascunho não volta para a venda.
    const p = base.produtos.find((produto) => produto.codigo === codigo && !produto.inativo)
    return p ? [{ codigo, codigoBarras: p.codigoBarras ?? p.codigo, descricao: p.descricao, preco: p.preco, quantidade }] : []
  })
}

/** Venda no balcão: cliente, itens, pagamento e revisão na mesma tela. */
export function CriarFicha() {
  const navegar = useNavigate()
  const semDestino = useSemDestino()
  const base = useEstadoDemonstracao()
  const { rascunhoFicha } = base
  // Volta do "Cadastrar produto" da ficha com o código do produto criado.
  const { state } = useLocation()
  const novo = (state as { inserir?: string } | null)?.inserir
  // Abre vazia: a pessoa no balcão escolhe o cliente e bipa os itens.
  const [cliente, setCliente] = useState<EscolhaCliente | null>(() => clienteDoRascunho(base, rascunhoFicha))
  const [itens, setItens] = useState<ItemFicha[]>(() => itensDoRascunho(base, rascunhoFicha, novo))
  // Serviços prestados (cópia, impressão…): valor, perdas e observação; sem estoque.
  const [servicos, setServicos] = useState<ServicoVenda[]>(() => rascunhoFicha?.servicos ?? [])
  const [janelaServico, setJanelaServico] = useState<{ indice?: number } | null>(null)
  const [abertura] = useState(() => ({ numero: proximoNumeroFicha(base), horario: agoraHorario() }))
  const [desconto, setDesconto] = useState(rascunhoFicha?.desconto ?? 0)
  const [forma, setForma] = useState<FormaPagamento>(rascunhoFicha?.forma ?? 'dinheiro')
  const [recebido, setRecebido] = useState(rascunhoFicha?.recebido ?? 0)
  // Com a área de notas oculta, nenhuma venda prepara rascunho (nem um guardado de antes).
  const [prepararNota, setPrepararNota] = useState(funcoes.notasFiscais && (rascunhoFicha?.prepararNota ?? false))
  const [vencimento, setVencimento] = useState(rascunhoFicha?.vencimento ?? somarDias(hojeISO(), 30))
  const [entrada, setEntrada] = useState(rascunhoFicha?.entrada ?? 0)
  const [meioEntrada, setMeioEntrada] = useState<Meio>(rascunhoFicha?.meioEntrada ?? 'dinheiro')
  const [divisaoPagamento, setDivisaoPagamento] = useState<Record<Meio, number>>(rascunhoFicha?.divisaoPagamento ?? divisaoVazia())
  const [recebidoMisto, setRecebidoMisto] = useState(rascunhoFicha?.recebidoMisto ?? 0)
  // Cartão e Pix: por onde a cobrança passa (Memoria.md, maquininhas).
  const [cartao, setCartao] = useState<ModalidadeCartao>(rascunhoFicha?.cartao ?? 'credito')
  const [maquininhaCartao, setMaquininhaCartao] = useState<Maquininha>(rascunhoFicha?.maquininhaCartao ?? 'mercado-pago')
  const [pixNaMaquininha, setPixNaMaquininha] = useState(rascunhoFicha?.pixNaMaquininha ?? true)
  // Aberta enquanto a maquininha integrada cobra; a venda só é registrada quando aprova.
  const [cobrando, setCobrando] = useState<{ meio: MeioCobranca; referencia: string } | null>(null)
  const [tentouConcluir, setTentouConcluir] = useState(false)
  const [erroConclusao, setErroConclusao] = useState('')
  // Muda ao limpar: cliente e itens voltam ao estado de ficha nova.
  const [versao, setVersao] = useState(0)
  const areaFicha = useRef<HTMLDivElement>(null)

  // Inserido uma vez: tira o código do histórico para voltar/recarregar não somar de novo.
  useEffect(() => {
    if (novo) navegar(rotas.criarFicha, { replace: true, state: null })
  }, [novo, navegar])

  // A venda em andamento se guarda sozinha: sair pelo menu, busca ou sino não a
  // perde, e o Início oferece retomar. Ficha vazia não vira rascunho.
  useEffect(() => {
    const temAlgo = cliente !== null || itens.length > 0 || servicos.length > 0
    if (!temAlgo && !obterBase().rascunhoFicha) return
    salvarRascunhoFicha(temAlgo ? {
      clienteId: cliente && cliente !== semIdentificacao ? cliente.id : null,
      semIdentificacao: cliente === semIdentificacao,
      itens: itens.map((item) => ({ codigo: item.codigo, quantidade: item.quantidade })),
      servicos,
      desconto, forma, recebido, prepararNota, vencimento, entrada, meioEntrada, divisaoPagamento, recebidoMisto,
      cartao, maquininhaCartao, pixNaMaquininha,
    } : null)
  }, [cliente, itens, desconto, forma, recebido, prepararNota, vencimento, entrada, meioEntrada, divisaoPagamento, recebidoMisto, cartao, maquininhaCartao, pixNaMaquininha, servicos])

  const subtotal = itens.reduce((soma, i) => soma + i.preco * i.quantidade, 0) + servicos.reduce((soma, s) => soma + s.valor, 0)
  const temConteudo = itens.length > 0 || servicos.length > 0
  const total = Math.max(0, subtotal - desconto)
  const unidades = itens.reduce((soma, i) => soma + i.quantidade, 0)
  const faltaDinheiro = forma === 'dinheiro' && recebido < total
  const notinha = forma === 'notinha'
  const faltaEstoque = faltaEstoqueParaVenda(base, itens)
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
    setPrepararNota(false)
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
    salvarRascunhoFicha(null)
  }

  function concluir() {
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
    const integrada = (forma === 'cartao' && maquininhaCartao === 'mercado-pago') || (forma === 'pix' && pixNaMaquininha)
    if (integrada) {
      setCobrando({ meio: forma === 'pix' ? 'pix' : cartao, referencia: `ficha-${abertura.numero}-${Date.now()}` })
      return
    }
    registrarVenda()
  }

  /** Registra a venda. Com `cobranca`, o pagamento leva o que a maquininha devolveu. */
  function registrarVenda(cobranca?: Cobranca) {
    if (!cliente) return
    const data = hojeISO()
    const horario = agoraHorario()
    // Cartão e Pix dizem por onde passaram; o rótulo aparece na ficha e no Financeiro.
    const viaMaquininha = (meio: Meio): Partial<Pagamento> => {
      if (meio === 'cartao' && forma === 'cartao') {
        const bandeira = cobranca?.bandeira
        return { cartao, maquininha: maquininhaCartao, rotulo: rotuloPagamento({ meio, cartao, maquininha: maquininhaCartao, bandeira }), ...(cobranca ? { cobranca: { id: cobranca.id, bandeira, demonstracao: cobranca.demonstracao } } : {}) }
      }
      if (meio === 'pix' && forma === 'pix') {
        const maquininha = pixNaMaquininha ? 'mercado-pago' as const : undefined
        return { ...(maquininha ? { maquininha } : {}), rotulo: rotuloPagamento({ meio, maquininha }), ...(cobranca ? { cobranca: { id: cobranca.id, demonstracao: cobranca.demonstracao } } : {}) }
      }
      return {}
    }
    // O Financeiro lê estes pagamentos; nada é lançado à parte.
    const pagamentos: Pagamento[] = notinha
      ? entradaNaNotinha > 0 ? [{ data, horario, meio: meioEntrada, valor: entradaNaNotinha, entrada: true }] : []
      : forma === 'misto' ? (['dinheiro', 'pix', 'cartao'] as const)
        .filter((meio) => divisaoPagamento[meio] > 0)
        .map((meio) => ({ data, horario, meio, valor: divisaoPagamento[meio] }))
      : [{ data, horario, meio: forma as Meio, valor: total, ...viaMaquininha(forma as Meio) }]
    const numero = concluirFicha({
      clienteId: cliente === semIdentificacao ? null : cliente.id,
      ...(servicos.length ? { servicos } : {}),
      data,
      horario,
      itens: itens.map((item) => ({ codigo: item.codigo, descricao: item.descricao, quantidade: item.quantidade, preco: item.preco })),
      desconto: Math.min(desconto, subtotal),
      total,
      forma,
      pagamentos,
      vencimento: notinha ? vencimento : undefined,
    })
    if (!numero) {
      setErroConclusao('A venda não foi registrada. Confira o saldo dos produtos e os pagamentos.')
      setTentouConcluir(true)
      return
    }
    if (prepararNota) prepararRascunho(numero)
    navegar(prepararNota ? rotas.rascunhoNota(numero) : rotas.ficha(numero))
  }

  return (
    <Tela
      titulo="Nova ficha de venda"
      subtitulo={`Ficha #${abertura.numero} · aberta hoje, ${abertura.horario} · operador ${base.operador}`}
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

        <aside className="criar-ficha__lateral">
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

            {funcoes.notasFiscais && (
              <label className="criar-ficha__nota">
                <input type="checkbox" checked={prepararNota} onChange={(e) => setPrepararNota(e.target.checked)} />
                Preparar rascunho de nota fiscal para revisão
              </label>
            )}

            <Botao
              variante="primario"
              icone="check"
              className="criar-ficha__concluir"
              onClick={concluir}
            >
              Concluir ficha de venda
            </Botao>
            {erroConclusao && <p className="criar-ficha__erro" role="alert">{erroConclusao}</p>}
            {/* Sem "Salvar rascunho": a ficha em andamento já se guarda sozinha. */}
            <div className="criar-ficha__secundarias">
              <Botao tamanho="pequeno" icone="imprimir" onClick={semDestino('comprovante')}>
                Comprovante
              </Botao>
            </div>
          </Painel>
        </aside>
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
          aoAprovar={(cobranca) => { setCobrando(null); registrarVenda(cobranca) }}
          aoFechar={() => setCobrando(null)}
        />
      )}
    </Tela>
  )
}
