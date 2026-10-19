import { BotaoIcone } from '../../../componentes/botao/Botao'
import { reais } from '../../../formatar'
import type { ServicoVenda } from '../../../mock/estado-demonstracao'
import './servicos-ficha.css'

type Props = {
  servicos: ServicoVenda[]
  aoEditar: (indice: number) => void
  aoRemover: (indice: number) => void
}

/** Os serviços da ficha em andamento, abaixo dos produtos. */
export function ServicosFicha({ servicos, aoEditar, aoRemover }: Props) {
  if (servicos.length === 0) return null
  return (
    <table className="itens-ficha__tabela servicos-ficha">
      <thead>
        <tr>
          <th>Serviço</th>
          <th className="itens-ficha__numero">Valor</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {servicos.map((s, i) => (
          <tr key={i}>
            <td>
              <span className="itens-ficha__nome">{s.nome}</span>
              {(s.perdas || s.observacao) && (
                <span className="itens-ficha__detalhe">
                  {s.perdas && `${s.perdas.quantidade} ${s.perdas.quantidade === 1 ? 'perda' : 'perdas'}`}
                  {s.perdas && s.observacao && ' · '}
                  {s.observacao}
                </span>
              )}
            </td>
            <td className="itens-ficha__numero">{reais(s.valor)}</td>
            <td className="servicos-ficha__acoes">
              <BotaoIcone icone="editar" rotulo={`Editar ${s.nome}`} onClick={() => aoEditar(i)} />
              <BotaoIcone icone="lixeira" rotulo={`Tirar ${s.nome} da ficha`} onClick={() => aoRemover(i)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
