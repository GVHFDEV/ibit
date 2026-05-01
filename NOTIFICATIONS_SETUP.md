# Sistema de Notificações por E-mail - IBIT Platform

Sistema de alertas de prazo via e-mail usando Resend API.

## 📋 Arquitetura

- **Cron Job**: Vercel Serverless Function executada diariamente às 8h UTC
- **E-mail**: Resend API para notificações por e-mail
- **Backend**: Firebase Admin SDK para acesso ao Firestore

## 🔧 Configuração

### 1. Resend API Key

1. Crie uma conta em [Resend](https://resend.com)
2. Vá em **API Keys** e crie uma nova chave
3. Adicione ao `.env`:

```env
RESEND_API_KEY=re_sua_chave_aqui
```

4. **Importante**: Configure o domínio de envio em Resend:
   - Vá em **Domains** e adicione seu domínio
   - Configure os registros DNS (SPF, DKIM, DMARC)
   - Aguarde a verificação
   - Use o formato: `IBIT - Carnelian Escuderia <noreply@seu-dominio.com>`

### 2. Firebase Service Account

1. No Firebase Console, vá em **Project Settings** > **Service Accounts**
2. Clique em **Generate new private key**
3. Baixe o arquivo JSON
4. Copie todo o conteúdo JSON e adicione ao `.env` (em uma única linha):

```env
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"..."}
```

### 3. CRON Secret

Gere uma string aleatória segura para proteger a rota:

```bash
openssl rand -base64 32
```

Adicione ao `.env`:

```env
CRON_SECRET=sua_string_aleatoria_aqui
```

### 4. URL da Aplicação

```env
VITE_APP_URL=https://seu-dominio.com
```

## 🚀 Deploy na Vercel

1. Faça push do código para o GitHub
2. Conecte o repositório na Vercel
3. Configure as variáveis de ambiente no painel da Vercel:
   - `RESEND_API_KEY`
   - `FIREBASE_SERVICE_ACCOUNT`
   - `CRON_SECRET`
   - `VITE_APP_URL`

4. O Cron Job será automaticamente configurado pelo `vercel.json`

## 📱 Funcionamento

### Fluxo de Notificações

1. **Cron Job** (diariamente às 8h UTC):
   - Busca tarefas com `dueDate` em exatamente 3 dias
   - Para cada tarefa, identifica os responsáveis (`assignedTo` ou `ownerId`)
   - Envia e-mail HTML formatado via Resend

2. **Template de E-mail**:
   - Design minimalista com branding IBIT
   - Informações da tarefa (título, descrição, projeto)
   - Data do prazo formatada
   - Botão para abrir a tarefa no Kanban

## 🧪 Testando Localmente

### Testar a API Serverless

```bash
# Instalar Vercel CLI
npm i -g vercel

# Executar localmente
vercel dev

# Testar o endpoint (substitua YOUR_CRON_SECRET)
curl -X GET http://localhost:3000/api/notify-due-tasks \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 📊 Monitoramento

### Logs da Vercel

Acesse o painel da Vercel > Functions > notify-due-tasks para ver:
- Execuções do Cron
- Erros
- Notificações enviadas

### Resposta da API

```json
{
  "message": "Notifications processed",
  "tasksProcessed": 5,
  "notificationsSent": 8,
  "errors": 0,
  "details": {
    "notifications": [
      {
        "type": "email",
        "userId": "abc123",
        "taskId": "task456",
        "email": "user@example.com"
      }
    ],
    "errors": []
  }
}
```

## 🔒 Segurança

- ✅ Rota protegida por `CRON_SECRET`
- ✅ Firebase Admin SDK com Service Account
- ✅ Try/catch em todos os loops para evitar falhas em cascata
- ✅ Logs detalhados de erros

## 🐛 Troubleshooting

### E-mails não estão sendo enviados

- Verifique se o domínio está verificado no Resend
- Confirme que a `RESEND_API_KEY` está correta
- Verifique os logs da Vercel
- Teste o endpoint manualmente com curl

### Cron não está executando

- Verifique se o `vercel.json` está na raiz do projeto
- Confirme que o deploy foi feito na Vercel (não funciona localmente)
- Aguarde até o horário agendado (8h UTC = 5h BRT)
- Verifique os logs de Cron na Vercel

### E-mails caindo no spam

- Configure corretamente SPF, DKIM e DMARC no Resend
- Use um domínio verificado (não use @gmail.com ou @hotmail.com)
- Evite palavras spam no assunto
- Mantenha uma boa reputação de envio

## 📝 Estrutura do E-mail

O e-mail enviado contém:

- **Header**: Logo IBIT + branding Carnelian Escuderia
- **Saudação**: Nome do usuário
- **Título da tarefa**: Destaque em laranja (#ff7f00)
- **Projeto**: Nome do projeto associado
- **Descrição**: Se disponível
- **Prazo**: Data formatada + aviso "em 3 dias"
- **Botão CTA**: Link direto para a tarefa no Kanban
- **Footer**: Informações legais

## 📈 Próximos Passos

- [ ] Permitir usuário configurar quando quer ser notificado (1, 3, 7 dias)
- [ ] Adicionar notificações para outras ações (tarefa atribuída, comentários)
- [ ] Dashboard de notificações no frontend
- [ ] Preferências de notificação por usuário
- [ ] Relatório semanal de tarefas pendentes
