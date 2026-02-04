
import { Product, Client, Sale, Purchase, SaleItem } from '../types';

declare var Swal: any;
declare var google: any;

const API_URL = 'https://script.google.com/macros/s/AKfycbyi5YzAfEH6WM_vUMophxR33HZEBtZ8Y5NW7xEq-GZdtg1KcO_JIBlXhi07LpKPY3s2IQ/exec';

function getValue(obj: any, key: string): any {
  if (!obj) return undefined;
  const lowerKey = key.toLowerCase();
  const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
  return foundKey ? obj[foundKey] : undefined;
}

async function apiCall(action: string, payload: any = {}, isRead: boolean = false) {
  try {
    const fetchOptions: RequestInit = {
      method: 'POST',
      body: JSON.stringify({ action, payload })
    };
    const response = await fetch(API_URL, fetchOptions);
    if (isRead) {
      const result = await response.json();
      if (result.success) return result.data;
      throw new Error(result.error || "Error desconocido en la API");
    }
    return { success: true };
  } catch (error: any) {
    console.error(`Error en API (${action}):`, error);
    return null; 
  }
}

function runLegacy(functionName: string, ...args: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      (google.script.run as any)
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)[functionName](...args);
    } else {
      resolve(null);
    }
  });
}

export class DataService {
  static async getProducts(): Promise<Product[]> {
    let data = await apiCall('getProducts', {}, true);
    if (!data) data = await runLegacy('getTableData', 'Inventario');
    return (data || []).map((p: any) => ({
      id: String(getValue(p, 'ID') || ''),
      nombre: String(getValue(p, 'Nombre') || ''),
      descripcion: String(getValue(p, 'Descripción') || getValue(p, 'Descripcion') || ''),
      fotoUrl: String(getValue(p, 'FotoURL') || ''),
      stockActual: Number(getValue(p, 'StockActual') || 0),
      precioCostoPromedio: Number(getValue(p, 'PrecioCostoPromedio') || 0),
      precioVenta: Number(getValue(p, 'PrecioVenta') || 0)
    }));
  }

  static async getClients(): Promise<Client[]> {
    let data = await apiCall('getClients', {}, true);
    if (!data) data = await runLegacy('getTableData', 'Clientes');
    return (data || []).map((c: any) => ({
      id: String(getValue(c, 'ID') || ''),
      nombre: String(getValue(c, 'Nombre') || ''),
      apellido: String(getValue(c, 'Apellido') || ''),
      telefono: String(getValue(c, 'Telefono') || ''),
      saldo: Number(getValue(c, 'Saldo') || 0)
    }));
  }

  static async getSales(): Promise<Sale[]> {
    let data = await apiCall('getSales', {}, true);
    if (!data) data = await runLegacy('getTableData', 'Ventas');
    return (data || []).map((s: any) => ({
      id: String(getValue(s, 'ID') || ''),
      fecha: String(getValue(s, 'Fecha') || ''),
      clientId: String(getValue(s, 'IDCliente') || ''),
      clientName: String(getValue(s, 'ClienteNombre') || ''),
      montoTotal: Number(getValue(s, 'MontoTotal') || 0),
      montoPagado: Number(getValue(s, 'MontoPagado') || 0),
      saldoRestante: Number(getValue(s, 'SaldoRestante') || 0),
      metodoPago: String(getValue(s, 'MetodoPago') || 'Efectivo'),
      gananciaNeta: Number(getValue(s, 'GananciaNeta') || 0),
      items: JSON.parse(getValue(s, 'ItemsJSON') || '[]')
    }));
  }

  static async getPurchases(): Promise<Purchase[]> {
    let data = await apiCall('getPurchases', {}, true);
    if (!data) data = await runLegacy('getTableData', 'Compras');
    return (data || []).map((p: any) => ({
      id: String(getValue(p, 'ID') || ''),
      fecha: String(getValue(p, 'Fecha') || ''),
      productId: String(getValue(p, 'IDProducto') || ''),
      cantidad: Number(getValue(p, 'Cantidad') || 0),
      precioCosto: Number(getValue(p, 'PrecioCosto') || 0),
      proveedor: String(getValue(p, 'Proveedor') || '')
    }));
  }

  static async addProduct(product: Omit<Product, 'id'>) {
    const data = {
      'ID': 'P' + Date.now().toString().slice(-6),
      'Nombre': product.nombre,
      'Descripción': product.descripcion,
      'FotoURL': product.fotoUrl,
      'StockActual': product.stockActual,
      'PrecioCostoPromedio': product.precioCostoPromedio,
      'PrecioVenta': product.precioVenta
    };
    return await apiCall('saveRecord', { sheet: 'Inventario', data });
  }

  static async updateProduct(id: string, product: Partial<Product>) {
    return await apiCall('updateRecord', { sheet: 'Inventario', id, data: product });
  }

  static async deleteProduct(id: string) {
    return await apiCall('deleteRecord', { sheet: 'Inventario', id });
  }

  static async addClient(client: Omit<Client, 'id' | 'saldo'>) {
    const id = 'C' + Date.now().toString().slice(-6);
    await apiCall('saveRecord', { sheet: 'Clientes', data: { ...client, 'ID': id, 'Saldo': 0 } });
    return { ...client, id, saldo: 0 };
  }

  static async registerPurchase(purchaseData: any) {
    const data = {
      id: 'B' + Date.now().toString().slice(-6),
      fecha: new Date().toISOString(),
      ...purchaseData
    };
    return await apiCall('processPurchase', { purchaseData: data });
  }

  static async registerSale(clientId: string, clientName: string, items: SaleItem[], montoTotal: number, montoPagado: number, metodoPago: string, gananciaNeta: number) {
    const saldoRestante = montoTotal - montoPagado;
    const saleData = {
      id: 'S' + Date.now().toString().slice(-6),
      fecha: new Date().toISOString(),
      clientId, 
      clientName, 
      montoTotal, 
      montoPagado, 
      saldoRestante, 
      metodoPago, 
      gananciaNeta, 
      items
    };
    await apiCall('processSale', { saleData });
    return saleData;
  }

  static async registerClientPayment(clientId: string, monto: number) {
    // Obtenemos el cliente actual para saber su saldo
    const clients = await this.getClients();
    const client = clients.find(c => c.id === clientId);
    if (!client) throw new Error("Cliente no encontrado");
    
    const nuevoSaldo = client.saldo - monto;
    return await apiCall('updateRecord', { 
      sheet: 'Clientes', 
      id: clientId, 
      data: { 'Saldo': nuevoSaldo } 
    });
  }
}
