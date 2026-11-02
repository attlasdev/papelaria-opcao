import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icone, type NomeIcone } from '../../icone/Icone'
import type { Aviso, TipoAviso } from '../../../../comum/contrato'
import { api } from '../../../dados/api'
import { tituloFalha } from '../../../falhas'
import { useEstadoDemonstracao } from '../../../mock/estado-demonstracao'
import { rotas } from '../../../rotas-caminhos'
import './tela.css'

type Props = {
  /** Título grande da tela. */
  titulo: string
  /** Linha abaixo do título: data, contexto, contagem. */
  subtitulo?: ReactNode
  /** Acima do título, para telas dentro de outra (ex.: Clientes / Mariana Costa). */
  trilha?: ReactNode
  /** Retorno explícito para telas internas; funciona também ao abrir a URL direto. */
  voltar?: { para: string; rotulo: string }
  /** Ação principal da tela, no canto direito do cabeçalho. */
  acaoCabecalho?: ReactNode
  /** Controles ao lado do título (filtros de período, mostrar valores...). */
  acoesTitulo?: ReactNode
  children: ReactNode
}

const iconeAviso: Record<TipoAviso, NomeIcone> = {
  atraso: 'alerta',
  vencendo: 'relogio',
  'estoque-zerado': 'pacote',
  'estoque-baixo': 'pacote',
  'aguardando-dona': 'cadeado',
  'boleto-vencido': 'documento',
  'boleto-vencendo': 'documento',
}

function destinoDo(aviso: Aviso) {
  const d = aviso.destino
  if (d.tela === 'cliente') return rotas.cliente(d.clienteId)
  if (d.tela === 'boletos') return rotas.boletos
  if (d.tela === 'estoque') return rotas.estoque
  return rotas.inicioAguardando
}

/**
 * Esqueleto comum de toda tela: cabeçalho (busca, notificações, ação), título e
 * a área de conteúdo que rola. As telas só preenchem; tamanho e espaçamento são
 * os mesmos em todas.
 */
