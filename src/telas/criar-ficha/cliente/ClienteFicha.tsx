import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { LinhaCliente, PaginaCompras } from '../../../../comum/contrato'
import { formatarDocumento, formatarTelefone } from '../../../../comum/regras/cliente'
import { Botao } from '../../../componentes/botao/Botao'
import { Campo } from '../../../componentes/campo/Campo'
import { Icone } from '../../../componentes/icone/Icone'
import { api } from '../../../dados/api'
import { tituloFalha } from '../../../falhas'
import { reais } from '../../../formatar'
import { semIdentificacao, type ClienteFicha as Cliente, type EscolhaCliente } from '../tipos'
import { ModalNovoCliente } from './ModalNovoCliente'
import './cliente-ficha.css'

type Props = {
  cliente: EscolhaCliente | null
  aoEscolher: (cliente: EscolhaCliente | null) => void
  erro?: string
}

/** Resultados da busca: poucos, para não empurrar os itens da venda para fora da tela. */
const maximoResultados = 6

/** A linha da lista de clientes como a ficha mostra. */
export function clienteDaFicha(c: Pick<LinhaCliente, 'id' | 'nome' | 'documento' | 'telefone'>): Cliente {
  return {
    id: c.id, nome: c.nome,
    documento: c.documento ? formatarDocumento(c.documento) : 'Sem documento',
    telefone: c.telefone ? formatarTelefone(c.telefone) : 'Sem telefone',
  }
}

type Busca = { termo: string; clientes: LinhaCliente[]; total: number } | { termo: string; erro: string }

/**
 * Cliente da ficha: busca um cadastrado, cadastra um novo (em janela, sem sair
 * da venda) ou marca a venda como sem identificação. A ficha abre sem nada
 * escolhido; sem identificação não vira cadastro, a ficha só fica sem cliente.
 */
