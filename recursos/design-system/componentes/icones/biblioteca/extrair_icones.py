"""Recorta os ícones usados pelo app do Icons.pdf e gera src/componentes/icone/desenhos.ts.

O PDF é vetorial: cada ícone é um grupo de formas preenchidas. O script agrupa as
formas próximas, centraliza cada grupo numa caixa de 24 x 24 e guarda os caminhos.

Para acrescentar um ícone: ache a posição dele no PDF (coordenadas da página,
origem no canto superior esquerdo; a visao-geral.png tem a mesma proporção),
acrescente em ICONES e rode:

    pip install pymupdf
    python recursos/design-system/componentes/icones/biblioteca/extrair_icones.py
"""

from pathlib import Path
import pymupdf

AQUI = Path(__file__).parent
RAIZ = AQUI.parents[4]
SAIDA = RAIZ / 'src' / 'componentes' / 'icone' / 'desenhos.ts'

# nome no app -> centro aproximado do ícone no PDF (x, y)
ICONES = {
    'inicio': (1532, 844), 'clientes': (2212, 1484), 'financeiro': (236, 2283),
    'estoque': (2148, 365), 'notas': (2340, 493), 'carrinho': (107, 2219),
    'busca': (3020, 1005), 'sino': (3020, 429), 'olho': (980, 1100),
    'olho-fechado': (1044, 1100), 'mais': (1724, 1515), 'menos': (108, 2021),
    'fechar': (1596, 1579), 'seta-esquerda': (236, 365), 'seta-direita': (300, 365),
    'seta-cima': (108, 365), 'seta-baixo': (172, 365), 'chevron-esquerda': (491, 1069),
    'chevron-direita': (557, 1069), 'chevron-cima': (364, 1068), 'chevron-baixo': (428, 1070),
    'historico': (2892, 1548), 'ajustes': (1852, 2186), 'filtro': (2340, 622),
    'ordenar': (2339, 819), 'cartao': (364, 1963), 'pix': (3276, 1069),
    'dinheiro': (108, 2155), 'codigo-barras': (300, 1899), 'calendario': (2956, 1483),
    'relogio': (3213, 1484), 'confirmado': (2892, 621), 'check': (2828, 621),
    'alerta': (2340, 1899), 'info': (2532, 1707), 'erro': (2404, 1899),
    'imprimir': (2340, 749), 'lixeira': (2468, 876), 'editar': (2404, 685),
    'baixar': (3212, 813), 'enviar': (3020, 1197), 'pessoa': (2468, 1356),
    'pessoa-circulo': (2340, 1420), 'adicionar-pessoa': (2213, 1419),
    'nuvem-ok': (3276, 621), 'mais-opcoes': (2956, 813), 'abrir-externo': (172, 557),
    'cadeado': (2276, 1770), 'tendencia-alta': (1468, 1578), 'tendencia-baixa': (1532, 1580),
    'grafico': (1596, 1195), 'etiqueta': (364, 2219), 'caminhao': (980, 1035),
    'entrada-estoque': (2212, 365), 'recibo': (300, 2155), 'telefone': (852, 430),
    'loja': (236, 2219), 'documento-mais': (2468, 429), 'pacote': (172, 2155),
    'banco': (1468, 1194), 'porcentagem': (1660, 1515), 'atalho': (2892, 685),
    'painel-lateral': (1172, 1420),
    'documento': (2148, 1292), 'email': (1108, 493), 'endereco': (1788, 844),
}


def agrupar(desenhos):
    """Une formas cujas caixas ficam a menos de 3 unidades: cada grupo é um ícone."""
    caixas = [d['rect'] for d in desenhos]
    pai = list(range(len(desenhos)))

    def raiz(i):
        while pai[i] != i:
            pai[i] = pai[pai[i]]
            i = pai[i]
        return i

    ordem = sorted(range(len(caixas)), key=lambda i: caixas[i].x0)
    for a, i in enumerate(ordem):
        perto = caixas[i] + (-3, -3, 3, 3)
        for j in ordem[a + 1:]:
            if caixas[j].x0 > perto.x1:
                break
            if perto.intersects(caixas[j]):
                pai[raiz(i)] = raiz(j)
    grupos = {}
    for i in range(len(desenhos)):
        grupos.setdefault(raiz(i), []).append(i)
    return list(grupos.values())


