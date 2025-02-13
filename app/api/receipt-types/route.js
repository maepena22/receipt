import { NextResponse } from 'next/server';
import { getAllReceiptTypes, addReceiptType, updateReceiptType } from '@/app/utils/database';

export async function GET() {
    try {
        const types = await getAllReceiptTypes();
        return NextResponse.json(types);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch receipt types' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { name, description, fields } = await request.json();
        const result = await addReceiptType(name, description, fields);
        return NextResponse.json(result);
    } catch (error) {
        console.error('POST receipt type error:', error);
        return NextResponse.json({ error: 'Failed to add receipt type' }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const { id, name, description, fields } = await request.json();
        const result = await updateReceiptType(id, name, description, fields);
        return NextResponse.json(result);
    } catch (error) {
        console.error('PUT receipt type error:', error);
        return NextResponse.json({ error: 'Failed to update receipt type' }, { status: 500 });
    }
}