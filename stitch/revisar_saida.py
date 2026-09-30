"""Gera a rodada de coerencia a partir da exportacao original do Stitch.

As telas continuam sendo prototipos HTML isolados. Esta rodada altera conteudo
e escopo; nao define comportamento, contrato, integracao ou acabamento visual.
"""

from pathlib import Path
from zipfile import ZipFile
import re
import shutil
from lxml import html as lxml_html


ARQUIVO = Path(r"D:\stitch_papelaria_op_o_desktop_system.zip")
DESTINO = Path(__file__).parent / "saida-revisada"


def ajustar_apresentacao(tela: str, conteudo: str) -> str:
    """Padroniza a marca e aplica a segunda rodada visual nas nove pranchas."""
    documento = lxml_html.document_fromstring(conteudo)
    cabeca = documento.xpath('//head')[0]
    estilo = lxml_html.Element('link', rel='stylesheet', href='../ajustes.css')
    cabeca.append(estilo)

    aside = documento.xpath('//aside')[0]
    marca = [elemento for elemento in aside.iter() if elemento.text and elemento.text.strip() == 'Papelaria Opção']
    if marca:
        linha = marca[0].getparent().getparent()
        bloco = lxml_html.fragment_fromstring('''<div class="po-brand">
          <img class="po-logo" src="../assets/logo-original.svg" alt="">
          <div class="po-brand-copy"><strong>Papelaria Opção</strong><span>Terminal Balcão #01</span></div>
        </div>''')
        linha.getparent().replace(linha, bloco)
    elif tela == 'cadastrar_produto_balc_o_papelaria_op_o':
        nome = documento.xpath('//header//span[normalize-space(text())="Papelaria Opção"]')[0]
        nome.addprevious(lxml_html.fragment_fromstring('<img class="po-logo" src="../assets/logo-original.svg" alt="">'))
        nome.getparent().set('class', nome.getparent().get('class', '') + ' po-product-header')

    for elemento in aside.xpath('.//*[contains(@class,"bg-brand-accent")]'):
        rotulo = ' '.join(elemento.itertext()).strip()
        if rotulo in {'Início', 'Clientes', 'Financeiro', 'Estoque', 'Notas fiscais'}:
            elemento.set('class', elemento.get('class', '') + ' po-nav-active')
    for botao in aside.xpath('.//button'):
        if 'Criar ficha' in ' '.join(botao.itertext()):
            botao.set('class', botao.get('class', '') + ' po-sidebar-cta')
            # "Criar ficha" fica no rodape da barra lateral, junto do operador, como nas demais telas.
            envoltorio = botao.getparent()
            rodape = aside.xpath('.//div[contains(@class,"border-t")]')
            if rodape and not any(r in botao.iterancestors() for r in rodape):
                rodape[0].insert(0, botao)
                if len(envoltorio) == 0:
                    envoltorio.getparent().remove(envoltorio)

    for elemento in documento.xpath('//span|//button'):
        rotulo = ' '.join(' '.join(elemento.itertext()).split())
        if rotulo in {'Pix', 'Cartão Débito', 'Cartão Crédito', 'Pagamento futuro', 'Dinheiro', 'Reposição Crítica', '0 un (Zerado)'} and 'text-[11px] text-muted' not in (elemento.get('class') or ''):
            elemento.set('class', elemento.get('class', '') + ' po-badge')

    for tabela in documento.xpath('//main//table'):
        tabela.set('class', tabela.get('class', '') + ' po-table')
        pai = tabela.getparent()
        pai.set('class', pai.get('class', '') + ' po-table-scroll')
        if tela == 'in_cio_balc_o_papelaria_op_o':
            tabela.set('class', tabela.get('class', '') + ' po-sales-table')
        if tela == 'registrar_entrada_de_mercadorias_balc_o_papelaria_op_o':
            tabela.set('class', tabela.get('class', '') + ' po-entry-table')

    for botao in documento.xpath('//header//button'):
        rotulo = ' '.join(' '.join(botao.itertext()).split())
        if 'Criar ficha' in rotulo:
            botao.set('class', botao.get('class', '') + ' po-top-cta')
        if botao.get('title') == 'Dados fictícios':
            botao.getparent().remove(botao)
    for rotulo in documento.xpath('//header//span[normalize-space(text())="Dados fictícios"]'):
        pai = rotulo.getparent()
        if pai.tag != 'header':
            pai.getparent().remove(pai)

    if tela == 'in_cio_balc_o_papelaria_op_o':
        resumo = documento.xpath('//main/div[contains(@class,"grid")]')[0]
        resumo.set('class', resumo.get('class', '') + ' po-home-summary')
    if tela == 'registrar_entrada_de_mercadorias_balc_o_papelaria_op_o':
        for grade in documento.xpath('//main//div[contains(@class,"md:grid-cols-4")]'):
            grade.set('class', grade.get('class', '') + ' po-entry-fields')
    if tela == 'estoque_balc_o_papelaria_op_o':
        for grade in documento.xpath('//main/div[contains(@class,"grid")]'):
            if 'Total de Itens Cadastrados' in ' '.join(grade.itertext()):
                grade.set('class', grade.get('class', '') + ' po-stock-summary')
                break
        ajustar_tabela_estoque(documento)
        for titulo in documento.xpath('//table[contains(@class,"po-stock-table")]//th'):
            if titulo.text and 'Cód. Barras / EAN' in titulo.text:
                titulo.text = titulo.text.replace('Cód. Barras / EAN', 'Cód. barras')
    if tela == 'detalhe_do_cliente_balc_o_papelaria_op_o':
        cabecalho = documento.xpath('//header')[0]
        cabecalho.set('class', cabecalho.get('class', '') + ' po-client-header')
        resumo = documento.xpath('//main/section[1]/div[contains(@class,"grid")]')[0]
        resumo.set('class', resumo.get('class', '') + ' po-client-summary')
        filtros = documento.xpath('//div[@role="tablist"]/..')[0]
        filtros.set('class', filtros.get('class', '') + ' po-client-filters')
    if tela == 'criar_ficha_de_venda_balc_o_papelaria_op_o':
        area = documento.xpath('//div[contains(@class,"grid-cols-12") and contains(@class,"overflow-hidden")]')[0]
        area.set('class', area.get('class', '') + ' po-sale-workspace')
    if tela == 'financeiro_balc_o_papelaria_op_o':
        cabecalho = documento.xpath('//header')[0]
        cabecalho.set('class', cabecalho.get('class', '') + ' po-finance-header')
        linhas = documento.xpath('//main/div')
        linhas[0].set('class', linhas[0].get('class', '') + ' po-finance-period')
        linhas[1].set('class', linhas[1].get('class', '') + ' po-finance-summary')

    if tela == 'cadastrar_produto_balc_o_papelaria_op_o':
        for botao in documento.xpath('//button'):
            rotulo = ' '.join(' '.join(botao.itertext()).split())
            if ('Salvar e Adicionar Outro' in rotulo or 'Salvar Produto (F10)' in rotulo) and botao.xpath('ancestor::div[contains(@class,"border-b")]'):
                botao.getparent().remove(botao)

    for botao in documento.xpath('//button'):
        if 'Salvar e Adicionar Outro' in ' '.join(botao.itertext()):
            pai = botao.getparent()
            pai.set('class', pai.get('class', '') + ' po-modal-actions')
            break

    SEM_DESTINO[tela] = ligar_telas(tela, documento)

    return lxml_html.tostring(documento, encoding='unicode', method='html', doctype='<!doctype html>')


