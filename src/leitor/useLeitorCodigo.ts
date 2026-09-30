import { useEffect, useRef } from 'react'
import { criarDetector } from './detector'

type Campo = HTMLInputElement | HTMLTextAreaElement

function campoEmFoco(): Campo | null {
  const ativo = document.activeElement
  return ativo instanceof HTMLInputElement || ativo instanceof HTMLTextAreaElement ? ativo : null
}

/** Troca o valor de um campo controlado pelo React, avisando o React da troca. */
function restaurar(campo: Campo, valor: string) {
  if (campo.value === valor) return
  const prototipo = campo instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototipo, 'value')?.set?.call(campo, valor)
  campo.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * Escuta o leitor de código de barras na tela inteira, com o cursor onde estiver.
 *
 * As teclas do leitor não são barradas: chegam ao campo em foco como qualquer
 * digitação. Quando a sequência fecha como leitura, o campo volta ao valor de
 * antes dela e o código vai para `aoLer`. Barrar tecla por tecla engoliria letras
 * de quem digita rápido; desfazer no fim não engole nada.
 */
export function useLeitorCodigo(aoLer: (codigo: string) => void, ativo = true) {
  const retorno = useRef(aoLer)
  retorno.current = aoLer

  useEffect(() => {
    if (!ativo) return
    const tecla = criarDetector()
    let antes: { campo: Campo; valor: string } | null = null

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.ctrlKey || evento.altKey || evento.metaKey) return
      const resposta = tecla(evento.key, evento.timeStamp)
      if (resposta.tipo === 'caractere' && resposta.inicio) {
        const campo = campoEmFoco()
        antes = campo ? { campo, valor: campo.value } : null
      }
      if (resposta.tipo === 'leitura') {
        evento.preventDefault()
        evento.stopPropagation()
        if (antes) restaurar(antes.campo, antes.valor)
        antes = null
        retorno.current(resposta.codigo)
      }
    }

    window.addEventListener('keydown', aoTeclar, true)
    return () => window.removeEventListener('keydown', aoTeclar, true)
  }, [ativo])
}
