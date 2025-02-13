import { NextResponse } from 'next/server';
import { addReceiptField } from '@/app/utils/database';

export async function POST(request, { params }) {
    try {
        const { id } = params;
        const { fieldName, fieldDescription, isRequired } = await request.json();
        const result = await addReceiptField(id, fieldName, fieldDescription, isRequired);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to add receipt field' }, { status: 500 });
    }
}