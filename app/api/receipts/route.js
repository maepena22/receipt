import { NextResponse } from 'next/server';
import { getDb } from '@/app/utils/database';

export async function GET() {
    try {
        const db = await getDb();
        
        const receipts = await db.all(`
            SELECT 
                r.id,
                r.employee_id,
                r.receipt_type_id,
                r.image_path,
                r.data,
                r.created_at,
                e.name as employee_name
            FROM receipts r
            LEFT JOIN employees e ON r.employee_id = e.id
            ORDER BY r.created_at DESC
        `);

        console.log('receipts', receipts)
        if (!receipts || !Array.isArray(receipts)) {
            return NextResponse.json([]);
        }

        const formattedReceipts = receipts.map(receipt => {
            let parsedData = {};
            try {
                parsedData = JSON.parse(receipt.data || '{}');
            } catch (e) {
                console.error('Error parsing receipt data:', e);
            }

            return {
                id: receipt.id,
                employeeId: receipt.employee_id,
                employeeName: receipt.employee_name || 'Unknown',
                receiptTypeName: receipt.receipt_type_id || 'Unknown Type',
                imagePath: receipt.image_path,
                fields: parsedData,
                createdAt: new Date(receipt.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };
        });

        return NextResponse.json(formattedReceipts);
    } catch (error) {
        console.error('Failed to fetch receipts:', error);
        return NextResponse.json(
            { error: `Failed to fetch receipts: ${error.message}` },
            { status: 500 }
        );
    }
}