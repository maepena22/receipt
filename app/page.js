'use client';
import { useState, useEffect } from 'react';
import { TagPicker } from 'rsuite';
import "rsuite/dist/rsuite.min.css";

export default function Home() {
    const [selectedReceiptTypes, setSelectedReceiptTypes] = useState([]);
    
    const [uploading, setUploading] = useState(false);
    const [files, setFiles] = useState([]);
    const [message, setMessage] = useState('');
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [progress, setProgress] = useState(0);
    // Remove the old selectedReceiptType state since we're not using it
    const [receiptTypes, setReceiptTypes] = useState([]);

    useEffect(() => {
        // Fetch employees
        fetch('/api/employees')
            .then(res => res.json())
            .then(data => setEmployees(data));
        
        // Fetch receipt types
        fetch('/api/receipt-types')
            .then(res => res.json())
            .then(data => setReceiptTypes(data));
    }, []);

    const handleReceiptTypeChange = (value) => {
        setSelectedReceiptTypes(value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedEmployee) {
            setMessage('Please select an employee');
            return;
        }

        setUploading(true);
        setMessage('');
        setProgress(0);

        const totalFiles = files.length;
        const formData = new FormData();
        files.forEach((file, index) => {
            formData.append('files', file);
            setProgress(Math.round((index + 1) / totalFiles * 30));
        });
        formData.append('employeeId', selectedEmployee);
        formData.append('receiptTypes', JSON.stringify(
            selectedReceiptTypes.length > 0 ? selectedReceiptTypes : receiptTypes.map(type => type.id)
        ));

        try {
            // Upload progress (30% to 60%)
            setProgress(30);
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });

            // Processing progress (60% to 90%)
            setProgress(60);
            const result = await response.json();
            
            if (result.success) {
                // Complete progress (100%)
                setProgress(100);
                setMessage(`Successfully processed ${result.count} business cards. View them in Records.`);
                setFiles([]);
            }
        } catch (error) {
            setMessage('Error processing files. Please try again.');
            setProgress(0);
        } finally {
            setTimeout(() => {
                setUploading(false);
                setProgress(0);
            }, 1500);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-gray-900">Upload Receipts</h1>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Receipt Types (Optional - defaults to all types)
                        </label>
                        <TagPicker
                            data={receiptTypes.map(type => ({
                                label: type.name,
                                value: type.id
                            }))}
                            value={selectedReceiptTypes}
                            onChange={handleReceiptTypeChange}
                            placeholder="Select receipt types (optional)"
                            style={{ width: '100%' }}
                            block
                            className="w-full"
                        />
                    </div>

                    <select
                        value={selectedEmployee}
                        onChange={(e) => setSelectedEmployee(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded"
                        required
                    >
                        <option value="">Select Employee</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>
                                {emp.name}
                            </option>
                        ))}
                    </select>

                    <div className="border-2 border-dashed border-gray-200 p-6 rounded-lg">
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={(e) => setFiles(Array.from(e.target.files))}
                            className="w-full text-gray-700"
                            disabled={uploading}
                        />
                    </div>
                </div>

                {uploading && (
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                            className="bg-red-500 h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={uploading || files.length === 0 || !selectedEmployee}
                    className="w-full bg-red-500 text-white px-6 py-3 rounded-lg font-semibold 
                             hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed
                             flex items-center justify-center space-x-2"
                >
                    {uploading ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Processing...</span>
                        </>
                    ) : (
                        'Process Business Cards'
                    )}
                </button>
            </form>
            {message && (
                <div className={`mt-4 p-4 rounded-lg ${
                    message.includes('Error') 
                        ? 'bg-red-50 text-red-700' 
                        : 'bg-green-50 text-green-700'
                }`}>
                    {message}
                </div>
            )}
        </div>
    );
}