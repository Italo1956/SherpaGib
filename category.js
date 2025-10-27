// category.js - Gestión de Categorías con Imágenes Locales
class CategoryManager {
    constructor() {
        this.categories = JSON.parse(localStorage.getItem('categories')) || [];
        this.protectedCategories = this.getProtectedCategories();
        this.nextId = this.calculateNextId();
        this.imageStorage = JSON.parse(localStorage.getItem('categoryImages')) || {};
        this.init();
    }

    getProtectedCategories() {
        return [
            'CAT001', 'CAT002', 'CAT003', 'CAT004', 'CAT005',
            'CAT006', 'CAT007', 'CAT008', 'CAT009', 'CAT010',
            'CAT011', 'CAT012', 'CAT013', 'CAT014', 'CAT015', 'CAT016'
        ];
    }

    // Convertir archivo a Base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // Guardar imagen en localStorage
    saveImage(categoryId, imageData) {
        this.imageStorage[categoryId] = imageData;
        localStorage.setItem('categoryImages', JSON.stringify(this.imageStorage));
    }

    // Obtener imagen
    getImage(categoryId) {
        return this.imageStorage[categoryId] || '';
    }

    // Eliminar imagen
    removeImage(categoryId) {
        delete this.imageStorage[categoryId];
        localStorage.setItem('categoryImages', JSON.stringify(this.imageStorage));
    }

    init() {
        if (this.categories.length === 0) {
            this.createProtectedCategories();
        } else {
            this.ensureProtectedCategories();
        }
    }

    createProtectedCategories() {
        const protectedCategories = [
            { id: 'CAT001', name: 'BUCKET HAT' },
            { id: 'CAT002', name: 'BALL CAP' },
            { id: 'CAT003', name: 'BEANIE' },
            { id: 'CAT004', name: 'BACKPACK COOLER' },
            { id: 'CAT005', name: 'THERMOS' },
            { id: 'CAT016', name: "THERMAL BAG" },
            { id: 'CAT006', name: 'VEST' },
            { id: 'CAT007', name: 'RAIN JACKET' },
            { id: 'CAT008', name: "MAN's SHIRT" },
            { id: 'CAT014', name: "MAN'sSHIRT LS" },
            { id: 'CAT009', name: "MAN's SHORT" },
            { id: 'CAT010', name: "MAN's PANT" },
            { id: 'CAT011', name: "WOMAN's SHIRT" },
            { id: 'CAT015', name: "WOMAN'sSHIRT LS" },
            { id: 'CAT012', name: "WOMAN's SHORT" },
            { id: 'CAT013', name: "WOMAN's PANT" }     
        ];

        this.categories = protectedCategories;
        this.nextId = this.calculateNextId();
        this.saveToLocalStorage();
    }

