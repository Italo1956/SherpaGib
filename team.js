// team.js - Employee Management
class TeamManager {
    constructor() {
        this.employees = [];
        this.isInitialized = false;
        this.nextEmployeeId = 1001;
        this.init();
    }

    async init() {
        if (this.isInitialized) return;

        try {
            // Inicializar IndexedDB
            await indexedDBManager.init();

            // Cargar datos desde IndexedDB
            this.employees = await indexedDBManager.getAllEmployees();

            // Calcular siguiente ID
            this.nextEmployeeId = this.calculateNextEmployeeId();
            // Si no hay datos, crear ejemplos
            if (this.employees.length === 0) {
                await this.createSampleEmployees();
            }
            this.isInitialized = true;
            this.updateDashboard();

        } catch (error) {
            console.error('Error inicializando TeamManager:', error);
            // Fallback a datos de ejemplo
            this.employees = [];
            this.createSampleEmployees();
        }
    }

    calculateNextEmployeeId() {
        if (this.employees.length === 0) return 1001;

        const ids = this.employees.map(emp => {
            const num = emp.employeeId ? parseInt(emp.employeeId.replace('EMP', '')) : 0;
            return num || 0;
        });

        const lastId = Math.max(...ids);
        return lastId + 1;
    }

    generateEmployeeId() {
        const id = `EMP${this.nextEmployeeId.toString().padStart(4, '0')}`;
        this.nextEmployeeId++;
        return id;
    }

