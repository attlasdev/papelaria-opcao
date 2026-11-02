import { useEffect, useState } from 'react'
import type { CaixaDetalhe, PaginaCaixas, PaginaMovimentosGaveta } from '../../../comum/contrato'
import { aguardandoDona } from '../../../comum/regras/caixa'
import { hojeEmSaoPaulo } from '../../../comum/regras/entrada'
import { JanelaAssinatura } from '../../componentes/assinatura/JanelaAssinatura'
import { Botao } from '../../componentes/botao/Botao'
import { CampoData } from '../../componentes/campo/Campo'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Modal } from '../../componentes/modal/Modal'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { Tabela } from '../../componentes/tabela/Tabela'
import { api } from '../../dados/api'
import { dataHora, reais, reaisComSinal } from '../../formatar'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'
import { mensagemDe, seloDoCaixa, textoDiferencaCaixa, ultimosSeteDias } from './comum'
import './historico-caixa.css'

type Consulta = 'caixas' | 'movimentos'
const porPagina = 6

/**
 * O histórico do caixa (`R-CAIXA-08`): o período, os caixas (pelo dia do
 * fechamento; o aberto pela abertura) e as adições e retiradas. "Ver" abre o
 * caixa com os movimentos em dinheiro e as fichas; o fechamento com diferença
 * aguardando a dona tem o "Conferir" (`R-CAIXA-10`).
 */
