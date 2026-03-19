import { useState, useEffect } from 'react';
import { X, HeartPulse, Phone, Sunrise, Clock } from 'lucide-react';
import { db } from '../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export default function EmployeeHistoryModal({ isOpen, onClose, employee }) {
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && employee) {
            fetchData();
        }
    }, [isOpen, employee]);

    async function fetchData() {
        setLoading(true);
        try {
            // Fetch Attendance
            const attQ = query(collection(db, 'attendance'), where('userId', '==', employee.id));
            const attSnap = await getDocs(attQ);

            const list = [];

            attSnap.forEach(d => {
                const data = d.data();
                
                const timeInStr = data.timeIn?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—';
                const timeOutStr = data.timeOut === 'Active' 
                    ? 'Active' 
                    : data.timeOut?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '—';
                    
                list.push({
                    id: d.id,
                    date: data.date?.toDate?.() || null,
                    dateStr: data.date?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || '—',
                    timeIn: timeInStr,
                    timeOut: timeOutStr,
                    totalHours: data.totalHours != null ? data.totalHours.toFixed(1) : '—'
                });
            });

            list.sort((a, b) => (b.date || 0) - (a.date || 0));
            setAttendance(list);
        } catch (err) {
            console.error('Error fetching history:', err);
        }
        setLoading(false);
    }

    if (!isOpen || !employee) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                border: '4px solid #22c55e',
                borderRadius: '12px',
                width: '95%',
                maxWidth: '700px',
                height: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 24px',
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px 8px 0 0'
                }}>
                    <div>
                        <h2 style={{ color: '#166534', margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{employee.name}</h2>
                        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{employee.department || '—'}</span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#6b7280',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#6b7280' }}>
                            Loading data...
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {/* Attendance History Section */}
                            <div>
                                <h3 style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '8px', color: '#374151', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={18} color="#2563eb" /> Attendance History
                                </h3>
                                {attendance.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#6b7280', padding: '32px 0', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                                        <Clock size={32} style={{ color: '#d1d5db', marginBottom: '8px' }} />
                                        <p style={{ margin: 0 }}>No attendance records found.</p>
                                    </div>
                                ) : (
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Time In</th>
                                                <th>Time Out</th>
                                                <th>Total Hours</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attendance.map(record => (
                                                <tr key={record.id}>
                                                    <td style={{ fontWeight: 500 }}>{record.dateStr}</td>
                                                    <td><span className="badge badge-success">{record.timeIn}</span></td>
                                                    <td><span className={`badge ${record.timeOut === 'Active' ? 'badge-warning' : 'badge-info'}`}>{record.timeOut}</span></td>
                                                    <td style={{ fontWeight: 600 }}>{record.totalHours}h</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
