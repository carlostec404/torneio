# Deploy na Hostinger VPS (Node.js)

Este guia hospeda o **frontend + SSR** do sistema em um VPS da Hostinger.
O **backend (banco, login, storage, edge functions, pagamentos)** continua no
**Lovable Cloud** — não precisa migrar nada.

> ⚠️ Funciona apenas em planos **VPS** (KVM, Cloud, etc.). Hospedagem
> **compartilhada** da Hostinger **NÃO funciona** (foi o que causou o 403).

---

## 1. Pré-requisitos

- VPS Hostinger com Ubuntu 22.04 ou 24.04
- Acesso SSH como `root` (ou usuário com `sudo`)
- Um domínio com registro **A** apontando para o IP do VPS
- Repositório do projeto no GitHub

---

## 2. Setup inicial do VPS (faz só 1 vez)

Conecte via SSH:

```bash
ssh root@SEU_IP_DO_VPS
```

Instale Node 20 LTS, Nginx, Git, PM2 e Certbot:

```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs nginx git certbot python3-certbot-nginx
npm install -g pm2
node -v   # confirma v20.x
```

---

## 3. Clonar o projeto

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/SEU_USUARIO/SEU_REPO.git torneio
cd torneio
```

---

## 4. Configurar variáveis de ambiente

```bash
cp .env.production.example .env
nano .env
```

Preencha **todos** os valores (URL do Lovable Cloud, chaves do Supabase,
chave do Stripe, webhook secret). Os valores ficam no painel do Lovable em
**Cloud → Settings** e nas **Secrets** do projeto.

Permissões (importante — o arquivo tem segredos):

```bash
chmod 600 .env
```

---

## 5. Instalar dependências e fazer o build (modo Node)

```bash
npm install
NITRO_PRESET=node-server npm run build
```

O build vai gerar `.output/server/index.mjs` (servidor Node) e
`.output/public/` (assets estáticos). Esse é o app pronto para rodar.

---

## 6. Subir o app com PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd
# Cole no terminal o comando que o pm2 startup imprimir
```

Teste se está respondendo localmente:

```bash
curl -I http://127.0.0.1:3000
# Deve retornar HTTP/1.1 200
```

---

## 7. Configurar Nginx como proxy reverso

```bash
cp deploy/nginx.conf.example /etc/nginx/sites-available/torneio
nano /etc/nginx/sites-available/torneio
# Troque "seudominio.com" pelos seus domínios reais
ln -s /etc/nginx/sites-available/torneio /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

Acesse `http://seudominio.com` no navegador para confirmar que carrega.

---

## 8. HTTPS gratuito (Let's Encrypt)

```bash
certbot --nginx -d seudominio.com -d www.seudominio.com
```

Aceite os termos e escolha redirecionar HTTP → HTTPS. O certificado é
renovado sozinho via cron do certbot.

---

## 9. Atualizar o sistema depois (deploys futuros)

Sempre que fizer mudanças pelo Lovable e der push pro GitHub:

```bash
cd /var/www/torneio
git pull
npm install
NITRO_PRESET=node-server npm run build
pm2 restart torneio-manoamano
```

Dica: pode salvar isso como alias:

```bash
echo "alias deploy='cd /var/www/torneio && git pull && npm install && NITRO_PRESET=node-server npm run build && pm2 restart torneio-manoamano'" >> ~/.bashrc
source ~/.bashrc
# Depois é só rodar:  deploy
```

---

## 10. Comandos úteis

```bash
pm2 status                # status do app
pm2 logs torneio-manoamano  # ver logs em tempo real
pm2 restart torneio-manoamano
pm2 stop torneio-manoamano
systemctl status nginx
tail -f /var/log/nginx/error.log
```

---

## 11. Webhook do Stripe

Se você usa o webhook de pagamentos, atualize a URL do webhook no painel
do Stripe para:

```
https://seudominio.com/api/public/payments/webhook
```

E confirme que `PAYMENTS_SANDBOX_WEBHOOK_SECRET` no `.env` bate com o
segredo que o Stripe gerou pra esse endpoint.

---

## 12. Solução de problemas

**502 Bad Gateway** → o Node caiu. `pm2 logs torneio-manoamano` mostra o erro.

**403 Forbidden** → você apontou pro plano compartilhado da Hostinger, não pro
VPS. Esse guia só funciona em **VPS com Node**.

**500 em todas as páginas** → variáveis do `.env` faltando ou erradas.
Confira com `pm2 logs` e reinicie com `pm2 restart torneio-manoamano` após corrigir.

**Realtime não funciona** → o Nginx precisa dos headers `Upgrade` e
`Connection` (já estão no `nginx.conf.example`).
