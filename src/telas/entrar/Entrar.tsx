import { useState, type FormEvent } from 'react'
import logo from '../../../recursos/marca/logo-original.svg'
import { Botao } from '../../componentes/botao/Botao'
import { Campo } from '../../componentes/campo/Campo'
import { Icone } from '../../componentes/icone/Icone'
import { sincronia, type EstadoSincronia } from '../../dados/sincronia'
import { api } from '../../dados/api'
import { recarregarOperadores } from '../../dados/operadores'
import { FormularioPessoa } from '../pessoas/Pessoas'
import './entrar.css'

type Props = {
  estado: Exclude<EstadoSincronia, { fase: 'pronto' }>
  /** O que "Tentar de novo" faz; padrão, abrir a loja de novo. */
  tentarDeNovo?: () => void
}

/**
 * O que aparece antes da loja abrir: carregando os dados, pedindo o login, ou
 * dizendo por que não abriu. Uma janela central só, com a marca.
 */
export function Entrar({ estado, tentarDeNovo = () => void sincronia.iniciar() }: Props) {
  return (
    <main className="entrar">
      <section className="entrar__cartao" aria-live="polite">
        <img className="entrar__logo" src={logo} alt="Papelaria Opção" />
        {estado.fase === 'iniciando' && <p className="entrar__texto">Carregando os dados da loja…</p>}
        {estado.fase === 'entrar' && <FormularioEntrar />}
        {estado.fase === 'erro' && (
          <>
            <p className="entrar__erro"><Icone nome="alerta" tamanho={18} /> {estado.mensagem}</p>
            {estado.podeTentar && <Botao variante="primario" icone="historico" onClick={tentarDeNovo}>Tentar de novo</Botao>}
          </>
        )}
      </section>
    </main>
  )
}

function FormularioEntrar() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [entrando, setEntrando] = useState(false)

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (entrando) return
    setEntrando(true)
    setErro(null)
    const r = await sincronia.entrar(email, senha)
    // Deu certo: a sincronia troca esta tela pela loja.
    if (!r.ok) {
      setErro(r.erro)
      setEntrando(false)
    }
  }

  return (
    <form className="entrar__formulario" onSubmit={enviar}>
      <p className="entrar__texto">Entre com o usuário da loja.</p>
      <Campo rotulo="E-mail" type="email" autoComplete="username" icone="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      <Campo rotulo="Senha" type="password" autoComplete="current-password" icone="cadeado" value={senha} onChange={(e) => setSenha(e.target.value)} required erro={Boolean(erro)} ajuda={erro ?? undefined} />
      <Botao type="submit" variante="primario" disabled={entrando}>{entrando ? 'Entrando…' : 'Entrar'}</Botao>
    </form>
  )
}

/**
 * Primeira abertura (`R-OPERADOR-05`): sem administradora, a loja só abre
 * depois de cadastrá-la. O PIN dela autoriza cadastrar as outras pessoas.
 */
export function PrimeiraAbertura() {
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function cadastrar({ nome, pin }: { nome: string; pin: string }) {
    setEnviando(true)
    setErro(null)
    const r = await api().cadastrarAdministradora(nome, pin)
    if (!r.ok) {
      setErro(r.erro)
      setEnviando(false)
      return
    }
    // Deu certo: com a administradora na lista, a loja abre.
    await recarregarOperadores()
  }

  return (
    <main className="entrar">
      <section className="entrar__cartao entrar__cartao--largo" aria-live="polite">
        <img className="entrar__logo" src={logo} alt="Papelaria Opção" />
        <p className="entrar__titulo">Cadastre a administradora</p>
        <p className="entrar__texto">A dona da loja. O PIN dela vai cadastrar as outras pessoas e autorizar o que precisar.</p>
        <FormularioPessoa titulo="Administradora" pedeNome pedePin rotuloSeguir="Cadastrar e abrir a loja" erro={erro} enviando={enviando} aoSeguir={(dados) => void cadastrar(dados)} />
      </section>
    </main>
  )
}
