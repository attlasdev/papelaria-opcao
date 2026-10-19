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
  /**
   * Exportar produtos e clientes para a Emitte (planilhas). Ligado só em
   * desenvolvimento enquanto o fluxo "vai uma vez, marca ao confirmar" é testado;
   * no instalador, desligado até o Agostinho liberar.
   */
  exportarEmitte: import.meta.env.DEV,
  exportarClientesEmitte: import.meta.env.DEV,
  /**
   * "Restaurar dados de exemplo" (clique no operador). Desligado também em
   * desenvolvimento: com o app ligado a um banco, a amostra de 90 dias ia
   * para o banco por cima dos dados (aconteceu no projeto de teste).
   */
  restaurarExemplo: false,
  /**
   * Bloco "Para nota fiscal" do cadastro de cliente (tipo de contribuinte, tipo
   * de cliente, inscrição estadual). Oculto no piloto (`2026-10-19`); oculto, o
   * cadastro mantém o que o cliente já tinha nesses campos.
   */
  dadosFiscaisCliente: false,
}
