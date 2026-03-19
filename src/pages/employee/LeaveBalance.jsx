import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, getDocs, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';
import { CalendarCheck, TreePine, Sprout, Send, Clock, Check, X } from 'lucide-react';
import ReasonModal from '../../components/ReasonModal';
import LoadingScreen from '../../components/LoadingScreen';

export default function LeaveBalance() {
    const { user, userProfile } = useAuth();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    // Detect if the app is being accessed from a home/remote domain
    const [isHome, setIsHome] = useState(false);
    useEffect(() => {
        const hostname = window.location.hostname;
        // Accessing via localhost, 127.0.0.1, or the official work IP is considered "Office"
        const officeIps = ['localhost', '127.0.0.1', '192.168.137.111', '192.168.1.25', '::1'];
        const isOffice = officeIps.includes(hostname);
        setIsHome(!isOffice);
    }, []);
    // Determine which leave types are available based on location
    const allowedLeaveTypes = isHome ? ['sick'] : ['vacation', 'sick', 'personal'];
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ type: '', startDate: '', endDate: '', reason: '' });
    const [selectedReason, setSelectedReason] = useState(null);
    const [formError, setFormError] = useState('');

    // Count weekdays (Mon-Fri) between two date strings
    function countWeekdays(startStr, endStr) {
        if (!startStr || !endStr) return 0;
        let count = 0;
        const cur = new Date(startStr);
        cur.setHours(0, 0, 0, 0);
        const end = new Date(endStr);
        end.setHours(0, 0, 0, 0);
        while (cur <= end) {
            const day = cur.getDay();
            if (day !== 0 && day !== 6) count++;
            cur.setDate(cur.getDate() + 1);
        }
        return count;
    }

    useEffect(() => {
        if (user) fetchRequests();
    }, [user]);

    async function fetchRequests() {
        try {
            const snap = await getDocs(
                query(collection(db, 'leaveRequests'), where('userId', '==', user.uid))
            );
            const list = [];
            snap.forEach(d => {
                const data = d.data();
                list.push({
                    id: d.id,
                    ...data,
                    startDateStr: data.startDate?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || data.startDate,
                    endDateStr: data.endDate?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || data.endDate,
                    createdStr: data.createdAt?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || '—'
                });
            });
            list.sort((a, b) => {
                const ta = a.createdAt?.toDate?.() || new Date(0);
                const tb = b.createdAt?.toDate?.() || new Date(0);
                return tb - ta;
            });
            setRequests(list);
        } catch (err) {
            console.error('Error:', err);
        }
        setLoading(false);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setFormError('');

        // Validate against available balance
        const localStartDate = form.startDate + 'T00:00:00';
        const localEndDate = form.endDate + 'T00:00:00';
        const requestedDays = countWeekdays(localStartDate, localEndDate);
        const available = credits[form.type.toLowerCase()] ?? 0;

        // If home, only sick leave is allowed
        if (isHome && form.type !== 'sick') {
            setFormError('Only sick leave requests are allowed when working from home.');
            return;
        }

        if (requestedDays > available) {
            setFormError(`You only have ${available} day${available !== 1 ? 's' : ''} of ${form.type} leave remaining, but this request covers ${requestedDays} working day${requestedDays !== 1 ? 's' : ''}. Please adjust your dates.`);
            return;
        }
        if (requestedDays === 0) {
            setFormError('The selected date range contains no working days (Monday–Friday). Please choose valid dates.');
            return;
        }

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'leaveRequests'), {
                userId: user.uid,
                type: form.type,
                startDate: Timestamp.fromDate(new Date(localStartDate)),
                endDate: Timestamp.fromDate(new Date(localEndDate)),
                reason: form.reason,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            // Audit log
            await addDoc(collection(db, 'auditLogs'), {
                action: 'Leave request submitted',
                userId: user.uid,
                targetId: user.uid,
                details: `${userProfile?.name} submitted a ${form.type} leave request (${form.startDate} to ${form.endDate})`,
                timestamp: serverTimestamp()
            });

            // Notify admins
            await addDoc(collection(db, 'notifications'), {
                forAdmin: true,
                title: 'New Leave Request',
                message: `${userProfile?.name} has requested ${form.type} leave from ${form.startDate} to ${form.endDate}.`,
                link: '/admin/leave-requests',
                read: false,
                createdAt: serverTimestamp()
            });

            setForm({ type: '', startDate: '', endDate: '', reason: '' });
            setShowForm(false);
            setFormError('');
            fetchRequests();
        } catch (err) {
            console.error('Error submitting:', err);
        }
        setSubmitting(false);
    }

    const credits = userProfile?.leaveCredits || { vacation: 15, sick: 10, personal: 5 };

    if (loading) return <LoadingScreen />;

    return (
        <div>
            <div className="section-header">
                <div>
                    <h1 className="page-title"><CalendarCheck size={28} /> Leave Balance</h1>
                    <p className="page-subtitle">View your leave credits and submit requests</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    <Send size={16} /> {showForm ? 'Cancel' : 'New Request'}
                </button>
            </div>

            <div className="leave-balances">
                <div className="leave-balance-card">
                    <div className="balance-icon"><TreePine size={24} /></div>
                    <div className="leave-balance-value">{credits.vacation}</div>
                    <div className="leave-balance-label">Vacation Leave</div>
                </div>
                <div className="leave-balance-card">
                    <div className="balance-icon"><Sprout size={24} /></div>
                    <div className="leave-balance-value">{credits.sick}</div>
                    <div className="leave-balance-label">Sick Leave</div>
                </div>
                <div className="leave-balance-card">
                    <div className="balance-icon"><CalendarCheck size={24} /></div>
                    <div className="leave-balance-value">{credits.personal}</div>
                    <div className="leave-balance-label">Personal Leave</div>
                </div>
            </div>

            {showForm && (
                <div className="content-card" style={{ marginBottom: 24 }}>
                    <div className="card-header"><h3><Send size={16} /> Submit Leave Request</h3></div>
                    <div className="card-body">
                        <form className="leave-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Leave Type</label>
                                <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} required>
                                    <option value="">Select type</option>
                                    {allowedLeaveTypes.includes('vacation') && <option value="vacation">Vacation ({credits.vacation} remaining)</option>}
                                    {allowedLeaveTypes.includes('sick') && <option value="sick">Sick ({credits.sick} remaining)</option>}
                                    {allowedLeaveTypes.includes('personal') && <option value="personal">Personal ({credits.personal} remaining)</option>}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Start Date</label>
                                <input type="date" min={new Date().toISOString().split('T')[0]} className="form-input" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>End Date</label>
                                <input type="date" min={form.startDate || new Date().toISOString().split('T')[0]} className="form-input" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
                                {form.startDate && form.endDate && (() => {
                                    const days = countWeekdays(form.startDate, form.endDate);
                                    const available = credits[form.type?.toLowerCase()] ?? 0;
                                    const overLimit = form.type && days > available;
                                    return (
                                        <span style={{ fontSize: 12, color: overLimit ? 'var(--danger)' : 'var(--green-600)', fontWeight: 500, marginTop: 4 }}>
                                            {days} working day{days !== 1 ? 's' : ''} requested
                                            {form.type && ` · ${available} available`}
                                            {overLimit && ' ⚠ Exceeds balance'}
                                        </span>
                                    );
                                })()}
                            </div>
                            <div className="form-group full-width">
                                <label>Reason</label>
                                <textarea className="form-input" rows={3} placeholder="Brief reason for leave..." value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} style={{ resize: 'vertical' }} />
                            </div>
                            {formError && (
                                <div className="form-group full-width">
                                    <div className="auth-error">
                                        <X size={16} />
                                        {formError}
                                    </div>
                                </div>
                            )}
                            <div className="form-group full-width">
                                <button type="submit" className="btn btn-primary" disabled={submitting || !!formError}>
                                    <Send size={16} /> {submitting ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="content-card">
                <div className="card-header">
                    <h3><Clock size={16} /> My Leave Requests</h3>
                </div>
                <div className="card-body-flush">
                    <table className="data-table">
                        <thead>
                            <tr><th>Type</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th>Submitted</th></tr>
                        </thead>
                        <tbody>
                            {requests.length === 0 ? (
                                <tr><td colSpan={6}><div className="empty-state"><p>No leave requests submitted</p></div></td></tr>
                            ) : requests.map(r => (
                                <tr key={r.id}>
                                    <td><span className="badge badge-info">{r.type}</span></td>
                                    <td>{r.startDateStr}</td>
                                    <td>{r.endDateStr}</td>
                                    <td
                                        style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: r.reason ? 'pointer' : 'default', textDecoration: r.reason ? 'underline' : 'none', color: r.reason ? 'var(--primary-600)' : 'inherit' }}
                                        onClick={() => r.reason && setSelectedReason(r.reason)}
                                        title={r.reason ? "Click to read full reason" : ""}
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
                                    <td>{r.createdStr}</td>
                                </tr>
                            ))}
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
