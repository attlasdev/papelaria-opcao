import { useState, type Ref } from 'react'
import { NavLink, useNavigate } from 'react-router'
import logo from '../../../../recursos/marca/logo-original.svg'
import { Icone, type NomeIcone } from '../../icone/Icone'
import { rotas } from '../../../rotas-caminhos'
import { Pessoas } from '../../../telas/pessoas/Pessoas'
import './barra-lateral.css'

const secoes: { rotulo: string; icone: NomeIcone; caminho: string; exato?: boolean }[] = [
  { rotulo: 'Início', icone: 'inicio', caminho: rotas.inicio, exato: true },
  { rotulo: 'Clientes', icone: 'clientes', caminho: rotas.clientes },
  { rotulo: 'Financeiro', icone: 'financeiro', caminho: rotas.financeiro },
  { rotulo: 'Caixa', icone: 'dinheiro', caminho: rotas.caixa },
  { rotulo: 'Estoque', icone: 'estoque', caminho: rotas.estoque },
  { rotulo: 'Serviços', icone: 'imprimir', caminho: rotas.servicos },
  { rotulo: 'Boletos', icone: 'documento', caminho: rotas.boletos },
]

type Props = { recolhida: boolean; ref?: Ref<HTMLElement> }

/** A mesma barra em todas as telas: marca, seções, criar ficha, pessoas da loja. */
export function BarraLateral({ recolhida, ref }: Props) {
  const navegar = useNavigate()
  const [pessoas, setPessoas] = useState(false)

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
        {/* Sem operador fixo (`R-OPERADOR-02`): quem faz é escolhido com PIN em cada gesto. */}
        <button
          type="button"
          className="barra-lateral__operador"
          aria-label="Pessoas da loja"
          title={recolhida ? 'Pessoas da loja' : undefined}
          onClick={() => setPessoas(true)}
        >
          <Icone nome="pessoa-circulo" tamanho={24} />
          <span>Pessoas</span>
        </button>
      </div>

      {pessoas && <Pessoas aoFechar={() => setPessoas(false)} />}
    </aside>
  )
}
