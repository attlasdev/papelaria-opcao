import { useState, type Ref } from 'react'
import { NavLink, useNavigate } from 'react-router'
import logo from '../../../../recursos/marca/logo-original.svg'
import { Icone, type NomeIcone } from '../../icone/Icone'
import { Botao } from '../../botao/Botao'
import { Modal } from '../../modal/Modal'
import { restaurarDemonstracao, useEstadoDemonstracao } from '../../../mock/estado-demonstracao'
import { useSincronia, type SituacaoGravacao } from '../../../dados/sincronia'
import { rotas } from '../../../rotas-caminhos'
import { funcoes } from '../../../funcoes'
import './barra-lateral.css'

const podeRestaurar = funcoes.restaurarExemplo

const secoes: { rotulo: string; icone: NomeIcone; caminho: string; exato?: boolean }[] = [
  { rotulo: 'Início', icone: 'inicio', caminho: rotas.inicio, exato: true },
  { rotulo: 'Clientes', icone: 'clientes', caminho: rotas.clientes },
  { rotulo: 'Financeiro', icone: 'financeiro', caminho: rotas.financeiro },
  { rotulo: 'Caixa', icone: 'dinheiro', caminho: rotas.caixa },
  { rotulo: 'Estoque', icone: 'estoque', caminho: rotas.estoque },
  { rotulo: 'Serviços', icone: 'imprimir', caminho: rotas.servicos },
  ...(funcoes.notasFiscais ? [{ rotulo: 'Notas fiscais', icone: 'notas' as const, caminho: rotas.notas }] : []),
]

type Props = { recolhida: boolean; ref?: Ref<HTMLElement> }

const textoGravacao: Record<SituacaoGravacao, string> = {
  salvo: 'Salvo',
  pendente: 'Salvando…',
  salvando: 'Salvando…',
  'sem-conexao': 'Sem conexão',
  conflito: 'Não salvo',
}

/** Onde estão os dados: salvos no banco, a caminho, ou presos no computador. */
function IndicadorGravacao({ recolhida }: { recolhida: boolean }) {
  const estado = useSincronia()
  if (estado.fase !== 'pronto') return null
  const problema = estado.gravacao === 'sem-conexao' || estado.gravacao === 'conflito'
  const hora = estado.salvoEm ? new Date(estado.salvoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null
  const texto = estado.gravacao === 'salvo' && hora ? `Salvo às ${hora}` : textoGravacao[estado.gravacao]
  const detalhe = estado.gravacao === 'sem-conexao'
    ? 'Os dados estão guardados neste computador e vão para o banco quando a internet voltar.'
    : estado.mensagem ?? (estado.descartada ? 'Havia mudanças antigas neste computador que não entraram; elas foram guardadas à parte.' : texto)
  return (
    <p
      className={problema ? 'barra-lateral__gravacao barra-lateral__gravacao--problema' : 'barra-lateral__gravacao'}
      role="status"
      title={detalhe}
      aria-label={`${texto}. ${detalhe}`}
    >
      <Icone nome={problema ? 'alerta' : 'nuvem-ok'} tamanho={16} />
      {!recolhida && <span>{texto}</span>}
    </p>
  )
}

/** A mesma barra em todas as telas: marca, seções, criar ficha, operador. */
export function BarraLateral({ recolhida, ref }: Props) {
  const navegar = useNavigate()
  const { operador } = useEstadoDemonstracao()
  const [restaurando, setRestaurando] = useState(false)

  function restaurar() {
    restaurarDemonstracao()
    setRestaurando(false)
    navegar(rotas.inicio)
  }

  return (
    <aside ref={ref} className={recolhida ? 'barra-lateral barra-lateral--compacta' : 'barra-lateral'} aria-label="Menu principal">
      <div className="barra-lateral__marca">
        <img className="barra-lateral__logo" src={logo} alt="Papelaria Opção" />
        <div className="barra-lateral__nome">
          <strong><span>Papelaria</span><span>Opção</span></strong>
        </div>
      </div>

      <nav id="menu-principal" className="barra-lateral__menu" aria-label="Seções">
        {secoes.map((secao) => (
          <NavLink
            key={secao.caminho}
            to={secao.caminho}
            end={secao.exato}
            aria-label={secao.rotulo}
            title={recolhida ? secao.rotulo : undefined}
            className={({ isActive }) =>
              isActive ? 'barra-lateral__item barra-lateral__item--ativo' : 'barra-lateral__item'
            }
          >
            <Icone nome={secao.icone} />
            <span>{secao.rotulo}</span>
          </NavLink>
        ))}
      </nav>

      <div className="barra-lateral__rodape">
        <button type="button" className="barra-lateral__criar" aria-label="Criar ficha" title={recolhida ? 'Criar ficha' : undefined} onClick={() => navegar(rotas.criarFicha)}>
          <Icone nome="carrinho" tamanho={18} />
          <span>Criar ficha</span>
        </button>
        {/* Restaurar a amostra: desligado em src/funcoes.ts (apagaria os dados do banco ligado). */}
        <button
          type="button"
          className="barra-lateral__operador"
          aria-label={podeRestaurar ? `Operador: ${operador}. Restaurar dados de exemplo` : `Operador: ${operador}`}
          title={recolhida ? `Operador: ${operador}` : podeRestaurar ? 'Restaurar dados de exemplo' : undefined}
          onClick={podeRestaurar ? () => setRestaurando(true) : undefined}
        >
          <Icone nome="pessoa-circulo" tamanho={24} />
          <span>Operador: {operador}</span>
        </button>
        <IndicadorGravacao recolhida={recolhida} />
      </div>

      {podeRestaurar && restaurando && (
        <Modal
          estreito
          titulo="Restaurar dados de exemplo"
          subtitulo="Ferramenta de desenvolvimento."
          aoFechar={() => setRestaurando(false)}
          rodape={
            <>
              <Botao variante="fantasma" onClick={() => setRestaurando(false)}>Cancelar</Botao>
              <Botao variante="primario" icone="historico" onClick={restaurar}>Restaurar</Botao>
            </>
          }
        >
          <p>
            Apaga as vendas, clientes, recebimentos e ajustes e volta à amostra de 90 dias até hoje.
            Só existe em desenvolvimento: a troca também vai para o banco ligado a este app.
          </p>
        </Modal>
      )}
    </aside>
  )
}
