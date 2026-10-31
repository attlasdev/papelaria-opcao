import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { Produto } from '../../../../comum/contrato'
import { Botao, BotaoIcone } from '../../../componentes/botao/Botao'
import { Icone } from '../../../componentes/icone/Icone'
import { api } from '../../../dados/api'
import { tituloFalha } from '../../../falhas'
import { reais } from '../../../formatar'
import { useLeitorCodigo } from '../../../leitor/useLeitorCodigo'
import type { ItemFicha } from '../tipos'
import { rotas } from '../../../rotas-caminhos'
import './itens-ficha.css'

type Props = {
  itens: ItemFicha[]
  aoMudar: (itens: ItemFicha[]) => void
  erroFalta?: string
  erroEstoque?: { produtoId: string; descricao: string; disponivel: number; solicitado: number }
  /** Botão ao lado de "Inserir item" (o "Inserir serviço" da ficha). */
  acaoExtra?: ReactNode
  /** Conteúdo logo abaixo da tabela de produtos (os serviços da ficha). */
  depoisDaTabela?: ReactNode
  /** Ficha só de serviço: sem a linha "Nenhum item ainda". */
  semAvisoVazio?: boolean
}

/** Resultados da busca: poucos, para não empurrar os itens para fora da tela. */
const MAXIMO_SUGESTOES = 6

/** O produto do cadastro como linha da ficha. */
export function itemDoProduto(p: Produto, quantidade = 1): ItemFicha {
  return { produtoId: p.id, codigo: p.codigoBarras ?? p.codigo, descricao: p.descricao, preco: p.preco, saldo: p.saldo, unidade: p.unidade, quantidade }
}

const igual = (a: string, b: string) => a.toLocaleLowerCase('pt-BR') === b.toLocaleLowerCase('pt-BR')

/**
 * O produto pelo que foi bipado ou digitado: o código de barras, ou o código
 * interno ("EST-0031"). Ativo ou não: o desativado avisa em vez de oferecer
 * cadastro novo.
 */
async function acharPorCodigo(lido: string): Promise<{ produto: Produto | null } | { erro: string }> {
  const porBarras = await api().buscarProdutoPorCodigoBarras(lido)
  if (!porBarras.ok) return { erro: `${tituloFalha(porBarras.causa)} ${porBarras.erro}` }
  if (porBarras.dado) return { produto: porBarras.dado }
  for (const filtro of ['todos', 'desativados'] as const) {
    const r = await api().listarProdutos(filtro, lido, 1, MAXIMO_SUGESTOES)
    if (!r.ok) return { erro: `${tituloFalha(r.causa)} ${r.erro}` }
    const exato = r.dado.produtos.find((p) => igual(p.codigo, lido))
    if (exato) return { produto: exato }
  }
  return { produto: null }
}

