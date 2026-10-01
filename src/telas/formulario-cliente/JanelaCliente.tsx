import { useId, useState, type FormEvent } from 'react'
import { Botao } from '../../componentes/botao/Botao'
import { Campo } from '../../componentes/campo/Campo'
import { Modal } from '../../componentes/modal/Modal'
import { cadastrarCliente, documentoJaCadastrado, editarCliente, useEstadoDemonstracao, type Cliente } from '../../mock/estado-demonstracao'
import './janela-cliente.css'

type Props = {
  /** Sem id é cadastro novo; com id, edição. */
  clienteId?: string
  /** Nome já digitado em outra busca, para não digitar duas vezes. */
  nomeInicial?: string
  /** Gaveta em Clientes; janela central na nova ficha. */
  variante: 'lateral' | 'central'
  subtitulo?: string
  textoSalvar?: string
  aoSalvar: (cliente: Cliente) => void
  aoFechar: () => void
}

const SEM_DOCUMENTO = 'Sem documento'
const SEM_TELEFONE = 'Sem telefone'

/**
 * "Rua, nº - Bairro - Cidade/UF" → partes. Sem bairro sobram duas partes: a
 * segunda é cidade se tiver "/UF". Endereço fora do formato vai inteiro para a rua.
 */
function separarEndereco(endereco: string) {
  const partes = endereco.split(' - ')
  const [logradouro = '', segunda = '', terceira = ''] = partes
  const [bairro, cidade] = partes.length === 2 && segunda.includes('/') ? ['', segunda] : [segunda, terceira]
  const virgula = logradouro.lastIndexOf(', ')
  return virgula === -1
    ? { rua: logradouro, numero: '', bairro, cidade }
    : { rua: logradouro.slice(0, virgula), numero: logradouro.slice(virgula + 2), bairro, cidade }
}

function juntarEndereco(rua: string, numero: string, bairro: string, cidade: string) {
  const logradouro = [rua, numero].filter(Boolean).join(', ')
  return [logradouro, bairro, cidade].filter(Boolean).join(' - ')
}

/**
 * O formulário de cliente, um só para cadastrar e editar, em Clientes e na nova
 * ficha. Só o nome é obrigatório; documento repetido é barrado.
 */
export function JanelaCliente({ clienteId, nomeInicial = '', variante, subtitulo, textoSalvar, aoSalvar, aoFechar }: Props) {
  const idFormulario = useId()
  const { clientes } = useEstadoDemonstracao()
  const atual = clienteId ? clientes.find((c) => c.id === clienteId) : undefined
  const endereco = separarEndereco(atual?.endereco ?? '')
  const [erros, setErros] = useState<Partial<Record<'nome' | 'documento', string>>>({})

  function limparErro(campo: 'nome' | 'documento') {
    setErros((atual) => ({ ...atual, [campo]: undefined }))
  }

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const formulario = evento.currentTarget
    const dados = new FormData(formulario)
    const campo = (nome: string) => String(dados.get(nome) ?? '').trim()
    const nome = campo('nome')
    const documentoDigitado = campo('documento')
    const falhas: typeof erros = {}
    if (!nome) falhas.nome = 'Informe o nome do cliente.'
    if (documentoJaCadastrado(clientes, documentoDigitado, clienteId)) {
      falhas.documento = 'Este documento já está cadastrado. Busque o cliente em vez de cadastrar de novo.'
    }
    const primeiro = (['nome', 'documento'] as const).find((chave) => falhas[chave])
    if (primeiro) {
      setErros(falhas)
      requestAnimationFrame(() => {
        const alvo = formulario.querySelector<HTMLInputElement>(`[name="${primeiro}"]`)
        alvo?.scrollIntoView({ block: 'center' })
        alvo?.focus({ preventScroll: true })
      })
      return
    }
    const cadastro = {
      nome,
      documento: documentoDigitado || SEM_DOCUMENTO,
      telefone: campo('telefone') || SEM_TELEFONE,
      endereco: juntarEndereco(campo('rua'), campo('numero'), campo('bairro'), campo('cidade')),
    }
    if (atual) {
      if (!editarCliente(atual.id, cadastro)) {
        setErros({ documento: 'Este documento já está cadastrado.' })
        return
      }
      aoSalvar({ ...atual, ...cadastro })
    } else {
      const id = cadastrarCliente(cadastro)
      if (!id) {
        setErros({ documento: 'Este documento já está cadastrado.' })
        return
      }
      aoSalvar({ ...cadastro, id, descricao: 'Cadastro novo', desde: '' })
    }
  }

  const vazioSe = (valor: string | undefined, marcador: string) => (valor && valor !== marcador ? valor : '')

  return (
    <Modal
      variante={variante}
      estreito={variante === 'central'}
      titulo={atual ? 'Editar dados do cliente' : 'Cadastrar cliente'}
      subtitulo={subtitulo ?? (atual ? `${atual.nome} · ${atual.id}` : 'Só o nome é obrigatório.')}
      aoFechar={aoFechar}
      rodape={
        <>
          {Object.values(erros).find(Boolean) && <span className="janela-cliente__aviso" role="alert">{Object.values(erros).find(Boolean)}</span>}
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form={idFormulario} variante="primario" icone="check">
            {textoSalvar ?? (atual ? 'Salvar alterações' : 'Salvar cliente')}
          </Botao>
        </>
      }
    >
      <form id={idFormulario} className="janela-cliente" onSubmit={salvar} noValidate>
        <fieldset className="janela-cliente__grupo">
          <legend>Identificação</legend>
          <div className="janela-cliente__campos">
            <Campo
              rotulo="Nome completo ou razão social"
              name="nome"
              required
              defaultValue={atual?.nome ?? nomeInicial}
              placeholder="Ex.: Lucas Ferreira"
              className="janela-cliente__largo"
              autoFocus
              erro={Boolean(erros.nome)}
              ajuda={erros.nome}
              onChange={() => limparErro('nome')}
            />
            <Campo
              rotulo="CPF ou CNPJ"
              name="documento"
              opcional
              defaultValue={vazioSe(atual?.documento, SEM_DOCUMENTO)}
              placeholder="000.000.000-00"
              erro={Boolean(erros.documento)}
              ajuda={erros.documento}
              onChange={() => limparErro('documento')}
            />
            <Campo rotulo="Celular / WhatsApp" name="telefone" type="tel" opcional defaultValue={vazioSe(atual?.telefone, SEM_TELEFONE)} placeholder="(11) 90000-0000" />
          </div>
        </fieldset>

        <fieldset className="janela-cliente__grupo">
          <legend>
            Endereço <span className="janela-cliente__opcional">(opcional)</span>
          </legend>
          <div className="janela-cliente__campos janela-cliente__campos--endereco">
            <Campo rotulo="Rua / avenida" name="rua" defaultValue={endereco.rua} placeholder="Ex.: Rua das Flores" />
            <Campo rotulo="Número" name="numero" defaultValue={endereco.numero} placeholder="142" />
            <Campo rotulo="Bairro" name="bairro" defaultValue={endereco.bairro} placeholder="Ex.: Centro" />
            <Campo rotulo="Cidade / UF" name="cidade" defaultValue={endereco.cidade} placeholder="Ex.: São Paulo/SP" />
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}