SEM_DESTINO: dict[str, list[str]] = {}

TELAS = {
    'inicio': 'in_cio_balc_o_papelaria_op_o',
    'criar': 'criar_ficha_de_venda_balc_o_papelaria_op_o',
    'clientes': 'clientes_balc_o_papelaria_op_o',
    'detalhe': 'detalhe_do_cliente_balc_o_papelaria_op_o',
    'financeiro': 'financeiro_balc_o_papelaria_op_o',
    'estoque': 'estoque_balc_o_papelaria_op_o',
    'produto': 'cadastrar_produto_balc_o_papelaria_op_o',
    'entrada': 'registrar_entrada_de_mercadorias_balc_o_papelaria_op_o',
    'notas': 'notas_fiscais_balc_o_papelaria_op_o',
}

# (tela de origem ou '*', trecho do rotulo ou do title, destino). A primeira regra que casa vale.
LIGACOES = [
    ('*', 'Concluir Ficha de Venda', 'inicio'),
    ('*', 'Criar ficha', 'criar'),
    ('clientes', 'Ver histórico completo', 'detalhe'),
    ('clientes', 'Ficha', 'detalhe'),
    ('clientes', 'Ver', 'detalhe'),
    ('detalhe', 'Voltar para Clientes', 'clientes'),
    ('estoque', 'Cadastrar produto', 'produto'),
    ('estoque', 'Registrar entrada', 'entrada'),
    ('estoque', '+ Entrada', 'entrada'),
    ('produto', 'Fechar modal', 'estoque'),
    ('produto', 'Cancelar', 'estoque'),
    ('entrada', 'Voltar ao Estoque', 'estoque'),
    ('entrada', 'Confirmar Entrada', 'estoque'),
    ('criar', 'Fechar / Salvar Rascunho', 'inicio'),
]
MENU = {'Início': 'inicio', 'Clientes': 'clientes', 'Financeiro': 'financeiro', 'Estoque': 'estoque', 'Notas fiscais': 'notas'}


