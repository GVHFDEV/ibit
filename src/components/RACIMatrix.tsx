import React, { useState, useEffect } from 'react';
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
  documentId, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  orderBy,
  setDoc,
  getDocs
} from 'firebase/firestore';
import { RACIMatrix as IRACIMatrix, RACITask, RACIStakeholder, RACIAssignment, Project, UserProfile, RACIRole } from '../types';
import { 
  Plus, 
  Search, 
  Grid3X3, 
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
  Info
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import ProjectSettingsModal from './ProjectSettingsModal';
import { handleFirestoreError, OperationType } from '../utils/errorHandlers';
import { motion, AnimatePresence } from 'motion/react';

export default function RACIMatrix() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<UserProfile[]>([]);
  const [matrices, setMatrices] = useState<IRACIMatrix[]>([]);
  const [currentMatrixId, setCurrentMatrixId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [tasks, setTasks] = useState<RACITask[]>([]);
  const [stakeholders, setStakeholders] = useState<RACIStakeholder[]>([]);
  const [assignments, setAssignments] = useState<RACIAssignment[]>([]);
  
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isStakeholderModalOpen, setIsStakeholderModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState<{ taskId: string, participantId: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const [editingMatrix, setEditingMatrix] = useState<IRACIMatrix | null>(null);
  const [editingTask, setEditingTask] = useState<RACITask | null>(null);
  const [editingStakeholder, setEditingStakeholder] = useState<RACIStakeholder | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'matrix' | 'task' | 'stakeholder'; name: string } | null>(null);

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

  // 3. Fetch Matrices
  useEffect(() => {
    if (!projectId) return;
    const qMatrices = query(
      collection(db, 'raciMatrices'), 
      where('projectId', '==', projectId)
    );
    return onSnapshot(qMatrices, (snapshot) => {
      const matrixData: IRACIMatrix[] = [];
      snapshot.forEach((doc) => {
        matrixData.push({ id: doc.id, ...doc.data() } as IRACIMatrix);
      });

      const getMillis = (ts: any) => {
        if (!ts) return Date.now();
        if (typeof ts.toMillis === 'function') return ts.toMillis();
        if (ts.seconds) return ts.seconds * 1000;
        return Date.now();
      };

      setMatrices(matrixData.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'raciMatrices');
      setLoading(false);
    });
  }, [projectId]);

  // 4. Fetch Matrix Details (Tasks, Stakeholders, Assignments)
  useEffect(() => {
    if (!currentMatrixId || !projectId) {
      setTasks([]);
      setStakeholders([]);
      setAssignments([]);
      return;
    }

    const qTasks = query(collection(db, 'raciTasks'), where('projectId', '==', projectId));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      const data: RACITask[] = [];
      snapshot.forEach(doc => {
        const task = { id: doc.id, ...doc.data() } as RACITask;
        if (task.matrixId === currentMatrixId) data.push(task);
      });
      setTasks([...data].sort((a, b) => (a.order || 0) - (b.order || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'raciTasks'));

    const qStakeholders = query(collection(db, 'raciStakeholders'), where('projectId', '==', projectId));
    const unsubStakeholders = onSnapshot(qStakeholders, (snapshot) => {
      const data: RACIStakeholder[] = [];
      snapshot.forEach(doc => {
        const sh = { id: doc.id, ...doc.data() } as RACIStakeholder;
        if (sh.matrixId === currentMatrixId) data.push(sh);
      });
      setStakeholders([...data].sort((a, b) => (a.order || 0) - (b.order || 0)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'raciStakeholders'));

    const qAssignments = query(collection(db, 'raciAssignments'), where('projectId', '==', projectId));
    const unsubAssignments = onSnapshot(qAssignments, (snapshot) => {
      const data: RACIAssignment[] = [];
      snapshot.forEach(doc => {
        const assign = { id: doc.id, ...doc.data() } as RACIAssignment;
        if (assign.matrixId === currentMatrixId) data.push(assign);
      });
      setAssignments(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'raciAssignments'));

    return () => {
      unsubTasks();
      unsubStakeholders();
      unsubAssignments();
    };
  }, [currentMatrixId, projectId]);

  const handleDelete = async () => {
    if (!itemToDelete) return;
    const { id, type } = itemToDelete;
    setItemToDelete(null); // Close modal immediately for better UX
    
    try {
      if (type === 'matrix') {
        const collections = ['raciTasks', 'raciStakeholders', 'raciAssignments'];
        for (const coll of collections) {
          const q = query(collection(db, coll), where('projectId', '==', projectId));
          const snap = await getDocs(q);
          const relatedDocs = snap.docs.filter(d => d.data().matrixId === id);
          for (const d of relatedDocs) await deleteDoc(doc(db, coll, d.id));
        }
        await deleteDoc(doc(db, 'raciMatrices', id));
        if (currentMatrixId === id) setCurrentMatrixId(null);
      } else if (type === 'task') {
        await deleteDoc(doc(db, 'raciTasks', id));
        const q = query(collection(db, 'raciAssignments'), where('projectId', '==', projectId));
        const snap = await getDocs(q);
        const relatedDocs = snap.docs.filter(d => d.data().taskId === id);
        for (const d of relatedDocs) await deleteDoc(doc(db, 'raciAssignments', d.id));
      } else if (type === 'stakeholder') {
        await deleteDoc(doc(db, 'raciStakeholders', id));
        const q = query(collection(db, 'raciAssignments'), where('projectId', '==', projectId));
        const snap = await getDocs(q);
        const relatedDocs = snap.docs.filter(d => d.data().participantId === id);
        for (const d of relatedDocs) await deleteDoc(doc(db, 'raciAssignments', d.id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'raci');
    }
  };

  const getBreadcrumbs = () => {
    const crumbs = [{ id: null, name: 'INÍCIO' }];
    if (currentMatrixId) {
      const matrix = matrices.find(m => m.id === currentMatrixId);
      if (matrix) crumbs.push({ id: matrix.id, name: matrix.name.toUpperCase() });
    }
    return crumbs;
  };

  const currentMatrix = matrices.find(m => m.id === currentMatrixId);
  const filteredMatrices = matrices.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const getRole = (taskId: string, participantId: string): RACIRole => {
    return assignments.find(a => a.taskId === taskId && a.participantId === participantId)?.role || null;
  };

  const setRole = async (taskId: string, participantId: string, role: RACIRole) => {
    if (!projectId || !currentMatrixId) return;
    
    // Deterministic ID for the current assignment
    const assignmentId = `${currentMatrixId}_${taskId}_${participantId}`;
    
    try {
      if (role === null) {
        // Clearing: Delete the deterministic ID
        await deleteDoc(doc(db, 'raciAssignments', assignmentId));
      } else {
        // Assigning: Overwrite with setDoc (most efficient)
        const data = {
          matrixId: currentMatrixId,
          projectId,
          taskId,
          participantId,
          role,
          updatedAt: serverTimestamp()
        };
        await setDoc(doc(db, 'raciAssignments', assignmentId), data);
      }

      // Cleanup Background: Look for any random (legacy) IDs for this same assignment
      // and remove them to avoid duplicates. We don't await this to keep UI snappy.
      const q = query(
        collection(db, 'raciAssignments'), 
        where('projectId', '==', projectId)
      );
      getDocs(q).then(snap => {
        const legacyDocs = snap.docs.filter(d => {
          const data = d.data();
          return d.id !== assignmentId && 
                 data.matrixId === currentMatrixId && 
                 data.taskId === taskId && 
                 data.participantId === participantId;
        });
        legacyDocs.forEach(d => deleteDoc(doc(db, 'raciAssignments', d.id)));
      }).catch(() => {/* Ignore cleanup errors */});

    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'raciAssignments');
    }
  };

  const participants = stakeholders.map(s => ({
    id: s.id,
    name: s.name,
    userId: s.userId,
    isUser: !!s.userId,
    photoURL: s.userId ? projectMembers.find(m => m.uid === s.userId)?.photoURL : undefined
  }));

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#ff7f00] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f8f9fa] overflow-hidden">
      <Sidebar 
        projectId={projectId} 
        projectName={project?.name} 
        onOpenSettings={user?.uid === project?.ownerId ? () => setIsSettingsOpen(true) : undefined} 
      />

      <MobileToolsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        projectId={projectId!}
        projectName={project?.name}
        onOpenSettings={user?.uid === project?.ownerId ? () => setIsSettingsOpen(true) : undefined}
      />
      
      <main className="flex-1 flex flex-col min-w-0">
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

        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-0 sm:gap-6">
            <div className="hidden sm:flex items-center gap-2">
              <Grid3X3 className="w-5 h-5 text-[#ff7f00]" />
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-widest">
                MATRIZ RACI
              </h2>
            </div>
            
            {!currentMatrixId && (
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Procurar matriz..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#ff7f00] text-sm font-medium rounded-lg transition-all"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 sm:gap-3">
            {currentMatrixId ? (
              <>
                <button 
                  onClick={() => { setEditingTask(null); setIsTaskModalOpen(true); }}
                  className="bg-white text-gray-700 border border-gray-300 px-3 py-2 flex items-center justify-center gap-2 transition-all font-bold uppercase tracking-widest text-[9px] sm:text-[10px] rounded-lg hover:bg-gray-50 active:scale-95 flex-1 sm:flex-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                  TAREFA
                </button>
                <button 
                  onClick={() => { setEditingStakeholder(null); setIsStakeholderModalOpen(true); }}
                  className="bg-[#ff7f00] hover:bg-orange-600 text-white px-3 py-2 flex items-center justify-center gap-2 transition-all font-bold uppercase tracking-widest text-[9px] sm:text-[10px] rounded-lg active:scale-95 shadow-md shadow-orange-100 flex-1 sm:flex-none"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  STAKEHOLDER
                </button>
              </>
            ) : (
              <button 
                onClick={() => { setEditingMatrix(null); setIsMatrixModalOpen(true); }}
                className="bg-[#ff7f00] hover:bg-orange-600 text-white px-4 py-2 flex items-center justify-center gap-2 transition-all font-bold uppercase tracking-widest text-[9px] sm:text-[10px] rounded-lg active:scale-95 shadow-md shadow-orange-100 flex-1 sm:flex-none"
              >
                <Plus className="w-4 h-4" />
                CRIAR MATRIZ
              </button>
            )}
          </div>
        </div>

        {/* Breadcrumbs */}
        <div className="px-6 pt-6 flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase">
          {getBreadcrumbs().map((crumb, idx) => (
            <React.Fragment key={crumb.id || 'root'}>
              {idx > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
              <button 
                onClick={() => setCurrentMatrixId(crumb.id as string | null)}
                className={clsx(
                  "hover:text-[#ff7f00] transition-colors",
                  idx === getBreadcrumbs().length - 1 ? "text-gray-900" : ""
                )}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-6 scrollbar-hide mobile-pb-nav">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center opacity-50">
              <Loader2 className="w-10 h-10 text-[#ff7f00] animate-spin mb-4" />
              <p className="font-bold uppercase tracking-widest text-xs">Carregando matrizes...</p>
            </div>
          ) : !currentMatrixId ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredMatrices.map(matrix => (
                <div 
                  key={matrix.id}
                  onClick={() => setCurrentMatrixId(matrix.id)}
                  className="group bg-white rounded-2xl border border-gray-200 p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#ff7f00] hover:shadow-xl transition-all relative"
                >
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingMatrix(matrix);
                        setIsMatrixModalOpen(true);
                      }}
                      className="p-1.5 hover:bg-orange-50 text-gray-400 hover:text-[#ff7f00] rounded-lg"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDelete({ id: matrix.id, type: 'matrix', name: matrix.name });
                      }}
                      className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Grid3X3 className="w-16 h-16 text-[#ff7f00] fill-[#ff7f00]/5 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-gray-900 uppercase tracking-wider text-center line-clamp-2">{matrix.name}</span>
                </div>
              ))}
              
              {filteredMatrices.length === 0 && (
                <div className="col-span-full h-64 flex flex-col items-center justify-center text-gray-400 opacity-50">
                  <Grid3X3 className="w-12 h-12 mb-4 border-2 border-dashed border-gray-200 p-2 rounded-xl" />
                  <p className="font-bold uppercase tracking-widest text-[10px]">Nenhuma matriz encontrada</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-100 p-4 min-w-[300px] text-left">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">TAREFAS / ATIVIDADES</span>
                          <span className="text-[9px] text-gray-300 font-medium italic">MATRIZ: {currentMatrix?.name.toUpperCase()}</span>
                        </div>
                      </th>
                      {participants.map(p => (
                        <th key={p.id} className="bg-gray-50 border-b border-r border-gray-100 p-4 min-w-[140px] text-center group">
                          <div className="flex flex-col items-center gap-2 relative">
                            <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-30">
                              {!p.isUser && (
                                <button 
                                  onClick={() => {
                                    setEditingStakeholder(stakeholders.find(s => s.id === p.id)!);
                                    setIsStakeholderModalOpen(true);
                                  }}
                                  className="p-1 bg-white border border-gray-100 text-gray-400 hover:text-[#ff7f00] rounded-none shadow-sm"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                              <button 
                                onClick={() => setItemToDelete({ id: p.id, type: 'stakeholder', name: p.name })}
                                className="p-1 bg-white border border-gray-100 text-gray-400 hover:text-red-500 rounded-none shadow-sm"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                            <div className={clsx(
                              "w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-md overflow-hidden",
                              p.isUser ? "bg-orange-50 text-[#ff7f00]" : "bg-red-50 text-[#f94200]"
                            )}>
                              {p.photoURL ? (
                                <img src={p.photoURL} className="w-full h-full object-cover" />
                              ) : p.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[10px] font-bold text-gray-800 uppercase tracking-wider line-clamp-1">{p.name}</span>
                            <span className={clsx(
                              "text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-full uppercase",
                              p.isUser ? "bg-orange-100 text-[#ff7f00]" : "bg-red-100 text-[#f94200]"
                            )}>
                              {p.isUser ? 'Membro' : 'Externo'}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(task => (
                      <tr key={task.id} className="group hover:bg-gray-50 transition-colors">
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border-b border-r border-gray-100 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <span className="text-sm font-bold text-gray-700 uppercase tracking-tight line-clamp-2">{task.title}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button 
                                  onClick={() => { setEditingTask(task); setIsTaskModalOpen(true); }}
                                  className="p-1.5 hover:bg-orange-50 text-gray-400 hover:text-[#ff7f00] rounded-lg"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => setItemToDelete({ id: task.id, type: 'task', name: task.title })}
                                  className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                          </div>
                        </td>
                        {participants.map(p => {
                          const role = getRole(task.id, p.id);
                          return (
                            <td 
                              key={p.id} 
                              className="border-b border-r border-gray-100 p-2 text-center"
                              onClick={() => setIsAssignmentModalOpen({ taskId: task.id, participantId: p.id })}
                            >
                              <div className={clsx(
                                "mx-auto w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-all cursor-pointer border-2",
                                !role ? "bg-gray-50 border-transparent text-gray-200 hover:border-gray-200" :
                                "bg-white border-gray-100 text-gray-900 shadow-sm hover:border-[#ff7f00]"
                              )}>
                                {role || '-'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={participants.length + 1} className="p-12 text-center text-gray-400 italic">
                          Nenhuma tarefa adicionada a esta matriz ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        
        {/* Legend */}
        {currentMatrixId && (
          <div className="border-t border-gray-100 bg-white p-3 sm:p-4 shrink-0 flex items-center justify-center gap-4 sm:gap-8 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-white text-gray-900 flex items-center justify-center font-black text-[10px] border border-gray-200">R</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Responsável</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-white text-gray-900 flex items-center justify-center font-black text-[10px] border border-gray-200">A</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Autoridade (Accountable)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-white text-gray-900 flex items-center justify-center font-black text-[10px] border border-gray-200">C</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Consultado</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-white text-gray-900 flex items-center justify-center font-black text-[10px] border border-gray-200">I</span>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Informado</span>
            </div>
          </div>
        )}
      </main>

      <AnimatePresence mode="wait">
        {isMatrixModalOpen && (
          <MatrixModal 
            projectId={projectId!}
            matrix={editingMatrix}
            onClose={() => setIsMatrixModalOpen(false)}
          />
        )}
        {isTaskModalOpen && (
          <TaskModal 
            projectId={projectId!}
            matrixId={currentMatrixId!}
            task={editingTask}
            onClose={() => setIsTaskModalOpen(false)}
            nextOrder={tasks.length}
          />
        )}
        {isStakeholderModalOpen && (
          <StakeholderModal 
            projectId={projectId!}
            matrixId={currentMatrixId!}
            stakeholder={editingStakeholder}
            onClose={() => setIsStakeholderModalOpen(false)}
            nextOrder={stakeholders.length}
            projectMembers={projectMembers}
            currentStakeholders={stakeholders}
          />
        )}
        {isAssignmentModalOpen && (
          <AssignmentModal 
            currentRole={getRole(isAssignmentModalOpen.taskId, isAssignmentModalOpen.participantId)}
            onSelect={(role) => {
              setRole(isAssignmentModalOpen.taskId, isAssignmentModalOpen.participantId, role);
              setIsAssignmentModalOpen(null);
            }}
            onClose={() => setIsAssignmentModalOpen(null)}
          />
        )}
        {itemToDelete && (
          <DeleteConfirmModal 
            title={`EXCLUIR ${itemToDelete.type.toUpperCase()}`}
            message={`Tem certeza que deseja excluir "${itemToDelete.name}"? ${itemToDelete.type === 'matrix' ? 'Todas as tarefas, stakeholders e atribuições desta matriz serão removidos permanentemente.' : ''}`}
            onConfirm={handleDelete}
            onCancel={() => setItemToDelete(null)}
            destructive
          />
        )}
      </AnimatePresence>

      {isSettingsOpen && project && (
        <ProjectSettingsModal 
          onClose={() => setIsSettingsOpen(false)} 
          project={project} 
        />
      )}

      <MobileBottomNav onOpenProfile={() => setIsProfileOpen(true)} />

      <AnimatePresence>
        {isProfileOpen && (
          <UserProfileModal onClose={() => setIsProfileOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- MODALS ---

function MatrixModal({ projectId, matrix, onClose }: { projectId: string, matrix: IRACIMatrix | null, onClose: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState(matrix?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setIsSaving(true);
    try {
      const data = {
        projectId,
        name: name.trim(),
        updatedAt: serverTimestamp(),
        ownerId: user.uid
      };
      if (matrix) {
        await updateDoc(doc(db, 'raciMatrices', matrix.id), data);
      } else {
        await addDoc(collection(db, 'raciMatrices'), { ...data, createdAt: serverTimestamp() });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'raciMatrices');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border border-gray-200 w-full max-w-md overflow-hidden rounded-2xl shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest">{matrix ? 'EDITAR MATRIZ' : 'NOVA MATRIZ'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">NOME DA MATRIZ</label>
            <input 
              type="text" autoFocus required value={name} onChange={(e) => setName(e.target.value)} 
              className="w-full bg-white border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-xl transition-all" 
              placeholder="Ex: Matriz de Responsabilidades - Projeto X" 
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} type="button" className="flex-1 px-6 py-3 bg-white border border-gray-200 text-gray-500 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-gray-50 transition-colors">CANCELAR</button>
            <button type="submit" disabled={isSaving || !name.trim()} className="flex-1 px-6 py-3 bg-[#ff7f00] text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-orange-600 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'SALVANDO...' : 'SALVAR'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function TaskModal({ projectId, matrixId, task, onClose, nextOrder }: { projectId: string, matrixId: string, task: RACITask | null, onClose: () => void, nextOrder: number }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(task?.title || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    setIsSaving(true);
    try {
      const data = {
        matrixId,
        projectId,
        title: title.trim(),
        order: task ? task.order : nextOrder,
        updatedAt: serverTimestamp()
      };
      if (task) {
        await updateDoc(doc(db, 'raciTasks', task.id), data);
      } else {
        await addDoc(collection(db, 'raciTasks'), { ...data, createdAt: serverTimestamp() });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'raciTasks');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border border-gray-200 w-full max-w-md overflow-hidden rounded-2xl shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest">{task ? 'EDITAR TAREFA' : 'NOVA TAREFA'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">TÍTULO DA TAREFA / ATIVIDADE</label>
            <input 
              type="text" autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} 
              className="w-full bg-white border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-xl transition-all" 
              placeholder="Ex: Definir Escopo do Projeto" 
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} type="button" className="flex-1 px-6 py-3 bg-white border border-gray-200 text-gray-500 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-gray-50 transition-colors">CANCELAR</button>
            <button type="submit" disabled={isSaving || !title.trim()} className="flex-1 px-6 py-3 bg-[#ff7f00] text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-orange-600 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'SALVANDO...' : 'SALVAR'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function StakeholderModal({ projectId, matrixId, stakeholder, onClose, nextOrder, projectMembers, currentStakeholders }: { projectId: string, matrixId: string, stakeholder: RACIStakeholder | null, onClose: () => void, nextOrder: number, projectMembers: UserProfile[], currentStakeholders: RACIStakeholder[] }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'members' | 'external'>('members');
  const [name, setName] = useState(stakeholder?.name || '');
  const [role, setRole] = useState(stakeholder?.role || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddMember = async (member: UserProfile) => {
    if (isSaving || currentStakeholders.some(s => s.userId === member.uid)) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'raciStakeholders'), {
        matrixId,
        projectId,
        name: member.name,
        userId: member.uid,
        order: nextOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      // Don't close, user might want to add more
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'raciStakeholders');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitExternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;
    setIsSaving(true);
    try {
      const data = {
        matrixId,
        projectId,
        name: name.trim(),
        role: role.trim(),
        order: stakeholder ? stakeholder.order : nextOrder,
        updatedAt: serverTimestamp()
      };
      if (stakeholder) {
        await updateDoc(doc(db, 'raciStakeholders', stakeholder.id), data);
      } else {
        await addDoc(collection(db, 'raciStakeholders'), { ...data, createdAt: serverTimestamp() });
      }
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'raciStakeholders');
    } finally {
      setIsSaving(false);
    }
  };

  const membersToAdd = projectMembers.filter(m => !currentStakeholders.some(s => s.userId === m.uid));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border border-gray-200 w-full max-w-md overflow-hidden rounded-2xl shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-lg font-black text-gray-900 uppercase tracking-widest">{stakeholder ? 'EDITAR STAKEHOLDER' : 'GERENCIAR STAKEHOLDERS'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors pointer-events-auto"><X className="w-6 h-6" /></button>
        </div>

        {!stakeholder && (
          <div className="flex border-b border-gray-50">
            <button 
              onClick={() => setActiveTab('members')}
              className={clsx(
                "flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2",
                activeTab === 'members' ? "border-[#ff7f00] text-[#ff7f00] bg-orange-50/30" : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              MEMBROS DA EQUIPE
            </button>
            <button 
              onClick={() => setActiveTab('external')}
              className={clsx(
                "flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2",
                activeTab === 'external' ? "border-[#ff7f00] text-[#ff7f00] bg-orange-50/30" : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              STAKEHOLDER EXTERNO
            </button>
          </div>
        )}

        <div className="p-6">
          {stakeholder || activeTab === 'external' ? (
            <form onSubmit={handleSubmitExternal} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">NOME / CARGO</label>
                  <input 
                    type="text" autoFocus required value={name} onChange={(e) => setName(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-xl text-sm transition-all" 
                    placeholder="Ex: Diretor Financeiro" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">PAPEL (OPCIONAL)</label>
                  <input 
                    type="text" value={role} onChange={(e) => setRole(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 px-4 py-3 text-gray-900 focus:outline-none focus:border-[#ff7f00] font-medium rounded-xl text-sm transition-all" 
                    placeholder="Ex: Patrocinador, Mentor..." 
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={onClose} type="button" className="flex-1 px-6 py-3 bg-white border border-gray-200 text-gray-500 font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-gray-50 transition-colors">CANCELAR</button>
                <button type="submit" disabled={isSaving || !name.trim()} className="flex-1 px-6 py-3 bg-[#ff7f00] text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-orange-600 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all">
                  {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                  {isSaving ? 'SALVANDO...' : 'SALVAR PARTICIPANTE'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                {membersToAdd.map(member => (
                  <button 
                    key={member.uid}
                    onClick={() => handleAddMember(member)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-[#ff7f00] hover:bg-orange-50/50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-none bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 overflow-hidden">
                        {member.photoURL ? <img src={member.photoURL} className="w-full h-full object-cover" /> : member.name.charAt(0)}
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-bold text-gray-800 uppercase tracking-tight">{member.name}</span>
                        <span className="text-[10px] text-gray-400 font-medium">{member.email}</span>
                      </div>
                    </div>
                    <Plus className="w-5 h-5 text-gray-300 group-hover:text-[#ff7f00] transition-colors" />
                  </button>
                ))}
                {membersToAdd.length === 0 && (
                  <div className="py-12 text-center text-gray-400 italic text-xs uppercase tracking-[0.2em]">
                    Todos os membros já foram adicionados.
                  </div>
                )}
              </div>
              <button 
                onClick={onClose} 
                className="w-full py-3 bg-[#ff7f00] text-white font-black uppercase tracking-widest text-[10px] rounded-xl hover:bg-orange-600 transition-all active:scale-95 shadow-lg shadow-orange-100"
              >
                CONCLUÍDO
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function AssignmentModal({ currentRole, onSelect, onClose }: { currentRole: RACIRole, onSelect: (role: RACIRole) => void, onClose: () => void }) {
  const roles: { id: RACIRole, label: string, desc: string, color: string }[] = [
    { id: 'R', label: 'RESPONSÁVEL', desc: 'Quem executa a tarefa.', color: 'bg-white text-gray-900 border-gray-100 hover:border-[#ff7f00]' },
    { id: 'A', label: 'AUTORIDADE', desc: 'Quem aprova e responde pela tarefa.', color: 'bg-white text-gray-900 border-gray-100 hover:border-[#ff7f00]' },
    { id: 'C', label: 'CONSULTADO', desc: 'Quem fornece informações e conselhos.', color: 'bg-white text-gray-900 border-gray-100 hover:border-[#ff7f00]' },
    { id: 'I', label: 'INFORMADO', desc: 'Quem deve ser avisado sobre o progresso.', color: 'bg-white text-gray-900 border-gray-100 hover:border-[#ff7f00]' },
    { id: null, label: 'LIMPAR', desc: 'Remover atribuição.', color: 'bg-white text-gray-400 border-gray-100 hover:border-red-200' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border border-gray-200 w-full max-w-md overflow-hidden rounded-2xl shadow-2xl relative">
        <div className="p-8 border-b border-gray-100 flex justify-between items-center group">
            <div className="flex flex-col gap-1 text-left">
              <h3 className="text-2xl font-black text-[#ff7f00] uppercase tracking-tighter">ATRIBUIR PAPEL</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Selecione a responsabilidade</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-all hover:rotate-90">
              <X className="w-6 h-6 text-gray-300 hover:text-gray-900" />
            </button>
        </div>
        <div className="p-6 grid grid-cols-1 gap-3">
          {roles.map(r => (
            <button 
              key={r.id || 'none'}
              onClick={() => onSelect(r.id)}
              className={clsx(
                "flex flex-col p-6 rounded-2xl border-2 transition-all text-left",
                r.color,
                currentRole === r.id ? "border-[#ff7f00] shadow-lg scale-[1.02] bg-orange-50/10" : "border-gray-100 opacity-90 hover:opacity-100 hover:shadow-md"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-sm font-black uppercase tracking-widest mb-1">{r.label}</span>
                {currentRole === r.id && <CheckCircle2 className="w-5 h-5" />}
              </div>
              <span className="text-[10px] font-medium opacity-70 leading-relaxed">{r.desc}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function DeleteConfirmModal({ title, message, onConfirm, onCancel, destructive }: { title: string, message: string, onConfirm: () => void, onCancel: () => void, destructive?: boolean }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border border-gray-200 w-full max-w-md overflow-hidden rounded-2xl shadow-2xl">
        <div className={clsx(
          "flex justify-between items-center p-8 pb-4",
          destructive ? "text-red-700" : "text-gray-900"
        )}>
          <h3 className="text-xl font-black uppercase tracking-tighter">{title}</h3>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-8 pt-2 space-y-8">
          <p className="text-sm text-gray-500 font-bold leading-relaxed">{message}</p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 bg-gray-50 text-gray-400 px-4 py-4 font-black uppercase tracking-widest rounded-xl hover:bg-gray-100 transition-all text-[10px]">CANCELAR</button>
            <button onClick={onConfirm} className={clsx(
              "flex-1 px-4 py-4 font-black uppercase tracking-widest rounded-xl shadow-xl transition-all text-[10px] active:scale-95",
              destructive ? "bg-red-600 hover:bg-red-700 text-white shadow-red-200" : "bg-[#ff7f00] hover:bg-orange-600 text-white shadow-orange-100"
            )}>
              {destructive ? 'EXCLUIR PERMANENTE' : 'CONFIRMAR'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
