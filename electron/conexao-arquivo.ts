/**
 * Leitura do `conexao.json` sem depender do Electron (para poder testar).
 *
 * O arquivo é montado à mão na instalação (docs/piloto.md). Tolera o que o
 * Windows costuma fazer: o caractere invisível de "UTF-8 com BOM" que o Bloco
 * de Notas e o PowerShell gravam no início, espaços sobrando, e a URL com barra
 * no fim. Recusa a chave secreta: no app só vai a pública.
 */
export type Conexao = { url: string; chave: string }

export function interpretarConexao(bruto: string): Conexao | string {
  let dados: Partial<Record<'url' | 'chave', unknown>>
  try {
    dados = JSON.parse(bruto.replace(/^﻿/, '').trim())
  } catch {
    return 'O arquivo de configuração não está no formato certo.'
  }
  const url = typeof dados?.url === 'string' ? dados.url.trim().replace(/\/+$/, '') : ''
  const chave = typeof dados?.chave === 'string' ? dados.chave.trim() : ''
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) return 'O endereço do banco no arquivo de configuração não está certo.'
  if (!chave) return 'Falta a chave no arquivo de configuração.'
  if (chave.startsWith('sb_secret_') || /service_role/.test(atobSeguro(chave))) return 'A chave do arquivo de configuração é a secreta. Use a chave pública (publishable/anon).'
  return { url, chave }
}

/** Decodifica o meio de um JWT antigo (anon/service_role) sem lançar erro. */
function atobSeguro(chave: string) {
  try {
    const meio = (chave.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')
    return atob(meio.padEnd(Math.ceil(meio.length / 4) * 4, '='))
  } catch {
    return ''
  }
}
