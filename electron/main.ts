import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { falha, type Contrato, type NomeOperacao } from '../comum/contrato'
import { operacoes } from './operacoes'

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// A pasta de dados (conexao.json, sessao, copia local) tem nome fixo e sem acento,
// independente do nome exibido "Papelaria Opção": e o caminho que a instalacao
// manual usa (`%APPDATA%\papelaria-opcao`, ver docs/piloto.md).
app.setPath('userData', path.join(app.getPath('appData'), 'papelaria-opcao'))

let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    title: 'Papelaria Opção',
    icon: path.join(__dirname, '../../recursos/icone/icone.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // So a interface empacotada (ou o Vite local em dev) abre nesta janela.
  // Nao ha dominios externos aprovados neste projeto, entao novas janelas
  // sao negadas. Se surgir essa necessidade, criar uma lista explicita.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (evento, url) => {
    if (url !== win?.webContents.getURL()) evento.preventDefault()
  })
  win.on('closed', () => { win = null })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

function remetenteConfiavel(evento: IpcMainInvokeEvent): boolean {
  return win !== null
    && !win.isDestroyed()
    && evento.sender === win.webContents
    && evento.senderFrame === win.webContents.mainFrame
}

/**
 * Registra um handler por operacao do contrato. O nome da operacao E o nome do
 * canal, entao nao ha uma terceira lista para desatualizar.
 *
 * Isto NAO e um canal generico: o laco roda sobre as chaves de um objeto tipado
 * como `Contrato`, fixo em tempo de build. O renderer nao tem `ipcRenderer` e nao
 * consegue inventar um canal.
 *
 * Toda chamada vem embrulhada: excecao em `operacoes.ts` sai como `Falha`, para o
 * contrato valer ("nenhuma operacao lanca excecao para o front").
 */
function registrar(implementacao: Contrato) {
  for (const nome of Object.keys(implementacao) as NomeOperacao[]) {
    const fn = implementacao[nome] as (...args: unknown[]) => Promise<unknown>

    ipcMain.handle(nome, async (evento, ...args: unknown[]) => {
      if (!remetenteConfiavel(evento)) {
        return falha('permissao', 'Origem da chamada nao autorizada.')
      }
      try {
        return await fn(...args)
      } catch (erro) {
        // O texto cru pode carregar URL de conexao ou pedaco de credencial. Ele
        // fica no log do processo principal; para a tela vai mensagem generica.
        console.error(`[${nome}] falhou:`, erro)
        return falha('desconhecida', 'Algo falhou nesta operacao. Veja o log do aplicativo.')
      }
    })
  }
}

app.whenReady().then(() => {
  registrar(operacoes)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
