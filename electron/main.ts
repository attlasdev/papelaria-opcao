import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { falha, type Contrato, type NomeOperacao } from '../comum/contrato'
import { configurarLog, log } from './log'
import { operacoes } from './operacoes'

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

// A pasta de dados (conexao.json, sessao, copia local) tem nome fixo e sem acento,
// independente do nome exibido "Papelaria Opção": e o caminho que a instalacao
// manual usa (`%APPDATA%\papelaria-opcao`, ver docs/piloto.md).
app.setPath('userData', path.join(app.getPath('appData'), 'papelaria-opcao'))
configurarLog(path.join(app.getPath('userData'), 'logs'))

// Erro solto no processo principal vai para o log em vez de virar a caixa de
// erro do Electron (que mostraria o texto cru na tela). O app segue: as
// operações já são embrulhadas uma a uma, e o banco grava em transação.
process.on('uncaughtException', (erro) => log.erro('processo', 'exceção não tratada:', erro))
process.on('unhandledRejection', (motivo) => log.erro('processo', 'promessa rejeitada sem tratamento:', motivo))

// Uma instância só (auditoria de 21/10, A6): o segundo clique no atalho traz a
// janela aberta para a frente. Duas janelas gravando a mesma base davam
// conflito na 0.1 e disputariam o arquivo do banco na 1.0.
const instanciaUnica = app.requestSingleInstanceLock()
if (!instanciaUnica) app.quit()
app.on('second-instance', () => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

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

  // A tela caiu (falta de memória, erro do Chromium): sem isto, fica uma janela
  // branca e a loja não sabe o que fazer.
  win.webContents.on('render-process-gone', async (_evento, detalhes) => {
    log.erro('tela', `a tela parou (${detalhes.reason}, código ${detalhes.exitCode})`)
    if (detalhes.reason === 'clean-exit' || !win || win.isDestroyed()) return
    const { response } = await dialog.showMessageBox(win, {
      type: 'error',
      title: 'Papelaria Opção',
      message: 'A tela do aplicativo parou.',
      detail: 'O que já foi gravado continua salvo. O que estava sendo digitado pode precisar ser refeito.',
      buttons: ['Recarregar', 'Fechar o aplicativo'],
      defaultId: 0,
      noLink: true,
    })
    if (response === 0) win?.webContents.reload()
    else app.quit()
  })
  win.on('unresponsive', () => log.aviso('tela', 'a tela não responde'))
  win.on('responsive', () => log.info('tela', 'a tela voltou a responder'))

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
        log.aviso(nome, 'chamada recusada: origem não autorizada')
        return falha('permissao', 'Origem da chamada não autorizada.')
      }
      try {
        return await fn(...args)
      } catch (erro) {
        // O texto cru pode carregar URL de conexao ou pedaco de credencial. Ele
        // fica no log do processo principal; para a tela vai mensagem generica.
        log.erro(nome, 'falhou:', erro)
        return falha('desconhecida', 'Algo falhou nesta operação. Tente de novo; se continuar, chame o suporte.')
      }
    })
  }
}

app.whenReady().then(() => {
  if (!instanciaUnica) return
  log.info('inicio', `versão ${app.getVersion()}, Electron ${process.versions.electron}, ${process.platform}`)
  registrar(operacoes)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
