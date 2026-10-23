import { useState } from 'react'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao, BotaoIcone } from '../../componentes/botao/Botao'
import { CartaoResumo, Painel } from '../../componentes/painel/Painel'
import { Filtros } from '../../componentes/filtros/Filtros'
import { Tabela } from '../../componentes/tabela/Tabela'
import { SeloCompacto, type Tom } from '../../componentes/selo/Selo'
import { Icone } from '../../componentes/icone/Icone'
import { dataCurta, dataHora, reais } from '../../formatar'
import { DIAS_AVISO_BOLETO, diaDoInstante, hojeISO, marcarBoletoPago, normalizar, prazoBoleto, resumoBoletos, situacaoBoleto, useEstadoDemonstracao, type Boleto, type SituacaoBoleto } from '../../mock/estado-demonstracao'
import { JanelaBoleto } from './JanelaBoleto'
import './boletos.css'

type Filtro = 'a-pagar' | 'vencidos' | 'pagos' | 'todos'

const tom: Record<SituacaoBoleto, Tom> = { pago: 'ok', vencido: 'critico', vencendo: 'atencao', 'a-vencer': 'neutro' }
/** O fundo da linha acompanha o tom do selo, como no Estoque. */
const linha: Partial<Record<SituacaoBoleto, string>> = { vencido: 'linha--critica', vencendo: 'linha--atencao' }

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/**
 * Boletos da loja, só anotados (`2026-10-23`): descrição, valor, número do
 * arquivo físico e vencimento. O sino avisa os vencidos e os que vencem em até
 * `DIAS_AVISO_BOLETO` dias. Pagar não lança nada no Financeiro.
 */
