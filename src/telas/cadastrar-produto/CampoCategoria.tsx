import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Icone } from '../../componentes/icone/Icone'

type Props = {
  /** Categorias que já existem nos produtos cadastrados. */
  existentes: string[]
  name: string
  inicial?: string
  erro?: string
  aoMudar?: () => void
}

/**
 * Lista das categorias existentes, com "Nova categoria" no topo: clicou, digita
 * o nome e confirma com OK. Categoria é só o texto gravado no produto, então a
 * nova passa a aparecer nos filtros do Estoque assim que o produto é salvo.
 */
export function CampoCategoria({ existentes, name, inicial, erro, aoMudar }: Props) {
  const id = useId()
  const caixa = useRef<HTMLDivElement>(null)
  const campoNova = useRef<HTMLInputElement>(null)
  const [aberta, setAberta] = useState(false)
  const [escolhida, setEscolhida] = useState(inicial ?? '')
  const [criadas, setCriadas] = useState<string[]>(inicial && !existentes.includes(inicial) ? [inicial] : [])
  const [criando, setCriando] = useState(false)
  const [nova, setNova] = useState('')

  const todas = [...new Set([...criadas, ...existentes])]

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberta) return
    function fora(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) { setAberta(false); setCriando(false) }
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberta])

  useEffect(() => { if (criando) campoNova.current?.focus() }, [criando])

  function escolher(valor: string) {
    setEscolhida(valor)
    aoMudar?.()
    setAberta(false)
    setCriando(false)
  }

  function adicionar() {
    const nome = nova.trim()
    if (!nome) return
    // Mesmo nome com outra caixa ou sem acento é a mesma categoria: não duplica.
    const existente = todas.find((c) => c.localeCompare(nome, 'pt-BR', { sensitivity: 'base' }) === 0)
    if (!existente) setCriadas((atual) => [nome, ...atual])
    setNova('')
    escolher(existente ?? nome)
  }

  function tecladoNova(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter') { evento.preventDefault(); adicionar() }
    if (evento.key === 'Escape') { evento.stopPropagation(); setCriando(false) }
  }

  return (
    <div className="campo campo-categoria" ref={caixa}>
      <span className="campo__rotulo" id={`${id}-rotulo`}>Categoria</span>
      <button
        type="button"
        className={erro ? 'campo__caixa campo__caixa--erro campo-categoria__botao' : 'campo__caixa campo-categoria__botao'}
        data-campo="categoria"
        aria-haspopup="listbox"
        aria-required="true"
        aria-invalid={Boolean(erro)}
        aria-describedby={erro ? `${id}-erro` : undefined}
        aria-expanded={aberta}
        aria-labelledby={`${id}-rotulo`}
        onClick={() => setAberta((a) => !a)}
        onKeyDown={(e) => { if (e.key === 'Escape' && aberta) { e.stopPropagation(); setAberta(false) } }}
      >
        <span className={escolhida ? '' : 'campo-categoria__vazio'}>{escolhida || 'Escolha uma categoria'}</span>
        <Icone nome="chevron-baixo" tamanho={18} />
      </button>
      <input type="hidden" name={name} value={escolhida} />
      {erro && <span id={`${id}-erro`} className="campo__ajuda campo__ajuda--erro" role="alert">{erro}</span>}

      {aberta && (
        <div className="campo-categoria__lista" role="listbox" aria-labelledby={`${id}-rotulo`}>
          {criando ? (
            <div className="campo-categoria__nova">
              <input
                ref={campoNova}
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                onKeyDown={tecladoNova}
                placeholder="Nome da nova categoria"
                aria-label="Nome da nova categoria"
              />
              <button type="button" className="campo-categoria__ok" onClick={adicionar} disabled={!nova.trim()}>OK</button>
            </div>
          ) : (
            <button type="button" className="campo-categoria__opcao campo-categoria__opcao--criar" onClick={() => setCriando(true)}>
              <Icone nome="mais" tamanho={16} /> Nova categoria
            </button>
          )}
          {todas.map((categoria) => (
            <button
              key={categoria}
              type="button"
              role="option"
              aria-selected={categoria === escolhida}
              className={categoria === escolhida ? 'campo-categoria__opcao campo-categoria__opcao--ativa' : 'campo-categoria__opcao'}
              onClick={() => escolher(categoria)}
            >
              {categoria}
              {categoria === escolhida && <Icone nome="check" tamanho={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
