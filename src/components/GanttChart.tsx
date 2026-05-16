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
  Layout,
  Printer,
  Upload,
  FileJson,
  ChevronDown
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { motion, AnimatePresence } from 'motion/react';
import ProjectSettingsModal from './ProjectSettingsModal';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
// @ts-ignore
import logoIbit from '../media/ibitlogo.svg';

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
  const [isExporting, setIsExporting] = useState(false);
  const [isJSONMenuOpen, setIsJSONMenuOpen] = useState(false);
  const [mobileJSONOpen, setMobileJSONOpen] = useState(false);

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
  const timelineHeaderRef = React.useRef<HTMLDivElement>(null);
  const timelineBodyRef = React.useRef<HTMLDivElement>(null);

  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // --- JSON Export/Import Handlers ---
  const handleExportJSON = () => {
    try {
      const exportData = {
        projectName: project?.name || 'Projeto',
        projectId,
        exportDate: new Date().toISOString(),
        type: 'ibit-gantt',
        tasks: tasks.map(t => ({
          ...t,
          startDate: t.startDate?.seconds ? new Date(t.startDate.seconds * 1000).toISOString() : t.startDate,
          endDate: t.endDate?.seconds ? new Date(t.endDate.seconds * 1000).toISOString() : t.endDate,
          createdAt: t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toISOString() : t.createdAt,
          updatedAt: t.updatedAt?.seconds ? new Date(t.updatedAt.seconds * 1000).toISOString() : t.updatedAt,
        }))
      };
      const dataStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gantt-${project?.name.replace(/\s+/g, '-') || 'projeto'}-${new Date().toISOString().substring(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Gantt Export] Error:', err);
    }
  };

  const importInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportJSON = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !projectId || !user) return;
    
    const confirmImport = window.confirm('Deseja importar as tarefas deste JSON? Elas serão adicionadas ao projeto atual.');
    if (!confirmImport) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      
      if (parsed.type !== 'ibit-gantt' || !Array.isArray(parsed.tasks)) {
        throw new Error('Arquivo JSON inválido para Gantt');
      }

      // Add each task to Firestore
      for (const taskData of parsed.tasks) {
        const { id, ...cleanTask } = taskData;
        
        await addDoc(collection(db, 'ganttTasks'), {
          ...cleanTask,
          projectId,
          startDate: cleanTask.startDate ? new Date(cleanTask.startDate) : null,
          endDate: cleanTask.endDate ? new Date(cleanTask.endDate) : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
      alert('Gantt importado com sucesso!');
    } catch (error) {
      console.error('Error importing JSON:', error);
      alert('Erro ao importar arquivo. Verifique se é um arquivo JSON de Gantt válido exportado pelo IBIT.');
    }
  };

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

  const { startDateBase, totalDays } = useMemo(() => {
    let start = new Date();
    if (project?.ganttStartDate && project.ganttStartDate.seconds) {
      const d = new Date(project.ganttStartDate.seconds * 1000);
      start = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
    } else if (tasks.length > 0) {
      const dates = tasks.map(t => {
        const d = new Date(t.startDate.seconds * 1000);
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
      });
      start = new Date(Math.min(...dates));
      start.setHours(12, 0, 0, 0);
    }
    start.setHours(12, 0, 0, 0);

    let end = new Date(start);
    end.setDate(start.getDate() + 30); // Default minimum 30 days
    
    if (tasks.length > 0) {
      const dates = tasks.map(t => {
        const d = new Date(t.endDate.seconds * 1000);
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
      });
      const maxTaskEnd = new Date(Math.max(...dates));
      maxTaskEnd.setHours(12, 0, 0, 0);
      if (maxTaskEnd > end) {
        end = new Date(maxTaskEnd);
      }
    }
    // Buffer reduced to 2 days as requested
    end.setDate(end.getDate() + 2);
    end.setHours(12, 0, 0, 0);
    
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return { startDateBase: start, totalDays: diff };
  }, [tasks, project?.ganttStartDate]);

  const timelineDates = useMemo(() => {
    const dates = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDateBase);
      d.setDate(startDateBase.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [startDateBase, totalDays]);

  const monthGroups = useMemo(() => {
    const groups: { month: string; year: number; days: number }[] = [];
    timelineDates.forEach(date => {
      const month = date.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
      const year = date.getFullYear();
      const last = groups[groups.length - 1];
      if (last && last.month === month && last.year === year) {
        last.days++;
      } else {
        groups.push({ month, year, days: 1 });
      }
    });
    return groups;
  }, [timelineDates]);

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
    const dS = new Date(task.startDate.seconds * 1000);
    const dE = new Date(task.endDate.seconds * 1000);
    
    const start = new Date(dS.getUTCFullYear(), dS.getUTCMonth(), dS.getUTCDate(), 12, 0, 0);
    const end = new Date(dE.getUTCFullYear(), dE.getUTCMonth(), dE.getUTCDate(), 12, 0, 0);
    
    const diffStart = Math.round((start.getTime() - startDateBase.getTime()) / (1000 * 60 * 60 * 24));
    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    return {
      startColumn: diffStart + 1,
      span: duration
    };
  };

  // --- PDF Export Handler ---
  const handleExportPDF = async () => {
    if (isExporting || tasks.length === 0) return;
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 100));

    try {
      const allStarts = tasks.map(t => {
        const d = new Date(t.startDate.seconds * 1000);
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
      });
      const allEnds = tasks.map(t => {
        const d = new Date(t.endDate.seconds * 1000);
        return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
      });
      const minDate = new Date(Math.min(...allStarts.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...allEnds.map(d => d.getTime())));
      minDate.setHours(12, 0, 0, 0);
      maxDate.setHours(12, 0, 0, 0);
      
      // Buffer of 1 day before and 2 days after
      minDate.setDate(minDate.getDate() - 1);
      maxDate.setDate(maxDate.getDate() + 2);
      const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / 86400000);
      const dayDates: Date[] = [];
      for (let i = 0; i < totalDays; i++) { const d = new Date(minDate); d.setDate(minDate.getDate() + i); dayDates.push(d); }

      const ROW_H = 32;
      const LEFT_W = 1000;
      const cellW = Math.max(16, Math.min(32, Math.floor(2500 / totalDays)));
      const TIMELINE_W = totalDays * cellW;
      const TOTAL_W = LEFT_W + TIMELINE_W + 96;
      const sBg: Record<string, string> = { pending: '#e5e7eb', in_progress: '#e5e7eb', completed: '#e5e7eb', delayed: '#e5e7eb' };
      const sFg: Record<string, string> = { pending: '#6b7280', in_progress: '#6b7280', completed: '#6b7280', delayed: '#6b7280' };
      const MN = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];

      const container = document.createElement('div');
      container.style.cssText = `position:fixed;left:0;top:0;background:#fff;padding:40px;font-family:system-ui,-apple-system,sans-serif;width:${TOTAL_W}px;box-sizing:border-box;z-index:50;overflow:visible;`;
      document.body.appendChild(container);
      container.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #ff7f00;"><div><div style="font-size:24px;font-weight:800;color:#111;text-transform:uppercase;letter-spacing:0.1em;">${project?.name || 'Projeto'}</div><div style="font-size:12px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;margin-top:4px;">Gráfico de Gantt</div></div></div>`;

      const body = document.createElement('div');
      body.style.cssText = 'display:flex;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;';

      // LEFT PANEL
      const left = document.createElement('div');
      left.style.cssText = `width:${LEFT_W}px;flex-shrink:0;border-right:2px solid #e5e7eb;`;
      left.innerHTML = `<div style="display:grid;grid-template-columns:40px 1fr 120px 160px 140px 100px 100px 70px;height:${ROW_H*2}px;background:#f9fafb;border-bottom:2px solid #e5e7eb;"><div style="padding:4px;display:flex;align-items:center;justify-content:center;border-right:1px solid #e5e7eb;font-size:8px;font-weight:800;color:#9ca3af;">#</div><div style="padding:4px 8px;display:flex;align-items:center;border-right:1px solid #e5e7eb;font-size:8px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;">FUNÇÃO</div><div style="padding:4px;display:flex;align-items:center;justify-content:center;border-right:1px solid #e5e7eb;font-size:7px;font-weight:800;color:#9ca3af;">CATEGORIA</div><div style="padding:4px;display:flex;align-items:center;justify-content:center;border-right:1px solid #e5e7eb;font-size:7px;font-weight:800;color:#9ca3af;">DEPENDÊNCIAS</div><div style="padding:4px;display:flex;align-items:center;justify-content:center;border-right:1px solid #e5e7eb;font-size:7px;font-weight:800;color:#9ca3af;">RESPONSÁVEIS</div><div style="padding:4px;display:flex;align-items:center;justify-content:center;border-right:1px solid #e5e7eb;font-size:7px;font-weight:800;color:#9ca3af;">INÍCIO</div><div style="padding:4px;display:flex;align-items:center;justify-content:center;border-right:1px solid #e5e7eb;font-size:7px;font-weight:800;color:#9ca3af;">FIM</div><div style="padding:4px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#9ca3af;">PROG</div></div>`;

      let tIdx = 0;
      rows.forEach(row => {
        if (row.type === 'section') {
          const s = document.createElement('div');
          s.style.cssText = `height:${ROW_H}px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;padding:0 8px;`;
          s.innerHTML = `<span style="font-size:9px;font-weight:900;color:#374151;text-transform:uppercase;letter-spacing:0.1em;">▸ ${row.name}</span>`;
          left.appendChild(s); return;
        }
        tIdx++;
        const t = row.task;
        const bg = tIdx % 2 === 0 ? '#fafafa' : '#fff';
        const pc = t.progress >= 100 ? '#10b981' : t.progress > 0 ? '#ff7f00' : '#9ca3af';
        const dS_row = new Date(t.startDate.seconds * 1000);
        const startStr = new Date(dS_row.getUTCFullYear(), dS_row.getUTCMonth(), dS_row.getUTCDate()).toLocaleDateString('pt-BR');
        const dE_row = new Date(t.endDate.seconds * 1000);
        const endStr = new Date(dE_row.getUTCFullYear(), dE_row.getUTCMonth(), dE_row.getUTCDate()).toLocaleDateString('pt-BR');
        const respNames = (t.assignedTo || []).map(uid => {
          const p = participants.find(part => part.id === uid);
          return p ? p.name.split(' ')[0] : '?';
        }).join(', ');
        const r = document.createElement('div');
        r.style.cssText = `display:grid;grid-template-columns:40px 1fr 120px 160px 140px 100px 100px 70px;height:${ROW_H}px;background:${bg};border-bottom:1px solid #f3f4f6;`;
        r.innerHTML = `<div style="padding:2px 4px;display:flex;align-items:center;justify-content:center;border-right:1px solid #f0f0f0;font-size:8px;font-weight:700;color:#bbb;">${tIdx}</div><div style="padding:2px 8px;display:flex;align-items:center;border-right:1px solid #f0f0f0;font-size:9px;font-weight:700;color:#111;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${t.title}</div><div style="padding:2px 4px;display:flex;align-items:center;justify-content:center;border-right:1px solid #f0f0f0;font-size:7px;font-weight:700;color:#6b7280;text-transform:uppercase;">${t.category||'-'}</div><div style="padding:2px 4px;display:flex;align-items:center;justify-content:center;border-right:1px solid #f0f0f0;font-size:8px;font-weight:700;color:#6b7280;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${t.dependencies||'-'}</div><div style="padding:2px 4px;display:flex;align-items:center;justify-content:center;border-right:1px solid #f0f0f0;font-size:8px;font-weight:700;color:#6b7280;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;" title="${respNames}">${respNames||'-'}</div><div style="padding:2px 4px;display:flex;align-items:center;justify-content:center;border-right:1px solid #f0f0f0;font-size:8px;font-weight:700;color:#6b7280;">${startStr}</div><div style="padding:2px 4px;display:flex;align-items:center;justify-content:center;border-right:1px solid #f0f0f0;font-size:8px;font-weight:700;color:#6b7280;">${endStr}</div><div style="padding:2px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:${pc};">${t.progress}%</div>`;
        left.appendChild(r);
      });

      // RIGHT PANEL (Timeline)
      const right = document.createElement('div');
      right.style.cssText = `flex:1;overflow:visible;min-width:${TIMELINE_W}px;`;

      // Month row
      const mRow = document.createElement('div');
      mRow.style.cssText = `display:flex;height:${ROW_H}px;background:#f9fafb;border-bottom:1px solid #e5e7eb;`;
      let cM = -1, mS = 0, mSp = 0;
      const mCells: {m:number;y:number;s:number}[] = [];
      dayDates.forEach((d, i) => { const m = d.getMonth(); if (m !== cM) { if (cM !== -1) mCells.push({m:cM,y:dayDates[mS].getFullYear(),s:mSp}); cM=m; mSp=1; mS=i; } else { mSp++; } });
      if (mSp > 0) mCells.push({m:cM,y:dayDates[mS].getFullYear(),s:mSp});
      mCells.forEach(mc => { const c = document.createElement('div'); c.style.cssText = `width:${mc.s*cellW}px;display:flex;align-items:center;justify-content:center;border-right:1px solid #e5e7eb;font-size:8px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:0.1em;`; c.textContent = `${MN[mc.m]} ${mc.y}`; mRow.appendChild(c); });
      right.appendChild(mRow);

      // Day row
      const dRow = document.createElement('div');
      dRow.style.cssText = `display:flex;height:${ROW_H}px;background:#f9fafb;border-bottom:2px solid #e5e7eb;`;
      dayDates.forEach(d => { const w = [0,6].includes(d.getDay()); const c = document.createElement('div'); c.style.cssText = `width:${cellW}px;display:flex;align-items:center;justify-content:center;border-right:1px solid #f0f0f0;font-size:7px;font-weight:700;${w?'background:#f3f4f6;color:#bbb;':'color:#6b7280;'}`; c.textContent = `${d.getDate()}`; dRow.appendChild(c); });
      right.appendChild(dRow);

      // Task bar rows
      rows.forEach(row => {
        const bR = document.createElement('div');
        bR.style.cssText = `display:flex;height:${ROW_H}px;position:relative;border-bottom:1px solid #f3f4f6;${row.type==='section'?'background:#f3f4f6;':''}`;
        dayDates.forEach(d => { const c = document.createElement('div'); const w=[0,6].includes(d.getDay()); c.style.cssText = `width:${cellW}px;height:100%;border-right:1px solid ${w?'#e9e9e9':'#f5f5f5'};flex-shrink:0;${w&&row.type!=='section'?'background:#fafafa;':''}`; bR.appendChild(c); });
        if (row.type === 'task') {
          const t = row.task;
          const dS = new Date(t.startDate.seconds*1000);
          const ts = new Date(dS.getUTCFullYear(), dS.getUTCMonth(), dS.getUTCDate(), 12, 0, 0);
          const dE = new Date(t.endDate.seconds*1000);
          const te = new Date(dE.getUTCFullYear(), dE.getUTCMonth(), dE.getUTCDate(), 12, 0, 0);
          const oD = Math.max(0, Math.floor((ts.getTime()-minDate.getTime())/86400000));
          const sD = Math.max(1, Math.ceil((te.getTime()-ts.getTime())/86400000)+1);
          const bL = oD*cellW+2, bW = Math.max(cellW-4, sD*cellW-4);
          const bar = document.createElement('div');
          bar.style.cssText = `position:absolute;top:5px;height:${ROW_H-10}px;left:${bL}px;width:${bW}px;background:${sBg[t.status]||'#e5e7eb'};border-radius:4px;overflow:hidden;display:flex;align-items:center;padding:0 6px;`;
          bar.innerHTML = `<div style="position:absolute;left:0;top:0;bottom:0;width:${t.progress}%;background:rgba(0,0,0,0.15);border-radius:4px 0 0 4px;"></div><span style="position:relative;z-index:1;font-size:7px;font-weight:800;color:${t.status==='pending'?'#555':'#fff'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase;letter-spacing:0.05em;">${t.title}</span>`;
          bR.appendChild(bar);
        }
        right.appendChild(bR);
      });

      body.appendChild(left); body.appendChild(right);
      container.appendChild(body);

      // Footer
      const footer = document.createElement('div');
      footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;width:100%;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;';
      footer.innerHTML = `<span style="font-size:10px;color:#9ca3af;font-weight:500;">Cronograma Gantt exportado da plataforma IBIT em ${new Date().toLocaleDateString('pt-BR')}</span>`;
      const fLogo = new window.Image(); fLogo.src = logoIbit; fLogo.style.cssText = 'height:30px;object-fit:contain;';
      footer.appendChild(fLogo); container.appendChild(footer);

      await new Promise(r => setTimeout(r, 500));
      const dataUrl = await toPng(container, { cacheBust: true, backgroundColor: '#ffffff', pixelRatio: 2 });
      
      // Setup dynamic single page PDF
      const tempPdf = new jsPDF();
      const ip = tempPdf.getImageProperties(dataUrl);
      const mg = 40; // margin
      const pdfWidth = 3840; // Extremely high resolution 4K width
      const pdfHeight = (pdfWidth - mg * 2) * (ip.height / ip.width) + mg * 2;
      
      const pdf = new jsPDF({ 
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait', 
        unit: 'pt', 
        format: [pdfWidth, pdfHeight] 
      });
      
      pdf.setFillColor(255, 255, 255); 
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F'); 
      pdf.addImage(dataUrl, 'PNG', mg, mg, pdfWidth - mg * 2, pdfHeight - mg * 2); 
      
      pdf.save(`gantt-${(project?.name||'projeto').replace(/\s+/g,'-')}-${new Date().toISOString().substring(0,10)}.pdf`);
      document.body.removeChild(container);
    } catch (err) {
      console.error('[Gantt PDF Export] Error:', err);
      alert('Erro ao exportar PDF. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
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
        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-50 min-h-[68px]">
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

          <div className="hidden sm:flex gap-3 items-center">
             <input
               type="file"
               ref={importInputRef}
               accept=".json"
               className="hidden"
               onChange={handleImportJSON}
             />
             <div className="relative">
                <button 
                  onClick={() => setIsJSONMenuOpen(!isJSONMenuOpen)}
                  className="bg-white text-gray-700 border border-gray-300 px-3 py-1.5 flex items-center justify-center transition-all font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-gray-50 active:scale-95"
                  title="Opções JSON (Importar/Exportar)"
                >
                  <FileJson className="w-3.5 h-3.5" />
                </button>
                <AnimatePresence>
                  {isJSONMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setIsJSONMenuOpen(false)} />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full mt-2 right-0 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-[70] overflow-hidden"
                      >
                        <button 
                          onClick={() => { importInputRef.current?.click(); setIsJSONMenuOpen(false); }}
                          className="w-full px-4 py-3 text-left text-[10px] font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-3 transition-colors border-b border-gray-100 uppercase tracking-widest"
                        >
                          <Upload className="w-3.5 h-3.5 text-gray-400" />
                          Importar JSON
                        </button>
                        <button 
                          onClick={() => { handleExportJSON(); setIsJSONMenuOpen(false); }}
                          disabled={tasks.length === 0}
                          className="w-full px-4 py-3 text-left text-[10px] font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-3 transition-colors disabled:opacity-50 uppercase tracking-widest"
                        >
                          <FileJson className="w-3.5 h-3.5 text-gray-400" />
                          Exportar JSON
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
             <button 
               onClick={handleExportPDF}
               disabled={isExporting || tasks.length === 0}
               className="bg-white text-gray-700 border border-gray-300 px-3 py-1.5 flex items-center gap-2 transition-all font-bold uppercase tracking-widest text-[10px] rounded-lg hover:bg-gray-50 active:scale-95 disabled:opacity-50"
               title="Exportar PDF"
             >
               {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff7f00]" /> : <Printer className="w-3.5 h-3.5" />}
               EXPORTAR PDF
             </button>
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
        <div className="flex-1 custom-scrollbar relative overflow-y-auto overflow-x-hidden bg-white">
          <div className="flex min-h-full">
            
            {/* List Sidebar */}
            <div 
              className="flex flex-col bg-white shrink-0 border-r border-gray-200 overflow-x-auto custom-scrollbar"
              style={{ width: sidebarWidth, minWidth: 400, maxWidth: 1200 }}
            >
              <div className="flex flex-col h-auto min-w-[800px]">
                <div className="grid grid-cols-[minmax(250px,1fr)_90px_120px_110px_85px_85px_60px] bg-white border-b border-gray-200 uppercase text-[10px] font-bold text-gray-400 tracking-widest shrink-0 sticky top-0 z-40 h-[68px]">
                  <div className="p-3 border-r border-gray-100 flex items-center">Função / Descrição</div>
                  <div className="p-3 border-r border-gray-100 flex items-center">Categoria</div>
                  <div className="p-3 border-r border-gray-100 flex items-center">Dependências</div>
                  <div className="p-3 border-r border-gray-100 flex items-center justify-center">Responsáveis</div>
                  <div className="p-3 border-r border-gray-100 flex items-center justify-center">Início</div>
                  <div className="p-3 border-r border-gray-100 flex items-center justify-center">Fim</div>
                  <div className="p-3 flex items-center justify-center">Prog.</div>
                </div>
                
                <div className="bg-white flex flex-col w-full">
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
                        <div key={task.id} className="grid grid-cols-[minmax(250px,1fr)_90px_120px_110px_85px_85px_60px] w-full border-b border-gray-100 group hover:bg-gray-50/50 transition-colors h-[60px] relative bg-white shrink-0">
                          <div className="px-3 py-2 border-r border-gray-100 overflow-hidden flex flex-col justify-center relative">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-800 uppercase truncate pr-16">{task.title}</span>
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); setEditingTask(task); setIsTaskModalOpen(true); }} className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-[#ff7f00] rounded-md transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button onClick={(e) => { e.stopPropagation(); setTaskToDelete(task.id); }} className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-md transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          </div>

                          <div className="p-2 border-r border-gray-100 flex items-center justify-center overflow-hidden">
                            <span className="text-[9px] font-bold text-gray-500 uppercase truncate">
                              {task.category || '-'}
                            </span>
                          </div>

                          <div className="p-2 border-r border-gray-100 flex items-center justify-center overflow-hidden">
                            <span className="text-[9px] font-bold text-gray-500 truncate w-full text-center">
                              {task.dependencies || '-'}
                            </span>
                          </div>

                          <div className="p-2 border-r border-gray-100 flex items-center justify-center overflow-hidden">
                            <div className="flex -space-x-1.5 flex-wrap justify-center">
                               {task.assignedTo?.map((uid, i) => {
                                 const p = participants.find(part => part.id === uid);
                                 if (!p) return null;
                                 return p.photoURL ? (
                                   <img key={i} src={p.photoURL} className="w-5 h-5 rounded-full border border-white object-cover shadow-sm" title={p.name} />
                                 ) : (
                                   <div key={i} className="w-5 h-5 rounded-full border border-white bg-gray-100 flex items-center justify-center text-[7px] font-bold text-gray-600 shadow-sm" title={p.name}>
                                     {p.name.charAt(0)}
                                   </div>
                                 );
                               })}
                            </div>
                          </div>

                          <div className="p-2 border-r border-gray-100 flex items-center justify-center overflow-hidden">
                            <span className="text-[9px] font-bold text-gray-600 whitespace-nowrap">
                              {(() => {
                                const d = new Date(task.startDate.seconds * 1000);
                                return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).toLocaleDateString('pt-BR');
                              })()}
                            </span>
                          </div>

                          <div className="p-2 border-r border-gray-100 flex items-center justify-center overflow-hidden">
                            <span className="text-[9px] font-bold text-gray-600 whitespace-nowrap">
                              {(() => {
                                const d = new Date(task.endDate.seconds * 1000);
                                return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).toLocaleDateString('pt-BR');
                              })()}
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
                 className="w-1 bg-gray-100 hover:bg-[#ff7f00] z-50 shrink-0 transition-all cursor-col-resize active:bg-[#ff7f00]"
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

            {/* Timeline Column */}
            <div className="flex-1 flex flex-col min-w-0 bg-gray-50/20">
              {/* Timeline Header Wrapper */}
              <div 
                ref={timelineHeaderRef}
                className="sticky top-0 z-40 bg-white border-b border-gray-200 overflow-hidden shrink-0"
              >
                <div style={{ width: `${timelineDates.length * cellWidth}px` }}>
                  {/* Month Row */}
                  <div className="flex h-8 border-b border-gray-100">
                    {monthGroups.map((group, idx) => (
                      <div 
                        key={idx}
                        className="flex-shrink-0 border-r border-gray-100 flex items-center justify-center text-[10px] font-black text-gray-500 tracking-[0.2em] uppercase bg-gray-50/50"
                        style={{ width: `${group.days * cellWidth}px` }}
                      >
                        {group.month} {group.year}
                      </div>
                    ))}
                  </div>
                  {/* Day Row */}
                  <div className="flex h-9">
                    {timelineDates.map((date, idx) => (
                      <div 
                        key={idx} 
                        className={clsx(
                          "flex flex-col items-center justify-center border-r border-gray-100 group transition-colors overflow-hidden shrink-0",
                          [0, 6].includes(date.getDay()) ? "bg-gray-50/30" : "hover:bg-orange-50/30"
                        )}
                        style={{ width: `${cellWidth}px` }}
                      >
                        <span className={clsx("font-bold text-gray-400 uppercase", cellWidth < 40 ? "text-[6px]" : "text-[8px]")}>
                          {date.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}
                        </span>
                        <span className={clsx("font-bold text-gray-900", cellWidth < 40 ? "text-[8px]" : "text-[10px]")}>
                          {date.getDate()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Timeline Body Wrapper */}
              <div 
                ref={timelineBodyRef}
                onScroll={handleTimelineScroll}
                className="flex-1 overflow-x-auto custom-scrollbar flex flex-col"
              >
                <div style={{ width: `${timelineDates.length * cellWidth}px` }} className="relative flex-1 flex flex-col">

                {/* Chart Grid Lines & Task Bars */}
                <div className="relative flex-1 flex flex-col">
                  {/* Background Grid */}
                  <div className="absolute inset-0 flex pointer-events-none z-0">
                    {timelineDates.map((date, idx) => (
                      <div 
                        key={idx} 
                        className={clsx(
                          "h-full border-r border-gray-100/50 transition-colors shrink-0",
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
                             className="absolute top-1/2 -translate-y-1/2 h-[34px] rounded-md shadow-sm border overflow-hidden flex flex-col justify-end transition-all cursor-pointer bg-gray-200 border-gray-300 text-gray-500"
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

      {/* Exporting Overlay */}
      <AnimatePresence>
        {isExporting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6"
          >
            <Loader2 className="w-12 h-12 text-[#ff7f00] animate-spin" />
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 tracking-widest uppercase mb-2">Exportando PDF</h2>
              <p className="text-sm text-gray-500 font-medium">Gerando cronograma completo...</p>
            </div>
          </motion.div>
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

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => setMobileJSONOpen(!mobileJSONOpen)}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 text-gray-700 rounded-2xl border border-gray-100 font-bold uppercase tracking-widest text-xs active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white text-gray-400 border border-gray-200 flex items-center justify-center rounded-xl">
                        <FileJson className="w-6 h-6" />
                      </div>
                      DADOS JSON
                    </div>
                    <ChevronDown className={clsx("w-5 h-5 transition-transform", mobileJSONOpen && "rotate-180")} />
                  </button>
                  
                  <AnimatePresence>
                    {mobileJSONOpen && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden flex flex-col gap-2 px-2"
                      >
                        <button 
                          onClick={() => { setShowMobileActions(false); handleExportJSON(); }}
                          disabled={tasks.length === 0}
                          className="w-full flex items-center gap-4 p-3 bg-white text-gray-600 rounded-xl border border-gray-100 font-bold uppercase tracking-widest text-[10px] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          <FileJson className="w-4 h-4 text-gray-400" />
                          Exportar JSON
                        </button>
                        <button 
                          onClick={() => { setShowMobileActions(false); importInputRef.current?.click(); }}
                          className="w-full flex items-center gap-4 p-3 bg-white text-gray-600 rounded-xl border border-gray-100 font-bold uppercase tracking-widest text-[10px] active:scale-[0.98] transition-all"
                        >
                          <Upload className="w-4 h-4 text-gray-400" />
                          Importar JSON
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
