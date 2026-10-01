import { useState } from 'react'
import { Botao } from '../../componentes/botao/Botao'
import { CampoData } from '../../componentes/campo/Campo'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Modal } from '../../componentes/modal/Modal'
import { Paginacao } from '../../componentes/paginacao/Paginacao'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { Tabela } from '../../componentes/tabela/Tabela'
import { dataCurta, dataHora, reais, reaisComSinal } from '../../formatar'
import { CATEGORIA_ADICAO_CAIXA, CATEGORIA_ESTORNO, CATEGORIA_RETIRADA_CAIXA, hojeISO, movimentosDoTurnoCaixa, movimentosFisicosCaixa, resumoTurnoCaixa, somarDias, textoDiferencaCaixa, turnosCaixaNoPeriodo, useEstadoDemonstracao, type LinhaFinanceiro, type TurnoCaixa } from '../../mock/estado-demonstracao'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'
import './historico-caixa.css'

type Consulta = 'caixas' | 'movimentos'
const porPagina = 6

function origemFisica(movimento: LinhaFinanceiro) {
  if (movimento.estornoDe) return `Estorno · motivo: ${movimento.origem}`
  if (movimento.categoria === CATEGORIA_ADICAO_CAIXA) return 'Dinheiro adicionado'
  if (movimento.categoria === CATEGORIA_RETIRADA_CAIXA) return 'Dinheiro retirado'
  return `Registro antigo · ${movimento.categoria}`
}