export function Boletos() {
  const base = useEstadoDemonstracao()
  const hoje = hojeISO()
  const [filtro, setFiltro] = useState<Filtro>('a-pagar')
  const [busca, setBusca] = useState('')
  // undefined: fechada; null: novo boleto; um boleto: editar.
  const [janela, setJanela] = useState<Boleto | null | undefined>(undefined)
  const resumo = resumoBoletos(base, hoje)
  const pagos = base.boletos.filter((b) => b.pagoEm).length

  const termo = normalizar(busca.trim())
  const lista = base.boletos
    .filter((b) => {
      const { situacao } = situacaoBoleto(b, hoje)
      if (filtro === 'a-pagar' && situacao === 'pago') return false
      if (filtro === 'vencidos' && situacao !== 'vencido') return false
      if (filtro === 'pagos' && situacao !== 'pago') return false
      return !termo || normalizar(`${b.numero} ${b.descricao}`).includes(termo)
    })
    // Em aberto primeiro, pelo vencimento mais próximo; pagos depois, do mais recente.
    .sort((a, b) => Number(Boolean(a.pagoEm)) - Number(Boolean(b.pagoEm))
      || (a.pagoEm && b.pagoEm ? b.pagoEm.localeCompare(a.pagoEm) : a.vencimento.localeCompare(b.vencimento)))

  return (
    <Tela
      titulo="Boletos"
      subtitulo="Boletos da loja a pagar, com aviso no sino perto do vencimento."
      acaoCabecalho={
        <Botao variante="primario" icone="mais" onClick={() => setJanela(null)}>
          Cadastrar boleto
        </Botao>
      }
    >
      <div className="grade-resumo">
        <CartaoResumo rotulo="Vencidos" icone="alerta" tom={resumo.vencidos.quantidade ? 'critico' : 'neutro'} valor={reais(resumo.vencidos.valor)} nota={plural(resumo.vencidos.quantidade, 'boleto', 'boletos')} />
        <CartaoResumo rotulo={`Vencem em até ${DIAS_AVISO_BOLETO} dias`} icone="relogio" tom={resumo.vencendo.quantidade ? 'atencao' : 'neutro'} valor={reais(resumo.vencendo.valor)} nota={plural(resumo.vencendo.quantidade, 'boleto', 'boletos')} />
        <CartaoResumo rotulo="A pagar" icone="documento" valor={reais(resumo.aPagar.valor)} nota={plural(resumo.aPagar.quantidade, 'boleto em aberto', 'boletos em aberto')} />
      </div>

      <div className="boletos__filtros">
        <Filtros
          rotulo="Filtrar boletos"
          valor={filtro}
          aoMudar={setFiltro}
          opcoes={[
            { valor: 'a-pagar', rotulo: 'A pagar', contagem: resumo.aPagar.quantidade },
            { valor: 'vencidos', rotulo: 'Vencidos', contagem: resumo.vencidos.quantidade },
            { valor: 'pagos', rotulo: 'Pagos', contagem: pagos },
            { valor: 'todos', rotulo: 'Todos', contagem: base.boletos.length },
          ]}
        />
        <label className="boletos__busca">
          <Icone nome="busca" tamanho={18} />
          <input type="search" placeholder="Buscar por descrição ou número..." value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar boletos" />
        </label>
      </div>

      <Painel colado titulo="Boletos">
        <Tabela larguraMinima={860} className="boletos__tabela">
          <thead>
            <tr>
              <th>Nº</th>
              <th>Descrição</th>
              <th>Vencimento</th>
              <th className="celula--numero">Valor</th>
              <th>Cadastrado em</th>
              <th className="celula--acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((boleto) => {
              const { situacao, dias } = situacaoBoleto(boleto, hoje)
              const prazo = prazoBoleto(dias)
              return (
                <tr key={boleto.id} className={linha[situacao]}>
                  <td className="codigo">{boleto.numero}</td>
                  <td><span className="boletos__descricao" title={boleto.descricao}>{boleto.descricao}</span></td>
                  <td>
                    <div className="boletos__vencimento">
                      <span className="numero">{dataCurta(boleto.vencimento)}</span>
                      {/* Pago: dia/mês, para caber no selo; a data inteira fica no balão. */}
                      <span title={situacao === 'pago' ? `Pago em ${dataCurta(boleto.pagoEm!)}${boleto.pagoPor ? ` por ${boleto.pagoPor}` : ''}` : undefined}>
                        <SeloCompacto tom={tom[situacao]}>
                          {situacao === 'pago' ? `Pago em ${dataCurta(boleto.pagoEm!).slice(0, 5)}` : prazo.charAt(0).toUpperCase() + prazo.slice(1)}
                        </SeloCompacto>
                      </span>
                    </div>
                  </td>
                  <td className="celula--numero">{reais(boleto.valor)}</td>
                  <td className="numero" title={dataHora(boleto.cadastradoEm)}>{dataCurta(diaDoInstante(boleto.cadastradoEm))}</td>
                  <td className="celula--acoes">
                    <AcaoPagar boleto={boleto} destaque={situacao === 'vencido' || situacao === 'vencendo'} />
                    <BotaoIcone icone="editar" rotulo={`Editar ${boleto.descricao}`} onClick={() => setJanela(boleto)} />
                  </td>
                </tr>
              )
            })}
            {lista.length === 0 && (
              <tr><td colSpan={6} className="boletos__vazio">
                {base.boletos.length === 0 ? 'Nenhum boleto anotado. Use "Cadastrar boleto" para começar.' : 'Nenhum boleto corresponde à busca ou ao filtro selecionado.'}
              </td></tr>
            )}
          </tbody>
        </Tabela>
      </Painel>

      {janela !== undefined && <JanelaBoleto atual={janela ?? undefined} aoFechar={() => setJanela(undefined)} />}
    </Tela>
  )
}

/**
 * Marcar como pago (ou desfazer) pede um segundo clique. Provisório: a
 * confirmação do operador está sendo desenhada à parte (Memoria.md, PENDENTE).
 */
function AcaoPagar({ boleto, destaque }: { boleto: Boleto; destaque: boolean }) {
  const [confirmando, setConfirmando] = useState(false)
  const pago = Boolean(boleto.pagoEm)
  return (
    <Botao
      tamanho="pequeno"
      variante={confirmando || destaque ? 'primario' : 'secundario'}
      className="boletos__pagar"
      title={pago && boleto.pagoPor ? `Marcado por ${boleto.pagoPor}` : undefined}
      onBlur={() => setConfirmando(false)}
      onClick={() => {
        if (!confirmando) return setConfirmando(true)
        marcarBoletoPago(boleto.id, !pago)
        setConfirmando(false)
      }}
    >
      {confirmando ? (pago ? 'Confirmar: desfazer' : 'Confirmar pagamento') : pago ? 'Desfazer pagamento' : 'Marcar como pago'}
    </Botao>
  )
}
