import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao, BotaoIcone } from '../../componentes/botao/Botao'
import { Painel } from '../../componentes/painel/Painel'
import { Campo } from '../../componentes/campo/Campo'
import { Tabela } from '../../componentes/tabela/Tabela'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { Icone } from '../../componentes/icone/Icone'
import { reais } from '../../formatar'
import { alterarSaldo, cadastrarProduto, hojeISO, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { useLeitorCodigo } from '../../leitor/useLeitorCodigo'
import { PainelLeitor, type UltimaLeitura } from '../../leitor/PainelLeitor'
import { rotas } from '../../rotas-caminhos'
import { custoSugerido, type ItemEntrada } from './dados-exemplo'
import { BlocoBipados, falta, paraQuantidade, unidadeBase, type Bipado } from './bipados/BlocoBipados'
import { ModalProduto, type ProdutoDaEntrada, type RascunhoProduto } from '../cadastrar-produto/CadastrarProduto'
import './registrar-entrada.css'

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
}

/** Produto da base virando item de entrada. */
function itemDoCatalogo(codigoOuBarras: string, produtos: ReturnType<typeof useEstadoDemonstracao>['produtos']): ItemEntrada | null {
  const produto = produtos.find((p) => p.codigo === codigoOuBarras || p.codigoBarras === codigoOuBarras)
  if (!produto) return null
  return {
    codigo: produto.codigo,
    codigoBarras: produto.codigoBarras,
    descricao: produto.descricao,
    detalhe: produto.categoria,
    unidade: produto.unidade,
    saldoAtual: produto.saldo,
    quantidade: 1,
    custo: produto.custo ?? custoSugerido[produto.codigo],
  }
}

