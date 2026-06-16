## Objetivo

Hospedar o sistema fora da Lovable, em um **VPS da Hostinger com Node.js**, e remover qualquer indicação visual de "Edit with Lovable" da tela.

> Observação importante: o **backend (banco de dados, autenticação, storage, edge functions)** continua no **Lovable Cloud**. O VPS hospeda apenas o frontend + SSR (renderização do React no servidor). Isso é necessário porque os dados, usuários e uploads já estão no Lovable Cloud — migrá-los para outro lugar seria um projeto separado e bem maior.

---

## 1. Remover o selo "Edit with Lovable"

- Desativar a exibição do badge nos deploys publicados (configuração de projeto — requer plano Pro).
- O selo só aparece em sites publicados pela Lovable; no build que vai para a Hostinger ele **não é injetado**, então não há nada para remover no código. Mas vou desligar também na publicação Lovable para garantir que nenhum ambiente mostre.

---

## 2. Preparar o projeto para rodar em Node.js (VPS)

Hoje o projeto é compilado para **Cloudflare Worker** (formato que a Lovable usa). Para rodar na Hostinger, preciso adicionar um **segundo formato de build, compatível com Node.js**, sem quebrar o build atual da Lovable.

Arquivos novos:

1. **`src/server-node.ts`** — adaptador Node.js. Importa o handler SSR do TanStack Start e o serve via `http.createServer` nativo do Node, convertendo `IncomingMessage`/`ServerResponse` ↔ `Request`/`Response` da Web API.

2. **`ecosystem.config.cjs`** — configuração do **PM2** (gerenciador de processos Node.js) para manter o app rodando 24/7 e reiniciar em caso de queda.

3. **`deploy/nginx.conf.example`** — configuração do **Nginx** como proxy reverso (porta 80/443 → Node na porta 3000), com suporte a WebSocket para realtime do banco.

4. **`.env.production.example`** — lista de variáveis de ambiente que você precisa configurar no VPS (URLs e chaves do Lovable Cloud, chave do Stripe, secret do webhook de pagamento, `PORT`, `NODE_ENV`).

5. **`DEPLOY-VPS.md`** — guia passo a passo em português: conectar via SSH, instalar Node 20 LTS, Nginx, Certbot (HTTPS grátis via Let's Encrypt), clonar do GitHub, build, rodar via PM2.

Arquivos modificados:

6. **`vite.config.ts`** — adicionar um segundo build SSR com `ssr.target = 'node'` e saída em `dist/node/`. O build atual para Cloudflare Worker é **preservado intacto** (para você continuar podendo publicar pela Lovable se quiser).

7. **`package.json`** — adicionar scripts:
   - `build:node` — gera o build Node.js
   - `start:node` — inicia o servidor em produção
   - `deploy:vps` — atalho que faz pull + install + build + restart PM2

---

## 3. Pré-requisitos do seu lado (Hostinger)

Antes do deploy você precisa ter:

- **Plano VPS** da Hostinger (o plano de hospedagem compartilhada **não funciona** — foi por isso que deu 403 antes).
- Acesso SSH ao VPS (usuário root ou sudo).
- Domínio apontando para o IP do VPS (registro A).

O guia `DEPLOY-VPS.md` cobre tudo: instalação do Node, Nginx, certificado HTTPS, configuração do PM2 para iniciar no boot, e como atualizar o app depois (basta `git pull` + `npm run deploy:vps`).

---

## 4. O que **não muda**

- Banco de dados, login, upload de comprovantes, edge functions e pagamentos continuam funcionando exatamente como hoje, pois continuam no Lovable Cloud — o VPS só serve as páginas.
- O código-fonte é o mesmo: você pode continuar editando pela Lovable e dando push pro GitHub; no VPS você só roda `git pull` + `npm run deploy:vps` para atualizar.

---

## Detalhes técnicos (para referência)

- Adapter Node usa `node:http` + conversão `Request`/`Response` via Web Streams (já nativos no Node 20+).
- O segundo build do Vite usa o mesmo `virtual:tanstack-start-server-entry`, só muda o `ssr.target`. Build da Cloudflare permanece em `dist/_worker.js`, build do Node em `dist/node/server-node.js`, assets estáticos compartilhados em `dist/client/`.
- Nginx faz proxy `/` → `localhost:3000`, com `proxy_http_version 1.1` e headers de Upgrade para WebSocket (necessário para realtime do Supabase).
- Certbot (Let's Encrypt) emite e renova HTTPS automaticamente.
- Variáveis sensíveis (chaves do Stripe, service role do banco) ficam só no `.env` do VPS, nunca commitadas no Git.
