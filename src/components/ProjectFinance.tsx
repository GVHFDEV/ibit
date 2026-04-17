import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, collection, query, where, onSnapshot, documentId, addDoc, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { Project, UserProfile, Transaction, Budget } from '../types';
import Sidebar from './Sidebar';
import ProjectSettingsModal from './ProjectSettingsModal';
import { 
  DollarSign, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  PieChart,
  Upload,
  X,
  FileText,
  Trash2,
  Calendar,
  Pencil,
  Paperclip,
  Loader2,
  Printer
} from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
// @ts-ignore
import logoIbit from '../media/ibitlogo.svg';

type FinanceTab = 'Dashboard' | 'Transações' | 'Orçamento';

const CLOUDINARY_CLOUD_NAME = 'drmgydsjc';
const CLOUDINARY_UPLOAD_PRESET = 'cirzsuhz';

const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600; // Increased resolution
        const MAX_HEIGHT = 1600; // Increased resolution
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob failed'));
        }, 'image/jpeg', 0.9); // High quality for readability
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

export default function ProjectFinance() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<FinanceTab>('Dashboard');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  // Modal State
  const [isOpenExpenseModal, setIsOpenExpenseModal] = useState(false);
  const [isOpenIncomeModal, setIsOpenIncomeModal] = useState(false);
  const [isOpenBudgetModal, setIsOpenBudgetModal] = useState(false);
  
  // Editing & Viewing State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [viewingBudget, setViewingBudget] = useState<Budget | null>(null);
  const [viewingCategory, setViewingCategory] = useState<string | null>(null);
  const [isOpenFlowModal, setIsOpenFlowModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
        setLoading(false);
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
      snapshot.forEach((doc) => {
        membersData.push({ uid: doc.id, ...doc.data() } as UserProfile);
      });
      setProjectMembers(membersData);
    });
  }, [project?.members?.join(',')]);

  useEffect(() => {
    if (!projectId) return;

    const qTrans = query(collection(db, 'transactions'), where('projectId', '==', projectId));
    const unsubTrans = onSnapshot(qTrans, (snapshot) => {
      const transData: Transaction[] = [];
      snapshot.forEach((doc) => {
        transData.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      transData.sort((a,b) => {
        const da = a.date?.toDate ? a.date.toDate() : new Date();
        const db = b.date?.toDate ? b.date.toDate() : new Date();
        return db.getTime() - da.getTime();
      });
      setTransactions(transData);
    });

    const qBudg = query(collection(db, 'budgets'), where('projectId', '==', projectId));
    const unsubBudg = onSnapshot(qBudg, (snapshot) => {
      const budgData: Budget[] = [];
      snapshot.forEach((doc) => {
        budgData.push({ id: doc.id, ...doc.data() } as Budget);
      });
      setBudgets(budgData);
    });

    return () => { unsubTrans(); unsubBudg(); };
  }, [projectId]);

  if (loading || !project) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#ff7f00] border-t-transparent animate-spin rounded-full"></div>
      </div>
    );
  }

  const handleTransactionSubmit = async (
    data: { id?: string, title: string, amount: number, date: Date, category: string, budgetId: string, receiptUrl: string, createInventoryItem: boolean }, 
    type: 'income' | 'expense'
  ) => {
    if (!projectId || !user) return;
    try {
      if (data.id) {
        // Edit existing
        await updateDoc(doc(db, 'transactions', data.id), {
          title: data.title,
          amount: data.amount,
          date: data.date,
          category: data.category,
          budgetId: data.budgetId,
          receiptUrl: data.receiptUrl,
        });
      } else {
        // Create new
        await addDoc(collection(db, 'transactions'), {
          projectId,
          title: data.title,
          amount: data.amount,
          date: data.date,
          category: data.category,
          type,
          budgetId: data.budgetId,
          receiptUrl: data.receiptUrl,
          createdAt: serverTimestamp()
        });

        // Add to inventory if requested
        if (data.createInventoryItem && type === 'expense') {
          await addDoc(collection(db, 'inventory'), {
            projectId,
            name: data.title,
            description: 'Gerado automaticamente pelo Financeiro',
            quantity: 1,
            unitPrice: data.amount,
            totalPrice: data.amount,
            location: 'NÃO DEFINIDO',
            tags: [],
            assignedTo: [],
            taskId: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBudgetSubmit = async (data: { id?: string, amount: number, date: Date, name: string }) => {
    if (!projectId) return;
    try {
      const monthStr = data.date.toISOString().slice(0, 7);
      if (data.id) {
        // Edit existing
        await updateDoc(doc(db, 'budgets', data.id), {
          name: data.name,
          amount: data.amount,
          date: monthStr
        });
      } else {
        // Create new
        await addDoc(collection(db, 'budgets'), {
          projectId,
          name: data.name,
          amount: data.amount,
          date: monthStr,
          createdAt: serverTimestamp()
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try { await deleteDoc(doc(db, 'transactions', id)); } catch(e) { console.error(e) }
  };
  const handleDeleteBudget = async (id: string) => {
    try { await deleteDoc(doc(db, 'budgets', id)); } catch(e) { console.error(e) }
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let balance = 0;
  let incomeMonth = 0;
  let expenseMonth = 0;
  let totalBudget = 0;

  transactions.forEach(t => {
    const tDate = t.date?.toDate ? t.date.toDate() : new Date();
    if (t.type === 'income') {
      balance += t.amount;
      if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) incomeMonth += t.amount;
    } else {
      balance -= t.amount;
      if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) expenseMonth += t.amount;
    }
  });

  budgets.forEach(b => {
    totalBudget += b.amount;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);

    console.log('[PDF Export] Starting export...');

    let elementId = '';
    let fileName = '';
    const projectNameFormatted = project?.name?.replace(/\s+/g, '-') || 'Projeto';

    if (activeTab === 'Dashboard') {
      elementId = 'pdf-dashboard-container';
      fileName = `${projectNameFormatted}-Dashboard-${new Date().toISOString().substring(0, 7)}.pdf`;
    } else if (activeTab === 'Transações') {
      elementId = 'pdf-transactions-container';
      fileName = `${projectNameFormatted}-Transacoes-${new Date().toISOString().substring(0, 7)}.pdf`;
    } else {
      setIsExporting(false);
      return;
    }

    console.log('[PDF Export] Element ID:', elementId);

    const original = document.getElementById(elementId);
    if (!original) {
      console.error('[PDF Export] Target element not found:', elementId);
      setIsExporting(false);
      return;
    }

    console.log('[PDF Export] Original element found');

    // Give React time to render the loading overlay
    await new Promise(resolve => setTimeout(resolve, 150));

    try {
      console.log('[PDF Export] Building footer...');
      // 1. Build footer and append to ORIGINAL element
      const dateStr = new Date().toLocaleDateString('pt-BR');
      const logoImg = new Image();
      logoImg.src = logoIbit;
      logoImg.style.cssText = 'height: 44px; object-fit: contain; display: block;';
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
      });

      const footer = document.createElement('div');
      footer.setAttribute('data-pdf-footer', 'true');
      footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;width:100%;margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;box-sizing:border-box;';

      const labelSpan = document.createElement('span');
      labelSpan.style.cssText = `font-family:'lufga','Inter',sans-serif;font-size:16px;color:#6b7280;font-weight:500;`;
      labelSpan.textContent = `Relatório de ${activeTab} exportado em ${dateStr}`;

      footer.appendChild(labelSpan);
      footer.appendChild(logoImg);
      original.appendChild(footer);
      console.log('[PDF Export] Footer appended to original');

      // 2. Apply style fixes to ORIGINAL element
      console.log('[PDF Export] Applying style fixes...');
      const chartCards = [
        document.getElementById('pdf-pie-chart-card'),
        document.getElementById('pdf-cashflow-card'),
      ];
      const originalOverflows = chartCards.map(el => el?.style.overflow || '');
      chartCards.forEach(el => { if (el) el.style.overflow = 'visible'; });

      const cashFlowChart = document.getElementById('pdf-cashflow-chart-container');
      const originalChartHeight = cashFlowChart?.style.height || '';
      if (cashFlowChart) {
        cashFlowChart.style.height = '460px';
      }

      // 3. Wait for Recharts to re-render
      console.log('[PDF Export] Waiting 400ms for Recharts...');
      await new Promise(resolve => setTimeout(resolve, 400));

      // 4. Capture the ORIGINAL element
      console.log('[PDF Export] Capturing with toPng...');
      const dataUrl = await toPng(original, {
        cacheBust: true,
        backgroundColor: '#f8f9fa',
        pixelRatio: 2,
      });
      console.log('[PDF Export] Captured! DataUrl length:', dataUrl.length);

      // 5. Restore original styles
      chartCards.forEach((el, i) => { if (el) el.style.overflow = originalOverflows[i]; });
      if (cashFlowChart) {
        cashFlowChart.style.height = originalChartHeight;
      }

      // 6. Remove footer
      original.removeChild(footer);
      console.log('[PDF Export] Styles restored, footer removed');

      // 7. Generate PDF
      console.log('[PDF Export] Generating PDF...');

      // --- Compose PDF (1920x1080 landscape) ---
      const pdfWidth = 1920;
      const pdfHeight = 1080;
      const margin = 60;

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [pdfWidth, pdfHeight]
      });

      const availableWidth = pdfWidth - margin * 2;
      const availableHeight = pdfHeight - margin * 2;

      const imgProps = pdf.getImageProperties(dataUrl);
      const imgRatio = imgProps.height / imgProps.width;

      let drawWidth = availableWidth;
      let drawHeight = drawWidth * imgRatio;

      // For Dashboard: scale down to fit in a single page
      if (activeTab === 'Dashboard' && drawHeight > availableHeight) {
        drawHeight = availableHeight;
        drawWidth = drawHeight / imgRatio;
      }

      const xOffset = margin + (availableWidth - drawWidth) / 2;
      let yOffset = margin;
      if (drawHeight <= availableHeight) {
        yOffset = margin + (availableHeight - drawHeight) / 2;
      }

      let heightLeft = drawHeight;
      let position = yOffset;

      // Page 1
      pdf.setFillColor(248, 249, 250);
      pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
      pdf.addImage(dataUrl, 'PNG', xOffset, position, drawWidth, drawHeight);
      heightLeft -= availableHeight;

      // Additional pages for long transactions
      while (heightLeft > 0) {
        position -= availableHeight;
        pdf.addPage();
        pdf.setFillColor(248, 249, 250);
        pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
        pdf.addImage(dataUrl, 'PNG', xOffset, position, drawWidth, drawHeight);
        heightLeft -= availableHeight;
      }

      pdf.save(fileName);
      console.log('[PDF Export] PDF saved successfully:', fileName);
    } catch (error) {
      console.error('[PDF Export] Error during export:', error);
    }
    setIsExporting(false);
    console.log('[PDF Export] Export complete, isExporting set to false');
  };

  // Prepare data for the Pie Chart
  const expenseCategories: Record<string, number> = {};
  transactions.forEach(t => {
    if (t.type === 'expense') {
      const cat = t.category || 'Sem Categoria';
      expenseCategories[cat] = (expenseCategories[cat] || 0) + t.amount;
    }
  });

  const chartData = Object.keys(expenseCategories).map(key => ({
    name: key,
    value: expenseCategories[key]
  })).sort((a,b) => b.value - a.value);

  const totalChartValue = chartData.reduce((acc, curr) => acc + curr.value, 0);

  // Varied vibrant colors for better contrast
  const CHART_COLORS = ['#ff7f00', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#eab308', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-lg text-left">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{payload[0].name}</p>
          <p className="text-sm font-bold text-gray-900">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  // Prepare data for the Line Chart (Cumulative Cash Flow)
  const sortedTrans = [...transactions].sort((a,b) => {
    const da = a.date?.toDate ? a.date.toDate() : new Date();
    const db = b.date?.toDate ? b.date.toDate() : new Date();
    return da.getTime() - db.getTime(); 
  });

  const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  const rawMonths: { name: string; key: string; income: number; expense: number }[] = [];

  sortedTrans.forEach(t => {
     const date = t.date?.toDate ? t.date.toDate() : new Date();
     const m = date.getMonth();
     const y = date.getFullYear();
     const key = `${y}-${m.toString().padStart(2, '0')}`;
     
     let monthRow = rawMonths.find(r => r.key === key);
     if (!monthRow) {
       monthRow = { name: `${monthNames[m]}/${y.toString().slice(-2)}`, key, income: 0, expense: 0 };
       rawMonths.push(monthRow);
     }
     if (t.type === 'income') monthRow.income += t.amount;
     if (t.type === 'expense') monthRow.expense += t.amount;
  });

  let accIncome = 0;
  let accExpense = 0;
  const cashFlowData = rawMonths.map(row => {
     accIncome += row.income;
     accExpense += row.expense;
     return {
        name: row.name,
        Entrada: accIncome,
        Saída: accExpense
     };
  });

  const CustomizedFlowLabel = (props: any) => {
    const { x, y, value, fill, position = 'top' } = props;
    if (!value && value !== 0) return null;
    return (
      <text x={x} y={position === 'top' ? y - 16 : y + 22} dy={0} fill={fill} fontSize={10} fontWeight="bold" textAnchor="middle" opacity={0.9}>
        {formatCurrency(value)}
      </text>
    );
  };

  const CashFlowTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-lg text-left">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
             <p key={index} style={{ color: entry.color }} className="text-sm font-bold">
               {entry.name}: {formatCurrency(entry.value)}
             </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderDashboard = () => (
    <div id="pdf-dashboard-container" className="space-y-6 pb-10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col w-full h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center border border-orange-100">
              <Wallet className="w-5 h-5 text-[#ff7f00]" />
            </div>
            <span className="font-bold text-gray-400 uppercase tracking-[0.2em] text-[10px]">Saldo Atual</span>
          </div>
          <span className={clsx("text-3xl font-bold tracking-tight", balance >= 0 ? "text-gray-900" : "text-red-600")}>
            {formatCurrency(balance)}
          </span>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col w-full h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <PieChart className="w-5 h-5 text-indigo-500" />
            </div>
            <span className="font-bold text-gray-400 uppercase tracking-[0.2em] text-[10px]">Orçamento Total</span>
          </div>
          <span className="text-3xl font-bold text-gray-900 tracking-tight">{formatCurrency(totalBudget)}</span>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col w-full h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center border border-red-100">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <span className="font-bold text-gray-400 uppercase tracking-[0.2em] text-[10px]">Despesas do Mês</span>
          </div>
          <span className="text-3xl font-bold text-red-600 tracking-tight">{formatCurrency(expenseMonth)}</span>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col w-full h-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center border border-green-100">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <span className="font-bold text-gray-400 uppercase tracking-[0.2em] text-[10px]">Entradas do Mês</span>
          </div>
          <span className="text-3xl font-bold text-green-600 tracking-tight">{formatCurrency(incomeMonth)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        <div id="pdf-pie-chart-card" className="bg-white border border-gray-200 rounded-xl p-6 min-h-[300px] flex flex-col items-center justify-center text-center">
          <h3 className="font-bold text-gray-400 uppercase tracking-widest text-sm mb-6 w-full text-left flex items-center gap-2">
            <PieChart className="w-5 h-5 text-indigo-500" />
            Despesas por Categoria
          </h3>
          
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center opacity-50 flex-1">
              <PieChart className="w-12 h-12 text-gray-200 mb-4" />
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">NENHUMA DESPESA REGISTRADA</p>
            </div>
          ) : (
            <div className="w-full h-80 flex items-center justify-center gap-4">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={150}
                    dataKey="value"
                    onClick={(data) => setViewingCategory(data.name)}
                    className="cursor-pointer outline-none hover:opacity-80 transition-opacity"
                    isAnimationActive={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
                </RechartsPieChart>
              </ResponsiveContainer>
              <div className="flex flex-col w-1/3 p-2 bg-gray-50 rounded-lg border border-gray-100 max-h-72 overflow-y-auto scrollbar-hide text-left">
                 {chartData.map((entry, index) => {
                   const pct = totalChartValue > 0 ? Math.round((entry.value / totalChartValue) * 100) : 0;
                   return (
                     <button 
                        key={entry.name}
                        onClick={() => setViewingCategory(entry.name)}
                        className="flex items-center gap-2 p-2 hover:bg-white rounded transition-colors text-left"
                     >
                       <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></div>
                       <div className="flex flex-col overflow-hidden">
                         <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest truncate" title={entry.name}>{entry.name}</span>
                         <span className="text-[10px] font-bold text-gray-400">{pct}%</span>
                       </div>
                     </button>
                   );
                 })}
              </div>
            </div>
          )}
        </div>
        {/* CASH FLOW CARD */}
        <div 
          id="pdf-cashflow-card"
          onClick={() => setIsOpenFlowModal(true)}
          className="bg-white border border-gray-200 hover:border-[#ff7f00] transition-colors cursor-pointer rounded-xl p-6 min-h-[300px] flex flex-col items-center justify-center text-center group"
        >
          <div className="flex justify-between w-full mb-6 items-center">
            <h3 className="font-bold text-gray-400 uppercase tracking-widest text-sm flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500 group-hover:scale-110 transition-transform" />
              Fluxo de Caixa
            </h3>
            <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest group-hover:text-[#ff7f00] transition-colors">Ver Detalhes</span>
          </div>
          
          {cashFlowData.length === 0 ? (
             <div className="flex flex-col items-center justify-center opacity-50 flex-1">
              <TrendingUp className="w-12 h-12 text-gray-200 mb-4" />
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">NENHUMA TRANSAÇÃO HISTÓRICA</p>
            </div>
          ) : (
            <div id="pdf-cashflow-chart-container" className="w-full flex flex-col" style={{ height: '340px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashFlowData} margin={{ top: 35, right: 80, left: 35, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={['dataMin', 'dataMax']} padding={{ top: 20, bottom: 20 }} />
                  <Tooltip content={<CashFlowTooltip />} isAnimationActive={false} />
                  
                  <Line
                    type="monotone"
                    dataKey="Entrada"
                    stroke="#22c55e"
                    strokeWidth={3}
                    dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    label={<CustomizedFlowLabel fill="#22c55e" position="top" />}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Saída"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    label={<CustomizedFlowLabel fill="#ef4444" position="bottom" />}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-6 pb-2 shrink-0">
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-green-500"></div>
                   <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">ENTRADA DE CAPITAL</span>
                 </div>
                 <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full bg-red-500"></div>
                   <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">SAÍDA DE CAPITAL</span>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderTransactions = () => {
    if (transactions.length === 0) {
      return (
        <div id="pdf-transactions-container" className="flex-1 flex flex-col items-center justify-center opacity-50 min-h-[400px]">
          <FileText className="w-16 h-16 text-[#ff7f00] mb-4 stroke-1" />
          <h3 className="text-lg font-bold text-gray-900 uppercase tracking-widest mb-2">Nenhuma transação registrada</h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Adicione entradas ou saídas pelo menu acima</p>
        </div>
      );
    }
    return (
      <div id="pdf-transactions-container" className="bg-white border border-gray-200 rounded-xl overflow-hidden pt-2 pb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-400 font-bold text-[10px] uppercase tracking-wider">
              <th className="p-4">Descrição</th>
              <th className="p-4">Valor</th>
              <th className="p-4">Data</th>
              <th className="p-4">Categoria / Orçamento</th>
              <th className="p-4 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => {
              const d = t.date?.toDate ? t.date.toDate() : new Date();
              const linkedBudget = t.budgetId ? budgets.find(b => b.id === t.budgetId) : null;
              
              return (
                <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {t.type === 'income' ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                      <span className="font-bold text-gray-900 text-sm">{t.title || 'Sem título'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={clsx("font-bold text-sm tracking-wider", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                      {t.type === 'income' ? '+ ' : '- '}
                      {formatCurrency(t.amount)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-gray-500 text-xs font-bold font-mono tracking-wider">
                      <Calendar className="w-3.5 h-3.5" />
                      {d.toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 items-start">
                      {t.category && (
                        <span className="text-[9px] font-bold uppercase tracking-widest bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                          {t.category}
                        </span>
                      )}
                      {linkedBudget && (
                        <span className="text-[9px] font-bold uppercase tracking-widest bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-1">
                          <Wallet className="w-3 h-3" />
                          {linkedBudget.name}
                        </span>
                      )}
                      {t.receiptUrl && (
                        <a 
                          href={t.receiptUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[9px] font-bold uppercase tracking-widest bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1 hover:bg-blue-100 transition-colors"
                        >
                          <Paperclip className="w-3 h-3" />
                          NOTA FISCAL
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => {
                          setEditingTransaction(t);
                          if (t.type === 'income') setIsOpenIncomeModal(true);
                          else setIsOpenExpenseModal(true);
                        }} 
                        className="text-gray-400 hover:text-[#ff7f00]"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteTransaction(t.id)} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderBudgets = () => {
    if (budgets.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center opacity-50 min-h-[400px]">
          <Wallet className="w-16 h-16 text-[#ff7f00] mb-4 stroke-1" />
          <h3 className="text-lg font-bold text-gray-900 uppercase tracking-widest mb-2">Orçamento não definido</h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Planeje seus gastos futuros</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {budgets.map(b => {
          return (
            <div 
              key={b.id} 
              onClick={() => setViewingBudget(b)}
              className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col group relative cursor-pointer hover:border-[#ff7f00] hover:shadow-md transition-all h-full"
            >
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditingBudget(b); setIsOpenBudgetModal(true); }} 
                  className="text-gray-400 hover:text-[#ff7f00]"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteBudget(b.id) }} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center border border-orange-100 shrink-0">
                  <Wallet className="w-5 h-5 text-[#ff7f00]" />
                </div>
                <div className="flex flex-col min-w-0 pr-12">
                  <span className="font-bold text-gray-400 uppercase tracking-[0.2em] text-[10px]">Orçamento</span>
                  <span className="text-sm font-bold text-gray-900 truncate">{b.name}</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{b.date}</span>
                </div>
              </div>
              <span className="text-2xl font-bold text-gray-900 tracking-tight mt-auto pt-2">{formatCurrency(b.amount)}</span>
            </div>
          )
        })}
      </div>
    );
  };

  const getSubheaderActions = () => {
    switch (activeTab) {
      case 'Dashboard':
        return (
          <div className="flex items-center gap-3">
             <button 
               onClick={handleExportPDF}
               disabled={isExporting}
               className="flex flex-col md:flex-row items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-gray-200 transition-colors shadow-sm disabled:opacity-50"
               title="Exportar Dashboard"
             >
               {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Printer className="w-4 h-4 text-gray-500" />}
               {isExporting ? <span className="hidden md:inline">GERANDO PDF...</span> : <span className="hidden md:inline">EXPORTAR PDF</span>}
             </button>
          </div>
        );
      case 'Transações':
        return (
          <div className="flex flex-wrap items-center justify-end gap-3">
             <button 
               onClick={handleExportPDF}
               disabled={isExporting}
               className="flex flex-col md:flex-row items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 text-gray-700 font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-gray-200 transition-colors shadow-sm disabled:opacity-50"
               title="Exportar Transações"
             >
               {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Printer className="w-4 h-4 text-gray-500" />}
               {isExporting ? <span className="hidden md:inline">GERANDO PDF...</span> : <span className="hidden md:inline">EXPORTAR PDF</span>}
             </button>
            <button 
              onClick={() => { setEditingTransaction(null); setIsOpenExpenseModal(true); }}
              className="bg-white text-gray-700 border border-gray-300 px-4 py-2 flex items-center gap-2 transition-all font-bold uppercase tracking-wider text-xs rounded-lg hover:bg-gray-50 active:scale-95 shadow-sm"
            >
              <TrendingDown className="w-4 h-4 text-gray-700" />
              NOVA DESPESA
            </button>
            <button 
              onClick={() => { setEditingTransaction(null); setIsOpenIncomeModal(true); }}
              className="bg-[#ff7f00] text-white px-4 py-2 flex items-center gap-2 transition-all font-bold uppercase tracking-wider text-xs rounded-lg hover:bg-orange-600 active:scale-95 shadow-sm shadow-orange-100"
            >
              <TrendingUp className="w-4 h-4" />
              NOVA ENTRADA
            </button>
          </div>
        );
      case 'Orçamento':
        return (
          <button 
            onClick={() => { setEditingBudget(null); setIsOpenBudgetModal(true); }}
            className="bg-[#ff7f00] text-white px-4 py-2 flex items-center gap-2 transition-all font-bold uppercase tracking-wider text-xs rounded-lg hover:bg-orange-600 active:scale-95 shadow-md shadow-orange-100"
          >
            <Wallet className="w-4 h-4" />
            DEFINIR ORÇAMENTO
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#f8f9fa] overflow-hidden">
      <Sidebar 
        projectId={projectId} 
          projectName={project?.name} 
          onOpenSettings={user?.uid === project?.ownerId ? () => setIsSettingsOpen(true) : undefined} 
        />
        
        <main className="flex-1 flex flex-col min-w-0">
          <header className="border-b border-gray-200 bg-white p-4 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border border-gray-100 shrink-0">
              {project?.photoURL ? (
                <img src={project.photoURL} alt={project.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">🏎️</span>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-wider leading-tight text-gray-900 truncate">
                {project?.name || 'Carregando...'} {project?.shortId && `- #${project.shortId}`}
              </h2>
            </div>

            <div className="flex items-center ml-4 shrink-0">
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

        <div className="border-b border-gray-200 bg-white p-4 flex justify-between items-center shrink-0 z-10 transition-all">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2 border-r border-gray-200 pr-6">
              <DollarSign className="w-5 h-5 text-[#ff7f00]" />
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-widest hidden sm:block">
                GESTÃO FINANCEIRA
              </h2>
            </div>
            <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-1">
              {(['Dashboard', 'Transações', 'Orçamento'] as FinanceTab[]).map((tab, idx) => (
                <React.Fragment key={tab}>
                  <button
                    onClick={() => setActiveTab(tab)}
                    className={clsx(
                      "px-4 py-1.5 font-bold uppercase tracking-wider text-[10px] sm:text-xs rounded-md transition-colors",
                      activeTab === tab
                        ? "text-[#ff7f00] bg-white shadow-sm"
                        : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                    )}
                  >
                    {tab}
                  </button>
                  {idx < 2 && <div className="w-px bg-gray-200 my-1"></div>}
                </React.Fragment>
              ))}
            </div>
          </div>
          {getSubheaderActions()}
        </div>

        <div className="flex-1 p-6 overflow-y-auto bg-[#f8f9fa] scrollbar-hide">
          <div className="w-full h-full">
            {activeTab === 'Dashboard' && renderDashboard()}
            {activeTab === 'Transações' && renderTransactions()}
            {activeTab === 'Orçamento' && renderBudgets()}
          </div>
        </div>
      </main>

      {isExporting && (
        <div className="fixed inset-0 z-[9999] bg-[#f8f9fa] flex flex-col items-center justify-center transition-all">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white p-10 rounded-2xl shadow-xl flex flex-col items-center max-w-sm text-center border border-gray-200"
          >
            <Loader2 className="w-16 h-16 animate-spin text-[#ff7f00] mb-6" />
            <h2 className="text-xl font-bold text-gray-900 tracking-widest uppercase mb-2">Gerando Relatório</h2>
            <p className="text-gray-500 text-sm font-medium">Renderizando gráficos de alta resolução para impressão. Isso pode levar alguns segundos.</p>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {isOpenExpenseModal && (
          <FinanceTransactionModal 
            title={editingTransaction ? "EDITAR DESPESA" : "REGISTRAR DESPESA"} 
            type="expense"
            initialData={editingTransaction}
            budgets={budgets} // For linking
            onClose={() => { setIsOpenExpenseModal(false); setEditingTransaction(null); }}
            onSubmit={(data) => { handleTransactionSubmit(data, 'expense'); setIsOpenExpenseModal(false); setEditingTransaction(null); }}
          />
        )}
        {isOpenIncomeModal && (
          <FinanceTransactionModal 
            title={editingTransaction ? "EDITAR ENTRADA" : "REGISTRAR ENTRADA"} 
            type="income"
            initialData={editingTransaction}
            budgets={budgets}
            onClose={() => { setIsOpenIncomeModal(false); setEditingTransaction(null); }}
            onSubmit={(data) => { handleTransactionSubmit(data, 'income'); setIsOpenIncomeModal(false); setEditingTransaction(null); }}
          />
        )}
        {isOpenBudgetModal && (
          <FinanceBudgetModal 
            title={editingBudget ? "EDITAR ORÇAMENTO" : "DEFINIR ORÇAMENTO"} 
            initialData={editingBudget}
            onClose={() => { setIsOpenBudgetModal(false); setEditingBudget(null); }}
            onSubmit={(data) => { handleBudgetSubmit(data); setIsOpenBudgetModal(false); setEditingBudget(null); }}
          />
        )}
        {viewingBudget && (
          <BudgetDetailsModal 
            budget={viewingBudget}
            transactions={transactions}
            onClose={() => setViewingBudget(null)}
          />
        )}
        {viewingCategory && (
          <CategoryDetailsModal 
            categoryName={viewingCategory}
            transactions={transactions}
            onClose={() => setViewingCategory(null)}
          />
        )}
        {isOpenFlowModal && (
          <CashFlowDetailsModal 
            cashFlowData={cashFlowData}
            onClose={() => setIsOpenFlowModal(false)}
          />
        )}
      </AnimatePresence>

      {isSettingsOpen && project && (
        <ProjectSettingsModal 
          onClose={() => setIsSettingsOpen(false)} 
          project={project} 
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------
// Modal for Transactions (Income/Expense)
// ---------------------------------------------------------
interface FinanceTransactionModalProps {
  title: string;
  type: 'expense' | 'income';
  initialData: Transaction | null;
  budgets: Budget[];
  onClose: () => void;
  onSubmit: (data: { id?: string, title: string, amount: number, date: Date, category: string, budgetId: string, receiptUrl: string, createInventoryItem: boolean }) => void;
}

function FinanceTransactionModal({ title, type, initialData, budgets, onClose, onSubmit }: FinanceTransactionModalProps) {
  const defaultDateStr = initialData?.date?.toDate ? initialData.date.toDate().toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    amount: initialData?.amount ? initialData.amount.toString() : '',
    date: defaultDateStr,
    category: initialData?.category || '',
    budgetId: initialData?.budgetId || '',
    receiptUrl: initialData?.receiptUrl || '',
    createInventoryItem: false
  });

  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount || !formData.date) return;
    if (isUploading) return;
    onSubmit({
      id: initialData?.id,
      title: formData.title,
      amount: parseFloat(formData.amount.replace(',', '.')),
      date: new Date(formData.date + 'T12:00:00'),
      category: formData.category,
      budgetId: formData.budgetId,
      receiptUrl: formData.receiptUrl,
      createInventoryItem: formData.createInventoryItem
    });
  };

  const handleUploadReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
       alert('Por favor, selecione apenas imagens.');
       return;
    }

    setIsUploading(true);
    try {
      const compressedBlob = await compressImage(file);
      const uniqueFilename = `receipt-${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
      const uploadData = new FormData();
      uploadData.append('file', compressedBlob, uniqueFilename);
      uploadData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: uploadData
      });
      const json = await res.json();
      if (json.secure_url) {
        setFormData(prev => ({ ...prev, receiptUrl: json.secure_url }));
      }
    } catch(err) {
       console.error("Upload Error", err);
       alert("Erro ao fazer upload da imagem.");
    } finally {
       setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-gray-200 w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50 shrink-0">
          <h3 className={clsx("text-lg font-bold uppercase tracking-widest text-gray-900")}>
            {title}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form id="transaction-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">TÍTULO DA TRANSAÇÃO</label>
            <input 
              type="text" 
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-lg placeholder-gray-300 transition-colors" 
              placeholder="Ex: Compra de Motores..." 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">VALOR (R$)</label>
              <input 
                type="number" 
                step="0.01"
                required
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                className="w-full bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-lg placeholder-gray-300 transition-colors" 
                placeholder="0,00" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">DATA</label>
              <input 
                type="date"
                required
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-lg transition-colors" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={clsx(type === 'income' ? 'col-span-2' : 'col-span-1')}>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">CATEGORIA</label>
              <input 
                type="text"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Patrocínio..."
                className="w-full bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-lg transition-colors placeholder-gray-300"
              />
            </div>
            {type === 'expense' && (
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">VINCULAR ORÇAMENTO</label>
                <select
                  value={formData.budgetId}
                  onChange={e => setFormData({ ...formData, budgetId: e.target.value })}
                  className="w-full bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-lg transition-colors"
                >
                  <option value="">Nenhum vínculo</option>
                  {budgets.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {type === 'expense' && !initialData && (
            <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
              <input 
                type="checkbox" 
                checked={formData.createInventoryItem}
                onChange={e => setFormData({ ...formData, createInventoryItem: e.target.checked })}
                className="w-5 h-5 accent-[#ff7f00] cursor-pointer rounded border-gray-300"
              />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-900">Criar registro no inventário</span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Gera um item automaticamente no Inventário do projeto</span>
              </div>
            </label>
          )}

          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">COMPROVANTE / NOTA FISCAL (OPCIONAL)</label>
            
            {formData.receiptUrl ? (
              <div className="flex items-center gap-4 bg-gray-50 p-4 border border-gray-200 rounded-xl relative group">
                <img src={formData.receiptUrl} alt="Comprovante" className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-gray-900">Comprovante Anexado</span>
                  <a href={formData.receiptUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase tracking-widest text-[#ff7f00] hover:underline">Ver imagem completa</a>
                </div>
                <button 
                  type="button" 
                  onClick={() => setFormData(prev => ({ ...prev, receiptUrl: '' }))}
                  className="absolute top-2 right-2 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className={clsx(
                "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-all",
                isUploading ? "border-orange-300 bg-orange-50/50" : "border-gray-300 hover:border-[#ff7f00] hover:bg-orange-50/30 cursor-pointer"
              )}>
                {isUploading ? (
                  <>
                    <div className="w-12 h-12 bg-white shadow-sm rounded-full flex items-center justify-center mb-3">
                      <Loader2 className="w-5 h-5 text-[#ff7f00] animate-spin" />
                    </div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center animate-pulse">Comprimindo e enviando...</p>
                  </>
                ) : (
                  <>
                    <input 
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      onChange={handleUploadReceipt}
                    />
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-white transition-colors">
                      <Upload className="w-5 h-5 text-gray-400 group-hover:text-[#ff7f00] transition-colors" />
                    </div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">
                      CLIQUE PARA SELECIONAR A IMAGEM<br/>
                      <span className="text-[10px] text-gray-400 font-medium normal-case tracking-normal">(JPG, PNG, WEBP) será comprimida automaticamente</span>
                    </p>
                  </>
                )}
              </label>
            )}
          </div>
        </form>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0">
          <button onClick={onClose} type="button" className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-gray-50 transition-colors">
            CANCELAR
          </button>
          <button disabled={isUploading} type="submit" form="transaction-form" className="flex-1 px-4 py-3 bg-[#ff7f00] text-white font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-orange-600 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 transition-all">
            {isUploading ? 'ENVIANDO...' : 'SALVAR'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------
// Modal for Budgets
// ---------------------------------------------------------
interface FinanceBudgetModalProps {
  title: string;
  initialData: Budget | null;
  onClose: () => void;
  onSubmit: (data: { id?: string, name: string, amount: number, date: Date }) => void;
}

function FinanceBudgetModal({ title, initialData, onClose, onSubmit }: FinanceBudgetModalProps) {
  const defaultYearMonth = initialData ? initialData.date : new Date().toISOString().slice(0, 7);
  
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    amount: initialData?.amount ? initialData.amount.toString() : '',
    date: defaultYearMonth
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount || !formData.date) return;
    onSubmit({
      id: initialData?.id,
      name: formData.name,
      amount: parseFloat(formData.amount.replace(',', '.')),
      date: new Date(formData.date + '-01T12:00:00')
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-gray-200 w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50 shrink-0">
          <h3 className={clsx("text-lg font-bold uppercase tracking-widest text-gray-900")}>
            {title}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form id="budget-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col p-6 space-y-6 scrollbar-hide">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">NOME DO ORÇAMENTO</label>
            <input 
              type="text" 
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-lg placeholder-gray-300 transition-colors" 
              placeholder="Ex: Construção Chassi..." 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">VALOR (R$)</label>
              <input 
                type="number" 
                step="0.01"
                required
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                className="w-full bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-lg placeholder-gray-300 transition-colors" 
                placeholder="0,00" 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">MÊS DE REFERÊNCIA</label>
              <input 
                type="month"
                required
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#ff7f00] font-bold rounded-lg transition-colors" 
              />
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3 mt-auto shrink-0">
          <button onClick={onClose} type="button" className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-gray-50 transition-colors">
            CANCELAR
          </button>
          <button type="submit" form="budget-form" className="flex-1 px-4 py-3 bg-[#ff7f00] text-white font-bold uppercase tracking-widest text-xs rounded-lg hover:bg-orange-600 active:scale-95 flex items-center justify-center gap-2 transition-all">
            SALVAR
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------
// Modal for Viewing Budget Details
// ---------------------------------------------------------
function BudgetDetailsModal({ budget, transactions, onClose }: { budget: Budget, transactions: Transaction[], onClose: () => void }) {
  const linkedTransactions = transactions.filter(t => t.budgetId === budget.id);
  const totalSpent = linkedTransactions.reduce((acc, t) => acc + t.amount, 0);
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-gray-200 w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
             <Wallet className="w-5 h-5 text-[#ff7f00]" />
             <h3 className="text-lg font-bold uppercase tracking-widest text-gray-900">
               DETALHES DO ORÇAMENTO
             </h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 bg-white border-b border-gray-100 flex justify-between items-center shrink-0">
           <div>
             <h4 className="text-xl font-bold text-gray-900">{budget.name}</h4>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{budget.date}</p>
           </div>
           <div className="text-right">
             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">DISPONÍVEL / TOTAL</span>
             <p className="text-lg font-bold text-gray-900">
               <span className={clsx("mr-2", budget.amount - totalSpent >= 0 ? "text-green-600" : "text-red-600")}>
                  {formatCurrency(budget.amount - totalSpent)}
               </span>
               <span className="text-gray-400 text-sm">/ {formatCurrency(budget.amount)}</span>
             </p>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 scrollbar-hide">
           <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">TRANSAÇÕES VINCULADAS ({linkedTransactions.length})</h4>
           
           {linkedTransactions.length === 0 ? (
             <div className="flex flex-col items-center justify-center opacity-50 py-10">
                <FileText className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">NENHUMA TRANSAÇÃO ENCONTRADA</p>
             </div>
           ) : (
             <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <tbody>
                    {linkedTransactions.map(t => {
                      const d = t.date?.toDate ? t.date.toDate() : new Date();
                      return (
                        <tr key={t.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {t.type === 'income' ? <TrendingUp className="w-4 h-4 text-green-500 shrink-0" /> : <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />}
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-900 text-sm">{t.title || 'Sem título'}</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{d.toLocaleDateString('pt-BR')}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                             <span className={clsx("font-bold text-sm tracking-wider", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                               {t.type === 'income' ? '+ ' : '- '}
                               {formatCurrency(t.amount)}
                             </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
             </div>
           )}
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------
// Modal for Viewing Category Details
// ---------------------------------------------------------
function CategoryDetailsModal({ categoryName, transactions, onClose }: { categoryName: string, transactions: Transaction[], onClose: () => void }) {
  const linkedTransactions = transactions.filter(t => t.type === 'expense' && (t.category || 'Sem Categoria') === categoryName);
  const totalSpent = linkedTransactions.reduce((acc, t) => acc + t.amount, 0);
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-gray-200 w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
             <PieChart className="w-5 h-5 text-indigo-500" />
             <h3 className="text-lg font-bold uppercase tracking-widest text-gray-900">
               DETALHES DA CATEGORIA
             </h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 bg-white border-b border-gray-100 flex justify-between items-center shrink-0">
           <div>
             <h4 className="text-xl font-bold text-gray-900">{categoryName}</h4>
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">TRANSAÇÕES: {linkedTransactions.length}</p>
           </div>
           <div className="text-right">
             <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">TOTAL GASTO NESSA CATEGORIA</span>
             <p className="text-2xl font-bold text-red-600">
               {formatCurrency(totalSpent)}
             </p>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 scrollbar-hide">
           <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">HISTÓRICO DE DESPESAS</h4>
           
           {linkedTransactions.length === 0 ? (
             <div className="flex flex-col items-center justify-center opacity-50 py-10">
                <FileText className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">NENHUMA DESPESA ENCONTRADA</p>
             </div>
           ) : (
             <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <tbody>
                    {linkedTransactions.map(t => {
                      const d = t.date?.toDate ? t.date.toDate() : new Date();
                      return (
                        <tr key={t.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <TrendingDown className="w-4 h-4 text-red-500 shrink-0" />
                              <div className="flex flex-col">
                                <span className="font-bold text-gray-900 text-sm">{t.title || 'Sem título'}</span>
                                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{d.toLocaleDateString('pt-BR')}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                             <span className="font-bold text-sm tracking-wider text-red-600">
                               - {formatCurrency(t.amount)}
                             </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
             </div>
           )}
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------
// Modal for Large Cash Flow
// ---------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CashFlowDetailsModal({ cashFlowData, onClose }: { cashFlowData: any[], onClose: () => void }) {
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

  const CustomizedFlowLabel = (props: any) => {
    const { x, y, value, fill, position = 'top' } = props;
    return (
      <text x={x} y={position === 'top' ? y - 12 : y + 18} dy={0} fill={fill} fontSize={10} fontWeight="900" textAnchor="middle" stroke="white" strokeWidth={3} paintOrder="stroke" strokeLinecap="round" strokeLinejoin="round">
        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
      </text>
    );
  };

  const CashFlowTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-2xl text-left">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-100 pb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
             <p key={index} style={{ color: entry.color }} className="text-sm font-bold my-1">
               {entry.name}: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.value)}
             </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-gray-200 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh]"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
             <TrendingUp className="w-6 h-6 text-[#ff7f00]" />
             <h3 className="text-xl font-bold uppercase tracking-widest text-gray-900">
               FLUXO DE CAIXA
             </h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-900 transition-colors p-2 hover:bg-gray-200 rounded-full">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 p-8 bg-white min-h-0 flex flex-col relative w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashFlowData} margin={{ top: 40, right: 80, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 'bold', fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} dy={10} />
                <YAxis 
                  domain={['dataMin', 'dataMax']} 
                  padding={{ top: 20, bottom: 20 }} 
                  tickFormatter={formatCurrency} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9ca3af' }}
                  axisLine={false} 
                  tickLine={false}
                  width={80}
                />
                <Tooltip content={<CashFlowTooltip />} isAnimationActive={false} />
                
                <Line 
                  type="monotone" 
                  dataKey="Entrada" 
                  stroke="#22c55e" 
                  strokeWidth={4} 
                  dot={{ fill: '#22c55e', strokeWidth: 3, r: 6 }}
                  activeDot={{ r: 8, stroke: 'white', strokeWidth: 2 }}
                  label={<CustomizedFlowLabel fill="#22c55e" position="top" />}
                  isAnimationActive={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="Saída" 
                  stroke="#ef4444" 
                  strokeWidth={4} 
                  dot={{ fill: '#ef4444', strokeWidth: 3, r: 6 }}
                  activeDot={{ r: 8, stroke: 'white', strokeWidth: 2 }}
                  label={<CustomizedFlowLabel fill="#ef4444" position="bottom" />}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-center gap-10 shrink-0 rounded-b-2xl">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-green-500 shadow-sm border border-green-600"></div>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-widest">ENTRADA DE CAPITAL</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-red-500 shadow-sm border border-red-600"></div>
              <span className="text-xs font-bold text-gray-700 uppercase tracking-widest">SAÍDA DE CAPITAL</span>
            </div>
        </div>
      </motion.div>
    </div>
  );
}
