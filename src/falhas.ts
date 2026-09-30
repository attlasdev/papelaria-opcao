import type { CausaFalha } from '../comum/contrato'

/**
 * O titulo aponta para o que o usuario corrige, nao para onde o codigo parou.
 * "Falhou ao carregar" manda conferir a coisa errada; "voce esta sem internet"
 * manda conferir a certa.
 *
 * Este arquivo e do front: e texto de tela.
 */
export function tituloFalha(causa: CausaFalha): string {
  switch (causa) {
    case 'rede':
      return 'Não consegui alcançar o servidor.'
    case 'banco':
      return 'O servidor recusou a operação.'
    case 'permissao':
      return 'Você não tem permissão para isso.'
    case 'validacao':
      return 'Tem algo errado no que foi preenchido.'
    case 'conflito':
      return 'Alguém alterou isso antes de você.'
    case 'nao-encontrado':
      return 'Isso não existe mais.'
    default:
      return 'Algo falhou.'
  }
}

/**
 * Tentar de novo resolve? Botao de "tentar de novo" em falha de permissao e
 * cruel: o usuario clica dez vezes e nada muda.
 */
export function valeTentarDeNovo(causa: CausaFalha): boolean {
  return causa === 'rede' || causa === 'conflito' || causa === 'desconhecida'
}
