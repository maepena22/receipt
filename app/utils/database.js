const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const dbPath = path.join(process.cwd(), 'businesscards.sqlite');

async function getDb() {
    return open({
        filename: dbPath,
        driver: sqlite3.Database
    });
}

async function initializeDb() {
    const db = await getDb();
    
    await db.exec(`
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS receipt_types (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS receipt_fields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            receipt_type_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            field_description TEXT,
            is_required BOOLEAN DEFAULT false,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (receipt_type_id) REFERENCES receipt_types(id)
        );

        CREATE TABLE IF NOT EXISTS receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_path TEXT NOT NULL,
            receipt_type_id INTEGER NOT NULL,
            data JSON,
            employee_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (receipt_type_id) REFERENCES receipt_types(id),
            FOREIGN KEY (employee_id) REFERENCES employees(id)
        );
    `);

    await db.close();
}

// Add new functions for receipt type management
async function addReceiptType(name, description, fields) {
    const db = await getDb();
    try {
        await db.run('BEGIN TRANSACTION');
        
        // Insert receipt type
        const typeResult = await db.run(
            'INSERT INTO receipt_types (name, description) VALUES (?, ?)',
            [name, description]
        );
        
        // Insert fields
        for (const field of fields) {
            await db.run(
                'INSERT INTO receipt_fields (receipt_type_id, field_name, field_description, is_required) VALUES (?, ?, ?, ?)',
                [typeResult.lastID, field.name, field.description, field.isRequired]
            );
        }
        
        await db.run('COMMIT');
        return { id: typeResult.lastID };
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    } finally {
        await db.close();
    }
}

async function addReceiptField(receiptTypeId, fieldName, fieldDescription, isRequired) {
    const db = await getDb();
    const result = await db.run(
        'INSERT INTO receipt_fields (receipt_type_id, field_name, field_description, is_required) VALUES (?, ?, ?, ?)',
        [receiptTypeId, fieldName, fieldDescription, isRequired]
    );
    await db.close();
    return result;
}

async function updateReceiptType(id, name, description, fields) {
    const db = await getDb();
    try {
        await db.run('BEGIN TRANSACTION');
        
        // Update receipt type
        await db.run(
            'UPDATE receipt_types SET name = ?, description = ? WHERE id = ?',
            [name, description, id]
        );
        
        // Delete existing fields
        await db.run('DELETE FROM receipt_fields WHERE receipt_type_id = ?', [id]);
        
        // Insert new fields
        for (const field of fields) {
            await db.run(
                'INSERT INTO receipt_fields (receipt_type_id, field_name, field_description, is_required) VALUES (?, ?, ?, ?)',
                [id, field.name, field.description, field.isRequired]
            );
        }
        
        await db.run('COMMIT');
        return { success: true };
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    } finally {
        await db.close();
    }
}

async function getAllReceiptTypes() {
    const db = await getDb();
    try {
        const types = await db.all('SELECT * FROM receipt_types ORDER BY name');
        
        // Fetch fields for each type
        for (const type of types) {
            const fields = await db.all(
                'SELECT field_name as name, field_description as description, is_required as isRequired FROM receipt_fields WHERE receipt_type_id = ?',
                [type.id]
            );
            type.fields = fields;
        }
        
        return types;
    } finally {
        await db.close();
    }
}

async function getReceiptTypeFields(receiptTypeId) {
    const db = await getDb();
    const fields = await db.all(
        'SELECT * FROM receipt_fields WHERE receipt_type_id = ? ORDER BY id',
        [receiptTypeId]
    );
    await db.close();
    return fields;
}

// Add new functions for employee management
async function addEmployee(name) {
    const db = await getDb();
    const result = await db.run('INSERT INTO employees (name) VALUES (?)', [name]);
    await db.close();
    return result;
}

async function getAllEmployees() {
    const db = await getDb();
    const employees = await db.all('SELECT * FROM employees ORDER BY name');
    await db.close();
    return employees;
}

// Remove the first simple deleteEmployee function (around line 59-64)
// and keep only the transactional version

async function deleteEmployee(id) {
    const db = await getDb();
    try {
        await db.run('BEGIN TRANSACTION');
        // Update business cards to remove reference to deleted employee
        await db.run('UPDATE business_cards SET employee_id = NULL WHERE employee_id = ?', [id]);
        // Delete the employee
        await db.run('DELETE FROM employees WHERE id = ?', [id]);
        await db.run('COMMIT');
        return { success: true };
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    } finally {
        await db.close();
    }
}

