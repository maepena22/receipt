import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getDb } from '@/app/utils/database';

export async function POST(request) {
    try {
        const { receiptIds } = await request.json();
        const db = await getDb();

        const receipts = await db.all(`
            SELECT 
                r.id,
                r.employee_id,
                r.receipt_type_id,
                r.image_path,
                r.data,
                r.created_at,
                e.name as employee_name,
                rt.name as receipt_type_name
            FROM receipts r
            LEFT JOIN employees e ON r.employee_id = e.id
            LEFT JOIN receipt_types rt ON r.receipt_type_id = rt.id
            WHERE r.id IN (${receiptIds.join(',')})
            ORDER BY r.created_at DESC
        `);

        // Get all unique data fields from receipts
        const dataFields = new Set();
        receipts.forEach(receipt => {
            const data = JSON.parse(receipt.data || '{}');
            Object.keys(data).forEach(key => dataFields.add(key));
        });

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Receipts');

        // Create columns including base fields and data fields
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Employee', key: 'employee', width: 20 },
            { header: 'Receipt Type', key: 'type', width: 20 },
            { header: 'Image Path', key: 'image', width: 30 },
            { header: 'Date', key: 'date', width: 20 },
            ...Array.from(dataFields).map(field => ({
                header: field.charAt(0).toUpperCase() + field.slice(1),
                key: field,
                width: 20
            }))
        ];

        // Add data rows
        receipts.forEach(receipt => {
            const data = JSON.parse(receipt.data || '{}');
            const rowData = {
                id: receipt.id,
                employee: receipt.employee_name,
                type: receipt.receipt_type_name || receipt.receipt_type_id,
                image: receipt.image_path,
                date: new Date(receipt.created_at).toLocaleString(),
                ...Object.fromEntries(
                    Array.from(dataFields).map(field => [field, data[field] || ''])
                )
            };
            worksheet.addRow(rowData);
        });

        const buffer = await workbook.xlsx.writeBuffer();

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename=receipts.xlsx'
            }
        });
    } catch (error) {
        console.error('Export failed:', error);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}