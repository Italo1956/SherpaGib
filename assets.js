// assets.js - Asset Management System (ACTUALIZADO Y CORREGIDO)
class AssetsManager {
    constructor() {
        this.assets = [];
        this.nextAssetId = 1001;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Inicializar IndexedDB
            await indexedDBManager.init();
            
            // Cargar datos desde IndexedDB
            this.assets = await indexedDBManager.getAllAssets();
            
            // Calcular siguiente ID
            this.nextAssetId = this.calculateNextAssetId();
            
            // Si no hay datos, crear ejemplos
            if (this.assets.length === 0) {
                await this.createSampleAssets();
            }
            
            this.isInitialized = true;
            this.updateDashboard();
            
        } catch (error) {
            console.error('Error inicializando AssetsManager:', error);
            // Fallback a datos de ejemplo
            this.assets = [];
            this.createSampleAssets();
        }
    }

    calculateNextAssetId() {
        if (this.assets.length === 0) return 1001;
        
        const ids = this.assets.map(asset => {
            const num = asset.assetId ? parseInt(asset.assetId.replace('AST', '')) : 0;
            return num || 0;
        });
        
        const lastId = Math.max(...ids);
        return lastId + 1;
    }

    // MODIFICADO: Eliminados brand y color del ID
    generateAssetId(category, model, size) {
        const categoryCode = category ? category.substring(0, 2).toUpperCase() : 'UN';
        const modelCode = model ? model.substring(0, 2).toUpperCase() : 'GE';
        const sizeCode = this.getSizeCode(size);
        
        const id = `${categoryCode}_${modelCode}_${sizeCode}_${this.nextAssetId.toString().padStart(3, '0')}`;
        this.nextAssetId++;
        return id;
    }

    getSizeCode(size) {
        const sizeCodes = {
            'One Size': 'OS',
            'X Small': 'XS',
            'Small': 'SM',
            'Medium': 'MD',
            'Large': 'LG',
            'X Large': 'XL',
            'XX Large': '2X',
            '3X Large': '3X',
            '4X Large': '4X',
            '5X Large': '5X'
        };
        return sizeCodes[size] || 'SZ';
    }

    // NUEVO: Obtener imagen de la categoría
    getCategoryImage(categoryName) {
        if (typeof categoryManager !== 'undefined') {
            // Buscar la categoría por nombre
            const category = categoryManager.categories.find(cat => 
                cat.name.toUpperCase() === categoryName.toUpperCase()
            );
            
            if (category) {
                // Obtener la imagen almacenada en categoryManager
                return categoryManager.getImage(category.id);
            }
        }
        return ''; // Si no hay categoría o imagen, retorna cadena vacía
    }

    async createSampleAssets() {
        const sampleAssets = [
            {
                assetId: 'SHI-DRI-MD-1001',
                image: this.getCategoryImage('MENS SHIRTS'),
                category: "MEN'sSHIRT",
                model: 'Dri-FIT',
                size: 'Medium',
                price: 25.00,
                qtyInitial: 30,
                qtyAdd: 0,
                qtyLost: 2,
                qtyAvailable: 28,
                purchasedOn: '01/15/23',
                vendor: 'AMAZON',
                lifeTime: 1,
                qrCode: '✓',
                lowStockThreshold: 5,
                isLowStock: false
            },
            {
                assetId: 'CAP-COR-MD-1002',
                image: this.getCategoryImage('BALL CAPS'),
                category: 'BALL CAPS',
                model: 'Core',
                size: 'Medium',
                price: 15.00,
                qtyInitial: 20,
                qtyAdd: 0,
                qtyLost: 1,
                qtyAvailable: 19,
                purchasedOn: '02/20/23',
                vendor: 'AMAZON',
                lifeTime: 1,
                qrCode: '✓',
                lowStockThreshold: 5,
                isLowStock: false
            }
        ];

         // Guardar cada asset en IndexedDB
        for (const asset of sampleAssets) {
            await indexedDBManager.saveAsset(asset);
        }
        
        this.assets = sampleAssets;
        this.updateDashboard();
    }

    // MODIFICADO: Eliminados brand y color
    async addAsset(assetData) {
        const requiredFields = ['category', 'price', 'qtyInitial', 'purchasedOn'];
        const missingFields = requiredFields.filter(field => !assetData[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Obtener imagen de la categoría seleccionada
        const categoryImage = this.getCategoryImage(assetData.category);

        // CORREGIDO: Asegurar que price sea número
        const price = Math.round(Number(assetData.price) * 100) / 100 || 0;
        const qtyInitial = Math.round(Number(assetData.qtyInitial)) || 0;
        const qtyAdd = Math.round(Number(assetData.qtyAdd)) || 0;
        const qtyLost = parseInt(assetData.qtyLost) || 0;
        const qtyAvailable = qtyInitial + qtyAdd - qtyLost;
        const lowStockThreshold = parseInt(assetData.lowStockThreshold) || 5;

        // Generate asset ID
        const assetId = this.generateAssetId(
            assetData.category,
            assetData.model,
            assetData.size
        );

        const newAsset = {
            assetId: assetId,
            image: categoryImage,
            category: assetData.category.trim(),
            model: assetData.model || '',
            size: assetData.size || 'Medium',
            price: price, // CORREGIDO: Ya convertido a número
            qtyInitial: qtyInitial,
            qtyAdd: qtyAdd,
            qtyLost: qtyLost,
            qtyAvailable: qtyAvailable,
            purchasedOn: assetData.purchasedOn,
            vendor: assetData.vendor || 'AMAZON',
            lifeTime: parseInt(assetData.lifeTime) || 1,
            qrCode: assetData.qrCode || '✓',
            lowStockThreshold: lowStockThreshold,
            isLowStock: qtyAvailable <= lowStockThreshold,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Guardar en IndexedDB
        await indexedDBManager.saveAsset(newAsset);

        this.assets.push(newAsset);
        this.updateDashboard();

        // Registrar en auditoría
        await indexedDBManager.logAudit('CREATE', 'asset', `Asset created: ${assetId}`);
        
        return newAsset;
    }

    // CORREGIDO: Edit asset - manejo seguro de tipos de datos
    async editAsset(assetId, assetData) {
        const assetIndex = this.assets.findIndex(asset => asset.assetId === assetId);
        
        if (assetIndex === -1) {
            throw new Error('Asset not found');
        }

        // Si cambió la categoría, obtener nueva imagen
        let image = this.assets[assetIndex].image;
        if (assetData.category && assetData.category !== this.assets[assetIndex].category) {
            image = this.getCategoryImage(assetData.category);
        }

        // CORREGIDO: Conversión segura de tipos de datos
        const price = Math.round(Number(assetData.price) * 100) / 100 || this.assets[assetIndex].price;
        const qtyInitial = Math.round(Number(assetData.qtyInitial)) || this.assets[assetIndex].qtyInitial;
        const qtyAdd = Math.round(Number(assetData.qtyAdd)) || this.assets[assetIndex].qtyAdd;
        const qtyLost = parseInt(assetData.qtyLost) || this.assets[assetIndex].qtyLost;
        const qtyAvailable = qtyInitial + qtyAdd - qtyLost;
        const lowStockThreshold = parseInt(assetData.lowStockThreshold) || this.assets[assetIndex].lowStockThreshold || 5;

        // Update asset
        const updatedAsset = {
            ...this.assets[assetIndex],
            ...assetData,
            assetId: assetId, // Keep original ID
            image: image,
            price: price, 
            qtyInitial: qtyInitial,
            qtyAdd: qtyAdd,
            qtyLost: qtyLost,
            qtyAvailable: qtyAvailable,
            lowStockThreshold: lowStockThreshold,
            isLowStock: qtyAvailable <= lowStockThreshold,
            updatedAt: new Date().toISOString()
        };
         // Actualizar en IndexedDB
        await indexedDBManager.saveAsset(updatedAsset);

        this.assets[assetIndex] = updatedAsset;
        this.updateDashboard();

        // Registrar en auditoría
        await indexedDBManager.logAudit('UPDATE', 'asset', `Asset updated: ${assetId}`);

        return this.assets[assetIndex];
    }

    // Delete asset
    async deleteAsset(assetId) {
        const assetIndex = this.assets.findIndex(asset => asset.assetId === assetId);
        
        if (assetIndex === -1) {
            throw new Error('Asset not found');
        }

        const deletedAsset = this.assets.splice(assetIndex, 1)[0];

        // Eliminar de IndexedDB
        await indexedDBManager.deleteAsset(assetId);
        this.updateDashboard();

        // Registrar en auditoría
        await indexedDBManager.logAudit('DELETE', 'asset', `Asset deleted: ${assetId}`);
        
        return deletedAsset;
    }

    // Get all assets
    async getAllAssets() {
        // Siempre obtener datos frescos de IndexedDB
        this.assets = await indexedDBManager.getAllAssets();
        return [...this.assets].sort((a, b) => a.category.localeCompare(b.category));
    }

    // Search assets 
    async searchAssets(searchTerm) {
    const allAssets = await this.getAllAssets();
    if (!searchTerm || searchTerm.trim() === '') return allAssets;
    
    const term = searchTerm.toLowerCase().trim();
    
    return allAssets.filter(asset => {
        // Verificar cada campo de forma segura con valores por defecto
        const assetId = (asset.assetId || '').toString().toLowerCase();
        const category = (asset.category || '').toString().toLowerCase();
        const model = (asset.model || '').toString().toLowerCase();
        const size = (asset.size || '').toString().toLowerCase();
        const vendor = (asset.vendor || '').toString().toLowerCase();
        const lowStock = (asset.lowStockThreshold || '').toString().toLowerCase();
        const price = (asset.price || '').toString().toLowerCase();
        
        return (
            assetId.includes(term) ||
            category.includes(term) ||
            model.includes(term) ||
            size.includes(term) ||
            vendor.includes(term) ||
            lowStock.includes(term) ||
            price.includes(term)
        );
      });
    }

    categoryHasLowStock(categoryName) {
    const categoryAssets = this.getAssetsByCategory(categoryName);
    return categoryAssets.some(asset => {
        const threshold = asset.lowStockThreshold || 5;
        return asset.qtyAvailable <= threshold;
    });
}

    // Get assets by category
   async getAssetsByCategory(category) {
        return await indexedDBManager.getAssetsByCategory(category);
    }

    // Get statistics
    getStats() {
        const totalAssets = this.assets.reduce((sum, asset) => sum + asset.qtyInitial, 0);
        const totalCost = this.assets.reduce((sum, asset) => sum + (asset.price * asset.qtyInitial), 0);
        const totalLost = this.assets.reduce((sum, asset) => sum + asset.qtyLost, 0);
        const totalAvailable = this.assets.reduce((sum, asset) => sum + asset.qtyAvailable, 0);
        
        const lostPercentage = totalAssets > 0 ? (totalLost / totalAssets * 100).toFixed(1) : 0;
        const totalLostCost = this.assets.reduce((sum, asset) => sum + (asset.price * asset.qtyLost), 0);
        
        return {
            total: totalAssets,
            totalCost: totalCost.toFixed(2),
            totalAvailable: totalAvailable,
            totalLost: totalLost,
            lostPercentage: lostPercentage,
            totalLostCost: totalLostCost.toFixed(2),
            nextAssetId: this.nextAssetId
        };
    }

    // Update dashboard
    updateDashboard() {
        const stats = this.getStats();
        
        // Update assets quantity in dashboard
        const assetsQtyElement = document.getElementById('assetsQty');
        if (assetsQtyElement) {
            assetsQtyElement.textContent = stats.total;
        }
        
        // Update assets cost in dashboard
        const assetsCostElement = document.getElementById('assetsCost');
        if (assetsCostElement) {
            assetsCostElement.textContent = `$${stats.totalCost}`;
        }
        
        // Update lost assets in dashboard
        const lostQtyElement = document.getElementById('lostQty');
        if (lostQtyElement) {
            lostQtyElement.textContent = stats.totalLost;
        }
        
        // Update lost percentage in dashboard
        const lostPercentageElement = document.getElementById('lostPercentage');
        if (lostPercentageElement) {
            lostPercentageElement.textContent = `${stats.lostPercentage}%`;
        }
        
        // Update lost cost in dashboard
        const lostCostElement = document.getElementById('lostCost');
        if (lostCostElement) {
            lostCostElement.textContent = `$${stats.totalLostCost}`;
        }
        
        // Update available assets in dashboard
        const availableQtyElement = document.getElementById('availableQty');
        if (availableQtyElement) {
            availableQtyElement.textContent = stats.totalAvailable;
        }
    }

    // NUEVO: Función para recuperar datos corruptos
    async recoverData() {
        try {
        // Intentar recuperar datos del IndexedDB CON VALIDACIÓN
        const storedAssets = await indexedDBManager.getAllAssets();
        
        // MANTENER TU VALIDACIÓN ORIGINAL
        this.assets = storedAssets.map(asset => ({
            ...asset,
            price: typeof asset.price === 'number' ? asset.price : parseFloat(asset.price) || 0
        }));
        
        this.nextAssetId = this.calculateNextAssetId();
        this.updateDashboard();
        return true;
        
    } catch (error) {
        console.error('Error recovering data:', error);
        // Si hay error, crear datos de muestra
        await this.createSampleAssets();
    }
        return false;
    }

    // NUEVO: Método para importar desde Excel
    async importFromExcel(file, replaceExisting = false) {
        if (!file) {
            throw new Error('No file selected');
        }

        // Check if SheetJS is available
        if (typeof XLSX === 'undefined') {
            throw new Error('SheetJS library not loaded. Please include the XLSX library (xlsx.full.min.js) before assets.js');
        }

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Get first worksheet
            const worksheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[worksheetName];
            
            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length <= 1) {
                throw new Error('No data found in the Excel file');
            }

            const headers = jsonData[0].map(h => h ? h.toString().trim().toLowerCase() : '');
            const importedAssets = [];

            // Process each row (skip header)
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;

                const assetData = {};
                
                headers.forEach((header, index) => {
                    const value = row[index] ? row[index].toString().trim() : '';
                    
                    switch(header) {
                        case 'asset_id':
                        case 'asset id':
                        case 'id':
                            assetData.assetId = value;
                            break;
                        case 'category':
                            assetData.category = value;
                            break;
                        case 'model':
                            assetData.model = value;
                            break;
                        case 'size':
                            assetData.size = value || 'Medium';
                            break;
                        case 'price':
                        case 'unit price':
                            assetData.price = Number(value).toFixed(2) || 0;
                            break;
                        case 'qty_initial':
                        case 'qty initial':
                        case 'initial quantity':
                            assetData.qtyInitial = Number(value).toFixed(0) || 0;
                            break;
                        case 'qty_add':
                        case 'qty add':
                        case 'additional quantity':
                            assetData.qtyAdd = Number(value).toFixed(0) || 0;
                            break;
                        case 'qty_lost':
                        case 'qty lost':
                        case 'lost quantity':
                            assetData.qtyLost = Number(value.toFixed)(0) || 0;
                            break;
                        case 'purchased_on':
                        case 'purchased on':
                        case 'purchase date':
                            assetData.purchasedOn = this.formatDateForDisplay(value);
                            break;
                        case 'vendor':
                        case 'supplier':
                            assetData.vendor = value || 'AMAZON';
                            break;
                        case 'life_time':
                        case 'life time':
                        case 'lifetime':
                            assetData.lifeTime = Number(value.toFixed)(0) || 1;
                            break;
                    }
                });

                // Only add if we have required fields
                if (assetData.category && assetData.price && assetData.qtyInitial) {
                    importedAssets.push(assetData);
                }
            }

            if (importedAssets.length === 0) {
                throw new Error('No valid asset data found in the Excel file');
            }

            // Add all imported assets
            const results = await this.addMultipleAssets(importedAssets, replaceExisting);
            
            return {
                success: true,
                imported: results.success.length,
                errors: results.errors.length,
                details: results,
                message: `Successfully imported ${results.success.length} assets, ${results.errors.length} errors`
            };

        } catch (error) {
            throw new Error('Failed to process Excel file: ' + error.message);
        }
    }

    // NUEVO: Método para agregar múltiples assets
    async addMultipleAssets(assetsData, replaceExisting = false) {
        const results = {
            success: [],
            errors: []
        };

        if (replaceExisting) {
            // Limpiar todos los assets existentes
            const allAssets = await this.getAllAssets();
            for (const asset of allAssets) {
                await indexedDBManager.deleteAsset(asset.assetId);
            }
            this.assets = [];
            this.nextAssetId = 1001;
        }

        for (let i = 0; i < assetsData.length; i++) {
            const assetData = assetsData[i];
            try {
                const newAsset = await this.addAsset(assetData);
                results.success.push({
                    index: i + 1,
                    asset: newAsset
                });
            } catch (error) {
                results.errors.push({
                    index: i + 1,
                    data: assetData,
                    error: error.message
                });
            }
        }

        this.updateDashboard();
        return results;
    }

    // Export to Excel
    async exportToExcel() {
        // Obtener datos frescos de IndexedDB
        const sortedAssets = await this.getAllAssets();
    
    const data = sortedAssets.map(asset => ({
            'Asset ID': asset.assetId,
            'Category': asset.category,
            'Model': asset.model,
            'Size': asset.size,
            'Price': asset.price,
            'Qty Initial': asset.qtyInitial,
            'Qty Add': asset.qtyAdd,
            'Qty Lost': asset.qtyLost,
            'Qty Available': asset.qtyAvailable,
            'Low Stock Alert': asset.qtyAvailable <= asset.lowStockThreshold ? 'YES' : 'NO',
            'Purchased On': asset.purchasedOn,
            'Vendor': asset.vendor,
            'Life Time': asset.lifeTime,
            'QR Code': asset.qrCode
        }));

        if (data.length === 0) {
            throw new Error('No data to export');
        }

        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(data);
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Assets');
        
        // Generate Excel file and download
        XLSX.writeFile(workbook, `assets_export_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        return {
            success: true,
            exported: data.length,
            message: `Successfully exported ${data.length} assets to Excel file`
        };
    }

    // NUEVO: Método para exportar a PDF - CORREGIDO CON ENCABEZADO Y LOGO
async exportToPDF() {
    // Obtener datos frescos de IndexedDB
        const assets = await this.getAllAssets();

    if (assets.length === 0) {
        throw new Error('No data to export');
    }

    // Obtener estadísticas correctas
    const stats = this.getStats();

    // Create a new window for PDF content
    const pdfWindow = window.open('', '_blank');
    const today = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    });

    let pdfContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Assets Report - ${today}</title>
            <style>
                @media print {
                    .header { 
                        position: fixed; 
                        top: 0; 
                        left: 0; 
                        right: 0; 
                        background: white; 
                        padding: 10px 20px; 
                        border-bottom: 2px solid #2c3e50;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        z-index: 1000;
                    }
                    .content { 
                        margin-top: 60px; 
                    }
                    thead th { 
                        position: sticky; 
                        top: 120px; 
                        background: #34495e !important;
                    }
                }
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 0;
                    padding: 0;
                }
                .header { 
                    background: white; 
                    padding: 15px 20px; 
                    border-bottom: 2px solid #2c3e50;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .header-left { display: flex; align-items: center; gap: 15px; }
                .logo { width: 60px; height: 60px; border-radius: 8px; }
                .company-info { text-align: left; }
                .company-name { font-size: 20px; font-weight: bold; color: #2c3e50; margin: 0; }
                .report-title { font-size: 16px; color: #7f8c8d; margin: 0; }
                .header-right { text-align: right; }
                .report-date { font-size: 14px; color: #7f8c8d; margin: 0; }
                .content { padding: 20px; }
                .stats { display: flex; justify-content: center; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
                .stat-box { background: #f8f9fa; padding: 10px 20px; border-radius: 5px; text-align: center; border: 1px solid #ddd; min-width: 120px; }
                .stat-number { font-size: 24px; font-weight: bold; color: #2c3e50; }
                .stat-label { font-size: 12px; color: #7f8c8d; }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 20px 0; 
                    font-size: 10px; 
                    page-break-inside: auto; 
                }
                th { 
                    background: #34495e; 
                    color: white; 
                    padding: 4px 3px;  /* REDUCIDO */
                    text-align: left; 
                    font-weight: bold; 
                    border: 1px solid #2c3e50;
                }
                td { 
                    padding: 3px 2px;  /* REDUCIDO */
                    border-bottom: 1px solid #ddd; 
                    border-right: 1px solid #eee;
                    font-size: 9px; 
                    page-break-inside: avoid; 
                }
                tr { page-break-inside: avoid; page-break-after: auto; }
                tr:nth-child(even) { background: #f8f9fa; }
                .asset-image { width: 25px; height: 25px; object-fit: cover; border-radius: 3px; }
                .placeholder-image { width: 25px; height: 25px; border-radius: 3px; background: #bdc3c7; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 8px; }
                .highlight-red { color: #e74c3c; background: #ffeaea; font-weight: bold; }
                .highlight-green { color: #27ae60; font-weight: bold; }
                .qr-code { text-align: center; font-weight: bold; color: #27ae60; }
                .footer { text-align: center; margin-top: 30px; color: #7f8c8d; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px; }
                .page-break { page-break-before: always; }
            </style>
        </head>
        <body>
    `;

    // Dividir los assets en grupos para manejar paginación
    const assetsPerPage = 15;
    let currentPage = 1;
    let totalPages = Math.ceil(this.assets.length / assetsPerPage);
    
    for (let page = 1; page <= totalPages; page++) {
        // Agregar encabezado para cada página
        pdfContent += `
            <!-- Página ${page} -->
            <div class="header">
                <div class="header-left">
                    <img src="logo.png" alt="Company Logo" class="logo" onerror="this.style.display='none'">
                    <div class="company-info">
                        <h1 class="company-name">Sherpa Delivery Direct, LLC</h1>
                        <div class="report-title">Assets Inventory Report</div>
                    </div>
                </div>
                <div class="header-right">
                    <div class="report-date">Generated: ${today}</div>
                    <!-- <div class="report-date">Page ${page} of ${totalPages}</div> -->
                    <div class="report-date">Total Pages ${totalPages}</div>
                </div>
            </div>

            <div class="content">
        `;

        // Agregar estadísticas solo en la primera página
        if (page === 1) {
            pdfContent += `
                <div class="stats">
                    <div class="stat-box">
                        <div class="stat-number">${stats.total}</div>
                        <div class="stat-label">Total Assets</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">$${stats.totalCost}</div>
                        <div class="stat-label">Total Cost</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${stats.totalLost}</div>
                        <div class="stat-label">Total Lost</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${stats.totalAvailable}</div>
                        <div class="stat-label">Available</div>
                    </div>
                </div>
            `;
        }

        // Agregar tabla con encabezados
        pdfContent += `
            <table>
                <thead>
                    <tr>
                        <th style="text-align: center; width: 40px;">IMAGE</th>
                        <th style="width: 80px;">CATEGORY</th>
                        <th style="width: 70px;">MODEL</th>
                        <th style="width: 50px;">SIZE</th>
                        <th style="width: 100px;">ASSET ID</th>
                        <th style="width: 50px;">PRICE</th>
                        <th style="width: 50px;">QTY INIT</th>
                        <th style="width: 50px;">QTY ADD</th>
                        <th style="width: 50px;">QTY LOST</th>
                        <th style="width: 60px;">QTY AVAIL</th>
                        <th style="width: 70px;">PURCHASED</th>
                        <th style="width: 60px;">VENDOR</th>
                        <th style="width: 60px;">LIFE TIME</th>
                        <th style="text-align: center; width: 50px;">QR CODE</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // Agregar assets para esta página
        // Ordenar assets por categoría antes de exportar
        const sortedAssets = [...this.assets].sort((a, b) => a.category.localeCompare(b.category));
        const startIndex = (page - 1) * assetsPerPage;
        const endIndex = Math.min(startIndex + assetsPerPage, this.assets.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const asset = sortedAssets[i];
            const categoryCode = asset.category ? asset.category.substring(0, 2).toUpperCase() : 'AS';
            
            pdfContent += `
                <tr>
                    <td style="text-align: center;">
                        ${asset.image ? 
                            `<img src="${asset.image}" alt="${asset.category}" class="asset-image">` : 
                            `<div class="placeholder-image">${categoryCode}</div>`
                        }
                    </td>
                    <td>${asset.category}</td>
                    <td>${asset.model}</td>
                    <td>${asset.size}</td>
                    <td style="font-weight: bold;">${asset.assetId}</td>
                    <td>$${asset.price.toFixed(2)}</td>
                    <td>${asset.qtyInitial}</td>
                    <td>${asset.qtyAdd}</td>
                    <td class="highlight-red">${asset.qtyLost}</td>
                    <td class="${asset.qtyAvailable <= asset.lowStockThreshold ? 'highlight-red' : 'highlight-green'}" style="font-weight: bold;">${asset.qtyAvailable}</td>
                    <td style="white-space: nowrap;">${asset.purchasedOn}</td>
                    <td>${asset.vendor}</td>
                    <td>${asset.lifeTime} year(s)</td>
                    <td class="qr-code">${asset.qrCode}</td>
                </tr>
            `;
        }

        pdfContent += `
                </tbody>
            </table>
            
            <div class="footer">
                Asset Management System - Confidential Report | Page ${page} of ${totalPages} | Total Records: ${this.assets.length}
            </div>
        </div>
        `;

        // Agregar salto de página excepto para la última página
        if (page < totalPages) {
            pdfContent += `<div class="page-break"></div>`;
        }
    }

    pdfContent += `
            <script>
                // Auto-print and close
                window.onload = function() {
                    window.print();
                    setTimeout(() => {
                        window.close();
                    }, 1000);
                };
            </script>
        </body>
        </html>
    `;

    pdfWindow.document.write(pdfContent);
    pdfWindow.document.close();

    return {
        success: true,
        exported: assets.length,
        message: `Successfully exported ${assets.length} assets to PDF`
    };
    
}

    async clearAll() {
    // Limpiar IndexedDB
    await indexedDBManager.clear('assets');
    
    this.assets = [];
    this.nextAssetId = 1001;
    this.updateDashboard();
    
    // Registrar en auditoría
    await indexedDBManager.logAudit('CLEAR', 'asset', 'All assets cleared');
}

    // NUEVO: Helper function para formatear fechas
    formatDateForDisplay(dateValue) {
        if (!dateValue) return '';
        
        let date;
        
        // Handle Excel serial date numbers
        if (typeof dateValue === 'number') {
            date = XLSX.SSF.parse_date_code(dateValue);
            if (date) {
                const month = (date.m).toString().padStart(2, '0');
                const day = (date.d).toString().padStart(2, '0');
                const year = (date.y % 100).toString().padStart(2, '0');
                return `${month}/${day}/${year}`;
            }
        }
        
        // Handle string dates
        try {
            date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                const year = date.getFullYear().toString().slice(-2);
                return `${month}/${day}/${year}`;
            }
        } catch (e) {
            console.warn('Could not parse date:', dateValue);
        }
        
        // Return original if can't parse
        return dateValue.toString();
    }
}

// Global instance of assets manager
const assetsManager = new AssetsManager();

// UI Functions for Assets (FUERA DE LA CLASE)
function openAssetsModal() {
    document.getElementById('assetsModal').style.display = 'block';
    loadCategoriesFromCategoryJS();
    loadAssetsTable();
    updateAssetsStats();
}

function closeAssetsModal() {
    document.getElementById('assetsModal').style.display = 'none';
    resetAssetForm();
}

function resetAssetForm() {
    document.getElementById('assetForm').reset();
    document.getElementById('assetId').value = '';
    document.getElementById('formTitle').textContent = 'Add Asset';
    document.getElementById('submitAssetBtn').textContent = 'Add';
    document.getElementById('vendor').value = 'AMAZON';
    document.getElementById('lifeTime').value = '1';
    document.getElementById('size').value = 'Medium';
    document.getElementById('lowStockThreshold').value = '5';
    
    // Set today's date for purchased on
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const year = today.getFullYear();
    document.getElementById('purchasedOn').value = `${year}-${month}-${day}`;
}

// NUEVO: Función para actualizar estadísticas con botones de exportación
function updateAssetsStats() {
    const stats = assetsManager.getStats();
    const statsElement = document.getElementById('assetsStats');
    if (statsElement) {
        statsElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div style="background: #27ae60; color: white; padding: 10px 15px; border-radius: 5px; font-weight: bold;">
                        Total Assets: ${stats.total}
                    </div>
                    <div style="background: #3498db; color: white; padding: 10px 15px; border-radius: 5px; font-weight: bold;">
                        Total Cost: $${stats.totalCost}
                    </div>
                    <div style="background: #e74c3c; color: white; padding: 10px 15px; border-radius: 5px; font-weight: bold;">
                        Lost: ${stats.totalLost} (${stats.lostPercentage}%)
                    </div>
                    <div style="background: #f39c12; color: white; padding: 10px 15px; border-radius: 5px; font-weight: bold;">
                        Next ID: ${stats.nextAssetId}
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="showAssetsImportOptions()" class="btn-import" 
                            style="background: #9b59b6; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 12px;">
                        📥 Import Excel
                    </button>
                    <button onclick="exportAssetsToExcel()" class="btn-export"
                            style="background: #2ecc71; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 12px;">
                        📤 Export Excel
                    </button>
                    <button onclick="exportAssetsToPDF()" class="btn-pdf"
                            style="background: #e74c3c; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 12px;">
                        📄 Export PDF
                    </button>
                </div>
            </div>
        `;
    }
}

// MODIFICADO: Eliminadas columnas brand y color
async function loadAssetsTable(assets = null) {
    const tbody = document.getElementById('assetsTable');
    let assetsToDisplay = assets || await assetsManager.getAllAssets();
    
    tbody.innerHTML = '';
    
    if (assetsToDisplay.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="14" style="text-align: center; color: #666; padding: 30px;">
                No assets found
            </td>
        `;
        tbody.appendChild(row);
        return;
    }
    
    assetsToDisplay.forEach(asset => {
        const row = document.createElement('tr');
        
        // CORREGIDO: Asegurar que price sea número antes de usar toFixed
        const price = typeof asset.price === 'number' ? asset.price : parseFloat(asset.price) || 0;
        
        row.innerHTML = `
            <td style="text-align: center; ">
       ${asset.image ? 
            `<img src="${asset.image}" alt="${asset.category}" class="asset-image-hover">` : 
            `<div style="width: 40px; height: 40px; border-radius: 5px; background: #ecf0f1; display: flex; align-items: center; justify-content: center; color: #7f8c8d; border: 1px dashed #bdc3c7; font-size: 12px; margin: 0 auto;">
                NO IMG
            </div>`
        }
    </td>
            <td>${asset.category}</td>
            <td>${asset.model}</td>
            <td>${asset.size}</td>
            <td style="font-weight: bold;">${asset.assetId}</td>
            <td>$${price.toFixed(2)}</td>
            <td>${asset.qtyInitial}</td>
            <td>${asset.qtyAdd}</td>
            <td>${asset.qtyLost}</td>
            <td style="font-weight: bold; ${asset.isLowStock ? 'color: #e74c3c; background: #ffeaea;' : 'color: #27ae60;'}">${asset.qtyAvailable}</td>
            <td style="white-space: nowrap;">${asset.purchasedOn}</td>
            <td>${asset.vendor}</td>
            <td>${asset.lifeTime} year(s)</td>
            <td style="text-align: center;">${asset.qrCode}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button onclick="editAsset('${asset.assetId}')" class="btn-edit" title="Edit">
                    ✏️
                </button>
                <button onclick="deleteAsset('${asset.assetId}')" class="btn-delete" title="Delete">
                    🗑️
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    updateAssetsStats();
}

function loadCategoriesFromCategoryJS() {
    const select = document.getElementById('category');
    select.innerHTML = '<option value="">Select Category</option>';
    
    // Leer las categorías desde categoryManager
    if (typeof categoryManager !== 'undefined' && categoryManager.categories) {
        categoryManager.categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            select.appendChild(option);
        });
    }
}

