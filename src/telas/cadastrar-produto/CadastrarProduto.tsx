import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { Assinatura, DadosProduto, Produto, Resultado } from '../../../comum/contrato'
import { conferirProduto } from '../../../comum/regras/produto'
import { Modal } from '../../componentes/modal/Modal'
import { Botao } from '../../componentes/botao/Botao'
import { Campo, Selecao } from '../../componentes/campo/Campo'
import { CampoMoeda } from '../../componentes/campo/CampoMoeda'
import { Icone } from '../../componentes/icone/Icone'
import { JanelaAssinatura } from '../../componentes/assinatura/JanelaAssinatura'
import { api } from '../../dados/api'
import { tituloFalha } from '../../falhas'
import { centavosDeTexto } from '../../formatar'
import { useLeitorCodigo } from '../../leitor/useLeitorCodigo'
import { rotas } from '../../rotas-caminhos'
import type { Produto as ProdutoBase, Unidade } from '../../mock/base/tipos'
import { Estoque } from '../estoque/Estoque'
import { unidades } from './constantes'
import { CampoCategoria } from './CampoCategoria'
// Dados fiscais fora da tela desde 2026-10-06 (decisão do Agostinho): a dona os
// preenche na própria Emitte, que é quem os exige. O código fica comentado abaixo
// para voltar se a decisão mudar. Ver Memoria.md. Exceção (`2026-10-23`): NCM e
// CEST voltaram em "Dados complementares", só como anotação.
import { anotarNcmCest } from '../../dados/fiscal'
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

/** Mensagem de falha para a tela: a de validação já é legível; as outras levam o título da causa. */
const mensagemDe = (r: Exclude<Resultado<unknown>, { ok: true }>) => (r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)

/**
 * Corrigir um produto já cadastrado; excluir ou desativar sai daqui também. Lido
 * na abertura: o modal não troca de produto no meio.
 */