export function HistoricoCaixa({ aoFechar, turnoInicial = null }: { aoFechar: () => void; turnoInicial?: string | null }) {
  const hoje = hojeEmSaoPaulo()
  const [de, setDe] = useState(ultimosSeteDias(hoje).de)
  const [ate, setAte] = useState(hoje)
  const [consulta, setConsulta] = useState<Consulta>('caixas')
  const [pagina, setPagina] = useState(1)
  const [selecionado, setSelecionado] = useState<string | null>(turnoInicial)
  const [carga, setCarga] = useState<{ caixas?: PaginaCaixas; movimentos?: PaginaMovimentosGaveta; erro: string | null }>({ erro: null })
  const [tentativa, setTentativa] = useState(0)
  const periodoValido = Boolean(de && ate && de <= ate)
  useEffect(() => {
    if (!periodoValido || selecionado) return
    let vivo = true
    const pedido = consulta === 'caixas' ? api().listarCaixas({ de, ate }, false, pagina, porPagina) : api().listarMovimentosGaveta({ de, ate }, pagina, porPagina)
    void pedido.then((r) => {
      if (!vivo) return
      if (!r.ok) return setCarga((atual) => ({ ...atual, erro: mensagemDe(r) }))
      setCarga(consulta === 'caixas' ? { caixas: r.dado as PaginaCaixas, erro: null } : { movimentos: r.dado as PaginaMovimentosGaveta, erro: null })
      if (r.dado.pagina !== pagina) setPagina(r.dado.pagina)
    })
    return () => { vivo = false }
  }, [de, ate, consulta, pagina, periodoValido, selecionado, tentativa])
  const pronta = consulta === 'caixas' ? carga.caixas : carga.movimentos
  const total = pronta?.total ?? 0
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const inicio = ((pronta?.pagina ?? pagina) - 1) * porPagina

  return <Modal titulo="Histórico do caixa" subtitulo="Consulte as contagens e movimentações da gaveta." aoFechar={aoFechar} rodape={<Botao onClick={aoFechar}>Fechar histórico</Botao>}>
    <div className="historico-caixa">
      {selecionado ? <>
        <div><Botao tamanho="pequeno" icone="seta-esquerda" onClick={() => { setSelecionado(null); setTentativa((n) => n + 1) }}>Voltar ao histórico</Botao></div>
        <DetalheTurno id={selecionado} />
      </> : <>
        <div className="historico-caixa__periodo">
          <CampoData rotulo="De" valor={de} max={ate || hoje} aoMudar={(valor) => { setDe(valor); setPagina(1) }} />
          <CampoData rotulo="Até" valor={ate} min={de || undefined} max={hoje} aoMudar={(valor) => { setAte(valor); setPagina(1) }} />
        </div>
        <div className="historico-caixa__atalhos"><Botao tamanho="pequeno" onClick={() => { setDe(ultimosSeteDias(hoje).de); setAte(hoje); setPagina(1) }}>Últimos 7 dias</Botao><Botao tamanho="pequeno" onClick={() => { setDe(`${hoje.slice(0, 7)}-01`); setAte(hoje); setPagina(1) }}>Este mês</Botao></div>
        <p className="historico-caixa__nota">Fechamentos pela data em que foram concluídos; caixas abertos pela data de abertura.</p>
        {!periodoValido && <p className="historico-caixa__nota" role="status">Preencha as duas datas para consultar.</p>}
        <Filtros rotulo="Consultar histórico do caixa" valor={consulta} aoMudar={(valor) => { setConsulta(valor); setPagina(1) }} opcoes={[{ valor: 'caixas', rotulo: 'Aberturas e fechamentos' }, { valor: 'movimentos', rotulo: 'Adições e retiradas' }]} />
        {carga.erro && (
          <p className="historico-caixa__nota" role="alert">{carga.erro} <Botao tamanho="pequeno" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Botao></p>
        )}
        {consulta === 'movimentos' && carga.movimentos?.movimentos.some((m) => m.caixaId === null) && (
          <p className="historico-caixa__nota">Registros antigos sem caixa vinculado mantêm os valores e sinais originais.</p>
        )}
        {consulta === 'caixas' ? <Tabela larguraMinima={680}>
          <thead><tr><th>Abertura</th><th className="celula--numero">Inicial</th><th className="celula--numero">Fechamento</th><th>Situação</th><th className="celula--acoes">Ações</th></tr></thead>
          <tbody>
            {(carga.caixas?.caixas ?? []).map((item) => {
              const selo = seloDoCaixa(item)
              return <tr key={item.id}>
                <td><span className="celula-principal numero">{dataHora(item.abertoEm)}</span><span className="celula-secundaria">{item.operadorAbertura}</span></td>
                <td className="celula--numero numero">{reais(item.dinheiroAbertura)}</td>
                <td className="celula--numero"><span className="celula-principal numero">{item.fechamento ? reais(item.fechamento.contado) : '—'}</span><span className="celula-secundaria numero">{item.fechamento ? dataHora(item.fechamento.registradoEm) : 'Ainda aberto'}</span></td>
                <td><SeloCompacto tom={selo.tom}>{selo.texto}</SeloCompacto></td>
                <td className="celula--acoes"><Botao tamanho="pequeno" aria-label={`Ver caixa aberto em ${dataHora(item.abertoEm)}`} onClick={() => setSelecionado(item.id)}>Ver</Botao></td>
              </tr>
            })}
            {carga.caixas && !total && <tr><td colSpan={5} className="historico-caixa__vazio">Nenhum caixa registrado neste período.</td></tr>}
            {!carga.caixas && periodoValido && !carga.erro && <tr><td colSpan={5} className="historico-caixa__vazio">Carregando…</td></tr>}
          </tbody>
        </Tabela> : <Tabela larguraMinima={660}>
          <thead><tr><th>Data e horário</th><th>Origem, destino ou motivo</th><th className="celula--numero">Valor</th><th>Situação</th><th className="celula--acoes">Caixa</th></tr></thead>
          <tbody>
            {(carga.movimentos?.movimentos ?? []).map((movimento) => <tr key={movimento.id}>
              <td><span className="celula-principal numero">{dataHora(movimento.registradoEm)}</span><span className="celula-secundaria">{movimento.operador || 'Operador não informado'}</span></td>
              <td><span className="historico-caixa__descricao" title={movimento.motivo}>{movimento.motivo}</span><span className="celula-secundaria">{movimento.descricao}</span></td>
              <td className="celula--numero numero">{reaisComSinal(movimento.valor)}</td>
              <td><SeloCompacto tom="neutro">{movimento.tipo === 'estorno-gaveta' ? 'Estorno' : movimento.estornado ? 'Estornada' : 'Registrada'}</SeloCompacto></td>
              <td className="celula--acoes">{movimento.caixaId ? <Botao tamanho="pequeno" onClick={() => setSelecionado(movimento.caixaId)} aria-label={`Ver caixa do movimento de ${reais(Math.abs(movimento.valor))} em ${dataHora(movimento.registradoEm)}`}>Ver</Botao> : <span className="celula-secundaria">Sem caixa vinculado</span>}</td>
            </tr>)}
            {carga.movimentos && !total && <tr><td colSpan={5} className="historico-caixa__vazio">Nenhuma adição ou retirada neste período.</td></tr>}
            {!carga.movimentos && periodoValido && !carga.erro && <tr><td colSpan={5} className="historico-caixa__vazio">Carregando…</td></tr>}
          </tbody>
        </Tabela>}
        {total > 0 && <Paginacao pagina={pronta?.pagina ?? pagina} totalPaginas={paginas} aoMudar={setPagina} resumo={`Mostrando ${inicio + 1}–${Math.min(inicio + porPagina, total)} de ${total} ${consulta === 'caixas' ? 'caixas' : 'movimentos'}`} />}
      </>}
    </div>
  </Modal>
}

