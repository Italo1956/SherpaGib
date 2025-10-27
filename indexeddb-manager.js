// indexeddb-manager.js - Gestión COMPLETA de IndexedDB para Sherpa System
class IndexedDBManager {
    constructor() {
        this.dbName = 'SherpaSystemDB';
        this.version = 2; // Versión incrementada para estructura completa
        this.db = null;
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('❌ Error conectando a IndexedDB:', request.error);
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                console.log('✅ IndexedDB conectado exitosamente');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                console.log(`🔄 Actualizando BD: v${oldVersion} → v${this.version}`);
                
                this.createObjectStores(db, oldVersion);
            };
        });
    }

    createObjectStores(db, oldVersion) {
        // === ASSETS - Equipos/Activos ===
        if (!db.objectStoreNames.contains('assets')) {
            const assetsStore = db.createObjectStore('assets', { keyPath: 'assetId' });
            assetsStore.createIndex('category', 'category', { unique: false });
            assetsStore.createIndex('model', 'model', { unique: false });
            assetsStore.createIndex('size', 'size', { unique: false });
            assetsStore.createIndex('status', 'status', { unique: false });
            assetsStore.createIndex('createdAt', 'createdAt', { unique: false });
            console.log('✅ ObjectStore "assets" creado');
        }

        // === EMPLOYEES - Empleados ===
        if (!db.objectStoreNames.contains('employees')) {
            const employeesStore = db.createObjectStore('employees', { keyPath: 'employeeId' });
            employeesStore.createIndex('firstName', 'firstName', { unique: false });
            employeesStore.createIndex('lastName', 'lastName', { unique: false });
            employeesStore.createIndex('email', 'email', { unique: true });
            employeesStore.createIndex('status', 'status', { unique: false });
            employeesStore.createIndex('role', 'role', { unique: false });
            employeesStore.createIndex('department', 'department', { unique: false });
            console.log('✅ ObjectStore "employees" creado');
        }

        // === CUSTODY ASSIGNMENTS - Asignaciones de Custodia ===
        if (!db.objectStoreNames.contains('custodyAssignments')) {
            const custodyStore = db.createObjectStore('custodyAssignments', { 
                keyPath: 'assignmentId',
                autoIncrement: true 
            });
            custodyStore.createIndex('employeeId', 'employeeId', { unique: false });
            custodyStore.createIndex('assetId', 'assetId', { unique: false });
            custodyStore.createIndex('status', 'status', { unique: false });
            custodyStore.createIndex('assignedDate', 'assignedDate', { unique: false });
            custodyStore.createIndex('dueDate', 'dueDate', { unique: false });
            custodyStore.createIndex('employee_asset', ['employeeId', 'assetId'], { unique: false });
            console.log('✅ ObjectStore "custodyAssignments" creado');
        }

        // === CATEGORIES - Categorías de Equipos ===
        if (!db.objectStoreNames.contains('categories')) {
            const categoriesStore = db.createObjectStore('categories', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            categoriesStore.createIndex('name', 'name', { unique: true });
            categoriesStore.createIndex('type', 'type', { unique: false });
            console.log('✅ ObjectStore "categories" creado');
        }

        // === SETTINGS - Configuraciones ===
        if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'key' });
            console.log('✅ ObjectStore "settings" creado');
        }

        // === AUDIT LOG - Registro de Auditoría ===
        if (!db.objectStoreNames.contains('auditLog')) {
            const auditStore = db.createObjectStore('auditLog', { 
                keyPath: 'id',
                autoIncrement: true 
            });
            auditStore.createIndex('action', 'action', { unique: false });
            auditStore.createIndex('entity', 'entity', { unique: false });
            auditStore.createIndex('timestamp', 'timestamp', { unique: false });
            auditStore.createIndex('user', 'user', { unique: false });
            console.log('✅ ObjectStore "auditLog" creado');
        }
    }

    // === OPERACIONES GENÉRICAS ===
    async getAll(storeName) {
        await this.ensureInit();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || []);
        });
    }

    async save(storeName, data) {
        await this.ensureInit();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async delete(storeName, key) {
        await this.ensureInit();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async get(storeName, key) {
        await this.ensureInit();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async clear(storeName) {
        await this.ensureInit();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    async ensureInit() {
        if (!this.isInitialized) {
            await this.init();
        }
    }

    // === OPERACIONES ESPECÍFICAS - ASSETS ===
    async getAllAssets() { 
        return this.getAll('assets'); 
    }

    async saveAsset(asset) { 
        // Asegurar timestamp si no existe
        if (!asset.createdAt) {
            asset.createdAt = new Date().toISOString();
        }
        if (!asset.updatedAt) {
            asset.updatedAt = new Date().toISOString();
        }
        return this.save('assets', asset); 
    }

    async deleteAsset(assetId) { 
        return this.delete('assets', assetId); 
    }

    async getAsset(assetId) { 
        return this.get('assets', assetId); 
    }

    async searchAssets(searchTerm) {
        const allAssets = await this.getAllAssets();
        if (!searchTerm) return allAssets;
        
        const term = searchTerm.toLowerCase();
        return allAssets.filter(asset => 
            (asset.assetId && asset.assetId.toLowerCase().includes(term)) ||
            (asset.category && asset.category.toLowerCase().includes(term)) ||
            (asset.model && asset.model.toLowerCase().includes(term)) ||
            (asset.brand && asset.brand.toLowerCase().includes(term)) ||
            (asset.serialNumber && asset.serialNumber.toLowerCase().includes(term))
        );
    }

    async getAssetsByCategory(category) {
        const allAssets = await this.getAllAssets();
        return allAssets.filter(asset => asset.category === category);
    }

    // === OPERACIONES ESPECÍFICAS - EMPLOYEES ===
    async getAllEmployees() { 
        return this.getAll('employees'); 
    }

    async saveEmployee(employee) { 
        if (!employee.createdAt) {
            employee.createdAt = new Date().toISOString();
        }
        if (!employee.updatedAt) {
            employee.updatedAt = new Date().toISOString();
        }
        return this.save('employees', employee); 
    }

    async deleteEmployee(employeeId) { 
        return this.delete('employees', employeeId); 
    }

    async getEmployee(employeeId) { 
        return this.get('employees', employeeId); 
    }

    async searchEmployees(searchTerm) {
        const allEmployees = await this.getAllEmployees();
        if (!searchTerm) return allEmployees;
        
        const term = searchTerm.toLowerCase();
        return allEmployees.filter(employee => 
            (employee.employeeId && employee.employeeId.toLowerCase().includes(term)) ||
            (employee.firstName && employee.firstName.toLowerCase().includes(term)) ||
            (employee.lastName && employee.lastName.toLowerCase().includes(term)) ||
            (employee.email && employee.email.toLowerCase().includes(term)) ||
            (employee.department && employee.department.toLowerCase().includes(term))
        );
    }

    async getEmployeesByStatus(status) {
        const allEmployees = await this.getAllEmployees();
        return allEmployees.filter(employee => employee.status === status);
    }

    // === OPERACIONES ESPECÍFICAS - CUSTODY ASSIGNMENTS ===
    async getAllCustodyAssignments() { 
        return this.getAll('custodyAssignments'); 
    }

    async saveCustodyAssignment(assignment) { 
        if (!assignment.assignedDate) {
            assignment.assignedDate = new Date().toISOString();
        }
        return this.save('custodyAssignments', assignment); 
    }

    async deleteCustodyAssignment(assignmentId) { 
        return this.delete('custodyAssignments', assignmentId); 
    }

    async getAssignment(assignmentId) { 
        return this.get('custodyAssignments', assignmentId); 
    }

    async getAssignmentsByEmployee(employeeId) {
        const allAssignments = await this.getAllCustodyAssignments();
        return allAssignments.filter(a => a.employeeId === employeeId);
    }

    async getAssignmentsByAsset(assetId) {
        const allAssignments = await this.getAllCustodyAssignments();
        return allAssignments.filter(a => a.assetId === assetId);
    }

    async getActiveAssignments() {
        const allAssignments = await this.getAllCustodyAssignments();
        return allAssignments.filter(a => a.status === 'Active');
    }

    async getOverdueAssignments() {
        const allAssignments = await this.getAllCustodyAssignments();
        const now = new Date();
        return allAssignments.filter(a => 
            a.status === 'Active' && 
            a.dueDate && 
            new Date(a.dueDate) < now
        );
    }

    // === OPERACIONES ESPECÍFICAS - CATEGORIES ===
    async getAllCategories() { 
        return this.getAll('categories'); 
    }

    async saveCategory(category) { 
        return this.save('categories', category); 
    }

    async deleteCategory(categoryId) { 
        return this.delete('categories', categoryId); 
    }

    async getCategory(categoryId) { 
        return this.get('categories', categoryId); 
    }

    // === OPERACIONES ESPECÍFICAS - SETTINGS ===
    async getSetting(key) {
        const setting = await this.get('settings', key);
        return setting ? setting.value : null;
    }

    async saveSetting(key, value) {
        return this.save('settings', { key, value });
    }

    async deleteSetting(key) {
        return this.delete('settings', key);
    }

    // === OPERACIONES ESPECÍFICAS - AUDIT LOG ===
    async logAudit(action, entity, details, user = 'system') {
        const logEntry = {
            action,
            entity,
            details,
            user,
            timestamp: new Date().toISOString()
        };
        return this.save('auditLog', logEntry);
    }

    async getAuditLog(limit = 100) {
        const allLogs = await this.getAll('auditLog');
        return allLogs
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }

    // === CONSULTAS CRUZADAS AVANZADAS ===
    async getEmployeeWithAssets(employeeId) {
        const employee = await this.getEmployee(employeeId);
        if (!employee) return null;

        const assignments = await this.getAssignmentsByEmployee(employeeId);
        const assets = [];

        for (const assignment of assignments) {
            if (assignment.status === 'Active') {
                const asset = await this.getAsset(assignment.assetId);
                if (asset) {
                    assets.push({
                        ...asset,
                        assignmentId: assignment.assignmentId,
                        assignedDate: assignment.assignedDate,
                        dueDate: assignment.dueDate
                    });
                }
            }
        }

        return {
            ...employee,
            assignedAssets: assets
        };
    }

    async getAssetWithHistory(assetId) {
        const asset = await this.getAsset(assetId);
        if (!asset) return null;

        const assignments = await this.getAssignmentsByAsset(assetId);
        const history = [];

        for (const assignment of assignments) {
            const employee = await this.getEmployee(assignment.employeeId);
            if (employee) {
                history.push({
                    ...assignment,
                    employeeName: `${employee.firstName} ${employee.lastName}`,
                    employeeEmail: employee.email
                });
            }
        }

        return {
            ...asset,
            assignmentHistory: history.sort((a, b) => 
                new Date(b.assignedDate) - new Date(a.assignedDate)
            )
        };
    }

    async getAssetsDueForReturn(daysThreshold = 7) {
        const activeAssignments = await this.getActiveAssignments();
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
        
        const dueAssignments = activeAssignments.filter(assignment => 
            assignment.dueDate && new Date(assignment.dueDate) <= thresholdDate
        );

        const result = [];
        for (const assignment of dueAssignments) {
            const asset = await this.getAsset(assignment.assetId);
            const employee = await this.getEmployee(assignment.employeeId);
            
            if (asset && employee) {
                result.push({
                    assignment,
                    asset,
                    employee,
                    daysUntilDue: Math.ceil(
                        (new Date(assignment.dueDate) - new Date()) / (1000 * 60 * 60 * 24)
                    )
                });
            }
        }

        return result.sort((a, b) => new Date(a.assignment.dueDate) - new Date(b.assignment.dueDate));
    }

    // === ESTADÍSTICAS ===
    async getStats() {
        const [
            totalAssets,
            totalEmployees,
            activeAssignments,
            categories
        ] = await Promise.all([
            this.getAllAssets(),
            this.getAllEmployees(),
            this.getActiveAssignments(),
            this.getAllCategories()
        ]);

        return {
            assets: {
                total: totalAssets.length,
                byCategory: this.groupBy(totalAssets, 'category'),
                byStatus: this.groupBy(totalAssets, 'status')
            },
            employees: {
                total: totalEmployees.length,
                byStatus: this.groupBy(totalEmployees, 'status'),
                byDepartment: this.groupBy(totalEmployees, 'department')
            },
            custody: {
                activeAssignments: activeAssignments.length,
                overdueAssignments: (await this.getOverdueAssignments()).length
            },
            categories: categories.length
        };
    }

    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = item[key] || 'Unknown';
            groups[group] = (groups[group] || 0) + 1;
            return groups;
        }, {});
    }

    // === BACKUP Y RESTAURACIÓN ===
    async exportAllData() {
        const [
            assets,
            employees,
            custodyAssignments,
            categories,
            settings,
            auditLog
        ] = await Promise.all([
            this.getAllAssets(),
            this.getAllEmployees(),
            this.getAllCustodyAssignments(),
            this.getAllCategories(),
            this.getAll('settings'),
            this.getAuditLog(1000) // Últimos 1000 registros
        ]);

        return {
            version: this.version,
            exportDate: new Date().toISOString(),
            data: {
                assets,
                employees,
                custodyAssignments,
                categories,
                settings,
                auditLog
            }
        };
    }

    async importAllData(backupData) {
        if (!backupData || !backupData.data) {
            throw new Error('Datos de backup inválidos');
        }

        console.log('🔄 Importando datos de backup...');

        // Limpiar datos existentes
        await Promise.all([
            this.clear('assets'),
            this.clear('employees'),
            this.clear('custodyAssignments'),
            this.clear('categories'),
            this.clear('settings'),
            this.clear('auditLog')
        ]);

        // Importar nuevos datos
        const { data } = backupData;
        let totalImported = 0;

        for (const [storeName, items] of Object.entries(data)) {
            if (Array.isArray(items)) {
                for (const item of items) {
                    await this.save(storeName, item);
                }
                totalImported += items.length;
                console.log(`✅ ${items.length} ${storeName} importados`);
            }
        }

        await this.logAudit('DATA_IMPORT', 'system', `Imported ${totalImported} records from backup`);
        return totalImported;
    }

    // === MANTENIMIENTO ===
    async cleanupOldAuditLog(daysToKeep = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        const allLogs = await this.getAll('auditLog');
        const oldLogs = allLogs.filter(log => 
            new Date(log.timestamp) < cutoffDate
        );

        for (const log of oldLogs) {
            await this.delete('auditLog', log.id);
        }

        console.log(`🧹 ${oldLogs.length} registros de auditoría antiguos eliminados`);
        return oldLogs.length;
    }
}

