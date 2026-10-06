/**
 * O que está ligado nesta versão do app. Desligar aqui esconde a função sem
 * apagar o código; religar é trocar para `true`.
 *
 * Piloto 0.1 (Memoria.md, `2026-10-06`).
 */
export const funcoes = {
  /**
   * Área de Notas fiscais: item do menu e "Preparar rascunho de nota fiscal" na
   * nova ficha. Oculta enquanto a loja emite as notas pela Emitte. As rotas
   * continuam existindo, só não há caminho até elas.
   */
  notasFiscais: false,
  /** Exportar produtos para a Emitte: bloqueada porque reimportar duplica os produtos lá. */
  exportarEmitte: false,
  /** Exportar clientes para a Emitte (planilha): desligada até o teste de importação passar. */
  exportarClientesEmitte: false,
  /**
   * "Restaurar dados de exemplo" (clique no operador). Desligado também em
   * desenvolvimento: com o app ligado a um banco, a amostra de 90 dias ia
   * para o banco por cima dos dados (aconteceu no projeto de teste).
   */
  restaurarExemplo: false,
}
