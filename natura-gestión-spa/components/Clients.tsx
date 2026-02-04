
import React, { useMemo, useState } from 'react';
import { Client } from '../types';
import { DataService } from '../services/dataService';
import { Search, User, Phone, FileDown, MessageSquare, AlertCircle, TrendingDown, UserPlus, X, DollarSign, Wallet } from 'lucide-react';

declare var Swal: any;

export const Toast = Swal.mixin({
  toast: true,
  position: 'top',
  showConfirmButton: false,
  timer: 2000,
  timerProgressBar: false,
  background: 'rgba(255, 255, 255, 0.95)',
  didOpen: (toast: any) => {
    toast.style.backdropFilter = 'blur(12px)';
    toast.style.borderRadius = '24px';
    toast.style.boxShadow = '0 12px 34px rgba(0,0,0,0.12)';
    toast.style.border = '1px solid rgba(255,255,255,0.4)';
    toast.style.marginTop = '20px';
  }
});

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(amount).replace('ARS', '$').trim();
};

const cleanText = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface ClientsProps {
  clients: Client[];
  onRefresh: () => Promise<void> | void;
}

const Clients: React.FC<ClientsProps> = ({ clients, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredClients = useMemo(() => {
    const term = cleanText(searchTerm);
    return clients.filter(c => 
      cleanText(`${c.nombre} ${c.apellido}`).includes(term) ||
      c.telefono.includes(term)
    ).sort((a, b) => b.saldo - a.saldo);
  }, [clients, searchTerm]);

  const totalDebtAmount = useMemo(() => clients.reduce((acc, c) => acc + (Number(c.saldo) || 0), 0), [clients]);

  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * 10;
    return filteredClients.slice(start, start + 10);
  }, [filteredClients, currentPage]);

  const handleDownloadDebtorsReport = () => {
    Toast.fire({ icon: 'info', title: 'Generando Reporte...' });
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    doc.setFillColor(224, 122, 95); 
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text('NATURA', 105, 18, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text('REPORTE DE SALDOS PENDIENTES', 105, 26, { align: 'center' });
    const debtors = clients.filter(c => c.saldo > 0).sort((a,b) => b.saldo - a.saldo);
    (doc as any).autoTable({
      startY: 45,
      head: [['CLIENTE', 'TELÉFONO', 'DEUDA']],
      body: debtors.map(c => [`${c.nombre} ${c.apellido}`, c.telefono, formatCurrency(c.saldo)]),
      styles: { fontSize: 9, font: "helvetica" },
      headStyles: { fillColor: [224, 122, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [253, 252, 249] },
      foot: [['TOTAL EN CALLE', '', formatCurrency(totalDebtAmount)]],
      footStyles: { fillColor: [248, 248, 248], textColor: [61, 64, 91], fontStyle: 'bold' }
    });
    doc.save('Deudores_Natura_Cloud.pdf');
    Toast.fire({ icon: 'success', title: 'Reporte descargado' });
  };

  const handleAddClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      await DataService.addClient({
        nombre: formData.get('nombre') as string,
        apellido: formData.get('apellido') as string,
        telefono: formData.get('telefono') as string,
      });
      Toast.fire({ icon: 'success', title: 'Cliente agregado' });
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      Toast.fire({ icon: 'error', title: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCollectPayment = async (client: Client) => {
    const { value: monto } = await Swal.fire({
      title: 'Cobrar Saldo',
      html: `
        <div class="p-4 text-center">
          <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Deuda Actual</p>
          <p class="text-2xl font-black text-red-500 mb-6">${formatCurrency(client.saldo)}</p>
          <div class="relative">
            <input id="swal-input-monto" type="number" step="0.01" class="w-full px-6 py-5 bg-gray-50 border-none rounded-[1.5rem] outline-none font-black text-xl text-center text-gray-800 focus:ring-4 focus:ring-orange-50 transition-all shadow-inner" placeholder="Monto a pagar">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'REGISTRAR PAGO',
      cancelButtonText: 'CANCELAR',
      confirmButtonColor: '#4C7031',
      customClass: { popup: 'rounded-[2.5rem]' },
      preConfirm: () => {
        const input = document.getElementById('swal-input-monto') as HTMLInputElement;
        if (!input.value || parseFloat(input.value) <= 0) {
          Swal.showValidationMessage('Ingresa un monto válido');
          return false;
        }
        return parseFloat(input.value);
      }
    });

    if (monto) {
      try {
        await DataService.registerClientPayment(client.id, monto);
        onRefresh();
        Toast.fire({ icon: 'success', title: 'Cobro registrado' });
      } catch (err: any) {
        Swal.fire('Error', err.message, 'error');
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 tracking-tight">Clientes</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Control de cuentas corrientes</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#4C7031] text-white px-5 py-3 rounded-2xl shadow-xl shadow-green-50 hover:brightness-110 active:scale-95 transition-all font-black text-[10px] uppercase tracking-widest">
            <UserPlus size={16} /> NUEVO
          </button>
          <button onClick={handleDownloadDebtorsReport} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#E07A5F] text-white px-5 py-3 rounded-2xl shadow-xl shadow-orange-50 hover:brightness-110 active:scale-95 transition-all font-black text-[10px] uppercase tracking-widest">
            <FileDown size={16} /> REPORTE
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiSummary title="En Calle" value={formatCurrency(totalDebtAmount)} icon={<TrendingDown size={18}/>} color="bg-red-50 text-red-500" />
        <KpiSummary title="Deudores" value={clients.filter(c => c.saldo > 0).length.toString()} icon={<AlertCircle size={18}/>} color="bg-orange-50 text-orange-500" />
        <KpiSummary title="Total" value={clients.length.toString()} icon={<User size={18}/>} color="bg-blue-50 text-blue-500" />
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/10 flex items-center gap-3">
          <Search className="text-gray-300" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, apellido o celular..." 
            className="flex-1 outline-none text-xs font-bold bg-transparent placeholder-gray-300"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] border-b">
              <tr>
                <th className="px-8 py-4">Titular</th>
                <th className="px-8 py-4">WhatsApp</th>
                <th className="px-8 py-4">Saldo</th>
                <th className="px-8 py-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedClients.map(client => (
                <tr key={client.id} className="hover:bg-gray-50/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-[#E07A5F] font-black text-[10px] shadow-sm">{client.nombre[0]}{client.apellido[0]}</div>
                      <p className="text-[11px] font-black text-gray-700 uppercase tracking-tight">{client.nombre} {client.apellido}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[10px] font-bold text-gray-400">{client.telefono}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`text-[11px] font-black ${client.saldo > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {formatCurrency(client.saldo)}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      {client.saldo > 0 && (
                        <>
                          <button onClick={() => handleCollectPayment(client)} className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm" title="Cobrar Deuda">
                            <DollarSign size={16} />
                          </button>
                          <button onClick={() => {
                            window.open(`https://wa.me/${client.telefono}?text=Hola ${client.nombre}! Te recordamos que tenés un saldo pendiente en Natura de ${formatCurrency(client.saldo)}. Avisame cualquier cosa!`, '_blank');
                            Toast.fire({ icon: 'success', title: 'WhatsApp abierto' });
                          }} className="p-2.5 bg-blue-50 text-blue-500 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Enviar Recordatorio">
                            <MessageSquare size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-[200] animate-in fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-10 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-gray-800 tracking-tight">Nuevo Cliente</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-300 hover:text-gray-500"><X size={24}/></button>
            </div>
            <form onSubmit={handleAddClient} className="space-y-6">
              <InputField label="Nombre" name="nombre" placeholder="Nombre" />
              <InputField label="Apellido" name="apellido" placeholder="Apellido" />
              <InputField label="WhatsApp (Cód. Área + Número)" name="telefono" placeholder="Ej: 54938150..." />
              <button type="submit" disabled={isSubmitting} className="w-full bg-[#E07A5F] text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-orange-100 hover:brightness-110 active:scale-95 transition-all mt-4">
                {isSubmitting ? 'REGISTRANDO...' : 'GUARDAR CLIENTE'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const KpiSummary = ({ title, value, icon, color }: any) => (
  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-50 flex items-center gap-4 transition-all hover:shadow-md active:scale-[0.98]">
    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${color}`}>{icon}</div>
    <div>
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">{title}</p>
      <p className="text-lg font-black text-gray-800">{value}</p>
    </div>
  </div>
);

const InputField = ({ label, ...props }: any) => (
  <div>
    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2 ml-1">{label}</label>
    <input {...props} required className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none font-bold text-xs text-gray-700 focus:ring-4 focus:ring-orange-50 transition-all shadow-inner" />
  </div>
);

export default Clients;