export function ClienteFicha({ cliente, aoEscolher, erro }: Props) {
  const [modo, setModo] = useState<'ver' | 'buscar'>(cliente ? 'ver' : 'buscar')
  /** Nome que abre no cadastro; null = janela fechada. */
  const [cadastro, setCadastro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  const [listaAberta, setListaAberta] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(0)
  const caixaBusca = useRef<HTMLDivElement>(null)

  // A mesma busca da lista de clientes (`R-CLIENTE-03`), no back, depois de uma pausa na digitação.
  const termo = busca.trim()
  const [resposta, setResposta] = useState<Busca>({ termo: '', clientes: [], total: 0 })
  useEffect(() => {
    if (!termo) return
    let vivo = true
    const espera = setTimeout(() => {
      void api().listarClientes('todos', termo, 1, maximoResultados).then((r) => {
        if (!vivo) return
        setResposta(r.ok ? { termo, clientes: r.dado.clientes, total: r.dado.total } : { termo, erro: `${tituloFalha(r.causa)} ${r.erro}` })
      })
    }, 250)
    return () => { vivo = false; clearTimeout(espera) }
  }, [termo])
  const atual = resposta.termo === termo ? resposta : null
  const visiveis = atual && 'clientes' in atual ? atual.clientes.map(clienteDaFicha) : []
  const total = atual && 'clientes' in atual ? atual.total : 0
  const mostrarLista = Boolean(termo) && listaAberta

  // Como as outras listas: fecha com clique fora; o texto digitado fica.
  useEffect(() => {
    if (!mostrarLista) return
    const fora = (evento: PointerEvent) => {
      if (!caixaBusca.current?.contains(evento.target as Node)) setListaAberta(false)
    }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [mostrarLista])

  function teclado(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Escape' && mostrarLista) {
      evento.preventDefault()
      evento.stopPropagation()
      setListaAberta(false)
    } else if ((evento.key === 'ArrowDown' || evento.key === 'ArrowUp') && visiveis.length) {
      evento.preventDefault()
      setListaAberta(true)
      setIndiceAtivo((atual) => (atual + (evento.key === 'ArrowDown' ? 1 : -1) + visiveis.length) % visiveis.length)
    } else if (evento.key === 'Enter') {
      evento.preventDefault()
      const alvo = visiveis[Math.min(indiceAtivo, visiveis.length - 1)]
      if (mostrarLista && alvo) escolher(alvo)
      else if (termo) setListaAberta(true)
    }
  }

  function escolher(novo: EscolhaCliente) {
    aoEscolher(novo)
    setModo('ver')
    setBusca('')
  }

  function trocar() {
    aoEscolher(null)
    setModo('buscar')
  }

  return (
    <section className="cliente-ficha">
      <header className="cliente-ficha__topo">
        <h2>Cliente</h2>
        {modo === 'buscar' && (
          <div className="cliente-ficha__atalhos">
            <button type="button" className="cliente-ficha__link" onClick={() => escolher(semIdentificacao)}>
              <Icone nome="pessoa-circulo" tamanho={16} /> Vender sem identificação
            </button>
            <button type="button" className="cliente-ficha__link" onClick={() => setCadastro('')}>
              <Icone nome="adicionar-pessoa" tamanho={16} /> Cadastrar novo cliente
            </button>
          </div>
        )}
      </header>

      {modo === 'ver' && cliente === semIdentificacao && (
        <div className="cliente-ficha__escolhido">
          <span className="cliente-ficha__avatar cliente-ficha__avatar--sem-identificacao">
            <Icone nome="pessoa" tamanho={20} />
          </span>
          <div className="cliente-ficha__dados">
            <strong>Cliente não identificado</strong>
            <span>Venda sem cadastro · dá baixa no estoque e entra no financeiro normalmente</span>
          </div>
          <Botao tamanho="pequeno" onClick={trocar}>
            Identificar cliente
          </Botao>
        </div>
      )}

      {modo === 'ver' && cliente && cliente !== semIdentificacao && (
        <div className="cliente-ficha__escolhido">
          <span className="cliente-ficha__avatar">
            <Icone nome="pessoa" tamanho={20} />
          </span>
          <div className="cliente-ficha__dados">
            <strong>{cliente.nome}</strong>
            <span>
              {cliente.documento} · {cliente.telefone}
            </span>
          </div>
          <Botao tamanho="pequeno" onClick={trocar}>
            Trocar cliente
          </Botao>
        </div>
      )}
      {modo === 'ver' && cliente && cliente !== semIdentificacao && <AvisoDivida clienteId={cliente.id} />}

      {modo === 'buscar' && (
        <div className="cliente-ficha__busca" ref={caixaBusca}>
          <Campo
            rotulo="Buscar cliente cadastrado"
            icone="busca"
            placeholder="Nome ou CPF"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setListaAberta(true); setIndiceAtivo(0) }}
            onFocus={() => setListaAberta(true)}
            onKeyDown={teclado}
            erro={Boolean(erro)}
            ajuda={erro}
            autoFocus
          />
          {mostrarLista && (
            <ul className="cliente-ficha__resultados">
              {visiveis.map((c, indice) => (
                <li key={c.id}>
                  <button type="button" className={indice === indiceAtivo ? 'cliente-ficha__resultado--ativo' : undefined} onMouseEnter={() => setIndiceAtivo(indice)} onClick={() => escolher(c)}>
                    <span>
                      <strong>{c.nome}</strong>
                      <small>{c.documento}</small>
                    </span>
                    <span className="cliente-ficha__selecionar">Selecionar</span>
                  </button>
                </li>
              ))}
              {!atual && <li className="cliente-ficha__nenhum" role="status">Buscando…</li>}
              {atual && 'erro' in atual && <li className="cliente-ficha__nenhum" role="alert">{atual.erro}</li>}
              {total > maximoResultados && (
                <li className="cliente-ficha__nenhum">
                  Mais {total - maximoResultados} com esse nome. Digite mais para refinar.
                </li>
              )}
              {atual && 'clientes' in atual && total === 0 && (
                <li className="cliente-ficha__nenhum cliente-ficha__nenhum--acao">
                  <span>Nenhum cliente com esse nome ou documento.</span>
                  <Botao tamanho="pequeno" icone="adicionar-pessoa" onClick={() => setCadastro(busca.trim())}>
                    Cadastrar “{busca.trim()}”
                  </Botao>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {cadastro !== null && (
        <ModalNovoCliente
          nomeInicial={cadastro}
          aoSalvar={(novo) => { setCadastro(null); escolher(novo) }}
          aoFechar={() => setCadastro(null)}
        />
      )}
    </section>
  )
}

/**
 * Quem já deve fica à vista antes de vender de novo, principalmente na notinha
 * (`R-VENDA-03`). Só avisa: vender ou não é decisão do balcão. As atrasadas vêm
 * filtradas no back; o resumo é do cliente inteiro.
 */
function AvisoDivida({ clienteId }: { clienteId: string }) {
  const [dado, setDado] = useState<{ de: string; pagina: PaginaCompras } | null>(null)
  useEffect(() => {
    let vivo = true
    void api().listarComprasDoCliente(clienteId, 'em-atraso', 1, 100).then((r) => {
      if (vivo && r.ok) setDado({ de: clienteId, pagina: r.dado })
    })
    return () => { vivo = false }
  }, [clienteId])
  if (!dado || dado.de !== clienteId) return null
  const { resumo, compras: atrasadas } = dado.pagina
  if (resumo.notinhasEmAberto === 0) return null
  const valorAtraso = atrasadas.reduce((t, c) => t + c.emAberto, 0)
  const quantas = resumo.contagem.emAtraso
  return (
    <p className={quantas ? 'cliente-ficha__divida cliente-ficha__divida--atraso' : 'cliente-ficha__divida'} role="status">
      <Icone nome={quantas ? 'alerta' : 'relogio'} tamanho={16} />
      {quantas
        ? <span><strong>{reais(valorAtraso)} em atraso</strong> ({quantas === 1 ? '1 notinha' : `${quantas} notinhas`}){resumo.emAberto > valorAtraso && ` · ${reais(resumo.emAberto)} em aberto no total`}</span>
        : <span>{reais(resumo.emAberto)} em aberto ({resumo.notinhasEmAberto === 1 ? '1 notinha' : `${resumo.notinhasEmAberto} notinhas`} no prazo)</span>}
    </p>
  )
}
