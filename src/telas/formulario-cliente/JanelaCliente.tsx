import { useEffect, useId, useState, type FormEvent } from 'react'
import type { Cliente, DadosCliente } from '../../../comum/contrato'
import { CIDADE_PADRAO, conferirCliente, ESTADOS, formatarDocumento, formatarTelefone, MENSAGENS_CLIENTE, UF_PADRAO, type CampoCliente } from '../../../comum/regras/cliente'
import { Botao } from '../../componentes/botao/Botao'
import { Campo, Selecao } from '../../componentes/campo/Campo'
import { api } from '../../dados/api'
import { FISCAL_CLIENTE_PADRAO, TIPOS_CLIENTE, TIPOS_CONTRIBUINTE } from '../../dados/fiscal'
import { tituloFalha } from '../../falhas'
import { funcoes } from '../../funcoes'
import { Modal } from '../../componentes/modal/Modal'
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

/** A lista do campo Estado: nome completo, a sigla vai para o banco. */
const OPCOES_ESTADO = [{ valor: '', rotulo: 'Não informado' }, ...ESTADOS.map(([sigla, nome]) => ({ valor: sigla, rotulo: nome }))]

type Carga = { fase: 'carregando' } | { fase: 'erro'; mensagem: string } | { fase: 'pronto'; cliente: Cliente | null }

/**
 * O formulário de cliente, um só para cadastrar e editar, em Clientes e na nova
 * ficha (`R-CLIENTE-04`). Só o nome é obrigatório; documento e telefone são
 * conferidos (`R-CLIENTE-09`, `10`) e o repetido é o back que barra. Cliente
 * novo já vem com Simonésia / Minas Gerais.
 */
export function JanelaCliente({ clienteId, nomeInicial = '', variante, subtitulo, textoSalvar, aoSalvar, aoFechar }: Props) {
  const [carga, setCarga] = useState<Carga>(clienteId ? { fase: 'carregando' } : { fase: 'pronto', cliente: null })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (!clienteId) return
    let vivo = true
    void api().obterCliente(clienteId).then((r) => {
      if (!vivo) return
      setCarga(r.ok ? { fase: 'pronto', cliente: r.dado } : { fase: 'erro', mensagem: r.causa === 'nao-encontrado' ? MENSAGENS_CLIENTE.naoEncontrado : `${tituloFalha(r.causa)} ${r.erro}` })
    })
    return () => { vivo = false }
  }, [clienteId, tentativa])

  if (carga.fase !== 'pronto') {
    return (
      <Modal
        variante={variante}
        estreito={variante === 'central'}
        titulo="Editar dados do cliente"
        aoFechar={aoFechar}
        rodape={<>
          <Botao variante="fantasma" onClick={aoFechar}>Fechar</Botao>
          {carga.fase === 'erro' && <Botao variante="primario" onClick={() => { setCarga({ fase: 'carregando' }); setTentativa((n) => n + 1) }}>Tentar de novo</Botao>}
        </>}
      >
        <p className={carga.fase === 'erro' ? 'janela-cliente__aviso' : 'janela-cliente__carregando'} role={carga.fase === 'erro' ? 'alert' : 'status'}>
          {carga.fase === 'erro' ? carga.mensagem : 'Carregando o cliente…'}
        </p>
      </Modal>
    )
  }
  return <Formulario atual={carga.cliente} {...{ nomeInicial, variante, subtitulo, textoSalvar, aoSalvar, aoFechar }} />
}

