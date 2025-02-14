import { NextResponse } from 'next/server';
import { processUploadedImages } from '@/app/utils/businessCardProcessor';
import { getDb } from '@/app/utils/database';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export const config = {
    api: {
        bodyParser: false,
    },
};

export async function POST(request) {
    const db = await getDb();
    try {
        const formData = await request.formData();
        const uploadedFiles = formData.getAll('files');
        const employeeId = formData.get('employeeId');
        const receiptTypesJson = formData.get('receiptTypes');

        // Get employee data
        const employee = await db.get('SELECT * FROM employees WHERE id = ?', [employeeId]);
        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 400 });
        }

        // Convert uploaded files and save them
        const files = await Promise.all(uploadedFiles.map(async (file) => {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);
            
            const uploadDir = join(process.cwd(), 'public', 'uploads');
            const fileName = `${Date.now()}-${file.name}`;
            const filePath = join(uploadDir, fileName);
            await writeFile(filePath, buffer);

            return {
                originalname: file.name,
                filename: fileName,
                buffer: buffer,
                mimetype: file.type,
                path: `/uploads/${fileName}`,
                employee_id: employeeId,
                employee_name: employee.name  // Add employee name
            };
        }));

        // Parse receipt types and ensure it's an array
        let receiptTypes = [];
        try {
            receiptTypes = JSON.parse(receiptTypesJson);
            if (!Array.isArray(receiptTypes)) {
                throw new Error('Receipt types must be an array');
            }
        } catch (error) {
            return NextResponse.json({ error: 'Invalid receipt types format' }, { status: 400 });
        }

        // Fetch full receipt type data including fields
        const fullReceiptTypes = await Promise.all(
            receiptTypes.map(async (typeId) => {
                const type = await db.get('SELECT * FROM receipt_types WHERE id = ?', [typeId]);
                if (!type) return null;
                
                const fields = await db.all(
                    'SELECT field_name as name, field_description as description, is_required as isRequired FROM receipt_fields WHERE receipt_type_id = ?',
                    [typeId]
                );
                return { ...type, fields };
            })
        );

        // Filter out any null values from invalid IDs
        const validReceiptTypes = fullReceiptTypes.filter(Boolean);

        if (validReceiptTypes.length === 0) {
            return NextResponse.json({ error: 'No valid receipt types found' }, { status: 400 });
        }

        const result = await processUploadedImages(
            files,
            process.env.GOOGLE_VISION_API_KEY,
            process.env.OPENAI_API_KEY,
            employeeId,
            validReceiptTypes,
            employee.name  // Pass employee name to processor
        );

        return NextResponse.json(result);
    } catch (error) {
        console.error('Upload process failed', error);
        return NextResponse.json({ error: 'Upload process failed' }, { status: 500 });
    } finally {
        await db.close();
    }
}