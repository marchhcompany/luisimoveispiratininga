# Importação em lote — Luis Imóveis

Este fluxo foi criado para substituir o cadastro manual de dezenas/centenas de fotografias.

## Estrutura

As fotos ficam fora do `localStorage` e são organizadas por quadra:

```text
imagens/
  quadra-01/
  quadra-02/
  ...
  quadra-08/
```

O arquivo `data/imoveis-importados.js` funciona como manifesto dos imóveis importados.

## Como importar 90+ fotos

No Windows/VS Code, abra o terminal PowerShell na raiz do projeto e execute:

```powershell
.\scripts\importar-fotos.ps1 -Origem "C:\CAMINHO\DAS\FOTOS" -Quadra 1
```

Troque `1` pelo número da quadra. O script:

1. encontra JPG, JPEG, PNG, WEBP e HEIC;
2. copia todas as imagens de uma vez;
3. renomeia de forma padronizada (`imovel-0001.jpg`, etc.);
4. cria automaticamente um registro para cada foto;
5. atualiza `data/imoveis-importados.js` sem colocar a imagem em Base64.

Depois:

```powershell
git add .
git commit -m "Adicionar fotos mapeadas"
git push
```

## Dados criados inicialmente

Cada foto recebe um registro com:

- quadra;
- caminho da foto;
- endereço provisório para preencher;
- situação inicial `Fechada`;
- telefone vazio.

Os dados podem ser enriquecidos posteriormente sem precisar reenviar a foto.

## Importante

O site atual ainda possui compatibilidade com os registros antigos salvos no navegador. A migração deve preservar esses registros enquanto o novo fluxo passa a usar arquivos reais versionados no repositório.
