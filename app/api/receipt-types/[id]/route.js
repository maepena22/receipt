import { NextResponse } from 'next/server';
import { deleteReceiptType } from '@/app/utils/database';

export async function DELETE(request, context) {
    try {
        const id = context.params.id;
        await deleteReceiptType(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting receipt type:', error);
        return NextResponse.json({ error: 'Failed to delete receipt type' }, { status: 500 });
    }
}