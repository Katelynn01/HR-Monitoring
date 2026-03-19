import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Shield, Clock, User, FileText } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';

export default function AuditTrail() {
    const [logs, setLogs] = useState([]);
    const [users, setUsers] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchLogs(); }, []);

    async function fetchLogs() {
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const usersMap = {};
            usersSnap.forEach(d => { usersMap[d.id] = d.data(); });
            setUsers(usersMap);

            const snap = await getDocs(collection(db, 'auditLogs'));
            const list = [];
            snap.forEach(d => {
                const data = d.data();
                list.push({
                    id: d.id,
                    ...data,
                    userName: usersMap[data.userId]?.name || 'System',
                    timeStr: data.timestamp?.toDate?.()?.toLocaleString() || '—'
                });
            });
            list.sort((a, b) => {
                const ta = a.timestamp?.toDate?.() || new Date(0);
                const tb = b.timestamp?.toDate?.() || new Date(0);
                return tb - ta;
            });
            setLogs(list);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
        }
        setLoading(false);
    }

    function getActionIcon(action) {
        if (action?.includes('clock') || action?.includes('Time')) return <Clock size={18} />;
        if (action?.includes('Leave') || action?.includes('leave')) return <FileText size={18} />;
        return <User size={18} />;
    }

    if (loading) return <LoadingScreen message="Loading audit trail..." />;

    return (
        <div>
            <div className="section-header">
                <div>
                    <h1 className="page-title"><Shield size={28} /> Audit Trail</h1>
                    <p className="page-subtitle">Complete log of all system actions for transparency</p>
                </div>
                <span className="badge badge-info">{logs.length} events</span>
            </div>

            <div className="content-card">
                {logs.length === 0 ? (
                    <div className="empty-state">
                        <Shield size={48} />
                        <p>No audit logs recorded yet</p>
                    </div>
                ) : (
                    <div className="audit-timeline">
                        {logs.map(log => (
                            <div key={log.id} className="audit-item">
                                <div className="audit-dot">
                                    {getActionIcon(log.action)}
                                </div>
                                <div className="audit-content">
                                    <div className="audit-action">{log.action}</div>
                                    <div className="audit-details">
                                        <strong>{log.userName}</strong> — {log.details || 'No additional details'}
                                    </div>
                                    <div className="audit-time">{log.timeStr}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