// Update saveBusinessCard function
async function saveBusinessCard(data) {
    const db = await getDb();
    
    const result = await db.run(`
        INSERT INTO business_cards (
            image_path, organization, department, name, 
            address, telephone, phone, fax, email, website, employee_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        data.Image,
        data.organization,
        data.department,
        data.name,
        data.address,
        data.telephone,
        data.phone,
        data.fax,
        data.email,
        data.website,
        data.employee_id
    ]);

    await db.close();
    return result;
}

async function getAllBusinessCards() {
    const db = await getDb();
    const cards = await db.all(`
        SELECT 
            business_cards.*,
            employees.name as employee_name
        FROM business_cards
        LEFT JOIN employees ON business_cards.employee_id = employees.id
        ORDER BY business_cards.created_at DESC
    `);
    await db.close();
    return cards;
}

// Update the export function
async function processUploadedImages(files, googleApiKey, openaiApiKey) {
    const data = [];
    const headers = {
        'Image': 'Image',
        'organization': 'Organization',
        'department': 'Department',
        'name': 'Name',
        'address': 'Address',
        'telephone': 'Telephone',
        'fax': 'Fax',
        'email': 'Email',
        'website': 'Website',
        'employee_name': 'Uploader'  // Add uploader column
    };
    
    for (const file of files) {
        console.log(`Processing ${file.originalname}...`);

        try {
            const extractedText = await uploadImageAndGetText(file.path, googleApiKey);
            if (!extractedText) {
                console.log(`No text detected in ${file.originalname}`);
                continue;
            }

            const structuredData = await structureBusinessCardDataUsingChatGPT(extractedText, openaiApiKey);

            try {
                const jsonData = JSON.parse(structuredData);
                const rowData = {};
                
                // Map each field explicitly
                rowData['Image'] = file.originalname;
                rowData['organization'] = jsonData.organization || '';
                rowData['department'] = jsonData.department || '';
                rowData['name'] = jsonData.name || '';
                rowData['address'] = jsonData.address || '';
                rowData['telephone'] = jsonData.telephone || '';
                rowData['fax'] = jsonData.fax || '';
                rowData['email'] = jsonData.email || '';
                rowData['website'] = jsonData.website || '';
                
                data.push(rowData);
            } catch (error) {
                console.error(`Invalid JSON format for ${file.originalname}: ${error.message}`);
            }
        } catch (error) {
            console.error(`Error processing ${file.originalname}: ${error.message}`);
        }
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Business Cards');

    if (data.length > 0) {
        // Add headers with proper formatting
        const headerRow = worksheet.addRow(Object.values(headers));
        headerRow.font = { bold: true };
        
        // Add data rows with explicit mapping
        data.forEach(row => {
            const rowValues = Object.keys(headers).map(key => row[key] || '');
            worksheet.addRow(rowValues);
        });

        // Auto-fit columns
        worksheet.columns.forEach(column => {
            column.width = Math.max(
                Math.max(...worksheet.getColumn(column.number).values.map(v => v ? v.toString().length : 0)),
                headers[Object.keys(headers)[column.number - 1]].length
            ) + 2;
        });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

// Add this new function
async function saveReceipt(receiptData) {
    const db = await getDb();
    try {
        await db.run('BEGIN TRANSACTION');
        
        for (const receipt of receiptData) {
            const result = await db.run(
                'INSERT INTO receipts (image_path, receipt_type_id, data, employee_id, created_at) VALUES (?, ?, ?, ?, ?)',
                [
                    receipt.image,
                    receipt.type,
                    JSON.stringify(receipt.fields),
                    receipt.employee_id,
                    receipt.created_at
                ]
            );
        }
        
        await db.run('COMMIT');
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    } finally {
        await db.close();
    }
}

async function deleteReceiptType(id) {
    const db = await getDb();
    try {
        await db.run('BEGIN TRANSACTION');
        
        // First delete all fields associated with this receipt type
        await db.run('DELETE FROM receipt_fields WHERE receipt_type_id = ?', [id]);
        
        // Then delete the receipt type itself
        await db.run('DELETE FROM receipt_types WHERE id = ?', [id]);
        
        await db.run('COMMIT');
        return { success: true };
    } catch (error) {
        await db.run('ROLLBACK');
        throw error;
    } finally {
        await db.close();
    }
}

module.exports = {
    initializeDb,
    addReceiptType,
    addReceiptField,
    updateReceiptType,
    getAllReceiptTypes,
    getReceiptTypeFields,
    deleteReceiptType, // Add the new function to exports
    saveBusinessCard,
    getAllBusinessCards,
    getDb,
    addEmployee,
    getAllEmployees,
    deleteEmployee,
    saveReceipt
};