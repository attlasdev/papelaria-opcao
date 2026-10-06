import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { Modal } from '../../componentes/modal/Modal'
import { Botao } from '../../componentes/botao/Botao'
import { Campo, Selecao } from '../../componentes/campo/Campo'
import { CampoMoeda } from '../../componentes/campo/CampoMoeda'
import { Icone } from '../../componentes/icone/Icone'
import { centavosDeTexto } from '../../formatar'
import { useLeitorCodigo } from '../../leitor/useLeitorCodigo'
import { rotas } from '../../rotas-caminhos'
import type { Produto, Unidade } from '../../mock/base/tipos'
import { cadastrarProduto, completarProduto, definirProdutoAtivo, editarProduto, excluirProduto, produtoTemHistorico, proximoCodigoProduto, useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { Estoque } from '../estoque/Estoque'
import { unidades } from './constantes'
import { CampoCategoria } from './CampoCategoria'
// Dados fiscais fora da tela desde 2026-10-06 (decisão do Agostinho): a dona os
// preenche na própria Emitte, que é quem os exige. O código fica comentado abaixo
// para voltar se a decisão mudar. Ver Memoria.md.
// import { conferirFiscalProduto, FISCAL_PRODUTO_PADRAO, gtinValido, limparFiscalProduto, ORIGENS, TRIBUTACOES } from '../../dados/fiscal'
import './cadastrar-produto.css'

/** Abre sobre o Estoque: a lista continua visível atrás da janela. */
export function CadastrarProduto() {
  const navegar = useNavigate()
  const fechar = useCallback(() => navegar(rotas.estoque), [navegar])
  return (
    <>
      <Estoque />
      <ModalProduto aoFechar={fechar} aoSalvar={fechar} />
    </>
  )
}

/** Completar um cadastro rápido, também sobre o Estoque, já filtrado nos pendentes. */
export function CompletarProduto() {
  return <SobreProduto modo="completar" />
}

/** Corrigir um produto já cadastrado; excluir ou desativar sai daqui também. */
export function EditarProduto() {
  return <SobreProduto modo="editar" />
}

function SobreProduto({ modo }: { modo: 'completar' | 'editar' }) {
  const navegar = useNavigate()
  const { codigo } = useParams()
  const produto = useEstadoDemonstracao().produtos.find((p) => p.codigo === codigo)
  const fechar = useCallback(() => navegar(modo === 'completar' ? rotas.estoqueACompletar : rotas.estoque), [navegar, modo])
  // Guardado na abertura: o modal não troca de produto no meio. Já completo ou
  // código inexistente: não há o que abrir.
  const [alvo] = useState(modo === 'editar' || produto?.cadastroRapido ? produto : undefined)
  useEffect(() => { if (!alvo) fechar() }, [alvo, fechar])
  return (
    <>
      <Estoque />
      {alvo && <ModalProduto completar={modo === 'completar' ? alvo : undefined} editar={modo === 'editar' ? alvo : undefined} aoFechar={fechar} aoSalvar={fechar} />}
    </>
  )
}

/**
 * O que a entrada de mercadorias já sabe do produto novo: código, nome e o que
 * ela anotou na linha do jeito mais rápido de ler a nota ("40 unidades" ou
 * "2 caixas"). O detalhe de como veio embalado fica aqui no cadastro.
 */
export type ProdutoDaEntrada = {
  codigoBarras: string
  nome: string
  chegouEm: Unidade
  quantidade: number | null
  /** Já preparado antes: reabrir mostra o que ela preencheu. */
  rascunho?: RascunhoProduto
}

/** Cadastro preparado na entrada. Só vira produto no "Confirmar entrada". */
export type RascunhoProduto = Omit<Produto, 'codigo'>

/** `quantos`: a pergunta com o gênero certo ("Quantos pacotes", "Quantas caixas"). */
const nomes: Record<Unidade, { um: string; varios: string; quantos: string }> = {
  un: { um: 'unidade', varios: 'unidades', quantos: 'Quantas unidades' },
  pct: { um: 'pacote', varios: 'pacotes', quantos: 'Quantos pacotes' },
  cx: { um: 'caixa', varios: 'caixas', quantos: 'Quantas caixas' },
}

type PropsModal = {
  aoFechar: () => void
  /** Aberto pelo Estoque ou pela ficha: grava e devolve o produto. */
  /** `quantidade`: só pela ficha, quantas unidades vão para a venda. */
  aoSalvar?: (codigo: string, produto: RascunhoProduto, quantidade?: number) => void
  /**
   * Aberto pela entrada: nada é gravado. Volta o cadastro preparado e o que entra
   * no estoque, já na unidade de venda (null mantém a quantidade da linha).
   */
  aoPreparar?: (rascunho: RascunhoProduto, quantidade: number | null) => void
  /**
   * Aberto pela entrada de mercadorias: vem com código, nome e unidade, sem os
   * sem "Quantidade inicial" — quem soma no estoque é a
   * quantidade da entrada; com os dois, a mercadoria entraria em dobro.
   */
  daEntrada?: ProdutoDaEntrada
  /** Aberto sobre uma venda: cadastro essencial e estoque inicial zero. */
  naFicha?: boolean
  /** Cadastro rápido feito numa venda: abre preenchido, pede o resto e a contagem. */
  completar?: Produto
  /** Produto já cadastrado: corrige dados, sem mexer no saldo. */
  editar?: Produto
  codigoInicial?: string
}

type CampoCadastro = 'codigoBarras' | 'nome' | 'categoria' | 'unidade' | 'preco' | 'quantidadeVendida' | 'custo' | 'saldo' | 'minimo' | 'embalagem' | 'ncm' | 'cest' | 'cfopEstadual' | 'cfopInterestadual'

export function ModalProduto({ aoFechar: fechar, aoSalvar, aoPreparar, daEntrada, naFicha = false, completar, editar, codigoInicial = '' }: PropsModal) {
  const existente = completar ?? editar
  const [semCodigo, setSemCodigo] = useState(Boolean(existente && !existente.codigoBarras))
  const [codigoBarras, setCodigoBarras] = useState(daEntrada?.codigoBarras ?? existente?.codigoBarras ?? codigoInicial)
  const [codigoConsultado, setCodigoConsultado] = useState('')
  const [lendoCodigo, setLendoCodigo] = useState(false)
  const [leituras, setLeituras] = useState(0)
  const idCodigoBarras = useId()
  const campoCodigoBarras = useRef<HTMLInputElement>(null)
  const [erroSalvar, setErroSalvar] = useState('')
  const [erros, setErros] = useState<Partial<Record<CampoCadastro, string>>>({})

  function limparErro(campo: CampoCadastro) {
    setErros((atual) => ({ ...atual, [campo]: undefined }))
    setErroSalvar('')
  }
  useLeitorCodigo((codigo) => {
    setCodigoBarras(codigo)
    setCodigoConsultado(codigo)
    setLendoCodigo(false)
    setLeituras((atual) => atual + 1)
    setErros((atual) => ({ ...atual, codigoBarras: undefined }))
    setErroSalvar('')
  }, !daEntrada && lendoCodigo && !semCodigo)

  useEffect(() => {
    if (!lendoCodigo) return
    function parar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        evento.preventDefault()
        evento.stopPropagation()
        setLendoCodigo(false)
      }
    }
    window.addEventListener('keydown', parar, true)
    return () => window.removeEventListener('keydown', parar, true)
  }, [lendoCodigo])
  // Como veio embalado: "2 caixas com 20 unidades cada". A linha da entrada anota
  // o que a nota mostra; aqui ela detalha, e o estoque entra na unidade de venda.
  const chegou = daEntrada?.chegouEm ?? 'un'
  // Começa igual ao que ela marcou na linha; ela troca se vender o conteúdo separado.
  const [unidadeVenda, setUnidadeVenda] = useState<Unidade>(daEntrada?.rascunho?.unidade ?? existente?.unidade ?? chegou)
  const [embalado, setEmbalado] = useState(chegou !== 'un')
  const [embalagem, setEmbalagem] = useState<'cx' | 'pct'>(chegou === 'pct' ? 'pct' : 'cx')
  // O que ela anotou na linha já vem aqui; muda junto se ela corrigir.
  const [qtdChegou, setQtdChegou] = useState(daEntrada?.quantidade ? String(daEntrada.quantidade) : '')
  const nChegou = Number(qtdChegou)
  const [qtdEmbalagens, setQtdEmbalagens] = useState(chegou !== 'un' && daEntrada?.quantidade ? String(daEntrada.quantidade) : '')
  const [porEmbalagem, setPorEmbalagem] = useState('')
  // Caixa pode trazer pacotes, e o pacote as unidades: 4 caixas × 10 pacotes × 12 un.
  // Preenche o que o produto tiver; a unidade de venda diz o que é obrigatório.
  const [pacotesPorCaixa, setPacotesPorCaixa] = useState('')
  const nEmbalagens = Number(qtdEmbalagens)
  const nDentro = Number(porEmbalagem)
  const nPacotes = embalagem === 'cx' ? Number(pacotesPorCaixa) : 0
  const totalPacotes = embalagem === 'pct' ? nEmbalagens : nEmbalagens > 0 && nPacotes > 0 ? nEmbalagens * nPacotes : null
  const totalUnidades = nEmbalagens > 0 && nDentro > 0 ? (nPacotes > 0 ? nEmbalagens * nPacotes * nDentro : nEmbalagens * nDentro) : null
  const dentroDe = nPacotes > 0 ? 'pct' : embalagem

  /** O que entra no estoque, na unidade de venda. Texto: o motivo de não dar. */
  function quantidadeFinal(): number | null | string {
    if (!daEntrada) return null
    if (!embalado) {
      if (chegou !== unidadeVenda) return `Marque "Veio em caixa ou pacote" e diga quantas unidades vêm em cada ${nomes[chegou].um}.`
      return Number.isInteger(nChegou) && nChegou > 0 ? nChegou : `Informe ${nomes[chegou].quantos.toLowerCase()} chegaram.`
    }
    if (!(nEmbalagens > 0)) return `Informe ${nomes[embalagem].quantos.toLowerCase()} chegaram.`
    if (unidadeVenda === embalagem) return nEmbalagens
    if (unidadeVenda === 'un') return totalUnidades ?? `Informe quantas unidades vêm em cada ${nomes[dentroDe].um}.`
    if (unidadeVenda === 'pct' && embalagem === 'cx') return totalPacotes ?? 'Informe quantos pacotes vêm em cada caixa.'
    return `Vendido por ${nomes[unidadeVenda].um}, mas veio em ${nomes[embalagem].um}: escolha a unidade de venda ou a embalagem certa.`
  }

  // Linha dizia "40 unidades" e ela informou 2 caixas: sugere 20 por caixa.
  function mudarEmbalagens(texto: string) {
    setQtdEmbalagens(texto)
    const n = Number(texto)
    const linha = chegou === 'un' ? nChegou : 0
    if (chegou === 'un' && linha && n > 0 && linha % n === 0) setPorEmbalagem(String(linha / n))
  }
  const base = useEstadoDemonstracao()
  const { produtos } = base
  const proximoCodigo = proximoCodigoProduto(base)
  const categoriasExistentes = [...new Set(produtos.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const duplicado = semCodigo ? undefined : produtos.find((p) => codigoBarras && p.codigo !== existente?.codigo && p.codigoBarras === codigoBarras.trim())
  const produtoConsultado = !daEntrada && duplicado?.codigoBarras === codigoConsultado ? duplicado : undefined

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const formulario = evento.currentTarget
    const dados = new FormData(formulario)
    const nome = String(dados.get('nome') ?? '').trim()
    const digitada = String(dados.get('categoria') ?? '').trim()
    // Mesmo nome com outra caixa ou sem acento é a mesma categoria: não duplica o filtro do Estoque.
    const categoria = categoriasExistentes.find((c) => c.localeCompare(digitada, 'pt-BR', { sensitivity: 'base' }) === 0) ?? digitada
    const unidade = String(dados.get('unidade') ?? '').slice(0, String(dados.get('unidade') ?? '').indexOf(' ')) as Unidade
    const preco = centavosDeTexto(String(dados.get('preco') ?? ''))
    const textoSaldo = String(dados.get('saldo') ?? '').trim()
    const saldo = naFicha ? 0 : editar ? editar.saldo : Number(textoSaldo)
    const textoCusto = String(dados.get('custo') ?? '').trim()
    const custo = textoCusto ? centavosDeTexto(textoCusto) : undefined
    const opcional = (campo: string) => String(dados.get(campo) ?? '').trim() || undefined
    const minimo = naFicha ? 0 : Number(dados.get('minimo'))
    const vendida = Number(dados.get('quantidadeVendida'))
    const final = quantidadeFinal()
    const falhas: Partial<Record<CampoCadastro, string>> = {}
    if (duplicado) falhas.codigoBarras = `Este código já está cadastrado em ${duplicado.codigo}.`
    if (!nome) falhas.nome = 'Informe o nome do produto.'
    if (!categoria) falhas.categoria = 'Escolha ou crie uma categoria.'
    if (!['un', 'pct', 'cx'].includes(unidade)) falhas.unidade = 'Escolha a unidade de venda.'
    if (!Number.isSafeInteger(preco) || preco <= 0) falhas.preco = 'Informe um preço de venda maior que zero.'
    if (custo !== undefined && (!Number.isSafeInteger(custo) || custo < 0)) falhas.custo = 'Confira o custo informado.'
    if (completar && !textoSaldo) falhas.saldo = 'Conte a prateleira e informe a quantidade.'
    else if (!daEntrada && (!Number.isInteger(saldo) || saldo < 0)) falhas.saldo = 'Informe uma quantidade válida.'
    if (!Number.isInteger(minimo) || minimo < 0) falhas.minimo = 'Informe um estoque mínimo válido.'
    if (naFicha && (!Number.isInteger(vendida) || vendida < 1)) falhas.quantidadeVendida = 'Informe quantas unidades vão para a ficha.'
    if (typeof final === 'string') falhas.embalagem = final
    // Fora da tela (ver o import comentado no topo). Editar não apaga o que já havia.
    // const fiscal = naFicha ? undefined : limparFiscalProduto({
    //   tributacao: String(dados.get('tributacao') ?? ''), origem: String(dados.get('origem') ?? ''),
    //   cfopEstadual: String(dados.get('cfopEstadual') ?? ''), cfopInterestadual: String(dados.get('cfopInterestadual') ?? ''),
    //   ncm: String(dados.get('ncm') ?? ''), cest: String(dados.get('cest') ?? ''),
    // })
    // if (fiscal) Object.assign(falhas, conferirFiscalProduto(fiscal))
    const fiscal = existente?.fiscal
    const primeira = (['codigoBarras', 'nome', 'categoria', 'unidade', 'preco', 'quantidadeVendida', 'custo', 'saldo', 'minimo', 'embalagem', 'ncm', 'cest', 'cfopEstadual', 'cfopInterestadual'] as CampoCadastro[]).find((campo) => falhas[campo])
    if (primeira) {
      setErros(falhas)
      setErroSalvar(falhas[primeira]!)
      requestAnimationFrame(() => {
        const alvo = primeira === 'categoria' || primeira === 'embalagem'
          ? formulario.querySelector<HTMLElement>(`[data-campo="${primeira}"]`)
          : formulario.querySelector<HTMLElement>(`[name="${primeira}"]`)
        alvo?.scrollIntoView({ block: 'center' })
        alvo?.focus({ preventScroll: true })
      })
      return
    }
    const grupo = categoria.includes('Caderno') ? 'cadernos' as const : categoria.includes('Escrita') ? 'escrita' as const : categoria.includes('Papéis') ? 'papeis' as const : categoria.includes('Escritório') ? 'escritorio' as const : 'artes' as const
    const dadosProduto: RascunhoProduto = { codigoBarras: semCodigo ? undefined : codigoBarras.trim() || undefined, descricao: nome, categoria, grupo, unidade, preco, saldo: daEntrada ? 0 : saldo, minimo,
      custo, localizacao: opcional('localizacao'), marca: opcional('marca'), caracteristicas: opcional('caracteristicas'), descricaoAdicional: opcional('descricaoAdicional'), fiscal,
      conteudo: daEntrada && embalado && (nPacotes > 0 || nDentro > 0)
        ? { embalagem, pacotes: nPacotes > 0 ? nPacotes : undefined, unidades: nDentro > 0 ? nDentro : undefined }
        : undefined }
    // Pela entrada, só prepara: o produto nasce junto com o estoque, ao confirmar a entrada.
    if (daEntrada) {
      aoPreparar?.(dadosProduto, typeof final === 'string' ? null : final)
      return
    }
    if (editar) {
      const { saldo: _saldo, ...cadastro } = dadosProduto
      if (editarProduto(editar.codigo, cadastro)) aoSalvar?.(editar.codigo, dadosProduto)
      return
    }
    if (completar) {
      const { saldo: contagem, ...cadastro } = dadosProduto
      if (completarProduto(completar.codigo, cadastro, contagem)) aoSalvar?.(completar.codigo, dadosProduto)
      return
    }
    // Pela ficha, o produto nasce marcado: o Estoque cobra o resto do cadastro e a contagem.
    aoSalvar?.(cadastrarProduto(naFicha ? { ...dadosProduto, cadastroRapido: true } : dadosProduto), dadosProduto, naFicha ? vendida : undefined)
  }

  const r = daEntrada?.rascunho ?? existente
  // const fiscalInicial = produtoConsultado?.fiscal ?? r?.fiscal ?? FISCAL_PRODUTO_PADRAO
  const inicial = existente
    ? { nome: existente.descricao, preco: existente.preco, custo: existente.custo ?? null, localizacao: existente.localizacao ?? '', minimo: editar ? String(editar.minimo) : '' }
    : produtoConsultado
    ? { nome: produtoConsultado.descricao, preco: produtoConsultado.preco, custo: produtoConsultado.custo ?? null, localizacao: produtoConsultado.localizacao ?? '', minimo: String(produtoConsultado.minimo) }
    : daEntrada
    ? { nome: r?.descricao ?? daEntrada.nome, preco: r?.preco ?? null, custo: r?.custo ?? null, localizacao: r?.localizacao ?? '', minimo: r ? String(r.minimo) : '' }
    : { nome: '', preco: null, custo: null, localizacao: '', minimo: '' }

  return (
      <Modal
        estreito={naFicha}
        titulo={produtoConsultado ? 'Produto já cadastrado' : completar ? 'Completar cadastro' : editar ? 'Editar produto' : naFicha ? 'Cadastro rápido' : 'Cadastrar produto'}
        subtitulo={produtoConsultado
          ? 'Código reconhecido. Os dados abaixo são do produto existente.'
          : editar ? 'O saldo muda só por entrada ou ajuste.'
          : completar ? 'Feito na venda. Complete os dados e conte a prateleira.'
          : naFicha ? 'Só o essencial para vender. O resto fica pendente no Estoque.'
          : daEntrada ? 'A quantidade vem da entrada.' : undefined}
        aoFechar={fechar}
        rodape={
          produtoConsultado ? <Botao variante="primario" onClick={fechar}>Fechar</Botao> : (
            <>
              {editar && <AcaoRemover produto={editar} aoConcluir={fechar} />}
              <span className={erroSalvar ? 'cadastrar-produto__lembrete cadastrar-produto__lembrete--erro' : 'cadastrar-produto__lembrete'} role={erroSalvar ? 'alert' : undefined}>
                {erroSalvar}
              </span>
              <Botao variante="fantasma" onClick={fechar}>
                Cancelar
              </Botao>
              <Botao variante="primario" icone="check" type="submit" form="cadastrar-produto-formulario">
                {naFicha ? 'Cadastrar e adicionar' : completar ? 'Salvar cadastro completo' : editar ? 'Salvar alterações' : 'Salvar produto'}
              </Botao>
            </>
          )
        }
      >
        <form key={produtoConsultado?.codigo ?? 'novo'} id="cadastrar-produto-formulario" onSubmit={salvar} noValidate>
        <section className="cadastrar-produto__grupo">
          <h3 className="cadastrar-produto__titulo">Dados principais</h3>
          <div className="cadastrar-produto__grade">
            <Campo rotulo="Código interno" value={produtoConsultado?.codigo ?? existente?.codigo ?? proximoCodigo} readOnly />
            <div className="cadastrar-produto__barras">
              {daEntrada ? (
                <Campo
                  rotulo="Código de barras"
                  icone="codigo-barras"
                  name="codigoBarras"
                  placeholder="Bipe o produto ou digite o código"
                  disabled={semCodigo}
                  value={semCodigo ? '' : codigoBarras}
                  onChange={(e) => { setCodigoBarras(e.target.value); limparErro('codigoBarras') }}
                  erro={Boolean(duplicado)}
                  ajuda={duplicado ? `Este código já está cadastrado em ${duplicado.codigo}.` : undefined}
                />
              ) : (
                <div className="campo cadastrar-produto__codigo-campo">
                  <label className="campo__rotulo" htmlFor={idCodigoBarras}>Código de barras</label>
                  <div
                    className={produtoConsultado ? 'campo__caixa cadastrar-produto__codigo-campo--consultado' : duplicado ? 'campo__caixa campo__caixa--erro' : 'campo__caixa'}
                    onBlur={(evento) => {
                      if (!evento.currentTarget.contains(evento.relatedTarget)) setLendoCodigo(false)
                    }}
                  >
                    <button
                      type="button"
                      className={lendoCodigo ? 'cadastrar-produto__acionar-leitor cadastrar-produto__acionar-leitor--ativo' : 'cadastrar-produto__acionar-leitor'}
                      aria-label={lendoCodigo ? 'Parar leitura de código de barras' : 'Ativar leitura de código de barras'}
                      aria-pressed={lendoCodigo}
                      title={lendoCodigo ? 'Parar leitura (Esc)' : 'Ler código de barras'}
                      disabled={semCodigo}
                      onClick={() => { setLendoCodigo((atual) => !atual); campoCodigoBarras.current?.focus() }}
                    >
                      <Icone nome="codigo-barras" tamanho={18} />
                      {lendoCodigo && <span className="cadastrar-produto__laser" aria-hidden />}
                      {leituras > 0 && <span key={leituras} className="cadastrar-produto__leitura-feita" aria-hidden />}
                    </button>
                    <input
                      id={idCodigoBarras}
                      name="codigoBarras"
                      ref={campoCodigoBarras}
                      value={semCodigo ? '' : codigoBarras}
                      onChange={(evento) => { setCodigoBarras(evento.target.value); setCodigoConsultado(''); limparErro('codigoBarras') }}
                      placeholder={lendoCodigo ? 'Pronto para ler · Esc para parar' : 'Bipe o produto ou digite o código'}
                      disabled={semCodigo}
                      aria-invalid={Boolean(duplicado && !produtoConsultado)}
                      aria-describedby={`${idCodigoBarras}-ajuda`}
                    />
                  </div>
                  <span id={`${idCodigoBarras}-ajuda`} className={produtoConsultado ? 'campo__ajuda cadastrar-produto__codigo-ajuda--consultado' : duplicado ? 'campo__ajuda campo__ajuda--erro' : 'campo__ajuda'} role={produtoConsultado ? 'status' : duplicado ? 'alert' : undefined}>
                    {produtoConsultado ? `Cadastrado em ${produtoConsultado.codigo}. Para cadastrar outro produto, informe outro código.` : duplicado ? `Este código já está cadastrado em ${duplicado.codigo}.` : undefined}
                  </span>
                </div>
              )}
              <label className="cadastrar-produto__marcar">
                <input type="checkbox" checked={semCodigo} onChange={(e) => { setSemCodigo(e.target.checked); if (e.target.checked) { setLendoCodigo(false); setCodigoConsultado(''); setCodigoBarras('') } }} />
                Produto sem código de barras
              </label>
            </div>
            <Campo rotulo="Nome do produto" name="nome" required defaultValue={inicial.nome} readOnly={Boolean(produtoConsultado)} autoFocus={Boolean(daEntrada || naFicha)} className="cadastrar-produto__largo" erro={Boolean(erros.nome)} ajuda={erros.nome} onChange={() => limparErro('nome')} />
            {produtoConsultado
              ? <Campo rotulo="Categoria" value={produtoConsultado.categoria} readOnly />
              : <CampoCategoria name="categoria" existentes={categoriasExistentes} inicial={r?.categoria} erro={erros.categoria} aoMudar={() => limparErro('categoria')} />}
            <Selecao
              rotulo="Unidade de venda"
              name="unidade"
              opcoes={unidades}
              valorInicial={unidades.find((u) => u.startsWith(`${unidadeVenda} `))}
              valor={produtoConsultado ? unidades.find((u) => u.startsWith(`${produtoConsultado.unidade} `)) : undefined}
              disabled={Boolean(produtoConsultado)}
              erro={Boolean(erros.unidade)}
              aoMudar={(valor) => { setUnidadeVenda(valor.slice(0, valor.indexOf(' ')) as Unidade); limparErro('unidade') }}
              ajuda={erros.unidade ?? 'O estoque é contado nela.'}
            />
            {daEntrada && (
              <div className={erros.embalagem ? 'cadastrar-produto__embalagem cadastrar-produto__embalagem--erro cadastrar-produto__largo' : 'cadastrar-produto__embalagem cadastrar-produto__largo'} data-campo="embalagem" tabIndex={-1}>
                <label className="cadastrar-produto__marcar">
                  <input type="checkbox" checked={embalado} onChange={(e) => { setEmbalado(e.target.checked); limparErro('embalagem') }} />
                  Veio em caixa ou pacote
                </label>
                {!embalado && (
                  <div className="cadastrar-produto__grade">
                    <Campo
                      rotulo={`${nomes[chegou].quantos} chegaram?`}
                      value={qtdChegou}
                      onChange={(e) => { setQtdChegou(e.target.value.replace(/\D/g, '')); limparErro('embalagem') }}
                      inputMode="numeric"
                      ajuda="Veio da linha da entrada. Corrija se precisar."
                    />
                  </div>
                )}
                {embalado && (
                  <>
                    <div className="cadastrar-produto__dentro">
                      <span>Embalagem</span>
                      <div className="cadastrar-produto__segmento" role="radiogroup" aria-label="Embalagem">
                        {(['cx', 'pct'] as const).map((opcao) => (
                          <button
                            key={opcao}
                            type="button"
                            role="radio"
                            aria-checked={embalagem === opcao}
                            className={embalagem === opcao ? 'cadastrar-produto__segmento-opcao cadastrar-produto__segmento-opcao--ativa' : 'cadastrar-produto__segmento-opcao'}
                            onClick={() => { setEmbalagem(opcao); limparErro('embalagem') }}
                          >
                            {opcao === 'cx' ? 'Caixa' : 'Pacote'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={embalagem === 'cx' ? 'cadastrar-produto__grade cadastrar-produto__grade--tres' : 'cadastrar-produto__grade'}>
                      <Campo
                        rotulo={`${nomes[embalagem].quantos} chegaram?`}
                        value={qtdEmbalagens}
                        onChange={(e) => { mudarEmbalagens(e.target.value.replace(/\D/g, '')); limparErro('embalagem') }}
                        inputMode="numeric"
                      />
                      {embalagem === 'cx' && (
                        <Campo
                          rotulo="Pacotes por caixa"
                          opcional={unidadeVenda !== 'pct'}
                          value={pacotesPorCaixa}
                          onChange={(e) => { setPacotesPorCaixa(e.target.value.replace(/\D/g, '')); limparErro('embalagem') }}
                          inputMode="numeric"
                        />
                      )}
                      <Campo
                        rotulo={`Unidades por ${nomes[dentroDe].um}`}
                        opcional={unidadeVenda !== 'un'}
                        value={porEmbalagem}
                        onChange={(e) => { setPorEmbalagem(e.target.value.replace(/\D/g, '')); limparErro('embalagem') }}
                        inputMode="numeric"
                      />
                    </div>
                    {unidadeVenda === embalagem && (
                      <p className="cadastrar-produto__dica">Vende {nomes[embalagem].um} fechad{embalagem === 'cx' ? 'a' : 'o'}? Os outros campos são opcionais. Vende o conteúdo separado? Troque a unidade de venda.</p>
                    )}
                    {nEmbalagens > 0 && (
                      <p className="cadastrar-produto__conta">
                        {[
                          `${nEmbalagens} ${nomes[embalagem][nEmbalagens === 1 ? 'um' : 'varios']}`,
                          nPacotes > 0 && `${nPacotes} pacotes`,
                          nDentro > 0 && `${nDentro} un`,
                        ].filter(Boolean).join(' × ')}
                        {totalUnidades !== null && ` = ${totalUnidades} unidades`}
                        {'. No estoque: '}
                        {unidadeVenda === embalagem ? `${nEmbalagens} ${nomes[embalagem][nEmbalagens === 1 ? 'um' : 'varios']}`
                          : unidadeVenda === 'un' ? (totalUnidades !== null ? `${totalUnidades} unidades` : 'falta quantas unidades')
                          : unidadeVenda === 'pct' && totalPacotes !== null ? `${totalPacotes} pacotes`
                          : 'falta quantos pacotes'}.
                      </p>
                    )}
                    {chegou === 'un' && nChegou > 0 && totalUnidades !== null && totalUnidades !== nChegou && (
                      <p className="cadastrar-produto__conta cadastrar-produto__conta--aviso">
                        A linha da entrada dizia {nChegou} unidades; aqui dá {totalUnidades}.
                      </p>
                    )}
                  </>
                )}
                {erros.embalagem && <p className="campo__ajuda campo__ajuda--erro" role="alert">{erros.embalagem}</p>}
              </div>
            )}
          </div>
        </section>

        <section className="cadastrar-produto__grupo">
          <h3 className="cadastrar-produto__titulo">{naFicha ? 'Venda' : 'Preço e estoque'}</h3>
          <div className={naFicha ? 'cadastrar-produto__grade' : 'cadastrar-produto__grade cadastrar-produto__grade--tres'}>
            <CampoMoeda rotulo="Preço de venda (R$)" name="preco" required valorInicialCentavos={inicial.preco} readOnly={Boolean(produtoConsultado)} erro={Boolean(erros.preco)} ajuda={erros.preco} aoMudar={() => limparErro('preco')} />
            {naFicha && <Campo
              rotulo={`Quantidade na ficha (${unidadeVenda})`}
              type="number"
              name="quantidadeVendida"
              min={1}
              defaultValue={1}
              erro={Boolean(erros.quantidadeVendida)}
              ajuda={erros.quantidadeVendida}
              onChange={() => limparErro('quantidadeVendida')}
            />}
            {!naFicha && <CampoMoeda rotulo="Custo (R$)" name="custo" opcional valorInicialCentavos={inicial.custo} readOnly={Boolean(produtoConsultado)} erro={Boolean(erros.custo)} ajuda={erros.custo} aoMudar={() => limparErro('custo')} />}
            {!naFicha && <Campo rotulo="Localização" name="localizacao" opcional defaultValue={inicial.localizacao} readOnly={Boolean(produtoConsultado)} />}
            {!daEntrada && !naFicha && !editar && <Campo
              rotulo={completar ? 'Quantidade na prateleira' : 'Quantidade inicial'}
              type="number"
              name="saldo"
              min={0}
              defaultValue={produtoConsultado?.saldo}
              readOnly={Boolean(produtoConsultado)}
              erro={Boolean(erros.saldo)}
              ajuda={erros.saldo ?? (completar ? `O sistema mostra ${completar.saldo} ${completar.unidade}, sem contagem. Conte e informe.` : 'Quantidade contada no balcão.')}
              onChange={() => limparErro('saldo')}
            />}
            {!naFicha && <Campo
              rotulo="Estoque mínimo"
              type="number"
              name="minimo"
              min={0}
              defaultValue={inicial.minimo}
              readOnly={Boolean(produtoConsultado)}
              erro={Boolean(erros.minimo)}
              ajuda={erros.minimo ?? 'Abaixo disto, vira estoque baixo.'}
              onChange={() => limparErro('minimo')}
            />}
          </div>
        </section>

        {!naFicha && <section className="cadastrar-produto__grupo">
          <h3 className="cadastrar-produto__titulo">Dados complementares</h3>
          <div className="cadastrar-produto__grade">
            <Campo rotulo="Marca" name="marca" opcional defaultValue={produtoConsultado?.marca ?? r?.marca} readOnly={Boolean(produtoConsultado)} />
            {/* Na entrada, o fornecedor já está no topo da tela: não pedir de novo. */}
            {!daEntrada && <Campo rotulo="Fornecedor" opcional readOnly={Boolean(produtoConsultado)} />}
            <Campo rotulo="Características" name="caracteristicas" opcional defaultValue={produtoConsultado?.caracteristicas ?? r?.caracteristicas} readOnly={Boolean(produtoConsultado)} placeholder="Cor, tamanho, gramatura..." />
            <Campo rotulo="Descrição adicional" name="descricaoAdicional" opcional defaultValue={produtoConsultado?.descricaoAdicional ?? r?.descricaoAdicional} readOnly={Boolean(produtoConsultado)} />
          </div>
        </section>}

{/* Dados fiscais: fora da tela (ver o import comentado no topo).
        {!naFicha && <section className="cadastrar-produto__grupo">
          <h3 className="cadastrar-produto__titulo">Dados fiscais <span className="cadastrar-produto__nota">· para a nota; os valores vêm do contador</span></h3>
          <div className="cadastrar-produto__grade">
            <Selecao rotulo="Tributação" name="tributacao" opcoes={TRIBUTACOES} valorInicial={fiscalInicial.tributacao} disabled={Boolean(produtoConsultado)} />
            <Selecao rotulo="Origem" name="origem" opcoes={ORIGENS} valorInicial={fiscalInicial.origem} disabled={Boolean(produtoConsultado)} />
            <Campo rotulo="NCM" name="ncm" opcional inputMode="numeric" defaultValue={fiscalInicial.ncm} readOnly={Boolean(produtoConsultado)} placeholder="8 números" erro={Boolean(erros.ncm)} ajuda={erros.ncm} onChange={() => limparErro('ncm')} />
            <Campo rotulo="CEST" name="cest" opcional inputMode="numeric" defaultValue={fiscalInicial.cest} readOnly={Boolean(produtoConsultado)} placeholder="Só com substituição" erro={Boolean(erros.cest)} ajuda={erros.cest} onChange={() => limparErro('cest')} />
            <Campo rotulo="CFOP dentro do estado" name="cfopEstadual" inputMode="numeric" defaultValue={fiscalInicial.cfopEstadual} readOnly={Boolean(produtoConsultado)} erro={Boolean(erros.cfopEstadual)} ajuda={erros.cfopEstadual} onChange={() => limparErro('cfopEstadual')} />
            <Campo rotulo="CFOP para outro estado" name="cfopInterestadual" inputMode="numeric" defaultValue={fiscalInicial.cfopInterestadual} readOnly={Boolean(produtoConsultado)} erro={Boolean(erros.cfopInterestadual)} ajuda={erros.cfopInterestadual} onChange={() => limparErro('cfopInterestadual')} />
          </div>
          {!semCodigo && codigoBarras.trim() && !gtinValido(codigoBarras.trim()) && (
            <p className="cadastrar-produto__lembrete">Este código de barras não é um GTIN válido: na nota ele vai como “SEM GTIN”.</p>
          )}
        </section>}
        */}
        </form>
      </Modal>
  )
}

/**
 * Sem histórico, apaga de vez (cadastro feito por engano). Com histórico,
 * desativa: some da venda, mas fichas e movimentações continuam citando.
 * Pede um segundo clique antes de agir.
 */
function AcaoRemover({ produto, aoConcluir }: { produto: Produto; aoConcluir: () => void }) {
  const base = useEstadoDemonstracao()
  const [confirmando, setConfirmando] = useState(false)
  const podeExcluir = !produtoTemHistorico(base, produto.codigo)
  if (produto.inativo) {
    return (
      <Botao variante="fantasma" className="cadastrar-produto__remover" onClick={() => { definirProdutoAtivo(produto.codigo, true); aoConcluir() }}>
        Reativar produto
      </Botao>
    )
  }
  const rotulo = podeExcluir ? 'Excluir produto' : 'Desativar produto'
  return (
    <Botao
      variante="fantasma"
      className={confirmando ? 'cadastrar-produto__remover cadastrar-produto__remover--confirmar' : 'cadastrar-produto__remover'}
      title={podeExcluir ? 'Sem vendas nem movimentações: pode ser apagado.' : 'Já tem histórico: sai da venda, mas o registro fica.'}
      onBlur={() => setConfirmando(false)}
      onClick={() => {
        if (!confirmando) return setConfirmando(true)
        if (podeExcluir) excluirProduto(produto.codigo)
        else definirProdutoAtivo(produto.codigo, false)
        aoConcluir()
      }}
    >
      {confirmando ? `Confirmar: ${rotulo.toLowerCase()}` : rotulo}
    </Botao>
  )
}