export function HistoricoCaixa({ aoFechar, turnoInicial = null }: { aoFechar: () => void; turnoInicial?: string | null }) {
  const base = useEstadoDemonstracao()
  const hoje = hojeISO()
  const [de, setDe] = useState(somarDias(hoje, -6))
  const [ate, setAte] = useState(hoje)
  const [consulta, setConsulta] = useState<Consulta>('caixas')
  const [pagina, setPagina] = useState(1)
  const [selecionado, setSelecionado] = useState<string | null>(turnoInicial)
  const turnos = turnosCaixaNoPeriodo(base, de, ate)
  const transferencias = de && ate && de <= ate ? movimentosFisicosCaixa(base).filter((item) => item.data >= de && item.data <= ate) : []
  const turno = (base.turnosCaixa ?? []).find((item) => item.id === selecionado)
  const total = consulta === 'caixas' ? turnos.length : transferencias.length
  const paginas = Math.max(1, Math.ceil(total / porPagina))
  const atual = Math.min(pagina, paginas)
  const inicio = (atual - 1) * porPagina

  return <Modal titulo="Histórico do caixa" subtitulo="Consulte as contagens e movimentações da gaveta." aoFechar={aoFechar} rodape={<Botao onClick={aoFechar}>Fechar histórico</Botao>}>
    <div className="historico-caixa">
      {turno ? <>
        <div><Botao tamanho="pequeno" icone="seta-esquerda" onClick={() => setSelecionado(null)}>Voltar ao histórico</Botao></div>
        <DetalheTurno turno={turno} />
      </> : <>
        <div className="historico-caixa__periodo">
          <CampoData rotulo="De" valor={de} max={ate || hoje} aoMudar={(valor) => { setDe(valor); setPagina(1) }} />
          <CampoData rotulo="Até" valor={ate} min={de || undefined} max={hoje} aoMudar={(valor) => { setAte(valor); setPagina(1) }} />
        </div>
        <div className="historico-caixa__atalhos"><Botao tamanho="pequeno" onClick={() => { setDe(somarDias(hoje, -6)); setAte(hoje); setPagina(1) }}>Últimos 7 dias</Botao><Botao tamanho="pequeno" onClick={() => { setDe(`${hoje.slice(0, 7)}-01`); setAte(hoje); setPagina(1) }}>Este mês</Botao></div>
        <p className="historico-caixa__nota">Fechamentos pela data em que foram concluídos; caixas abertos pela data de abertura.</p>
        {(!de || !ate) && <p className="historico-caixa__nota" role="status">Preencha as duas datas para consultar.</p>}
        <Filtros rotulo="Consultar histórico do caixa" valor={consulta} aoMudar={(valor) => { setConsulta(valor); setPagina(1) }} opcoes={[{ valor: 'caixas', rotulo: 'Aberturas e fechamentos' }, { valor: 'movimentos', rotulo: 'Adições e retiradas' }]} />
        {consulta === 'movimentos' && transferencias.some((item) => item.categoria === 'Troco' || item.categoria === 'Saída de caixa') && (
          <p className="historico-caixa__nota">Registros antigos sem turno vinculado mantêm os valores e sinais originais.</p>
        )}
        {consulta === 'caixas' ? <Tabela larguraMinima={680}>
          <thead><tr><th>Abertura</th><th className="celula--numero">Inicial</th><th className="celula--numero">Fechamento</th><th>Situação</th><th className="celula--acoes">Ações</th></tr></thead>
          <tbody>
            {turnos.slice(inicio, inicio + porPagina).map((item) => {
              const resumo = resumoTurnoCaixa(base, item)
              return <tr key={item.id}>
                <td><span className="celula-principal numero">{dataHora(item.abertoEm)}</span><span className="celula-secundaria">{item.operadorAbertura}</span></td>
                <td className="celula--numero numero">{reais(item.fundoInicial)}</td>
                <td className="celula--numero"><span className="celula-principal numero">{item.contadoFechamento === undefined ? '—' : reais(item.contadoFechamento)}</span><span className="celula-secundaria numero">{item.fechadoEm ? dataHora(item.fechadoEm) : 'Ainda aberto'}</span></td>
                <td><SeloCompacto tom={!item.fechadoEm ? 'neutro' : resumo.diferenca === 0 ? 'ok' : 'atencao'}>{!item.fechadoEm ? 'Aberto' : resumo.diferenca === 0 ? 'Conferido' : 'Com diferença'}</SeloCompacto></td>
                <td className="celula--acoes"><Botao tamanho="pequeno" aria-label={`Ver caixa aberto em ${dataHora(item.abertoEm)}`} onClick={() => setSelecionado(item.id)}>Ver</Botao></td>
              </tr>
            })}
            {!turnos.length && <tr><td colSpan={5} className="historico-caixa__vazio">Nenhum caixa registrado neste período.</td></tr>}
          </tbody>
        </Tabela> : <Tabela larguraMinima={660}>
          <thead><tr><th>Data e horário</th><th>Origem, destino ou motivo</th><th className="celula--numero">Valor</th><th>Situação</th><th className="celula--acoes">Caixa</th></tr></thead>
          <tbody>
            {transferencias.slice(inicio, inicio + porPagina).map((movimento) => <tr key={movimento.id}>
              <td><span className="celula-principal numero">{dataCurta(movimento.data)}, {movimento.horario}</span><span className="celula-secundaria">{movimento.operador || 'Operador não informado'}</span></td>
              <td><span className="historico-caixa__descricao" title={movimento.descricao}>{movimento.descricao}</span><span className="celula-secundaria" title={origemFisica(movimento)}>{origemFisica(movimento)}</span></td>
              <td className="celula--numero numero">{reaisComSinal(movimento.valor)}</td>
              <td><SeloCompacto tom="neutro">{movimento.estornoDe ? 'Estorno' : movimento.estornado ? 'Estornada' : 'Registrada'}</SeloCompacto></td>
              <td className="celula--acoes">{(base.turnosCaixa ?? []).some((item) => item.id === movimento.turnoCaixaId) ? <Botao tamanho="pequeno" onClick={() => setSelecionado(movimento.turnoCaixaId!)} aria-label={`Ver caixa do movimento de ${reais(Math.abs(movimento.valor))} em ${dataCurta(movimento.data)}, ${movimento.horario}`}>Ver</Botao> : <span className="celula-secundaria">Sem turno vinculado</span>}</td>
            </tr>)}
            {!transferencias.length && <tr><td colSpan={5} className="historico-caixa__vazio">Nenhuma adição ou retirada neste período.</td></tr>}
          </tbody>
        </Tabela>}
        {total > 0 && <Paginacao pagina={atual} totalPaginas={paginas} aoMudar={setPagina} resumo={`Mostrando ${inicio + 1}–${Math.min(inicio + porPagina, total)} de ${total} ${consulta === 'caixas' ? 'caixas' : 'movimentos'}`} />}
      </>}
    </div>
  </Modal>
}

