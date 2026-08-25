'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, TrendingUp, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { API_URL } from '@/lib/api';

interface DashboardData {
  timestamp: string;
  logins: { total: number; unique_users: number };
  requisicoes: { total: number; success: number; errors: number; custo_apify: number };
  usuarios_24h: number;
  refreshes: Array<{
    niche_key: string;
    nicho: string;
    last_refresh: string | null;
    next_refresh: string | null;
    videos_count: number;
    status: string;
  }>;
}

interface ActivityLog {
  id: number;
  timestamp: string;
  event_type: string;
  user_id: string | null;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  apify_cost: number;
  error_message: string | null;
}

export default function AdminDashboard({ onClose }: { onClose: () => void }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'activity' | 'refreshes'>('overview');

  const fetchData = async () => {
    try {
      const [dashRes, actRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/dashboard`),
        fetch(`${API_URL}/api/admin/activity?limit=50`)
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (actRes.ok) {
        const data = await actRes.json();
        setActivity(data.logs);
      }
    } catch (e) {
      console.error('Erro:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // atualiza a cada 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-6">Carregando...</div>;
  if (!dashboard) return <div className="p-6">Erro ao carregar dashboard</div>;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">📊 Admin Dashboard</h1>
          <button
            onClick={onClose}
            className="text-white hover:opacity-80 transition-opacity"
          >
            <ArrowLeft size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 flex">
          {(['overview', 'activity', 'refreshes'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-6 py-3 font-semibold transition-colors ${
                tab === t
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {t === 'overview' ? '📈 Visão Geral' : t === 'activity' ? '📋 Atividades' : '🔄 Refreshes'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Overview Tab */}
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Card: Logins */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-600 font-semibold">Logins (24h)</p>
                      <p className="text-3xl font-bold text-blue-900">{dashboard.logins.total}</p>
                      <p className="text-xs text-blue-600 mt-1">
                        {dashboard.logins.unique_users} usuários únicos
                      </p>
                    </div>
                    <Users size={32} className="text-blue-400" />
                  </div>
                </div>

                {/* Card: Requisições */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-600 font-semibold">Requisições (24h)</p>
                      <p className="text-3xl font-bold text-green-900">{dashboard.requisicoes.total}</p>
                      <p className="text-xs text-green-600 mt-1">
                        ✅ {dashboard.requisicoes.success} | ❌ {dashboard.requisicoes.errors}
                      </p>
                    </div>
                    <TrendingUp size={32} className="text-green-400" />
                  </div>
                </div>

                {/* Card: Custo Apify */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-purple-600 font-semibold">Custo Apify (24h)</p>
                      <p className="text-3xl font-bold text-purple-900">R$ {parseFloat(String(dashboard.requisicoes.custo_apify)).toFixed(2)}</p>
                      <p className="text-xs text-purple-600 mt-1">Gastos hoje</p>
                    </div>
                    <AlertCircle size={32} className="text-purple-400" />
                  </div>
                </div>

                {/* Card: Usuários Ativos */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-orange-600 font-semibold">Usuários Ativos</p>
                      <p className="text-3xl font-bold text-orange-900">{dashboard.usuarios_24h}</p>
                      <p className="text-xs text-orange-600 mt-1">Últimas 24h</p>
                    </div>
                    <CheckCircle size={32} className="text-orange-400" />
                  </div>
                </div>
              </div>

              {/* Refreshes Status */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-3">Status dos Refreshes</h3>
                <div className="space-y-2">
                  {dashboard.refreshes.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nenhum refresh ainda</p>
                  ) : (
                    dashboard.refreshes.map(r => (
                      <div key={r.niche_key} className="flex items-center justify-between bg-white p-3 rounded border border-gray-200">
                        <div>
                          <p className="font-semibold text-gray-800">{r.nicho}</p>
                          <p className="text-xs text-gray-500">
                            {r.last_refresh ? `Atualizado: ${new Date(r.last_refresh).toLocaleString('pt-BR')}` : 'Nunca atualizado'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-600">{r.videos_count} vídeos</p>
                          <p className="text-xs text-gray-500">{r.status}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* Activity Tab */}
          {tab === 'activity' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Últimas Atividades</h3>
                <button
                  onClick={fetchData}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <RefreshCw size={20} />
                </button>
              </div>
              {activity.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhuma atividade registrada</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left">Timestamp</th>
                        <th className="px-4 py-2 text-left">Evento</th>
                        <th className="px-4 py-2 text-left">Endpoint</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2 text-right">Tempo (ms)</th>
                        <th className="px-4 py-2 text-right">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.map(log => (
                        <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-600 text-xs">
                            {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                          </td>
                          <td className="px-4 py-2 font-medium text-gray-800">{log.event_type}</td>
                          <td className="px-4 py-2 text-gray-600 text-xs">{log.endpoint}</td>
                          <td className="px-4 py-2 text-center">
                            {log.status_code >= 200 && log.status_code < 300 ? (
                              <span className="text-green-600 font-bold">{log.status_code}</span>
                            ) : (
                              <span className="text-red-600 font-bold">{log.status_code}</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600">{log.response_time_ms}</td>
                          <td className="px-4 py-2 text-right font-semibold text-purple-600">
                            {log.apify_cost ? `R$ ${log.apify_cost}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Refreshes Tab */}
          {tab === 'refreshes' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Histórico de Refreshes</h3>
              {dashboard.refreshes.length === 0 ? (
                <p className="text-gray-500">Nenhum refresh executado ainda</p>
              ) : (
                <div className="space-y-3">
                  {dashboard.refreshes.map(r => (
                    <div key={r.niche_key} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-lg text-gray-800">{r.nicho}</h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          r.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {r.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Última atualização</p>
                          <p className="font-semibold text-gray-800">
                            {r.last_refresh ? new Date(r.last_refresh).toLocaleString('pt-BR') : 'Nunca'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Próxima atualização</p>
                          <p className="font-semibold text-gray-800">
                            {r.next_refresh ? new Date(r.next_refresh).toLocaleString('pt-BR') : 'Agendado'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Vídeos no cache</p>
                          <p className="font-semibold text-blue-600 text-lg">{r.videos_count}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-6 py-4 text-xs text-gray-600 border-t border-gray-200">
          Atualizado em: {new Date(dashboard.timestamp).toLocaleString('pt-BR')} | Auto-refresh a cada 10s
        </div>
      </div>
    </div>
  );
}
