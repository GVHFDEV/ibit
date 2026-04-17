/**
 * Landing do projeto: visão geral com métricas resumidas.
 * Tarefas a fazer: heurística Kanban — com 2+ colunas, a última (por order) = feito; com 1 coluna, todas contam como "a fazer".
 * Concluídas (7 dias): tarefas com dueDate nos últimos 7 dias (janela até agora), independentemente da coluna.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, collection, query, where, onSnapshot, documentId } from 'firebase/firestore';
import { Project, Board, Task, UserProfile } from '../types';
import Sidebar from './Sidebar';
import ProjectSettingsModal from './ProjectSettingsModal';
import { CheckCircle2, ListTodo } from 'lucide-react';

function dueDateToDate(task: Task): Date | null {
  const raw = task.dueDate;
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (raw instanceof Date) return raw;
  return null;
}

function computeMetrics(boards: Board[], tasks: Task[]) {
  const sorted = [...boards].sort((a, b) => (a.order || 0) - (b.order || 0));
  let todoCount = 0;
  if (sorted.length === 0) todoCount = 0;
  else if (sorted.length === 1) todoCount = tasks.length;
  else {
    const doneBoardId = sorted[sorted.length - 1].id;
    for (const t of tasks) {
      if (t.boardId !== doneBoardId) todoCount += 1;
    }
  }

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  let completedLast7Days = 0;
  for (const t of tasks) {
    const d = dueDateToDate(t);
    if (!d) continue;
    const ts = d.getTime();
    if (ts >= sevenDaysAgo && ts <= now) completedLast7Days += 1;
  }
  return { todoCount, completedLast7Days };
}

export default function ProjectDashboard() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectMembers, setProjectMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!projectId || !user) return;
    const projectRef = doc(db, 'projects', projectId);
    return onSnapshot(projectRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Project;
        if (!data.members.includes(user.uid)) {
          navigate('/dashboard');
          return;
        }
        setProject({ id: docSnap.id, ...data });
      } else {
        navigate('/dashboard');
      }
    });
  }, [projectId, user, navigate]);

  useEffect(() => {
    if (!project?.members || project.members.length === 0) return;
    const qMembers = query(
      collection(db, 'users'),
      where(documentId(), 'in', project.members.slice(0, 30))
    );
    return onSnapshot(qMembers, (snapshot) => {
      const membersData: UserProfile[] = [];
      snapshot.forEach((d) => {
        membersData.push({ uid: d.id, ...d.data() } as UserProfile);
      });
      setProjectMembers(membersData);
    });
  }, [project?.members?.join(',')]);

  useEffect(() => {
    if (!projectId) return;
    const qBoards = query(collection(db, 'boards'), where('projectId', '==', projectId));
    const unsubBoards = onSnapshot(qBoards, (snapshot) => {
      const boardsData: Board[] = [];
      snapshot.forEach((d) => {
        boardsData.push({ id: d.id, ...d.data() } as Board);
      });
      setBoards(boardsData.sort((a, b) => (a.order || 0) - (b.order || 0)));
    });

    const qTasks = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const tasksData: Task[] = [];
      snapshot.forEach((d) => {
        tasksData.push({ id: d.id, ...d.data() } as Task);
      });
      setTasks(tasksData);
      setLoading(false);
    });

    return () => {
      unsubBoards();
      unsubTasks();
    };
  }, [projectId]);

  const { todoCount, completedLast7Days } = useMemo(
    () => computeMetrics(boards, tasks),
    [boards, tasks]
  );

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#ff7f00] border-t-transparent animate-spin rounded-full"></div>
      </div>
    );
  }

  const isOwner = project.ownerId === user?.uid;

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-900 flex h-screen">
      <Sidebar
        projectId={projectId}
        projectName={project.name}
        onOpenSettings={isOwner ? () => setIsSettingsOpen(true) : undefined}
      />
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        <header className="border-b border-gray-200 bg-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
              {project.photoURL ? (
                <img src={project.photoURL} alt={project.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">🏎️</span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-wider leading-tight text-gray-900 truncate">
                {project.name} - #{project.shortId || '---'}
              </h2>
            </div>
            <div className="flex items-center ml-4 shrink-0">
              <div className="flex -space-x-2 mr-3">
                {projectMembers.map((member) => (
                  <div key={member.uid} className="relative inline-block" title={member?.name}>
                    {member?.photoURL ? (
                      <img
                        src={member.photoURL}
                        alt={member.name}
                        className="w-8 h-8 rounded-full border-2 border-white object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                        {member?.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 border border-gray-200 rounded-md">
                {project.members.length} {project.members.length === 1 ? 'MEMBRO' : 'MEMBROS'}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="flex flex-col flex-1 min-h-0 gap-5 sm:gap-6 w-full max-w-[1920px] mx-auto px-4 py-5 sm:px-6 md:px-8 lg:px-10 xl:px-12 pb-6 sm:pb-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0">
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 flex items-center justify-start min-h-[112px] sm:min-h-[128px]">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                    <ListTodo className="w-5 h-5 sm:w-6 sm:h-6 text-[#ff7f00]" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-1">
                      Tarefas a fazer
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums text-[#ff7f00] leading-none">{todoCount}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 flex items-center justify-start min-h-[112px] sm:min-h-[128px]">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#ff7f00]" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-1">
                      Concluídas (7 dias)
                    </p>
                    <p className="text-2xl sm:text-3xl font-bold tabular-nums text-[#ff7f00] leading-none">{completedLast7Days}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl min-h-[112px] sm:min-h-[128px]" aria-hidden />
              <div className="bg-white border border-gray-200 rounded-xl min-h-[112px] sm:min-h-[128px]" aria-hidden />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 lg:items-stretch flex-1 min-h-0 lg:min-h-[min(60vh,560px)]">
              <div
                className="bg-white border border-gray-200 rounded-xl min-h-[220px] lg:min-h-0 lg:h-full"
                aria-hidden
              />
              <div className="flex flex-col gap-3 sm:gap-4 min-h-[220px] lg:min-h-0 lg:h-full">
                <div className="bg-white border border-gray-200 rounded-xl flex-1 min-h-[88px] lg:min-h-0" aria-hidden />
                <div className="bg-white border border-gray-200 rounded-xl flex-[1.15] min-h-[100px] lg:min-h-0" aria-hidden />
                <div className="bg-white border border-gray-200 rounded-xl flex-1 min-h-[88px] lg:min-h-0" aria-hidden />
              </div>
            </div>
          </div>
        </main>
      </div>

      {isSettingsOpen && (
        <ProjectSettingsModal project={project} onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}