def rotulo_visivel(elemento) -> str:
    """Texto do controle sem os nomes de icone do Material Symbols."""
    partes = []
    for texto in elemento.xpath('.//text()[not(ancestor::*[contains(@class,"material-symbols")])]'):
        partes.append(texto)
    return ' '.join(' '.join(partes).split())


def ligar_telas(tela: str, documento) -> list[str]:
    """Liga os controles com destino conhecido; devolve os rotulos que ficaram sem destino."""
    origem = next(k for k, v in TELAS.items() if v == tela)
    sem_destino = []
    for elemento in documento.xpath('//body//a|//body//button'):
        rotulo = rotulo_visivel(elemento)
        titulo = elemento.get('title') or elemento.get('aria-label') or ''
        destino = None
        if elemento.xpath('ancestor::aside') and rotulo in MENU:
            destino = MENU[rotulo]
        else:
            for de, trecho, para in LIGACOES:
                if de in ('*', origem) and (trecho == rotulo or (len(trecho) > 4 and (trecho in rotulo or trecho in titulo))):
                    destino = para
                    break
        if destino and destino != origem:
            caminho = f'../{TELAS[destino]}/'
            if elemento.tag == 'a':
                elemento.set('href', caminho)
            else:
                elemento.set('data-ir', caminho)
        elif elemento.tag == 'button' or elemento.get('href') in (None, '#'):
            sem_destino.append(rotulo or f'[{titulo or "ícone"}]')
    corpo = documento.xpath('//body')[0]
    corpo.append(lxml_html.fragment_fromstring('<script src="../navegacao.js"></script>'))
    return sem_destino


