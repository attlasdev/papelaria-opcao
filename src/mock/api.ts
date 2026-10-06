import { falha, ok, type Contrato, type DocumentoBase } from '../../comum/contrato'
import { montarPainel } from './painel'
import { simular } from './simular'
import { criarSemente } from './base/semente'
import { comFechamentosExemplo } from './base/cenario-caixa'
import { hojeISO, minutoDoDia } from './base/datas'
import { criarMaquininhaDemonstracao } from '../../comum/maquininha-demonstracao'

/**
 * O mock do contrato. E o que permite montar tela inteira no navegador, com
 * `npm run dev`, sem Electron, sem banco e sem credencial nenhuma.
 *
 * `const mock: Contrato` faz o compilador exigir uma entrada por operacao. Quando o
 * back adiciona uma operacao ao contrato, o build daqui quebra ate o mock ganhar
 * uma resposta falsa para ela — e e assim que o front descobre que tem tela nova
 * para fazer, sem ninguem avisar por mensagem.
 *
 * O "servidor" falso guarda a base no localStorage, numa chave separada da copia
 * local do app. Na primeira vez ele responde com a amostra de 90 dias, para as
 * telas terem o que mostrar.
 */
const CHAVE_SERVIDOR = 'papelaria-opcao:servidor-mock'

function lerServidor(): DocumentoBase | null {
  try {
    const texto = localStorage.getItem(CHAVE_SERVIDOR)
    return texto ? (JSON.parse(texto) as DocumentoBase) : null
  } catch {
    return null
  }
}

function gravarServidor(documento: DocumentoBase) {
  try { localStorage.setItem(CHAVE_SERVIDOR, JSON.stringify(documento)) }
  catch { /* Sem armazenamento: o "servidor" vive só nesta janela. */ }
}

let sessao: { email: string } | null = { email: 'loja@exemplo.com' }
const maquininha = criarMaquininhaDemonstracao()

const mock: Contrato = {
  sessaoAtual: () => simular(() => ok(sessao)),
  entrar: (email, senha) => simular(() => {
    if (!email.trim() || !senha) return falha('validacao', 'Informe o e-mail e a senha.')
    sessao = { email: email.trim() }
    return ok(sessao)
  }),
  sair: () => simular(() => {
    sessao = null
    return ok(null)
  }),
  carregarBase: () => simular(() => {
    const guardado = lerServidor()
    if (guardado) return ok(guardado)
    const hoje = hojeISO()
    return ok({ conteudo: comFechamentosExemplo(criarSemente(hoje, minutoDoDia()), hoje), revisao: 0, salvoEm: new Date().toISOString() })
  }),
  salvarBase: (conteudo, revisaoEsperada) => simular(() => {
    const atual = lerServidor()?.revisao ?? 0
    if (atual !== revisaoEsperada) return falha('conflito', 'Os dados foram alterados em outro lugar. Feche e abra o app para ver a versão mais nova.')
    const gravacao = { revisao: atual + 1, salvoEm: new Date().toISOString() }
    gravarServidor({ conteudo, ...gravacao })
    return ok(gravacao)
  }),
  salvarArquivo: (nomeSugerido, conteudo) => simular(() => {
    // No navegador não há janela de salvar do sistema: vira um download.
    const tipo = nomeSugerido.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/xml'
    const parte: BlobPart = typeof conteudo === 'string' ? conteudo : new Uint8Array(conteudo)
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([parte], { type: tipo })), download: nomeSugerido })
    link.click()
    URL.revokeObjectURL(link.href)
    return ok({ salvo: true, nome: nomeSugerido })
  }),
  iniciarCobranca: (dados) => simular(() => maquininha.iniciar(dados)),
  consultarCobranca: (id) => simular(() => maquininha.consultar(id)),
  cancelarCobranca: (id) => simular(() => maquininha.cancelar(id)),
  simularCobranca: (id, resultado) => simular(() => maquininha.simular(id, resultado)),
}

window.api = mock
montarPainel()
