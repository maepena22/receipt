'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ReceiptTypes() {
    const [receiptTypes, setReceiptTypes] = useState([]);
    const [newType, setNewType] = useState({
        name: '',
        description: '',
        fields: [{ name: '', description: '', isRequired: false }]
    });
    const [editingType, setEditingType] = useState(null);
    const [activeTab, setActiveTab] = useState('create'); // 'create' or 'list'

    useEffect(() => {
        fetchReceiptTypes();
    }, []);

    const fetchReceiptTypes = async () => {
        const response = await fetch('/api/receipt-types');
        const data = await response.json();
        setReceiptTypes(data);
    };

    const addField = () => {
        setNewType(prev => ({
            ...prev,
            fields: [...prev.fields, { name: '', description: '', isRequired: false }]
        }));
    };

    const removeField = (index) => {
        setNewType(prev => ({
            ...prev,
            fields: prev.fields.filter((_, i) => i !== index)
        }));
    };

    const updateField = (index, field) => {
        setNewType(prev => ({
            ...prev,
            fields: prev.fields.map((f, i) => i === index ? field : f)
        }));
    };

    const handleEdit = (type) => {
        setEditingType(type);
        setNewType({
            id: type.id,
            name: type.name,
            description: type.description,
            fields: type.fields || []
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newType.name || newType.fields.some(f => !f.name)) return;

        try {
            const response = await fetch('/api/receipt-types', {
                method: editingType ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newType),
            });

            if (response.ok) {
                setNewType({
                    name: '',
                    description: '',
                    fields: [{ name: '', description: '', isRequired: false }]
                });
                setEditingType(null);
                fetchReceiptTypes();
            }
        } catch (error) {
            console.error('Failed to save receipt type:', error);
        }
    };

    const handleDelete = async (typeId) => {
        if (!confirm('Are you sure you want to delete this receipt type?')) {
            return;
        }

        try {
            const response = await fetch(`/api/receipt-types/${typeId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchReceiptTypes();
            } else {
                throw new Error('Failed to delete receipt type');
            }
        } catch (error) {
            console.error('Error deleting receipt type:', error);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4">
            <div className="mb-8">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('create')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'create'
                                    ? 'border-red-500 text-red-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {editingType ? 'Edit Receipt Type' : 'Create New Receipt Type'}
                        </button>
                        <button
                            onClick={() => setActiveTab('list')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === 'list'
                                    ? 'border-red-500 text-red-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            Receipt Types List
                        </button>
                    </nav>
                </div>
            </div>

            {activeTab === 'create' && (
                <div className="bg-white shadow-lg rounded-lg p-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Receipt Type Name *
                                </label>
                                <input
                                    type="text"
                                    value={newType.name}
                                    onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                                    placeholder="e.g., Restaurant Receipt"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={newType.description}
                                    onChange={(e) => setNewType({ ...newType, description: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500"
                                    placeholder="Describe the purpose of this receipt type"
                                    rows="3"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Fields *
                                    </label>
                                    <button
                                        type="button"
                                        onClick={addField}
                                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                    >
                                        <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add Field
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {newType.fields.map((field, index) => (
                                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Field Name *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={field.name}
                                                        onChange={(e) => updateField(index, { ...field, name: e.target.value })}
                                                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                                                        placeholder="e.g., Total Amount"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                                        Field Description
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={field.description}
                                                        onChange={(e) => updateField(index, { ...field, description: e.target.value })}
                                                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                                                        placeholder="e.g., Total amount including tax"
                                                    />
                                                </div>
                            </div>
                                            <div className="flex justify-between items-center mt-3">
                                                <label className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={field.isRequired}
                                                        onChange={(e) => updateField(index, { ...field, isRequired: e.target.checked })}
                                                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                    />
                                                    <span className="text-sm text-gray-600">Required Field</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => removeField(index)}
                                                    className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            {editingType && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingType(null);
                                        setNewType({
                                            name: '',
                                            description: '',
                                            fields: [{ name: '', description: '', isRequired: false }]
                                        });
                                        setActiveTab('list');
                                    }}
                                    className="mr-3 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                type="submit"
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            >
                                {editingType ? 'Update Receipt Type' : 'Create Receipt Type'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {activeTab === 'list' && (
                <div className="grid gap-6">
                    {receiptTypes.map((type) => (
                        <div key={type.id} className="bg-white shadow-lg rounded-lg overflow-hidden">
                            <div className="p-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">{type.name}</h3>
                                        {type.description && (
                                            <p className="mt-1 text-sm text-gray-500">{type.description}</p>
                                        )}
                                    </div>
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => {
                                                handleEdit(type);
                                                setActiveTab('create');
                                            }}
                                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                        >
                                            <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(type.id)}
                                            className="inline-flex items-center px-3 py-1.5 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                        >
                                            <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Delete
                                        </button>
                                    </div>
                                </div>
                                
                                {type.fields && type.fields.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="text-sm font-medium text-gray-900 mb-2">Fields:</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {type.fields.map((field, index) => (
                                                <div key={index} className="bg-gray-50 p-3 rounded-md">
                                                    <div className="flex items-start justify-between">
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900">{field.name}</p>
                                                            {field.description && (
                                                                <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
                                                            )}
                                                        </div>
                                                        {field.isRequired && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                                Required
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}