def ajustar_tabela_estoque(documento) -> None:
    """Uma regra so para saldo, situacao e acao: nada quebra linha no meio de uma informacao.

    Saldo: quantidade + selo de situacao na primeira linha, "Minimo: N un" na segunda.
    Selo: mesma familia pastel da tela Clientes, largura unica, texto centrado.
    Acao: "+ Entrada" com largura unica; preenchido quando o saldo pede reposicao.
    """
    situacoes = {'normal': ('em-dia', 'Normal'), 'estoque baixo': ('pendente', 'Estoque baixo'), 'zerado': ('vencido', 'Zerado')}
    tabela = documento.xpath('//main//table')[0]
    tabela.set('class', tabela.get('class', '') + ' po-stock-table')

    for linha in tabela.xpath('./tbody/tr'):
        celulas = linha.xpath('./td')
        codigo_barras, saldo, acoes = celulas[1], celulas[6], celulas[7]

        if ' '.join(codigo_barras.itertext()).strip().startswith('Sem cód'):
            for filho in list(codigo_barras):
                codigo_barras.remove(filho)
            codigo_barras.text = None
            codigo_barras.append(lxml_html.fragment_fromstring('<span class="po-sem-codigo">Sem código</span>'))

        texto = ' '.join(' '.join(saldo.itertext()).split())
        quantidade = re.match(r'(\d+ (?:un|pct))', texto).group(1)
        chave = next(k for k in situacoes if k in texto.lower())
        minimo = re.search(r'(\d+)\s*(un|pct)\)?$', texto)
        tipo, rotulo = situacoes[chave]
        alerta = ' po-saldo-qtd--alerta' if chave != 'normal' else ''
        for filho in list(saldo):
            saldo.remove(filho)
        saldo.append(lxml_html.fragment_fromstring(
            f'<div class="po-saldo"><span class="po-saldo-qtd{alerta}">{quantidade}</span>'
            f'<span class="po-status-mini po-status--{tipo}">{rotulo}</span></div>'))
        saldo.append(lxml_html.fragment_fromstring(
            f'<span class="po-saldo-min">Mínimo: {minimo.group(1)} {minimo.group(2)}</span>'))

        entrada = acoes.xpath('.//button')[0]
        entrada.text = '+ Entrada'
        entrada.set('class', 'po-entrada' + (' po-entrada--repor' if chave != 'normal' else ''))
        entrada.set('title', 'Registrar entrada')

    legenda = {'bg-success': 'em-dia', 'bg-danger': 'pendente', 'bg-ink': 'vencido'}
    for ponto in documento.xpath('//span[contains(@class,"w-2 h-2 rounded-full")]'):
        classe = next((v for k, v in legenda.items() if k in ponto.get('class', '')), None)
        if classe and ponto.getparent().getparent().xpath('.//text()[contains(.,"Zerado")]'):
            ponto.set('class', f'po-legenda po-status--{classe}')
    for texto in documento.xpath('//span[contains(@class,"flex items-center gap-1.5")]/span[contains(@class,"po-legenda")]'):
        if texto.tail and 'Estoque Baixo' in texto.tail:
            texto.tail = texto.tail.replace('Estoque Baixo', 'Estoque baixo')


def trocar(texto: str, antigo: str, novo: str, tela: str) -> str:
    if antigo not in texto:
        raise ValueError(f"{tela}: trecho nao encontrado: {antigo[:90]}")
    return texto.replace(antigo, novo)


def faixa(texto: str, inicio: str, fim: str, novo: str, tela: str) -> str:
    i = texto.find(inicio)
    if i < 0:
        raise ValueError(f"{tela}: inicio nao encontrado: {inicio}")
    j = texto.find(fim, i + len(inicio))
    if j < 0:
        raise ValueError(f"{tela}: fim nao encontrado: {fim}")
    return texto[:i] + novo + texto[j:]


