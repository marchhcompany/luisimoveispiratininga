# Importação em lote — Luis Imóveis

O dashboard agora está preparado para trabalhar com dezenas ou centenas de fotografias sem salvar cada imagem em Base64 no `localStorage`.

## Como funciona

As fotos são copiadas para o próprio projeto e organizadas automaticamente por quadra:

```text
imagens/
  quadra-01/
  quadra-02/
  ...
  quadra-08/
```

O script também atualiza `data/imoveis-importados.js`. O `index.html` carrega esse manifesto antes de `js/app.js`, e o dashboard mistura automaticamente os imóveis importados com os registros antigos já existentes no navegador.

## Importar várias fotos de uma vez

Abra o projeto no VS Code e confirme que está na branch:

```powershell
git fetch
git checkout feature/importacao-lote-imoveis
```

Separe as fotos de cada quadra em uma pasta no computador. Exemplo:

```text
C:\FotosLuis\Quadra1
C:\FotosLuis\Quadra2
```

No terminal PowerShell, na raiz do projeto, execute:

```powershell
.\scripts\importar-fotos.ps1 -Origem "C:\FotosLuis\Quadra1" -Quadra 1
```

Para outra quadra:

```powershell
.\scripts\importar-fotos.ps1 -Origem "C:\FotosLuis\Quadra2" -Quadra 2
```

O script:

1. encontra as imagens da pasta;
2. cria `imagens/quadra-XX/` quando necessário;
3. copia todas de uma vez;
4. renomeia para `imovel-0001.jpg`, `imovel-0002.jpg` etc.;
5. cria um registro por foto no manifesto;
6. associa cada registro à quadra escolhida.

Cada imóvel importado nasce com endereço provisório, situação `Fechada` e telefone vazio. Depois, no próprio dashboard, clique em **Editar informações** para preencher endereço, situação e contato sem reenviar a fotografia.

## Subir as fotos para o GitHub

Depois da importação, confira os arquivos no VS Code e rode:

```powershell
git add .
git commit -m "Adicionar fotos dos imóveis"
git push
```

Quando a branch estiver integrada à `main`, o mesmo fluxo passa a ser feito normalmente na `main`.

## Compatibilidade com dados antigos

Os registros antigos do `localStorage` continuam sendo carregados. Os imóveis vindos do manifesto recebem identificadores próprios e não são duplicados a cada atualização da página.

Se um imóvel importado for editado no navegador, as alterações locais são preservadas. Se ele for excluído pela interface, o dashboard registra essa exclusão local para que o mesmo item não reapareça imediatamente no próximo carregamento.

## Observação sobre fotos HEIC

HEIC pode não ser exibido corretamente em todos os navegadores. Para o site, prefira JPG, JPEG, PNG ou WEBP. Se as fotos vierem do iPhone em HEIC, converta-as para JPG antes da importação quando necessário.
