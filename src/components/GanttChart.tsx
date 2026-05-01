import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';
import MobileBottomNav from './MobileBottomNav';
import MobileToolsDrawer from './MobileToolsDrawer';
import UserProfileModal from './UserProfileModal';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  documentId
} from 'firebase/firestore';
import { 
  GanttTask, 
  Project, 
  UserProfile, 
  ProjectStakeholder 
} from '../types';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  ChevronRight,
  MoreVertical,
  X,
  Loader2,
  Users,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  BarChart,
  Layout
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { motion, AnimatePresence } from 'motion/react';
import ProjectSettingsModal from './ProjectSettingsModal';

// --- Components ---

interface GanttTaskModalProps {
  task: Partial<GanttTask> | null;
  onSave: (task: Partial<GanttTask>) => void;
  onClose: () => void;
  participants: { id: string, name: string, photoURL?: string, isUser: boolean }[];
  allTasks: GanttTask[];
}

function GanttTaskModal({ task, onSave, onClose, participants, allTasks }: GanttTaskModalProps) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [startDate, setStartDate] = useState(task?.startDate ? new Date((task.startDate as any).seconds * 1000).toISOString().split('T')[0] : '');
  const [endDate, setEndDate] = useState(task?.endDate ? new Date((task.endDate as any).seconds * 1000).toISOString().split('T')[0] : '');
  const [status, setStatus] = useState<GanttTask['status']>(task?.status || 'pending');
  const [progress, setProgress] = useState(task?.progress || 0);
  const [category, setCategory] = useState(task?.category || 'MILESTONE');
  const [section, setSection] = useState(task?.section || '');
  const initialDeps = typeof task?.dependencies === 'string' ? task.dependencies : (Array.isArray(task?.dependencies as any) ? (task?.dependencies as any).join(', ') : '');
  const [dependencies, setDependencies] = useState<string>(initialDeps);
  const [assignedTo, setAssignedTo] = useState<string[]>(task?.assignedTo || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status,
      progress,
      assignedTo,
      category,
      section,
      dependencies
    });
  };

  const toggleParticipant = (id: string) => {
    setAssignedTo(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white border border-gray-200 w-full max-w-2xl overflow-hidden rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 shadow-sm shrink-0">
          <h2 className="text-xl font-bold uppercase tracking-wider text-gray-900">
            {task?.id ? 'EDITAR FUNÇÃO' : 'NOVA FUNÇÃO'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide space-y-6">
          <form id="gantt-func-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-6">
            <div className="col-span-2 space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">TÍTULO DA FUNÇÃO</label>
              <input
                autoFocus
                required
                className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-lg shadow-sm"
                placeholder="Ex: Desenvolvimento Frontend..."
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">DATA DE INÍCIO</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  required
                  type="date"
                  className="w-full bg-white border border-gray-300 pl-10 pr-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold text-sm rounded-lg shadow-sm"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">DATA FINAL</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  required
                  type="date"
                  className="w-full bg-white border border-gray-300 pl-10 pr-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold text-sm rounded-lg shadow-sm"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">STATUS</label>
              <select
                className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold text-sm rounded-lg shadow-sm appearance-none"
                value={status}
                onChange={e => setStatus(e.target.value as GanttTask['status'])}
              >
                <option value="pending">PENDENTE</option>
                <option value="in_progress">EM ANDAMENTO</option>
                <option value="completed">FEITO</option>
                <option value="delayed">ATRASADO</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center mb-1">
                 <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">PROGRESSO</label>
                 <span className="text-sm font-bold text-[#ff7f00]">{progress}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#ff7f00]"
                value={progress}
                onChange={e => setProgress(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">SEÇÃO (OPCIONAL)</label>
              <input
                className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold text-sm rounded-lg shadow-sm"
                placeholder="Ex: Engenharia, Projeto..."
                value={section}
                onChange={e => setSection(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">CATEGORIA</label>
              <select
                className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold text-sm rounded-lg shadow-sm appearance-none"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {['MILESTONE', 'HIGH RISK', 'GOAL', 'MEDIUM RISK', 'CLOSING', 'EXECUTION', 'INITIATION', 'PLANNING'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">DEPENDÊNCIAS</label>
              <input
                className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold text-sm rounded-lg shadow-sm"
                placeholder="Ex: PIT, Fase inicial, etc..."
                value={dependencies}
                onChange={e => setDependencies(e.target.value)}
              />
            </div>

            <div className="col-span-2 space-y-4 border-t border-gray-100 pt-6">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">ATRIBUIR RESPONSÁVEIS</label>
              <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-100 rounded-xl p-4 max-h-48 overflow-y-auto shadow-inner">
                {participants.map(p => (
                  <div
                    key={p.id}
                    onClick={() => toggleParticipant(p.id)}
                    className={clsx(
                      "flex flex-row items-center justify-between p-2 rounded-lg cursor-pointer transition-all bg-white",
                      assignedTo.includes(p.id) 
                        ? "border border-orange-300 shadow-sm" 
                        : "border border-gray-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {p.photoURL ? (
                        <img src={p.photoURL} className="w-8 h-8 rounded-full border border-gray-200 object-cover" />
                      ) : (
                        <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border border-gray-200", p.isUser ? "bg-white text-gray-600" : "bg-red-50 text-red-600")}>
                          {p.name.charAt(0)}
                        </div>
                      )}
                      <span className={clsx("text-xs font-bold", assignedTo.includes(p.id) ? "text-[#ff7f00]" : "text-gray-600")}>
                        {p.name}
                      </span>
                    </div>
                    <div className={clsx(
                      "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                      assignedTo.includes(p.id) ? "bg-[#ff7f00] border-[#ff7f00]" : "bg-white border-gray-300"
                    )}>
                      {assignedTo.includes(p.id) && <CheckCircle2 className="w-3 h-3 text-white stroke-[3px]" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors rounded-lg"
          >
            CANCELAR
          </button>
          <button
            type="submit"
            form="gantt-func-form"
            className="px-8 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-[#ff7f00] hover:bg-orange-600 transition-colors rounded-lg shadow-lg shadow-orange-100"
          >
            {task?.id ? 'SALVAR ALTERAÇÕES' : 'CRIAR FUNÇÃO'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function StakeholderModal({ projectId, stakeholder, projectMembers, currentStakeholders, onSaveMember, onSaveExternal, onClose }: { projectId: string, stakeholder: ProjectStakeholder | null, projectMembers: UserProfile[], currentStakeholders: ProjectStakeholder[], onSaveMember: (uid: string, name: string, photoURL?: string) => void, onSaveExternal: (data: Partial<ProjectStakeholder>) => void, onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'members' | 'external'>('members');
  const [name, setName] = useState(stakeholder?.name || '');
  const [role, setRole] = useState(stakeholder?.role || '');

  const membersToAdd = projectMembers.filter(m => !currentStakeholders.some(s => s.userId === m.uid));

  const handleSubmitExternal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSaveExternal({ name, role });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white border border-gray-200 w-full max-w-md overflow-hidden rounded-xl shadow-xl flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-200 shadow-sm shrink-0">
          <h2 className="text-xl font-bold uppercase tracking-wider text-gray-900">
            {stakeholder ? 'EDITAR STAKEHOLDER' : 'GERENCIAR MEMBROS'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors pointer-events-auto">
             <X className="w-6 h-6" />
          </button>
        </div>

        {!stakeholder && (
          <div className="flex border-b border-gray-50 flex-shrink-0">
            <button 
              onClick={() => setActiveTab('members')}
              className={clsx(
                "flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2",
                activeTab === 'members' ? "border-[#ff7f00] text-[#ff7f00] bg-orange-50/30" : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              MEMBROS DA EQUIPE
            </button>
            <button 
              onClick={() => setActiveTab('external')}
              className={clsx(
                "flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2",
                activeTab === 'external' ? "border-[#ff7f00] text-[#ff7f00] bg-orange-50/30" : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              STAKEHOLDER EXTERNO
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {stakeholder || activeTab === 'external' ? (
            <form id="external-form" onSubmit={handleSubmitExternal} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">NOME / CARGO</label>
                  <input 
                    type="text" autoFocus required value={name} onChange={(e) => setName(e.target.value)} 
                    className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-lg shadow-sm transition-all" 
                    placeholder="Ex: Diretor Financeiro" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">PAPEL (OPCIONAL)</label>
                  <input 
                    type="text" value={role} onChange={(e) => setRole(e.target.value)} 
                    className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] rounded-lg shadow-sm transition-all" 
                    placeholder="Ex: Patrocinador, Mentor..." 
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button onClick={onClose} type="button" className="flex-1 px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-gray-50 transition-colors">CANCELAR</button>
                <button type="submit" disabled={!name.trim()} className="flex-1 px-6 py-2.5 bg-[#ff7f00] text-white font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-100">
                  SALVAR
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {projectMembers.map(member => (
                  <div 
                    key={member.uid}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden border border-gray-200">
                        {member.photoURL ? <img src={member.photoURL} className="w-full h-full object-cover" /> : member.name.charAt(0)}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-bold text-gray-800 uppercase tracking-tight">{member.name}</span>
                        <span className="text-[10px] text-gray-500">{member.email}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-100 flex justify-end">
                <button onClick={onClose} className="px-6 py-2.5 bg-[#ff7f00] text-white font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-orange-600 transition-all shadow-lg shadow-orange-100">FECHAR</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}


// --- Main Page ---

export default function GanttChart() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<UserProfile[]>([]);
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [stakeholders, setStakeholders] = useState<ProjectStakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isStakeholderModalOpen, setIsStakeholderModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null);
  const [editingStakeholder, setEditingStakeholder] = useState<ProjectStakeholder | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);

  const [isStartDateModalOpen, setIsStartDateModalOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');

  // Responsive state
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Gantt Timeline States
  const [zoom, setZoom] = useState<'day' | 'week' | 'month'>('day');
  const [cellWidth, setCellWidth] = useState(60);
  const [sidebarWidth, setSidebarWidth] = useState(760);
  const timelineContainerRef = React.useRef<HTMLDivElement>(null);
  
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  // 1. Fetch Project Data
  useEffect(() => {
    if (!projectId || !user) return;
    const projectRef = doc(db, 'projects', projectId);
    return onSnapshot(projectRef, (docSnap) => {
      if (docSnap.exists()) {
        setProject({ id: docSnap.id, ...docSnap.data() } as Project);
      }
    });
  }, [projectId, user]);

  // 2. Fetch Members
  useEffect(() => {
    if (!project?.members || project.members.length === 0) return;
    const qMembers = query(
      collection(db, 'users'),
      where(documentId(), 'in', project.members.slice(0, 30))
    );
    return onSnapshot(qMembers, (snapshot) => {
      const membersData: UserProfile[] = [];
      snapshot.forEach((doc) => {
        membersData.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setProjectMembers(membersData);
    });
  }, [project?.members?.join(',')]);

  // 3. Fetch Gantt Tasks
  useEffect(() => {
    if (!projectId) return;
    const qTasks = query(
      collection(db, 'ganttTasks'), 
      where('projectId', '==', projectId)
    );
    return onSnapshot(qTasks, (snapshot) => {
      const taskData: GanttTask[] = [];
      snapshot.forEach((doc) => {
        taskData.push({ id: doc.id, ...doc.data() } as GanttTask);
      });
      setTasks(taskData.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ganttTasks');
      setLoading(false);
    });
  }, [projectId]);

  // 4. Fetch Project Stakeholders (Unified & Legacy RACI)
  useEffect(() => {
    if (!projectId) return;
    
    const qProjectSH = query(
      collection(db, 'projectStakeholders'),
      where('projectId', '==', projectId)
    );
    const unsubProjectSH = onSnapshot(qProjectSH, (snapshot) => {
      const shData: ProjectStakeholder[] = [];
      snapshot.forEach((doc) => {
        shData.push({ id: doc.id, ...doc.data() } as ProjectStakeholder);
      });
      setStakeholders(prev => {
        // Merge with existing but prefer ProjectStakeholder
        const otherSH = prev.filter(p => !shData.some(s => s.id === p.id));
        return [...shData, ...otherSH];
      });
    });

    const qRaciSH = query(
      collection(db, 'raciStakeholders'),
      where('projectId', '==', projectId)
    );
    const unsubRaciSH = onSnapshot(qRaciSH, (snapshot) => {
      snapshot.forEach((doc) => {
        const data = doc.data();
        const sh: ProjectStakeholder = {
          id: doc.id,
          projectId: data.projectId,
          name: data.name,
          role: data.role,
          userId: data.userId,
          createdAt: data.createdAt
        };
        setStakeholders(prev => {
          if (prev.some(s => s.id === sh.id)) return prev;
          return [...prev, sh];
        });
      });
    });

    return () => {
      unsubProjectSH();
      unsubRaciSH();
    };
  }, [projectId]);

  const participants = useMemo(() => {
    const list = [
      ...projectMembers.map(m => ({ id: m.uid, name: m.name, photoURL: m.photoURL, isUser: true })),
      ...stakeholders.map(s => ({ id: s.id, name: s.name, photoURL: s.photoURL, isUser: false }))
    ];
    return list;
  }, [projectMembers, stakeholders]);

  const handleTaskSave = async (taskData: Partial<GanttTask>) => {
    if (!projectId) return;
    try {
      if (editingTask?.id) {
        await updateDoc(doc(db, 'ganttTasks', editingTask.id), {
          ...taskData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'ganttTasks'), {
          ...taskData,
          projectId,
          order: tasks.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      handleFirestoreError(error, editingTask?.id ? OperationType.UPDATE : OperationType.CREATE, 'ganttTasks');
    }
  };

  const handleStakeholderSave = async (shData: Partial<ProjectStakeholder>) => {
    if (!projectId) return;
    try {
      if (editingStakeholder?.id) {
        await updateDoc(doc(db, 'projectStakeholders', editingStakeholder.id), shData);
      } else {
        await addDoc(collection(db, 'projectStakeholders'), {
          ...shData,
          projectId,
          createdAt: serverTimestamp()
        });
      }
      setIsStakeholderModalOpen(false);
      setEditingStakeholder(null);
    } catch (error) {
      handleFirestoreError(error, editingStakeholder?.id ? OperationType.UPDATE : OperationType.CREATE, 'projectStakeholders');
    }
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    try {
      await deleteDoc(doc(db, 'ganttTasks', taskToDelete));
      setTaskToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'ganttTasks');
    }
  };

  useEffect(() => {
    if (loading) return;
    const el = timelineContainerRef.current;
    if (!el) return;
    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.altKey) {
        e.preventDefault();
        setCellWidth(prev => Math.max(20, Math.min(200, prev - (e.deltaY > 0 ? 15 : -15))));
      } else if (!e.shiftKey && Math.abs(e.deltaY) > 0) {
        // Fallback for "only scroll" as requested, preventing vertical jump
        e.preventDefault();
        setCellWidth(prev => Math.max(20, Math.min(200, prev - (e.deltaY > 0 ? 15 : -15))));
      }
    };
    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleNativeWheel);
  }, [loading]);

  const handleSaveStartDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !customStartDate) return;
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        ganttStartDate: new Date(customStartDate)
      });
      setIsStartDateModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'projects');
    }
  };

  const timelineDays = 30; // Initial view range
  const startDateBase = useMemo(() => {
    if (project?.ganttStartDate && project.ganttStartDate.seconds) {
      return new Date(project.ganttStartDate.seconds * 1000);
    }
    if (tasks.length === 0) return new Date();
    const dates = tasks.map(t => new Date(t.startDate.seconds * 1000).getTime());
    return new Date(Math.min(...dates));
  }, [tasks, project?.ganttStartDate]);

  const getTimelineDates = () => {
    const dates = [];
    const base = new Date(startDateBase);
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < timelineDays; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const timelineDates = getTimelineDates();

  type GanttRow = { type: 'section'; id: string; name: string } | { type: 'task'; id: string; task: GanttTask };

  const rows: GanttRow[] = useMemo(() => {
    const grouped = tasks.reduce((acc, t) => {
      const s = (t.section?.trim() || '').toUpperCase();
      if (!acc[s]) acc[s] = [];
      acc[s].push(t);
      return acc;
    }, {} as Record<string, GanttTask[]>);
    
    const sectionNames = Object.keys(grouped).sort((a,b) => {
      if (a === '') return 1;
      if (b === '') return -1;
      return a.localeCompare(b);
    });
    
    const res: GanttRow[] = [];
    for (const s of sectionNames) {
      if (s !== '') res.push({ type: 'section', id: `sec-${s}`, name: s });
      for (const t of grouped[s]) {
        res.push({ type: 'task', id: `task-${t.id}`, task: t });
      }
    }
    return res;
  }, [tasks]);

  const getTaskGridPosition = (task: GanttTask) => {
    const start = new Date(task.startDate.seconds * 1000);
    const end = new Date(task.endDate.seconds * 1000);
    
    start.setHours(0,0,0,0);
    end.setHours(0,0,0,0);

    const diffStart = Math.ceil((start.getTime() - startDateBase.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      startColumn: diffStart + 1,
      span: duration
    };
  };

  if (loading) {
    return (
      <div className="flex bg-[#f8f9fa] min-h-screen">
        <Sidebar projectId={projectId} projectName={project?.name} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-[#ff7f00] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-[#f8f9fa] min-h-screen font-sans selection:bg-orange-100 selection:text-[#ff7f00]">
      <Sidebar projectId={projectId} projectName={project?.name} onOpenSettings={() => setIsSettingsOpen(true)} />

      <MobileToolsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        projectId={projectId!}
        projectName={project?.name}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] lg:h-screen overflow-hidden pb-[70px] lg:pb-0">
        <MobileHeader
          projectName={project?.name}
          projectPhotoURL={project?.photoURL || undefined}
          onOpenDrawer={() => setIsDrawerOpen(true)}
        />

        <header className="hidden lg:flex border-b border-gray-200 bg-white p-4 items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
              {project?.photoURL ? (
                <img src={project.photoURL} alt={project.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">🏎️</span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-wider uppercase leading-tight text-gray-900">
                {project?.name || 'Carregando...'} {project?.shortId && `- #${project.shortId}`}
              </h2>
            </div>

            <div className="flex items-center ml-4">
              <div className="flex -space-x-2 mr-3">
                {projectMembers.map((member) => (
                  <div key={member.uid} className="relative inline-block" title={member?.name}>
                    {member?.photoURL ? (
                      <img src={member.photoURL} alt={member.name} className="w-8 h-8 rounded-full border-2 border-white object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 uppercase">
                        {member?.name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 border border-gray-200 rounded-md">
                {project?.members.length || 0} {project?.members.length === 1 ? 'MEMBRO' : 'MEMBROS'}
              </span>
            </div>
          </div>
        </header>

        {/* --- Subheader --- */}
        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-30 min-h-[68px]">
          <div className="flex items-center gap-2 sm:gap-6 overflow-x-auto no-scrollbar flex-1 mr-2">
            <div className="hidden sm:flex items-center gap-2">
              <BarChart className="w-5 h-5 text-[#ff7f00]" />
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-widest">
                GANTT
              </h2>
            </div>

            <button 
              onClick={() => { setCustomStartDate(project?.ganttStartDate ? new Date(project.ganttStartDate.seconds*1000).toISOString().split('T')[0] : ''); setIsStartDateModalOpen(true); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:border-[#ff7f00] hover:text-[#ff7f00] text-gray-500 transition-colors group whitespace-nowrap"
              title="Editar Início do Projeto"
            >
               <CalendarIcon className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#ff7f00]" />
               <span className="text-[9px] font-bold uppercase tracking-widest">Início: {startDateBase.toLocaleDateString('pt-BR')}</span>
               <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
            </button>

            <div className="hidden sm:flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Zoom</span>
               <input 
                 type="range" min="20" max="200" step="5" 
                 value={cellWidth} onChange={e => setCellWidth(Number(e.target.value))} 
                 className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#ff7f00]" 
               />
            </div>
          </div>

          <div className="hidden sm:flex gap-3">
             <button 
               onClick={() => setIsStakeholderModalOpen(true)}
               className="bg-white text-gray-700 border border-gray-300 px-3 py-1.5 flex items-center gap-2 transition-all font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-gray-50 active:scale-95"
             >
               <Users className="w-3.5 h-3.5" />
               MEMBROS / STAKEHOLDERS
             </button>
             <button 
               onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
               className="bg-[#ff7f00] hover:bg-orange-600 text-white px-3 py-1.5 flex items-center gap-2 transition-all font-bold uppercase tracking-widest text-[10px] rounded-lg active:scale-95 shadow-md shadow-orange-100"
             >
               <Plus className="w-3.5 h-3.5" />
               NOVA FUNÇÃO
             </button>
          </div>

          <div className="flex sm:hidden">
            <button 
              onClick={() => setShowMobileActions(true)}
              className="w-10 h-10 bg-[#ff7f00] text-white flex items-center justify-center rounded-xl active:scale-95 transition-all"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* --- Gantt Body --- */}
        <div className={clsx("flex-1 custom-scrollbar relative", isDesktop ? "flex overflow-hidden" : "overflow-auto bg-gray-50/10")}>
          <div className={clsx("relative", isDesktop ? "contents" : "flex min-w-max min-h-full")}>
            
            {/* List Sidebar */}
            <div 
              className={clsx("flex flex-col bg-white shrink-0 border-r border-gray-200", isDesktop ? "shadow-sm z-10 overflow-hidden relative" : "z-40 sticky left-0 shadow-[4px_0_12px_rgba(0,0,0,0.02)]")}
              style={{ width: sidebarWidth, minWidth: 400, maxWidth: 1200 }}
            >
              <div className={clsx("flex flex-col h-full", isDesktop ? "min-w-[750px] overflow-hidden" : "w-full")}>
                <div className={clsx("grid grid-cols-[minmax(0,1fr)_100px_100px_90px_60px_70px_70px_60px] bg-white border-b border-gray-200 uppercase text-[10px] font-bold text-gray-400 tracking-widest shrink-0", isDesktop ? "" : "sticky top-0 z-30 h-[49px]")}>
                  <div className="p-3 border-r border-gray-100 flex items-center">Função / Descrição</div>
                  <div className="p-3 border-r border-gray-100 flex items-center">Categoria</div>
                  <div className="p-3 border-r border-gray-100 flex items-center">Dependências</div>
                  <div className="p-3 border-r border-gray-100 flex items-center justify-center">Resp.</div>
                  <div className="p-3 border-r border-gray-100 flex items-center justify-center">Status</div>
                  <div className="p-3 border-r border-gray-100 flex items-center justify-center">Início</div>
                  <div className="p-3 border-r border-gray-100 flex items-center justify-center">Fim</div>
                  <div className="p-3 flex items-center justify-center">Prog.</div>
                </div>
                
                <div className={clsx("bg-white", isDesktop ? "flex-1 overflow-x-auto overflow-y-auto custom-scrollbar" : "flex flex-col w-full")}>
                  {rows.length > 0 ? (
                    rows.map(row => {
                      if (row.type === 'section') {
                        return (
                          <div key={row.id} className="w-full h-[60px] border-b border-gray-300 bg-gray-200 flex items-center px-4 group shrink-0">
                            <span className="text-[11px] font-black uppercase text-gray-800 tracking-widest">{row.name}</span>
                          </div>
                        );
                      }
                      const task = row.task;
                      return (
                        <div key={task.id} className="grid grid-cols-[minmax(0,1fr)_100px_100px_90px_60px_70px_70px_60px] w-full border-b border-gray-100 group hover:bg-gray-50/50 transition-colors h-[60px] relative bg-white shrink-0">
                          <div className="px-3 py-2 border-r border-gray-100 overflow-hidden flex flex-col justify-center relative">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-800 uppercase truncate pr-16">{task.title}</span>
                              <div className="flex bg-white/80 rounded px-1 absolute right-2 top-1/2 -translate-y-1/2 shadow-sm border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }} className="p-1.5 hover:text-[#ff7f00] text-gray-400 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => setTaskToDelete(task.id)} className="p-1.5 hover:text-red-600 text-gray-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          </div>

                          <div className="p-2 border-r border-gray-100 flex items-center overflow-hidden">
                            <span className="text-[9px] font-bold text-gray-500 uppercase truncate">{task.category || '-'}</span>
                          </div>

                          <div className="p-2 border-r border-gray-100 flex items-center overflow-hidden">
                            <span className="text-[9px] font-bold text-gray-500 uppercase truncate" title={(task.dependencies as unknown as string) || ''}>{(task.dependencies as unknown as string) || '-'}</span>
                          </div>

                          <div className="p-2 border-r border-gray-100 flex items-center justify-center overflow-hidden">
                            <div className="flex -space-x-1 items-center">
                              {task.assignedTo?.slice(0, 3).map(id => {
                                const p = participants.find(part => part.id === id);
                                if (!p) return null;
                                return p.photoURL ? (
                                  <img key={id} src={p.photoURL} className="w-4 h-4 rounded-full border border-white" title={p.name} />
                                ) : (
                                  <div key={id} className="w-4 h-4 rounded-full border border-white flex items-center justify-center text-[7px] font-bold bg-gray-100 text-gray-600" title={p.name}>{p.name.charAt(0)}</div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="p-2 border-r border-gray-100 flex items-center justify-center overflow-hidden">
                            <span className={clsx(
                              "text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider whitespace-nowrap",
                              task.status === 'completed' ? "bg-emerald-50 text-emerald-600" :
                              task.status === 'in_progress' ? "bg-orange-50 text-[#ff7f00]" :
                              task.status === 'delayed' ? "bg-red-50 text-red-600" :
                              "bg-gray-100 text-gray-500"
                            )}>
                              {task.status === 'completed' ? 'FTO' :
                               task.status === 'in_progress' ? 'AND' :
                               task.status === 'delayed' ? 'ATR' : 'PDT'}
                            </span>
                          </div>

                          <div className="p-2 border-r border-gray-100 flex items-center justify-center overflow-hidden">
                            <span className="text-[9px] font-bold text-gray-600 whitespace-nowrap">
                              {new Date(task.startDate.seconds * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          </div>
                          
                          <div className="p-2 border-r border-gray-100 flex items-center justify-center overflow-hidden">
                            <span className="text-[9px] font-bold text-gray-600 whitespace-nowrap">
                              {new Date(task.endDate.seconds * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          </div>

                          <div className="p-2 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-700">{task.progress}%</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-20 text-center flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
                        <BarChart className="w-8 h-8 text-gray-200" />
                      </div>
                      <div className="space-y-1 px-8 text-center max-w-sm">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">O cronograma está vazio.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Drag Resizer */}
            {isDesktop && (
              <div 
                 className="w-[3px] hover:w-1.5 bg-gray-200 hover:bg-[#ff7f00] z-20 shrink-0 transition-all cursor-col-resize active:bg-[#ff7f00]"
                 onMouseDown={(e) => {
                   const startX = e.clientX;
                   const startWidth = sidebarWidth;
                   
                   const handleMouseMove = (moveEvent: MouseEvent) => {
                     document.body.style.cursor = 'col-resize';
                     setSidebarWidth(Math.max(400, Math.min(1200, startWidth + (moveEvent.clientX - startX))));
                   };
                   
                   const handleMouseUp = () => {
                     document.body.style.cursor = 'default';
                     document.removeEventListener('mousemove', handleMouseMove);
                     document.removeEventListener('mouseup', handleMouseUp);
                   };
                   
                   document.addEventListener('mousemove', handleMouseMove);
                   document.addEventListener('mouseup', handleMouseUp);
                 }}
              />
            )}

            {/* Timeline View */}
            <div 
              ref={timelineContainerRef}
              className={clsx("relative", isDesktop ? "flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-gray-50/20" : "flex flex-col")}
              style={isDesktop ? {} : { width: `${timelineDates.length * cellWidth}px` }}
            >
              <div 
                className={clsx(isDesktop ? "min-w-max h-full flex flex-col" : "flex flex-col relative h-full")}
                style={isDesktop ? { width: `${timelineDates.length * cellWidth}px` } : {}}
              >
                {/* Timeline Header (Dates) */}
                <div className={clsx("h-[49px] flex bg-white border-b border-gray-200 shrink-0", isDesktop ? "" : "sticky top-0 z-30")}>
                  {timelineDates.map((date, idx) => (
                    <div 
                      key={idx} 
                      className={clsx(
                        "flex flex-col items-center justify-center border-r border-gray-100 text-[9px] group transition-colors",
                        [0, 6].includes(date.getDay()) ? "bg-gray-50/50" : "hover:bg-orange-50/30"
                      )}
                      style={{ width: `${cellWidth}px` }}
                    >
                      <span className="font-bold text-gray-300 uppercase group-hover:text-[#ff7f00] transition-colors">
                        {date.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}
                      </span>
                      <span className="font-bold text-gray-900 group-hover:text-[#ff7f00] transition-colors">{date.getDate()}</span>
                    </div>
                  ))}
                </div>

                {/* Chart Grid Lines & Task Bars */}
                <div className={clsx("relative", isDesktop ? "flex-1 overflow-y-auto custom-scrollbar" : "flex-1 flex flex-col")}>
                  {/* Background Grid */}
                  <div className="absolute inset-0 flex pointer-events-none z-0">
                    {timelineDates.map((date, idx) => (
                      <div 
                        key={idx} 
                        className={clsx(
                          "h-full border-r border-gray-100/50 transition-colors",
                          [0, 6].includes(date.getDay()) ? "bg-gray-100/10" : ""
                        )}
                        style={{ width: `${cellWidth}px` }}
                      />
                    ))}
                  </div>

                  {/* Task Bars container */}
                  <div className="relative pt-0 flex flex-col z-10">
                    {rows.map(row => {
                      if (row.type === 'section') {
                        return (
                          <div key={row.id} className="h-[60px] border-b border-gray-200/50 bg-gray-100/30 w-full shrink-0 pointer-events-none" />
                        );
                      }
                      const task = row.task;
                      const pos = getTaskGridPosition(task);
                      return (
                        <div 
                          key={row.id} 
                          className="h-[60px] border-b border-gray-100/30 relative group transition-colors hover:bg-gray-50/10 shrink-0"
                        >
                           <motion.div
                             initial={{ opacity: 0, x: -20 }}
                             animate={{ opacity: 1, x: 0 }}
                             className={clsx(
                               "absolute top-1/2 -translate-y-1/2 h-[34px] rounded-md shadow-sm border overflow-hidden flex flex-col justify-end transition-all cursor-pointer",
                               task.status === 'completed' ? "bg-emerald-500 border-emerald-400" :
                               task.status === 'delayed' ? "bg-red-500 border-red-400" :
                               task.status === 'in_progress' ? "bg-[#ff7f00] border-orange-400" :
                               "bg-gray-200 border-gray-300 text-gray-500"
                             )}
                             style={{
                               left: `${(pos.startColumn - 1) * cellWidth + 8}px`,
                               width: `${pos.span * cellWidth - 16}px`
                             }}
                             onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                           >
                              {/* Progress Overlay */}
                              <div 
                                 className="absolute inset-0 bg-black/20 origin-left transition-transform duration-500 pointer-events-none" 
                                 style={{ transform: `scaleX(${task.progress / 100})` }}
                              />
                              {/* Task Label on Bar if space allows */}
                              <div className="relative h-full flex items-center px-4 overflow-hidden pointer-events-none">
                                 <span className={clsx("text-[10px] font-bold uppercase tracking-widest truncate", task.status === 'pending' ? 'text-gray-700' : 'text-white')}>{task.title}</span>
                              </div>
                           </motion.div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* --- Modals --- */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <GanttTaskModal 
            task={editingTask} 
            participants={participants}
            allTasks={tasks}
            onSave={handleTaskSave} 
            onClose={() => { setIsTaskModalOpen(false); setEditingTask(null); }} 
          />
        )}
        {isStakeholderModalOpen && (
          <StakeholderModal 
            projectId={projectId!}
            stakeholder={editingStakeholder}
            projectMembers={projectMembers}
            currentStakeholders={stakeholders}
            onSaveMember={async (uid, name) => {
               try {
                 await addDoc(collection(db, 'projectStakeholders'), {
                   projectId, name, userId: uid, createdAt: serverTimestamp()
                 });
               } catch (error) {
                 handleFirestoreError(error, OperationType.CREATE, 'projectStakeholders');
               }
            }}
            onSaveExternal={handleStakeholderSave}
            onClose={() => { setIsStakeholderModalOpen(false); setEditingStakeholder(null); }}
          />
        )}
        {isSettingsOpen && project && (
          <ProjectSettingsModal 
            project={project} 
            onClose={() => setIsSettingsOpen(false)} 
          />
        )}
        {isStartDateModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white border border-gray-200 w-full max-w-sm overflow-hidden rounded-xl shadow-xl flex flex-col">
              <div className="flex justify-between items-center p-6 border-b border-gray-200 shadow-sm shrink-0">
                <h2 className="text-xl font-bold uppercase tracking-wider text-gray-900">INÍCIO DA TIMELINE</h2>
                <button onClick={() => setIsStartDateModalOpen(false)} className="text-gray-400 hover:text-gray-900"><X className="w-6 h-6" /></button>
              </div>
              <div className="p-6">
                <form id="start-date-form" onSubmit={handleSaveStartDate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">DATA REFERÊNCIA INICIAL</label>
                    <input type="date" required className="w-full bg-white border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold text-sm rounded-lg shadow-sm" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setIsStartDateModalOpen(false)} className="flex-1 px-4 py-2.5 text-xs font-bold uppercase text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg">CANCELAR</button>
                    <button type="submit" className="flex-1 px-4 py-2.5 text-xs font-bold uppercase text-white bg-[#ff7f00] hover:bg-orange-600 rounded-lg">SALVAR</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
        {taskToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white border border-gray-200 w-full max-w-sm overflow-hidden rounded-xl shadow-xl flex flex-col">
               <div className="flex justify-between items-center p-6 border-b border-gray-200 shadow-sm shrink-0">
                  <h2 className="text-xl font-bold uppercase tracking-wider text-red-600">EXCLUIR FUNÇÃO</h2>
                  <button onClick={() => setTaskToDelete(null)} className="text-gray-400 hover:text-gray-900"><X className="w-6 h-6" /></button>
               </div>
               <div className="p-6">
                  <p className="text-sm text-gray-600 font-medium mb-6">Tem certeza que deseja excluir esta função? Esta ação não poderá ser desfeita e todas as informações serão perdidas.</p>
                  <div className="flex gap-3">
                     <button onClick={() => setTaskToDelete(null)} className="flex-1 px-4 py-2.5 text-xs font-bold uppercase text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg">CANCELAR</button>
                     <button onClick={confirmDeleteTask} className="flex-1 px-4 py-2.5 text-xs font-bold uppercase text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-lg">EXCLUIR</button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MobileBottomNav onOpenProfile={() => setIsProfileOpen(true)} />

      <AnimatePresence>
        {isProfileOpen && (
          <UserProfileModal onClose={() => setIsProfileOpen(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMobileActions && (
          <div className="fixed inset-0 z-[70] flex items-end sm:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileActions(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full bg-white rounded-t-3xl p-6 border-t border-gray-200"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
              <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest mb-6 px-2">Ações Rápidas</h3>
              
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => { setShowMobileActions(false); setEditingTask(null); setIsTaskModalOpen(true); }}
                  className="w-full flex items-center gap-4 p-4 bg-orange-50 text-[#ff7f00] rounded-2xl border border-orange-100 font-bold uppercase tracking-widest text-xs active:scale-[0.98] transition-all"
                >
                  <div className="w-10 h-10 bg-[#ff7f00] text-white flex items-center justify-center rounded-xl">
                    <Plus className="w-6 h-6" />
                  </div>
                  Nova Função / Tarefa
                </button>

                <button 
                  onClick={() => { setShowMobileActions(false); setIsStakeholderModalOpen(true); }}
                  className="w-full flex items-center gap-4 p-4 bg-gray-50 text-gray-700 rounded-2xl border border-gray-100 font-bold uppercase tracking-widest text-xs active:scale-[0.98] transition-all"
                >
                  <div className="w-10 h-10 bg-white text-gray-400 border border-gray-200 flex items-center justify-center rounded-xl">
                    <Users className="w-6 h-6" />
                  </div>
                  Membros & Stakeholders
                </button>
              </div>

              <button 
                onClick={() => setShowMobileActions(false)}
                className="w-full mt-6 p-4 bg-white text-gray-400 font-bold uppercase tracking-widest text-xs rounded-2xl border border-gray-100 active:scale-[0.98] transition-all"
              >
                Cancelar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
