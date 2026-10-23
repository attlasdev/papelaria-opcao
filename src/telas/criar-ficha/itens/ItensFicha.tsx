import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Botao, BotaoIcone } from '../../../componentes/botao/Botao'
import { Icone } from '../../../componentes/icone/Icone'
import { reais } from '../../../formatar'
import { useLeitorCodigo } from '../../../leitor/useLeitorCodigo'
import { normalizar, useEstadoDemonstracao } from '../../../mock/estado-demonstracao'
import type { ItemFicha } from '../tipos'
import { rotas } from '../../../rotas-caminhos'
import './itens-ficha.css'

type Props = {
  itens: ItemFicha[]
  aoMudar: (itens: ItemFicha[]) => void
  erroFalta?: string
  erroEstoque?: { codigo: string; descricao: string; disponivel: number; solicitado: number }
  /** Botão ao lado de "Inserir item" (o "Inserir serviço" da ficha). */
  acaoExtra?: ReactNode
  /** Conteúdo logo abaixo da tabela de produtos (os serviços da ficha). */
  depoisDaTabela?: ReactNode
  /** Ficha só de serviço: sem a linha "Nenhum item ainda". */
  semAvisoVazio?: boolean
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
  const { produtos: todos } = useEstadoDemonstracao()
  // Desativado não se vende; bipado, avisa em vez de oferecer cadastro novo.
  // semAtalho: o aviso não oferece "Fazer cadastro rápido" (desativado, campo vazio, ambíguo).
  const produtos = todos.filter((produto) => !produto.inativo)
  const [semAtalho, setSemAtalho] = useState(false)
  // Código que não achou: vai preenchido para o cadastro aberto pela ficha.
  const [semCadastro, setSemCadastro] = useState<string | undefined>()
  const termo = normalizar(codigo.trim())
  const sugestoes = termo ? produtos
    .filter((produto) => {
      const palavras = termo.split(/\s+/)
      const descricao = normalizar(produto.descricao)
      return palavras.every((palavra) => descricao.includes(palavra) || normalizar(produto.codigo).includes(palavra) || produto.codigoBarras?.includes(palavra))
    })
    .sort((a, b) => {
      const prioridade = (produto: typeof a) => produto.codigoBarras === codigo.trim() || produto.codigo === codigo.trim() ? 0 : normalizar(produto.descricao).startsWith(termo) ? 1 : 2
      return prioridade(a) - prioridade(b)
    })
    .slice(0, 6) : []

  function inserir(produto: Omit<ItemFicha, 'quantidade'>) {
    if (itens.some((item) => item.codigoBarras === produto.codigoBarras)) {
      aoMudar(itens.map((item) => item.codigoBarras === produto.codigoBarras ? { ...item, quantidade: item.quantidade + 1 } : item))
    } else {
      aoMudar([...itens, { ...produto, quantidade: 1 }])
    }
    setErro(null)
    setCodigo('')
    setSugestoesAbertas(false)
    setIndiceAtivo(0)
    entrada.current?.focus()
  }

  function itemCadastrado(produto: (typeof produtos)[number]) {
    return { codigo: produto.codigo, codigoBarras: produto.codigoBarras ?? produto.codigo, descricao: produto.descricao, preco: produto.preco }
  }

  useLeitorCodigo((lido) => {
    const produto = produtos.find((item) => item.codigoBarras === lido || item.codigo === lido)
    if (produto) {
      inserir(itemCadastrado(produto))
      setLeituras((atual) => atual + 1)
    } else {
      setCodigo(lido)
      setSugestoesAbertas(false)
      naoAchou(lido, true)
    }
  }, lendoCodigo)

  function naoAchou(lido: string, ehCodigo: boolean) {
    const fora = todos.find((item) => item.inativo && (item.codigo === lido || item.codigoBarras === lido))
    setSemAtalho(Boolean(fora))
    setSemCadastro(ehCodigo && !fora ? lido : undefined)
    setErro(fora ? `“${fora.descricao}” está desativado. Reative no Estoque para vender.`
      : ehCodigo ? `Código “${lido}” sem cadastro.` : `Produto “${lido}” não encontrado.`)
  }

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

  function ler(evento: FormEvent) {
    evento.preventDefault()
    const lido = codigo.trim()
    if (!lido) {
      setSemAtalho(true)
      setErro('Bipe um código ou busque um produto antes de inserir.')
      entrada.current?.focus()
      return
    }
    const exato = produtos.find((produto) => produto.codigo === lido || produto.codigoBarras === lido)
    // Com a lista aberta, Enter/botão levam o destacado. Fechada e com vários
    // resultados, pede para escolher: inserir o primeiro às cegas cobraria o errado.
    const escolhido = exato ?? (sugestoes.length === 1 || (sugestoesAbertas && sugestoes.length) ? sugestoes[Math.min(indiceAtivo, sugestoes.length - 1)] : undefined)
    if (escolhido) {
      inserir(itemCadastrado(escolhido))
    } else if (sugestoes.length > 1) {
      setSugestoesAbertas(true)
      setSemAtalho(true)
      setErro('Vários produtos encontrados. Escolha um da lista.')
    } else {
      naoAchou(lido, /^\d{4,}$/.test(lido))
      setSugestoesAbertas(false)
    }
  }

  function teclado(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Escape') {
      setSugestoesAbertas(false)
      return
    }
    if (!sugestoesAbertas || sugestoes.length === 0) return
    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault()
      setIndiceAtivo((atual) => (atual + (evento.key === 'ArrowDown' ? 1 : -1) + sugestoes.length) % sugestoes.length)
    }
  }

  function definirQuantidade(codigoBarras: string, proxima: number) {
    aoMudar(itens.map((i) => (i.codigoBarras === codigoBarras ? { ...i, quantidade: Math.max(1, proxima) } : i)))
  }

  function quantidade(codigoBarras: string, delta: number) {
    const atual = itens.find((i) => i.codigoBarras === codigoBarras)
    if (atual) definirQuantidade(codigoBarras, atual.quantidade + delta)
  }

  const unidades = itens.reduce((soma, i) => soma + i.quantidade, 0)

  return (
    <section className="itens-ficha">
      <form className="itens-ficha__leitor" onSubmit={ler}>
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
              aria-expanded={sugestoesAbertas && sugestoes.length > 0}
              aria-activedescendant={sugestoesAbertas && sugestoes.length > 0 ? `itens-ficha-sugestao-${indiceAtivo}` : undefined}
              aria-invalid={Boolean(erro || erroFalta)}
            />
            <kbd>{lendoCodigo ? 'Esc' : 'Enter'}</kbd>
          </div>
          {sugestoesAbertas && sugestoes.length > 0 && (
            <div id="itens-ficha-sugestoes" className="itens-ficha__sugestoes" role="listbox" aria-label="Produtos encontrados">
              {sugestoes.map((produto, indice) => (
                <button
                  key={produto.codigo}
                  id={`itens-ficha-sugestao-${indice}`}
                  type="button"
                  role="option"
                  aria-selected={indice === indiceAtivo}
                  className={indice === indiceAtivo ? 'itens-ficha__sugestao itens-ficha__sugestao--ativa' : 'itens-ficha__sugestao'}
                  onMouseDown={(evento) => evento.preventDefault()}
                  onMouseEnter={() => setIndiceAtivo(indice)}
                  onClick={() => inserir(itemCadastrado(produto))}
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
        Estoque insuficiente para {erroEstoque.descricao}: {erroEstoque.disponivel} disponível, {erroEstoque.solicitado} na ficha. Confira a prateleira e <Link to={todos.find((produto) => produto.codigo === erroEstoque.codigo)?.cadastroRapido ? rotas.completarProduto(erroEstoque.codigo) : rotas.ajustarEstoque(erroEstoque.codigo)}>{todos.find((produto) => produto.codigo === erroEstoque.codigo)?.cadastroRapido ? 'complete o cadastro com a contagem' : 'ajuste o estoque'}</Link> antes de concluir.
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
            <tr key={item.codigoBarras}>
              <td>
                <span className="itens-ficha__nome">{item.descricao}</span>
                <span className="itens-ficha__detalhe">
                  Cód. {item.codigoBarras} · estoque {todos.find((produto) => produto.codigo === item.codigo)?.saldo ?? 0} {todos.find((produto) => produto.codigo === item.codigo)?.unidade ?? ''}
                </span>
              </td>
              <td className="itens-ficha__centro">
                <div className="itens-ficha__qtd">
                  <button type="button" aria-label="Diminuir" onClick={() => quantidade(item.codigoBarras, -1)}>
                    <Icone nome="menos" tamanho={16} />
                  </button>
                  <CampoQuantidade valor={item.quantidade} descricao={item.descricao} aoMudar={(n) => definirQuantidade(item.codigoBarras, n)} />
                  <button type="button" aria-label="Aumentar" onClick={() => quantidade(item.codigoBarras, 1)}>
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
                  onClick={() => aoMudar(itens.filter((i) => i.codigoBarras !== item.codigoBarras))}
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
