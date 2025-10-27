// custody.js - Asset Custody Management System
class CustodyManager {
    constructor() {
        this.dbName = 'AssetCustodyDB';
        this.dbVersion = 1;
        this.assignments = [];
        this.nextAssignmentId = 1001;
        this.init();
    }

    async init() {
        await this.openDatabase();
        await this.loadAssignments();
        if (this.assignments.length === 0) {
            await this.createSampleAssignments();
        }
        this.updateDashboard();
    }

     async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create assignments store if it doesn't exist
                if (!db.objectStoreNames.contains('assignments')) {
                    const store = db.createObjectStore('assignments', { keyPath: 'assignmentId' });
                    store.createIndex('employeeId', 'employeeId', { unique: false });
                    store.createIndex('assetId', 'assetId', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('assignmentDate', 'assignmentDate', { unique: false });
                }
                
                // Create metadata store for nextAssignmentId
                if (!db.objectStoreNames.contains('metadata')) {
                    const metadataStore = db.createObjectStore('metadata', { keyPath: 'key' });
                }
            };
        });
    }

    async loadAssignments() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['assignments', 'metadata'], 'readonly');
            const assignmentsStore = transaction.objectStore('assignments');
            const metadataStore = transaction.objectStore('metadata');
            
            const assignmentsRequest = assignmentsStore.getAll();
            const metadataRequest = metadataStore.get('nextAssignmentId');
            
            assignmentsRequest.onerror = () => reject(assignmentsRequest.error);
            metadataRequest.onerror = () => reject(metadataRequest.error);
            
            assignmentsRequest.onsuccess = () => {
                this.assignments = assignmentsRequest.result || [];
                
                metadataRequest.onsuccess = () => {
                    if (metadataRequest.result) {
                        this.nextAssignmentId = metadataRequest.result.value;
                    } else {
                        // Calculate from existing assignments
                        this.nextAssignmentId = this.calculateNextAssignmentId();
                    }
                    if (!this.nextAssignmentId || isNaN(this.nextAssignmentId)) {
                    this.nextAssignmentId = this.calculateNextAssignmentId();
                    }

                    resolve(this.assignments);
                };
            };
        });
    }

    calculateNextAssignmentId() {
        if (this.assignments.length === 0) return 1001;
        
        const ids = this.assignments.map(assignment => {
            const num = assignment.assignmentId ? parseInt(assignment.assignmentId.replace('ASG', '')) : 0;
            return num || 0;
        });
        
        const lastId = Math.max(...ids);
        return lastId + 1;
    }

    generateAssignmentId() {
        const id = `ASG${this.nextAssignmentId.toString().padStart(4, '0')}`;
        this.nextAssignmentId++;
        return id;
    }

    async createSampleAssignments() {
        const sampleAssignments = [
            {
                assignmentId: 'ASG1001',
                employeeId: 'EMP1001',
                employeeName: 'John Smith',
                assetId: 'SHI-DRI-MD-1001',
                assetCategory: 'MENS SHIRTS',
                assetModel: 'Dri-FIT',
                assetSize: 'Medium',
                quantity: 2,
                assignmentDate: '01/20/23',
                dueDate: '01/20/24',
                returnDate: '',
                status: 'Active',
                condition: 'New',
                notes: 'Initial assignment'
            },
            {
                assignmentId: 'ASG1002',
                employeeId: 'EMP1002',
                employeeName: 'Jane Doe',
                assetId: 'CAP-COR-MD-1002',
                assetCategory: 'BALL CAPS',
                assetModel: 'Core',
                assetSize: 'Medium',
                quantity: 1,
                assignmentDate: '02/25/23',
                dueDate: '02/25/24',
                returnDate: '',
                status: 'Active',
                condition: 'New',
                notes: 'Standard issue'
            }
        ];

        this.assignments = sampleAssignments;
        await this.saveAllAssignments();
        this.updateDashboard();
    }

    async saveAllAssignments() {
        return new Promise(async (resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['assignments', 'metadata'], 'readwrite');
            const assignmentsStore = transaction.objectStore('assignments');
            const metadataStore = transaction.objectStore('metadata');

            // Clear existing assignments
            const clearRequest = assignmentsStore.clear();
            
            clearRequest.onerror = () => reject(clearRequest.error);
            
            clearRequest.onsuccess = async () => {
                // Save all assignments
                const savePromises = this.assignments.map(assignment => {
                    return new Promise((resolveSave, rejectSave) => {
                        const request = assignmentsStore.add(assignment);
                        request.onsuccess = () => resolveSave();
                        request.onerror = () => rejectSave(request.error);
                    });
                });

                // Save nextAssignmentId
                const metadataRequest = metadataStore.put({ 
                    key: 'nextAssignmentId', 
                    value: this.nextAssignmentId 
                });

                try {
                    await Promise.all([...savePromises, new Promise((resolveMeta, rejectMeta) => {
                        metadataRequest.onsuccess = () => resolveMeta();
                        metadataRequest.onerror = () => rejectMeta(metadataRequest.error);
                    })]);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
        });
    }

    async saveAssignment(assignment) {
    return new Promise((resolve, reject) => {
        if (!this.db) {
            reject(new Error('Database not initialized'));
            return;
        }

        const transaction = this.db.transaction(['assignments', 'metadata'], 'readwrite');
        const assignmentsStore = transaction.objectStore('assignments');
        const metadataStore = transaction.objectStore('metadata');

        // Verificar si el assignmentId ya existe antes de decidir entre add() o put()
        const getRequest = assignmentsStore.get(assignment.assignmentId);

        getRequest.onsuccess = () => {
            const existing = getRequest.result;
            const request = existing 
                ? assignmentsStore.put(assignment) // Actualiza si ya existe
                : assignmentsStore.add(assignment); // Inserta si es nuevo

            request.onsuccess = () => {
                // Actualizar el nextAssignmentId en metadata después de insertar
                const metadataRequest = metadataStore.put({ 
                    key: 'nextAssignmentId', 
                    value: this.nextAssignmentId 
                });

                metadataRequest.onsuccess = () => resolve(assignment);
                metadataRequest.onerror = () => reject(metadataRequest.error);
            };

            request.onerror = () => reject(request.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
}


    // Add new assignment
    async addAssignment(assignmentData) {
        const requiredFields = ['employeeId', 'assetId', 'quantity', 'assignmentDate', 'dueDate'];
        const missingFields = requiredFields.filter(field => !assignmentData[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Verify employee exists
        if (typeof teamManager !== 'undefined') {
            const employee = teamManager.getEmployeeById(assignmentData.employeeId);
            if (!employee) {
                throw new Error('Employee not found');
            }
            assignmentData.employeeName = employee.fullName;
        }

        // Verify asset exists and has sufficient quantity
        if (typeof assetsManager !== 'undefined') {
            const asset = assetsManager.assets.find(a => a.assetId === assignmentData.assetId);
            if (!asset) {
                throw new Error('Asset not found');
            }
            
            // Check available quantity
            const availableQty = await this.getAssetAvailableQuantity(assignmentData.assetId);
            if (availableQty < assignmentData.quantity) {
                throw new Error(`Insufficient quantity. Available: ${availableQty}, Requested: ${assignmentData.quantity}`);
            }

            assignmentData.assetCategory = asset.category;
            assignmentData.assetModel = asset.model;
            assignmentData.assetSize = asset.size;
        }

        const newAssignment = {
            assignmentId: this.generateAssignmentId(),
            employeeId: assignmentData.employeeId,
            employeeName: assignmentData.employeeName,
            assetId: assignmentData.assetId,
            assetCategory: assignmentData.assetCategory,
            assetModel: assignmentData.assetModel,
            assetSize: assignmentData.assetSize,
            quantity: parseInt(assignmentData.quantity),
            assignmentDate: assignmentData.assignmentDate,
            dueDate: assignmentData.dueDate,
            returnDate: assignmentData.returnDate || '',
            status: assignmentData.status || 'Active',
            condition: assignmentData.condition || 'New',
            notes: assignmentData.notes || '',
            recycled: assignmentData.recycled || false
        };

        await this.saveAssignment(newAssignment);
        this.assignments.push(newAssignment);
        this.updateDashboard();
        
        return newAssignment;
    }

    // Add multiple assignments
   async addMultipleAssignments(assignmentsData) {
        const results = {
            success: [],
            errors: []
        };

        for (let i = 0; i < assignmentsData.length; i++) {
            const assignmentData = assignmentsData[i];
            try {
                const newAssignment = await this.addAssignment(assignmentData);
                results.success.push({
                    index: i + 1,
                    assignment: newAssignment
                });
            } catch (error) {
                results.errors.push({
                    index: i + 1,
                    data: assignmentData,
                    error: error.message
                });
            }
        }

        this.updateDashboard();
        return results;
    }

    // Edit existing assignment
    async editAssignment(assignmentId, assignmentData) {
        const assignmentIndex = this.assignments.findIndex(a => a.assignmentId === assignmentId);
        
        if (assignmentIndex === -1) {
            throw new Error('Assignment not found');
        }

        // If changing quantity, verify availability
        if (assignmentData.quantity && assignmentData.quantity !== this.assignments[assignmentIndex].quantity) {
            const currentQty = this.assignments[assignmentIndex].quantity;
            const qtyDifference = assignmentData.quantity - currentQty;
            
            if (qtyDifference > 0) {
                const availableQty = await this.getAssetAvailableQuantity(this.assignments[assignmentIndex].assetId);
                if (availableQty < qtyDifference) {
                    throw new Error(`Insufficient quantity for increase. Available: ${availableQty}, Requested increase: ${qtyDifference}`);
                }
            }
        }

        const updatedAssignment = {
            ...this.assignments[assignmentIndex],
            ...assignmentData,
            assignmentId: assignmentId // Keep original ID
        };

        await this.saveAssignment(updatedAssignment);
        this.assignments[assignmentIndex] = updatedAssignment;
        this.updateDashboard();
        return this.assignments[assignmentIndex];
    }

    // Return assignment (mark as returned)
    async returnAssignment(assignmentId, returnData) {
        const assignmentIndex = this.assignments.findIndex(a => a.assignmentId === assignmentId);
        
        if (assignmentIndex === -1) {
            throw new Error('Assignment not found');
        }

        const assignment = this.assignments[assignmentIndex];
        
        // Update assignment with return information
        const updatedAssignment = {
            ...assignment,
            returnDate: returnData.returnDate,
            status: 'Returned',
            condition: returnData.condition || assignment.condition,
            notes: returnData.notes || assignment.notes,
            recycled: returnData.recycled || false
        };

        await this.saveAssignment(updatedAssignment);
        this.assignments[assignmentIndex] = updatedAssignment;

        // If asset is damaged or lost, update asset quantities
        if (returnData.condition === 'Damaged' || returnData.condition === 'Lost') {
            await this.handleAssetLoss(assignment.assetId, assignment.quantity, returnData.condition);
        }

        this.updateDashboard();
        return this.assignments[assignmentIndex];
    }

    // Handle asset loss (damaged or lost)
     async handleAssetLoss(assetId, quantity, condition) {
    if (typeof assetsManager !== 'undefined') {
        try {
            // ✅ Obtener el asset usando el método async de assetsManager
            const asset = assetsManager.assets.find(a => a.assetId === assetId);
            
            if (asset) {
                // ✅ Calcular nuevos valores
                const newQtyLost = asset.qtyLost + quantity;
                const assignedQty = this.getAssetAssignedQuantity(assetId);
                const newQtyAvailable = asset.qtyInitial + asset.qtyAdd - newQtyLost - assignedQty;
                const newIsLowStock = newQtyAvailable <= asset.lowStockThreshold;
                
                // ✅ Actualizar el asset usando el método oficial de assetsManager
                await assetsManager.editAsset(assetId, {
                    qtyLost: newQtyLost,
                    qtyAvailable: newQtyAvailable,
                    isLowStock: newIsLowStock
                });
                
                // ✅ assetsManager.updateDashboard() se llama automáticamente en editAsset
            }
        } catch (error) {
            console.error('Error handling asset loss:', error);
            throw error; // Propagar el error para que lo maneje quien llama
        }
    }
}

    // Delete assignment
    async deleteAssignment(assignmentId) {
    const assignmentIndex = this.assignments.findIndex(a => a.assignmentId === assignmentId);
        if (assignmentIndex === -1) {
        throw new Error('Assignment not found');
        }
    
        const assignment = this.assignments[assignmentIndex];
        await this.deleteAssignmentFromDB(assignmentId);
        this.assignments.splice(assignmentIndex, 1);
        this.updateDashboard();
        return assignment;
    }

    // Get all assignments
    getAllAssignments() {
        return [...this.assignments].sort((a, b) => new Date(b.assignmentDate) - new Date(a.assignmentDate));
    }

    // Get assignments by employee
    getAssignmentsByEmployee(employeeId) {
        return this.assignments.filter(a => a.employeeId === employeeId && a.status === 'Active');
    }

    // Get assignments by asset
    getAssignmentsByAsset(assetId) {
        return this.assignments.filter(a => a.assetId === assetId && a.status === 'Active');
    }

    // Get active assignments
    getActiveAssignments() {
        return this.assignments.filter(a => a.status === 'Active');
    }

    // Get overdue assignments
    getOverdueAssignments() {
        const today = new Date();
        return this.assignments.filter(a => {
            if (a.status !== 'Active') return false;
            
            const dueDate = this.parseDate(a.dueDate);
            return dueDate < today;
        });
    }

    // Search assignments
    searchAssignments(searchTerm) {
        if (!searchTerm) return this.getAllAssignments();
        
        const term = searchTerm.toLowerCase();
        return this.assignments.filter(assignment => 
            assignment.employeeName.toLowerCase().includes(term) ||
            assignment.employeeId.toLowerCase().includes(term) ||
            assignment.assetId.toLowerCase().includes(term) ||
            assignment.assetCategory.toLowerCase().includes(term) ||
            assignment.assetModel.toLowerCase().includes(term) ||
            assignment.status.toLowerCase().includes(term)
        );
    }

    // Get asset assigned quantity (currently assigned to employees)
    getAssetAssignedQuantity(assetId) {
        return this.assignments
            .filter(a => a.assetId === assetId && a.status === 'Active')
            .reduce((sum, a) => sum + a.quantity, 0);
    }

    // Get asset available quantity (for new assignments)
    async getAssetAvailableQuantity(assetId) {
        if (typeof assetsManager !== 'undefined') {
            try {
            const asset = assetsManager.assets.find(a => a.assetId === assetId);
            if (asset) {
                const assignedQty = this.getAssetAssignedQuantity(assetId);
                return Math.max(0, asset.qtyAvailable - assignedQty);
                } 
            } catch (error) {
            console.error('Error:', error);
            }
        }
        return 0;
    }

    // Get employee assigned assets summary
    getEmployeeAssetsSummary(employeeId) {
        const assignments = this.getAssignmentsByEmployee(employeeId);
        const summary = {};
        
        assignments.forEach(assignment => {
            if (!summary[assignment.assetCategory]) {
                summary[assignment.assetCategory] = 0;
            }
            summary[assignment.assetCategory] += assignment.quantity;
        });
        
        return summary;
    }

    // Get statistics
    getStats() {
        const activeAssignments = this.getActiveAssignments();
        const overdueAssignments = this.getOverdueAssignments();
        const totalAssignedQty = activeAssignments.reduce((sum, a) => sum + a.quantity, 0);
        const totalEmployees = new Set(activeAssignments.map(a => a.employeeId)).size;
        const totalAssets = new Set(activeAssignments.map(a => a.assetId)).size;
        
        return {
            totalAssignments: this.assignments.length,
            activeAssignments: activeAssignments.length,
            overdueAssignments: overdueAssignments.length,
            totalAssignedQty: totalAssignedQty,
            totalEmployees: totalEmployees,
            totalAssets: totalAssets,
            nextAssignmentId: this.nextAssignmentId
        };
    }

    // Parse date for comparison
    parseDate(dateStr) {
        if (!dateStr) return new Date(0);
        
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const month = parseInt(parts[0]) - 1;
            const day = parseInt(parts[1]);
            let year = parseInt(parts[2]);
            
            if (year < 100) {
                year += 2000;
            }
            
            return new Date(year, month, day);
        }
        
        return new Date(dateStr);
    }

    // Format date for display
    formatDateForDisplay(dateValue) {
        if (!dateValue) return '';
        
        let date;
        
        if (typeof dateValue === 'number') {
            date = XLSX.SSF.parse_date_code(dateValue);
            if (date) {
                const month = (date.m).toString().padStart(2, '0');
                const day = (date.d).toString().padStart(2, '0');
                const year = (date.y % 100).toString().padStart(2, '0');
                return `${month}/${day}/${year}`;
            }
        }
        
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
        
        return dateValue.toString();
    }

    // Update dashboard
    updateDashboard() {
        const stats = this.getStats();
        
        // Update custody stats in dashboard if elements exist
        const custodyQtyElement = document.getElementById('custodyQty');
        if (custodyQtyElement) {
            custodyQtyElement.textContent = stats.activeAssignments;
        }
        
        const custodyEmployeesElement = document.getElementById('custodyEmployees');
        if (custodyEmployeesElement) {
            custodyEmployeesElement.textContent = stats.totalEmployees;
        }
        
        const custodyOverdueElement = document.getElementById('custodyOverdue');
        if (custodyOverdueElement) {
            custodyOverdueElement.textContent = stats.overdueAssignments;
        }
    }

    // Save to localStorage
    saveToLocalStorage() {
        localStorage.setItem('custodyAssignments', JSON.stringify(this.assignments));
        localStorage.setItem('nextAssignmentId', this.nextAssignmentId.toString());
    }

    // Export to Excel
    exportToExcel() {
        const data = this.assignments.map(assignment => ({
            'Assignment ID': assignment.assignmentId,
            'Employee ID': assignment.employeeId,
            'Employee Name': assignment.employeeName,
            'Asset ID': assignment.assetId,
            'Asset Category': assignment.assetCategory,
            'Asset Model': assignment.assetModel,
            'Asset Size': assignment.assetSize,
            'Quantity': assignment.quantity,
            'Assignment Date': assignment.assignmentDate,
            'Due Date': assignment.dueDate,
            'Return Date': assignment.returnDate,
            'Status': assignment.status,
            'Condition': assignment.condition,
            'Notes': assignment.notes
        }));

        if (data.length === 0) {
            throw new Error('No data to export');
        }

        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(data);
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Custody Assignments');
        
        // Generate Excel file and download
        XLSX.writeFile(workbook, `custody_assignments_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        return {
            success: true,
            exported: data.length,
            message: `Successfully exported ${data.length} assignments to Excel file`
        };
    }

    // Clear all assignments
    // clearAll - MODIFICADO (CONTENIDO COMPLETO)
async clearAll() {
    return new Promise((resolve, reject) => {
        if (!this.db) {
            reject(new Error('Database not initialized'));
            return;
        }

        const transaction = this.db.transaction(['assignments', 'metadata'], 'readwrite');
        const assignmentsStore = transaction.objectStore('assignments');
        const metadataStore = transaction.objectStore('metadata');

        const clearAssignmentsRequest = assignmentsStore.clear();
        const clearMetadataRequest = metadataStore.clear();

        clearAssignmentsRequest.onerror = () => reject(clearAssignmentsRequest.error);
        clearMetadataRequest.onerror = () => reject(clearMetadataRequest.error);

        transaction.oncomplete = () => {
            this.assignments = [];
            this.nextAssignmentId = 1001;
            this.updateDashboard();
            resolve();
        };
        transaction.onerror = () => reject(transaction.error);
    });
}
}

const FIXED_CATEGORIES = [
    "BUCKET HAT",
    "BALL CAP", 
    "BEANIE",
    "BACKPACK COOLER",
    "THERMOS",
    "THERMAL BAG",
    "VEST",
    "RAIN JACKET",
    "MAN's SHIRT",
    "MAN'sSHIRT LS", 
    "MAN's SHORT",
    "MAN's PANT", 
    "WOMAN's SHIRT",
    "WOMAN'sSHIRT LS",
    "WOMAN's SHORT",
    "WOMAN's PANT" 
];

// Global instance of custody manager
const custodyManager = new CustodyManager();

// UI Functions for Custody Management
function openCustodyModal() {
    document.getElementById('custodyModal').style.display = 'block';
    loadCustodyTable();
    updateCustodyStats();
    loadEmployeesForCustody();
    loadAssetsForCustody();
    if (typeof updateCustodyDashboard === 'function') {
        updateCustodyDashboard();
    }
}

function closeCustodyModal() {
    document.getElementById('custodyModal').style.display = 'none';
    resetCustodyForm();
}

function resetCustodyForm() {
    document.getElementById('custodyForm').reset();
    document.getElementById('assignmentId').value = '';
    document.getElementById('formTitle').textContent = 'Assign Asset';
    document.getElementById('submitCustodyBtn').textContent = 'Assign';
    document.getElementById('quantity').value = '1';
    document.getElementById('condition').value = 'New';
    document.getElementById('status').value = 'Active';
    
    // Set today's date for assignment and due date (1 year from now)
    const today = new Date();
    const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    document.getElementById('assignmentDate').value = formatDate(today);
    document.getElementById('dueDate').value = formatDate(nextYear);
}

function updateCustodyStats() {
    const stats = custodyManager.getStats();
    const statsElement = document.getElementById('custodyStats');
    if (statsElement) {
        statsElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div style="background: #3498db; color: white; padding: 10px 15px; border-radius: 5px; font-weight: bold;">
                    Total Items Assigned: ${stats.totalAssignedQty}  
                    </div>
                    <div style="background: #27ae60; color: white; padding: 10px 15px; border-radius: 5px; font-weight: bold;">
                        Employees with Assets: ${stats.totalEmployees}
                    </div>
                    <div style="background: #e74c3c; color: white; padding: 10px 15px; border-radius: 5px; font-weight: bold;">
                        Overdue: ${stats.overdueAssignments}
                    </div>
                    <div style="background: #f39c12; color: white; padding: 10px 15px; border-radius: 5px; font-weight: bold;">
                        Next ID: ${stats.nextAssignmentId}
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="exportCustodyToExcel()" class="btn-export"
                            style="background: #2ecc71; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 12px;">
                        📤 Export Excel
                    </button>
                </div>
            </div>
        `;
    }
}

function loadCustodyTable(assignments = null) {
    const tbody = document.getElementById('custodyTable');
    let assignmentsToDisplay = assignments || custodyManager.getActiveAssignments();
    
    tbody.innerHTML = '';
    
    if (assignmentsToDisplay.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="20" style="text-align: center; color: #666; padding: 30px;">
                No assignments found
            </td>
        `;
        tbody.appendChild(row);
        return;
    }
    
    // Agrupar asignaciones por empleado
    const assignmentsByEmployee = {};
    assignmentsToDisplay.forEach(assignment => {
        if (!assignmentsByEmployee[assignment.employeeId]) {
            assignmentsByEmployee[assignment.employeeId] = {
                employeeName: assignment.employeeName,
                assignments: [],
                assignmentDate: assignment.assignmentDate,
                dueDate: assignment.dueDate,
                returnDate: assignment.returnDate,
                status: assignment.status
            };
        }
        assignmentsByEmployee[assignment.employeeId].assignments.push(assignment);
    });
    
    // Calcular máximo de columnas adicionales necesarias
    const maxAdditionalColumns = Math.max(...Object.values(assignmentsByEmployee).map(empData => 
        empData.assignments.filter(a => !FIXED_CATEGORIES.includes(a.assetCategory)).length
    ));
    
    // Actualizar header con columnas fijas + dinámicas
    updateCustodyTableHeader(maxAdditionalColumns);
    
    // Crear filas agrupadas por empleado
    Object.keys(assignmentsByEmployee).forEach(employeeId => {
        const employeeData = assignmentsByEmployee[employeeId];
        const row = document.createElement('tr');
        
        // CALCULAR TOTAL ASIGNADO PARA ESTE USUARIO
        const totalAssigned = employeeData.assignments.reduce((sum, assignment) => {
            return sum + assignment.quantity;
        }, 0);
        
        // Verificar si hay asignaciones vencidas
        const hasOverdue = employeeData.assignments.some(assignment => {
            return custodyManager.getOverdueAssignments().some(a => a.assignmentId === assignment.assignmentId);
        });
        
        const statusClass = employeeData.status === 'Active' ? 
                           (hasOverdue ? 'status-overdue' : 'status-active') : 
                           'status-returned';
        
        // GENERAR CELDAS DE ASSETS
        let assetCells = '';

        // Crear un mapa de assets por categoría para este empleado
        const assetsByCategory = {};
        employeeData.assignments.forEach(assignment => {
            assetsByCategory[assignment.assetCategory] = {
                size: assignment.assetSize,
                quantity: assignment.quantity,
                assetId: assignment.assetId
            };
        });

        // 1. Primero las categorías fijas
        FIXED_CATEGORIES.forEach(category => {
            const asset = assetsByCategory[category];
            
            if (asset) {
                assetCells += `
                    <td style="text-align: center; border-right: 1px solid #eee; min-width: 80px; padding: 4px; font-size: 11px;" 
                        title="${category} - ID: ${asset.assetId}">
                        <div style="font-weight: bold; color: #2c3e50;">${asset.size}</div>
                        <div style="color: #7f8c8d;">Qt: ${asset.quantity}</div>
                    </td>
                `;
            } else {
                assetCells += `<td style="border-right: 1px solid #eee; text-align: center; color: #bdc3c7; min-width: 80px;">-</td>`;
            }
        });

        // 2. Luego assets que no están en categorías fijas (columnas dinámicas)
        const additionalAssets = employeeData.assignments.filter(assignment => 
            !FIXED_CATEGORIES.includes(assignment.assetCategory)
        );

        additionalAssets.forEach(assignment => {
            assetCells += `
                <td style="text-align: center; border-right: 1px solid #eee; min-width: 80px; padding: 4px; font-size: 11px; background: #f8f9fa;" 
                    title="${assignment.assetCategory} - ID: ${assignment.assetId}">
                    <div style="font-weight: bold; color: #2c3e50;">${assignment.assetSize}</div>
                    <div style="color: #7f8c8d;">Qt: ${assignment.quantity}</div>
                </td>
            `;
        });

        // 3. Rellenar celdas vacías para columnas dinámicas si este usuario tiene menos
        const emptyDynamicCells = maxAdditionalColumns - additionalAssets.length;
        for (let i = 0; i < emptyDynamicCells; i++) {
            assetCells += `<td style="border-right: 1px solid #eee; text-align: center; color: #bdc3c7; min-width: 80px; background: #f8f9fa;">-</td>`;
        }
        
        row.innerHTML = `
            <td style="font-weight: bold; white-space: nowrap;">${employeeData.assignments[0].assignmentId}</td>
            <td style="white-space: nowrap;">
                <a class="employee-link" onclick="manageEmployeeAssets('${employeeId}')" 
                   style="cursor: pointer; color: #3498db; text-decoration: none; font-weight: 500; font-size: 14px;">
                    ${employeeData.employeeName}
                </a>
            </td>
            <td style="text-align: center; font-weight: bold; background: #ecf0f1; color: #2c3e50; font-size: 14px;">
                ${totalAssigned}
            </td>
            ${assetCells}
            <td style="white-space: nowrap;">${employeeData.assignmentDate}</td>
            <td style="white-space: nowrap; ${hasOverdue ? 'color: #e74c3c; font-weight: bold;' : ''}">${employeeData.dueDate}</td>
            <td style="white-space: nowrap;">${employeeData.returnDate || '-'}</td>
            <td>
                <span class="status-badge ${statusClass}">${employeeData.status}${hasOverdue ? ' (Overdue)' : ''}</span>
            </td>
            <td style="text-align: center; white-space: nowrap;">
                ${employeeData.status === 'Active' ? `
                    <button onclick="returnEmployeeAssignments('${employeeId}')" class="btn-return" title="Return All">
                        📥
                    </button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
    
    updateCustodyStats();
}

// Función para actualizar el encabezado dinámicamente
function updateCustodyTableHeader(additionalColumns = 0) {
    const thead = document.querySelector('#custodyTable').closest('table').querySelector('thead');
    
    let headerCells = '';
    FIXED_CATEGORIES.forEach(category => {
        // Acortar nombres largos para que quepan en el header
        const shortName = category
            /*.replace("MAN's", "MAN's")
            .replace("WOMAN's", "WOMAN's")
            .replace("SHIRT", "SHIRT")
            .replace("SHORT", "SHORT")
            .replace("PANT", "PANT")*/
            .replace("BACKPACK", "BACK")
            /*.replace("THERMAL", "THERMAL")*/
            .replace("MAN'sSHIRT LS", "MAN's SHIRT LS")
            .replace("WOMAN'sSHIRT LS", "WOMAN's SHIRT LS");
            
        headerCells += `
            <th style="padding: 6px; text-align: center; font-size: 10px; white-space: nowrap; min-width: 80px;" title="${category}">
                ${shortName}<br>Qty
            </th>
        `;
    });

    // Luego columnas adicionales dinámicas
    for (let i = 1; i <= additionalColumns; i++) {
        headerCells += `
            <th style="padding: 6px; text-align: center; font-size: 10px; white-space: nowrap; min-width: 80px; background: #f8f9fa;">
                Asset ${i}<br>Qty
            </th>
        `;
    }
    
    thead.innerHTML = `
        <tr>
            <th style="padding: 10px; text-align: left;">ID</th>
            <th style="padding: 10px; text-align: left;">Employee</th>
            <th style="padding: 10px; text-align: center; background: #2c3e50; color: white;">Total<br>Asign</th>
            ${headerCells}
            <th style="padding: 10px; text-align: left;">Assign Date</th>
            <th style="padding: 10px; text-align: left;">Due Date</th>
            <th style="padding: 10px; text-align: left;">Return Date</th>
            <th style="padding: 10px; text-align: left;">Status</th>
            <th style="padding: 10px; text-align: center;">Actions</th>
        </tr>
    `;
}

function loadCurrentAssetsForMultiModal(employeeId) {
    const container = document.getElementById('currentAssetsMultiList');
    const assignments = custodyManager.getAssignmentsByEmployee(employeeId);
    
    container.innerHTML = '';
    
    if (assignments.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #666;">
                <p>No assets currently assigned</p>
                <p style="font-size: 11px; margin-top: 5px;">Use "Add Asset Field" below to assign assets</p>
            </div>
        `;
        return;
    }
    
    assignments.forEach(assignment => {
        const assetItem = `
        <div class="current-asset-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; margin-bottom: 8px; background: white; border-radius: 5px; border: 1px solid #e0e0e0;">
            <div style="flex: 1;">
                <div style="font-weight: bold; font-size: 13px; color: #2c3e50;">
                    ${assignment.assetCategory} - ${assignment.assetModel} - ${assignment.assetSize}
                </div>
                <div style="font-size: 11px; color: #7f8c8d; margin-top: 3px;">
                    <strong>ID:</strong> ${assignment.assetId} | 
                    <strong>Qty:</strong> ${assignment.quantity} | 
                    <strong>Assigned:</strong> ${assignment.assignmentDate}
                </div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="modifyAssignmentQty('${assignment.assignmentId}', ${assignment.quantity})" 
                        style="background: #f39c12; color: white; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 11px;"
                        title="Modify Quantity">
                    ✏️ Edit Qty
                </button>
                <button onclick="returnSingleAssignment('${assignment.assignmentId}')" 
                        style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; font-size: 11px;"
                        title="Return Asset">
                    📥 Return
                </button>
            </div>
        </div>
        `;
        container.insertAdjacentHTML('beforeend', assetItem);
    });
}

function manageEmployeeAssets(employeeId) {
    const employee = teamManager.getEmployeeById(employeeId);
    if (!employee) {
        showNotification('❌ Employee not found', 'error');
        return;
    }
    
    const multiAssetModal = document.getElementById('multiAssetModal') || createMultiAssetModal();
    
    document.getElementById('multiAssetEmployeeId').value = employeeId;
    document.getElementById('multiAssetEmployeeName').textContent = employee.fullName;
    
    // ✅ AÑADIR LA IMAGEN
    const employeeImage = document.getElementById('multiAssetEmployeeImage');
    if (employeeImage) {
        if (employee.image) {
            employeeImage.src = employee.image;
            employeeImage.style.display = 'block';
        } else {
            employeeImage.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNlMWUyZTMiLz4KPHBhdGggZD0iTTQwIDQ0QzQ0LjQxODMgNDQgNDggNDAuNDE4MyA0OCAzNkM0OCAzMS41ODE3IDQ0LjQxODMgMjggNDAgMjhDMzUuNTgxNyAyOCAzMiAzMS41ODE3IDMyIDM2QzMyIDQwLjQxODMgMzUuNTgxNyA0NCA0MCA0NFoiIGZpbGw9IiM5OGE1YTYiLz4KPHBhdGggZD0iTTI4IDUyQzI4IDQ3LjU4MTcgMzEuNTgxNyA0NCAzNiA0NEg0NEM0OC40MTgzIDQ0IDUyIDQ3LjU4MTcgNTIgNTJWNjRIMjhWNTJaIiBmaWxsPSIjOThhNWE2Ii8+Cjwvc3ZnPgo=';
            employeeImage.style.display = 'block';
            employeeImage.alt = 'No photo available';
        }
    }
    
    // ✅ USAR DIRECTAMENTE EL GENDER DEL EMPLEADO
    const employeeGender = employee.gender || 'Male';
    
    // ✅ SELECCIONAR AUTOMÁTICAMENTE EL RADIO BUTTON
    setTimeout(() => {
        document.querySelectorAll('input[name="employeeGender"]').forEach(radio => {
            radio.checked = (radio.value.toLowerCase() === employeeGender.toLowerCase());
        });
        
        // Cargar los assets inmediatamente
        loadGenderSpecificAssets();
    }, 100);
    
    loadCurrentAssetsForMultiModal(employeeId);
    multiAssetModal.style.display = 'block';
}

function returnSingleAssignment(assignmentId) {
    const assignment = custodyManager.assignments.find(a => a.assignmentId === assignmentId);
    
    if (!assignment) return;
    
    if (confirm(`Return ${assignment.quantity} x ${assignment.assetId} from ${assignment.employeeName}?`)) {
        const returnData = {
            returnDate: new Date().toLocaleDateString('en-US', { 
                year: '2-digit', 
                month: '2-digit', 
                day: '2-digit' 
            }),
            condition: 'New',
            notes: 'Returned via management modal'
        };
        
        try {
            custodyManager.returnAssignment(assignmentId, returnData);
            showNotification(`✅ Asset returned successfully`, 'success');
            
            // ACTUALIZAR ESTADÍSTICAS
            custodyManager.updateDashboard();
            updateCustodyStats();
            loadCurrentAssetsForMultiModal(assignment.employeeId);
            loadCustodyTable();
            
        } catch (error) {
            showNotification(`❌ ${error.message}`, 'error');
        }
    }
}

// Añade esta función para manejar el cambio de tamaño
function setupQuickAssetEvents() {
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('asset-size')) {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const maxQty = parseInt(selectedOption?.dataset.available || 0);
            const quantityInput = e.target.closest('.quick-asset-field').querySelector('.asset-quantity');
            const maxQtySpan = e.target.closest('.quick-asset-field').querySelector('.max-qty');
            
            if (maxQty > 0) {
                quantityInput.max = maxQty;
                maxQtySpan.textContent = maxQty;
                if (parseInt(quantityInput.value) > maxQty) {
                    quantityInput.value = maxQty;
                }
                quantityInput.disabled = false;
            } else {
                quantityInput.max = 0;
                maxQtySpan.textContent = '0';
                quantityInput.value = 0;
                quantityInput.disabled = true;
            }
        }
    });
}

// Modifica createMultiAssetModal para añadir esto al final:
function createMultiAssetModal() {
    const modalHTML = `
    <div id="multiAssetModal" class="modal" style="display: none;">
        <div class="modal-content" style= width: 95%; max-height: 90vh;">
            <span class="close" onclick="closeMultiAssetModal()">&times;</span>
            
            <!-- ✅ CABECERA CON IMAGEN Y NOMBRE -->
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 5px; padding-bottom: 10px; border-bottom: 2px solid #f0f0f0;">
                <img id="multiAssetEmployeeImage" src="" alt="Employee Photo" 
                     style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid #3498db; display: none;">
                <div>
                    <h2 style="color: #2c3e50; margin: 0 0 5px 0;">Manage Assets for:</h2>
                    <h1 id="multiAssetEmployeeName" style="color: #3498db; margin: 0; font-size: 24px;"></h1>
                </div>
            </div>
            
            <input type="hidden" id="multiAssetEmployeeId">
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #34495e; margin-bottom: 10px;">Current Assigned Assets</h3>
                <div id="currentAssetsMultiList" style="max-height: 270px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                    <!-- Assets actuales se cargan aquí -->
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="color: #34495e; margin-bottom: 15px;">Quick Asset Assignment</h3>
                <div style="font-size: 12px; color: #7f8c8d; margin-bottom: 15px;">
                    Assign standard assets by selecting size and quantity
                </div>
                
                <div id="quickAssetsContainer">
                    <div style="text-align: center; color: #666; padding: 20px;">Please select employee gender first</div>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button type="button" onclick="submitQuickAssetAssignment()" 
                            style="background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        Assign Selected Assets
                    </button>
                    <button type="button" onclick="closeMultiAssetModal()"
                            style="background: #95a5a6; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    setTimeout(() => {
        setupQuickAssetEvents();
    }, 100);
    
    return document.getElementById('multiAssetModal');
}

const ASSETS_BY_GENDER_CATEGORY = {
    male: [
        "MAN's SHIRT",
        "MAN'sSHIRT LS", 
        "MAN's SHORT",
        "MAN's PANT"
    ],
    female: [
        "WOMAN's SHIRT",
        "WOMAN'sSHIRT LS",
        "WOMAN's SHORT", 
        "WOMAN's PANT"
    ],
    unisex: [
        "BUCKET HAT",
        "BALL CAP",
        "BEANIE",
        "BACKPACK COOLER",
        "THERMOS",
        "THERMAL BAG", 
        "VEST",
        "RAIN JACKET"
    ]
};

// Función para modificar cantidad de asset existente
function modifyAssignmentQty(assignmentId, currentQty) {
    const assignment = custodyManager.assignments.find(a => a.assignmentId === assignmentId);
    if (!assignment) return;
    
    const availableQty = custodyManager.getAssetAvailableQuantity(assignment.assetId) + currentQty;
    const newQty = prompt(`Modify quantity for ${assignment.assetId}\nCurrent: ${currentQty}\nAvailable: ${availableQty}`, currentQty);
    
    if (newQty && parseInt(newQty) > 0 && parseInt(newQty) !== currentQty) {
        if (parseInt(newQty) > availableQty) {
            alert(`Cannot exceed available quantity: ${availableQty}`);
            return;
        }
        
        try {
            custodyManager.editAssignment(assignmentId, { quantity: parseInt(newQty) });
            showNotification(`✅ Quantity updated to ${newQty}`, 'success');
            
            // ACTUALIZAR ESTADÍSTICAS
            custodyManager.updateDashboard();
            updateCustodyStats();
            loadCurrentAssetsForMultiModal(assignment.employeeId);
            loadCustodyTable();
            
        } catch (error) {
            showNotification(`❌ ${error.message}`, 'error');
        }
    }
}

function returnEmployeeAssignments(employeeId) {
    const employee = teamManager.getEmployeeById(employeeId);
    if (!employee) return;
    
    const activeAssignments = custodyManager.getAssignmentsByEmployee(employeeId);
    
    if (activeAssignments.length === 0) {
        showNotification('ℹ️ No active assignments to return', 'info');
        return;
    }
    
    // Mostrar resumen de lo que se va a devolver
    let summary = `Return ALL assets from ${employee.fullName}?\n\n`;
    activeAssignments.forEach(assignment => {
        summary += `• ${assignment.assetId}: ${assignment.quantity} items\n`;
    });
    summary += `\nTotal: ${activeAssignments.length} assets, ${activeAssignments.reduce((sum, a) => sum + a.quantity, 0)} items`;
    
    if (!confirm(summary)) {
        return;
    }
    
    // Preguntar condición general para todos los assets
    const condition = prompt('Enter condition for all returned assets (Good/Damaged/Lost):', 'Good');
    if (condition === null) return; // Usuario canceló
    
    if (!['Good', 'Damaged', 'Lost'].includes(condition)) {
        showNotification('❌ Invalid condition. Use: Good, Damaged, or Lost', 'error');
        return;
    }
    
    // Preguntar si son reciclables
    const recycled = confirm('Are these assets recyclable?');
    
    const notes = prompt('Enter notes for this bulk return (optional):', 'Bulk return - all assets');
    
    // Devolver todos los assets
    let successCount = 0;
    let errorCount = 0;
    
    activeAssignments.forEach(assignment => {
        try {
            const returnData = {
                returnDate: new Date().toLocaleDateString('en-US', { 
                    year: '2-digit', 
                    month: '2-digit', 
                    day: '2-digit' 
                }),
                condition: condition,
                notes: notes || `Bulk return: ${assignment.assetId}`,
                recycled: recycled
            };
            
            custodyManager.returnAssignment(assignment.assignmentId, returnData);
            successCount++;
            
        } catch (error) {
            console.error(`Error returning ${assignment.assetId}:`, error);
            errorCount++;
        }
    });
    
    // Mostrar resultado
    if (errorCount === 0) {
        showNotification(`✅ Successfully returned ${successCount} assets from ${employee.fullName}`, 'success');
    } else {
        showNotification(`⚠️ Returned ${successCount} assets, ${errorCount} errors occurred`, 'info');
    }
    // ACTUALIZAR ESTADÍSTICAS
    custodyManager.updateDashboard();
    updateCustodyStats();
    
    // Refrescar la tabla
    loadCustodyTable();
}

// Función para enviar el formulario de múltiples assets
function submitMultiAssetForm(event) {
    event.preventDefault();
    
    const employeeId = document.getElementById('multiAssetEmployeeId').value;
    const formData = new FormData(event.target);
    
    const assetIds = formData.getAll('multiAssetId[]');
    const quantities = formData.getAll('multiQuantity[]');
    
    const assignmentsData = [];
    
    // Validar y preparar datos
    for (let i = 0; i < assetIds.length; i++) {
        if (assetIds[i] && quantities[i] && parseInt(quantities[i]) > 0) {
            assignmentsData.push({
                employeeId: employeeId,
                assetId: assetIds[i],
                quantity: parseInt(quantities[i]),
                assignmentDate: new Date().toLocaleDateString('en-US', { 
                    year: '2-digit', 
                    month: '2-digit', 
                    day: '2-digit' 
                }),
                dueDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
                    .toLocaleDateString('en-US', { 
                        year: '2-digit', 
                        month: '2-digit', 
                        day: '2-digit' 
                    }),
                status: 'Active',
                condition: 'New'
            });
        }
    }
    
    if (assignmentsData.length === 0) {
        showNotification('❌ No valid assets to assign', 'error');
        return;
    }
    
    try {
        const results = custodyManager.addMultipleAssignments(assignmentsData);
        
        if (results.errors.length > 0) {
            showNotification(`⚠️ ${results.success.length} assigned, ${results.errors.length} failed`, 'info');
        } else {
            showNotification(`✅ ${results.success.length} assets assigned successfully`, 'success');
        }
        
        // ACTUALIZAR ESTADÍSTICAS Y REFRESCAR TODO
        custodyManager.updateDashboard(); // ← AÑADIR ESTO
        updateCustodyStats(); // ← AÑADIR ESTO
        loadCurrentAssetsForMultiModal(employeeId); // ← ACTUALIZAR LISTA ACTUAL
        loadCustodyTable(); // ← REFRESCAR TABLA PRINCIPAL
        
        // Limpiar campos de nuevos assets después del éxito
        document.getElementById('multiAssetContainer').innerHTML = '';
        
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

function addAssetField() {
    const container = document.getElementById('multiAssetContainer');
    const fieldCount = container.children.length;
    
    const assetFieldHTML = `
    <div class="asset-field" style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; margin-bottom: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
        <div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Asset:</label>
            <select name="multiAssetId[]" required onchange="updateMultiAssetQuantity(this)"
                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                <option value="">Select Asset</option>
            </select>
        </div>
        <div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Qty:</label>
            <input type="number" name="multiQuantity[]" min="1" required
                   style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="1">
        </div>
        <div style="display: flex; align-items: end;">
            <button type="button" onclick="removeAssetField(this)" 
                    style="background: #e74c3c; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer;">
                🗑️
            </button>
        </div>
    </div>
    `;
    
    container.insertAdjacentHTML('beforeend', assetFieldHTML);
    
    // Cargar assets en el nuevo select
    const newSelect = container.lastElementChild.querySelector('select[name="multiAssetId[]"]');
    loadAssetsIntoSelect(newSelect);
}

async function loadAssetsIntoSelect(selectElement) {
    if (typeof assetsManager !== 'undefined' && assetsManager.assets) {
        // Limpiar opciones existentes excepto la primera
        while (selectElement.options.length > 1) {
            selectElement.remove(1);
        }
        
        // Usar for...of en lugar de forEach para poder usar await
        for (const asset of assetsManager.assets) {
            const availableQty = await custodyManager.getAssetAvailableQuantity(asset.assetId);
            if (availableQty > 0) {
                const option = document.createElement('option');
                option.value = asset.assetId;
                // Mostrar solo información útil: Categoría, Modelo, Talla, Disponible
                option.textContent = `${asset.category} - ${asset.model} - ${asset.size} (Available: ${availableQty})`;
                option.title = `ID: ${asset.assetId} | Price: $${asset.price}`; // Tooltip con info adicional
                option.dataset.available = availableQty;
                selectElement.appendChild(option);
            }
        }
        
        // Ordenar alfabéticamente por categoría y modelo
        const options = Array.from(selectElement.options);
        options.sort((a, b) => a.textContent.localeCompare(b.textContent));
        selectElement.innerHTML = '';
        options.forEach(option => selectElement.appendChild(option));
    }
}

function removeAssetField(button) {
    const field = button.closest('.asset-field');
    if (field && document.querySelectorAll('.asset-field').length > 1) {
        field.remove();
    }
}

function updateMultiAssetQuantity(selectElement) {
    const quantityInput = selectElement.closest('.asset-field').querySelector('input[name="multiQuantity[]"]');
    const availableQty = parseInt(selectElement.options[selectElement.selectedIndex]?.dataset.available || 0);
    
    if (availableQty > 0) {
        quantityInput.max = availableQty;
        if (parseInt(quantityInput.value) > availableQty) {
            quantityInput.value = availableQty;
        }
    }
}

function closeMultiAssetModal() {
    document.getElementById('multiAssetModal').style.display = 'none';
}

async function loadGenderSpecificAssets() {
    // Obtener el gender del empleado actual
    const employeeId = document.getElementById('multiAssetEmployeeId').value;
    const employee = teamManager.getEmployeeById(employeeId);
    const gender = employee?.gender?.toLowerCase() || 'male';
    
    const container = document.getElementById('quickAssetsContainer');
    
    if (!gender) {
        container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Gender information not available</div>';
        return;
    }
    
    const currentAssignments = custodyManager.getAssignmentsByEmployee(employeeId);
    const assignedAssetIds = currentAssignments.map(a => a.assetId);
    
    let assetsToShow = [...ASSETS_BY_GENDER_CATEGORY.unisex];
    
    if (gender === 'male') {
        assetsToShow = [...assetsToShow, ...ASSETS_BY_GENDER_CATEGORY.male];
    } else {
        assetsToShow = [...assetsToShow, ...ASSETS_BY_GENDER_CATEGORY.female];
    }
    
    container.innerHTML = '';
    
    let assetsAdded = 0;
    
    for (const category of assetsToShow) {
        // ✅ FILTRAR: Solo mostrar categorías que NO están asignadas al empleado
        const isCategoryAssigned = currentAssignments.some(assignment => 
            assignment.assetCategory === category
        );
        
        if (!isCategoryAssigned) {
            const availableAssets = await getAvailableAssetsForCategory(category, gender, assignedAssetIds);
            
            if (availableAssets.length > 0) {
                const assetField = createQuickAssetField(category, availableAssets);
                container.insertAdjacentHTML('beforeend', assetField);
                assetsAdded++;
            }
        }
    }
    
   // En la función loadGenderSpecificAssets, actualiza el mensaje:
if (assetsAdded === 0) {
    const hasAnyAssignments = currentAssignments.length > 0;
    
    if (hasAnyAssignments) {
        container.innerHTML = `
            <div style="text-align: center; color: #27ae60; padding: 5px; background: #f8f9fa; border-radius: 5px;">
                <p>✅ All standard assets are assigned to this employee</p>
                <p style="font-size: 11px; margin-top: 5px; color: #666;">
                    Current assignments shown above. Use the form below for additional assets.
                </p>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div style="text-align: center; color: #666; padding: 20px; background: #f8f9fa; border-radius: 5px;">
                <p>No standard assets available for assignment</p>
                <p style="font-size: 11px; margin-top: 5px;">
                    Use the form below to assign custom assets.
                </p>
            </div>
        `;
    }
}

    setTimeout(() => {
        setupQuickAssetEvents();
    }, 100);
}

async function getAvailableAssetsForCategory(category, gender, assignedAssetIds) {
    if (typeof assetsManager !== 'undefined') {
        console.log(`Buscando assets disponibles para categoría: ${category}`);

        // ✅ FILTRAR: Solo assets que NO están asignados a este empleado
        const assets = assetsManager.assets.filter(asset => 
            asset.category === category && 
            !assignedAssetIds.includes(asset.assetId) // Solo assets no asignados
        );
        
        console.log(`Assets disponibles encontrados para ${category}:`, assets);
        
        const availableAssets = [];
        
        for (const asset of assets) {
            const availableQty = await custodyManager.getAssetAvailableQuantity(asset.assetId);
            console.log(`Asset ${asset.assetId} (${asset.size}): disponible = ${availableQty}`);
            if (availableQty > 0) {
                availableAssets.push({
                    assetId: asset.assetId,
                    size: asset.size,
                    availableQty: availableQty,
                    model: asset.model
                });
            }
        }
        
        return availableAssets;
    }
    return [];
}

function createQuickAssetField(category, availableAssets) {
    if (availableAssets.length === 0) {
        return '';
    }
    
    const uniqueSizes = [...new Set(availableAssets.map(a => a.size))];
    
    return `
    <div class="quick-asset-field" style="display: grid; grid-template-columns: 1.5fr 1fr 0.8fr 0.7fr; gap: 8px; margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px; border: 1px solid #e0e0e0; align-items: center; font-size: 12px; min-height: auto;">
        <div>
            <div style="font-weight: bold; color: #2c3e50;">${category}</div>
            <div style="color: #7f8c8d; font-size: 10px;">Select size</div>
        </div>
        
        <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-weight: bold; white-space: nowrap;">Size:</span>
            <select class="asset-size" data-category="${category}" 
                    style="flex: 1; padding: 4px; border: 1px solid #ddd; border-radius: 3px; font-size: 11px; height: 28px;">
                <option value="">Select</option>
                ${uniqueSizes.map(size => {
                    const asset = availableAssets.find(a => a.size === size);
                    return `<option value="${size}" data-assetid="${asset.assetId}" data-available="${asset.availableQty}">${size}</option>`;
                }).join('')}
            </select>
        </div>
        
        <div style="display: flex; align-items: center; gap: 5px;">
            <span style="font-weight: bold; white-space: nowrap;">Qty:</span>
            <input type="number" class="asset-quantity" min="1" value="1" max="5"
                   style="flex: 1; padding: 4px; border: 1px solid #ddd; border-radius: 3px; font-size: 11px; height: 28px; width: 60px;" disabled>
        </div>
        
        <div style="text-align: center;">
            <div class="available-info" style="color: #7f8c8d; font-size: 10px;">Max: <span class="max-qty">-</span></div>
        </div>
    </div>
    `;
}

async function submitQuickAssetAssignment() {
    const employeeId = document.getElementById('multiAssetEmployeeId').value;
    const gender = document.querySelector('input[name="employeeGender"]:checked')?.value;
    
    /*if (!gender) {
        showNotification('❌ Please select employee gender first', 'error');
        return;
    }*/
    
    const assignmentsData = [];
    const assetFields = document.querySelectorAll('.quick-asset-field');
    
    for (const field of assetFields) {
        const sizeSelect = field.querySelector('.asset-size');
        const selectedOption = sizeSelect.options[sizeSelect.selectedIndex];
        const assetId = selectedOption?.dataset.assetid;
        const quantity = parseInt(field.querySelector('.asset-quantity').value);
        
        if (assetId && quantity > 0) {
            assignmentsData.push({
                employeeId: employeeId,
                assetId: assetId,
                quantity: quantity,
                assignmentDate: new Date().toLocaleDateString('en-US', { 
                    year: '2-digit', 
                    month: '2-digit', 
                    day: '2-digit' 
                }),
                dueDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
                    .toLocaleDateString('en-US', { 
                        year: '2-digit', 
                        month: '2-digit', 
                        day: '2-digit' 
                    }),
                status: 'Active',
                condition: 'New'
            });
        }
    }
    
    if (assignmentsData.length === 0) {
        showNotification('❌ No assets selected for assignment', 'error');
        return;
    }
    
    try {
        const results = await custodyManager.addMultipleAssignments(assignmentsData);
        
        if (results.errors.length > 0) {
            showNotification(`⚠️ ${results.success.length} assigned, ${results.errors.length} failed`, 'info');
        } else {
            showNotification(`✅ ${results.success.length} assets assigned successfully`, 'success');
        }
        
        await loadGenderSpecificAssets();
        custodyManager.updateDashboard();
        updateCustodyStats();
        loadCurrentAssetsForMultiModal(employeeId);
        loadCustodyTable();
        
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function findAssetIdByCategoryAndSize(category, size, gender) {
    if (typeof assetsManager !== 'undefined') {
        const assets = assetsManager.assets.filter(asset => 
            asset.category === category && 
            asset.size === size
        );
        
        for (const asset of assets) {
            const availableQty = await custodyManager.getAssetAvailableQuantity(asset.assetId);
            if (availableQty > 0) {
                return asset.assetId;
            }
        }
        
        return assets.length > 0 ? assets[0].assetId : null;
    }
    return null;
}

function loadEmployeesForCustody() {
    const select = document.getElementById('custodyEmployeeId');
    console.log('Elemento select encontrado:', select);
    if (!select) return;
    
    select.innerHTML = '<option value="">Select Employee</option>';
    
    // Verificar que teamManager existe y tiene empleados
    if (typeof teamManager !== 'undefined' && teamManager.employees) {
        console.log('Empleados encontrados:', teamManager.employees);
        teamManager.employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.employeeId;
            option.textContent = `${emp.employeeId} - ${emp.fullName}`;
            select.appendChild(option);
        });
        console.log('Opciones después de cargar:', select.options.length);
    } else {
        console.warn('teamManager no está disponible');
    }
}

async function loadAssetsForCustody() {
    const select = document.getElementById('custodyAssetId');
    if (!select) return;
    
    select.innerHTML = '<option value="">Select Asset</option>';
    
    if (typeof assetsManager !== 'undefined' && assetsManager.assets) {
        const assetsByCategory = {};
        
        // Agrupar assets por categoría para mejor organización
        for (const asset of assetsManager.assets) {
            const availableQty = await custodyManager.getAssetAvailableQuantity(asset.assetId);
            if (availableQty > 0) {
                if (!assetsByCategory[asset.category]) {
                    assetsByCategory[asset.category] = [];
                }
                assetsByCategory[asset.category].push({
                    asset: asset,
                    availableQty: availableQty
                });
            }
        }
        
        // Ordenar categorías alfabéticamente
        const sortedCategories = Object.keys(assetsByCategory).sort();
        
        sortedCategories.forEach(category => {
            // Opción de grupo para la categoría
            const optgroup = document.createElement('optgroup');
            optgroup.label = `${category}`;
            
            // Ordenar assets dentro de la categoría por modelo y talla
            assetsByCategory[category].sort((a, b) => {
                return a.asset.model.localeCompare(b.asset.model) || 
                       a.asset.size.localeCompare(b.asset.size);
            });
            
            assetsByCategory[category].forEach(item => {
                const option = document.createElement('option');
                option.value = item.asset.assetId;
                // Información clara y concisa
                option.textContent = `${item.asset.model} - ${item.asset.size} (Available: ${item.availableQty})`;
                option.title = `ID: ${item.asset.assetId} | Price: $${item.asset.price}`;
                optgroup.appendChild(option);
            });
            
            select.appendChild(optgroup);
        });
    }
}

async function updateAssetInfo() {
    const assetId = document.getElementById('custodyAssetId').value;
    const availableQtyElement = document.getElementById('availableQuantity');
    const maxQuantityInput = document.getElementById('quantity');
    
    if (assetId && typeof assetsManager !== 'undefined') {
        const asset = assetsManager.assets.find(a => a.assetId === assetId);
        const availableQty = await custodyManager.getAssetAvailableQuantity(assetId);
        
        if (asset) {
            availableQtyElement.innerHTML = `
                <strong>Available:</strong> ${availableQty} | 
                <strong>ID:</strong> ${asset.assetId} |
                <strong>Price:</strong> $${asset.price}
            `;
        } else {
            availableQtyElement.textContent = `Available: ${availableQty}`;
        }
        
        maxQuantityInput.max = availableQty;
        
        if (parseInt(maxQuantityInput.value) > availableQty) {
            maxQuantityInput.value = availableQty;
        }
    } else {
        availableQtyElement.textContent = 'Available: 0';
        maxQuantityInput.max = '0';
    }
}

async function submitCustodyForm(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const assignmentId = document.getElementById('assignmentId').value;
    
    const assignmentData = {
        employeeId: formData.get('employeeId'),
        assetId: formData.get('assetId'),
        quantity: formData.get('quantity'),
        assignmentDate: formData.get('assignmentDate'),
        dueDate: formData.get('dueDate'),
        status: formData.get('status'),
        condition: formData.get('condition'),
        notes: formData.get('notes') || ''
    };
    
    // Format dates to mm/dd/yy
    if (assignmentData.assignmentDate) {
        const date = new Date(assignmentData.assignmentDate);
        assignmentData.assignmentDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
    }
    if (assignmentData.dueDate) {
        const date = new Date(assignmentData.dueDate);
        assignmentData.dueDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
    }
    
    try {
        if (assignmentId) {
            // Edit existing assignment
            custodyManager.editAssignment(assignmentId, assignmentData);
            showNotification('✅ Assignment updated successfully', 'success');
        } else {
            // Add new assignment
            const newAssignment = custodyManager.addAssignment(assignmentData);
            showNotification(`✅ Asset assigned: ${newAssignment.assetId} to ${newAssignment.employeeName}`, 'success');
        }
        
        loadCustodyTable();
        resetCustodyForm();
        loadAssetsForCustody(); // Refresh available assets
        
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

function editCustodyAssignment(assignmentId) {
    const assignment = custodyManager.assignments.find(a => a.assignmentId === assignmentId);
    
    if (assignment) {
        document.getElementById('assignmentId').value = assignment.assignmentId;
        document.getElementById('custodyEmployeeId').value = assignment.employeeId;
        document.getElementById('custodyAssetId').value = assignment.assetId;
        document.getElementById('quantity').value = assignment.quantity;
        document.getElementById('status').value = assignment.status;
        document.getElementById('condition').value = assignment.condition;
        document.getElementById('notes').value = assignment.notes;
        
        // Convert date format back to YYYY-MM-DD for input fields
        const assignmentDate = convertToInputDate(assignment.assignmentDate);
        const dueDate = convertToInputDate(assignment.dueDate);
        
        document.getElementById('assignmentDate').value = assignmentDate;
        document.getElementById('dueDate').value = dueDate;
        
        document.getElementById('formTitle').textContent = 'Edit Assignment';
        document.getElementById('submitCustodyBtn').textContent = 'Update';
        
        // Update available quantity display
        updateAssetInfo();
        
        document.getElementById('custodyModal').style.display = 'block';
    }
}

function returnAssignment(assignmentId) {
    const assignment = custodyManager.assignments.find(a => a.assignmentId === assignmentId);
    
    if (assignment) {
        const returnDate = prompt('Enter return date (MM/DD/YY) or leave empty for today:', 
                                new Date().toLocaleDateString('en-US', { 
                                    year: '2-digit', 
                                    month: '2-digit', 
                                    day: '2-digit' 
                                }));
        
        if (returnDate === null) return; // User cancelled
        
        const condition = prompt('Enter condition (New/Damaged/Lost):', 'New');
        if (condition === null) return; // User cancelled
        
        const notes = prompt('Enter notes (optional):', '');
        
        const returnData = {
            returnDate: returnDate || new Date().toLocaleDateString('en-US', { 
                year: '2-digit', 
                month: '2-digit', 
                day: '2-digit' 
            }),
            condition: condition || 'Good',
            notes: notes || '',
            recycled: confirm('Is this asset recyclable?') // Ask if recyclable
        };
        
        try {
            custodyManager.returnAssignment(assignmentId, returnData);
            showNotification(`✅ Asset returned: ${assignment.assetId} from ${assignment.employeeName}`, 'success');
            loadCustodyTable();
            loadAssetsForCustody(); // Refresh available assets
        } catch (error) {
            showNotification(`❌ ${error.message}`, 'error');
        }
    }
}

function deleteCustodyAssignment(assignmentId) {
    const assignment = custodyManager.assignments.find(a => a.assignmentId === assignmentId);
    
    if (assignment && confirm(`Are you sure you want to delete assignment:\n${assignment.assignmentId} - ${assignment.employeeName} -> ${assignment.assetId}?`)) {
        try {
            const deletedAssignment = custodyManager.deleteAssignment(assignmentId);
            showNotification(`🗑️ Assignment deleted: ${deletedAssignment.assignmentId}`, 'success');
            loadCustodyTable();
            loadAssetsForCustody(); // Refresh available assets
        } catch (error) {
            showNotification(`❌ ${error.message}`, 'error');
        }
    }
}

function searchCustodyAssignments() {
    const searchTerm = document.getElementById('custodySearch').value;
    const filteredAssignments = custodyManager.searchAssignments(searchTerm);
    loadCustodyTable(filteredAssignments);
}

function exportCustodyToExcel() {
    try {
        const result = custodyManager.exportToExcel();
        showNotification(`✅ ${result.message}`, 'success');
    } catch (error) {
        showNotification(`❌ Export failed: ${error.message}`, 'error');
    }
}

// Update AssetsManager to include assigned quantities
if (typeof AssetsManager !== 'undefined') {
    // Extend the AssetsManager class to include assigned quantity calculations
    const originalGetStats = AssetsManager.prototype.getStats;
    
    AssetsManager.prototype.getStats = function() {
        const stats = originalGetStats.call(this);
        
        // Calculate assigned quantities if custodyManager exists
        if (typeof custodyManager !== 'undefined') {
            const totalAssigned = this.assets.reduce((sum, asset) => {
                return sum + custodyManager.getAssetAssignedQuantity(asset.assetId);
            }, 0);
            
            stats.totalAssigned = totalAssigned;
            stats.totalAvailableAdjusted = stats.totalAvailable - totalAssigned;
        }
        
        return stats;
    };
    
    // Update asset available calculation to consider assigned quantities
    const originalEditAsset = AssetsManager.prototype.editAsset;
    
    AssetsManager.prototype.editAsset = function(assetId, assetData) {
        const result = originalEditAsset.call(this, assetId, assetData);
        
        // Update custody assignments if this asset is referenced
        if (typeof custodyManager !== 'undefined') {
            custodyManager.updateDashboard();
        }
        
        return result;
    };
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('custodyModal')) {
        createCustodyModal();
    }
    // Initialize dashboard
    custodyManager.updateDashboard();
});

function createCustodyModal() {
    const modalHTML = `
    <div id="custodyModal" class="modal" style="display: none;">
        <div class="modal-content" style="max-width: 95%; width: 95%;">
            <span class="close" onclick="closeCustodyModal()">&times;</span>
            <h2 id="formTitle" style="color: #2c3e50; margin-bottom: 10px;">Asset Custody Management</h2>
            
            <div id="custodyStats"></div>
            
            <div style="display: grid; grid-template-columns: 1fr 4fr; gap: 15px;">
                <!-- Form -->
                <div style="background: #f8f9fa; padding: 10px; border-radius: 10px;">
                    <form id="custodyForm" onsubmit="submitCustodyForm(event)">
                        <input type="hidden" id="assignmentId">
                        
                        <div style="color: #e74c3c; font-size: 12px; margin-bottom: 15px; font-weight: bold;">
                            Note: * required fields
                        </div>
                        
                        <div class="form-section" style="margin-bottom: 5px;">
                            <h3 style="color: #34495e; margin-bottom: 7px;">Assignment Information</h3>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Employee:*</label>
                                <select id="custodyEmployeeId" name="employeeId" required
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                    <option value="">Select Employee</option>
                                </select>
                            </div>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Asset:*</label>
                                <select id="custodyAssetId" name="assetId" required onchange="updateAssetInfo()"
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                    <option value="">Select Asset</option>
                                </select>
                                <div style="font-size: 11px; color: #666; margin-top: 5px;">
                                    Available Quantity: <span id="availableQuantity">0</span>
                                </div>
                            </div>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Quantity:*</label>
                                <input type="number" id="quantity" name="quantity" min="1" required
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" value="1">
                            </div>
                        </div>
                        
                        <div class="form-section" style="margin-bottom: 10px;">
                            <h3 style="color: #34495e; margin-bottom: 15px;">Dates</h3>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Assignment Date:*</label>
                                <input type="date" id="assignmentDate" name="assignmentDate" required
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Due Date:*</label>
                                <input type="date" id="dueDate" name="dueDate" required
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                        </div>
                        
                        <div class="form-section" style="margin-bottom: 10px;">
                            <h3 style="color: #34495e; margin-bottom: 15px;">Status & Notes</h3>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Status:</label>
                                <select id="status" name="status"
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                    <option value="Active">Active</option>
                                    <option value="Returned">Returned</option>
                                    <option value="Overdue">Overdue</option>
                                </select>
                            </div>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Condition:</label>
                                <select id="condition" name="condition"
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                    <option value="New">New</option>
                                    <option value="Damaged">Damaged</option>
                                    <option value="Lost">Lost</option>
                                    <option value="Recyclable">Recyclable</option>
                                </select>
                            </div>
                            
                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Notes:</label>
                                <textarea id="notes" name="notes" rows="3"
                                         style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; resize: vertical;"></textarea>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 10px; margin-top: 20px;">
                            <button type="submit" id="submitCustodyBtn" 
                                   style="background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                                Assign
                            </button>
                            <button type="button" onclick="resetCustodyForm()"
                                   style="background: #95a5a6; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                                Reset
                            </button>
                            <button type="button" onclick="closeCustodyModal()"
                                   style="background: #e74c3c; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
                
                <!-- Table -->
                <div style="background: white; padding: 10px; border-radius: 10px; border: 1px solid #ddd;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <h3 style="color: #2c3e50; margin: 0;">Assignment History</h3>
                            <input type="text" id="custodySearch" placeholder="Search assignments..." 
                                   oninput="searchCustodyAssignments()"
                                   style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 250px;">
                        </div>
                    </div>
                    
                    <div style="overflow-x: auto; max-height: 600px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <thead style="background: #34495e; color: white; position: sticky; top: 0;">
                                <tr>
                                    <th style="padding: 10px; text-align: left;">ID</th>
                                    <th style="padding: 10px; text-align: left;">Employee</th>
                                    <th style="padding: 10px; text-align: left;">Asset ID</th>
                                    <th style="padding: 10px; text-align: center;">Qty</th>
                                    <th style="padding: 10px; text-align: left;">Assign Date</th>
                                    <th style="padding: 10px; text-align: left;">Due Date</th>
                                    <th style="padding: 10px; text-align: left;">Return Date</th>
                                    <th style="padding: 10px; text-align: left;">Status</th>
                                    <th style="padding: 10px; text-align: center;">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="custodyTable">
                                <!-- Table content will be loaded here -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Helper function to convert date format for input fields
function convertToInputDate(dateStr) {
    if (!dateStr) return '';
    
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const month = parts[0];
        const day = parts[1];
        let year = parts[2];
        
        if (year.length === 2) {
            year = '20' + year;
        }
        
        return `${year}-${month}-${day}`;
    }
    
    return dateStr;
}

// Add CSS for status badges
const custodyStyles = `
.status-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
}

.status-active {
    background: #d4edda;
    color: #155724;
}

.status-overdue {
    background: #f8d7da;
    color: #721c24;
}

.status-returned {
    background: #e2e3e5;
    color: #383d41;
}

.btn-return {
    background: #28a745;
    color: white;
    border: none;
    border-radius: 3px;
    padding: 4px 8px;
    cursor: pointer;
    margin: 0 2px;
    font-size: 11px;
}

.btn-edit {
    background: #ffc107;
    color: white;
    border: none;
    border-radius: 3px;
    padding: 4px 8px;
    cursor: pointer;
    margin: 0 2px;
    font-size: 11px;
}

.btn-delete {
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 3px;
    padding: 4px 8px;
    cursor: pointer;
    margin: 0 2px;
    font-size: 11px;
}

.employee-link:hover {
    text-decoration: underline;
}
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = custodyStyles;
document.head.appendChild(styleSheet);