function DetalheTurno({ turno }: { turno: TurnoCaixa }) {
  const base = useEstadoDemonstracao()
  const abrirFicha = useAbrirFicha()
  const [pagina, setPagina] = useState(1)
  const resumo = resumoTurnoCaixa(base, turno)
  const movimentos = movimentosDoTurnoCaixa(base, turno.id)
  const paginas = Math.max(1, Math.ceil(movimentos.length / porPagina))
  const atual = Math.min(pagina, paginas)
  const inicio = (atual - 1) * porPagina

  return <>
    <div className="historico-caixa__identificacao">
      <h3>Caixa aberto em {dataHora(turno.abertoEm)}</h3>
      <p>Por {turno.operadorAbertura}{turno.fechadoEm && ` · fechado em ${dataHora(turno.fechadoEm)} por ${turno.operadorFechamento}`}.</p>
    </div>
    <dl className="historico-caixa__resumo">
      <div><dt>Dinheiro inicial</dt><dd>{reais(turno.fundoInicial)}</dd></div>
      <div><dt>Entradas em dinheiro</dt><dd>{reais(resumo.entradas)}</dd></div>
      <div><dt>Saídas em dinheiro</dt><dd>{reais(resumo.saidas)}</dd></div>
      <div><dt>Esperado na gaveta</dt><dd>{reais(resumo.esperado)}</dd></div>
      {turno.contadoFechamento !== undefined && <div><dt>Contado no fechamento</dt><dd>{reais(turno.contadoFechamento)}</dd></div>}
    </dl>
    {resumo.diferenca !== undefined && <p className="historico-caixa__nota">{textoDiferencaCaixa(resumo.diferenca)}</p>}
    {turno.justificativaDiferenca && <p className="historico-caixa__nota">Motivo da diferença: {turno.justificativaDiferenca}</p>}
    <h3 className="historico-caixa__titulo">Movimentos deste caixa</h3>
    <Tabela larguraMinima={650}>
      <thead><tr><th>Data e horário</th><th>Movimento</th><th className="celula--numero">Valor</th><th className="celula--acoes">Ficha</th></tr></thead>
      <tbody>
        {movimentos.slice(inicio, inicio + porPagina).map((movimento) => <tr key={movimento.id}>
          <td><span className="celula-principal numero">{dataCurta(movimento.data)}, {movimento.horario}</span><span className="celula-secundaria">{movimento.operador}</span></td>
          <td><span className="historico-caixa__descricao" title={movimento.descricao}>{movimento.descricao}</span><span className="celula-secundaria" title={movimento.categoria === CATEGORIA_ESTORNO ? `Estorno · motivo: ${movimento.origem}` : movimento.categoria}>{movimento.categoria === CATEGORIA_ESTORNO ? `Estorno · motivo: ${movimento.origem}` : `${movimento.categoria}${movimento.estornado ? ' · estornado' : ''}`}</span></td>
          <td className="celula--numero numero">{reaisComSinal(movimento.valor)}</td>
          <td className="celula--acoes">{movimento.ficha ? <Botao tamanho="pequeno" onClick={() => abrirFicha(movimento.ficha!)}>#{movimento.ficha}</Botao> : '—'}</td>
        </tr>)}
        {!movimentos.length && <tr><td colSpan={4} className="historico-caixa__vazio">Nenhum movimento em dinheiro registrado neste caixa.</td></tr>}
      </tbody>
    </Tabela>
    {movimentos.length > 0 && <Paginacao pagina={atual} totalPaginas={paginas} aoMudar={setPagina} resumo={`Mostrando ${inicio + 1}–${Math.min(inicio + porPagina, movimentos.length)} de ${movimentos.length} movimentos`} />}
  </>
}