function DetalheTurno({ id }: { id: string }) {
  const abrirFicha = useAbrirFicha()
  const [pagina, setPagina] = useState(1)
  const [carga, setCarga] = useState<{ caixa: CaixaDetalhe | null; erro: string | null }>({ caixa: null, erro: null })
  const [tentativa, setTentativa] = useState(0)
  const [conferindo, setConferindo] = useState(false)
  useEffect(() => {
    let vivo = true
    void api().obterCaixa(id).then((r) => {
      if (vivo) setCarga(r.ok ? { caixa: r.dado, erro: null } : { caixa: null, erro: mensagemDe(r) })
    })
    return () => { vivo = false }
  }, [id, tentativa])
  const turno = carga.caixa
  if (!turno) {
    return carga.erro
      ? <p className="historico-caixa__nota" role="alert">{carga.erro} <Botao tamanho="pequeno" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Botao></p>
      : <p className="historico-caixa__nota" role="status">Carregando o caixa…</p>
  }
  const { resumo, movimentos, fechamento } = turno
  const paginas = Math.max(1, Math.ceil(movimentos.length / porPagina))
  const atual = Math.min(pagina, paginas)
  const inicio = (atual - 1) * porPagina

  return <>
    <div className="historico-caixa__identificacao">
      <h3>Caixa aberto em {dataHora(turno.abertoEm)}</h3>
      <p>Por {turno.operadorAbertura}{fechamento && ` · fechado em ${dataHora(fechamento.registradoEm)} por ${fechamento.operador}`}.</p>
    </div>
    <dl className="historico-caixa__resumo">
      <div><dt>Dinheiro inicial</dt><dd>{reais(turno.dinheiroAbertura)}</dd></div>
      <div><dt>Entradas em dinheiro</dt><dd>{reais(resumo.entradas)}</dd></div>
      <div><dt>Saídas em dinheiro</dt><dd>{reais(resumo.saidas)}</dd></div>
      <div><dt>Esperado na gaveta</dt><dd>{reais(resumo.esperado)}</dd></div>
      {fechamento && <div><dt>Contado no fechamento</dt><dd>{reais(fechamento.contado)}</dd></div>}
    </dl>
    {fechamento && <p className="historico-caixa__nota">{textoDiferencaCaixa(fechamento.diferenca)}</p>}
    {fechamento?.justificativa && <p className="historico-caixa__nota">Motivo da diferença: {fechamento.justificativa}</p>}
    {fechamento && fechamento.diferenca !== 0 && (
      <p className="historico-caixa__nota">
        {fechamento.conferidoPor ? `Conferido por ${fechamento.conferidoPor}.` : <strong>Aguardando a dona. </strong>}
        {aguardandoDona(turno) && <Botao tamanho="pequeno" icone="check" onClick={() => setConferindo(true)}>Conferir</Botao>}
      </p>
    )}
    {conferindo && (
      <JanelaAssinatura
        soDona
        gesto={`Conferir o fechamento de ${dataHora(fechamento!.registradoEm)}`}
        rotuloConfirmar="Conferir"
        fazer={(dona) => api().conferirFechamento(turno.id, dona)}
        aoConcluir={(caixa) => { setConferindo(false); setCarga({ caixa, erro: null }) }}
        aoFechar={() => setConferindo(false)}
      />
    )}
    <h3 className="historico-caixa__titulo">Movimentos deste caixa</h3>
    <Tabela larguraMinima={650}>
      <thead><tr><th>Data e horário</th><th>Movimento</th><th className="celula--numero">Valor</th><th className="celula--acoes">Ficha</th></tr></thead>
      <tbody>
        {movimentos.slice(inicio, inicio + porPagina).map((movimento) => <tr key={movimento.id}>
          <td><span className="celula-principal numero">{dataHora(movimento.registradoEm)}</span><span className="celula-secundaria">{movimento.operador}</span></td>
          <td>
            <span className="historico-caixa__descricao" title={movimento.descricao}>{movimento.descricao}</span>
            <span className="celula-secundaria" title={movimento.motivo ?? undefined}>{[movimento.motivo, movimento.estornado && 'estornado'].filter(Boolean).join(' · ') || '—'}</span>
          </td>
          <td className="celula--numero numero">{reaisComSinal(movimento.valor)}</td>
          <td className="celula--acoes">{movimento.ficha ? <Botao tamanho="pequeno" onClick={() => abrirFicha(movimento.ficha!.id)}>#{movimento.ficha.numero}</Botao> : '—'}</td>
        </tr>)}
        {!movimentos.length && <tr><td colSpan={4} className="historico-caixa__vazio">Nenhum movimento em dinheiro registrado neste caixa.</td></tr>}
      </tbody>
    </Tabela>
    {movimentos.length > 0 && <Paginacao pagina={atual} totalPaginas={paginas} aoMudar={setPagina} resumo={`Mostrando ${inicio + 1}–${Math.min(inicio + porPagina, movimentos.length)} de ${movimentos.length} movimentos`} />}
  </>
}
