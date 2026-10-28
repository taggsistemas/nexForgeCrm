# Graphify e metadados
Referência: https://github.com/Graphify-Labs/graphify.
A instalação e extração não foram executadas por falta de conectividade.
Não tratar artifacts/graph/metadata.json como resultado do Graphify.

## Validação local disponível
npm run graph:metadata
Valida existência de arquivos, símbolos declarados, IDs e testes relacionados.
Inclui SHA-256 da origem, commit e proveniência DECLARED.

## Habilitar Graphify
1. Selecionar e fixar uma versão de graphifyy após revisar a documentação.
2. Instalar em ambiente Python isolado e registrar a versão em requirements.txt.
3. Ler graphify --help e validar a sintaxe de extração na versão escolhida.
4. Executar extração somente de código sobre este repositório.
5. Confirmar cobertura de TS, TSX, imports, funções e componentes.
6. Acrescentar os metadados explícitos sem mudar relações inferidas para extraídas.
7. Automatizar no CI após validar saída, licenciamento e esquema.

Excluir node_modules, dist, .git, .env, uploads, dados reais, dumps e artefatos.
Extração semântica com serviço externo exige decisão sobre envio de código.
Não instalar hooks globais nem ler o ERP nesta fase.

## Federação
federation.json reserva namespaces separados para CRM e ERP.
Grafo do ERP desabilitado até autorização e exportação próprias.
Links futuros usam contrato, versão, produtor e consumidor; nunca caminho local
de outro repositório como identidade estável.