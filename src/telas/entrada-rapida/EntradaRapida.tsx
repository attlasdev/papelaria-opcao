import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import type { Assinatura, Produto } from '../../../comum/contrato'
import { hojeEmSaoPaulo, MENSAGENS_ENTRADA } from '../../../comum/regras/entrada'
import { JanelaAssinatura } from '../../componentes/assinatura/JanelaAssinatura'
import { Modal } from '../../componentes/modal/Modal'
import { Campo } from '../../componentes/campo/Campo'
import { CampoMoeda } from '../../componentes/campo/CampoMoeda'
import { Botao } from '../../componentes/botao/Botao'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { rotas } from '../../rotas-caminhos'
import './entrada-rapida.css'

type Carga = { fase: 'carregando' } | { fase: 'erro'; mensagem: string } | { fase: 'pronto'; produto: Produto }

/**
 * Entrada de um produto só, aberta pela linha do Estoque: comprou uma caixa no
 * atacado e lança em segundos. Entrega com vários itens e nota vai pela página
 * completa (botão do topo, ou o link no pé desta gaveta). Confirmar pede quem
 * está fazendo (`R-OPERADOR-02`) e volta ao Estoque, com o saldo novo na linha.
 */
export function EntradaRapida() {
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const fechar = useCallback(() => navegar(rotas.estoque), [navegar])
  const id = parametros.get('produto') ?? ''
  const [carga, setCarga] = useState<Carga>({ fase: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [quantidade, setQuantidade] = useState('')
  const [custo, setCusto] = useState<number | null>(null)
  const [fornecedor, setFornecedor] = useState('')
  const [erro, setErro] = useState('')
  const [assinando, setAssinando] = useState(false)

  useEffect(() => {
    let vivo = true
    void api().obterProduto(id).then((r) => {
      if (!vivo) return
      if (r.ok) return setCarga({ fase: 'pronto', produto: r.dado })
      setCarga({ fase: 'erro', mensagem: r.causa === 'nao-encontrado'
        ? 'Produto não encontrado. Volte ao Estoque e escolha pela linha do produto.'
        : `${tituloFalha(r.causa)} ${r.erro}` })
    })
    return () => { vivo = false }
  }, [id, tentativa])

  if (carga.fase !== 'pronto') {
    return (
      <Modal
        variante="lateral"
        titulo="Entrada rápida"
        aoFechar={fechar}
        rodape={<>
          <Botao onClick={fechar}>Fechar</Botao>
          {carga.fase === 'erro' && <Botao variante="primario" onClick={() => { setCarga({ fase: 'carregando' }); setTentativa((n) => n + 1) }}>Tentar de novo</Botao>}
        </>}
      >
        <p className="entrada-rapida__nota" role={carga.fase === 'erro' ? 'alert' : 'status'}>
          {carga.fase === 'erro' ? carga.mensagem : 'Carregando o produto…'}
        </p>
      </Modal>
    )
  }

  const produto = carga.produto
  const n = Number(quantidade)
  const valida = quantidade.trim() !== '' && Number.isInteger(n) && n > 0

  function confirmar(evento: FormEvent) {
    evento.preventDefault()
    if (!valida) {
      setErro(MENSAGENS_ENTRADA.quantidade)
      document.querySelector<HTMLInputElement>('.entrada-rapida [name="quantidade"]')?.focus()
      return
    }
    setAssinando(true)
  }

  // A entrega de um item só, pela mesma operação da Registrar entrada. Manda
  // quanto somar; o saldo final é o back que calcula.
  const registrar = (quem: Assinatura) => api().registrarEntrada({
    recebidaEm: hojeEmSaoPaulo(),
    fornecedor: fornecedor.trim() || null,
    referencia: null,
    observacoes: null,
    itens: [{ produtoId: produto.id, quantidade: n, custoUnitario: custo }],
  }, quem)

  return (
    <>
    <Modal
      variante="lateral"
      titulo="Entrada rápida"
      subtitulo="Soma ao estoque deste produto."
      aoFechar={fechar}
      rodape={<>
        <Botao onClick={fechar}>Cancelar</Botao>
        <Botao variante="primario" type="submit" form="entrada-rapida-formulario" icone="check">Confirmar entrada</Botao>
      </>}
    >
      <form id="entrada-rapida-formulario" className="entrada-rapida" onSubmit={confirmar} noValidate>
        <div className="entrada-rapida__produto">
          <strong>{produto.descricao}</strong>
          <span className="codigo">{produto.codigo}{produto.codigoBarras ? ` · ${produto.codigoBarras}` : ''}</span>
        </div>
        <div className="entrada-rapida__campos">
          <Campo
            rotulo={`Quantidade que chegou (${produto.unidade})`}
            name="quantidade"
            type="number"
            min={1}
            step={1}
            required
            autoFocus
            value={quantidade}
            onChange={(e) => { setQuantidade(e.target.value); setErro('') }}
            erro={Boolean(erro)}
            ajuda={erro || 'Na unidade de venda.'}
          />
          <div className="entrada-rapida__saldo">
            <span>Saldo</span>
            <strong className="numero">
              {produto.saldo} → {valida ? produto.saldo + n : '—'} {produto.unidade}
            </strong>
          </div>
          <CampoMoeda rotulo={`Custo por ${produto.unidade} (R$)`} name="custo" opcional valorCentavos={custo} aoMudar={setCusto} ajuda="Informe o custo desta compra, se souber." />
          <Campo rotulo="Fornecedor" name="fornecedor" opcional value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ex.: Atacadão" />
        </div>
        <p className="entrada-rapida__nota">
          Chegaram outros itens?{' '}
          <Link to={rotas.registrarEntrada} state={{ produto: produto.id }}>Entrada completa</Link>
        </p>
      </form>
    </Modal>
    {/* Fora da gaveta: dentro dela, o CSS da lateral esticaria a janela. */}
    {assinando && (
      <JanelaAssinatura
        gesto={`Entrada de ${n} ${produto.unidade} · ${produto.descricao}`}
        rotuloConfirmar="Confirmar entrada"
        fazer={registrar}
        aoConcluir={() => navegar(rotas.estoque, { replace: true })}
        aoFechar={() => setAssinando(false)}
      />
    )}
    </>
  )
}
