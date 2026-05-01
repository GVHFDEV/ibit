import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(now.getDate() + 3);
    threeDaysFromNow.setHours(0, 0, 0, 0);
    const endOfDay = new Date(threeDaysFromNow);
    endOfDay.setHours(23, 59, 59, 999);

    const tasksSnapshot = await db.collection('tasks')
      .where('dueDate', '>=', admin.firestore.Timestamp.fromDate(threeDaysFromNow))
      .where('dueDate', '<=', admin.firestore.Timestamp.fromDate(endOfDay))
      .get();

    if (tasksSnapshot.empty) {
      return res.status(200).json({ message: 'No tasks due in 3 days', count: 0 });
    }

    const notifications: any[] = [];
    const errors: any[] = [];

    for (const taskDoc of tasksSnapshot.docs) {
      try {
        const task = taskDoc.data();
        const taskId = taskDoc.id;
        const projectDoc = await db.collection('projects').doc(task.projectId).get();
        const project = projectDoc.exists ? projectDoc.data() : null;

        let assignees: string[] = [];
        if (Array.isArray(task.assignedTo)) {
          assignees = task.assignedTo;
        } else if (task.assignedTo) {
          assignees = [task.assignedTo];
        }
        if (assignees.length === 0 && task.ownerId) {
          assignees = [task.ownerId];
        }

        for (const userId of assignees) {
          try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (!userDoc.exists) continue;
            const user = userDoc.data();
            const dueDate = task.dueDate.toDate();
            const formattedDate = dueDate.toLocaleDateString('pt-BR', {
              day: '2-digit', month: '2-digit', year: 'numeric'
            });

            const emailHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; }
.container { max-width: 600px; margin: 0 auto; padding: 20px; }
.header { background: #ff7f00; color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
.header h1 { margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 3px; font-weight: 900; }
.header p { margin: 8px 0 0; font-size: 10px; letter-spacing: 2px; opacity: 0.9; }
.content { background: white; padding: 40px 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 8px 8px; }
.greeting { font-size: 16px; margin-bottom: 20px; }
.task-title { font-size: 22px; font-weight: bold; color: #ff7f00; margin: 25px 0 10px; }
.project-name { color: #666; font-size: 14px; margin-bottom: 20px; }
.description { color: #555; margin: 15px 0; line-height: 1.8; }
.due-date { background: #fff3e0; padding: 20px; border-left: 4px solid #ff7f00; margin: 25px 0; border-radius: 4px; }
.due-date strong { color: #ff7f00; }
.btn { display: inline-block; background: #ff7f00; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; margin-top: 25px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-size: 13px; }
.btn:hover { background: #e67300; }
.footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
</style>
</head>
<body>
<div class="container">
<div class="header">
<h1>IBIT</h1>
<p>BY CARNELIAN ESCUDERIA</p>
</div>
<div class="content">
<p class="greeting">Olá, <strong>${user.name}</strong>!</p>
<p>Esta é uma notificação automática para lembrá-lo de uma tarefa importante:</p>
<div class="task-title">${task.title}</div>
<div class="project-name">📁 Projeto: ${project?.name || 'Sem projeto'}</div>
${task.description ? `<p class="description">${task.description}</p>` : ''}
<div class="due-date">
<strong>⏰ Prazo:</strong> ${formattedDate} (em 3 dias)
</div>
<p>Não se esqueça de concluir esta tarefa antes do prazo!</p>
<a href="${process.env.VITE_APP_URL || 'https://ibit.app'}/project/${task.projectId}/kanban?taskId=${taskId}" class="btn">Ver Tarefa</a>
</div>
<div class="footer">
<p>Você está recebendo este e-mail porque é membro da Carnelian Escuderia.</p>
<p>© 2026 IBIT - Carnelian Escuderia. Todos os direitos reservados.</p>
</div>
</div>
</body>
</html>`;

            try {
              await resend.emails.send({
                from: 'IBIT - Carnelian Escuderia <noreply@ibit.app>',
                to: user.email,
                subject: `⚠️ Tarefa próxima do prazo: ${task.title}`,
                html: emailHtml,
              });
              notifications.push({ type: 'email', userId, taskId, email: user.email });
            } catch (emailError: any) {
              errors.push({ type: 'email', userId, taskId, error: emailError.message });
            }
          } catch (userError: any) {
            errors.push({ type: 'user-processing', userId, taskId, error: userError.message });
          }
        }
      } catch (taskError: any) {
        errors.push({ type: 'task-processing', taskId: taskDoc.id, error: taskError.message });
      }
    }

    return res.status(200).json({
      message: 'Notifications processed',
      tasksProcessed: tasksSnapshot.size,
      notificationsSent: notifications.length,
      errors: errors.length,
      details: { notifications, errors }
    });
  } catch (error: any) {
    console.error('Error in notify-due-tasks:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