    ensureProtectedCategories() {
        const protectedCategories = [
            { id: 'CAT001', name: 'BUCKET HAT' },
            { id: 'CAT002', name: 'BALL CAP' },
            { id: 'CAT003', name: 'BEANIE' },
            { id: 'CAT004', name: 'BACKPACK COOLER' },
            { id: 'CAT005', name: 'THERMOS' },
            { id: 'CAT016', name: "THERMAL BAG" },
            { id: 'CAT006', name: 'VEST' },
            { id: 'CAT007', name: 'RAIN JACKET' },
            { id: 'CAT008', name: "MAN's SHIRT" },
            { id: 'CAT014', name: "MAN'sSHIRT LS" },
            { id: 'CAT009', name: "MAN's SHORT" },
            { id: 'CAT010', name: "MAN's PANT" },
            { id: 'CAT011', name: "WOMAN's SHIRT" },
            { id: 'CAT015', name: "WOMAN'sSHIRT LS" },
            { id: 'CAT012', name: "WOMAN's SHORT" },
            { id: 'CAT013', name: "WOMAN's PANT" }  
        ];

        let needsUpdate = false;

        protectedCategories.forEach(protectedCat => {
            const existingCat = this.categories.find(cat => cat.id === protectedCat.id);
            if (!existingCat) {
                this.categories.push(protectedCat);
                needsUpdate = true;
            } else if (existingCat.name !== protectedCat.name) {
                existingCat.name = protectedCat.name;
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            this.saveToLocalStorage();
        }
    }

    calculateNextId() {
        if (this.categories.length === 0) return 15;
        
        const ids = this.categories.map(cat => {
            const num = cat.id.replace('CAT', '');
            return parseInt(num) || 0;
        });
        
        const lastId = Math.max(...ids);
        return lastId + 1;
    }

    generateCategoryId() {
        const nextAvailableId = this.calculateNextId();
        const id = `CAT${nextAvailableId.toString().padStart(3, '0')}`;
        this.nextId = nextAvailableId + 1;
        return id;
    }

    isProtected(categoryId) {
        return this.protectedCategories.includes(categoryId);
    }

    addCategory(name, customId = null) {
        if (!name || name.trim() === '') {
            throw new Error('El nombre de la categoría no puede estar vacío');
        }

        if (this.categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
            throw new Error('Ya existe una categoría con ese nombre');
        }

        const id = customId || this.generateCategoryId();
        
        const newCategory = {
            id: id,
            name: name.toUpperCase().trim(),
            protected: false
        };

        this.categories.push(newCategory);
        this.saveToLocalStorage();
        
        return newCategory;
    }

    editCategory(categoryId, newName) {
        if (!newName || newName.trim() === '') {
            throw new Error('El nombre de la categoría no puede estar vacío');
        }

        if (this.isProtected(categoryId)) {
            throw new Error('No se puede modificar una categoría protegida del sistema');
        }

        const categoryIndex = this.categories.findIndex(cat => cat.id === categoryId);
        
        if (categoryIndex === -1) {
            throw new Error('Categoría no encontrada');
        }

        if (this.categories.some(cat => 
            cat.id !== categoryId && cat.name.toLowerCase() === newName.toLowerCase()
        )) {
            throw new Error('Ya existe otra categoría con ese nombre');
        }

        this.categories[categoryIndex].name = newName.toUpperCase().trim();
        this.saveToLocalStorage();
        
        return this.categories[categoryIndex];
    }

    updateCategoryImage(categoryId, imageData) {
        const categoryIndex = this.categories.findIndex(cat => cat.id === categoryId);
        
        if (categoryIndex === -1) {
            throw new Error('Categoría no encontrada');
        }

        this.saveImage(categoryId, imageData);
        return this.categories[categoryIndex];
    }

    removeCategoryImage(categoryId) {
        const categoryIndex = this.categories.findIndex(cat => cat.id === categoryId);
        
        if (categoryIndex === -1) {
            throw new Error('Categoría no encontrada');
        }

        this.removeImage(categoryId);
        return this.categories[categoryIndex];
    }

    deleteCategory(categoryId) {
        if (this.isProtected(categoryId)) {
            throw new Error('No se puede eliminar una categoría protegida del sistema');
        }

        const categoryIndex = this.categories.findIndex(cat => cat.id === categoryId);
        
        if (categoryIndex === -1) {
            throw new Error('Categoría no encontrada');
        }

        // Eliminar también la imagen si existe
        this.removeImage(categoryId);
        
        const deletedCategory = this.categories.splice(categoryIndex, 1)[0];
        
        this.nextId = this.calculateNextId();
        this.saveToLocalStorage();
        
        return deletedCategory;
    }

    getNextAvailableId() {
        return `CAT${this.calculateNextId().toString().padStart(3, '0')}`;
    }

    getAllCategories() {
        return [...this.categories].sort((a, b) => a.id.localeCompare(b.id));
    }

    getProtectedCategoriesList() {
        return this.categories.filter(cat => this.isProtected(cat.id));
    }

    getCustomCategories() {
        return this.categories.filter(cat => !this.isProtected(cat.id));
    }

    getCategoryById(categoryId) {
        return this.categories.find(cat => cat.id === categoryId);
    }

    getCategoryByName(name) {
        return this.categories.find(cat => 
            cat.name.toLowerCase() === name.toLowerCase()
        );
    }

    categoryExists(categoryId) {
        return this.categories.some(cat => cat.id === categoryId);
    }

    getStats() {
        const protectedCats = this.getProtectedCategoriesList();
        const customCats = this.getCustomCategories();
        
        return {
            total: this.categories.length,
            protected: protectedCats.length,
            custom: customCats.length,
            nextAvailableId: this.getNextAvailableId(),
            categories: this.categories
        };
    }

    saveToLocalStorage() {
        localStorage.setItem('categories', JSON.stringify(this.categories));
        localStorage.setItem('nextCategoryId', this.nextId.toString());
    }

    clearCustomCategories() {
        // Eliminar imágenes de categorías personalizadas
        const customCats = this.getCustomCategories();
        customCats.forEach(cat => {
            this.removeImage(cat.id);
        });
        
        this.categories = this.getProtectedCategoriesList();
        this.nextId = this.calculateNextId();
        this.saveToLocalStorage();
    }

    rebuildIdSequence() {
        const protectedCats = this.getProtectedCategoriesList();
        const customCats = this.getCustomCategories();
        
        // Reasignar IDs a categorías personalizadas
        customCats.forEach((category, index) => {
            const newId = `CAT${(15 + index).toString().padStart(3, '0')}`;
            
            // Mover la imagen al nuevo ID si existe
            if (this.imageStorage[category.id]) {
                this.imageStorage[newId] = this.imageStorage[category.id];
                delete this.imageStorage[category.id];
            }
            
            category.id = newId;
        });
        
        this.categories = [...protectedCats, ...customCats];
        this.nextId = this.calculateNextId();
        this.saveToLocalStorage();
        localStorage.setItem('categoryImages', JSON.stringify(this.imageStorage));
    }
}

// Instancia global del gestor de categorías
const categoryManager = new CategoryManager();

// Funciones para uso en la interfaz
function openCategoryModal() {
    document.getElementById('categoryModal').style.display = 'block';
    loadCategoriesTable();
    updateNextIdDisplay();
}

function closeCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
    resetCategoryForm();
}

function resetCategoryForm() {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';
    document.getElementById('formTitle').textContent = 'Add Custom Category';
    document.getElementById('submitBtn').textContent = 'Add';
    document.getElementById('categoryName').focus();
    updateNextIdDisplay();
}

function updateNextIdDisplay() {
    const nextId = categoryManager.getNextAvailableId();
    const displayElement = document.getElementById('nextIdDisplay');
    if (displayElement) {
        displayElement.textContent = `Next available ID: ${nextId}`;
    }
}

function loadCategoriesTable() {
    const tbody = document.getElementById('categoriesTable');
    const categories = categoryManager.getAllCategories();
    
    tbody.innerHTML = '';
    
    categories.forEach(category => {
        const row = document.createElement('tr');
        const isProtected = categoryManager.isProtected(category.id);
        const imageData = categoryManager.getImage(category.id);
        
        row.innerHTML = `
            <td style="font-weight: bold; color: ${isProtected ? '#e74c3c' : '#2c3e50'};">
                ${category.id}
                ${isProtected ? ' 🔒' : ''}
            </td>
            <td>
                <div onclick="openImageUpload('${category.id}')" style="cursor: pointer; display: inline-block; vertical-align: middle; margin-right: 10px;">
                    ${imageData ? 
                        `<img src="${imageData}" alt="${category.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px; border: 2px solid #3498db;">` : 
                        '<div style="width: 50px; height: 50px; background: #ecf0f1; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #7f8c8d; border: 2px dashed #bdc3c7; font-size: 20px;">📷</div>'
                    }
                </div>
                ${category.name}
            </td>
            <td style="text-align: center;">
                ${isProtected ? 
                    '<span style="color: #7f8c8d; font-style: italic;">Protected</span>' : 
                    `<button onclick="editCategory('${category.id}')" class="btn-edit">Editar</button>
                     <button onclick="deleteCategory('${category.id}')" class="btn-delete">Eliminar</button>`
                }
            </td>
        `;
        tbody.appendChild(row);
    });
    
    updateNextIdDisplay();
}

// FUNCIÓN PARA SUBIR IMAGEN LOCAL
function openImageUpload(categoryId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Verificar tamaño (máximo 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    showNotification('❌ La imagen es muy grande. Máximo 2MB', 'error');
                    return;
                }

                // Mostrar carga
                showNotification('⏳ Cargando imagen...', 'success');

                // Convertir a Base64
                const imageData = await categoryManager.fileToBase64(file);
                
                // Guardar imagen
                categoryManager.updateCategoryImage(categoryId, imageData);
                
                showNotification('✅ Imagen agregada correctamente', 'success');
                loadCategoriesTable();
                
            } catch (error) {
                showNotification('❌ Error al cargar la imagen', 'error');
                console.error(error);
            }
        }
    };
    
    input.click();
}

