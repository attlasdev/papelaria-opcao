import { useCallback, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Modal } from '../../componentes/modal/Modal'
import { Campo } from '../../componentes/campo/Campo'
import { CampoMoeda } from '../../componentes/campo/CampoMoeda'
import { Botao } from '../../componentes/botao/Botao'
import { reais } from '../../formatar'
import { alterarSaldo, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import './entrada-rapida.css'

/**
 * Entrada de um produto só, aberta pela linha do Estoque: comprou uma caixa no
 * atacado e lança em segundos. Entrega com vários itens e nota vai pela página
 * completa (botão do topo, ou o link no pé desta gaveta).
 */
export function EntradaRapida() {
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const fechar = useCallback(() => navegar(rotas.estoque), [navegar])
  const { produtos } = useEstadoDemonstracao()
  const produto = produtos.find((p) => p.codigo === parametros.get('produto'))
  const [quantidade, setQuantidade] = useState('')
  const [custo, setCusto] = useState<number | null>(produto?.custo ?? null)
  const [fornecedor, setFornecedor] = useState('')
  const [erro, setErro] = useState('')

  if (!produto) {
    return (
      <Modal variante="lateral" titulo="Entrada rápida" aoFechar={fechar} rodape={<Botao onClick={fechar}>Fechar</Botao>}>
        <p className="entrada-rapida__nota">Produto não encontrado. Volte ao Estoque e escolha pela linha do produto.</p>
      </Modal>
    )
  }
  const n = Number(quantidade)
  const valida = quantidade.trim() !== '' && Number.isInteger(n) && n > 0

  function confirmar(evento: FormEvent) {
    evento.preventDefault()
    if (!produto) return
    if (!valida) {
      setErro('Informe quantas chegaram, um número inteiro maior que zero.')
      document.querySelector<HTMLInputElement>('.entrada-rapida [name="quantidade"]')?.focus()
      return
    }
    // O custo desta compra fica no registro; se ele vira o custo do cadastro ainda
    // está em aberto com a dona (ver Memoria.md, custo na entrada).
    const motivo = ['Recebimento de mercadorias', fornecedor.trim(), custo ? `custo ${reais(custo)}/${produto.unidade}` : '']
      .filter(Boolean)
      .join(' · ')
    alterarSaldo(produto.codigo, produto.saldo + n, motivo, 'Entrada')
    navegar(rotas.movimentacoesEstoque(produto.codigo), { replace: true })
  }

  return (
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
          <CampoMoeda rotulo={`Custo por ${produto.unidade} (R$)`} name="custo" opcional valorInicialCentavos={custo} aoMudar={setCusto} ajuda="Último custo registrado." />
          <Campo rotulo="Fornecedor" name="fornecedor" opcional value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ex.: Atacadão" />
        </div>
        <p className="entrada-rapida__nota">
          Chegaram outros itens?{' '}
          <Link to={rotas.registrarEntrada} state={{ produto: produto.codigo }}>Entrada completa</Link>
        </p>
      </form>
    </Modal>
  )
}
