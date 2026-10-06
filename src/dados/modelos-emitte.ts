/**
 * Os modelos de planilha da Emitte, embutidos no app (`recursos/emitte/`).
 * Carregados só quando alguém exporta, para não pesar na abertura.
 */
async function bytesDe(carregar: Promise<{ default: string }>) {
  const { default: dataUrl } = await carregar
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

export const modeloClientes = () => bytesDe(import('../../recursos/emitte/modelo-clientes.xlsx?inline'))
export const modeloProdutos = () => bytesDe(import('../../recursos/emitte/modelo-produtos.xlsx?inline'))
