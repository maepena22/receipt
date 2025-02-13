'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function Records() {
    const [receipts, setReceipts] = useState([]);
    const [selectedReceipts, setSelectedReceipts] = useState([]);
    const [selectAll, setSelectAll] = useState(false);

    useEffect(() => {
        fetch('/api/receipts')
            .then(res => res.json())
            .then(data => setReceipts(data));
    }, []);

    const handleSelectAll = (e) => {
        setSelectAll(e.target.checked);
        setSelectedReceipts(e.target.checked ? receipts.map(receipt => receipt.id) : []);
    };

    const handleSelectReceipt = (id) => {
        setSelectedReceipts(prev => 
            prev.includes(id) 
                ? prev.filter(receiptId => receiptId !== id)
                : [...prev, id]
        );
    };

    const handleExport = async () => {
        if (selectedReceipts.length === 0) {
            alert('Please select at least one receipt to export');
            return;
        }

        const response = await fetch('/api/export-receipts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ receiptIds: selectedReceipts }),
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'selected_receipts.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
        }
    };

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Receipt Records</h1>
                <div className="space-x-4">
                    <Link href="/" className="text-red-500 hover:text-red-700">
                        ← Back to Upload
                    </Link>
                    <button
                        onClick={handleExport}
                        disabled={selectedReceipts.length === 0}
                        className="bg-red-500 text-white px-4 py-2 rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        Export Selected
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="p-3 border">
                                <input
                                    type="checkbox"
                                    checked={selectAll}
                                    onChange={handleSelectAll}
                                    className="rounded border-gray-300"
                                />
                            </th>
                            <th className="p-3 border">Image</th>
                            <th className="p-3 border">Receipt Type</th>
                            <th className="p-3 border">Employee</th>
                            <th className="p-3 border">Data</th>
                            <th className="p-3 border">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {receipts.map((receipt) => (
                            <tr key={receipt.id} className="hover:bg-gray-50">
                                <td className="p-3 border">
                                    <input
                                        type="checkbox"
                                        checked={selectedReceipts.includes(receipt.id)}
                                        onChange={() => handleSelectReceipt(receipt.id)}
                                        className="rounded border-gray-300"
                                    />
                                </td>
                                <td className="p-3 border">
                                    <img
                                        src={`/uploads/${receipt.imagePath}`}
                                        alt="Receipt"
                                        className="w-32 h-20 object-cover"
                                    />
                                </td>
                                <td className="p-3 border">{receipt.receiptTypeName}</td>
                               
                                <td className="p-3 border">{receipt.employeeName}</td>
                                <td className="p-3 border">
                                    {Object.entries(receipt.fields).map(([key, value]) => (
                                        <div key={key} className="mb-1">
                                            <span className="font-medium">{key}:</span> {value}
                                        </div>
                                    ))}
                                </td>
                                <td className="p-3 border">
                                    {receipt.createdAt}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}