
/**
 * NATURA GESTIÓN - API BACKEND
 */

const SPREADSHEET_ID = ""; 

function doGet() {
  try {
    checkAndInitSheets(); 
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Natura Gestión')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (e) {
    return HtmlService.createHtmlOutput("<h1>Error de Acceso</h1><p>" + e.message + "</p>");
  }
}

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload || {};
    let result;

    if (action === 'getProducts') result = getTableData('Inventario');
    else if (action === 'getClients') result = getTableData('Clientes');
    else if (action === 'getSales') result = getTableData('Ventas');
    else if (action === 'getPurchases') result = getTableData('Compras');
    else if (action === 'getSystemStatus') result = getSystemStatus();
    else if (action === 'saveRecord') result = saveRecord(payload.sheet, payload.data);
    else if (action === 'updateRecord') result = updateRecord(payload.sheet, payload.id, payload.data);
    else if (action === 'deleteRecord') result = deleteRecord(payload.sheet, payload.id);
    else if (action === 'processSale') result = processSale(payload.saleData);
    else if (action === 'processPurchase') result = processPurchase(payload.purchaseData);
    else if (action === 'repairStructure') result = checkAndInitSheets();
    else throw new Error("Acción desconocida: " + action);

    return ContentService.createTextOutput(JSON.stringify({ success: true, data: result }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function normalize(str) {
  if (!str) return "";
  return str.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, "");
}

function getSS() {
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (!ss && SPREADSHEET_ID) {
    try { ss = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (e) {}
  }
  if (!ss) throw new Error("No vinculado. Ve a Extensiones > Apps Script.");
  return ss;
}

function getSystemStatus() {
  const ss = getSS();
  const required = {
    'Inventario': ['ID', 'Nombre', 'Descripción', 'FotoURL', 'StockActual', 'PrecioCostoPromedio', 'PrecioVenta'],
    'Clientes': ['ID', 'Nombre', 'Apellido', 'Telefono', 'Saldo'],
    'Ventas': ['ID', 'Fecha', 'IDCliente', 'ClienteNombre', 'MontoTotal', 'MontoPagado', 'SaldoRestante', 'MetodoPago', 'GananciaNeta', 'ItemsJSON'],
    'Compras': ['ID', 'Fecha', 'IDProducto', 'Cantidad', 'PrecioCosto', 'Proveedor'],
    'Usuarios': ['Usuario', 'Contraseña', 'Rol']
  };
  const status = {};
  Object.keys(required).forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) {
      status[name] = { exists: false, headersOk: false };
    } else {
      const lastCol = Math.max(1, sheet.getLastColumn());
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(normalize);
      const missing = required[name].filter(h => !headers.includes(normalize(h)));
      status[name] = { exists: true, headersOk: missing.length === 0, missing };
    }
  });
  return status;
}

function checkAndInitSheets() {
  const ss = getSS();
  const requiredSheets = {
    'Inventario': ['ID', 'Nombre', 'Descripción', 'FotoURL', 'StockActual', 'PrecioCostoPromedio', 'PrecioVenta'],
    'Clientes': ['ID', 'Nombre', 'Apellido', 'Telefono', 'Saldo'],
    'Ventas': ['ID', 'Fecha', 'IDCliente', 'ClienteNombre', 'MontoTotal', 'MontoPagado', 'SaldoRestante', 'MetodoPago', 'GananciaNeta', 'ItemsJSON'],
    'Compras': ['ID', 'Fecha', 'IDProducto', 'Cantidad', 'PrecioCosto', 'Proveedor'],
    'Usuarios': ['Usuario', 'Contraseña', 'Rol']
  };
  Object.keys(requiredSheets).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, requiredSheets[name].length).setValues([requiredSheets[name]])
           .setFontWeight('bold')
           .setBackground('#F4F1DE');
    } else {
      const lastCol = Math.max(1, sheet.getLastColumn());
      const headersRange = sheet.getRange(1, 1, 1, lastCol);
      const headers = headersRange.getValues()[0].map(normalize);
      requiredSheets[name].forEach(h => {
        if (!headers.includes(normalize(h))) {
          const newCol = sheet.getLastColumn() + 1;
          sheet.getRange(1, newCol).setValue(h).setFontWeight('bold').setBackground('#F4F1DE');
        }
      });
    }
  });
  SpreadsheetApp.flush();
  return { success: true };
}

function getTableData(sheetName) {
  const ss = getSS();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  if (sheet.getLastRow() <= 1) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  return values.map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    return obj;
  });
}

function saveRecord(sheetName, data) {
  const ss = getSS();
  let sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => {
    const normH = normalize(h);
    const matchingKey = Object.keys(data).find(k => normalize(k) === normH);
    return (matchingKey !== undefined) ? data[matchingKey] : (normH === "saldo" ? 0 : "");
  });
  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return { success: true };
}

