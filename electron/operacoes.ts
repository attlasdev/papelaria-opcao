import { falha, ok, type Contrato, type Falha } from '../comum/contrato'
import { ConexaoAusente } from './conexao'
import { interpretar, supabase } from './supabase'

/**
 * O lado real do contrato: e aqui que se fala com o banco.
 *
 * Pode lancar excecao a vontade — o registro em `main.ts` embrulha toda chamada e
 * converte em `Falha`. O que nao pode e deixar uma excecao chegar ao front, e isso
 * esta garantido la, nao aqui.
 *
 * `const operacoes: Contrato` faz o compilador exigir uma implementacao por
 * operacao do contrato.
 */

/** Erro do banco vira Falha legivel; o texto cru fica so no log. */
function falhou(nome: string, erro: unknown, status?: number): Falha {
  if (erro instanceof ConexaoAusente) return falha('configuracao', erro.message)
  console.error(`[${nome}]`, erro)
  const { causa, mensagem } = interpretar(erro, status)
  return falha(causa, mensagem)
}

/** O dado entra pela IPC sem garantia de tipo: confere antes de usar. */
const texto = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '')

export const operacoes: Contrato = {
  async sessaoAtual() {
    try {
      const { data, error } = await supabase().auth.getSession()
      if (error) return falhou('sessaoAtual', error)
      const email = data.session?.user.email
      return ok(email ? { email } : null)
    } catch (erro) {
      return falhou('sessaoAtual', erro)
    }
  },

  async entrar(email, senha) {
    if (!texto(email) || typeof senha !== 'string' || !senha) return falha('validacao', 'Informe o e-mail e a senha.')
    try {
      const { data, error } = await supabase().auth.signInWithPassword({ email: texto(email), password: senha })
      if (error) return falhou('entrar', error, error.status)
      return ok({ email: data.user.email ?? texto(email) })
    } catch (erro) {
      return falhou('entrar', erro)
    }
  },

  async sair() {
    try {
      const { error } = await supabase().auth.signOut()
      if (error) return falhou('sair', error)
      return ok(null)
    } catch (erro) {
      return falhou('sair', erro)
    }
  },

  async carregarBase() {
    try {
      const { data, error, status } = await supabase()
        .from('base_loja')
        .select('conteudo, revisao, salvo_em')
        .maybeSingle()
      if (error) return falhou('carregarBase', error, status)
      return ok(data ? { conteudo: data.conteudo, revisao: data.revisao, salvoEm: data.salvo_em } : null)
    } catch (erro) {
      return falhou('carregarBase', erro)
    }
  },

  async salvarBase(conteudo, revisaoEsperada) {
    if (!conteudo || typeof conteudo !== 'object' || Array.isArray(conteudo)) return falha('validacao', 'Base inválida para gravar.')
    if (!Number.isSafeInteger(revisaoEsperada) || revisaoEsperada < 0) return falha('validacao', 'Revisão inválida.')
    try {
      const { data, error, status } = await supabase()
        .rpc('salvar_base', { p_conteudo: conteudo, p_revisao_esperada: revisaoEsperada })
        .single<{ revisao: number; salvo_em: string }>()
      if (error) return falhou('salvarBase', error, status)
      return ok({ revisao: data.revisao, salvoEm: data.salvo_em })
    } catch (erro) {
      return falhou('salvarBase', erro)
    }
  },
}
