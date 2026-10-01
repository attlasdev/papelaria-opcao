import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Modal } from '../../componentes/modal/Modal'
import { Botao } from '../../componentes/botao/Botao'
import { Filtros } from '../../componentes/filtros/Filtros'
import { SeloCompacto } from '../../componentes/selo/Selo'
import { useEstadoDemonstracao } from '../../mock/estado-demonstracao'
import { dataCurta, reais } from '../../formatar'
import { rotas } from '../../rotas-caminhos'
import './movimentacoes-estoque.css'
import { useAbrirFicha } from '../detalhe-ficha/AbrirFicha'

/** O histórico tem centenas de movimentos; a janela mostra os mais recentes. */
const LIMITE = 150

export function MovimentacoesEstoque() {
  const abrirFicha = useAbrirFicha()
  const [parametros] = useSearchParams()
  const navegar = useNavigate()
  const fechar = useCallback(() => navegar(rotas.estoque), [navegar])
  const [tipo, setTipo] = useState<'todas' | 'Entrada' | 'Ajuste' | 'Venda'>('todas')
  const { movimentosEstoque, produtos } = useEstadoDemonstracao()
  const codigo = parametros.get('produto')
  const produto = produtos.find((item) => item.codigo === codigo)
  const todos = movimentosEstoque.filter((item) =>
    (tipo === 'todas' || item.tipo === tipo) && (!codigo || item.produto === codigo),
  )
  const lista = todos.slice(0, LIMITE)
  const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <Modal
      variante="lateral"
      titulo={produto ? `Movimentações de ${produto.codigo}` : 'Movimentações do estoque'}
      subtitulo={produto?.descricao ?? 'Entradas, vendas e correções de contagem.'}
      aoFechar={fechar}
    >
      <div className="movimentacoes-estoque__controles">
        <Filtros rotulo="Tipo de movimentação" valor={tipo} aoMudar={setTipo} opcoes={[{ valor: 'todas', rotulo: 'Todas' }, { valor: 'Entrada', rotulo: 'Entradas' }, { valor: 'Ajuste', rotulo: 'Ajustes' }, { valor: 'Venda', rotulo: 'Vendas' }]} />
        {codigo && <Botao tamanho="pequeno" onClick={() => navegar(rotas.movimentacoesEstoque(), { replace: true })}>Ver todos</Botao>}
      </div>
      <p className="movimentacoes-estoque__total">
        {todos.length} {todos.length === 1 ? 'movimentação' : 'movimentações'}
        {todos.length > LIMITE && ` · mostrando as ${LIMITE} mais recentes`}
      </p>
      <div className="movimentacoes-estoque__lista">
        {lista.map((item) => (
          <article className="movimentacoes-estoque__item" key={item.id}>
            <div className="movimentacoes-estoque__item-topo">
              <span className="movimentacoes-estoque__data numero">{data.format(new Date(item.data))}{item.operador && ` · ${item.operador}`}</span>
              <SeloCompacto tom={item.tipo === 'Entrada' || item.tipo === 'Cancelamento' ? 'ok' : item.tipo === 'Venda' ? 'neutro' : 'atencao'}>{item.tipo}</SeloCompacto>
            </div>
            <strong className="movimentacoes-estoque__produto" title={item.descricao}>{item.descricao}</strong>
            <span className="movimentacoes-estoque__codigo codigo">{item.produto}</span>
            <div className="movimentacoes-estoque__item-rodape">
              <span className="movimentacoes-estoque__motivo">
                {/^Ficha #\d+/.test(item.motivo) ? (
                  <button type="button" className="movimentacoes-estoque__ficha" onClick={() => abrirFicha(item.motivo.slice(7).split(' ')[0])}>{item.motivo}</button>
                ) : item.motivo}
              </span>
              <span className="movimentacoes-estoque__saldos numero">{item.antes} <span aria-label="para">→</span> <strong>{item.depois}</strong></span>
            </div>
            {item.entrada && (
              <dl className="movimentacoes-estoque__entrada">
                <div><dt>Recebido em</dt><dd>{dataCurta(item.entrada.recebidaEm)}</dd></div>
                {item.entrada.fornecedor && <div><dt>Fornecedor</dt><dd>{item.entrada.fornecedor}</dd></div>}
                {item.entrada.referencia && <div><dt>Referência</dt><dd>{item.entrada.referencia}</dd></div>}
                {item.entrada.custoUnitario !== undefined && <div><dt>Custo unitário</dt><dd>{reais(item.entrada.custoUnitario)}</dd></div>}
                {item.entrada.observacoes && <div className="movimentacoes-estoque__entrada-observacoes"><dt>Observações</dt><dd>{item.entrada.observacoes}</dd></div>}
              </dl>
            )}
          </article>
        ))}
        {lista.length === 0 && <p className="movimentacoes-estoque__vazio">Nenhuma movimentação encontrada para este filtro.</p>}
      </div>
    </Modal>
  )
}