function submitCategoryForm(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const categoryId = document.getElementById('categoryId').value;
    const name = formData.get('categoryName').trim();
    
    try {
        if (categoryId) {
            categoryManager.editCategory(categoryId, name);
            showNotification('✅ Categoría actualizada exitosamente', 'success');
        } else {
            const newCategory = categoryManager.addCategory(name);
            showNotification(`✅ Categoría personalizada agregada: ${newCategory.id} - ${newCategory.name}`, 'success');
        }
        
        loadCategoriesTable();
        resetCategoryForm();
        
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

function editCategory(categoryId) {
    if (categoryManager.isProtected(categoryId)) {
        showNotification('❌ No se puede editar una categoría protegida del sistema', 'error');
        return;
    }

    const category = categoryManager.getCategoryById(categoryId);
    
    if (category) {
        document.getElementById('categoryId').value = category.id;
        document.getElementById('categoryName').value = category.name;
        document.getElementById('formTitle').textContent = 'Editar Categoría Personalizada';
        document.getElementById('submitBtn').textContent = 'Actualizar';
        
        document.getElementById('categoryModal').style.display = 'block';
        document.getElementById('categoryName').focus();
    }
}

function deleteCategory(categoryId) {
    if (categoryManager.isProtected(categoryId)) {
        showNotification('❌ No se puede eliminar una categoría protegida del sistema', 'error');
        return;
    }

    const category = categoryManager.getCategoryById(categoryId);
    
    if (category && confirm(`¿Estás seguro de que deseas eliminar la categoría personalizada:\n${category.id} - ${category.name}?`)) {
        try {
            const deletedCategory = categoryManager.deleteCategory(categoryId);
            showNotification(`🗑️ Categoría eliminada: ${deletedCategory.id} - ${deletedCategory.name}`, 'success');
            loadCategoriesTable();
        } catch (error) {
            showNotification(`❌ ${error.message}`, 'error');
        }
    }
}

function showNotification(message, type) {
    // Remover notificaciones anteriores
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
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
        ${type === 'success' ? 'background: #27ae60;' : 'background: #e74c3c;'}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 4000);
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    if (!document.getElementById('categoryModal')) {
        createCategoryModal();
    }
});

