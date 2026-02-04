
import React, { useMemo, useState, useEffect } from 'react';
import { Product, Sale, Client } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, DollarSign, AlertTriangle, FileDown, Calendar, RefreshCw, ShoppingBag, CreditCard, Package, Users, Target } from 'lucide-react';
import { DataService } from '../services/dataService';
import { formatCurrency, Toast } from './Clients';

declare var Swal: any;

interface DashboardProps {
  sales: Sale[];
  products: Product[];
  onRefresh: () => Promise<void> | void;
}

const Dashboard: React.FC<DashboardProps> = ({ sales, products, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const clientsData = await DataService.getClients();
        setClients(clientsData);
      } catch (e) {
        console.error("Error al cargar clientes:", e);
      }
    };
    loadData();
  }, [sales]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    Toast.fire({ icon: 'info', title: 'Sincronizando...' });
    await onRefresh();
    setIsRefreshing(false);
    Toast.fire({ icon: 'success', title: 'Datos actualizados' });
  };

  const filteredSales = useMemo(() => sales.filter(s => s.fecha && s.fecha.split('T')[0] >= startDate && s.fecha.split('T')[0] <= endDate), [sales, startDate, endDate]);
  
  // Procesar datos para el gráfico: Agrupar por día
  const chartData = useMemo(() => {
    const groups: Record<string, { date: string, total: number, count: number }> = {};
    
    filteredSales.forEach(s => {
      const day = s.fecha.split('T')[0];
      if (!groups[day]) {
        groups[day] = { date: day, total: 0, count: 0 };
      }
      groups[day].total += s.montoTotal;
      groups[day].count += 1;
    });

    return Object.values(groups)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        name: item.date.split('-').reverse().slice(0, 2).join('/'), // Formato DD/MM
        fullDate: item.date,
        v: item.total,
        cantidad: item.count
      }));
  }, [filteredSales]);

  const metrics = useMemo(() => {
    const totalSales = filteredSales.reduce((acc, curr) => acc + curr.montoTotal, 0);
    const totalProfit = filteredSales.reduce((acc, curr) => acc + curr.gananciaNeta, 0);
    const salesCount = filteredSales.length;
    const avgTicket = salesCount > 0 ? totalSales / salesCount : 0;
    const totalUnits = filteredSales.reduce((acc, curr) => acc + curr.items.reduce((a, i) => a + i.cantidad, 0), 0);
    
    return { totalSales, totalProfit, salesCount, avgTicket, totalUnits };
  }, [filteredSales]);

  const totalClientDebt = useMemo(() => clients.reduce((acc, c) => acc + (Number(c.saldo) || 0), 0), [clients]);
  const lowStockProducts = useMemo(() => products.filter(p => Number(p.stockActual) <= 3).slice(0, 5), [products]);
  const inventoryValue = useMemo(() => products.reduce((acc, p) => acc + (p.stockActual * p.precioCostoPromedio), 0), [products]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-2xl shadow-xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
          <p className="text-[10px] font-black text-[#E07A5F] uppercase tracking-widest mb-2">{payload[0].payload.name}</p>
          <p className="text-sm font-black text-gray-800">{formatCurrency(payload[0].value)}</p>
          <p className="text-[9px] font-bold text-gray-400 uppercase mt-1">{payload[0].payload.cantidad} {payload[0].payload.cantidad === 1 ? 'Venta' : 'Ventas'}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">Panel Analítico</h2>
            <button onClick={handleRefresh} className={`p-2 text-gray-400 hover:text-[#E07A5F] transition-all ${isRefreshing ? 'animate-spin' : ''}`}>
              <RefreshCw size={18} />
            </button>
          </div>
          <p className="text-sm text-gray-400 font-medium">Resumen de actividad y salud financiera.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-white p-2.5 px-4 rounded-xl shadow-sm border border-gray-100 transition-colors">
            <Calendar size={14} className="text-gray-400" />
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="text-[10px] font-bold outline-none bg-transparent text-gray-600" />
            <span className="text-gray-200">|</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-[10px] font-bold outline-none bg-transparent text-gray-600" />
          </div>
          <button onClick={() => window.print()} className="bg-[#E07A5F] text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-xs flex items-center gap-2 hover:opacity-90 transition-all">
            <FileDown size={14} /> EXPORTAR
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Ingresos" value={formatCurrency(metrics.totalSales)} icon={<DollarSign className="text-orange-500" />} color="bg-orange-50" />
          <KpiCard title="Ganancia" value={formatCurrency(metrics.totalProfit)} icon={<TrendingUp className="text-green-600" />} color="bg-green-50" />
          <KpiCard title="Ticket Promedio" value={formatCurrency(metrics.avgTicket)} icon={<CreditCard className="text-blue-500" />} color="bg-blue-50" />
          <KpiCard title="Unid. Vendidas" value={metrics.totalUnits.toString()} icon={<Target className="text-purple-500" />} color="bg-purple-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50 h-[400px] transition-colors flex flex-col">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Facturación Diaria</h3>
                <p className="text-xs font-bold text-gray-300">Resumen de ingresos acumulados por fecha</p>
              </div>
              <div className="flex gap-2">
                 <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#E07A5F]" />
                    <span className="text-[9px] font-bold text-gray-400 uppercase">Ventas</span>
                 </div>
              </div>
            </div>
            
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    stroke="#94a3b8" 
                    dy={10}
                  />
                  <YAxis 
                    fontSize={10} 
                    axisLine={false} 
                    tickLine={false} 
                    stroke="#94a3b8" 
                    tickFormatter={(val) => `$${val > 999 ? (val/1000).toFixed(1) + 'k' : val}`}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="v" fill="#E07A5F" radius={[8, 8, 0, 0]} barSize={24}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="#E07A5F" fillOpacity={0.85 + (index/chartData.length) * 0.15} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <KpiCard title="Deuda Clientes" value={formatCurrency(totalClientDebt)} icon={<Users className="text-red-500" />} color="bg-red-50" />
            <KpiCard title="Valor Stock" value={formatCurrency(inventoryValue)} icon={<Package className="text-[#4C7031]" />} color="bg-green-50" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-50 flex flex-col transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.1em] flex items-center gap-2">
              <AlertTriangle size={14} className="text-orange-400" /> Reposición Urgente
            </h3>
            <span className="text-[9px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">STOCK BAJO</span>
          </div>
          
          <div className="flex-1 space-y-4">
            {lowStockProducts.length > 0 ? lowStockProducts.map(p => (
              <div key={p.id} className="flex items-center justify-between hover:bg-gray-50 p-2 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-100 flex-shrink-0 overflow-hidden">
                    <img src={p.fotoUrl || 'https://via.placeholder.com/50'} className="w-full h-full object-cover" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[11px] font-bold text-gray-700 truncate">{p.nombre}</p>
                    <p className="text-[9px] text-gray-400 uppercase">Quedan {p.stockActual} unidades</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-black text-red-500">{p.stockActual}</p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-20">
                <ShoppingBag size={40} />
                <p className="text-[10px] font-bold uppercase">Inventario Óptimo</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const KpiCard: React.FC<{ title: string; value: string; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-all active:scale-[0.98]">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} flex-shrink-0 shadow-sm transition-colors`}>{icon}</div>
    <div className="overflow-hidden">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">{title}</p>
      <p className="text-sm font-bold text-gray-800 truncate">{value}</p>
    </div>
  </div>
);

export default Dashboard;