function Formulario({ atual, nomeInicial, variante, subtitulo, textoSalvar, aoSalvar, aoFechar }: Omit<Props, 'clienteId'> & { atual: Cliente | null; nomeInicial: string }) {
  const idFormulario = useId()
  const [erros, setErros] = useState<Partial<Record<CampoCliente, string>>>({})
  const [erroSalvar, setErroSalvar] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fiscal = atual?.fiscal ?? { tipoContribuinte: null, tipoCliente: null, inscricaoEstadual: null }

  function limparErro(campo: CampoCliente) {
    setErros((antes) => ({ ...antes, [campo]: undefined }))
    setErroSalvar('')
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (enviando) return
    const formulario = evento.currentTarget
    const dados = new FormData(formulario)
    const campo = (nome: string) => String(dados.get(nome) ?? '')
    // Com o bloco "Para nota fiscal" oculto, o que o cliente já tinha nele fica.
    const fiscalVisivel = funcoes.dadosFiscaisCliente
    const cadastro: DadosCliente = {
      nome: campo('nome'), documento: campo('documento'), telefone: campo('telefone'),
      rua: campo('rua'), numero: campo('numero'), complemento: campo('complemento'), bairro: campo('bairro'),
      cidade: campo('cidade'), uf: campo('uf'), cep: campo('cep'),
      fiscal: fiscalVisivel
        ? { tipoContribuinte: campo('tipoContribuinte') as DadosCliente['fiscal']['tipoContribuinte'], tipoCliente: campo('tipoCliente') as DadosCliente['fiscal']['tipoCliente'], inscricaoEstadual: campo('inscricaoEstadual') }
        : fiscal,
    }
    // As mesmas regras do back (`comum/regras/cliente.ts`): aponta o campo antes de mandar.
    const falhas = conferirCliente(cadastro).erros
    const primeiro = (['nome', 'documento', 'telefone', 'uf', 'cep'] as const).find((chave) => falhas[chave])
    if (primeiro) {
      setErros(falhas)
      requestAnimationFrame(() => {
        const alvo = formulario.querySelector<HTMLElement>(`[name="${primeiro}"]`)
        alvo?.scrollIntoView({ block: 'center' })
        alvo?.focus({ preventScroll: true })
      })
      return
    }
    setEnviando(true)
    const r = atual ? await api().editarCliente(atual.id, cadastro) : await api().cadastrarCliente(cadastro)
    setEnviando(false)
    if (r.ok) return aoSalvar(r.dado)
    // Documento repetido aponta o campo dele; o resto vai para o rodapé.
    if (r.causa === 'validacao' && r.erro.startsWith('Este documento')) setErros({ documento: r.erro })
    else setErroSalvar(r.causa === 'validacao' ? r.erro : `${tituloFalha(r.causa)} ${r.erro}`)
  }

  const aviso = erroSalvar || Object.values(erros).find(Boolean)

  return (
    <Modal
      variante={variante}
      estreito={variante === 'central'}
      titulo={atual ? 'Editar dados do cliente' : 'Cadastrar cliente'}
      subtitulo={subtitulo ?? (atual ? `${atual.nome} · ${atual.codigo}` : 'Só o nome é obrigatório.')}
      aoFechar={aoFechar}
      rodape={
        <>
          {aviso && <span className="janela-cliente__aviso" role="alert">{aviso}</span>}
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao type="submit" form={idFormulario} variante="primario" icone="check" disabled={enviando}>
            {enviando ? 'Salvando…' : textoSalvar ?? (atual ? 'Salvar alterações' : 'Salvar cliente')}
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
              inputMode="numeric"
              defaultValue={atual?.documento ? formatarDocumento(atual.documento) : ''}
              placeholder="000.000.000-00"
              erro={Boolean(erros.documento)}
              ajuda={erros.documento}
              onChange={() => limparErro('documento')}
            />
            <Campo
              rotulo="Celular / WhatsApp"
              name="telefone"
              type="tel"
              opcional
              defaultValue={atual?.telefone ? formatarTelefone(atual.telefone) : ''}
              placeholder="(33) 90000-0000"
              erro={Boolean(erros.telefone)}
              ajuda={erros.telefone ?? 'Com DDD.'}
              onChange={() => limparErro('telefone')}
            />
          </div>
        </fieldset>

        <fieldset className="janela-cliente__grupo">
          <legend>
            Endereço <span className="janela-cliente__opcional">(opcional)</span>
          </legend>
          <div className="janela-cliente__campos janela-cliente__campos--endereco">
            <Campo rotulo="Rua / avenida" name="rua" defaultValue={atual?.rua ?? ''} placeholder="Ex.: Rua das Flores" />
            <Campo rotulo="Número" name="numero" defaultValue={atual?.numero ?? ''} placeholder="142" />
            <Campo rotulo="Bairro" name="bairro" defaultValue={atual?.bairro ?? ''} placeholder="Ex.: Centro" />
            <Campo rotulo="Complemento" name="complemento" defaultValue={atual?.complemento ?? ''} placeholder="Ex.: Sala 3" />
            <Campo rotulo="Cidade" name="cidade" defaultValue={atual ? atual.cidade ?? '' : CIDADE_PADRAO} placeholder="Ex.: Simonésia" />
            <Selecao
              rotulo="Estado"
              name="uf"
              opcoes={OPCOES_ESTADO}
              valorInicial={atual ? atual.uf ?? '' : UF_PADRAO}
              erro={Boolean(erros.uf)}
              ajuda={erros.uf}
              aoMudar={() => limparErro('uf')}
            />
            <Campo rotulo="CEP" name="cep" inputMode="numeric" defaultValue={atual?.cep ?? ''} placeholder="00000-000" erro={Boolean(erros.cep)} ajuda={erros.cep} onChange={() => limparErro('cep')} />
          </div>
        </fieldset>

        {funcoes.dadosFiscaisCliente && <fieldset className="janela-cliente__grupo">
          <legend>
            Para nota fiscal <span className="janela-cliente__opcional">(só para nota com dados do cliente, como empresa ou prefeitura)</span>
          </legend>
          <div className="janela-cliente__campos">
            <Selecao rotulo="Tipo de contribuinte" name="tipoContribuinte" opcoes={TIPOS_CONTRIBUINTE} valorInicial={fiscal.tipoContribuinte ?? FISCAL_CLIENTE_PADRAO.tipoContribuinte} />
            <Selecao rotulo="Tipo de cliente" name="tipoCliente" opcoes={TIPOS_CLIENTE} valorInicial={fiscal.tipoCliente ?? FISCAL_CLIENTE_PADRAO.tipoCliente} />
            <Campo rotulo="Inscrição estadual" name="inscricaoEstadual" opcional inputMode="numeric" defaultValue={fiscal.inscricaoEstadual ?? ''} />
          </div>
        </fieldset>}
      </form>
    </Modal>
  )
}
