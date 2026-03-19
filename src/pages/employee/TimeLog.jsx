import { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, getDocs, query, where, Timestamp, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Clock, LogIn, LogOut, Sprout } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';

export default function TimeLog() {
    const { user, userProfile } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [isOnLeave, setIsOnLeave] = useState(false);
    const [todayRecord, setTodayRecord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showConfirmOut, setShowConfirmOut] = useState(false);
    const [isHome, setIsHome] = useState(false);
    const [isWeekend, setIsWeekend] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => {
        const hostname = window.location.hostname;
        // Accessing via localhost, 127.0.0.1, or the official work IP is considered "Office"
        const officeIps = ['localhost', '127.0.0.1', '192.168.137.111', '192.168.1.25', '::1'];
        const isOffice = officeIps.includes(hostname);
        setIsHome(!isOffice);
    }, []);

    useEffect(() => {
        timerRef.current = setInterval(() => setCurrentTime(new Date()), 1000);

        // Check if today is a weekend (0 = Sunday, 6 = Saturday)
        const dayOfWeek = new Date().getDay();
        setIsWeekend(dayOfWeek === 0 || dayOfWeek === 6);

        return () => clearInterval(timerRef.current);
    }, []);

    useEffect(() => {
        if (user) checkTodayStatus();
    }, [user]);

    async function checkTodayStatus() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const snap = await getDocs(
                query(collection(db, 'attendance'),
                    where('userId', '==', user.uid),
                    where('date', '>=', Timestamp.fromDate(today)),
                    where('date', '<', Timestamp.fromDate(tomorrow)))
            );

            if (!snap.empty) {
                const record = snap.docs[0];
                const data = record.data();
                setTodayRecord({ id: record.id, ...data });
                setIsClockedIn(data.timeOut === null);
            }

            // Check if user is on leave today
            const leaveSnap = await getDocs(
                query(collection(db, 'leaveRequests'),
                    where('userId', '==', user.uid),
                    where('status', '==', 'approved')
                )
            );

            let onLeave = false;
            leaveSnap.forEach(d => {
                const data = d.data();
                const start = data.startDate?.toDate?.() || new Date(data.startDate);
                start.setHours(0, 0, 0, 0);
                const end = data.endDate?.toDate?.() || new Date(data.endDate);
                end.setHours(23, 59, 59, 999);
                if (today >= start && today <= end) {
                    onLeave = true;
                }
            });
            setIsOnLeave(onLeave);

        } catch (err) {
            console.error('Error checking status:', err);
        }
        setLoading(false);
    }

    async function handleClockIn() {
        if (isClockedIn || (todayRecord && todayRecord.timeOut)) return;

        setActionLoading(true);
        try {
            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // 1. Strict backend check to prevent duplicate clock-ins
            const existingSnap = await getDocs(
                query(collection(db, 'attendance'),
                    where('userId', '==', user.uid),
                    where('date', '>=', Timestamp.fromDate(today)),
                    where('date', '<', Timestamp.fromDate(tomorrow)))
            );

            if (!existingSnap.empty) {
                alert("You have already recorded attendance for today!");
                setActionLoading(false);
                return;
            }

            // 2. Proceed with clock in
            const docRef = await addDoc(collection(db, 'attendance'), {
                userId: user.uid,
                date: Timestamp.fromDate(today),
                timeIn: Timestamp.fromDate(now),
                timeOut: null,
                totalHours: 0,
                locked: true
            });

            // Audit log
            await addDoc(collection(db, 'auditLogs'), {
                action: 'Time clock-in',
                userId: user.uid,
                targetId: docRef.id,
                details: `${userProfile?.name} clocked in at ${now.toLocaleTimeString()}`,
                timestamp: serverTimestamp()
            });

            setTodayRecord({ id: docRef.id, timeIn: Timestamp.fromDate(now), timeOut: null });
            setIsClockedIn(true);
        } catch (err) {
            console.error('Clock in error:', err);
        }
        setActionLoading(false);
    }

    async function handleClockOut() {
        if (!todayRecord) return;
        setActionLoading(true);
        try {
            const now = new Date();
            const timeIn = todayRecord.timeIn?.toDate?.() || new Date();
            const totalHours = (now - timeIn) / (1000 * 60 * 60);

            await updateDoc(doc(db, 'attendance', todayRecord.id), {
                timeOut: Timestamp.fromDate(now),
                totalHours: Math.round(totalHours * 100) / 100,
                locked: true
            });

            // Audit log
            await addDoc(collection(db, 'auditLogs'), {
                action: 'Time clock-out',
                userId: user.uid,
                targetId: todayRecord.id,
                details: `${userProfile?.name} clocked out at ${now.toLocaleTimeString()} (${totalHours.toFixed(1)}h)`,
                timestamp: serverTimestamp()
            });

            setIsClockedIn(false);
            setTodayRecord({ ...todayRecord, timeOut: Timestamp.fromDate(now), totalHours });
        } catch (err) {
            console.error('Clock out error:', err);
        }
        setActionLoading(false);
    }

    const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    if (loading) {
        return <LoadingScreen />;
    }

    return (
        <div>
            <div className="section-header">
                <div>
                    <h1 className="page-title"><Clock size={28} /> Time Log</h1>
                    <p className="page-subtitle">Record your daily attendance</p>
                </div>
            </div>

            <div className="content-card">
                <div className="clock-display">
                    <div className="clock-time">{timeStr}</div>
                    <div className="clock-date">{dateStr}</div>

                    <div className="clock-actions">
                        <button
                            className="clock-btn clock-in"
                            onClick={handleClockIn}
                            disabled={isClockedIn || todayRecord?.timeOut || actionLoading || isOnLeave || isHome || isWeekend}
                        >
                            <LogIn size={22} />
                            {actionLoading ? 'Processing...' : isOnLeave ? 'On Leave' : isHome ? 'Office Only' : isWeekend ? 'Weekend' : 'Clock In'}
                        </button>
                        <button
                            className="clock-btn clock-out"
                            onClick={() => setShowConfirmOut(true)}
                            disabled={!isClockedIn || actionLoading || isOnLeave || isHome || isWeekend}
                        >
                            <LogOut size={22} />
                            {actionLoading ? 'Processing...' : isOnLeave ? 'On Leave' : isHome ? 'Office Only' : isWeekend ? 'Weekend' : 'Clock Out'}
                        </button>
                    </div>

                    {isHome && (
                        <div style={{ marginTop: '20px', borderTop: '1px solid var(--gray-100)', paddingTop: '16px' }}>
                            <div style={{ color: 'var(--danger)', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                                ⚠ Office Restriction Active
                            </div>
                            <p style={{ color: 'var(--gray-500)', fontSize: '13px', marginBottom: '12px' }}>
                                Clocking in/out is disabled because you are accessing the system remotely.
                            </p>

                            <div style={{
                                backgroundColor: 'var(--gray-50)',
                                padding: '10px',
                                borderRadius: '8px',
                                fontSize: '11px',
                                color: 'var(--gray-600)',
                                border: '1px solid var(--gray-200)',
                                textAlign: 'left',
                                marginBottom: '12px'
                            }}>
                                <strong>System Diagnostics:</strong><br />
                                • Detected Hostname: <code style={{ color: 'var(--primary-700)', fontWeight: 'bold' }}>{window.location.hostname}</code><br />
                                • Connection Type: {window.location.hostname.includes('netlify') ? 'Remote (Netlify)' : 'External/Unknown'}<br />
                                • User ID: {user?.uid?.substring(0, 8)}...
                            </div>

                            {userProfile?.role === 'admin' && (
                                <button
                                    onClick={() => setIsHome(false)}
                                    style={{
                                        fontSize: '11px',
                                        color: 'var(--primary-600)',
                                        background: 'none',
                                        border: '1px dashed var(--primary-300)',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Admin: Temporary Bypass Restriction
                                </button>
                            )}
                        </div>
                    )}

                    {isWeekend && (
                        <div style={{ marginTop: '20px', backgroundColor: '#fffbeb', padding: '12px', borderRadius: '8px', border: '1px solid #fde68a', color: '#b45309', fontSize: '14px', textAlign: 'center' }}>
                            <strong>Weekend:</strong> Attendance recording is disabled on Saturdays and Sundays.
                        </div>
                    )}

                    <div className={`clock-status ${isClockedIn ? '' : 'clocked-out'}`}>
                        <span className={`status-dot ${isClockedIn ? '' : 'inactive'}`}></span>
                        {isWeekend
                            ? "Attendance is not required today."
                            : isOnLeave
                                ? "You are currently on an approved leave."
                                : isClockedIn
                                    ? `Clocked in at ${todayRecord?.timeIn?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                    : todayRecord?.timeOut
                                        ? `Today's shift completed (${todayRecord.totalHours?.toFixed(1)}h)`
                                        : 'Not clocked in yet'}
                    </div>
                </div>
            </div>

            {showConfirmOut && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 9999
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '32px 24px',
                        borderRadius: '16px',
                        maxWidth: '400px',
                        width: '90%',
                        textAlign: 'center',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ width: '48px', height: '48px', backgroundColor: '#fef3c7', color: '#d97706', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <LogOut size={24} />
                        </div>
                        <h3 style={{ marginTop: 0, marginBottom: '8px', color: 'var(--gray-900)', fontSize: '1.25rem' }}>Confirm Clock Out</h3>
                        <p style={{ color: 'var(--gray-500)', marginBottom: '24px', lineHeight: '1.5' }}>Are you sure you want to clock out? You will not be able to clock back in for the rest of the day.</p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1 }}
                                onClick={() => setShowConfirmOut(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 1 }}
                                onClick={() => {
                                    setShowConfirmOut(false);
                                    handleClockOut();
                                }}
                            >
                                Clock Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