// Instancia global única
const indexedDBManager = new IndexedDBManager();

// Función de migración global
async function migrateAllToIndexedDB() {
    console.log("🚀 INICIANDO MIGRACIÓN COMPLETA A INDEXEDDB...");
    
    try {
        await indexedDBManager.init();
        
        // Definir datasets a migrar
        const datasets = [
            { 
                key: 'assets', 
                store: 'assets',
                data: JSON.parse(localStorage.getItem('assets') || '[]'),
                description: 'Equipos y activos'
            },
            { 
                key: 'employees', 
                store: 'employees',
                data: JSON.parse(localStorage.getItem('employees') || '[]'),
                description: 'Empleados'
            },
            { 
                key: 'custodyAssignments', 
                store: 'custodyAssignments', 
                data: JSON.parse(localStorage.getItem('custodyAssignments') || '[]'),
                description: 'Asignaciones de custodia'
            },
            { 
                key: 'categories', 
                store: 'categories',
                data: JSON.parse(localStorage.getItem('categories') || '[]'),
                description: 'Categorías'
            }
        ];
        
        let totalMigrated = 0;
        
        for (const dataset of datasets) {
            console.log(`📦 Migrando ${dataset.description}: ${dataset.data.length} registros...`);
            
            for (const item of dataset.data) {
                await indexedDBManager.save(dataset.store, item);
            }
            
            totalMigrated += dataset.data.length;
            console.log(`✅ ${dataset.description} migrado (${dataset.data.length} registros)`);
        }
        
        // Verificar migración
        const verifyAssets = await indexedDBManager.getAllAssets();
        const verifyEmployees = await indexedDBManager.getAllEmployees();
        const verifyCustody = await indexedDBManager.getAllCustodyAssignments();
        
        console.log("🎉 MIGRACIÓN COMPLETADA EXITOSAMENTE");
        console.log(`📊 Total registros migrados: ${totalMigrated}`);
        console.log(`✅ Assets en IndexedDB: ${verifyAssets.length}`);
        console.log(`✅ Employees en IndexedDB: ${verifyEmployees.length}`);
        console.log(`✅ Custody Assignments en IndexedDB: ${verifyCustody.length}`);
        
        // Registrar en audit log
        await indexedDBManager.logAudit(
            'MIGRATION', 
            'system', 
            `Migrated ${totalMigrated} records from localStorage to IndexedDB`
        );
        
        return {
            success: true,
            totalMigrated,
            counts: {
                assets: verifyAssets.length,
                employees: verifyEmployees.length,
                custody: verifyCustody.length
            }
        };
        
    } catch (error) {
        console.error('❌ Error en migración:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.indexedDBManager = indexedDBManager;
    window.migrateAllToIndexedDB = migrateAllToIndexedDB;
}