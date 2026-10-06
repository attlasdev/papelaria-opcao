/**
 * O endereço do cliente é guardado num texto só, "Rua, nº - Bairro - Cidade/UF"
 * (Memoria.md, Clientes). Estas são as duas pontas: o formulário junta, e quem
 * precisa das partes (a exportação para a Emitte) separa.
 */

/**
 * "Rua, nº - Bairro - Cidade/UF" → partes. Sem bairro sobram duas partes: a
 * segunda é cidade se tiver "/UF". Endereço fora do formato vai inteiro para a rua.
 */
export function separarEndereco(endereco: string) {
  const partes = endereco.split(' - ')
  const [logradouro = '', segunda = '', terceira = ''] = partes
  const [bairro, cidade] = partes.length === 2 && segunda.includes('/') ? ['', segunda] : [segunda, terceira]
  const virgula = logradouro.lastIndexOf(', ')
  return virgula === -1
    ? { rua: logradouro, numero: '', bairro, cidade }
    : { rua: logradouro.slice(0, virgula), numero: logradouro.slice(virgula + 2), bairro, cidade }
}

export function juntarEndereco(rua: string, numero: string, bairro: string, cidade: string) {
  const logradouro = [rua, numero].filter(Boolean).join(', ')
  return [logradouro, bairro, cidade].filter(Boolean).join(' - ')
}
