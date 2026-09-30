import { useCallback, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Modal } from '../../componentes/modal/Modal'
import { Campo } from '../../componentes/campo/Campo'
import { Botao } from '../../componentes/botao/Botao'
import { Icone } from '../../componentes/icone/Icone'
import { alterarSaldo, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { rotas } from '../../rotas-caminhos'
import './ajustar-estoque.css'

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

export function AjustarEstoque() {
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const fechar = useCallback(() => navegar(rotas.estoque), [navegar])
  // Desativado sai das contas; cadastro rápido se conta pelo Completar, que tira a marca.
  const produtos = useEstadoDemonstracao().produtos.filter((p) => !p.inativo && !p.cadastroRapido)
  const [codigo, setCodigo] = useState(parametros.get('produto') ?? '')
  const produto = produtos.find((item) => item.codigo === codigo)
  const [contagem, setContagem] = useState(produto ? String(produto.saldo) : '')
  const [motivo, setMotivo] = useState('')
  const [erros, setErros] = useState<Partial<Record<'produto' | 'contagem' | 'motivo', string>>>({})
  const [busca, setBusca] = useState('')
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(0)
  const idSugestoes = useId()
  const campoBusca = useRef<HTMLInputElement>(null)
  const termo = normalizar(busca.trim())
  const sugestoes = produtos
    .filter((item) => !termo || termo.split(/\s+/).every((palavra) => normalizar(`${item.codigo} ${item.codigoBarras ?? ''} ${item.descricao}`).includes(palavra)))
    .sort((a, b) => {
      const prioridade = (item: typeof a) => item.codigo === busca.trim() || item.codigoBarras === busca.trim() ? 0 : normalizar(item.descricao).startsWith(termo) ? 1 : 2
      return prioridade(a) - prioridade(b)
    })
    .slice(0, 6)

  function selecionar(proximoCodigo: string) {
    setCodigo(proximoCodigo)
    setContagem(String(produtos.find((item) => item.codigo === proximoCodigo)?.saldo ?? 0))
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
      if (sugestoes[indiceAtivo]) selecionar(sugestoes[indiceAtivo].codigo)
    }
  }

  function confirmar(evento: FormEvent) {
    evento.preventDefault()
    const formulario = evento.currentTarget as HTMLFormElement
    const novoSaldo = Number(contagem)
    const falhas: typeof erros = {}
    if (busca.trim() || !produto) falhas.produto = 'Selecione um produto da lista.'
    if (contagem.trim() === '' || !Number.isInteger(novoSaldo) || novoSaldo < 0) falhas.contagem = 'Informe uma contagem inteira e não negativa.'
    else if (produto && novoSaldo === produto.saldo) falhas.contagem = 'A nova contagem é igual ao saldo atual.'
    if (!motivo.trim()) falhas.motivo = 'Informe o motivo do ajuste.'
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
    alterarSaldo(codigo, novoSaldo, motivo.trim(), 'Ajuste')
    navegar(rotas.movimentacoesEstoque(codigo), { replace: true })
  }

  return (
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
                    key={item.codigo}
                    id={`${idSugestoes}-${indice}`}
                    type="button"
                    role="option"
                    aria-selected={item.codigo === codigo}
                    className={indice === indiceAtivo ? 'ajustar-estoque__sugestao ajustar-estoque__sugestao--ativa' : 'ajustar-estoque__sugestao'}
                    onMouseDown={(evento) => evento.preventDefault()}
                    onMouseEnter={() => setIndiceAtivo(indice)}
                    onClick={() => selecionar(item.codigo)}
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
        <p className="ajustar-estoque__nota">A diferença fica registrada em Movimentações, como ajuste.</p>
      </form>
    </Modal>
  )
}