/** Leitura de código de barras e lista de itens. Ler o mesmo código de novo soma 1. */
export function ItensFicha({ itens, aoMudar, erroFalta, erroEstoque, acaoExtra, depoisDaTabela, semAvisoVazio }: Props) {
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(0)
  const [lendoCodigo, setLendoCodigo] = useState(false)
  const [leituras, setLeituras] = useState(0)
  const entrada = useRef<HTMLInputElement>(null)
  // semAtalho: o aviso não oferece "Cadastrar produto" (desativado, campo vazio, ambíguo, falha).
  const [semAtalho, setSemAtalho] = useState(false)
  // Código que não achou: vai preenchido para o cadastro aberto pela ficha.
  const [semCadastro, setSemCadastro] = useState<string | undefined>()
  // A busca vai ao back depois de uma pausa na digitação; só os ativos se vendem.
  const termo = codigo.trim()
  const [sugestoes, setSugestoes] = useState<{ termo: string; produtos: Produto[] }>({ termo: '', produtos: [] })
  useEffect(() => {
    if (!termo || lendoCodigo) return
    let vivo = true
    const espera = setTimeout(() => {
      void api().listarProdutos('todos', termo, 1, MAXIMO_SUGESTOES).then((r) => {
        if (vivo && r.ok) setSugestoes({ termo, produtos: r.dado.produtos })
      })
    }, 200)
    return () => { vivo = false; clearTimeout(espera) }
  }, [termo, lendoCodigo])
  const listadas = sugestoes.termo === termo ? sugestoes.produtos : []

  // Itens novos e somados chegam a toda hora: o callback lê a lista de agora.
  const atuais = useRef(itens)
  atuais.current = itens

  function inserir(produto: Produto) {
    const lista = atuais.current
    if (lista.some((item) => item.produtoId === produto.id)) {
      aoMudar(lista.map((item) => item.produtoId === produto.id ? { ...item, quantidade: item.quantidade + 1 } : item))
    } else {
      aoMudar([...lista, itemDoProduto(produto)])
    }
    setErro(null)
    setCodigo('')
    setSugestoesAbertas(false)
    setIndiceAtivo(0)
    entrada.current?.focus()
  }

  function naoAchou(lido: string, ehCodigo: boolean, fora?: Produto) {
    setSemAtalho(Boolean(fora))
    setSemCadastro(ehCodigo && !fora ? lido : undefined)
    setErro(fora ? `“${fora.descricao}” está desativado. Reative no Estoque para vender.`
      : ehCodigo ? `Código “${lido}” sem cadastro.` : `Produto “${lido}” não encontrado.`)
  }

  function falhou(mensagem: string) {
    setSemAtalho(true)
    setErro(mensagem)
  }

  useLeitorCodigo((lido) => {
    void acharPorCodigo(lido).then((achado) => {
      if ('erro' in achado) return falhou(achado.erro)
      if (achado.produto?.ativo) {
        inserir(achado.produto)
        setLeituras((atual) => atual + 1)
        return
      }
      setCodigo(lido)
      setSugestoesAbertas(false)
      naoAchou(lido, true, achado.produto ?? undefined)
    })
  }, lendoCodigo)

  useEffect(() => {
    if (!lendoCodigo) return
    function parar(evento: globalThis.KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        evento.stopPropagation()
        setLendoCodigo(false)
        setSugestoesAbertas(false)
      }
    }
    window.addEventListener('keydown', parar, true)
    return () => window.removeEventListener('keydown', parar, true)
  }, [lendoCodigo])

  async function ler(evento: FormEvent) {
    evento.preventDefault()
    const lido = codigo.trim()
    if (!lido) {
      setSemAtalho(true)
      setErro('Bipe um código ou busque um produto antes de inserir.')
      entrada.current?.focus()
      return
    }
    // Com a lista aberta, Enter/botão levam o destacado.
    if (sugestoesAbertas && listadas.length) return inserir(listadas[Math.min(indiceAtivo, listadas.length - 1)])
    const achado = await acharPorCodigo(lido)
    if ('erro' in achado) return falhou(achado.erro)
    if (achado.produto?.ativo) return inserir(achado.produto)
    if (achado.produto) return naoAchou(lido, true, achado.produto)
    // Pelo nome: fechada e com vários resultados, pede para escolher; inserir o
    // primeiro às cegas cobraria o errado.
    const r = await api().listarProdutos('todos', lido, 1, MAXIMO_SUGESTOES)
    if (!r.ok) return falhou(`${tituloFalha(r.causa)} ${r.erro}`)
    setSugestoes({ termo: lido, produtos: r.dado.produtos })
    if (r.dado.produtos.length === 1) return inserir(r.dado.produtos[0])
    if (r.dado.produtos.length > 1) {
      setSugestoesAbertas(true)
      setSemAtalho(true)
      setErro('Vários produtos encontrados. Escolha um da lista.')
      return
    }
    naoAchou(lido, /^\d{4,}$/.test(lido))
    setSugestoesAbertas(false)
  }

  function teclado(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Escape') {
      setSugestoesAbertas(false)
      return
    }
    if (!sugestoesAbertas || listadas.length === 0) return
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault()
      setIndiceAtivo((atual) => (atual + (evento.key === 'ArrowDown' ? 1 : -1) + listadas.length) % listadas.length)
    }
  }

  function definirQuantidade(produtoId: string, proxima: number) {
    aoMudar(itens.map((i) => (i.produtoId === produtoId ? { ...i, quantidade: Math.max(1, proxima) } : i)))
  }

  function quantidade(produtoId: string, delta: number) {
    const atual = itens.find((i) => i.produtoId === produtoId)
    if (atual) definirQuantidade(produtoId, atual.quantidade + delta)
  }

  const unidades = itens.reduce((soma, i) => soma + i.quantidade, 0)

  return (
    <section className="itens-ficha">
      <form className="itens-ficha__leitor" onSubmit={(e) => void ler(e)}>
        <div className="itens-ficha__busca" onBlur={(evento) => {
          if (!evento.currentTarget.contains(evento.relatedTarget)) setLendoCodigo(false)
        }}>
          <div className={erro || erroFalta ? 'itens-ficha__campo itens-ficha__campo--erro' : 'itens-ficha__campo'}>
            <button
              type="button"
              className={lendoCodigo ? 'itens-ficha__acionar-leitor itens-ficha__acionar-leitor--ativo' : 'itens-ficha__acionar-leitor'}
              aria-label={lendoCodigo ? 'Parar leitura de código de barras' : 'Ativar leitura de código de barras'}
              aria-pressed={lendoCodigo}
              title={lendoCodigo ? 'Parar leitura (Esc)' : 'Ler código de barras'}
              onClick={() => {
                setLendoCodigo((atual) => !atual)
                setSugestoesAbertas(false)
                entrada.current?.focus()
              }}
            >
              <Icone nome="codigo-barras" tamanho={20} />
              {lendoCodigo && <span className="itens-ficha__laser" aria-hidden />}
              {leituras > 0 && <span key={leituras} className="itens-ficha__leitura-feita" aria-hidden />}
            </button>
            <input
              ref={entrada}
              value={codigo}
              onChange={(e) => { setCodigo(e.target.value); setIndiceAtivo(0); setSugestoesAbertas(!lendoCodigo && Boolean(e.target.value.trim())); setErro(null) }}
              onFocus={() => setSugestoesAbertas(!lendoCodigo && Boolean(codigo.trim()))}
              onBlur={() => setSugestoesAbertas(false)}
              onKeyDown={teclado}
              placeholder={lendoCodigo ? 'Pronto para ler · Esc para parar' : 'Bipe o código ou busque pelo nome do produto…'}
              aria-label="Buscar produto por nome, código interno ou código de barras"
              role="combobox"
              aria-autocomplete="list"
              aria-controls="itens-ficha-sugestoes"
              aria-expanded={sugestoesAbertas && listadas.length > 0}
              aria-activedescendant={sugestoesAbertas && listadas.length > 0 ? `itens-ficha-sugestao-${indiceAtivo}` : undefined}
              aria-invalid={Boolean(erro || erroFalta)}
            />
            <kbd>{lendoCodigo ? 'Esc' : 'Enter'}</kbd>
          </div>
          {sugestoesAbertas && listadas.length > 0 && (
            <div id="itens-ficha-sugestoes" className="itens-ficha__sugestoes" role="listbox" aria-label="Produtos encontrados">
              {listadas.map((produto, indice) => (
                <button
                  key={produto.id}
                  id={`itens-ficha-sugestao-${indice}`}
                  type="button"
                  role="option"
                  aria-selected={indice === indiceAtivo}
                  className={indice === indiceAtivo ? 'itens-ficha__sugestao itens-ficha__sugestao--ativa' : 'itens-ficha__sugestao'}
                  onMouseDown={(evento) => evento.preventDefault()}
                  onMouseEnter={() => setIndiceAtivo(indice)}
                  onClick={() => inserir(produto)}
                >
                  <span><strong>{produto.descricao}</strong><small>{produto.codigoBarras ?? produto.codigo} · estoque {produto.saldo} {produto.unidade}</small></span>
                  <strong className="numero">{reais(produto.preco)}</strong>
                </button>
              ))}
            </div>
          )}
        </div>
        <Botao type="submit" icone="mais">
          Inserir item
        </Botao>
        {acaoExtra}
      </form>
      {erro && (
        <p className="itens-ficha__erro">
          {erro}{' '}
          {!semAtalho && <>Cadastre e conte o produto antes de vender. <Link to={rotas.cadastrarProdutoNaFicha(semCadastro)}>Cadastrar produto</Link></>}
        </p>
      )}
      {!erro && erroFalta && <p className="itens-ficha__erro" role="alert">{erroFalta}</p>}
      {erroEstoque && <p className="itens-ficha__erro" role="alert">
        Estoque insuficiente para {erroEstoque.descricao}: {erroEstoque.disponivel} disponível, {erroEstoque.solicitado} na ficha. Confira a prateleira e <Link to={rotas.ajustarEstoque(erroEstoque.produtoId)}>ajuste o estoque</Link> antes de concluir.
      </p>}

      <div className="itens-ficha__topo">
        <h2>Itens da ficha</h2>
        <span>
          {itens.length} {itens.length === 1 ? 'item' : 'itens'} · {unidades} {unidades === 1 ? 'unidade' : 'unidades'}
        </span>
      </div>

      <table className="itens-ficha__tabela">
        <thead>
          <tr>
            <th>Produto</th>
            <th className="itens-ficha__centro">Quantidade</th>
            <th className="itens-ficha__numero">Preço</th>
            <th className="itens-ficha__numero">Total</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.produtoId}>
              <td>
                <span className="itens-ficha__nome">{item.descricao}</span>
                <span className="itens-ficha__detalhe">
                  Cód. {item.codigo} · estoque {item.saldo} {item.unidade}
                </span>
              </td>
              <td className="itens-ficha__centro">
                <div className="itens-ficha__qtd">
                  <button type="button" aria-label="Diminuir" onClick={() => quantidade(item.produtoId, -1)}>
                    <Icone nome="menos" tamanho={16} />
                  </button>
                  <CampoQuantidade valor={item.quantidade} descricao={item.descricao} aoMudar={(n) => definirQuantidade(item.produtoId, n)} />
                  <button type="button" aria-label="Aumentar" onClick={() => quantidade(item.produtoId, 1)}>
                    <Icone nome="mais" tamanho={16} />
                  </button>
                </div>
              </td>
              <td className="itens-ficha__numero">{reais(item.preco)}</td>
              <td className="itens-ficha__numero itens-ficha__total">{reais(item.preco * item.quantidade)}</td>
              <td className="itens-ficha__numero">
                <BotaoIcone
                  icone="lixeira"
                  rotulo="Remover item"
                  onClick={() => aoMudar(itens.filter((i) => i.produtoId !== item.produtoId))}
                />
              </td>
            </tr>
          ))}
          {itens.length === 0 && !semAvisoVazio && (
            <tr>
              <td colSpan={5} className="itens-ficha__vazio">
                Nenhum item ainda. Bipe um código ou busque pelo nome do produto.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {depoisDaTabela}
    </section>
  )
}

/**
 * Quantidade digitável (50 folhas não são 50 cliques). Enquanto digita, o campo
 * pode ficar vazio; ao sair, volta ao último número válido.
 */
function CampoQuantidade({ valor, descricao, aoMudar }: { valor: number; descricao: string; aoMudar: (n: number) => void }) {
  const [texto, setTexto] = useState(String(valor))
  useEffect(() => setTexto(String(valor)), [valor])
  return (
    <input
      className="itens-ficha__qtd-campo numero"
      inputMode="numeric"
      value={texto}
      aria-label={`Quantidade de ${descricao}`}
      onFocus={(evento) => evento.target.select()}
      onChange={(evento) => {
        const digitos = evento.target.value.replace(/\D/g, '').slice(0, 4)
        setTexto(digitos)
        if (Number(digitos) >= 1) aoMudar(Number(digitos))
      }}
      onBlur={() => setTexto(String(valor))}
      onKeyDown={(evento) => { if (evento.key === 'Enter') evento.currentTarget.blur() }}
    />
  )
}