export function Tela({ titulo, subtitulo, trilha, voltar, acaoCabecalho, acoesTitulo, children }: Props) {
  const navegar = useNavigate()
  const campoBusca = useRef<HTMLInputElement>(null)
  const [termo, setTermo] = useState('')
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false)
  const areaAvisos = useRef<HTMLDivElement>(null)
  const [carga, setCarga] = useState<{ avisos: Aviso[] | null; erro: string | null }>({ avisos: null, erro: null })
  const [tentativa, setTentativa] = useState(0)
  // Fase 2: as telas gravam na base da demonstração; o sino relê quando ela muda. Digitar na busca não relê (M8).
  const base = useEstadoDemonstracao()
  useEffect(() => {
    let vivo = true
    void api().listarAvisos().then((r) => {
      if (vivo) setCarga(r.ok ? { avisos: r.dado, erro: null } : { avisos: null, erro: `${tituloFalha(r.causa)} ${r.erro}` })
    })
    return () => { vivo = false }
  }, [base, tentativa])
  // Novas primeiro; as lidas continuam na lista, apagadas, até a pendência sumir.
  const novos = (carga.avisos ?? []).filter((aviso) => !aviso.lido)
  const avisos = [...novos, ...(carga.avisos ?? []).filter((aviso) => aviso.lido)]
  async function marcarLidos(lista: Aviso[]) {
    const r = await api().marcarAvisosLidos(lista.map((a) => a.id))
    if (r.ok) setCarga({ avisos: r.dado, erro: null })
  }

  useEffect(() => {
    const atalho = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
        evento.preventDefault()
        campoBusca.current?.focus()
      }
    }
    window.addEventListener('keydown', atalho)
    return () => window.removeEventListener('keydown', atalho)
  }, [])

  // A lista de avisos fecha com clique fora dela ou com Esc, como as demais.
  useEffect(() => {
    if (!notificacoesAbertas) return
    const fora = (evento: PointerEvent) => {
      if (!areaAvisos.current?.contains(evento.target as Node)) setNotificacoesAbertas(false)
    }
    const esc = (evento: KeyboardEvent) => { if (evento.key === 'Escape') setNotificacoesAbertas(false) }
    document.addEventListener('pointerdown', fora)
    window.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', fora)
      window.removeEventListener('keydown', esc)
    }
  }, [notificacoesAbertas])

  function pesquisar(evento: FormEvent) {
    evento.preventDefault()
    if (termo.trim()) navegar(rotas.busca(termo.trim()))
  }

  return (
    <div className="tela">
      <header className="tela__cabecalho">
        <form className="tela__busca" onSubmit={pesquisar} role="search">
          <Icone nome="busca" tamanho={18} />
          <input ref={campoBusca} type="search" name="q" aria-label="Buscar no sistema" autoComplete="off" placeholder="Buscar cliente, ficha ou produto..." value={termo} onChange={(e) => setTermo(e.target.value)} />
          <kbd>Ctrl K</kbd>
        </form>
        <div className="tela__cabecalho-acoes">
          <div className="tela__notificacoes-area" ref={areaAvisos}>
            <button type="button" className="tela__icone-botao" title="Notificações" aria-label={novos.length ? `Notificações: ${novos.length} novas` : 'Notificações'} aria-expanded={notificacoesAbertas} onClick={() => setNotificacoesAbertas(!notificacoesAbertas)}>
              <Icone nome="sino" />
              {novos.length > 0 && <span className="tela__notificacoes-contagem" aria-hidden>{novos.length}</span>}
            </button>
            {notificacoesAbertas && (
              <section className="tela__notificacoes" aria-label="Notificações">
                <header className="tela__notificacoes-topo">
                  <h2>Notificações</h2>
                  {novos.length > 0 ? (
                    <button type="button" className="tela__notificacoes-lidas" onClick={() => void marcarLidos(novos)}>
                      <Icone nome="check" tamanho={14} /> Marcar todas como lidas
                    </button>
                  ) : avisos.length > 0 && <span>Tudo lido</span>}
                </header>
                {carga.erro ? (
                  <div className="tela__notificacoes-vazio" role="alert">
                    <p>{carga.erro}</p>
                    <button type="button" className="tela__notificacoes-lidas" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</button>
                  </div>
                ) : !carga.avisos ? (
                  <p className="tela__notificacoes-vazio" role="status">Carregando os avisos…</p>
                ) : avisos.length > 0 ? (
                  <ul className="tela__notificacoes-lista">
                    {avisos.map((aviso) => (
                      <li key={aviso.id}>
                        <Link
                          className={aviso.lido ? 'tela__aviso tela__aviso--lido' : 'tela__aviso'}
                          to={destinoDo(aviso)}
                          onClick={() => { if (!aviso.lido) void marcarLidos([aviso]); setNotificacoesAbertas(false) }}
                        >
                          <span className={`tela__aviso-icone tela__aviso-icone--${aviso.tom}`} aria-hidden>
                            <Icone nome={iconeAviso[aviso.tipo]} tamanho={16} />
                          </span>
                          <span className="tela__aviso-texto">
                            <strong>
                              {aviso.titulo}
                              {!aviso.lido && <span className="tela__aviso-novo" aria-label="Nova" />}
                            </strong>
                            <small>{aviso.detalhe}</small>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="tela__notificacoes-vazio">Nenhuma pendência.</p>
                )}
              </section>
            )}
          </div>
          {acaoCabecalho}
        </div>
      </header>

      <main className="tela__conteudo">
        {voltar && (
          <Link className="tela__voltar" to={voltar.para}>
            <Icone nome="seta-esquerda" tamanho={22} /> {voltar.rotulo}
          </Link>
        )}
        <div className="tela__titulo-linha">
          <div className="tela__titulos">
            {trilha && <div className="tela__trilha">{trilha}</div>}
            <h1 className="tela__titulo">{titulo}</h1>
            {subtitulo && <p className="tela__subtitulo">{subtitulo}</p>}
          </div>
          {acoesTitulo && <div className="tela__titulo-acoes">{acoesTitulo}</div>}
        </div>
        {children}
      </main>
    </div>
  )
}
