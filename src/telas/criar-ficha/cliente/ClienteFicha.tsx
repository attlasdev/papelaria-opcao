import { useState } from 'react'
import { Botao } from '../../../componentes/botao/Botao'
import { Campo } from '../../../componentes/campo/Campo'
import { Icone } from '../../../componentes/icone/Icone'
import { useEstadoDemonstracao } from '../../../mock/estado-demonstracao'
import { semIdentificacao, type EscolhaCliente } from '../dados-exemplo'
import { ModalNovoCliente } from './ModalNovoCliente'
import './cliente-ficha.css'

type Props = {
  cliente: EscolhaCliente | null
  aoEscolher: (cliente: EscolhaCliente | null) => void
  erro?: string
}

/** Resultados da busca: poucos, para não empurrar os itens da venda para fora da tela. */
const maximoResultados = 6

/**
 * Cliente da ficha: busca um cadastrado, cadastra um novo (em janela, sem sair
 * da venda) ou marca a venda como sem identificação. A ficha abre sem nada
 * escolhido; sem identificação não vira cadastro, a ficha só fica sem cliente.
 */
export function ClienteFicha({ cliente, aoEscolher, erro }: Props) {
  const [modo, setModo] = useState<'ver' | 'buscar'>(cliente ? 'ver' : 'buscar')
  /** Nome que abre no cadastro; null = janela fechada. */
  const [cadastro, setCadastro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const { clientes } = useEstadoDemonstracao()

  const termo = busca.trim().toLowerCase()
  const encontrados = termo ? clientes.filter((c) => `${c.nome} ${c.documento}`.toLowerCase().includes(termo)) : []
  const visiveis = encontrados.slice(0, maximoResultados)

  function escolher(novo: EscolhaCliente) {
    aoEscolher(novo)
    setModo('ver')
    setBusca('')
  }

  function trocar() {
    aoEscolher(null)
    setModo('buscar')
  }

  return (
    <section className="cliente-ficha">
      <header className="cliente-ficha__topo">
        <h2>Cliente</h2>
        {modo === 'buscar' && (
          <div className="cliente-ficha__atalhos">
            <button type="button" className="cliente-ficha__link" onClick={() => escolher(semIdentificacao)}>
              <Icone nome="pessoa-circulo" tamanho={16} /> Vender sem identificação
            </button>
            <button type="button" className="cliente-ficha__link" onClick={() => setCadastro('')}>
              <Icone nome="adicionar-pessoa" tamanho={16} /> Cadastrar novo cliente
            </button>
          </div>
        )}
      </header>

      {modo === 'ver' && cliente === semIdentificacao && (
        <div className="cliente-ficha__escolhido">
          <span className="cliente-ficha__avatar cliente-ficha__avatar--sem-identificacao">
            <Icone nome="pessoa" tamanho={20} />
          </span>
          <div className="cliente-ficha__dados">
            <strong>Cliente não identificado</strong>
            <span>Venda sem cadastro · dá baixa no estoque e entra no financeiro normalmente</span>
          </div>
          <Botao tamanho="pequeno" onClick={trocar}>
            Identificar cliente
          </Botao>
        </div>
      )}

      {modo === 'ver' && cliente && cliente !== semIdentificacao && (
        <div className="cliente-ficha__escolhido">
          <span className="cliente-ficha__avatar">
            <Icone nome="pessoa" tamanho={20} />
          </span>
          <div className="cliente-ficha__dados">
            <strong>{cliente.nome}</strong>
            <span>
              {cliente.documento} · {cliente.telefone}
            </span>
          </div>
          <Botao tamanho="pequeno" onClick={trocar}>
            Trocar cliente
          </Botao>
        </div>
      )}

      {modo === 'buscar' && (
        <div className="cliente-ficha__busca">
          <Campo
            rotulo="Buscar cliente cadastrado"
            icone="busca"
            placeholder="Nome ou CPF"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            erro={Boolean(erro)}
            ajuda={erro}
            autoFocus
          />
          {termo && (
            <ul className="cliente-ficha__resultados">
              {visiveis.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => escolher(c)}>
                    <span>
                      <strong>{c.nome}</strong>
                      <small>{c.documento}</small>
                    </span>
                    <span className="cliente-ficha__selecionar">Selecionar</span>
                  </button>
                </li>
              ))}
              {encontrados.length > maximoResultados && (
                <li className="cliente-ficha__nenhum">
                  Mais {encontrados.length - maximoResultados} com esse nome. Digite mais para refinar.
                </li>
              )}
              {encontrados.length === 0 && (
                <li className="cliente-ficha__nenhum cliente-ficha__nenhum--acao">
                  <span>Nenhum cliente com esse nome ou documento.</span>
                  <Botao tamanho="pequeno" icone="adicionar-pessoa" onClick={() => setCadastro(busca.trim())}>
                    Cadastrar “{busca.trim()}”
                  </Botao>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {cadastro !== null && (
        <ModalNovoCliente
          nomeInicial={cadastro}
          aoSalvar={(novo) => { setCadastro(null); escolher(novo) }}
          aoFechar={() => setCadastro(null)}
        />
      )}
    </section>
  )
}
