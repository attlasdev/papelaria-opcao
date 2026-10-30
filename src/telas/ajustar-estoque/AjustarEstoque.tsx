import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { Assinatura, Produto } from '../../../comum/contrato'
import { MENSAGENS_AJUSTE } from '../../../comum/regras/ajuste'
import { JanelaAssinatura } from '../../componentes/assinatura/JanelaAssinatura'
import { Modal } from '../../componentes/modal/Modal'
import { Campo } from '../../componentes/campo/Campo'
import { Botao } from '../../componentes/botao/Botao'
import { Icone } from '../../componentes/icone/Icone'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { rotas } from '../../rotas-caminhos'
import './ajustar-estoque.css'

/**
 * Corrige a contagem de um produto (1.0, tela 2.5). Quem faz assina sozinho; o
 * ajuste de funcionário fica aguardando a conferência da dona (`R-ESTOQUE-11`).
 * Manda o saldo que a tela mostrou; se mudou no meio, o back recusa e a gaveta
 * mostra o de agora (`R-ESTOQUE-10`). Confirmado, volta ao Estoque.
 */
export function AjustarEstoque() {
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const fechar = useCallback(() => navegar(rotas.estoque), [navegar])
  const [produto, setProduto] = useState<Produto | null>(null)
  const [contagem, setContagem] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erros, setErros] = useState<Partial<Record<'produto' | 'contagem' | 'motivo', string>>>({})
  const [busca, setBusca] = useState('')
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(0)
  const [assinando, setAssinando] = useState(false)
  const idSugestoes = useId()
  const campoBusca = useRef<HTMLInputElement>(null)

  // Aberta pela linha do Estoque: o produto vem pelo id, lido do back.
  const pedido = parametros.get('produto')
  useEffect(() => {
    if (!pedido) return
    let vivo = true
    void api().obterProduto(pedido).then((r) => {
      if (!vivo) return
      if (r.ok && r.dado.ativo) { setProduto(r.dado); setContagem(String(r.dado.saldo)) }
      else setErros({ produto: r.ok ? 'Produto desativado: reative no Estoque para ajustar.' : r.causa === 'nao-encontrado' ? 'Produto não encontrado.' : `${tituloFalha(r.causa)} ${r.erro}` })
    })
    return () => { vivo = false }
  }, [pedido])

  // As sugestões vêm do back, depois de uma pausa na digitação (só os ativos).
  const [sugestoes, setSugestoes] = useState<Produto[]>([])
  useEffect(() => {
    if (!sugestoesAbertas) return
    let vivo = true
    const espera = setTimeout(() => {
      void api().listarProdutos('todos', busca.trim(), 1, 6).then((r) => { if (vivo && r.ok) setSugestoes(r.dado.produtos) })
    }, 200)
    return () => { vivo = false; clearTimeout(espera) }
  }, [busca, sugestoesAbertas])

  function selecionar(escolhido: Produto) {
    setProduto(escolhido)
    setContagem(String(escolhido.saldo))
    setBusca('')
    setSugestoesAbertas(false)
    setIndiceAtivo(0)
    setErros({})
  }

  function tecladoBusca(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Escape' && sugestoesAbertas) {
      evento.preventDefault()
      evento.stopPropagation()
      setSugestoesAbertas(false)
    } else if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault()
      setSugestoesAbertas(true)
      if (sugestoes.length) setIndiceAtivo((atual) => (atual + (evento.key === 'ArrowDown' ? 1 : -1) + sugestoes.length) % sugestoes.length)
    } else if (evento.key === 'Enter' && sugestoesAbertas) {
      evento.preventDefault()
      if (sugestoes[indiceAtivo]) selecionar(sugestoes[indiceAtivo])
    }
  }

  function confirmar(evento: FormEvent) {
    evento.preventDefault()
    const formulario = evento.currentTarget as HTMLFormElement
    const novoSaldo = Number(contagem)
    const falhas: typeof erros = {}
    if (busca.trim() || !produto) falhas.produto = 'Selecione um produto da lista.'
    if (contagem.trim() === '' || !Number.isInteger(novoSaldo) || novoSaldo < 0) falhas.contagem = MENSAGENS_AJUSTE.contagem
    else if (produto && novoSaldo === produto.saldo) falhas.contagem = MENSAGENS_AJUSTE.igual
    if (!motivo.trim()) falhas.motivo = MENSAGENS_AJUSTE.motivo
    const primeiro = (['produto', 'contagem', 'motivo'] as const).find((campo) => falhas[campo])
    if (primeiro) {
      setErros(falhas)
      requestAnimationFrame(() => {
        const alvo = primeiro === 'produto' ? campoBusca.current : formulario.querySelector<HTMLInputElement>(`[name="${primeiro}"]`)
        alvo?.scrollIntoView({ block: 'center' })
        alvo?.focus({ preventScroll: true })
      })
      return
    }
    setAssinando(true)
  }

  async function ajustar(quem: Assinatura) {
    const alvo = produto!
    const r = await api().ajustarEstoque({ produtoId: alvo.id, contagem: Number(contagem), saldoVisto: alvo.saldo, motivo }, quem)
    if (!r.ok && r.causa === 'conflito') {
      // O saldo mudou enquanto ela contava: fecha a janela, mostra o de agora e pede para conferir.
      setAssinando(false)
      setErros({ contagem: r.erro })
      const atual = await api().obterProduto(alvo.id)
      if (atual.ok) setProduto(atual.dado)
    }
    return r
  }

  return (
    <>
    <Modal
      variante="lateral"
      titulo="Ajustar estoque"
      subtitulo="Corrige a contagem, sem registrar compra."
      aoFechar={fechar}
      rodape={<>
        <Botao onClick={fechar}>Cancelar</Botao>
        <Botao variante="primario" type="submit" form="ajustar-estoque-formulario" icone="check">Confirmar ajuste</Botao>
      </>}
    >
      <form id="ajustar-estoque-formulario" className="ajustar-estoque" onSubmit={confirmar} noValidate>
        <div className="ajustar-estoque__campos">
          <div className="campo ajustar-estoque__produto">
            <label className="campo__rotulo" htmlFor={`${idSugestoes}-busca`}>Produto</label>
            <div className="ajustar-estoque__busca-caixa">
            <span className={erros.produto ? 'campo__caixa campo__caixa--erro' : 'campo__caixa'}>
              <Icone nome="busca" tamanho={18} />
              <input
                ref={campoBusca}
                id={`${idSugestoes}-busca`}
                type="search"
                autoComplete="off"
                placeholder="Nome, código ou código de barras..."
                value={busca}
                onChange={(evento) => { setBusca(evento.target.value); setIndiceAtivo(0); setSugestoesAbertas(true); setErros((atual) => ({ ...atual, produto: undefined })) }}
                aria-invalid={Boolean(erros.produto)}
                onFocus={() => setSugestoesAbertas(true)}
                onBlur={() => setSugestoesAbertas(false)}
                onKeyDown={tecladoBusca}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={sugestoesAbertas}
                aria-controls={idSugestoes}
                aria-activedescendant={sugestoesAbertas && sugestoes.length ? `${idSugestoes}-${indiceAtivo}` : undefined}
              />
            </span>
            {sugestoesAbertas && (
              <div id={idSugestoes} className="ajustar-estoque__sugestoes" role="listbox" aria-label="Produtos encontrados">
                {sugestoes.length ? sugestoes.map((item, indice) => (
                  <button
                    key={item.id}
                    id={`${idSugestoes}-${indice}`}
                    type="button"
                    role="option"
                    aria-selected={item.id === produto?.id}
                    className={indice === indiceAtivo ? 'ajustar-estoque__sugestao ajustar-estoque__sugestao--ativa' : 'ajustar-estoque__sugestao'}
                    onMouseDown={(evento) => evento.preventDefault()}
                    onMouseEnter={() => setIndiceAtivo(indice)}
                    onClick={() => selecionar(item)}
                  >
                    <strong>{item.codigo} · {item.descricao}</strong>
                    <span>{item.codigoBarras ?? 'Sem código de barras'} · saldo {item.saldo} {item.unidade}</span>
                  </button>
                )) : <p className="ajustar-estoque__sem-resultados">Nenhum produto encontrado.</p>}
              </div>
            )}
            </div>
            <span className={erros.produto ? 'ajustar-estoque__selecionado ajustar-estoque__selecionado--erro' : 'ajustar-estoque__selecionado'} title={produto?.descricao} role={erros.produto ? 'alert' : undefined}>
              {erros.produto ?? (produto ? `Selecionado: ${produto.codigo} · ${produto.descricao}` : 'Selecione um produto para ajustar.')}
            </span>
          </div>
          <div className="ajustar-estoque__saldo">
            <span>Saldo atual</span>
            <strong className="numero">{produto ? `${produto.saldo} ${produto.unidade}` : '—'}</strong>
          </div>
          <Campo rotulo="Nova contagem" name="contagem" type="number" min={0} step={1} required value={contagem} onChange={(e) => { setContagem(e.target.value); setErros((atual) => ({ ...atual, contagem: undefined })) }} erro={Boolean(erros.contagem)} ajuda={erros.contagem} />
          <Campo rotulo="Motivo do ajuste" name="motivo" required value={motivo} onChange={(e) => { setMotivo(e.target.value); setErros((atual) => ({ ...atual, motivo: undefined })) }} placeholder="Ex.: contagem física do balcão" className="ajustar-estoque__motivo" erro={Boolean(erros.motivo)} ajuda={erros.motivo} />
        </div>
        <p className="ajustar-estoque__nota">A diferença fica registrada em Movimentações, como ajuste. Feito por funcionário, fica aguardando a conferência da administradora.</p>
      </form>
    </Modal>
    {/* Fora da gaveta: dentro dela, o CSS da lateral esticaria a janela. */}
    {assinando && produto && (
      <JanelaAssinatura
        gesto={`Ajuste de ${produto.descricao}: ${produto.saldo} → ${contagem} ${produto.unidade}`}
        rotuloConfirmar="Confirmar ajuste"
        fazer={ajustar}
        aoConcluir={() => navegar(rotas.estoque, { replace: true })}
        aoFechar={() => setAssinando(false)}
      />
    )}
    </>
  )
}