def revisar(tela: str, html: str) -> str:
    # A navegacao e os indicadores de ambiente aparecem em todas as pranchas.
    html = html.replace("Finalizar Venda", "Criar ficha")
    html = html.replace("Nova ficha de venda", "Criar ficha")
    html = html.replace("Loja Online", "Protótipo local")
    html = html.replace("Status Sincronizado", "Dados fictícios")
    html = html.replace("Sincronizado", "Dados fictícios")
    html = html.replace("Terminal Pronto", "Protótipo local")
    html = html.replace("Sincronizar dados", "Dados fictícios")
    html = html.replace(">+ Criar ficha<", ">Criar ficha<")

    if tela == "in_cio_balc_o_papelaria_op_o":
        # Sem o termo "sangria": toda retirada de caixa aparece como saida.
        html = trocar(html, '<span class="text-label-sm font-label-sm text-muted bg-canvas px-2 py-0.5 rounded border border-border">Sangria / Despesas</span>', '', tela)
        html = html.replace("7 fichas ativas", "Fichas recentes")
        html = html.replace("Faturado (Pix)", "Pagamento futuro")
        html = html.replace("#1042", "#1043", 1)
        html = html.replace("R$ 78,90", "R$ 152,20")
        html = html.replace("#1041", "#1042", 1)
        html = html.replace("R$ 44,50", "R$ 289,90")
        html = html.replace("Pedro Alves", "Ana Beatriz Nogueira")
        html = html.replace("Cadastro Mínimo (CPF)", "Cadastrada")

    elif tela == "criar_ficha_de_venda_balc_o_papelaria_op_o":
        html = html.replace("Balcão #01 Ativo", "Ficha em preparo")
        html = html.replace("Histórico ativo / Limite R$ 1.200,00", "Cliente cadastrado")
        html = html.replace("Faturado / Convênio", "Pagamento futuro")
        html = html.replace(">Faturado<", ">Pagamento futuro<")
        html = html.replace("À vista ou faturado", "Antes de concluir a ficha")
        html = html.replace("Preparar nota fiscal (gerar rascunho de NF-e/NFC-e)", "Preparar rascunho de nota para revisão")
        html = html.replace('<input checked="" class="rounded border-border text-ink focus:ring-0 w-4 h-4" type="checkbox"/>', '<input class="rounded border-border text-ink focus:ring-0 w-4 h-4" type="checkbox"/>')
        html = html.replace("Gera lançamento manual no caixa do balcão para conferência de fechamento.", "Dinheiro recebido é registrado manualmente no caixa.")
        html = html.replace("Registrado na ficha após conferência no balcão: não duplica entrada financeira de faturamento.", "Pix e cartão são marcados na ficha após conferência no balcão; o registro não cria outra entrada financeira.")

    elif tela == "clientes_balc_o_papelaria_op_o":
        html = html.replace("Gestão da carteira de clientes de balcão e convênios corporativos e escolares.", "Consulte clientes cadastrados e o histórico de suas compras.")
        html = html.replace("Faturado Pago", "Pago")
        html = html.replace("Convênio Escola", "Cliente cadastrado")
        html = html.replace("Empresa / Convênio", "Cliente cadastrado")
        html = html.replace("                    Em dia\n", "                    Com pendências\n", 1)
        # Situacao das compras: selo de cor solida, largura unica, titulo + detalhe.
        situacoes = {
            'Com pendências': ('pendente', 'Com pendências', 'Vence em 12 dias'),
            'Com pendências (Fatura a vencer em 5 dias)': ('pendente', 'Com pendências', 'Vence em 5 dias'),
            'Com vencidos (1 compra em atraso)': ('vencido', 'Com vencidos', '1 compra em atraso'),
            'Em dia': ('em-dia', 'Em dia', ''),
        }

        def selo_situacao(m):
            tipo, titulo, detalhe = situacoes[m.group(1)]
            linha = f'<small>{detalhe}</small>' if detalhe else ''
            return f'<span class="po-status po-status--{tipo}"><strong>{titulo}</strong>{linha}</span>'

        html, n = re.subn(r'<span class="inline-flex items-center gap-1\.5 px-2\.5 py-1 rounded [^"]*"[^>]*>\s*'
                          r'<span class="w-1\.5 h-1\.5 rounded-full[^"]*"></span>\s*([^<]+?)\s*</span>',
                          selo_situacao, html)
        if n != 5:
            raise ValueError(f"{tela}: esperava 5 selos de situacao, achei {n}")
        # Coluna Tipo retirada: todo cliente e cadastrado, o valor era igual em toda linha.
        html = trocar(html, '<th class="py-3 px-4">TIPO</th>\n', '', tela)
        html, n = re.subn(r'<td class="py-3\.5 px-4">\s*<span class="inline-flex items-center px-2 py-0\.5 rounded text-label-sm font-label-sm bg-canvas border border-border text-ink">\s*'
                          r'(?:Cadastrada|Cliente cadastrado|Cadastro Balcão)\s*</span>\s*</td>\s*',
                          '', html)
        if n != 5:
            raise ValueError(f"{tela}: esperava 5 celulas de tipo, achei {n}")
        html = trocar(html, 'colspan="8"', 'colspan="7"', tela)
        # Boleto nao e meio de pagamento do projeto; a ficha #0942 e pagamento futuro.
        html = trocar(html, 'Boleto Comp.', 'Pagamento futuro', tela)
        # Cartoes da expansao: selo so com a situacao, rodape com a forma de pagamento.
        html = trocar(html, 'Pago (Dinheiro à vista)', 'Pago', tela)
        html = trocar(html, 'Pago (Pix)', 'Pago', tela)
        html = trocar(html, 'bg-canvas border border-border text-ink font-semibold">\n                              Pago',
                      'bg-[#176B4D]/10 text-success">\n                              Pago', tela)
        html = trocar(html, '<span class="text-[11px] text-muted">Balcão 01</span>', '<span class="text-[11px] text-muted">Dinheiro</span>', tela)
        html = trocar(html, '<span class="text-[11px] text-muted">Balcão 02</span>', '<span class="text-[11px] text-muted">Pix</span>', tela)

    elif tela == "detalhe_do_cliente_balc_o_papelaria_op_o":
        html = html.replace("Cliente Ativo • Em dia", "Compras com pendência")
        html = html.replace("Convênio Pessoa Física", "Cliente cadastrado")
        html = faixa(html, '<!-- Credit Limit Indicator -->', '<!-- SECTION 2:', '</div>\n</div>\n</section>\n', tela)
        html = html.replace("Faturado Boleto", "Pagamento futuro")
        html = html.replace("Faturado (Convênio)", "Pagamento futuro")
        html = html.replace("Faturado Convênio", "Pagamento futuro")
        html = html.replace("faturas emitidas e comprovantes de caixa", "situações de pagamento")
        html = faixa(html, '<!-- SECTION 3: Contextual Secondary Bento', '</main>', '', tela)
        # Pendente em laranja contido; amarelo fica reservado a marca.
        html = trocar(html, 'bg-[#FFF8E1] text-warning', 'bg-[#FFF1E6] text-[#A34F12]', tela)
        html = trocar(html, 'border-[#FFE082]', 'border-[#F3C7A2]', tela)
        html = trocar(html, 'bg-[#FFFDE7]/40', 'bg-[#FFF6EF]', tela)
        html = trocar(html, 'Vence em 12 dias no convênio', 'Vence em 12 dias', tela)

    elif tela == "financeiro_balc_o_papelaria_op_o":
        # Sem o termo "sangria": toda retirada de caixa aparece como saida.
        html = trocar(html, "Saídas / Sangrias (", "Saídas (", tela)
        html = trocar(html, "2 sangrias / 1 despesa balcão", "3 saídas no dia", tela)
        html = trocar(html, "(Sangria cofre)", "(Retirada para cofre)", tela)
        html = trocar(html, "Sangria de Caixa — Transferência para Cofre", "Retirada de caixa para o cofre", tela)
        html = trocar(html, "Saída/Sangria Operacional (Sangria para cofre)", "Saída de caixa (retirada para cofre)", tela)
        html = trocar(html, "Sangria Operacional", "Saída de caixa", tela)
        html = html.replace("R$ 142,50", "R$ 152,20")
        html = html.replace("R$ 2.458,90", "R$ 2.468,60")
        html = html.replace("R$ 2.073,90", "R$ 2.083,60")
        html = html.replace("R$ 678,20", "R$ 687,90")
        html = html.replace("R$ 628,20", "R$ 637,90")
        html = html.replace("28 transações validadas", "Movimentos de exemplo")
        html = html.replace("Caixa Aberto — Operação Normal", "Exemplo de movimentações")
        html = html.replace("Saldo Líquido do Período", "Entradas menos saídas do período")
        html = html.replace("Saldo do Período", "Entradas menos saídas")
        html = html.replace("Exportar período", "Exportar período (a definir)")
        html = html.replace("Lançamento avulso / Sangria", "Registrar movimento")
        html = html.replace("Financeiro — Balcão Papelaria Opção</h1>", "Financeiro</h1>")
        html = html.replace("Exportar período (a definir)</span>", "Exportar período</span>")

    elif tela == "estoque_balc_o_papelaria_op_o":
        html = faixa(html, '<!-- Card 4:', '<!-- Search', '</div>\n', tela)

    elif tela == "cadastrar_produto_balc_o_papelaria_op_o":
        html = html.replace("Dados Principais (Obrigatórios para Venda no Balcão)", "Dados principais")
        html = html.replace("Descrição do Produto / Nome no Cupom", "Nome do produto")
        html = html.replace("Unidade de Medida (Balcão)", "Unidade base")
        html = html.replace("Preço Balcão (Consumidor)", "Preço de venda")
        html = html.replace("Estoque Inicial / Saldo Atual <span class=\"text-danger\">*</span>", "Quantidade inicial")
        html = re.sub(r'<button[^>]*>\s*<span[^>]*>sync</span>\s*Gerar EAN\s*</button>', '', html, count=1)
        html = html.replace("Cálculo de margem em tempo real", "Campos comerciais")
        html = faixa(html, '<!-- Margem de Lucro -->', '<!-- Preço de Venda Balcão', '', tela)
        html = faixa(html, '<!-- PAINEL 3: DADOS FISCAIS', '<!-- MODAL STICKY FOOTER BAR -->', '''
<section class="bg-surface border border-border rounded-xl p-5">
  <h3 class="font-label text-label font-bold text-ink">Dados complementares</h3>
  <p class="text-body-sm text-muted mt-1">Preencha apenas o que ajuda a identificar e repor o produto. Estes campos são opcionais.</p>
  <div class="grid grid-cols-2 gap-4 mt-4">
    <label>Marca<input class="w-full border border-border rounded-md px-3 py-2" type="text"></label>
    <label>Fornecedor<input class="w-full border border-border rounded-md px-3 py-2" type="text"></label>
    <label>Características<input class="w-full border border-border rounded-md px-3 py-2" type="text" placeholder="Cor, tamanho, gramatura..."></label>
    <label>Descrição adicional<input class="w-full border border-border rounded-md px-3 py-2" type="text"></label>
  </div>
  <label class="block mt-4"><input type="checkbox" checked> Controla estoque</label>
  <details class="mt-4"><summary class="cursor-pointer font-semibold">Apresentação em caixa ou pacote</summary>
    <p class="text-body-sm text-muted mt-2">Opcional. O saldo continua na unidade base.</p>
  </details>
  <details class="mt-4"><summary class="cursor-pointer font-semibold">Dados fiscais reservados</summary>
    <p class="text-body-sm text-muted mt-2">Campos e regras fiscais serão definidos com a contabilidade. Não há CFOP padrão do produto nesta etapa.</p>
  </details>
</section>
''', tela)
        html = html.replace("Campos obrigatórios preenchidos: 5 de 5", "Confira nome, categoria, unidade e preço")

    elif tela == "registrar_entrada_de_mercadorias_balc_o_papelaria_op_o":
        # Alerta de reposicao e saldo zerado com o mesmo selo, centrados na linha.
        html = trocar(html, '''<div class="flex items-center gap-2">
<span class="font-medium text-ink">Borracha Escolar Mercur Record 40 com Capa Protetora</span>
<span class="px-2 py-0.5 bg-danger/10 border border-danger/20 text-danger text-[10px] font-bold rounded-md uppercase">Reposição Crítica</span>
</div>
<div class="text-[11px] text-muted">Acessórios de Escrita • Local: Balcão Caixa 01</div>''', '''<div class="flex items-center justify-between gap-3">
<div class="min-w-0">
<span class="font-medium text-ink">Borracha Escolar Mercur Record 40 com Capa Protetora</span>
<div class="text-[11px] text-muted">Acessórios de Escrita • Local: Balcão Caixa 01</div>
</div>
<span class="px-2 py-0.5 bg-danger/10 border border-danger/30 text-danger text-[11px] font-bold rounded-md">Reposição Crítica</span>
</div>''', tela)
        html = trocar(html, 'rounded text-[11px] font-bold text-danger bg-white border border-danger/30', 'rounded-md text-[11px] font-bold text-danger bg-danger/10 border border-danger/30', tela)
        html = html.replace("Número da Nota / Pedido", "Referência da compra (opcional)")
        html = html.replace("Conhecimento de Transporte / Obs.", "Observações (opcional)")
        html = html.replace("Fornecedor / Origem", "Fornecedor (opcional)")
        html = html.replace("Esta entrada atualiza o saldo físico imediatamente.", "Ao confirmar a entrada, o saldo físico dos itens será atualizado.")
        html = html.replace("para não inflar compras fiscais indevidamente", "para manter o histórico de entradas separado dos ajustes")

    elif tela == "notas_fiscais_balc_o_papelaria_op_o":
        html = re.sub(r'<main\b[^>]*>.*?</main>', '''<main class="pt-16 p-6 flex flex-col gap-6 max-w-[1600px] w-full mx-auto">
  <section class="flex flex-col gap-2 pt-2"><p class="text-muted">Terminal Balcão #01 / Notas fiscais</p>
    <h1 class="text-headline-lg font-headline-lg text-ink">Notas fiscais</h1>
    <p class="text-body-sm text-muted">Consulte os exemplos de entradas e saídas e revise rascunhos preparados a partir de fichas de venda.</p>
  </section>
  <section class="bg-surface border border-border rounded-xl p-5">
    <h2 class="text-headline-md font-headline-md text-ink">Rascunho de nota de saída</h2>
    <p class="mt-2">Ficha #1043 · Mariana Costa · R$ 152,20</p>
    <p class="text-muted mt-1">Itens e valores conhecidos foram preenchidos para revisão. Este rascunho não tem número fiscal nem autorização.</p>
    <button class="mt-4 px-4 py-2 bg-primary text-white rounded-lg">Revisar rascunho</button>
  </section>
  <section class="bg-surface border border-border rounded-xl p-5">
    <div class="flex gap-3 border-b border-border pb-4"><button class="px-4 py-2 bg-canvas rounded-lg font-semibold">Saídas</button><button class="px-4 py-2 rounded-lg">Entradas</button></div>
    <h2 class="text-headline-md font-headline-md mt-5">Documentos de exemplo</h2>
    <div class="overflow-x-auto mt-4"><table class="w-full text-left"><thead><tr class="border-b border-border"><th class="py-3">Referência</th><th>Origem</th><th>Data</th><th>Situação</th><th>Ação</th></tr></thead>
      <tbody><tr class="border-b border-border"><td class="py-4">Rascunho da ficha #1043</td><td>Venda · Mariana Costa</td><td>24/10/2024</td><td>Em revisão</td><td>Ver rascunho</td></tr>
      <tr><td class="py-4">Documento de fornecedor</td><td>Compra de mercadorias</td><td>24/10/2024</td><td>Exemplo de entrada</td><td>Ver detalhes</td></tr></tbody></table></div>
  </section>
  <p class="text-body-sm text-muted">A emissão, o tipo de nota e os dados fiscais necessários serão definidos com a contabilidade.</p>
</main>''', html, count=1, flags=re.S)
        html = html.replace("SEFAZ Operacional", "Dados fictícios")
        html = html.replace("+ Importar XML", "Notas fiscais")
        html = html.replace("+ Nova Emissão Avulsa", "Rascunhos")

    return html


with ZipFile(ARQUIVO) as zip_file:
    entradas = [item for item in zip_file.infolist() if item.filename.endswith('/code.html')]
    for entrada in entradas:
        tela = entrada.filename.split('/')[1]
        conteudo = zip_file.read(entrada).decode('utf-8')
        revisado = revisar(tela, conteudo)
        revisado = ajustar_apresentacao(tela, revisado)
        pasta = DESTINO / tela
        pasta.mkdir(parents=True, exist_ok=True)
        (pasta / 'index.html').write_text(revisado, encoding='utf-8')
        print(tela)

    # Relatorio: controles que ainda nao levam a lugar nenhum no prototipo.
    from collections import Counter
    for tela, rotulos in sorted(SEM_DESTINO.items()):
        print(f'\n[sem destino] {tela}')
        for rotulo, vezes in Counter(rotulos).items():
            print(f'  x{vezes} {rotulo}')

    pasta_assets = DESTINO / 'assets'
    pasta_assets.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(Path(__file__).parent.parent / 'recursos/marca/logo-original.svg', pasta_assets / 'logo-original.svg')