// MODIFICADO: Eliminados brand y color del formulario
async function submitAssetForm(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const assetId = document.getElementById('assetId').value;
    
    const assetData = {
        category: formData.get('category').trim(),
        model: formData.get('model').trim(),
        size: formData.get('size'),
        price: formData.get('price'),
        qtyInitial: formData.get('qtyInitial'),
        qtyAdd: formData.get('qtyAdd') || 0,
        qtyLost: formData.get('qtyLost') || 0,
        purchasedOn: formData.get('purchasedOn'),
        vendor: formData.get('vendor'),
        lifeTime: formData.get('lifeTime'),
        lowStockThreshold: formData.get('lowStockThreshold'),
        qrCode: '✓'
    };
    
    // Format date to mm/dd/yy
    if (assetData.purchasedOn) {
        const date = new Date(assetData.purchasedOn);
        assetData.purchasedOn = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
    }
    
    try {
        if (assetId) {
            // Edit existing asset
            await assetsManager.editAsset(assetId, assetData);
            showNotification('✅ Asset updated successfully', 'success');
        } else {
            // Add new asset
            const newAsset = await assetsManager.addAsset(assetData);
            showNotification(`✅ Asset added: ${newAsset.assetId}`, 'success');
        }
        
        await loadAssetsTable();
        resetAssetForm();
        
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

// MODIFICADO: Eliminados brand y color
function editAsset(assetId) {
    const asset = assetsManager.assets.find(a => a.assetId === assetId);
    
    if (asset) {
        document.getElementById('assetId').value = asset.assetId;
        document.getElementById('category').value = asset.category;
        document.getElementById('model').value = asset.model;
        document.getElementById('size').value = asset.size;
        document.getElementById('lowStockThreshold').value = asset.lowStockThreshold || 5;
        
        // CORREGIDO: Asegurar que price sea número
        const price = typeof asset.price === 'number' ? asset.price : parseFloat(asset.price) || 0;
        document.getElementById('price').value = price;
        
        document.getElementById('qtyInitial').value = asset.qtyInitial;
        document.getElementById('qtyAdd').value = asset.qtyAdd;
        document.getElementById('qtyLost').value = asset.qtyLost;
        
        // Convert date format back to YYYY-MM-DD for input field
        const purchasedOn = convertToInputDate(asset.purchasedOn);
        document.getElementById('purchasedOn').value = purchasedOn;
        
        document.getElementById('vendor').value = asset.vendor;
        document.getElementById('lifeTime').value = asset.lifeTime;
        
        document.getElementById('formTitle').textContent = 'Edit Asset';
        document.getElementById('submitAssetBtn').textContent = 'Update';
        
        document.getElementById('assetsModal').style.display = 'block';
    }
}

async function deleteAsset(assetId) {
    const asset = assetsManager.assets.find(a => a.assetId === assetId);
    
    if (asset && confirm(`Are you sure you want to delete asset:\n${asset.assetId} - ${asset.category} ${asset.model}?`)) {
        try {
            const deletedAsset = await assetsManager.deleteAsset(assetId);
            showNotification(`🗑️ Asset deleted: ${deletedAsset.assetId}`, 'success');
            await loadAssetsTable();
        } catch (error) {
            showNotification(`❌ ${error.message}`, 'error');
        }
    }
}

// Search function
async function searchAssets() {
    const searchTerm = document.getElementById('assetSearch').value;
    const filteredAssets = await assetsManager.searchAssets(searchTerm);
    loadAssetsTable(filteredAssets);
}

// Helper function for date conversion
function convertToInputDate(dateStr) {
    if (!dateStr) return '';
    
    // Handle mm/dd/yy format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const month = parts[0];
        const day = parts[1];
        let year = parts[2];
        
        // Convert 2-digit year to 4-digit
        if (year.length === 2) {
            year = '20' + year;
        }
        
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    return dateStr;
}

// NUEVA: Función para recuperar datos
function recoverAssetsData() {
    if (confirm('¿Recuperar datos de assets? Esto puede solucionar errores de datos corruptos.')) {
        const success = assetsManager.recoverData();
        if (success) {
            showNotification('✅ Datos recuperados correctamente', 'success');
            loadAssetsTable();
        } else {
            showNotification('❌ No se pudieron recuperar los datos', 'error');
        }
    }
}

// NUEVO: Funciones UI para importación/exportación
function showAssetsImportOptions() {
    const importModal = document.getElementById('assetsImportOptionsModal');
    if (importModal) {
        importModal.style.display = 'flex';
    } else {
        createAssetsImportOptionsModal();
    }
}

function createAssetsImportOptionsModal() {
    const modalHTML = `
    <div id="assetsImportOptionsModal" class="modal" style="display: none;">
        <div class="modal-content" style="max-width: 500px;">
            <span class="close" onclick="closeAssetsImportOptions()">&times;</span>
            <h3 style="color: #2c3e50; margin-bottom: 20px;">Import Excel Options - Assets</h3>
            
            <div style="margin-bottom: 20px;">
                <p style="margin-bottom: 15px; color: #555;">Choose how you want to import the data:</p>
                
                <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="assetsImportOption" value="append" checked>
                        <span>Append to existing data</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="assetsImportOption" value="replace">
                        <span>Replace all data</span>
                    </label>
                </div>
                
                <div style="background: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #ffc107;">
                    <strong>Note:</strong> 
                    <ul style="margin: 8px 0 0 15px; font-size: 12px;">
                        <li>Supported formats: .xlsx, .xls</li>
                        <li>Required columns: Category, Price, Qty Initial, Purchased On</li>
                        <li>Optional columns: Asset ID, Model, Size, Qty Add, Qty Lost, Vendor, Life Time</li>
                        <li>Asset ID will be auto-generated if not provided</li>
                    </ul>
                </div>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="closeAssetsImportOptions()" style="background: #95a5a6; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    Cancel
                </button>
                <button onclick="proceedWithAssetsImport()" style="background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    Continue
                </button>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('assetsImportOptionsModal').style.display = 'flex';
}

function closeAssetsImportOptions() {
    const modal = document.getElementById('assetsImportOptionsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function proceedWithAssetsImport() {
    const importOption = document.querySelector('input[name="assetsImportOption"]:checked').value;
    const replaceExisting = importOption === 'replace';
    
    closeAssetsImportOptions();
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls';
    
    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        showNotification('📥 Processing Excel file...', 'info');
        
        try {
            const result = await assetsManager.importFromExcel(file, replaceExisting);
            showNotification(`✅ ${result.message}`, 'success');

            // Show detailed results if there were errors
            if (result.details.errors.length > 0) {
                console.warn('Import errors:', result.details.errors);
                setTimeout(() => {
                    showNotification(`⚠️ ${result.details.errors.length} records had errors (check console)`, 'info');
                }, 30000);
            }
            
            // Refresh the table to show imported data
            loadAssetsTable();

        } catch (error) {
            showNotification(`❌ Import failed: ${error.message}`, 'error');
        }
    };
    
    fileInput.click();
}

function exportAssetsToExcel() {
    try {
        const result = assetsManager.exportToExcel();
        showNotification(`✅ ${result.message}`, 'success');
    } catch (error) {
        showNotification(`❌ Export failed: ${error.message}`, 'error');
    }
}

function exportAssetsToPDF() {
    try {
        const result = assetsManager.exportToPDF();
        showNotification(`✅ ${result.message}`, 'success');
    } catch (error) {
        showNotification(`❌ PDF export failed: ${error.message}`, 'error');
    }
}

function showNotification(message, type) {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-size: 14px;
        ${type === 'success' ? 'background: #27ae60;' : 
          type === 'error' ? 'background: #e74c3c;' : 
          type === 'info' ? 'background: #3498db;' : 'background: #f39c12;'}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 4000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('assetsModal')) {
        createAssetsModal();
    }
    // Initialize dashboard
    assetsManager.updateDashboard();
});

// MODIFICADO: Eliminados campos brand y color del modal
function createAssetsModal() {
    const modalHTML = `
    <div id="assetsModal" class="modal" style="display: none;">
        <div class="modal-content" style="max-width: 95%; width: 95%;">
        <style>
                .asset-image-hover {
                    transition: transform 0.3s ease;
                    cursor: pointer;
                    width: 40px;
                    height: 40px;
                    object-fit: cover;
                    border-radius: 5px;
                    border: 1px solid #ddd;
                }
                
                .asset-image-hover:hover {
                    transform: scale(2.5); 
                    z-index: 1000;
                    position: relative;
                    transform-origin: left center;
                    box-shadow: 0 0 20px rgba(0,0,0,0.5);
                    border: 2px solid white;
                }
            </style>
            <span class="close" onclick="closeAssetsModal()">&times;</span>
            <h2 id="formTitle" style="color: #2c3e50; margin-bottom: 10px;">Asset Management</h2>
            
            <div style="margin-bottom: 15px;">
                <button onclick="recoverAssetsData()" style="background: #f39c12; color: white; padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    🔄 Recover Data
                </button>
            </div>
            
            <div id="assetsStats"></div>
            
            <div style="display: grid; grid-template-columns: 1fr 4fr; gap: 15px;">
                <!-- Form -->
                <div style="background: #f8f9fa; padding: 10px; border-radius: 10px;">
                    <form id="assetForm" onsubmit="submitAssetForm(event)">
                        <input type="hidden" id="assetId">
                        
                        <div style="color: #e74c3c; font-size: 12px; margin-bottom: 15px; font-weight: bold;">
                            Note: * required fields
                        </div>
                        
                        <div class="form-section" style="margin-bottom: 5px;">
                            <h3 style="color: #34495e; margin-bottom: 7px;">Asset Information</h3>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Category:*</label>
                                <select id="category" name="category" required
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                    <option value="">Select Category</option>
                                </select>
                                <div style="font-size: 11px; color: #666; margin-top: 5px;">
                                    💡 La imagen se tomará automáticamente de la categoría seleccionada
                                </div>
                            </div>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Model:</label>
                                <input type="text" id="model" name="model"
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                                       placeholder="e.g., Dri-FIT, Core">
                            </div>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Size:</label>
                                <select id="size" name="size" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                    <option value="One Size">One Size</option>
                                    <option value="X Small">X Small</option>
                                    <option value="Small">Small</option>
                                    <option value="Medium" selected>Medium</option>
                                    <option value="Large">Large</option>
                                    <option value="X Large">X Large</option>
                                    <option value="XX Large">XX Large</option>
                                    <option value="3X Large">3X Large</option>
                                    <option value="4X Large">4X Large</option>
                                    <option value="5X Large">5X Large</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="form-section" style="margin-bottom: 10px;">
                            <h3 style="color: #34495e; margin-bottom: 15px;">Pricing & Quantity</h3>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Price:*</label>
                                <input type="number" id="price" name="price" step="0.01" min="0" required
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Qty Initial:*</label>
                                <input type="number" id="qtyInitial" name="qtyInitial" min="0" required
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Qty Add:</label>
                                <input type="number" id="qtyAdd" name="qtyAdd" min="0"
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="0">
                            </div>
                            
                        </div>
                        
                        <div class="form-section" style="margin-bottom: 10px;">
                            <h3 style="color: #34495e; margin-bottom: 15px;">Purchase Details</h3>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Purchased On:*</label>
                                <input type="date" id="purchasedOn" name="purchasedOn" required
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Vendor:</label>
                                <select id="vendor" name="vendor" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                    <option value="AMAZON" selected>AMAZON</option>
                                    <option value="WALMART">WALMART</option>
                                    <option value="TARGET">TARGET</option>
                                    <option value="NIKE">NIKE</option>
                                    <option value="ADIDAS">ADIDAS</option>
                                    <option value="OTHER">OTHER</option>
                                </select>
                            </div>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Life Time (years):</label>
                                <input type="number" id="lifeTime" name="lifeTime" min="1" max="10"
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="2">
                            </div>

                            <!-- AGREGAR CAMPO LOW STOCK THRESHOLD -->
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Low Stock Alert:</label>
                                <input type="number" id="lowStockThreshold" name="lowStockThreshold" min="1" max="100"
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="5">
                                <div style="font-size: 11px; color: #666; margin-top: 5px;">
                                    💡 QTY AVAIL turns red when stock ≤ this number
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-buttons" style="display: flex; gap: 10px;">
                            <button type="submit" id="submitAssetBtn" class="btn-submit" 
                                    style="background: #27ae60; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                                Add
                            </button>
                            <button type="button" onclick="closeAssetsModal()" class="btn-cancel"
                                    style="background: #95a5a6; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
                
                <!-- Asset List -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 style="color: #2c3e50; margin: 0;">Asset List</h3>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="text" id="assetSearch" placeholder="Search assets..." 
                                   onkeyup="searchAssets()"
                                   style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 250px;"
                                   title="Type to search assets">
                        </div>
                    </div>
                    <div style="overflow-x: auto; max-height: 70vh;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr style="background: #34495e; color: white; position: sticky; top: 0;">
                                    <th style="padding: 10px 5px; text-align: center; font-weight: bold;">IMAGE</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold;">CATEGORY</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold;">MODEL</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold;">SIZE</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold;">ASSET ID</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold;">PRICE</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold;">QTY INIT</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold;">QTY ADD</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold;">QTY LOST</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold;">QTY AVAIL</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold;">PURCHASED</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold;">VENDOR</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold;">LIFE TIME</th>
                                    <th style="padding: 10px 5px; text-align: center; font-weight: bold;">QR CODE</th>
                                    <th style="padding: 10px 5px; text-align: center; font-weight: bold;">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody id="assetsTable" style="background: white;">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Set initial date format
    resetAssetForm();
}
