import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, doc, updateDoc, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { CalendarCheck, Check, X, Clock, AlertCircle } from 'lucide-react';
import ReasonModal from '../../components/ReasonModal';
import LoadingScreen from '../../components/LoadingScreen';

export default function LeaveRequests() {
    const [requests, setRequests] = useState([]);
    const [users, setUsers] = useState({});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedReason, setSelectedReason] = useState(null);
    const { user } = useAuth();

    useEffect(() => { fetchRequests(); }, []);

    async function fetchRequests() {
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const usersMap = {};
            usersSnap.forEach(d => { usersMap[d.id] = d.data(); });
            setUsers(usersMap);

            const snap = await getDocs(collection(db, 'leaveRequests'));
            const list = [];
            snap.forEach(d => {
                const data = d.data();
                const emp = usersMap[data.userId];
                if (!emp) return; // skip deleted accounts
                list.push({
                    id: d.id,
                    ...data,
                    employeeName: emp.name,
                    department: emp.department || '—',
                    startDateStr: data.startDate?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || data.startDate,
                    endDateStr: data.endDate?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || data.endDate,
                    createdStr: data.createdAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || '—'
                });
            });
            list.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (b.status === 'pending' && a.status !== 'pending') return 1;
                return 0;
            });
            setRequests(list);
        } catch (err) {
            console.error('Error:', err);
        }
        setLoading(false);
    }

    async function handleAction(requestId, status, req) {
        try {
            // Fetch current request status to prevent double-deduction
            const requestDoc = await getDocs(query(collection(db, 'leaveRequests'), where('__name__', '==', requestId)));
            if (requestDoc.empty) return;
            const currentReq = requestDoc.docs[0].data();

            // If already reviewed and we are trying to approve again, skip deduction logic
            if (currentReq.status !== 'pending' && status === 'approved') {
                console.log('Request already reviewed, skipping deduction');
                return;
            }

            await updateDoc(doc(db, 'leaveRequests', requestId), {
                status,
                reviewedBy: user.uid,
                reviewedAt: serverTimestamp()
            });

            // If approved, deduct leave credits
            if (status === 'approved' && req.userId && req.type) {
                const userRef = doc(db, 'users', req.userId);
                const userSnapshot = await getDocs(query(collection(db, 'users'), where('__name__', '==', req.userId)));

                if (!userSnapshot.empty) {
                    const userData = userSnapshot.docs[0].data();
                    const credits = { ...userData.leaveCredits };
                    const leaveType = req.type.toLowerCase();

                    if (credits[leaveType] !== undefined) {
                        const start = req.startDate?.toDate?.() || new Date(req.startDate);
                        const end = req.endDate?.toDate?.() || new Date(req.endDate);

                        let days = 0;
                        let cDate = new Date(start);
                        cDate.setHours(0, 0, 0, 0);
                        let eDate = new Date(end);
                        eDate.setHours(0, 0, 0, 0);

                        while (cDate <= eDate) {
                            const dayOfWeek = cDate.getDay();
                            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
                                days++;
                            }
                            cDate.setDate(cDate.getDate() + 1);
                        }

                        const oldBalance = credits[leaveType];
                        credits[leaveType] = Math.max(0, credits[leaveType] - days);
                        await updateDoc(userRef, { leaveCredits: credits });

                        // Log the specific deduction
                        await addDoc(collection(db, 'auditLogs'), {
                            action: 'Credits Deducted',
                            userId: user.uid,
                            targetId: req.userId,
                            details: `Deducted ${days} ${leaveType} days from ${userData.name}. Balance: ${oldBalance} -> ${credits[leaveType]}`,
                            timestamp: serverTimestamp()
                        });
                    }
                }
            }

            // Add audit log
            await addDoc(collection(db, 'auditLogs'), {
                action: `Leave request ${status}`,
                userId: user.uid,
                targetId: requestId,
                details: `${status} leave request for ${req.employeeName} (${req.type})`,
                timestamp: serverTimestamp()
            });

            // Notify the employee
            if (req.userId) {
                await addDoc(collection(db, 'notifications'), {
                    userId: req.userId,
                    title: `Leave Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                    message: `Your ${req.type} leave request from ${req.startDateStr} to ${req.endDateStr} was ${status}.`,
                    link: '/employee/leave-balance',
                    read: false,
                    createdAt: serverTimestamp()
                });
            }

            fetchRequests();
        } catch (err) {
            console.error('Error updating request:', err);
        }
    }

    const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

    if (loading) return <LoadingScreen message="Loading requests..." />;

    return (
        <div>
            <div className="section-header">
                <div>
                    <h1 className="page-title"><CalendarCheck size={28} /> Leave Requests</h1>
                    <p className="page-subtitle">Review and manage employee leave requests</p>
                </div>
            </div>

            <div className="filters-bar">
                {['all', 'pending', 'approved', 'rejected'].map(f => (
                    <button
                        key={f}
                        className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter(f)}
                    >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
                <span className="badge badge-info">{filtered.length} requests</span>
            </div>

            <div className="content-card">
                <div className="card-body-flush">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>Department</th>
                                <th>Type</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Reason</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={8}><div className="empty-state"><p>No leave requests</p></div></td></tr>
                            ) : (
                                (() => {
                                    let lastDate = null;
                                    const rows = [];
                                    
                                    // Sort by createdAt descending to ensure date separators work properly
                                    const sortedFiltered = [...filtered].sort((a, b) => {
                                        const timeA = a.createdAt?.toMillis?.() || 0;
                                        const timeB = b.createdAt?.toMillis?.() || 0;
                                        return timeB - timeA;
                                    });

                                    sortedFiltered.forEach(r => {
                                        if (r.createdStr !== lastDate) {
                                            rows.push(
                                                <tr key={`date-${r.createdStr}`} style={{ backgroundColor: '#f9fafb' }}>
                                                    <td colSpan={8} style={{ fontWeight: 600, color: '#374151', padding: '12px 16px', borderTop: '1px solid #e5e7eb' }}>
                                                        {r.createdStr === new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) ? 'Today - ' + r.createdStr : r.createdStr}
                                                    </td>
                                                </tr>
                                            );
                                            lastDate = r.createdStr;
                                        }

                                        rows.push(
                                            <tr 
                                                key={r.id}
                                                onClick={() => r.reason && setSelectedReason(r.reason)}
                                                style={{ cursor: r.reason ? 'pointer' : 'default', transition: 'background-color 0.2s' }}
                                                onMouseEnter={(e) => { if (r.reason) e.currentTarget.style.backgroundColor = '#f0fdf4'; }}
                                                onMouseLeave={(e) => { if (r.reason) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                title={r.reason ? "Click to view full reason" : ""}
                                            >
                                                <td style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{r.employeeName}</td>
                                                <td>{r.department}</td>
                                                <td><span className="badge badge-info">{r.type}</span></td>
                                                <td>{r.startDateStr}</td>
                                                <td>{r.endDateStr}</td>
                                                <td
                                                    style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.reason ? 'var(--primary-600)' : 'inherit' }}
                                                >
                                                    {r.reason || '—'}
                                                </td>
                                                <td>
                                                    <span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>
                                                        {r.status === 'pending' && <Clock size={12} />}
                                                        {r.status === 'approved' && <Check size={12} />}
                                                        {r.status === 'rejected' && <X size={12} />}
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    {r.status === 'pending' ? (
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleAction(r.id, 'approved', r); }}>
                                                                <Check size={14} /> Approve
                                                            </button>
                                                            <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleAction(r.id, 'rejected', r); }}>
                                                                <X size={14} /> Reject
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--gray-400)', fontSize: 13 }}>Reviewed</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    });
                                    return rows;
                                })()
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ReasonModal
                isOpen={!!selectedReason}
                onClose={() => setSelectedReason(null)}
                reason={selectedReason}
            />
        </div>
    );
}
