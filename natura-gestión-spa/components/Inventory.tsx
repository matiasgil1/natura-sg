
import React, { useState, useMemo, useRef } from 'react';
import { DataService } from '../services/dataService';
import { Product } from '../types';
import { Plus, Edit2, Trash2, Search, Loader2, ChevronLeft, ChevronRight, AlertCircle, Camera, Image as ImageIcon, X } from 'lucide-react';
import { formatCurrency } from './Clients';

declare var Swal: any;

interface InventoryProps {
  products: Product[];
  onRefresh: () => void;
}

const ITEMS_PER_PAGE = 10;

const Inventory: React.FC<InventoryProps> = ({ products, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products.filter(p => 
      p.nombre.toLowerCase().includes(term) || 
      p.id.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    try {
      const nombre = formData.get('nombre') as string;
      const descripcion = formData.get('descripcion') as string;
      const precioVenta = parseFloat(formData.get('precioVenta') as string);
      if (editingProduct) {
        await DataService.updateProduct(editingProduct.id, {
          nombre, descripcion, fotoUrl: selectedImage || editingProduct.fotoUrl, precioVenta,
        });
      } else {
        const stockActual = parseInt(formData.get('stockActual') as string) || 0;
        const precioCostoPromedio = parseFloat(formData.get('precioCosto') as string) || 0;
        await DataService.addProduct({
          nombre, descripcion, fotoUrl: selectedImage || '', precioVenta, stockActual, precioCostoPromedio
        });
      }
      setIsModalOpen(false); setEditingProduct(null); setSelectedImage(null);
      setTimeout(async () => { await onRefresh(); Swal.fire('Éxito', 'Guardado correctamente.', 'success'); }, 500);
    } catch (error: any) {
      Swal.fire('Error', error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openModal = (product: Product | null = null) => {
    setEditingProduct(product);
    setSelectedImage(product?.fotoUrl || null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: '¿Eliminar producto?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#E07A5F',
      confirmButtonText: 'Sí, eliminar',
      customClass: { popup: 'rounded-[2rem]' }
    });
    if (result.isConfirmed) {
      try {
        await DataService.deleteProduct(id);
        await onRefresh();
      } catch (e: any) {
        Swal.fire('Error', e.message, 'error');
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-800 tracking-tight">Inventario Natura</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Gestión de existencias actuales</p>
        </div>
        <button onClick={() => openModal()} className="bg-[#4C7031] text-white px-5 py-3 rounded-2xl shadow-xl shadow-green-50 font-black text-[10px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all">
          <Plus size={18} className="inline mr-2" /> Nuevo Producto
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-50 overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/10 flex items-center gap-3">
          <Search className="text-gray-300" size={18} />
          <input 
            type="text" 
            placeholder="Buscar producto por nombre o ID..." 
            className="flex-1 outline-none text-xs font-bold bg-transparent placeholder-gray-300"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 text-[9px] font-black text-gray-300 uppercase tracking-[0.2em] border-b">
              <tr>
                <th className="px-8 py-4">Producto</th>
                <th className="px-8 py-4 text-center">Stock</th>
                <th className="px-8 py-4">P. Venta</th>
                <th className="px-8 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50/20 transition-colors group">
                  <td className="px-8 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0 border border-gray-100">
                        <img src={product.fotoUrl || 'https://via.placeholder.com/100'} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-gray-700 uppercase leading-tight truncate max-w-[200px]">{product.nombre}</p>
                        <p className="text-[9px] text-gray-300 font-bold">ID: {product.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight ${
                      product.stockActual <= 3 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
                    }`}>
                      {product.stockActual} u
                    </span>
                  </td>
                  <td className="px-8 py-4 text-[11px] font-black text-gray-800">
                    {formatCurrency(product.precioVenta)}
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => openModal(product)} className="p-2 text-blue-400 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(product.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-in fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-black text-gray-800 mb-8">{editingProduct ? 'Editar' : 'Nuevo'} Producto</h3>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nombre</label>
                  <input name="nombre" defaultValue={editingProduct?.nombre} required className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none font-bold text-xs focus:ring-4 focus:ring-orange-50 transition-all" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">P. Venta</label>
                    <input name="precioVenta" type="number" step="0.01" defaultValue={editingProduct?.precioVenta} required className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none font-bold text-xs focus:ring-4 focus:ring-orange-50 transition-all" />
                  </div>
                  {!editingProduct && (
                    <div>
                      <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Stock Inicial</label>
                      <input name="stockActual" type="number" defaultValue="0" className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none font-bold text-xs focus:ring-4 focus:ring-orange-50 transition-all" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-4 bg-gray-100 text-gray-400 rounded-2xl font-black text-[9px] uppercase tracking-widest">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] px-6 py-4 bg-[#E07A5F] text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-xl shadow-orange-100">
                  {isSubmitting ? 'Guardando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
