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
                    type: data.type || 'regular',
                    date: data.date?.toDate?.() || null,
                    dateStr: data.date?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || '—',
                    timeIn: timeInStr,
                    timeOut: timeOutStr,
                    totalHours: data.totalHours != null ? parseFloat(data.totalHours) : 0
                });
            });

            // Group by Date to consolidate multi-shift days
            const grouped = {};
            list.forEach(r => {
                if (!grouped[r.dateStr]) {
                    grouped[r.dateStr] = {
                        id: r.id,
                        date: r.date,
                        dateStr: r.dateStr,
                        shifts: [r],
                        totalHours: r.totalHours
                    };
                } else {
                    grouped[r.dateStr].shifts.push(r);
                    grouped[r.dateStr].totalHours += r.totalHours;
                }
            });

            const groupedList = Object.values(grouped).map(g => ({
                ...g,
                totalHours: g.totalHours.toFixed(1)
            })).sort((a, b) => (b.date || 0) - (a.date || 0));

            setAttendance(groupedList);
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
                                                <th>Office In</th>
                                                <th>Office Out</th>
                                                <th>Bidding In</th>
                                                <th>Bidding Out</th>
                                                <th>Total Hours</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attendance.map(record => (
                                                <tr key={`modal-${record.id}`}>
                                                    <td style={{ fontWeight: 500 }}>{record.dateStr}</td>
                                                    
                                                    {/* Office In */}
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {record.shifts.filter(s => s.type !== 'bidding').map(s => (
                                                                <span key={`min-${s.id}`} className="badge badge-success" style={{ fontSize: '0.75rem', width: 'fit-content' }}>
                                                                    {s.timeIn}
                                                                </span>
                                                            ))}
                                                            {record.shifts.filter(s => s.type !== 'bidding').length === 0 && <span style={{ color: 'var(--gray-400)' }}>—</span>}
                                                        </div>
                                                    </td>
                                                    
                                                    {/* Office Out */}
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {record.shifts.filter(s => s.type !== 'bidding').map(s => (
                                                                <span key={`mout-${s.id}`} className={`badge ${s.timeOut === 'Active' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '0.75rem', width: 'fit-content' }}>
                                                                    {s.timeOut}
                                                                </span>
                                                            ))}
                                                            {record.shifts.filter(s => s.type !== 'bidding').length === 0 && <span style={{ color: 'var(--gray-400)' }}>—</span>}
                                                        </div>
                                                    </td>

                                                    {/* Bidding In */}
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {record.shifts.filter(s => s.type === 'bidding').map(s => (
                                                                <span key={`mbin-${s.id}`} className="badge badge-success" style={{ fontSize: '0.75rem', width: 'fit-content', backgroundColor: 'var(--blue-100)', color: 'var(--blue-700)' }}>
                                                                    {s.timeIn}
                                                                </span>
                                                            ))}
                                                            {record.shifts.filter(s => s.type === 'bidding').length === 0 && <span style={{ color: 'var(--gray-400)' }}>—</span>}
                                                        </div>
                                                    </td>
                                                    
                                                    {/* Bidding Out */}
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {record.shifts.filter(s => s.type === 'bidding').map(s => (
                                                                <span key={`mbout-${s.id}`} className={`badge ${s.timeOut === 'Active' ? 'badge-warning' : 'badge-neutral'}`} style={{ fontSize: '0.75rem', width: 'fit-content', outline: s.timeOut !== 'Active' ? '1px solid var(--blue-200)' : '' }}>
                                                                    {s.timeOut}
                                                                </span>
                                                            ))}
                                                            {record.shifts.filter(s => s.type === 'bidding').length === 0 && <span style={{ color: 'var(--gray-400)' }}>—</span>}
                                                        </div>
                                                    </td>

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