function updateRecord(sheetName, id, data) {
  const ss = getSS();
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const normHeaders = headers.map(normalize);
  const colId = normHeaders.indexOf("id");
  const targetId = String(id);
  
  if (colId === -1) throw new Error("No se encontró la columna ID en " + sheetName);

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][colId]) === targetId) {
      Object.keys(data).forEach(key => {
        const colIndex = normHeaders.indexOf(normalize(key));
        if (colIndex !== -1) sheet.getRange(i + 1, colIndex + 1).setValue(data[key]);
      });
      SpreadsheetApp.flush();
      return { success: true };
    }
  }
}

function deleteRecord(sheetName, id) {
  const ss = getSS();
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const normHeaders = values[0].map(normalize);
  const colId = normHeaders.indexOf("id");
  const targetId = String(id);

  if (colId === -1) throw new Error("No se encontró la columna ID");

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][colId]) === targetId) {
      sheet.deleteRow(i + 1);
      SpreadsheetApp.flush();
      return { success: true };
    }
  }
}

function processSale(saleData) {
  // 1. Registrar Venta
  saveRecord('Ventas', {
    'ID': saleData.id,
    'Fecha': saleData.fecha,
    'IDCliente': saleData.clientId,
    'ClienteNombre': saleData.clientName,
    'MontoTotal': saleData.montoTotal,
    'MontoPagado': saleData.montoPagado,
    'SaldoRestante': saleData.saldoRestante,
    'MetodoPago': saleData.metodoPago,
    'GananciaNeta': saleData.gananciaNeta,
    'ItemsJSON': JSON.stringify(saleData.items)
  });

  const ss = getSS();
  
  // 2. Descontar Stock
  const sheetInv = ss.getSheetByName('Inventario');
  const invData = sheetInv.getDataRange().getValues();
  const invHeaders = invData[0].map(normalize);
  const colIdInv = invHeaders.indexOf("id");
  const colStock = invHeaders.indexOf("stockactual");
  
  if (colIdInv !== -1 && colStock !== -1) {
    saleData.items.forEach(item => {
      const targetId = String(item.productId);
      for (let i = 1; i < invData.length; i++) {
        if (String(invData[i][colIdInv]) === targetId) {
          const currentStock = Number(invData[i][colStock]);
          sheetInv.getRange(i + 1, colStock + 1).setValue(currentStock - Number(item.cantidad));
          break;
        }
      }
    });
  }

  // 3. Actualizar Saldo Cliente
  const sheetCli = ss.getSheetByName('Clientes');
  let cliData = sheetCli.getDataRange().getValues();
  let cliHeaders = cliData[0].map(normalize);
  let colIdCli = cliHeaders.indexOf("id");
  let colSaldo = cliHeaders.indexOf("saldo");
  
  // Reparación si no existe la columna Saldo
  if (colSaldo === -1) {
    const newCol = sheetCli.getLastColumn() + 1;
    sheetCli.getRange(1, newCol).setValue('Saldo').setFontWeight('bold').setBackground('#F4F1DE');
    SpreadsheetApp.flush();
    cliData = sheetCli.getDataRange().getValues();
    cliHeaders = cliData[0].map(normalize);
    colSaldo = cliHeaders.indexOf("saldo");
  }
  
  if (colIdCli !== -1 && colSaldo !== -1) {
    for (let i = 1; i < cliData.length; i++) {
      if (String(cliData[i][colIdCli]) === String(saleData.clientId)) {
        const saldoActual = Number(cliData[i][colSaldo] || 0);
        sheetCli.getRange(i + 1, colSaldo + 1).setValue(saldoActual + Number(saleData.saldoRestante));
        break;
      }
    }
  }

  SpreadsheetApp.flush();
  return { success: true };
}

function processPurchase(purchaseData) {
  saveRecord('Compras', {
    'ID': purchaseData.id,
    'Fecha': purchaseData.fecha,
    'IDProducto': purchaseData.productId,
    'Cantidad': purchaseData.cantidad,
    'PrecioCosto': purchaseData.precioCosto,
    'Proveedor': purchaseData.proveedor
  });
  
  const ss = getSS();
  const sheetInv = ss.getSheetByName('Inventario');
  const invData = sheetInv.getDataRange().getValues();
  const headers = invData[0].map(normalize);
  const colIdInv = headers.indexOf("id");
  const colStock = headers.indexOf("stockactual");
  const colPPP = headers.indexOf("preciocostopromedio");
  
  if (colIdInv !== -1 && colStock !== -1 && colPPP !== -1) {
    const targetId = String(purchaseData.productId);
    for (let i = 1; i < invData.length; i++) {
      if (String(invData[i][colIdInv]) === targetId) {
        const stockActual = Number(invData[i][colStock]);
        const costoAnterior = Number(invData[i][colPPP]);
        const nuevaCantidad = Number(purchaseData.cantidad);
        const nuevoCosto = Number(purchaseData.precioCosto);
        
        const nuevoPPP = ((stockActual * costoAnterior) + (nuevaCantidad * nuevoCosto)) / (stockActual + nuevaCantidad);
        
        sheetInv.getRange(i + 1, colStock + 1).setValue(stockActual + nuevaCantidad);
        sheetInv.getRange(i + 1, colPPP + 1).setValue(nuevoPPP);
        break;
      }
    }
  }
  SpreadsheetApp.flush();
  return { success: true };
}