function createCategoryModal() {
    const modalHTML = `
    <div id="categoryModal" class="modal" style="display: none;">
        <div class="modal-content">
            <span class="close" onclick="closeCategoryModal()">&times;</span>
            <h2 id="formTitle" style="color: #2c3e50; margin-bottom: 10px;">Add Custom Category</h2>
            <div id="nextIdDisplay" style="color: #27ae60; font-size: 14px; margin-bottom: 20px; font-weight: bold; background: #f8f9fa; padding: 8px; border-radius: 4px;">
                Next available ID: CAT015
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 10px; margin-bottom: 20px; font-size: 13px;">
                <strong>💡 Information:</strong> Categories CAT001 to CAT016 are protected and cannot be modified or deleted.<br>
                <strong>📷 To add images:</strong> Click on the image box of any category.
            </div>
            
            <form id="categoryForm" onsubmit="submitCategoryForm(event)">
                <input type="hidden" id="categoryId">
                <div class="form-group">
                    <label for="categoryName" style="display: block; margin-bottom: 8px; font-weight: bold; color: #34495e;">
                        Custom Category Name:
                    </label>
                    <input type="text" id="categoryName" name="categoryName" required 
                           style="width: 100%; padding: 10px; border: 2px solid #bdc3c7; border-radius: 5px; font-size: 14px;"
                           placeholder="Example: GLOVES, SUNGLASSES, etc.">
                </div>
                
                <div class="form-buttons" style="display: flex; gap: 10px; margin: 20px 0;">
                    <button type="submit" id="submitBtn" class="btn-submit">
                        Add
                    </button>
                    <button type="button" onclick="closeCategoryModal()" class="btn-cancel">
                        Cancel
                    </button>
                </div>
            </form>
            
            <div class="categories-list" style="margin-top: 30px; border-top: 2px solid #ecf0f1; padding-top: 20px;">
                <h3 style="color: #2c3e50; margin-bottom: 15px;">All Categories</h3>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="background: #34495e; color: white;">
                                <th style="padding: 12px 8px; text-align: left; font-weight: bold;">CODE</th>
                                <th style="padding: 12px 8px; text-align: left; font-weight: bold;">NAME</th>
                                <th style="padding: 12px 8px; text-align: center; font-weight: bold;">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody id="categoriesTable" style="background: white;">
                        </tbody>
                    </table>
                </div>
            </div>
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
    }
    
    .modal-content {
        background-color: white;
        padding: 30px;
        border-radius: 10px;
        width: 90%;
        max-width: 900px;
        max-height: 85vh;
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
    
    #categoriesTable tr {
        border-bottom: 1px solid #ecf0f1;
    }
    
    #categoriesTable tr:hover {
        background-color: #f8f9fa;
    }
    
    #categoriesTable td {
        padding: 12px 8px;
        border-bottom: 1px solid #ecf0f1;
        vertical-align: middle;
    }
    
    .btn-edit {
        background: #3498db;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        margin-right: 5px;
        font-size: 12px;
        font-weight: bold;
    }
    
    .btn-edit:hover {
        background: #2980b9;
    }
    
    .btn-delete {
        background: #e74c3c;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
    }
    
    .btn-delete:hover {
        background: #c0392b;
    }
    
    .btn-submit {
        background: #27ae60;
        color: white;
        padding: 12px 24px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
    }
    
    .btn-submit:hover {
        background: #219653;
    }
    
    .btn-cancel {
        background: #95a5a6;
        color: white;
        padding: 12px 24px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: bold;
    }
    
    .btn-cancel:hover {
        background: #7f8c8d;
    }
    
    input:focus {
        outline: none;
        border-color: #3498db !important;
    }
    </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', styles);
}

// Función para debug
function debugCategories() {
    const stats = categoryManager.getStats();
    console.log('=== DEBUG CATEGORÍAS ===');
    console.log('Total categorías:', stats.total);
    console.log('Categorías protegidas:', stats.protected);
    console.log('Categorías personalizadas:', stats.custom);
    console.log('Próximo ID disponible:', stats.nextAvailableId);
    console.log('Todas las categorías:', categoryManager.getAllCategories());
    console.log('Imágenes almacenadas:', categoryManager.imageStorage);
}