def caminho(desenho, ox, oy):
    """Converte os itens de uma forma do PDF em um atributo d de SVG."""
    def p(pt):
        return f'{pt.x - ox:.2f} {pt.y - oy:.2f}'

    cmds, ultimo = [], None
    for item in desenho['items']:
        tipo = item[0]
        if tipo == 're':
            r = item[1]
            cmds.append(f'M{r.x0 - ox:.2f} {r.y0 - oy:.2f}H{r.x1 - ox:.2f}V{r.y1 - oy:.2f}H{r.x0 - ox:.2f}Z')
            ultimo = None
        elif tipo == 'qu':
            q = item[1]
            cmds.append('M' + 'L'.join(p(v) for v in (q.ul, q.ur, q.lr, q.ll)) + 'Z')
            ultimo = None
        else:
            inicio = item[1]
            if ultimo is None or abs(ultimo.x - inicio.x) > 0.01 or abs(ultimo.y - inicio.y) > 0.01:
                if ultimo is not None:
                    cmds.append('Z')
                cmds.append('M' + p(inicio))
            if tipo == 'l':
                ultimo = item[2]
                cmds.append('L' + p(ultimo))
            elif tipo == 'c':
                ultimo = item[4]
                cmds.append(f'C{p(item[2])} {p(item[3])} {p(ultimo)}')
    if cmds and cmds[-1] != 'Z':
        cmds.append('Z')
    return ''.join(cmds)


def main():
    pagina = pymupdf.open(AQUI / 'Icons.pdf')[0]
    desenhos = [d for d in pagina.get_drawings()
                if d.get('fill') == (0.0, 0.0, 0.0) and d['rect'].width < 40 and d['rect'].height < 40]
    icones = []
    for grupo in agrupar(desenhos):
        caixa = pymupdf.Rect(desenhos[grupo[0]]['rect'])
        for i in grupo:
            caixa |= desenhos[i]['rect']
        if max(caixa.width, caixa.height) < 8 or max(caixa.width, caixa.height) > 30:
            continue
        icones.append((caixa, grupo))

    linhas = [
        '// Gerado por recursos/design-system/componentes/icones/biblioteca/extrair_icones.py.',
        '// Não edite à mão: acrescente o ícone no script e rode de novo.',
        '',
        'export type Desenho = { d: string; parImpar?: true }',
        '',
        'export const desenhos = {',
    ]
    for nome, (x, y) in ICONES.items():
        caixa, grupo = min(icones, key=lambda ic: abs((ic[0].x0 + ic[0].x1) / 2 - x) + abs((ic[0].y0 + ic[0].y1) / 2 - y))
        cx, cy = (caixa.x0 + caixa.x1) / 2, (caixa.y0 + caixa.y1) / 2
        if abs(cx - x) > 6 or abs(cy - y) > 6:
            raise SystemExit(f'{nome}: nenhum ícone perto de {(x, y)}')
        partes = []
        for i in grupo:
            d = caminho(desenhos[i], cx - 12, cy - 12)
            extra = ', parImpar: true' if desenhos[i].get('even_odd') else ''
            partes.append(f"{{ d: '{d}'{extra} }}")
        linhas.append(f"  '{nome}': [{', '.join(partes)}],")
    linhas += ['} satisfies Record<string, Desenho[]>', '', 'export type NomeIcone = keyof typeof desenhos', '']
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text('\n'.join(linhas), encoding='utf-8')
    print(f'{len(ICONES)} ícones em {SAIDA.relative_to(RAIZ)}')


if __name__ == '__main__':
    main()