    async createSampleEmployees() {
        const sampleEmployees = [
            {
                employeeId: 'EMP1001',
                fullName: 'John Smith',
                status: 'Active',
                email: 'john.smith@company.com',
                phone: '+1 (555) 123-4567',
                role: 'Delivery Driver',
                loginAllowed: false,
                confirmationEmail: false,
                hireDate: '01/15/23',
                rehireDate: '',
                terminationDate: '',
                image: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                employeeId: 'EMP1002',
                fullName: 'Jane Doe',
                status: 'Active',
                email: 'jane.doe@company.com',
                phone: '+1 (555) 987-6543',
                role: 'Warehouse Manager',
                loginAllowed: false,
                confirmationEmail: false,
                hireDate: '03/20/23',
                rehireDate: '',
                terminationDate: '',
                image: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        // Guardar cada empleado en IndexedDB
        for (const emp of sampleEmployees) {
            await indexedDBManager.saveEmployee(emp);
        }

        this.employees = sampleEmployees;
        this.updateDashboard();
    }


    // Add new employee
    async addEmployee(employeeData) {
        const requiredFields = ['fullName', /*'email',*/ 'role', 'hireDate'];
        const missingFields = requiredFields.filter(field => !employeeData[field]);

        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Check if employee with same email already exists
        const allEmployees = await indexedDBManager.getAllEmployees();
        if (allEmployees.some(emp => emp.email.toLowerCase() === employeeData.email.toLowerCase())) {
            throw new Error('An employee with this email already exists');
        }

        const newEmployee = {
            employeeId: employeeData.employeeId || this.generateEmployeeId(),
            fullName: employeeData.fullName.trim(),
            status: employeeData.status || 'Active',
            email: employeeData.email.toLowerCase().trim(),
            phone: employeeData.phone || '',
            role: employeeData.role.trim(),
            gender: employeeData.gender || 'Male',
            loginAllowed: employeeData.loginAllowed !== undefined ? employeeData.loginAllowed : false,
            confirmationEmail: employeeData.confirmationEmail !== undefined ? employeeData.confirmationEmail : false,
            hireDate: employeeData.hireDate,
            rehireDate: employeeData.rehireDate || '',
            terminationDate: employeeData.terminationDate || '',
            image: employeeData.image || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Guardar en IndexedDB
        await indexedDBManager.saveEmployee(newEmployee);

        this.employees.push(newEmployee);
        this.updateDashboard();

        // Registrar en auditoría
        await indexedDBManager.logAudit('CREATE', 'employee', `Employee created: ${newEmployee.employeeId}`);

        return newEmployee;
    }

    // Add multiple employees at once (for import)
    async addMultipleEmployees(employeesData, replaceExisting = false) {
        const results = {
            success: [],
            errors: []
        };

        if (replaceExisting) {
            this.employees = [];
            this.nextEmployeeId = 1001;
        }

        // USAR for...of EN LUGAR DE forEach PARA MANEJAR AWAIT
        for (let index = 0; index < employeesData.length; index++) {
            const empData = employeesData[index];
            try {
                const newEmployee = await this.addEmployee(empData);
                results.success.push({
                    index: index + 1,
                    employee: newEmployee
                });
            } catch (error) {
                results.errors.push({
                    index: index + 1,
                    data: empData,
                    error: error.message
                });
            }
        }

        this.updateDashboard();
        return results;
    }

    // Edit existing employee
    async editEmployee(employeeId, employeeData) {
        const employeeIndex = this.employees.findIndex(emp => emp.employeeId === employeeId);

        if (employeeIndex === -1) {
            throw new Error('Employee not found');
        }

        // Check if email already exists in another employee
        const allEmployees = await indexedDBManager.getAllEmployees();
        if (allEmployees.some(emp =>
            emp.employeeId !== employeeId && emp.email.toLowerCase() === employeeData.email.toLowerCase()
        )) {
            throw new Error('Another employee with this email already exists');
        }

        const updatedEmployee = {
            ...this.employees[employeeIndex],
            ...employeeData,
            employeeId: employeeId, // Keep original ID
            updatedAt: new Date().toISOString()
        };

        // Actualizar en IndexedDB
        await indexedDBManager.saveEmployee(updatedEmployee);

        // Actualizar lista local
        this.employees[employeeIndex] = updatedEmployee;
        this.updateDashboard();

        // Registrar en auditoría
        await indexedDBManager.logAudit('UPDATE', 'employee', `Employee updated: ${employeeId}`);

        return this.employees[employeeIndex];
    }

    // Delete employee
    async deleteEmployee(employeeId) {
        const employeeIndex = this.employees.findIndex(emp => emp.employeeId === employeeId);

        if (employeeIndex === -1) {
            throw new Error('Employee not found');
        }

        const deletedEmployee = this.employees.splice(employeeIndex, 1)[0];

        // Eliminar de IndexedDB
        await indexedDBManager.deleteEmployee(employeeId);

        this.updateDashboard();

        // Registrar en auditoría
        await indexedDBManager.logAudit('DELETE', 'employee', `Employee deleted: ${employeeId}`);

        return deletedEmployee;
    }

    // Get all employees
    async getAllEmployees() {
        // Siempre obtener datos frescos de IndexedDB
        this.employees = await indexedDBManager.getAllEmployees();
        return [...this.employees].sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    // Search employees
    async searchEmployees(searchTerm) {
        // Obtener datos frescos de IndexedDB
        await this.getAllEmployees();
        if (!searchTerm) return this.getAllEmployees();

        const term = searchTerm.toLowerCase();
        return this.employees.filter(emp =>
            emp.fullName.toLowerCase().includes(term) ||
            emp.employeeId.toLowerCase().includes(term) ||
            emp.email.toLowerCase().includes(term) ||
            emp.role.toLowerCase().includes(term) ||
            emp.status.toLowerCase().includes(term)
        );
    }

    // Sort employees by column
    sortEmployees(column, direction = 'asc') {
        const sortedEmployees = [...this.employees];

        sortedEmployees.sort((a, b) => {
            let aValue = a[column];
            let bValue = b[column];

            // Handle empty values
            if (!aValue) aValue = '';
            if (!bValue) bValue = '';

            // Handle different data types
            if (column === 'hours') {
                aValue = parseFloat(aValue) || 0;
                bValue = parseFloat(bValue) || 0;
            } else if (column === 'hireDate' || column === 'rehireDate' || column === 'terminationDate') {
                // Convert dates to comparable format
                aValue = this.parseDate(aValue);
                bValue = this.parseDate(bValue);
            } else {
                // String comparison
                aValue = String(aValue).toLowerCase();
                bValue = String(bValue).toLowerCase();
            }

            if (direction === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });

        return sortedEmployees;
    }

    // Parse date for sorting
    parseDate(dateStr) {
        if (!dateStr) return new Date(0); // Very old date for empty values

        // Handle mm/dd/yy format
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const month = parseInt(parts[0]) - 1;
            const day = parseInt(parts[1]);
            let year = parseInt(parts[2]);

            // Convert 2-digit year to 4-digit
            if (year < 100) {
                year += 2000;
            }

            return new Date(year, month, day);
        }

        // Try to parse as ISO date
        return new Date(dateStr);
    }

    // Find employee by ID
    getEmployeeById(employeeId) {
        return this.employees.find(emp => emp.employeeId === employeeId);
    }

    // Find employees by status
    getEmployeesByStatus(status) {
        return this.employees.filter(emp => emp.status === status);
    }

    // Get statistics
    getStats() {
        const activeEmployees = this.getEmployeesByStatus('Active');
        const terminatedEmployees = this.getEmployeesByStatus('Terminated');
        const inactiveEmployees = this.getEmployeesByStatus('Inactive');

        return {
            total: this.employees.length,
            active: activeEmployees.length,
            terminated: terminatedEmployees.length,
            inactive: inactiveEmployees.length,
            nextEmployeeId: `EMP${this.nextEmployeeId.toString().padStart(4, '0')}`
        };
    }

    // Update dashboard
    updateDashboard() {
        const stats = this.getStats();

        // Update team quantity in dashboard
        const teamQtyElement = document.getElementById('teamQty');
        if (teamQtyElement) {
            teamQtyElement.textContent = stats.total;
        }

        // Update team status in dashboard
        const teamStatusElement = document.getElementById('teamStatus');
        if (teamStatusElement) {
            let statusText = `${stats.active} Active`;
            if (stats.terminated > 0) {
                statusText += `, ${stats.terminated} Terminated`;
            }
            if (stats.inactive > 0) {
                statusText += `, ${stats.inactive} Inactive`;
            }
            teamStatusElement.textContent = statusText;
        }
    }

    // Import from Excel with SheetJS
    async importFromExcel(file, replaceExisting = false) {
        if (!file) {
            throw new Error('No file selected');
        }

        // Check if SheetJS is available
        if (typeof XLSX === 'undefined') {
            throw new Error('SheetJS library not loaded. Please include the XLSX library. Or xlsx.full.min.js before team.js');
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
            const importedEmployees = [];

            // Process each row (skip header)
            for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0) continue;

                const employeeData = {};

                headers.forEach((header, index) => {
                    const value = row[index] ? row[index].toString().trim() : '';

                    switch(header) {
                        case 'employee_id':
                        case 'employee id':
                        case 'id':
                            employeeData.employeeId = value;
                            break;
                        case 'full_name':
                        case 'full name':
                        case 'name':
                            employeeData.fullName = value;
                            break;
                        case 'status':
                            employeeData.status = value || 'Active';
                            break;
                        case 'email':
                        case 'email address':
                            employeeData.email = value;
                            break;
                        case 'phone':
                        case 'phone number':
                            employeeData.phone = value;
                            break;
                        case 'role':
                        case 'position':
                        case 'job title':
                            employeeData.role = value;
                            break;
                        case 'login':
                        case 'login allowed':
                        case 'can login':
                            employeeData.loginAllowed = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' || value === '1';
                            break;
                        case 'confirm email':
                        case 'confirmation email':
                        case 'email sent':
                            employeeData.confirmationEmail = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' || value === '1';
                            break;
                        case 'hire_date':
                        case 'hire date':
                        case 'date hired':
                            employeeData.hireDate = this.formatDateForDisplay(value);
                            break;
                        case 'rehire_date':
                        case 'rehire date':
                            employeeData.rehireDate = value ? this.formatDateForDisplay(value) : '';
                            break;
                        case 'termination':
                        case 'termination date':
                            employeeData.terminationDate = value ? this.formatDateForDisplay(value) : '';
                            break;
                        case 'hours':
                        case 'weekly hours':
                        case 'hours per week':
                            employeeData.hours = value || '40';
                            break;
                    }
                });

                // Only add if we have required fields
                if (employeeData.fullName /*&& employeeData.email*/) {
                    importedEmployees.push(employeeData);
                }
            }

            if (importedEmployees.length === 0) {
                throw new Error('No valid employee data found in the Excel file');
            }

            // Add all imported employees
            const results = await this.addMultipleEmployees(importedEmployees, replaceExisting);

            return {
                success: true,
                imported: results.success.length,
                errors: results.errors.length,
                details: results,
                message: `Successfully imported ${results.success.length} employees, ${results.errors.length} errors`
            };

        } catch (error) {
            throw new Error('Failed to process Excel file: ' + error.message);
        }
    }

    // Format date for display (mm/dd/yy)
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

    // Export to Excel
    async exportToExcel() {
        const data = this.employees.map(emp => ({
            'Employee ID': emp.employeeId,
            'Full Name': emp.fullName,
            'Status': emp.status,
            'Email': emp.email,
            'Phone': emp.phone,
            'Role': emp.role,
            'Login Allowed': emp.loginAllowed ? 'Yes' : 'No',
            'Confirmation Email': emp.confirmationEmail ? 'Yes' : 'No',
            'Hire Date': emp.hireDate,
            'Rehire Date': emp.rehireDate,
            'Termination Date': emp.terminationDate,
            'Hours': emp.hours
        }));

        if (data.length === 0) {
            throw new Error('No data to export');
        }

        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(data);

        // Create workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');

        // Generate Excel file and download
        XLSX.writeFile(workbook, `employees_export_${new Date().toISOString().split('T')[0]}.xlsx`);

        return {
            success: true,
            exported: data.length,
            message: `Successfully exported ${data.length} employees to Excel file`
        };
    }

    // Export to PDF
    async exportToPDF() {
        const employees = await this.getAllEmployees();
        if (employees.length === 0) {
            throw new Error('No data to export');
        }

        // ORDENAR EMPLEADOS POR NOMBRE (igual que en la interfaz)
        const sortedEmployees = [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName));

        // DIVIDIR EN PÁGINAS - igual que en assets.js
        const employeesFirstPage = 8;
        const employeesOtherPages = 10;
        const totalPages = Math.ceil((sortedEmployees.length - employeesFirstPage) / employeesOtherPages) + 1;

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
        <title>Employee Report - ${today}</title>
        <style>
            @media print {
                .page-break {
                    page-break-before: always;
                }
            }

            body {
                font-family: Arial, sans-serif;
                margin: 20px;
            }

            .header {
                background: white;
                padding: 15px 20px;
                border-bottom: 2px solid #2c3e50;
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 20px;
            }

            .header-left { display: flex; align-items: center; gap: 15px; }
            .logo { width: 60px; height: 60px; border-radius: 8px; }
            .company-info { text-align: left; }
            .company-name { font-size: 20px; font-weight: bold; color: #2c3e50; margin: 0; }
            .report-title { font-size: 16px; color: #7f8c8d; margin: 0; }
            .header-right { text-align: right; }
            .stats { display: flex; justify-content: center; gap: 20px; margin: 20px 0; }
            .stat-box { background: #f8f9fa; padding: 10px 20px; border-radius: 5px; text-align: center; }
            .stat-number { font-size: 24px; font-weight: bold; color: #2c3e50; }
            .stat-label { font-size: 12px; color: #7f8c8d; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
            th { background: #34495e; color: white; padding: 10px; text-align: left; font-weight: bold; }
            td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
            tr:nth-child(even) { background: #f8f9fa; }
            .employee-image { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
            .placeholder-image { width: 40px; height: 40px; border-radius: 50%; background: #bdc3c7; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; }
            .status-active { color: #27ae60; font-weight: bold; }
            .status-terminated { color: #e74c3c; font-weight: bold; }
            .status-inactive { color: #f39c12; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #7f8c8d; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; }
        </style>
    </head>
    <body>
    `;

        // GENERAR CADA PÁGINA
        for (let page = 0; page < totalPages; page++) {
            let startIndex, endIndex;

            // CALCULAR RANGOS DIFERENTES PARA PRIMERA PÁGINA VS PÁGINAS SIGUIENTES
            if (page === 0) {
                // Primera página: 8 empleados
                startIndex = 0;
                endIndex = Math.min(employeesFirstPage, sortedEmployees.length);
            } else {
                // Páginas siguientes: 10 empleados
                startIndex = employeesFirstPage + (page - 1) * employeesOtherPages;
                endIndex = Math.min(startIndex + employeesOtherPages, sortedEmployees.length);
            }

            const pageEmployees = sortedEmployees.slice(startIndex, endIndex);

            // AGREGAR SALTO DE PÁGINA PARA PÁGINAS 2 EN ADELANTE
            if (page > 0) {
                pdfContent += `<div class="page-break">`;
            }

            pdfContent += `
            <div class="header">
                <div class="header-left">
                    <img src="logo.png" alt="Company Logo" class="logo" onerror="this.style.display='none'">
                    <div class="company-info">
                        <h1 class="company-name">Sherpa Delivery Direct, LLC</h1>
                        <div class="report-title">Employee Report ${totalPages > 1 ? '- Page ' + (page + 1) : ''}</div>
                    </div>
                </div>
                <div class="header-right">
                    <div class="date">Generated on: ${today}</div>
                </div>
            </div>
        `;

            // AGREGAR ESTADÍSTICAS SOLO EN LA PRIMERA PÁGINA
            if (page === 0) {
                pdfContent += `
                <div class="stats">
                    <div class="stat-box">
                        <div class="stat-number">${sortedEmployees.length}</div>
                        <div class="stat-label">Total Employees</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${sortedEmployees.filter(emp => emp.status === 'Active').length}</div>
                        <div class="stat-label">Active</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-number">${sortedEmployees.filter(emp => emp.status === 'Terminated').length}</div>
                        <div class="stat-label">Terminated</div>
                    </div>
                </div>
            `;
            }

            pdfContent += `
            <table>
                <thead>
                    <tr>
                        <th>Image</th>
                        <th>Full Name</th>
                        <th>Employee ID</th>
                        <th>Status</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Role</th>
                        <th>Login</th>
                        <th>Confirm</th>
                        <th>Hire Date</th>
                    </tr>
                </thead>
                <tbody>
        `;

            // AGREGAR EMPLEADOS DE ESTA PÁGINA
            pageEmployees.forEach(employee => {
                const statusClass = `status-${employee.status.toLowerCase()}`;
                const initials = employee.fullName.split(' ').map(n => n[0]).join('').toUpperCase();

                pdfContent += `
                <tr>
                    <td>
                        ${employee.image ?
                            `<img src="${employee.image}" alt="${employee.fullName}" class="employee-image">` :
                            `<div class="placeholder-image">${initials}</div>`
                        }
                    </td>
                    <td>${employee.fullName}</td>
                    <td>${employee.employeeId}</td>
                    <td class="${statusClass}">${employee.status}</td>
                    <td>${employee.email}</td>
                    <td>${employee.phone}</td>
                    <td>${employee.role}</td>
                    <td>${employee.loginAllowed ? 'Yes' : 'No'}</td>
                    <td>${employee.confirmationEmail ? 'Yes' : 'No'}</td>
                    <td>${employee.hireDate}</td>
                </tr>
            `;
            });

            pdfContent += `
                </tbody>
            </table>
           <div class="footer">
                Employee Management System - Confidential Report | Page ${page + 1} of ${totalPages} | Total Records: ${sortedEmployees.length}
            </div>
        `;

            // CERRAR DIV DE PAGE-BREAK PARA PÁGINAS 2+
            if (page > 0) {
                pdfContent += `</div>`;
            }
        }

        pdfContent += `
        <script>
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
            exported: sortedEmployees.length,
            message: `Successfully exported ${sortedEmployees.length} employees to PDF`
        };
    }

    // Clear all employees
    async clearAll() {
        // Limpiar IndexedDB
        await indexedDBManager.clear('employees');

        this.employees = [];
        this.nextEmployeeId = 1001;

        this.updateDashboard();

        // Registrar en auditoría
        await indexedDBManager.logAudit('CLEAR', 'employee', 'All employees cleared');
    }

    // Send confirmation email
    async sendConfirmationEmail(employeeData) {
        try {
            const response = await fetch('/send-employee-email.php', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    email: employeeData.email,
                    fullName: employeeData.fullName,
                    employeeId: employeeData.employeeId,
                    role: employeeData.role,
                    hireDate: employeeData.hireDate,
                    status: employeeData.status
                })
            });

            if (!response.ok) throw new Error('Error del servidor');

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || 'Error enviando email');
            }

            return {
                success: true,
                message: 'Email de confirmación enviado exitosamente'
            };

        } catch (error) {
            console.error('Error enviando email:', error);
            throw new Error(`Falló el envío de email: ${error.message}`);
        }
    }
}

// Verificar que indexedDBManager esté disponible
if (typeof window.indexedDBManager === 'undefined') {
    console.error('❌ indexedDBManager no está disponible');
    throw new Error('El módulo de gestión de base de datos no está cargado');
}

// Global instance of team manager
const teamManager = new TeamManager();

// Sorting state
let currentSortColumn = '';
let currentSortDirection = 'asc';

// UI Functions
async function openTeamModal() {
    document.getElementById('teamModal').style.display = 'block';
    await loadEmployeesTable();
    updateEmployeeStats();
}

function closeTeamModal() {
    document.getElementById('teamModal').style.display = 'none';
    resetEmployeeForm();
}

function resetEmployeeForm() {
    document.getElementById('employeeForm').reset();
    document.getElementById('employeeId').value = '';
    document.getElementById('employeeImagePreview').style.display = 'none';
    document.getElementById('employeeImagePreview').src = '';
    document.getElementById('formTitle').textContent = 'Add Employee';
    document.getElementById('submitEmployeeBtn').textContent = 'Add';
    document.getElementById('loginAllowed').checked = false;
    document.getElementById('confirmationEmail').checked = false;
    document.getElementById('employeeStatus').value = 'Active';

    // Set today's date in mm/dd/yyyy format for hire date
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    const year = today.getFullYear();
    document.getElementById('hireDate').value = `${year}-${month}-${day}`;
}

function updateEmployeeStats() {
    const stats = teamManager.getStats();
    const statsElement = document.getElementById('employeeStats');
    if (statsElement) {
        statsElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    <div style="background: #27ae60; color: white; padding: 10px 15px; border-radius: 5px; font-weight: bold;">
                        Total: ${stats.total}
                    </div>
                    <div style="background: #3498db; color: white; padding: 10px 15px; border-radius: 5px; font-weight: bold;">
                        Active: ${stats.active}
                    </div>
                    <div style="background: #e74c3c; color: white; padding: 10px 15px; border-radius: 5px; font-weight: bold;">
                        Terminated: ${stats.terminated}
                    </div>
                    <div style="background: #f39c12; color: white; padding: 10px 15px; border-radius: 5px; font-weight: bold;">
                        Next ID: ${stats.nextEmployeeId}
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="showImportOptions()" class="btn-import"
                            style="background: #9b59b6; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 12px;">
                        📥 Import Excel
                    </button>
                    <button onclick="exportToExcel()" class="btn-export"
                            style="background: #2ecc71; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 12px;">
                        📤 Export Excel
                    </button>
                    <button onclick="exportToPDF()" class="btn-pdf"
                            style="background: #e74c3c; color: white; padding: 8px 15px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 12px;">
                        📄 Export PDF
                    </button>
                </div>
            </div>
        `;
    }
}

async function loadEmployeesTable(employees = null, sortColumn = '', sortDirection = 'asc') {
    const tbody = document.getElementById('employeesTable');
    let employeesToDisplay = employees || await teamManager.getAllEmployees();

    // Apply sorting if specified
    if (sortColumn) {
        employeesToDisplay = teamManager.sortEmployees(sortColumn, sortDirection);
    }

    tbody.innerHTML = '';

    if (employeesToDisplay.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="14" style="text-align: center; color: #666; padding: 30px;">
                No employees found
            </td>
        `;
        tbody.appendChild(row);
        return;
    }

    employeesToDisplay.forEach(employee => {
        const row = document.createElement('tr');
        const statusClass = employee.status === 'Active' ? 'status-active' :
                           employee.status === 'Terminated' ? 'status-terminated' : 'status-inactive';

        row.innerHTML = `
            <td style="text-align: center;">
                ${employee.image ?
                    `<img src="${employee.image}" alt="${employee.fullName}" class="employee-image-hover" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; cursor: pointer;">` :
                    `<div style="width: 40px; height: 40px; border-radius: 50%; background: #bdc3c7; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin: 0 auto;">
                        ${employee.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </div>`
                }
            </td>
            <td style="font-weight: bold;">${employee.fullName}</td>
            <td style="white-space: nowrap;">${employee.employeeId}</td>
            <td>
                <span class="status-badge ${statusClass}">${employee.status}</span>
            </td>
            <td>${employee.email}</td>
            <td style="white-space: nowrap;">${employee.phone}</td>
            <td>${employee.role}</td>
            <td style="text-align: center;">
                ${employee.loginAllowed ? '✅' : '❌'}
            </td>
            <td style="text-align: center;">
                ${employee.confirmationEmail ? '✅' : '❌'}
            </td>
            <td style="white-space: nowrap;">${employee.hireDate}</td>
            <td style="white-space: nowrap;">${employee.rehireDate || '-'}</td>
            <td style="white-space: nowrap;">${employee.terminationDate || '-'}</td>
            <td style="text-align: center; white-space: nowrap;">
                <button onclick="editEmployee('${employee.employeeId}')" class="btn-edit" title="Edit">
                    ✏️
                </button>
                <button onclick="deleteEmployee('${employee.employeeId}')" class="btn-delete" title="Delete">
                    🗑️
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateEmployeeStats();
}

function sortTable(column) {
    // Toggle sort direction if clicking the same column
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }

    // Update sort indicators
    updateSortIndicators(column, currentSortDirection);

    // Reload table with sorting
    loadEmployeesTable(null, column, currentSortDirection);
}

function updateSortIndicators(column, direction) {
    // Remove all sort indicators
    const headers = document.querySelectorAll('#employeesTable thead th');
    headers.forEach(header => {
        header.innerHTML = header.innerHTML.replace(/ [↑↓]$/, '');
    });

    // Add indicator to current sorted column
    const currentHeader = document.querySelector(`#employeesTable thead th[data-column="${column}"]`);
    if (currentHeader) {
        const indicator = direction === 'asc' ? ' ↑' : ' ↓';
        currentHeader.innerHTML += indicator;
    }
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('employeeImagePreview');

    if (file) {
        // Validate file type
        if (!file.type.match('image/jpeg') && !file.type.match('image/png')) {
            showNotification('❌ Only JPG or PNG files are allowed', 'error');
            event.target.value = '';
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showNotification('❌ Image must not exceed 2MB', 'error');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

async function submitEmployeeForm(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const employeeId = document.getElementById('employeeId').value;
    const imagePath = formData.get('image') ? formData.get('image').trim() : '';

    const employeeData = {
        fullName: formData.get('fullName').trim(),
        status: formData.get('status'),
        email: formData.get('email').trim(),
        phone: formData.get('phone').trim(),
        role: formData.get('role').trim(),
        gender: formData.get('gender'),
        loginAllowed: formData.get('loginAllowed') === 'on',
        confirmationEmail: formData.get('confirmationEmail') === 'on',
        hireDate: formData.get('hireDate'),
        rehireDate: formData.get('rehireDate') || '',
        terminationDate: formData.get('terminationDate') || '',
        image: imagePath
    };

    // Manejar el envío de correo de confirmación
    const sendConfirmationEmail = formData.get('sendConfirmationEmail') === 'on';

    // Format date to mm/dd/yy
    if (employeeData.hireDate) {
        const [year, month, day] = employeeData.hireDate.split('-');
        employeeData.hireDate = `${month}/${day}/${year.slice(-2)}`;
    }
    if (employeeData.rehireDate) {
        const [year, month, day] = employeeData.rehireDate.split('-');
        employeeData.rehireDate = `${month}/${day}/${year.slice(-2)}`;
    }
    if (employeeData.terminationDate) {
        const [year, month, day] = employeeData.terminationDate.split('-');
        employeeData.terminationDate = `${month}/${day}/${year.slice(-2)}`;
    }

    try {
        if (employeeId) {
            // Edit existing employee
            await teamManager.editEmployee(employeeId, employeeData);
            showNotification('✅ Employee updated successfully', 'success');
        } else {
            // Add new employee
            const newEmployee = await teamManager.addEmployee(employeeData);
            showNotification(`✅ Employee added: ${newEmployee.employeeId} - ${newEmployee.fullName}`, 'success');

            // Enviar correo de confirmación si está marcado
            if (sendConfirmationEmail) {
                try {
                    showNotification('📧 Sending confirmation email...', 'info');
                    await teamManager.sendConfirmationEmail(newEmployee);
                    showNotification('✅ Confirmation email sent successfully', 'success');

                    // Actualizar el estado de confirmationEmail a true
                    newEmployee.confirmationEmail = true;
                    await teamManager.editEmployee(newEmployee.employeeId, {
                        confirmationEmail: true
                    });

                } catch (emailError) {
                    showNotification(`⚠️ Employee added but email failed: ${emailError.message}`, 'warning');
                }
            }
        }

        await loadEmployeesTable();
        resetEmployeeForm();

    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function editEmployee(employeeId) {
    const employee = await teamManager.getEmployeeById(employeeId);

    if (employee) {
        document.getElementById('employeeId').value = employee.employeeId;
        document.getElementById('fullName').value = employee.fullName;
        document.getElementById('employeeStatus').value = employee.status;
        document.getElementById('email').value = employee.email;
        document.getElementById('phone').value = employee.phone;
        document.getElementById('role').value = employee.role;
        document.getElementById('gender').value = employee.gender || 'Male';
        document.getElementById('loginAllowed').checked = employee.loginAllowed;
        document.getElementById('confirmationEmail').checked = employee.confirmationEmail;

        // Convert date format back to YYYY-MM-DD for input fields
        const hireDate = convertToInputDate(employee.hireDate);
        const rehireDate = employee.rehireDate ? convertToInputDate(employee.rehireDate) : '';
        const terminationDate = employee.terminationDate ? convertToInputDate(employee.terminationDate) : '';

        document.getElementById('hireDate').value = hireDate;
        document.getElementById('rehireDate').value = rehireDate;
        document.getElementById('terminationDate').value = terminationDate;
        document.getElementById('hours').value = employee.hours;
        
        document.getElementById('employeeImagePath').value = employee.image || ''; 
        const imagePreview = document.getElementById('employeeImagePreview');
        
        if (employee.image) {
            imagePreview.src = employee.image;
            imagePreview.style.display = 'block';
        } else {
            imagePreview.style.display = 'none';
        }

        document.getElementById('formTitle').textContent = 'Edit Employee';
        document.getElementById('submitEmployeeBtn').textContent = 'Update';

        document.getElementById('teamModal').style.display = 'block';
    }
}

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

async function deleteEmployee(employeeId) {
    const employee = teamManager.getEmployeeById(employeeId);

    if (employee && confirm(`Are you sure you want to delete employee:\n${employee.employeeId} - ${employee.fullName}?`)) {
        try {
            const deletedEmployee = await teamManager.deleteEmployee(employeeId);
            showNotification(`🗑️ Employee deleted: ${deletedEmployee.employeeId} - ${deletedEmployee.fullName}`, 'success');
            await loadEmployeesTable();
        } catch (error) {
            showNotification(`❌ ${error.message}`, 'error');
        }
    }
}

// Search function
async function searchEmployees() {
    const searchTerm = document.getElementById('employeeSearch').value;
    const filteredEmployees = await teamManager.searchEmployees(searchTerm);
    loadEmployeesTable(filteredEmployees);
}

// Import function with options
function showImportOptions() {
    const importModal = document.getElementById('importOptionsModal');
    if (importModal) {
        importModal.style.display = 'flex';
    } else {
        createImportOptionsModal();
    }
}

function createImportOptionsModal() {
    const modalHTML = `
    <div id="importOptionsModal" class="modal" style="display: none;">
        <div class="modal-content" style="max-width: 500px;">
            <span class="close" onclick="closeImportOptions()">&times;</span>
            <h3 style="color: #2c3e50; margin-bottom: 20px;">Import Excel Options</h3>

            <div style="margin-bottom: 20px;">
                <p style="margin-bottom: 15px; color: #555;">Choose how you want to import the data:</p>

                <div style="display: flex; gap: 15px; margin-bottom: 20px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="importOption" value="append" checked>
                        <span>Append to existing data</span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="radio" name="importOption" value="replace">
                        <span>Replace all data</span>
                    </label>
                </div>

                <div style="background: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #ffc107;">
                    <strong>Note:</strong>
                    <ul style="margin: 8px 0 0 15px; font-size: 12px;">
                        <li>Supported formats: .xlsx, .xls</li>
                        <li>Required columns: Full Name, Email, Role, Hire Date</li>
                        <li>Optional columns: Employee ID, Status, Phone, etc.</li>
                    </ul>
                </div>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="closeImportOptions()" style="background: #95a5a6; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    Cancel
                </button>
                <button onclick="proceedWithImport()" style="background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    Continue
                </button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('importOptionsModal').style.display = 'flex';
}

function closeImportOptions() {
    const modal = document.getElementById('importOptionsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

async function proceedWithImport() {
    const importOption = document.querySelector('input[name="importOption"]:checked').value;
    const replaceExisting = importOption === 'replace';

    closeImportOptions();

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls';

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showNotification('📥 Processing Excel file...', 'info');

        try {
            const result = await teamManager.importFromExcel(file, replaceExisting);
            showNotification(`✅ ${result.message}`, 'success');

            // Show detailed results if there were errors
            if (result.details.errors.length > 0) {
                console.warn('Import errors:', result.details.errors);
                setTimeout(() => {
                    showNotification(`⚠️ ${result.details.errors.length} records had errors (check console)`, 'info');
                }, 1000);
            }

            // Refresh the table to show imported data
            await loadEmployeesTable();

        } catch (error) {
            showNotification(`❌ Import failed: ${error.message}`, 'error');
        }
    };

    fileInput.click();
}

function exportToExcel() {
    try {
        const result = teamManager.exportToExcel();
        showNotification(`✅ ${result.message}`, 'success');
    } catch (error) {
        showNotification(`❌ Export failed: ${error.message}`, 'error');
    }
}

function exportToPDF() {
    try {
        const result = teamManager.exportToPDF();
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
    if (!document.getElementById('teamModal')) {
        createTeamModal();
    }
    // Initialize dashboard
    teamManager.updateDashboard();
});

function createTeamModal() {
    const modalHTML = `
    <div id="teamModal" class="modal" style="display: none;">
        <div class="modal-content" style="max-width: 95%; width: 95%;">
            <span class="close" onclick="closeTeamModal()">&times;</span>
            <h2 id="formTitle" style="color: #2c3e50; margin-bottom: 10px;">Employee Management</h2>

            <div id="employeeStats"></div>

            <div style="display: grid; grid-template-columns: 1fr 4fr; gap: 15px;">
                <!-- Form -->
                <div style="background: #f8f9fa; padding: 10px; border-radius: 10px;">
                    <form id="employeeForm" onsubmit="submitEmployeeForm(event)">
                        <input type="hidden" id="employeeId">

                        <div style="color: #e74c3c; font-size: 12px; margin-bottom: 15px; font-weight: bold;">
                            Note: * required fields
                        </div>

                        <div class="form-section" style="margin-bottom: 5px;">
                            <h3 style="color: #34495e; margin-bottom: 7px;">Personal Information</h3>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Photo:</label>
                                <input type="file" id="employeeImage" accept="image/jpeg,image/png"
                                       onchange="handleImageUpload(event)"
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                <div style="font-size: 12px; color: #666; margin-top: 5px;">Select file - No file chosen</div>
                                <img id="employeeImagePreview" style="display: none; max-width: 100px; max-height: 100px; margin-top: 10px; border-radius: 5px; cursor: pointer;"
                                     onclick="zoomImage(this)" title="Click to zoom">
                            </div>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Full Name:*</label>
                                <input type="text" id="fullName" name="fullName" required
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Email:*</label>
                                <input type="email" id="email" name="email" required
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Phone:</label>
                                <input type="tel" id="phone" name="phone"
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Gender:*</label>
                                <select id="gender" name="gender" required
                                        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                                    <input type="checkbox" id="sendConfirmationEmail" name="sendConfirmationEmail">
                                    <span style="font-weight: bold;">Send Confirmation Email</span>
                                </label>
                                <div style="font-size: 12px; color: #666; margin-left: 25px;">
                                    When checked, an email will be sent to the employee's address to confirm their registration.
                                </div>
                            </div>

                        </div>

                        <div class="form-section" style="margin-bottom: 10px;">
                            <h3 style="color: #34495e; margin-bottom: 15px;">Employment Information</h3>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Status:*</label>
                                <select id="employeeStatus" name="status" required
                                        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                    <option value="Terminated">Terminated</option>
                                </select>
                            </div>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Role:*</label>
                                <input type="text" id="role" name="role" required
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"
                                       placeholder="e.g., Delivery Driver, Manager">
                            </div>

                        </div>

                        <div class="form-section" style="margin-bottom: 10px;">
                            <h3 style="color: #34495e; margin-bottom: 15px;">Dates</h3>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Hire Date:*</label>
                                <input type="date" id="hireDate" name="hireDate" required
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Rehire Date:</label>
                                <input type="date" id="rehireDate" name="rehireDate"
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Termination Date:</label>
                                <input type="date" id="terminationDate" name="terminationDate"
                                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                        </div>

                        <div class="form-section" style="margin-bottom: 10px;">
                            <h3 style="color: #34495e; margin-bottom: 15px;">Access Configuration</h3>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="loginAllowed" name="loginAllowed">
                                    <span style="font-weight: bold;">Login Allowed</span>
                                </label>
                            </div>

                            <div class="form-group" style="margin-bottom: 15px;">
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="confirmationEmail" name="confirmationEmail">
                                    <span style="font-weight: bold;">Confirmation Email</span>
                                </label>
                            </div>
                        </div>

                        <div class="form-buttons" style="display: flex; gap: 10px;">
                            <button type="submit" id="submitEmployeeBtn" class="btn-submit"
                                    style="background: #27ae60; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                                Add
                            </button>
                            <button type="button" onclick="closeTeamModal()" class="btn-cancel"
                                    style="background: #95a5a6; color: white; padding: 12px 24px; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Employee List -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 style="color: #2c3e50; margin: 0;">Employee List</h3>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <input type="text" id="employeeSearch" placeholder="Search employees..."
                                   onkeyup="searchEmployees()"
                                   style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; width: 250px;"
                                   title="Type to search employees">
                        </div>
                    </div>
                    <div style="overflow-x: auto; max-height: 70vh;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr style="background: #34495e; color: white; position: sticky; top: 0;">
                                    <th style="padding: 10px 5px; text-align: center; font-weight: bold; cursor: pointer;" data-column="image" onclick="sortTable('image')">IMAGE</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold; cursor: pointer;" data-column="fullName" onclick="sortTable('fullName')">FULL NAME</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold; cursor: pointer;" data-column="employeeId" onclick="sortTable('employeeId')">EMPLOYEE ID</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold; cursor: pointer;" data-column="status" onclick="sortTable('status')">STATUS</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold; cursor: pointer;" data-column="email" onclick="sortTable('email')">EMAIL</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold; cursor: pointer;" data-column="phone" onclick="sortTable('phone')">PHONE</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold; cursor: pointer;" data-column="role" onclick="sortTable('role')">ROLE</th>
                                    <th style="padding: 10px 5px; text-align: center; font-weight: bold; cursor: pointer;" data-column="loginAllowed" onclick="sortTable('loginAllowed')">LOGIN</th>
                                    <th style="padding: 10px 5px; text-align: center; font-weight: bold; cursor: pointer;" data-column="confirmationEmail" onclick="sortTable('confirmationEmail')">CONFIRM</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold; cursor: pointer;" data-column="hireDate" onclick="sortTable('hireDate')">HIRE DATE</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold; cursor: pointer;" data-column="rehireDate" onclick="sortTable('rehireDate')">REHIRE DATE</th>
                                    <th style="padding: 10px 5px; text-align: left; font-weight: bold; cursor: pointer;" data-column="terminationDate" onclick="sortTable('terminationDate')">TERMINATION</th>
                                    <th style="padding: 10px 5px; text-align: center; font-weight: bold;">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody id="employeesTable" style="background: white;">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Image Zoom Modal -->
    <div id="imageZoomModal" class="modal" style="display: none; background: rgba(0,0,0,0.9);">
        <div class="modal-content" style="background: transparent; box-shadow: none; max-width: 90%; max-height: 90%;">
            <span class="close" onclick="closeImageZoom()" style="color: white; font-size: 40px; top: 10px; right: 25px;">&times;</span>
            <img id="zoomedImage" src="" style="max-width: 100%; max-height: 100%; display: block; margin: 0 auto;">
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const styles = `
    <style>
    .modal {
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        box-sizing: border-box;
    }

    .modal-content {
        background-color: white;
        padding: 30px;
        border-radius: 10px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        position: relative;
    }

    .close {
        color: #aaa;
        position: absolute;
        right: 20px;
        top: 15px;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
    }

    .close:hover {
        color: #e74c3c;
    }

    .status-badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: bold;
        text-transform: uppercase;
    }

    .status-active {
        background: #d5f4e6;
        color: #27ae60;
    }

    .status-inactive {
        background: #fff3cd;
        color: #856404;
    }

    .status-terminated {
        background: #f8d7da;
        color: #721c24;
    }

    #employeesTable tr {
        border-bottom: 1px solid #ecf0f1;
    }

    #employeesTable tr:hover {
        background-color: #f8f9fa;
    }

    #employeesTable td {
        padding: 8px 5px;
        border-bottom: 1px solid #ecf0f1;
        vertical-align: middle;
    }

    .btn-edit {
        background: #3498db;
        color: white;
        border: none;
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
        margin-right: 5px;
        font-size: 12px;
    }

    .btn-edit:hover {
        background: #2980b9;
    }

    .btn-delete {
        background: #e74c3c;
        color: white;
        border: none;
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    }

    .btn-delete:hover {
        background: #c0392b;
    }

    .btn-import:hover {
        background: #8e44ad;
    }

    .btn-export:hover {
        background: #27ae60;
    }

    .btn-pdf:hover {
        background: #c0392b;
    }

    .btn-submit:hover {
        background: #219653;
    }

    .btn-cancel:hover {
        background: #7f8c8d;
    }

    input:focus, select:focus {
        outline: none;
        border-color: #3498db !important;
    }

    .form-section {
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 5px;
    }

    .form-section:last-of-type {
        border-bottom: none;
    }

    .employee-image-hover {
        transition: transform 0.3s ease;
        cursor: pointer;
    }

    .employee-image-hover:hover {
        transform: scale(2.5);
        z-index: 1000;
        position: relative;
        transform-origin: left center;
        box-shadow: 0 0 20px rgba(0,0,0,0.5);
        border: 2px solid white;
    }

    #employeesTable thead th {
        cursor: pointer;
        user-select: none;
    }

    #employeesTable thead th:hover {
        background: #2c3e50;
    }
    </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);

    // Set initial date format
    resetEmployeeForm();
}

// Image zoom functions
function zoomImage(imgElement) {
    const zoomModal = document.getElementById('imageZoomModal');
    const zoomedImage = document.getElementById('zoomedImage');

    if (zoomModal && zoomedImage) {
        zoomedImage.src = imgElement.src;
        zoomModal.style.display = 'flex';
    }
}

function closeImageZoom() {
    const zoomModal = document.getElementById('imageZoomModal');
    if (zoomModal) {
        zoomModal.style.display = 'none';
    }
}

// Debug function
function debugTeam() {
    const stats = teamManager.getStats();
    console.log('=== TEAM DEBUG ===');
    console.log('Total employees:', stats.total);
    console.log('Next ID:', stats.nextEmployeeId);
    console.log('All employees:', teamManager.getAllEmployees());
}