export function RegistrarEntrada() {
  const navegar = useNavigate()
  const { produtos } = useEstadoDemonstracao()
  // Aberta pela linha de um produto no Estoque: a lista começa com ele.
  const origem = (useLocation().state as { produto?: string } | null)?.produto
  // Pelo botão do topo a carga começa vazia: só entra o que for bipado ou buscado.
  const [itens, setItens] = useState<ItemEntrada[]>(() => {
    const doProduto = origem ? itemDoCatalogo(origem, produtos) : null
    return doProduto ? [doProduto] : []
  })
  const [bipados, setBipados] = useState<Bipado[]>([])
  const [tentouConfirmar, setTentouConfirmar] = useState(false)
  // Leitor ligado: o painel com o laser toma o lugar da busca. Liga pelo botão ou
  // sozinho no primeiro bipe, para ela sempre ver que a leitura chegou.
  const [lendo, setLendo] = useState(false)
  const [ultima, setUltima] = useState<UltimaLeitura | null>(null)
  const pararLeitura = useCallback(() => { setLendo(false); setUltima(null) }, [])
  // Linha que acabou de ser bipada: o cursor vai para o primeiro campo vazio dela.
  const [focar, setFocar] = useState<{ codigo: string; vez: number } | null>(null)
  const [bipe, setBipe] = useState('')
  const campoProduto = useRef<HTMLInputElement>(null)
  const [erroBipe, setErroBipe] = useState<string | null>(null)
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(-1)
  const termo = normalizar(bipe.trim())
  // Desativado não recebe entrada; bipado ou digitado, avisa (nunca vira produto novo).
  const desativado = (codigo: string) => produtos.find((p) => p.inativo && (p.codigo === codigo || p.codigoBarras === codigo))
  const avisoDesativado = (descricao: string) => `“${descricao}” está desativado. Reative no Estoque para dar entrada.`
  const sugestoes = termo ? produtos
    .filter((produto) => !produto.inativo)
    .filter((produto) => termo.split(/\s+/).every((palavra) => normalizar(`${produto.codigo} ${produto.codigoBarras ?? ''} ${produto.descricao}`).includes(palavra)))
    .sort((a, b) => {
      const prioridade = (produto: typeof a) => produto.codigo === bipe.trim() || produto.codigoBarras === bipe.trim() ? 0 : normalizar(produto.descricao).startsWith(termo) ? 1 : 2
      return prioridade(a) - prioridade(b)
    })
    .slice(0, 6) : []

  function mudarQuantidade(codigo: string, quantidade: number) {
    setItens((atual) => atual.map((i) => (i.codigo === codigo ? { ...i, quantidade: Math.max(1, quantidade) } : i)))
  }

  function incluirProduto(codigo: string) {
    const novo = itemDoCatalogo(codigo, produtos)
    if (!novo) return
    setItens((atual) => atual.some((item) => item.codigo === codigo)
      ? atual.map((item) => item.codigo === codigo ? { ...item, quantidade: item.quantidade + 1 } : item)
      : [...atual, novo])
    setErroBipe(null)
    setBipe('')
    setIndiceAtivo(-1)
    setSugestoesAbertas(false)
    requestAnimationFrame(() => campoProduto.current?.focus())
  }

  function adicionar(evento: FormEvent) {
    evento.preventDefault()
    const consulta = bipe.trim()
    if (!consulta) {
      setErroBipe('Bipe um código ou busque um produto antes de adicionar.')
      campoProduto.current?.focus()
      return
    }
    const fora = desativado(consulta)
    if (fora) { setErroBipe(avisoDesativado(fora.descricao)); return }
    const exato = produtos.find((produto) => !produto.inativo && (produto.codigo === consulta || produto.codigoBarras === consulta))
    if (exato) { incluirProduto(exato.codigo); return }
    if (sugestoes.length === 1) { incluirProduto(sugestoes[0].codigo); return }
    setSugestoesAbertas(sugestoes.length > 0)
    setErroBipe(sugestoes.length ? 'Escolha um produto da lista para adicionar.' : `Produto “${consulta}” não encontrado no catálogo.`)
  }

  function tecladoBusca(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Escape') { setSugestoesAbertas(false); return }
    if ((evento.key === 'ArrowDown' || evento.key === 'ArrowUp') && sugestoes.length) {
      evento.preventDefault()
      setSugestoesAbertas(true)
      setIndiceAtivo((atual) => atual < 0 ? (evento.key === 'ArrowDown' ? 0 : sugestoes.length - 1) : (atual + (evento.key === 'ArrowDown' ? 1 : -1) + sugestoes.length) % sugestoes.length)
    }
    if (evento.key === 'Enter' && sugestoesAbertas && indiceAtivo >= 0 && sugestoes[indiceAtivo]) {
      evento.preventDefault()
      incluirProduto(sugestoes[indiceAtivo].codigo)
    }
  }

  // O leitor vale para a tela toda: o código vem para o bloco de bipados com o
  // cursor onde estiver. Bipar de novo não duplica, só traz a linha para o topo.
  useLeitorCodigo((codigo) => {
    setTentouConfirmar(false)
    const fora = desativado(codigo)
    if (fora) {
      // Para a leitura: o aviso fica no lugar da busca, onde ela vê.
      pararLeitura()
      setBipe('')
      setSugestoesAbertas(false)
      setErroBipe(avisoDesativado(fora.descricao))
      return
    }
    const produto = produtos.find((p) => p.codigoBarras === codigo || p.codigo === codigo)
    const chave = produto?.codigoBarras ?? codigo
    setBipados((atual) => {
      const existente = atual.find((b) => b.codigoBarras === chave)
      const linha: Bipado = existente
        ? { ...existente, vezes: existente.vezes + 1 }
        : { codigoBarras: chave, produto: produto?.codigo, descricao: produto?.descricao, unidade: produto?.unidade, quantidade: '', unidadeEntrada: produto?.unidade ?? 'un', nome: '', vezes: 1 }
      return [linha, ...atual.filter((b) => b.codigoBarras !== chave)]
    })
    setBipe('')
    setErroBipe(null)
    setSugestoesAbertas(false)
    setLendo(true)
    setUltima((antes) => ({ titulo: produto?.descricao ?? 'Produto novo', codigo: chave, novo: !produto, vez: (antes?.vez ?? 0) + 1 }))
    setFocar((atual) => ({ codigo: chave, vez: (atual?.vez ?? 0) + 1 }))
  })

  useEffect(() => {
    if (!focar) return
    const campos = [...document.querySelectorAll<HTMLInputElement>(`[data-bipado="${focar.codigo}"] input`)]
    campos.find((campo) => !campo.value)?.focus()
  }, [focar])

  function lancarProntos() {
    setTentouConfirmar(false)
    const prontos = bipados.filter((b) => !falta(b))
    setItens((atual) => prontos.reduce((lista, bipado) => {
      const quantidade = paraQuantidade(bipado.quantidade) ?? 1
      const codigo = bipado.produto ?? `novo:${bipado.codigoBarras}`
      if (lista.some((item) => item.codigo === codigo)) {
        return lista.map((item) => item.codigo === codigo ? { ...item, quantidade: item.quantidade + quantidade } : item)
      }
      const item: ItemEntrada | null = bipado.produto
        ? itemDoCatalogo(bipado.produto, produtos)
        : bipado.rascunho
          ? { codigo, codigoBarras: bipado.codigoBarras, descricao: bipado.rascunho.descricao, detalhe: bipado.rascunho.categoria, unidade: bipado.rascunho.unidade, saldoAtual: 0, quantidade, custo: bipado.rascunho.custo, novo: bipado.rascunho }
          : null
      return item ? [...lista, { ...item, quantidade }] : lista
    }, atual))
    setBipados((atual) => atual.filter((b) => falta(b)))
  }

  // "Completar cadastro": abre o mesmo formulário do Estoque, sem quantidade
  // inicial. Nada é gravado aí: o cadastro fica preparado na linha e o produto
  // só nasce no "Confirmar entrada". Cancelou a entrada, não sobra produto.
  const [completando, setCompletando] = useState<ProdutoDaEntrada | null>(null)

  function abrirCadastro(codigoBarras: string) {
    const bipado = bipados.find((b) => b.codigoBarras === codigoBarras)
    const item = itens.find((i) => i.novo && i.codigoBarras === codigoBarras)
    const nome = bipado?.nome.trim() ?? item?.descricao ?? ''
    const quantidade = bipado ? paraQuantidade(bipado.quantidade) : item?.quantidade ?? null
    setCompletando({ codigoBarras, nome, chegouEm: bipado ? unidadeBase(bipado) : item?.unidade ?? 'un', quantidade, rascunho: bipado?.rascunho ?? item?.novo })
  }

  // O cadastro devolve o que entra no estoque já na unidade de venda (2 caixas de 20 = 40 un).
  function cadastroPreparado(rascunho: RascunhoProduto, quantidade: number | null) {
    setTentouConfirmar(false)
    const codigoBarras = completando?.codigoBarras
    setCompletando(null)
    if (!codigoBarras) return
    setBipados((atual) => atual.map((b) => b.codigoBarras === codigoBarras
      ? { ...b, rascunho, nome: rascunho.descricao, unidade: rascunho.unidade, unidadeEntrada: rascunho.unidade, quantidade: quantidade === null ? b.quantidade : String(quantidade) }
      : b))
    setItens((atual) => atual.map((item) => item.novo && item.codigoBarras === codigoBarras
      ? { ...item, novo: rascunho, descricao: rascunho.descricao, detalhe: rascunho.categoria, unidade: rascunho.unidade, custo: rascunho.custo, quantidade: quantidade ?? item.quantidade }
      : item))
  }

  function confirmar() {
    if (bipados.length > 0) {
      setTentouConfirmar(true)
      requestAnimationFrame(() => {
        const campos = [...document.querySelectorAll<HTMLInputElement>('.bipados__linha input')]
        const alvo = campos.find((campo) => !campo.value) ?? campos[0]
        alvo?.scrollIntoView({ block: 'center' })
        alvo?.focus({ preventScroll: true })
      })
      return
    }
    if (itens.length === 0) return
    itens.forEach((item) => {
      if (item.novo) {
        const codigo = cadastrarProduto({ ...item.novo, saldo: 0 })
        alterarSaldo(codigo, item.quantidade, 'Recebimento de mercadorias', 'Entrada')
        return
      }
      alterarSaldo(item.codigo, (produtos.find((produto) => produto.codigo === item.codigo)?.saldo ?? item.saldoAtual) + item.quantidade, 'Recebimento de mercadorias', 'Entrada')
    })
    navegar(rotas.movimentacoesEstoque())
  }

  const totalUnidades = itens.reduce((soma, i) => soma + i.quantidade, 0)
  const custoTotal = itens.reduce((soma, i) => soma + (i.custo ?? 0) * i.quantidade, 0)

  return (
    <Tela
      voltar={{ para: rotas.estoque, rotulo: 'Voltar para estoque' }}
      trilha={
        <>
          <Link className="registrar-entrada__trilha-link" to={rotas.estoque}>
            Estoque
          </Link>{' '}
          / Registrar entrada
        </>
      }
      titulo="Registrar entrada de mercadorias"
      subtitulo="Recebimento de compras e reposição do estoque do balcão."
      acoesTitulo={
        <button type="button" className="registrar-entrada__ajuste" onClick={() => navegar(rotas.ajustarEstoque())}>
          Só corrigir contagem?<br />Use Ajustar estoque
        </button>
      }
    >
      <Painel className="registrar-entrada__dados">
        <div className="registrar-entrada__campos">
          <Campo rotulo="Data do recebimento" type="date" defaultValue={hojeISO()} />
          <Campo rotulo="Fornecedor" opcional icone="caminhao" placeholder="Ex.: Distribuidora Tilibra & Papéis SP" />
          <Campo rotulo="Referência da compra" opcional icone="recibo" placeholder="Ex.: NF-e 45.892 (pedido 1.203)" />
          <Campo rotulo="Observações" opcional placeholder="Ex.: Entrega da manhã, 3 volumes" />
        </div>
      </Painel>

      <Painel
        colado
        titulo={lendo ? (
          <PainelLeitor ultima={ultima} aoParar={pararLeitura} />
        ) : (
          <form className="registrar-entrada__bipe" onSubmit={adicionar} onBlur={(evento) => { if (!evento.currentTarget.contains(evento.relatedTarget)) setSugestoesAbertas(false) }}>
            <label className={erroBipe ? 'registrar-entrada__leitor registrar-entrada__leitor--erro' : 'registrar-entrada__leitor'}>
              <Icone nome="codigo-barras" tamanho={20} />
              <input
                ref={campoProduto}
                value={bipe}
                onChange={(e) => { setBipe(e.target.value); setIndiceAtivo(-1); setSugestoesAbertas(Boolean(e.target.value.trim())); setErroBipe(null) }}
                onFocus={() => setSugestoesAbertas(Boolean(bipe.trim()))}
                onKeyDown={tecladoBusca}
                placeholder="Bipe o código ou busque pelo nome..."
                aria-label="Buscar produto por nome, código interno ou código de barras"
                aria-invalid={Boolean(erroBipe)}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={sugestoesAbertas && sugestoes.length > 0}
                aria-controls="registrar-entrada-sugestoes"
                aria-activedescendant={sugestoesAbertas && indiceAtivo >= 0 ? `registrar-entrada-sugestao-${indiceAtivo}` : undefined}
              />
            </label>
            <Botao type="submit" icone="mais">
              Adicionar item
            </Botao>
            {sugestoesAbertas && (
              <div id="registrar-entrada-sugestoes" className="registrar-entrada__sugestoes" role="listbox" aria-label="Produtos encontrados">
                {sugestoes.length ? sugestoes.map((produto, indice) => (
                  <button
                    key={produto.codigo}
                    id={`registrar-entrada-sugestao-${indice}`}
                    type="button"
                    role="option"
                    aria-selected={indice === indiceAtivo}
                    className={indice === indiceAtivo ? 'registrar-entrada__sugestao registrar-entrada__sugestao--ativa' : 'registrar-entrada__sugestao'}
                    onMouseEnter={() => setIndiceAtivo(indice)}
                    onClick={() => incluirProduto(produto.codigo)}
                  >
                    <strong>{produto.codigo} · {produto.descricao}</strong>
                    <span>{produto.codigoBarras ?? 'Sem código de barras'} · saldo {produto.saldo} {produto.unidade}</span>
                  </button>
                )) : <span className="registrar-entrada__sem-resultados">Nenhum produto encontrado.</span>}
              </div>
            )}
            <Botao icone="codigo-barras" onClick={() => setLendo(true)}>
              Ler códigos
            </Botao>
            {erroBipe && <span className="registrar-entrada__erro">{erroBipe}</span>}
          </form>
        )}
      >
        <BlocoBipados
          bipados={bipados}
          aoMudar={(codigoBarras, campos) => { setTentouConfirmar(false); setBipados((atual) => atual.map((b) => b.codigoBarras === codigoBarras ? { ...b, ...campos } : b)) }}
          aoRemover={(codigoBarras) => { setTentouConfirmar(false); setBipados((atual) => atual.filter((b) => b.codigoBarras !== codigoBarras)) }}
          aoLancar={lancarProntos}
          aoLimpar={() => { setTentouConfirmar(false); setBipados([]) }}
          aoCompletar={abrirCadastro}
          mostrarAviso={tentouConfirmar}
        />
        <Tabela larguraMinima={880} className="registrar-entrada__tabela">
          <thead>
            <tr>
              <th>Código</th>
              <th>Produto</th>
              <th className="celula--numero">Saldo atual</th>
              <th className="celula--centro">Entrada</th>
              <th className="celula--numero">Novo saldo</th>
              <th className="celula--numero">Custo unit.</th>
              <th className="celula--numero">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item.codigo} className={item.saldoAtual === 0 && !item.novo ? 'linha--critica' : undefined}>
                <td>
                  {item.novo
                    ? <button type="button" className="registrar-entrada__completar" onClick={() => abrirCadastro(item.codigoBarras ?? '')} title="Editar cadastro">
                        <SeloCompacto tom="atencao">Novo · editar</SeloCompacto>
                      </button>
                    : <span className="celula-principal codigo">{item.codigo}</span>}
                  <span className="celula-secundaria codigo">{item.codigoBarras ?? 'Sem código'}</span>
                </td>
                <td>
                  <span className="celula-principal registrar-entrada__produto" title={item.descricao}>
                    {item.descricao}
                  </span>
                  <span className="celula-secundaria">{item.detalhe}</span>
                </td>
                <td className="celula--numero">
                  {/* Produto novo nunca teve saldo: não é falta, é o começo. */}
                  {item.novo ? '—' : item.saldoAtual === 0 ? (
                    <SeloCompacto tom="critico">Zerado</SeloCompacto>
                  ) : (
                    `${item.saldoAtual} ${item.unidade}`
                  )}
                </td>
                <td className="celula--centro">
                  <label className="registrar-entrada__qtd">
                    <span aria-hidden>+</span>
                    <input
                      type="number"
                      min={1}
                      value={item.quantidade}
                      onChange={(e) => mudarQuantidade(item.codigo, Number(e.target.value))}
                      aria-label={`Quantidade de ${item.descricao}`}
                    />
                    <span>{item.unidade}</span>
                  </label>
                </td>
                <td className="celula--numero registrar-entrada__novo">
                  {item.saldoAtual + item.quantidade} {item.unidade}
                </td>
                <td className="celula--numero">{item.custo ? reais(item.custo) : '—'}</td>
                <td className="celula--numero registrar-entrada__total">
                  {item.custo ? reais(item.custo * item.quantidade) : '—'}
                </td>
                <td className="celula--acoes">
                  <BotaoIcone
                    icone="lixeira"
                    rotulo="Remover item"
                    onClick={() => setItens((atual) => atual.filter((x) => x.codigo !== item.codigo))}
                  />
                </td>
              </tr>
            ))}
            {itens.length === 0 && (
              <tr>
                <td colSpan={8} className="registrar-entrada__vazio">
                  Nenhum item. Bipe um produto ou digite o código acima.
                </td>
              </tr>
            )}
          </tbody>
        </Tabela>
      </Painel>

      <div className="registrar-entrada__rodape">
        <p className="registrar-entrada__nota">
          <Icone nome="info" tamanho={18} />
          Ao confirmar, o saldo é atualizado.
        </p>
        <dl className="registrar-entrada__resumo">
          <div>
            <dt>Itens</dt>
            <dd>
              {itens.length} {itens.length === 1 ? 'produto' : 'produtos'}
            </dd>
          </div>
          <div>
            <dt>Quantidade</dt>
            <dd>+ {totalUnidades}</dd>
          </div>
          <div>
            <dt>Custo informado</dt>
            <dd>{reais(custoTotal)}</dd>
          </div>
        </dl>
      </div>

      <div className="registrar-entrada__acoes">
        <Botao variante="fantasma" onClick={() => navegar(rotas.estoque)}>
          Cancelar
        </Botao>
        <Botao variante="primario" icone="check" disabled={itens.length === 0 && bipados.length === 0} onClick={confirmar}>
          Confirmar entrada
        </Botao>
      </div>
      {completando && <ModalProduto daEntrada={completando} aoFechar={() => setCompletando(null)} aoPreparar={cadastroPreparado} />}
    </Tela>
  )
}
