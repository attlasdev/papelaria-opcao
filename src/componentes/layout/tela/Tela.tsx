import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icone, type NomeIcone } from '../../icone/Icone'
import { avisoLido, hojeISO, marcarAvisosLidos, notificacoes, useEstadoDemonstracao, type TipoNotificacao } from '../../../mock/estado-demonstracao'
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

const iconeAviso: Record<TipoNotificacao, NomeIcone> = {
  atraso: 'alerta',
  vencendo: 'relogio',
  'estoque-zerado': 'pacote',
  'estoque-baixo': 'pacote',
  'ajuste-aguardando': 'ajustes',
  rascunho: 'notas',
  'boleto-vencido': 'documento',
  'boleto-vencendo': 'documento',
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
  const base = useEstadoDemonstracao()
  // Novas primeiro; as lidas continuam na lista, apagadas, até a pendência sumir.
  const todosAvisos = notificacoes(base, hojeISO())
  const novos = todosAvisos.filter((aviso) => !avisoLido(base, aviso))
  const avisos = [...novos, ...todosAvisos.filter((aviso) => avisoLido(base, aviso))]

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
                    <button type="button" className="tela__notificacoes-lidas" onClick={() => marcarAvisosLidos(novos)}>
                      <Icone nome="check" tamanho={14} /> Marcar todas como lidas
                    </button>
                  ) : avisos.length > 0 && <span>Tudo lido</span>}
                </header>
                {avisos.length > 0 ? (
                  <ul className="tela__notificacoes-lista">
                    {avisos.map((aviso) => (
                      <li key={aviso.id}>
                        <Link
                          className={avisoLido(base, aviso) ? 'tela__aviso tela__aviso--lido' : 'tela__aviso'}
                          to={aviso.destino}
                          onClick={() => { marcarAvisosLidos([aviso]); setNotificacoesAbertas(false) }}
                        >
                          <span className={`tela__aviso-icone tela__aviso-icone--${aviso.tom}`} aria-hidden>
                            <Icone nome={iconeAviso[aviso.tipo]} tamanho={16} />
                          </span>
                          <span className="tela__aviso-texto">
                            <strong>
                              {aviso.titulo}
                              {!avisoLido(base, aviso) && <span className="tela__aviso-novo" aria-label="Nova" />}
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
