import { useState, type Ref } from 'react'
import { NavLink, useNavigate } from 'react-router'
import logo from '../../../../recursos/marca/logo-original.svg'
import { Icone, type NomeIcone } from '../../icone/Icone'
import { Botao } from '../../botao/Botao'
import { Modal } from '../../modal/Modal'
import { restaurarDemonstracao, useEstadoDemonstracao } from '../../../mock/estado-demonstracao'
import { rotas } from '../../../rotas-caminhos'
import './barra-lateral.css'

const secoes: { rotulo: string; icone: NomeIcone; caminho: string; exato?: boolean }[] = [
  { rotulo: 'Início', icone: 'inicio', caminho: rotas.inicio, exato: true },
  { rotulo: 'Clientes', icone: 'clientes', caminho: rotas.clientes },
  { rotulo: 'Financeiro', icone: 'financeiro', caminho: rotas.financeiro },
  { rotulo: 'Caixa', icone: 'dinheiro', caminho: rotas.caixa },
  { rotulo: 'Estoque', icone: 'estoque', caminho: rotas.estoque },
  { rotulo: 'Notas fiscais', icone: 'notas', caminho: rotas.notas },
]

type Props = { recolhida: boolean; ref?: Ref<HTMLElement> }

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
        <button
          type="button"
          className="barra-lateral__operador"
          aria-label={`Operador: ${operador}. Restaurar dados de exemplo`}
          title={recolhida ? `Operador: ${operador}` : 'Restaurar dados de exemplo'}
          onClick={() => setRestaurando(true)}
        >
          <Icone nome="pessoa-circulo" tamanho={24} />
          <span>Operador: {operador}</span>
        </button>
      </div>

      {restaurando && (
        <Modal
          estreito
          titulo="Restaurar dados de exemplo"
          subtitulo="Os dados de demonstração ficam guardados nesta máquina."
          aoFechar={() => setRestaurando(false)}
          rodape={
            <>
              <Botao variante="fantasma" onClick={() => setRestaurando(false)}>Cancelar</Botao>
              <Botao variante="primario" icone="historico" onClick={restaurar}>Restaurar</Botao>
            </>
          }
        >
          <p>
            Apaga as vendas, clientes, recebimentos e ajustes feitos aqui e volta à amostra de 90 dias até hoje.
            Não afeta nenhum banco de dados.
          </p>
        </Modal>
      )}
    </aside>
  )
}
