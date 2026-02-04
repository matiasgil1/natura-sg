
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DataService } from '../services/dataService';
import { Product, Client, SaleItem, Sale } from '../types';
import { Search, ShoppingCart, Plus, Minus, X, User, DollarSign, Loader2, CreditCard, Wallet, Printer, CheckCircle } from 'lucide-react';
import { formatCurrency, Toast } from './Clients';

declare var Swal: any;

interface POSProps {
  products: Product[];
  clients: Client[];
  onRefresh: () => void;
}

const POS: React.FC<POSProps> = ({ products, clients, onRefresh }) => {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearchText, setClientSearchText] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [montoPagado, setMontoPagado] = useState(0);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) && p.stockActual > 0
    );
  }, [products, searchTerm]);

  const filteredClients = useMemo(() => {
    if (!clientSearchText) return clients;
    return clients.filter(c => 
      `${c.nombre} ${c.apellido}`.toLowerCase().includes(clientSearchText.toLowerCase())
    );
  }, [clients, clientSearchText]);

  const selectedClient = useMemo(() => clients.find(c => c.id === selectedClientId), [clients, selectedClientId]);
  const total = cart.reduce((acc, curr) => acc + curr.subtotal, 0);
  const cartItemsCount = cart.reduce((acc, curr) => acc + curr.cantidad, 0);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.cantidad >= product.stockActual) {
          Toast.fire({ icon: 'warning', title: 'Sin stock' });
          return prev;
        }
        return prev.map(item => item.productId === product.id 
          ? { ...item, cantidad: item.cantidad + 1, subtotal: (item.cantidad + 1) * item.precioVenta }
          : item
        );
      }
      Toast.fire({ icon: 'success', title: 'Añadido', timer: 800 });
      return [...prev, {
        productId: product.id, nombre: product.nombre, cantidad: 1, precioVenta: product.precioVenta, subtotal: product.precioVenta
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const product = products.find(p => p.id === productId);
        const newQty = item.cantidad + delta;
        if (newQty <= 0) return null;
        if (product && newQty > product.stockActual) return item;
        return { ...item, cantidad: newQty, subtotal: newQty * item.precioVenta };
      }
      return item;
    }).filter(Boolean) as SaleItem[]);
  };

  const handlePrintReceipt = (sale: any) => {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    
    // Header Natura Premium
    doc.setFillColor(224, 122, 95); 
    doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text('NATURA', 105, 22, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text('COMPROBANTE DE VENTA OFICIAL', 105, 32, { align: 'center' });
    
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    doc.line(80, 36, 130, 36);

    // Información de la operación
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text('DETALLES DE LA OPERACIÓN', 20, 60);
    doc.setDrawColor(230, 230, 230);
    doc.line(20, 62, 190, 62);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`CLIENTE:`, 20, 72);
    doc.setTextColor(0, 0, 0); // Negro puro para visibilidad
    doc.setFont("helvetica", "bold");
    doc.text(sale.clientName.toUpperCase(), 55, 72);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`FECHA:`, 20, 79);
    doc.setTextColor(0, 0, 0);
    doc.text(new Date(sale.fecha).toLocaleString('es-AR'), 55, 79);

    doc.setTextColor(100, 100, 100);
    doc.text(`MÉTODO:`, 20, 86);
    doc.setTextColor(0, 0, 0);
    doc.text(sale.metodoPago.toUpperCase(), 55, 86);

    doc.setTextColor(100, 100, 100);
    doc.text(`OPERACIÓN:`, 20, 93);
    doc.setTextColor(120, 120, 120);
    doc.text(`#${sale.id}`, 55, 93);

    (doc as any).autoTable({
      startY: 105,
      head: [['PRODUCTO', 'CANT.', 'PRECIO', 'SUBTOTAL']],
      body: sale.items.map((i: any) => [
        i.nombre.toUpperCase(), 
        i.cantidad, 
        formatCurrency(i.precioVenta), 
        formatCurrency(i.subtotal)
      ]),
      headStyles: { fillColor: [224, 122, 95], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 5, font: "helvetica", textColor: [0, 0, 0] },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      foot: [
        ['', '', 'TOTAL', formatCurrency(sale.montoTotal)], 
        ['', '', 'ABONADO', formatCurrency(sale.montoPagado)], 
        ['', '', 'PENDIENTE', formatCurrency(sale.saldoRestante)]
      ],
      // Forzar colores negros y fondo claro en el pie de página para evitar azul ilegible
      footStyles: { 
        fillColor: [248, 248, 248], 
        textColor: [0, 0, 0], 
        fontStyle: 'bold', 
        fontSize: 10,
        lineColor: [230, 230, 230],
        lineWidth: 0.1
      },
      margin: { left: 20, right: 20 },
      theme: 'striped'
    });

    const finalY = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text('¡Gracias por tu compra! Natura Gestión Cloud', 105, 285, { align: 'center' });
    
    doc.save(`Ticket_Natura_${sale.id}.pdf`);
  };

  const handleCheckout = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const gananciaNeta = cart.reduce((acc, item) => {
        const prod = products.find(p => p.id === item.productId);
        const profit = (item.precioVenta - (prod?.precioCostoPromedio || 0)) * item.cantidad;
        return acc + profit;
      }, 0);
      
      const saleData = await DataService.registerSale(
        selectedClientId, 
        `${selectedClient?.nombre} ${selectedClient?.apellido}`, 
        cart, 
        total, 
        montoPagado, 
        metodoPago, 
        gananciaNeta
      );
      
      onRefresh();
      setCart([]);
      setSelectedClientId('');
      setClientSearchText('');
      
      Swal.fire({
        title: '¡Venta Exitosa!',
        html: `<div class="p-4 bg-orange-50 rounded-2xl border border-orange-100 mb-2">
                 <p class="text-xs font-bold text-gray-600 uppercase mb-1">Monto Cobrado</p>
                 <p class="text-2xl font-black text-[#E07A5F]">${formatCurrency(montoPagado)}</p>
               </div>
               <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-4">¿Descargar comprobante?</p>`,
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'DESCARGAR TICKET',
        cancelButtonText: 'CERRAR',
        confirmButtonColor: '#E07A5F',
        customClass: { popup: 'rounded-[2.5rem]' }
      }).then((result: any) => {
        if (result.isConfirmed) handlePrintReceipt(saleData);
        setIsPaymentModalOpen(false);
        setIsCartDrawerOpen(false);
      });
    } catch (err: any) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const CartContent = ({ isMobile = false }) => (
    <div className={`flex flex-col h-full bg-white ${isMobile ? 'rounded-t-[2.5rem]' : 'rounded-none'} overflow-hidden shadow-2xl lg:shadow-none`}>
      <div className="p-6 border-b border-gray-50 bg-gray-50/10">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 uppercase tracking-tight">
            <ShoppingCart size={18} className="text-[#E07A5F]"/> Mi Carrito
          </h3>
          {isMobile && <button onClick={() => setIsCartDrawerOpen(false)} className="p-2 bg-gray-100 rounded-full text-gray-400"><X size={16}/></button>}
        </div>
        
        <div className="relative" ref={dropdownRef}>
          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
          <input 
            type="text" 
            placeholder="Seleccionar cliente..." 
            value={clientSearchText}
            onFocus={() => setIsClientDropdownOpen(true)}
            onChange={(e) => { setClientSearchText(e.target.value); setIsClientDropdownOpen(true); }}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#E07A5F] transition-all shadow-inner"
          />
          {isClientDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
              {filteredClients.map(c => (
                <button 
                  key={c.id} 
                  onClick={() => { setSelectedClientId(c.id); setClientSearchText(`${c.nombre} ${c.apellido}`); setIsClientDropdownOpen(false); }} 
                  className="w-full text-left px-5 py-3 hover:bg-orange-50 text-[11px] font-bold text-gray-700 border-b border-gray-50 last:border-0"
                >
                  {c.nombre} {c.apellido}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.map(item => (
          <div key={item.productId} className="flex gap-4 items-center p-3 rounded-2xl border border-gray-50 bg-white shadow-sm">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-gray-800 uppercase truncate leading-tight">{item.nombre}</p>
              <p className="text-[10px] font-black text-[#E07A5F]">{formatCurrency(item.precioVenta)}</p>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-1 border border-gray-100">
              <button onClick={() => updateQuantity(item.productId, -1)} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg text-gray-400 transition-colors"><Minus size={10}/></button>
              <span className="text-xs font-black w-4 text-center">{item.cantidad}</span>
              <button onClick={() => updateQuantity(item.productId, 1)} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-lg text-gray-400 transition-colors"><Plus size={10}/></button>
            </div>
          </div>
        ))}
        {cart.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-20">
            <ShoppingCart size={40} className="mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-widest">Carrito Vacío</p>
          </div>
        )}
      </div>

      <div className="p-6 bg-white border-t border-gray-50">
        <div className="flex justify-between items-center mb-5 px-1">
           <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Total</span>
           <span className="text-xl font-black text-gray-800">{formatCurrency(total)}</span>
        </div>
        <button 
          disabled={cart.length === 0 || !selectedClientId}
          onClick={() => { setMontoPagado(total); setIsPaymentModalOpen(true); }}
          className="w-full bg-[#E07A5F] text-white py-4 rounded-2xl font-black text-[11px] shadow-xl shadow-orange-100 disabled:opacity-50 transition-all active:scale-95 uppercase tracking-widest"
        >PROCESAR PAGO</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full relative">
      <div className="flex-1 bg-white rounded-[2.5rem] shadow-sm border border-gray-50 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-50 bg-gray-50/5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-lg font-black text-gray-800">Venta (POS)</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Seleccionar productos</p>
            </div>
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar..." 
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#E07A5F] transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 content-start">
          {filteredProducts.map(product => (
            <div key={product.id} className="relative flex flex-col bg-white border border-gray-100 rounded-[1.5rem] overflow-hidden hover:shadow-xl transition-all group active:scale-[0.98]">
              <div className="aspect-square bg-gray-50 overflow-hidden cursor-pointer" onClick={() => addToCart(product)}>
                <img src={product.fotoUrl || 'https://via.placeholder.com/300'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <button 
                  onClick={(e) => { e.stopPropagation(); addToCart(product); }}
                  className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-md shadow-lg text-[#E07A5F] rounded-full flex items-center justify-center hover:bg-[#E07A5F] hover:text-white transition-all active:scale-90 z-20"
                >
                  <Plus size={18} strokeWidth={3} />
                </button>
                <div className="absolute top-3 left-3 px-2 py-0.5 bg-gray-900/40 backdrop-blur-md text-white text-[8px] font-black rounded uppercase">
                  Stock: {product.stockActual}
                </div>
              </div>
              <div className="p-4">
                <p className="text-[10px] font-bold text-gray-700 line-clamp-2 leading-tight mb-2 uppercase tracking-tight">{product.nombre}</p>
                <p className="text-base font-black text-gray-900">{formatCurrency(product.precioVenta)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden lg:block w-72 flex-shrink-0 bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
        <CartContent />
      </div>

      {cartItemsCount > 0 && (
        <button 
          onClick={() => setIsCartDrawerOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 w-14 h-14 bg-[#E07A5F] text-white rounded-full shadow-2xl flex items-center justify-center z-[110] animate-bounce-subtle"
        >
          <ShoppingCart size={24} />
          <span className="absolute -top-1 -right-1 bg-[#4C7031] text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white">
            {cartItemsCount}
          </span>
        </button>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[150] animate-in fade-in duration-200">
           <div className="bg-white rounded-[3rem] w-full max-sm p-10 shadow-2xl animate-in zoom-in-95 relative overflow-hidden">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-black text-gray-800">Cierre de Venta</h3>
                <button onClick={() => setIsPaymentModalOpen(false)} className="p-3 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600 transition-colors"><X size={20}/></button>
              </div>
              
              <div className="space-y-6">
                <div className="bg-orange-50/40 p-8 rounded-[2.5rem] text-center border border-orange-100 shadow-inner">
                  <p className="text-[10px] font-black text-[#E07A5F] uppercase tracking-[0.3em] mb-2">Total a cobrar</p>
                  <p className="text-3xl font-black text-gray-800 tracking-tighter">{formatCurrency(total)}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-2 mb-2 block tracking-widest">Método de Pago</label>
                    <div className="grid grid-cols-3 gap-2">
                       {['Efectivo', 'Transf.', 'Tarjeta'].map(m => (
                         <button 
                          key={m} 
                          onClick={() => setMetodoPago(m)}
                          className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${metodoPago === m ? 'bg-[#E07A5F] text-white border-[#E07A5F] shadow-lg shadow-orange-100' : 'bg-gray-50 text-gray-400 border-transparent'}`}
                         >
                           {m}
                         </button>
                       ))}
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2 px-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto Recibido</label>
                      <span className="text-[9px] font-bold text-red-400 uppercase">Resta: {formatCurrency(Math.max(0, total - montoPagado))}</span>
                    </div>
                    <div className="relative">
                      <Wallet className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                      <input 
                        type="number" 
                        value={montoPagado} 
                        onChange={(e) => setMontoPagado(Number(e.target.value))} 
                        className="w-full pl-12 pr-6 py-5 bg-gray-50 border-none rounded-[1.5rem] outline-none font-black text-xl text-gray-800 focus:ring-4 focus:ring-orange-50 transition-all shadow-inner" 
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                         <button onClick={() => setMontoPagado(total)} className="px-3 py-2 bg-white text-[#E07A5F] text-[9px] font-black rounded-lg shadow-sm hover:bg-orange-50 uppercase">Total</button>
                         <button onClick={() => setMontoPagado(0)} className="px-3 py-2 bg-white text-gray-400 text-[9px] font-black rounded-lg shadow-sm hover:bg-gray-50 uppercase">Deuda</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-5 bg-gray-50 text-gray-400 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-colors">Volver</button>
                  <button onClick={handleCheckout} disabled={isProcessing} className="flex-[2] py-5 bg-[#4C7031] text-white rounded-[1.5rem] font-black text-[10px] shadow-2xl shadow-green-100 uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">
                    {isProcessing ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'CONFIRMAR VENTA'}
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default POS;
