import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, ListTodo, Calendar, Wallet, Loader2, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import ibitLogo from '../media/ibitlogo.svg';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

interface PublicDashboardData {
  project: {
    id: string;
    name: string;
    shortId: string;
    photoURL: string | null;
    targetEventName: string | null;
    targetDate: any;
  };
  kpis: {
    todoCount: number;
    completedLast7Days: number;
    balance: number;
    countdown: number | null;
  };
  charts: {
    chartData: Array<{ name: string; value: number }>;
    cashFlowData: Array<{ name: string; Entrada: number; Saída: number }>;
  };
  members: Array<{
    uid: string;
    name: string;
    photoURL?: string;
  }>;
}

export default function PublicAudit() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        console.log('[PublicAudit] Fetching data for token:', token);

        // Use Vercel API endpoint (uses firebase-admin to bypass security rules)
        const response = await fetch(`/api/public-dashboard?token=${token}`);

        if (!response.ok) {
          // Check if we're in development and API is not available
          if (response.status === 404 && window.location.hostname === 'localhost') {
            console.log('[PublicAudit] API not available in local development');
            setError('Funcionalidade disponível apenas em produção. Faça deploy no Vercel para testar.');
            setLoading(false);
            return;
          }

          const errorData = await response.json();
          console.log('[PublicAudit] API error:', errorData);
          setError(errorData.error || 'Link inválido ou expirado');
          setLoading(false);
          return;
        }

        const apiData = await response.json();
        console.log('[PublicAudit] Data received from API:', apiData);

        setData(apiData);
        setLoading(false);
      } catch (err) {
        console.error('[PublicAudit] Error fetching public data:', err);

        // Check if we're in development
        if (window.location.hostname === 'localhost') {
          setError('Funcionalidade disponível apenas em produção. Faça deploy no Vercel para testar.');
        } else {
          setError('Erro ao carregar dados');
        }
        setLoading(false);
      }
    };

    if (token) {
      fetchPublicData();
    }
  }, [token]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const CHART_COLORS = ['#ff7f00', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#eab308', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-[#ff7f00] animate-spin mb-4" />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">Carregando dashboard...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900 mb-2">
            Acesso Negado
          </h1>
          <p className="text-sm text-gray-600">
            {error || 'Link inválido ou expirado'}
          </p>
        </div>
      </div>
    );
  }

  const { project, kpis, members } = data;

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center gap-4">
          <img src={ibitLogo} alt="IBIT" className="h-12" />
          <div className="text-center">
            <h1 className="text-2xl font-bold uppercase tracking-wider text-gray-900">
              {project.name} - #{project.shortId}
            </h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
              Dashboard Público - Somente Leitura
            </p>
          </div>
          {/* Members */}
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {members.map((member) => (
                <div key={member.uid} className="relative inline-block" title={member.name}>
                  {member.photoURL ? (
                    <img
                      src={member.photoURL}
                      alt={member.name}
                      className="w-8 h-8 rounded-full border-2 border-white object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                      {member.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 border border-gray-200 rounded-md">
              {members.length} {members.length === 1 ? 'MEMBRO' : 'MEMBROS'}
            </span>
          </div>
        </div>
      </header>

      {/* KPIs */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* KPI 1: Tarefas a Fazer */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
              <ListTodo className="w-6 h-6 text-[#ff7f00]" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">
                Tarefas a fazer
              </p>
              <p className="text-3xl font-bold tabular-nums text-[#ff7f00] leading-none">{kpis.todoCount}</p>
            </div>
          </div>

          {/* KPI 2: Concluídas (7 dias) */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-[#ff7f00]" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">
                Concluídas (7 dias)
              </p>
              <p className="text-3xl font-bold tabular-nums text-[#ff7f00] leading-none">{kpis.completedLast7Days}</p>
            </div>
          </div>

          {/* KPI 3: Contagem Regressiva */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
              <Calendar className="w-6 h-6 text-[#ff7f00]" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">
                Contagem Regressiva
              </p>
              {kpis.countdown !== null ? (
                <>
                  <p className="text-3xl font-bold tabular-nums text-[#ff7f00] leading-none">
                    Faltam {kpis.countdown} {kpis.countdown === 1 ? 'Dia' : 'Dias'}
                  </p>
                  {project.targetEventName && (
                    <p className="text-[9px] text-gray-500 mt-1 truncate">{project.targetEventName}</p>
                  )}
                </>
              ) : (
                <p className="text-sm font-bold text-gray-400">Sem evento</p>
              )}
            </div>
          </div>

          {/* KPI 4: Saldo Atual */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-4">
            <div className={clsx(
              "w-12 h-12 rounded-lg border flex items-center justify-center shrink-0",
              kpis.balance >= 0 ? "bg-orange-50 border-orange-100" : "bg-red-50 border-red-100"
            )}>
              <Wallet className={clsx("w-6 h-6", kpis.balance >= 0 ? "text-[#ff7f00]" : "text-red-600")} />
            </div>
            <div className="text-left min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">
                Saldo Atual
              </p>
              <p className={clsx(
                "text-3xl font-bold tabular-nums leading-none",
                kpis.balance >= 0 ? "text-[#ff7f00]" : "text-red-600"
              )}>
                {formatCurrency(kpis.balance)}
              </p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Pie Chart - Despesas por Categoria */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 min-h-[400px] flex flex-col">
            <h3 className="font-bold text-gray-400 uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-indigo-500" />
              Despesas por Categoria
            </h3>
            {data.charts.chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center opacity-50 flex-1">
                <PieChartIcon className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Nenhuma despesa registrada</p>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center gap-4">
                <ResponsiveContainer width="60%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.charts.chartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      isAnimationActive={false}
                    >
                      {data.charts.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-lg">
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{payload[0].name}</p>
                              <p className="text-sm font-bold text-gray-900">{formatCurrency(payload[0].value)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      isAnimationActive={false}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col w-1/3 p-2 bg-gray-50 rounded-lg border border-gray-100 max-h-72 overflow-y-auto scrollbar-hide text-left">
                  {data.charts.chartData.map((entry, index) => {
                    const totalChartValue = data.charts.chartData.reduce((acc, curr) => acc + curr.value, 0);
                    const pct = totalChartValue > 0 ? Math.round((entry.value / totalChartValue) * 100) : 0;
                    return (
                      <div
                        key={entry.name}
                        className="flex items-center gap-2 p-2 rounded text-left"
                      >
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}></div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest truncate" title={entry.name}>{entry.name}</span>
                          <span className="text-[10px] font-bold text-gray-400">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Line Chart - Fluxo de Caixa */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 min-h-[400px] flex flex-col">
            <h3 className="font-bold text-gray-400 uppercase tracking-widest text-sm mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              Fluxo de Caixa
            </h3>
            {data.charts.cashFlowData.length === 0 ? (
              <div className="flex flex-col items-center justify-center opacity-50 flex-1">
                <TrendingUp className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Nenhuma transação histórica</p>
              </div>
            ) : (
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.charts.cashFlowData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold', fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-lg">
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">{payload[0].payload.name}</p>
                              <p className="text-xs font-bold text-green-600">Entrada: {formatCurrency(payload[0].value)}</p>
                              <p className="text-xs font-bold text-red-600">Saída: {formatCurrency(payload[1].value)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Entrada"
                      stroke="#22c55e"
                      strokeWidth={3}
                      dot={{ fill: '#22c55e', strokeWidth: 2, r: 4 }}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Saída"
                      stroke="#ef4444"
                      strokeWidth={3}
                      dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-center gap-2">
          <span className="text-xs text-gray-400 uppercase tracking-wider">Powered by</span>
          <img src={ibitLogo} alt="IBIT" className="h-6" />
        </div>
      </footer>
    </div>
  );
}
