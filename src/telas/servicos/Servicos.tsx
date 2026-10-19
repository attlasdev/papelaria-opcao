import { useState } from 'react'
import { Tela } from '../../componentes/layout/tela/Tela'
import { Botao, BotaoIcone } from '../../componentes/botao/Botao'
import { Painel, CartaoResumo } from '../../componentes/painel/Painel'
import { Tabela } from '../../componentes/tabela/Tabela'
import { Filtros } from '../../componentes/filtros/Filtros'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { dataCurta, reais } from '../../formatar'
import { definirServicoAtivo, hojeISO, intervaloAtual, intervaloMesPassado, perdasServicos, ROTULO_MOTIVO_PERDA, somarDias, useEstadoDemonstracao, type MotivoPerda, type Servico } from '../../mock/estado-demonstracao'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'
import { JanelaServico } from './JanelaServico'
import './servicos.css'

type PeriodoPerdas = 'semana' | 'mes' | 'mes-passado'

/**
 * Os serviços que a papelaria presta (cópia, impressão…) e as perdas anotadas
 * nas fichas, para a dona conferir. Nada aqui mexe no estoque (`2026-10-19`).
 */
export function Servicos() {
  const base = useEstadoDemonstracao()
  const abrirFicha = useAbrirFicha()
  const [editando, setEditando] = useState<Servico | 'novo' | null>(null)
  const [periodo, setPeriodo] = useState<PeriodoPerdas>('mes')
  const servicos = [...(base.servicos ?? [])].sort((a, b) => Number(Boolean(a.inativo)) - Number(Boolean(b.inativo)) || a.nome.localeCompare(b.nome, 'pt-BR'))
  const hoje = hojeISO()
  const { de, ate } = periodo === 'semana' ? { de: somarDias(hoje, -6), ate: hoje } : periodo === 'mes' ? intervaloAtual('mes', hoje) : intervaloMesPassado(hoje)
  const perdas = perdasServicos(base, de, ate)
  const porMotivo = perdas.reduce((t, p) => ({ ...t, [p.motivo]: (t[p.motivo] ?? 0) + p.quantidade }), {} as Partial<Record<MotivoPerda, number>>)
  const totalPerdas = perdas.reduce((t, p) => t + p.quantidade, 0)

  return (
    <Tela
      titulo="Serviços"
      subtitulo="Serviços prestados no balcão e as perdas anotadas, para conferência."
      acaoCabecalho={<Botao variante="primario" icone="mais" onClick={() => setEditando('novo')}>Cadastrar serviço</Botao>}
    >
      <Painel colado titulo="Serviços cadastrados">
        <Tabela larguraMinima={640}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Serviço</th>
              <th className="celula--numero">Valor</th>
              <th className="celula--acoes">Ações</th>
            </tr>
          </thead>
          <tbody>
            {servicos.map((s) => (
              <tr key={s.codigo} className={s.inativo ? 'servicos__inativo' : undefined}>
                <td><span className="celula-principal codigo">{s.codigo}</span></td>
                <td>
                  <span className="celula-principal">{s.nome}</span>
                  {s.descricao && <span className="celula-secundaria">{s.descricao}</span>}
                </td>
                <td className="celula--numero">{reais(s.preco)}</td>
                <td className="celula--acoes">
                  {s.inativo
                    ? <><SeloCompacto tom="neutro">Desativado</SeloCompacto><Botao tamanho="pequeno" onClick={() => definirServicoAtivo(s.codigo, true)}>Reativar</Botao></>
                    : <BotaoIcone icone="editar" rotulo={`Editar ${s.nome}`} onClick={() => setEditando(s)} />}
                </td>
              </tr>
            ))}
            {servicos.length === 0 && <tr><td colSpan={4} className="servicos__vazio">Nenhum serviço cadastrado. Use “Cadastrar serviço”.</td></tr>}
          </tbody>
        </Tabela>
      </Painel>

      <Painel
        colado
        titulo="Perdas anotadas nos serviços"
        acoes={
          <Filtros
            rotulo="Período das perdas"
            valor={periodo}
            aoMudar={setPeriodo}
            opcoes={[{ valor: 'semana', rotulo: 'Últimos 7 dias' }, { valor: 'mes', rotulo: 'Este mês' }, { valor: 'mes-passado', rotulo: 'Mês passado' }]}
          />
        }
      >
        <div className="grade-resumo servicos__resumo">
          <CartaoResumo rotulo="Perdas no período" icone="alerta" tom={totalPerdas ? 'atencao' : 'neutro'} valor={`${totalPerdas} ${totalPerdas === 1 ? 'unidade' : 'unidades'}`} nota={`${perdas.length} ${perdas.length === 1 ? 'anotação' : 'anotações'}`} />
          {(Object.keys(ROTULO_MOTIVO_PERDA) as MotivoPerda[]).filter((m) => porMotivo[m]).map((m) => (
            <CartaoResumo key={m} rotulo={ROTULO_MOTIVO_PERDA[m]} valor={`${porMotivo[m]} ${porMotivo[m] === 1 ? 'unidade' : 'unidades'}`} />
          ))}
        </div>
        <Tabela larguraMinima={760}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Ficha</th>
              <th>Serviço</th>
              <th className="celula--numero">Perdas</th>
              <th>Motivo</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            {perdas.map((p, i) => (
              <tr key={`${p.ficha}-${i}`}>
                <td className="numero">{dataCurta(p.data)} · {p.horario}</td>
                <td><button type="button" className="servicos__ficha" onClick={() => abrirFicha(p.ficha)}>#{p.ficha}</button></td>
                <td>{p.servico}</td>
                <td className="celula--numero">{p.quantidade}</td>
                <td>{ROTULO_MOTIVO_PERDA[p.motivo]}</td>
                <td><span className="servicos__observacao" title={p.observacao}>{p.observacao ?? '—'}</span></td>
              </tr>
            ))}
            {perdas.length === 0 && <tr><td colSpan={6} className="servicos__vazio">Nenhuma perda anotada neste período.</td></tr>}
          </tbody>
        </Tabela>
      </Painel>

      {editando && <JanelaServico servico={editando === 'novo' ? undefined : editando} aoFechar={() => setEditando(null)} />}
    </Tela>
  )
}