export function EditarProduto() {
  const navegar = useNavigate()
  // Até a Estoque migrar (tela 2.2), a rota leva o código, que no mock é o id.
  const { codigo = '' } = useParams()
  const fechar = useCallback(() => navegar(rotas.estoque), [navegar])
  const [carga, setCarga] = useState<{ fase: 'carregando' } | { fase: 'erro'; mensagem: string } | { fase: 'pronto'; produto: Produto }>({ fase: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    let vivo = true
    void api().obterProduto(codigo).then((r) => {
      if (vivo) setCarga(r.ok ? { fase: 'pronto', produto: r.dado } : { fase: 'erro', mensagem: mensagemDe(r) })
    })
    return () => { vivo = false }
  }, [codigo, tentativa])
  return (
    <>
      <Estoque />
      {carga.fase === 'pronto'
        ? <ModalProduto editar={carga.produto} aoFechar={fechar} aoSalvar={fechar} />
        : (
          <Modal
            estreito
            titulo="Editar produto"
            aoFechar={fechar}
            rodape={carga.fase === 'erro' && (
              <>
                <Botao variante="fantasma" onClick={fechar}>Fechar</Botao>
                <Botao variante="primario" onClick={() => { setCarga({ fase: 'carregando' }); setTentativa((n) => n + 1) }}>Tentar de novo</Botao>
              </>
            )}
          >
            <p className={carga.fase === 'erro' ? 'cadastrar-produto__lembrete cadastrar-produto__lembrete--erro' : 'cadastrar-produto__lembrete'} role={carga.fase === 'erro' ? 'alert' : 'status'}>
              {carga.fase === 'erro' ? carga.mensagem : 'Carregando o produto…'}
            </p>
          </Modal>
        )}
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

/** Cadastro preparado na entrada. Só vira produto no "Confirmar entrada" (tela 2.4 ainda na base). */
export type RascunhoProduto = Omit<ProdutoBase, 'codigo'>

/** `quantos`: a pergunta com o gênero certo ("Quantos pacotes", "Quantas caixas"). */
const nomes: Record<Unidade, { um: string; varios: string; quantos: string }> = {
  un: { um: 'unidade', varios: 'unidades', quantos: 'Quantas unidades' },
  pct: { um: 'pacote', varios: 'pacotes', quantos: 'Quantos pacotes' },
  cx: { um: 'caixa', varios: 'caixas', quantos: 'Quantas caixas' },
}

type PropsModal = {
  aoFechar: () => void
  /** Aberto pelo Estoque ou pela ficha: grava e devolve o código do produto. */
  aoSalvar?: (codigo: string) => void
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
  /** Produto já cadastrado: corrige dados, sem mexer no saldo. */
  editar?: Produto
  codigoInicial?: string
}

type CampoCadastro = 'codigoBarras' | 'nome' | 'categoria' | 'unidade' | 'preco' | 'custo' | 'saldo' | 'minimo' | 'embalagem' | 'ncm' | 'cest' | 'cfopEstadual' | 'cfopInterestadual'

export function ModalProduto({ aoFechar: fechar, aoSalvar, aoPreparar, daEntrada, editar, codigoInicial = '' }: PropsModal) {
  const existente = editar
  const [semCodigo, setSemCodigo] = useState(Boolean(existente && !existente.codigoBarras))
  const [codigoBarras, setCodigoBarras] = useState(daEntrada?.codigoBarras ?? existente?.codigoBarras ?? codigoInicial)
  const [codigoConsultado, setCodigoConsultado] = useState('')
  const [lendoCodigo, setLendoCodigo] = useState(false)
  const [leituras, setLeituras] = useState(0)
  const idCodigoBarras = useId()
  const campoCodigoBarras = useRef<HTMLInputElement>(null)
  const [erroSalvar, setErroSalvar] = useState('')
  const [erros, setErros] = useState<Partial<Record<CampoCadastro, string>>>({})
  const [enviando, setEnviando] = useState(false)
  /** Pedido de assinatura em aberto: a quantidade inicial é um fato (`R-ESTOQUE-07`). */
  const [assinar, setAssinar] = useState<((quem: Assinatura) => Promise<Resultado<Produto>>) | null>(null)
  /** Gravado: a janela mostra o produto com o código que o banco deu (`R-ESTOQUE-08`). */
  const [salvo, setSalvo] = useState<Produto | null>(null)
  const [categoriasExistentes, setCategoriasExistentes] = useState<string[]>([])
  useEffect(() => {
    let vivo = true
    void api().listarCategorias().then((r) => { if (vivo && r.ok) setCategoriasExistentes(r.dado) })
    return () => { vivo = false }
  }, [])

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
  // O código digitado ou bipado já existe? Consulta o back depois de uma pausa na digitação (`R-ESTOQUE-05`).
  const [achado, setAchado] = useState<Produto | null>(null)
  const procurado = semCodigo ? '' : codigoBarras.trim()
  useEffect(() => {
    if (!procurado) { setAchado(null); return }
    let vivo = true
    const espera = setTimeout(() => {
      void api().buscarProdutoPorCodigoBarras(procurado).then((r) => { if (vivo && r.ok) setAchado(r.dado) })
    }, 250)
    return () => { vivo = false; clearTimeout(espera) }
  }, [procurado])
  const duplicado = achado && achado.codigoBarras === procurado && achado.id !== existente?.id ? achado : undefined
  const produtoConsultado = !daEntrada && duplicado?.codigoBarras === codigoConsultado ? duplicado : undefined
  /** Só leitura: o produto bipado que já existe, ou o que acabou de ser gravado. */
  const consultado = salvo ?? produtoConsultado

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const formulario = evento.currentTarget
    const dados = new FormData(formulario)
    const texto = (campo: string) => String(dados.get(campo) ?? '')
    const unidade = texto('unidade').slice(0, texto('unidade').indexOf(' ')) as Unidade
    const textoSaldo = texto('saldo').trim()
    const saldo = Number(textoSaldo)
    const textoCusto = texto('custo').trim()
    const final = quantidadeFinal()
    const contrato: DadosProduto = {
      codigoBarras: semCodigo ? null : codigoBarras, descricao: texto('nome'), categoria: texto('categoria'), unidade,
      preco: centavosDeTexto(texto('preco')), custo: textoCusto ? centavosDeTexto(textoCusto) : null, minimo: Number(texto('minimo')),
      localizacao: texto('localizacao'), marca: texto('marca'), caracteristicas: texto('caracteristicas'), descricaoAdicional: texto('descricaoAdicional'),
      conteudo: daEntrada
        ? (embalado && (nPacotes > 0 || nDentro > 0) ? { embalagem, pacotes: nPacotes > 0 ? nPacotes : null, unidades: nDentro > 0 ? nDentro : null } : null)
        : editar?.conteudo ?? null,
      ncm: texto('ncm'), cest: texto('cest'),
    }
    // As mesmas regras do back (`comum/regras/produto.ts`): aponta o campo antes de mandar.
    const conferido = conferirProduto(contrato)
    const regra = conferido.erros
    const falhas: Partial<Record<CampoCadastro, string>> = {
      codigoBarras: duplicado ? `Este código já está cadastrado em ${duplicado.codigo}.` : undefined,
      nome: regra.descricao, categoria: regra.categoria, unidade: regra.unidade, preco: regra.preco, custo: regra.custo,
      saldo: !daEntrada && !editar && (!textoSaldo || !Number.isInteger(saldo) || saldo < 0) ? 'Informe uma quantidade válida.' : undefined,
      minimo: regra.minimo, embalagem: typeof final === 'string' ? final : regra.conteudo, ncm: regra.ncm, cest: regra.cest,
    }
    const primeira = (['codigoBarras', 'nome', 'categoria', 'unidade', 'preco', 'custo', 'saldo', 'minimo', 'embalagem', 'ncm', 'cest'] as CampoCadastro[]).find((campo) => falhas[campo])
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
    // Pela entrada, só prepara: o produto nasce junto com o estoque, ao confirmar a entrada (tela 2.4).
    if (daEntrada) {
      const d = conferido.dados
      const categoria = categoriasExistentes.find((c) => c.localeCompare(d.categoria, 'pt-BR', { sensitivity: 'base' }) === 0) ?? d.categoria
      const sem = <T,>(v: T | null) => v ?? undefined
      aoPreparar?.({
        codigoBarras: sem(d.codigoBarras), descricao: d.descricao, categoria, grupo: grupoDa(categoria), unidade: d.unidade, preco: d.preco,
        saldo: 0, minimo: d.minimo, custo: sem(d.custo), localizacao: sem(d.localizacao), marca: sem(d.marca),
        caracteristicas: sem(d.caracteristicas), descricaoAdicional: sem(d.descricaoAdicional),
        fiscal: anotarNcmCest(daEntrada.rascunho?.fiscal, d.ncm ?? '', d.cest ?? '').fiscal,
        conteudo: d.conteudo ? { embalagem: d.conteudo.embalagem, pacotes: sem(d.conteudo.pacotes), unidades: sem(d.conteudo.unidades) } : undefined,
      }, typeof final === 'string' ? null : final)
      return
    }
    if (!editar && saldo > 0) {
      // A quantidade inicial vira um movimento com autor: a janela pede quem está fazendo.
      setAssinar(() => (quem: Assinatura) => api().cadastrarProduto(contrato, saldo, quem))
      return
    }
    setEnviando(true)
    const r = editar ? await api().editarProduto(editar.id, contrato) : await api().cadastrarProduto(contrato, 0, null)
    setEnviando(false)
    if (!r.ok) return setErroSalvar(mensagemDe(r))
    if (editar) aoSalvar?.(r.dado.codigo)
    else setSalvo(r.dado)
  }

  // const fiscalInicial = consultado?.fiscal ?? r?.fiscal ?? FISCAL_PRODUTO_PADRAO
  const rascunho = daEntrada?.rascunho
  const doProduto = consultado ?? existente
  const inicial = doProduto
    ? { nome: doProduto.descricao, preco: doProduto.preco, custo: doProduto.custo, localizacao: doProduto.localizacao ?? '', minimo: String(doProduto.minimo),
        categoria: doProduto.categoria, marca: doProduto.marca ?? undefined, caracteristicas: doProduto.caracteristicas ?? undefined,
        descricaoAdicional: doProduto.descricaoAdicional ?? undefined, ncm: doProduto.ncm ?? undefined, cest: doProduto.cest ?? undefined }
    : daEntrada
    ? { nome: rascunho?.descricao ?? daEntrada.nome, preco: rascunho?.preco ?? null, custo: rascunho?.custo ?? null, localizacao: rascunho?.localizacao ?? '',
        minimo: rascunho ? String(rascunho.minimo) : '', categoria: rascunho?.categoria, marca: rascunho?.marca, caracteristicas: rascunho?.caracteristicas,
        descricaoAdicional: rascunho?.descricaoAdicional, ncm: rascunho?.fiscal?.ncm, cest: rascunho?.fiscal?.cest }
    : { nome: '', preco: null, custo: null, localizacao: '', minimo: '' }

  return (
      <Modal
        titulo={salvo ? 'Produto cadastrado' : produtoConsultado ? 'Produto já cadastrado' : editar ? 'Editar produto' : 'Cadastrar produto'}
        subtitulo={salvo
          ? `Gravado como ${salvo.codigo}.`
          : produtoConsultado
          ? 'Código reconhecido. Os dados abaixo são do produto existente.'
          : editar ? 'O saldo muda só por entrada ou ajuste.'
          : daEntrada ? 'A quantidade vem da entrada.' : undefined}
        aoFechar={salvo ? () => aoSalvar?.(salvo.codigo) : fechar}
        rodape={
          salvo ? <Botao variante="primario" onClick={() => aoSalvar?.(salvo.codigo)}>Fechar</Botao>
          : produtoConsultado ? <Botao variante="primario" onClick={fechar}>Fechar</Botao> : (
            <>
              {editar && <AcaoRemover produto={editar} aoConcluir={fechar} aoFalhar={setErroSalvar} />}
              <span className={erroSalvar ? 'cadastrar-produto__lembrete cadastrar-produto__lembrete--erro' : 'cadastrar-produto__lembrete'} role={erroSalvar ? 'alert' : undefined}>
                {erroSalvar}
              </span>
              <Botao variante="fantasma" onClick={fechar}>
                Cancelar
              </Botao>
              <Botao variante="primario" icone="check" type="submit" form="cadastrar-produto-formulario" disabled={enviando}>
                {enviando ? 'Salvando…' : editar ? 'Salvar alterações' : 'Salvar produto'}
              </Botao>
            </>
          )
        }
      >
        <form key={consultado?.codigo ?? 'novo'} id="cadastrar-produto-formulario" onSubmit={salvar} noValidate>
        <section className="cadastrar-produto__grupo">
          <h3 className="cadastrar-produto__titulo">Dados principais</h3>
          <div className="cadastrar-produto__grade">
            <Campo rotulo="Código interno" value={consultado?.codigo ?? existente?.codigo ?? 'Gerado ao salvar'} readOnly />
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
            <Campo rotulo="Nome do produto" name="nome" required defaultValue={inicial.nome} readOnly={Boolean(consultado)} autoFocus={Boolean(daEntrada)} className="cadastrar-produto__largo" erro={Boolean(erros.nome)} ajuda={erros.nome} onChange={() => limparErro('nome')} />
            {consultado
              ? <Campo rotulo="Categoria" value={consultado.categoria} readOnly />
              : <CampoCategoria name="categoria" existentes={categoriasExistentes} inicial={inicial.categoria} erro={erros.categoria} aoMudar={() => limparErro('categoria')} />}
            <Selecao
              rotulo="Unidade de venda"
              name="unidade"
              opcoes={unidades}
              valorInicial={unidades.find((u) => u.startsWith(`${unidadeVenda} `))}
              valor={consultado ? unidades.find((u) => u.startsWith(`${consultado.unidade} `)) : undefined}
              disabled={Boolean(consultado)}
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
          <h3 className="cadastrar-produto__titulo">Preço e estoque</h3>
          <div className="cadastrar-produto__grade cadastrar-produto__grade--tres">
            <CampoMoeda rotulo="Preço de venda (R$)" name="preco" required valorInicialCentavos={inicial.preco} readOnly={Boolean(consultado)} erro={Boolean(erros.preco)} ajuda={erros.preco} aoMudar={() => limparErro('preco')} />
            <CampoMoeda rotulo="Custo (R$)" name="custo" opcional valorInicialCentavos={inicial.custo} readOnly={Boolean(consultado)} erro={Boolean(erros.custo)} ajuda={erros.custo} aoMudar={() => limparErro('custo')} />
            <Campo rotulo="Localização" name="localizacao" opcional defaultValue={inicial.localizacao} readOnly={Boolean(consultado)} />
            {!daEntrada && !editar && <Campo
              rotulo="Quantidade inicial"
              type="number"
              name="saldo"
              min={0}
              defaultValue={consultado?.saldo}
              readOnly={Boolean(consultado)}
              erro={Boolean(erros.saldo)}
              ajuda={erros.saldo ?? 'Quantidade contada no balcão.'}
              onChange={() => limparErro('saldo')}
            />}
            <Campo
              rotulo="Estoque mínimo"
              type="number"
              name="minimo"
              min={0}
              defaultValue={inicial.minimo}
              readOnly={Boolean(consultado)}
              erro={Boolean(erros.minimo)}
              ajuda={erros.minimo ?? 'Abaixo disto, vira estoque baixo.'}
              onChange={() => limparErro('minimo')}
            />
          </div>
        </section>

        <section className="cadastrar-produto__grupo">
          <h3 className="cadastrar-produto__titulo">Dados complementares</h3>
          <div className="cadastrar-produto__grade">
            <Campo rotulo="Marca" name="marca" opcional defaultValue={inicial.marca} readOnly={Boolean(consultado)} />
            {/* Sem campo "Fornecedor": o produto não o guarda; o fornecedor fica em cada entrada de mercadoria. */}
            <Campo rotulo="Características" name="caracteristicas" opcional defaultValue={inicial.caracteristicas} readOnly={Boolean(consultado)} placeholder="Cor, tamanho, gramatura..." />
            <Campo rotulo="Descrição adicional" name="descricaoAdicional" opcional defaultValue={inicial.descricaoAdicional} readOnly={Boolean(consultado)} />
            <Campo rotulo="NCM" name="ncm" opcional inputMode="numeric" defaultValue={inicial.ncm} readOnly={Boolean(consultado)} placeholder="8 números" erro={Boolean(erros.ncm)} ajuda={erros.ncm ?? 'Anotação para o cadastro na Emitte.'} onChange={() => limparErro('ncm')} />
            <Campo rotulo="CEST" name="cest" opcional inputMode="numeric" defaultValue={inicial.cest} readOnly={Boolean(consultado)} placeholder="7 números" erro={Boolean(erros.cest)} ajuda={erros.cest ?? 'Anotação para o cadastro na Emitte.'} onChange={() => limparErro('cest')} />
          </div>
        </section>

{/* Dados fiscais: fora da tela (ver o import comentado no topo).
        <section className="cadastrar-produto__grupo">
          <h3 className="cadastrar-produto__titulo">Dados fiscais <span className="cadastrar-produto__nota">· para a nota; os valores vêm do contador</span></h3>
          <div className="cadastrar-produto__grade">
            <Selecao rotulo="Tributação" name="tributacao" opcoes={TRIBUTACOES} valorInicial={fiscalInicial.tributacao} disabled={Boolean(consultado)} />
            <Selecao rotulo="Origem" name="origem" opcoes={ORIGENS} valorInicial={fiscalInicial.origem} disabled={Boolean(consultado)} />
            <Campo rotulo="NCM" name="ncm" opcional inputMode="numeric" defaultValue={fiscalInicial.ncm} readOnly={Boolean(consultado)} placeholder="8 números" erro={Boolean(erros.ncm)} ajuda={erros.ncm} onChange={() => limparErro('ncm')} />
            <Campo rotulo="CEST" name="cest" opcional inputMode="numeric" defaultValue={fiscalInicial.cest} readOnly={Boolean(consultado)} placeholder="Só com substituição" erro={Boolean(erros.cest)} ajuda={erros.cest} onChange={() => limparErro('cest')} />
            <Campo rotulo="CFOP dentro do estado" name="cfopEstadual" inputMode="numeric" defaultValue={fiscalInicial.cfopEstadual} readOnly={Boolean(consultado)} erro={Boolean(erros.cfopEstadual)} ajuda={erros.cfopEstadual} onChange={() => limparErro('cfopEstadual')} />
            <Campo rotulo="CFOP para outro estado" name="cfopInterestadual" inputMode="numeric" defaultValue={fiscalInicial.cfopInterestadual} readOnly={Boolean(consultado)} erro={Boolean(erros.cfopInterestadual)} ajuda={erros.cfopInterestadual} onChange={() => limparErro('cfopInterestadual')} />
          </div>
          {!semCodigo && codigoBarras.trim() && !gtinValido(codigoBarras.trim()) && (
            <p className="cadastrar-produto__lembrete">Este código de barras não é um GTIN válido: na nota ele vai como “SEM GTIN”.</p>
          )}
        </section>}
        */}
        </form>
        {assinar && (
          <JanelaAssinatura
            gesto="Cadastrar produto com quantidade inicial"
            rotuloConfirmar="Salvar produto"
            fazer={assinar}
            aoConcluir={(produto) => { setAssinar(null); setSalvo(produto) }}
            aoFechar={() => setAssinar(null)}
          />
        )}
      </Modal>
  )
}

/** O grupo da 0.1, para o rascunho da entrada (ninguém lê; o documento do piloto ainda o tem). */
const grupoDa = (categoria: string): RascunhoProduto['grupo'] =>
  categoria.includes('Caderno') ? 'cadernos' : categoria.includes('Escrita') ? 'escrita' : categoria.includes('Papéis') ? 'papeis' : categoria.includes('Escritório') ? 'escritorio' : 'artes'

/**
 * Sem histórico, apaga de vez (cadastro feito por engano). Com histórico,
 * desativa: some da venda, mas fichas e movimentações continuam citando.
 * Pede um segundo clique antes de agir; excluir o que tem saldo pede também
 * quem está fazendo (`R-ESTOQUE-07`).
 */
function AcaoRemover({ produto, aoConcluir, aoFalhar }: { produto: Produto; aoConcluir: () => void; aoFalhar: (mensagem: string) => void }) {
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [assinando, setAssinando] = useState(false)
  const podeExcluir = !produto.temHistorico

  async function fazer(pedido: () => Promise<Resultado<unknown>>) {
    setEnviando(true)
    const r = await pedido()
    setEnviando(false)
    setConfirmando(false)
    if (r.ok) aoConcluir()
    else aoFalhar(mensagemDe(r))
  }

  if (!produto.ativo) {
    return (
      <Botao variante="fantasma" className="cadastrar-produto__remover" disabled={enviando} onClick={() => fazer(() => api().ativarProduto(produto.id, true))}>
        Reativar produto
      </Botao>
    )
  }
  const rotulo = podeExcluir ? 'Excluir produto' : 'Desativar produto'
  return (
    <>
      <Botao
        variante="fantasma"
        className={confirmando ? 'cadastrar-produto__remover cadastrar-produto__remover--confirmar' : 'cadastrar-produto__remover'}
        title={podeExcluir ? 'Sem vendas nem movimentações: pode ser apagado.' : 'Já tem histórico: sai da venda, mas o registro fica.'}
        disabled={enviando}
        onBlur={() => setConfirmando(false)}
        onClick={() => {
          if (!confirmando) return setConfirmando(true)
          if (!podeExcluir) return fazer(() => api().ativarProduto(produto.id, false))
          if (produto.saldo > 0) return setAssinando(true)
          return fazer(() => api().excluirProduto(produto.id, null))
        }}
      >
        {confirmando ? `Confirmar: ${rotulo.toLowerCase()}` : rotulo}
      </Botao>
      {assinando && (
        <JanelaAssinatura
          gesto={`Excluir ${produto.descricao} (leva junto o saldo inicial de ${produto.saldo} ${produto.unidade})`}
          rotuloConfirmar="Excluir"
          fazer={(quem) => api().excluirProduto(produto.id, quem)}
          aoConcluir={() => { setAssinando(false); aoConcluir() }}
          aoFechar={() => { setAssinando(false); setConfirmando(false) }}
        />
      )}
    </>
  )
}
