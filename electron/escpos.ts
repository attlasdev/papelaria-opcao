import { limpar, type Linha } from '../comum/comprovante'

/**
 * Linhas do comprovante -> bytes ESC/POS para a termica (Elgin i8).
 *
 * Sem dependencia do Electron, para poder testar. Os comandos foram provados no
 * papel em `2026-10-07` (Memoria.md): reiniciar, pagina de codigo CP850,
 * negrito e corte parcial com avanco.
 */

const ESC = 0x1b
const GS = 0x1d

/** `ESC @`: volta ao estado de fabrica (sem negrito, alinhado a esquerda). */
const REINICIAR = [ESC, 0x40]
/** `ESC t 2`: pagina de codigo PC850 (acentos do portugues e "º", "ª"). */
const CP850 = [ESC, 0x74, 0x02]
const negrito = (ligar: boolean) => [ESC, 0x45, ligar ? 1 : 0]
/** `ESC d 4` + `GS V 66 0`: avanca o papel ate a lamina e corta. */
const CORTAR = [ESC, 0x64, 0x04, GS, 0x56, 0x42, 0x00]

/**
 * Metade alta da CP850 (0x80 a 0xFF), na ordem. O Node nao traz codificador
 * CP850; a tabela foi conferida contra o `iconv` do sistema.
 */
const ALTA =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐' +
  '└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ '

const TABELA = new Map<string, number>([...ALTA].map((c, i) => [c, 0x80 + i]))

/** Um caractere em CP850; sem equivalente, tenta sem acento, depois "?". */
function byteDe(c: string): number {
  const codigo = c.codePointAt(0)!
  if (codigo >= 0x20 && codigo < 0x7f) return codigo
  const direto = TABELA.get(c)
  if (direto !== undefined) return direto
  const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (base.length === 1 && base.charCodeAt(0) >= 0x20 && base.charCodeAt(0) < 0x7f) return base.charCodeAt(0)
  return 0x3f
}

export function codificarCp850(texto: string): number[] {
  // `limpar` de novo aqui: mesmo que alguem esqueca de conferir antes, nenhum
  // byte de controle chega a impressora vindo de texto.
  return [...limpar(texto)].map(byteDe)
}

export function bytesComprovante(linhas: Linha[]): Uint8Array {
  const bytes: number[] = [...REINICIAR, ...CP850]
  for (const linha of linhas) {
    if (linha.negrito) bytes.push(...negrito(true))
    // `limpar` tira os espacos da esquerda; o alinhamento e feito com eles.
    const recuo = linha.texto.length - linha.texto.trimStart().length
    bytes.push(...Array(recuo).fill(0x20), ...codificarCp850(linha.texto), 0x0a)
    if (linha.negrito) bytes.push(...negrito(false))
  }
  bytes.push(...CORTAR)
  return Uint8Array.from(bytes)
}
