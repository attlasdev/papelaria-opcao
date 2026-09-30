import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao } from '../../componentes/botao/Botao'
import { Painel } from '../../componentes/painel/Painel'
import { useSemDestino } from '../../componentes/aviso/Aviso'
import { dataCurta, reais } from '../../formatar'
import {
  agoraHorario,
  concluirFicha,
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
import { ClienteFicha } from './cliente/ClienteFicha'
import { ItensFicha } from './itens/ItensFicha'
import { ModalProduto } from '../cadastrar-produto/CadastrarProduto'
import { PagamentoFicha } from './pagamento/PagamentoFicha'
import { semIdentificacao, type EscolhaCliente, type FormaPagamento, type ItemFicha } from './tipos'
import './criar-ficha.css'

const nomeForma: Record<FormaPagamento, string> = { ...NOME_MEIO, notinha: 'Notinha' }

/** Rascunho guarda só ids e quantidades; aqui volta a ser cliente e itens da tela. */
function clienteDoRascunho(base: Base, rascunho: RascunhoFicha | null): EscolhaCliente | null {
  if (!rascunho) return null
  if (rascunho.semIdentificacao) return semIdentificacao
  return base.clientes.find((c) => c.id === rascunho.clienteId) ?? null
}

function itensDoRascunho(base: Base, rascunho: RascunhoFicha | null): ItemFicha[] {
  return (rascunho?.itens ?? []).flatMap(({ codigo, quantidade }) => {
    // Produto desativado depois de guardar o rascunho não volta para a venda.
    const p = base.produtos.find((produto) => produto.codigo === codigo && !produto.inativo)
    return p ? [{ codigo, codigoBarras: p.codigoBarras ?? p.codigo, descricao: p.descricao, estoque: `${p.saldo} ${p.unidade}`, preco: p.preco, quantidade }] : []
  })
}

/** Venda no balcão: cliente, itens, pagamento e revisão na mesma tela. */
export function CriarFicha() {
  const navegar = useNavigate()
  const semDestino = useSemDestino()
  const base = useEstadoDemonstracao()
  const { rascunhoFicha } = base
  // Abre vazia: a pessoa no balcão escolhe o cliente e bipa os itens.
  const [cliente, setCliente] = useState<EscolhaCliente | null>(() => clienteDoRascunho(base, rascunhoFicha))
  const [itens, setItens] = useState<ItemFicha[]>(() => itensDoRascunho(base, rascunhoFicha))
  const [abertura] = useState(() => ({ numero: proximoNumeroFicha(base), horario: agoraHorario() }))
  const [desconto, setDesconto] = useState(rascunhoFicha?.desconto ?? 0)
  const [forma, setForma] = useState<FormaPagamento>(rascunhoFicha?.forma ?? 'dinheiro')
  const [recebido, setRecebido] = useState(rascunhoFicha?.recebido ?? 0)
  const [prepararNota, setPrepararNota] = useState(rascunhoFicha?.prepararNota ?? false)
  const [vencimento, setVencimento] = useState(rascunhoFicha?.vencimento ?? somarDias(hojeISO(), 30))
  const [entrada, setEntrada] = useState(rascunhoFicha?.entrada ?? 0)
  const [meioEntrada, setMeioEntrada] = useState<Meio>(rascunhoFicha?.meioEntrada ?? 'dinheiro')
  const [tentouConcluir, setTentouConcluir] = useState(false)
  const [codigoProdutoNovo, setCodigoProdutoNovo] = useState<string | null>(null)
  // Muda ao limpar: cliente e itens voltam ao estado de ficha nova.
  const [versao, setVersao] = useState(0)
  const areaFicha = useRef<HTMLDivElement>(null)

  // A venda em andamento se guarda sozinha: sair pelo menu, busca ou sino não a
  // perde, e o Início oferece retomar. Ficha vazia não vira rascunho.
  useEffect(() => {
    const temAlgo = cliente !== null || itens.length > 0
    if (!temAlgo && !obterBase().rascunhoFicha) return
    salvarRascunhoFicha(temAlgo ? {
      clienteId: cliente && cliente !== semIdentificacao ? cliente.id : null,
      semIdentificacao: cliente === semIdentificacao,
      itens: itens.map((item) => ({ codigo: item.codigo, quantidade: item.quantidade })),
      desconto, forma, recebido, prepararNota, vencimento, entrada, meioEntrada,
    } : null)
  }, [cliente, itens, desconto, forma, recebido, prepararNota, vencimento, entrada, meioEntrada])

  const subtotal = itens.reduce((soma, i) => soma + i.preco * i.quantidade, 0)
  const total = Math.max(0, subtotal - desconto)
  const unidades = itens.reduce((soma, i) => soma + i.quantidade, 0)
  const faltaDinheiro = forma === 'dinheiro' && recebido < total
  const notinha = forma === 'notinha'
  const entradaNaNotinha = notinha ? entrada : 0
  const problemaNotinha = !notinha ? null
    : !vencimento ? 'Informe o vencimento da notinha.'
    : vencimento < hojeISO() ? 'O vencimento não pode ser antes de hoje.'
    : entrada >= total && total > 0 ? 'A entrada cobre o total: escolha outra forma.' : null
  const problemaDesconto = itens.length > 0 && desconto > subtotal ? `O desconto passa do subtotal (${reais(subtotal)}).` : null
  const problema = !cliente ? 'Falta escolher o cliente.'
    : itens.length === 0 ? 'Inclua ao menos um item.'
    : problemaDesconto ?? problemaNotinha ?? (faltaDinheiro ? 'O valor recebido é menor que o total.' : null)
  const erroCliente = tentouConcluir && !cliente ? problema ?? undefined : undefined
  const erroItens = tentouConcluir && cliente && itens.length === 0 ? problema ?? undefined : undefined
  const podeMostrar = tentouConcluir && cliente && itens.length > 0
  // O desconto errado aparece na hora: o total que a pessoa lê já estaria errado.
  const erroDesconto = problemaDesconto ?? undefined
  const erroVencimentoNotinha = notinha && (!vencimento || vencimento < hojeISO())
  const erroVencimento = podeMostrar && !problemaDesconto && erroVencimentoNotinha ? problemaNotinha ?? undefined : undefined
  const erroEntrada = podeMostrar && !problemaDesconto && notinha && !erroVencimentoNotinha && problemaNotinha ? problemaNotinha : undefined
  const erroRecebido = podeMostrar && !problemaDesconto && !notinha && faltaDinheiro ? problema ?? undefined : undefined
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
    setDesconto(0)
    setForma('dinheiro')
    setRecebido(0)
    setPrepararNota(false)
    setVencimento(somarDias(hojeISO(), 30))
    setEntrada(0)
    setMeioEntrada('dinheiro')
    setTentouConcluir(false)
    setVersao((atual) => atual + 1)
    salvarRascunhoFicha(null)
  }

  function concluir() {
    if (problema) {
      setTentouConcluir(true)
      const seletor = !cliente ? '.cliente-ficha__busca input'
        : itens.length === 0 ? '.itens-ficha__leitor input'
        : problemaDesconto ? '.pagamento-ficha__desconto input'
        : notinha && vencimento && vencimento >= hojeISO() ? '.pagamento-ficha__notinha .campo:nth-child(2) input'
        : notinha ? '.pagamento-ficha__notinha input' : '.pagamento-ficha__dinheiro input'
      requestAnimationFrame(() => {
        const alvo = areaFicha.current?.querySelector<HTMLInputElement>(seletor)
        alvo?.scrollIntoView({ block: 'center' })
        alvo?.focus({ preventScroll: true })
      })
      return
    }
    if (!cliente) return
    const data = hojeISO()
    const horario = agoraHorario()
    // O Financeiro lê estes pagamentos; nada é lançado à parte.
    const pagamentos: Pagamento[] = notinha
      ? entradaNaNotinha > 0 ? [{ data, horario, meio: meioEntrada, valor: entradaNaNotinha, entrada: true }] : []
      : [{ data, horario, meio: forma as Meio, valor: total }]
    const numero = concluirFicha({
      clienteId: cliente === semIdentificacao ? null : cliente.id,
      data,
      horario,
      itens: itens.map((item) => ({ codigo: item.codigo, descricao: item.descricao, quantidade: item.quantidade, preco: item.preco })),
      desconto: Math.min(desconto, subtotal),
      total,
      forma,
      pagamentos,
      vencimento: notinha ? vencimento : undefined,
    })
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
            <ItensFicha key={versao} itens={itens} aoMudar={(proximos) => { setItens(proximos); setTentouConcluir(false) }} aoCadastrarProduto={(codigo) => setCodigoProdutoNovo(codigo ?? '')} erroFalta={erroItens} />
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
              erroRecebido={erroRecebido}
              erroVencimento={erroVencimento}
              erroEntrada={erroEntrada}
              erroDesconto={erroDesconto}
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
                </dd>
              </div>
              <div>
                <dt>Pagamento</dt>
                <dd>
                  {nomeForma[forma]}
                  {forma === 'dinheiro' && recebido > 0 && !faltaDinheiro && ` · troco ${reais(recebido - total)}`}
                  {notinha && (entradaNaNotinha > 0 ? ` · ${reais(Math.max(0, total - entradaNaNotinha))} em aberto` : vencimento && ` · vence ${dataCurta(vencimento)}`)}
                </dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd className="criar-ficha__total">{reais(total)}</dd>
              </div>
            </dl>

            <label className="criar-ficha__nota">
              <input type="checkbox" checked={prepararNota} onChange={(e) => setPrepararNota(e.target.checked)} />
              Preparar rascunho de nota fiscal para revisão
            </label>

            <Botao
              variante="primario"
              icone="check"
              className="criar-ficha__concluir"
              onClick={concluir}
            >
              Concluir ficha de venda
            </Botao>
            {/* Sem "Salvar rascunho": a ficha em andamento já se guarda sozinha. */}
            <div className="criar-ficha__secundarias">
              <Botao tamanho="pequeno" icone="imprimir" onClick={semDestino('comprovante')}>
                Comprovante
              </Botao>
            </div>
          </Painel>
        </aside>
      </div>
      {codigoProdutoNovo !== null && (
        <ModalProduto
          naFicha
          codigoInicial={codigoProdutoNovo}
          aoFechar={() => setCodigoProdutoNovo(null)}
          aoSalvar={(codigo, produto, quantidade = 1) => {
            setItens((atual) => [...atual, {
              codigo,
              codigoBarras: produto.codigoBarras ?? codigo,
              descricao: produto.descricao,
              estoque: `0 ${produto.unidade}`,
              preco: produto.preco,
              quantidade,
            }])
            setTentouConcluir(false)
            setCodigoProdutoNovo(null)
          }}
        />
      )}
    </Tela>
  )
}
