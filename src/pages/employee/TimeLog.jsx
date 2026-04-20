import { useState, useEffect, useRef } from 'react';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { collection, addDoc, getDocs, query, where, Timestamp, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Clock, LogIn, LogOut, Sprout, Briefcase } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';

export default function TimeLog() {
    const { user, userProfile } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isClockedIn, setIsClockedIn] = useState(false);
    const [isOnLeave, setIsOnLeave] = useState(false);
    const [todayRecord, setTodayRecord] = useState(null);
    const [biddingEvent, setBiddingEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [showConfirmOut, setShowConfirmOut] = useState(false);
    const [isWeekend, setIsWeekend] = useState(false);
    const [showLuckAnim, setShowLuckAnim] = useState(false);
    const [luckExiting, setLuckExiting] = useState(false);
    const timerRef = useRef(null);

    // Pre-generate confetti pieces so they don't re-randomize on each render
    const confettiPieces = useRef(
        Array.from({ length: 22 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            color: ['#facc15','#4ade80','#60a5fa','#f472b6','#fb923c','#a78bfa'][i % 6],
            size: 8 + Math.random() * 10,
            duration: 2.2 + Math.random() * 1.8,
            delay: Math.random() * 0.8,
            rotate: Math.random() * 360,
            shape: i % 3 === 0 ? '50%' : '2px',
        }))
    ).current;


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
                const records = snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => (b.timeIn?.toMillis?.() || 0) - (a.timeIn?.toMillis?.() || 0));
                const active = records.find(r => r.timeOut === null);
                const latest = records[0];
                
                setTodayRecord(active || latest);
                setIsClockedIn(!!active);
            } else {
                setTodayRecord(null);
                setIsClockedIn(false);
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

            // Check if user is assigned to a bidding event today
            const biddingSnap = await getDocs(
                query(collection(db, 'biddingEvents'),
                    where('date', '>=', Timestamp.fromDate(today)),
                    where('date', '<', Timestamp.fromDate(tomorrow))
                )
            );

            const userBiddingDoc = biddingSnap.docs.find(doc => doc.data().assignedEmployees?.includes(user.uid));

            if (userBiddingDoc) {
                setBiddingEvent({ id: userBiddingDoc.id, ...userBiddingDoc.data() });
            }

        } catch (err) {
            console.error('Error checking status:', err);
        }
        setLoading(false);
    }

    async function handleClockIn(type = 'regular') {
        if (isClockedIn) return;

        // Show Good Luck animation for bidding start
        if (type === 'bidding') {
            setShowLuckAnim(true);
            setLuckExiting(false);
            
            // After 2.4 s start exit animation
            setTimeout(() => setLuckExiting(true), 2400);
            
            // Pause execution for 2.9s while animation plays
            await new Promise(resolve => setTimeout(resolve, 2900));
            
            setShowLuckAnim(false);
            setLuckExiting(false);
        } // end bidding anim check

        setActionLoading(true);
        try {
            const now = new Date();
            const today = new Date(now);
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Fetch active records to strictly prevent colliding parallel sessions
            const existingSnap = await getDocs(
                query(collection(db, 'attendance'),
                    where('userId', '==', user.uid),
                    where('date', '>=', Timestamp.fromDate(today)),
                    where('date', '<', Timestamp.fromDate(tomorrow)))
            );

            const hasActive = existingSnap.docs.some(doc => doc.data().timeOut === null);
            if (hasActive) {
                alert("You currently have an active session! Please sign out of it first.");
                setActionLoading(false);
                return;
            }

            // Proceed with clock in
            const docRef = await addDoc(collection(db, 'attendance'), {
                userId: user.uid,
                date: Timestamp.fromDate(today),
                timeIn: Timestamp.fromDate(now),
                timeOut: null,
                totalHours: 0,
                locked: true,
                type: type,
                biddingEventId: type === 'bidding' && biddingEvent ? biddingEvent.id : null
            });

            // Audit log
            await addDoc(collection(db, 'auditLogs'), {
                action: biddingEvent ? 'Bidding clock-in' : 'Time clock-in',
                userId: user.uid,
                targetId: docRef.id,
                details: `${userProfile?.name} ${biddingEvent ? 'started bidding' : 'clocked in'} at ${now.toLocaleTimeString()}`,
                timestamp: serverTimestamp()
            });

            setTodayRecord({ id: docRef.id, timeIn: Timestamp.fromDate(now), timeOut: null, type });
            setIsClockedIn(true);
            await checkTodayStatus(); // Refresh from DB to ensure state is accurate
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
            const isBiddingOut = todayRecord.type === 'bidding';
            await addDoc(collection(db, 'auditLogs'), {
                action: isBiddingOut ? 'Bidding clock-out' : 'Time clock-out',
                userId: user.uid,
                targetId: todayRecord.id,
                details: `${userProfile?.name} ${isBiddingOut ? 'ended bidding' : 'clocked out'} at ${now.toLocaleTimeString()} (${totalHours.toFixed(1)}h)`,
                timestamp: serverTimestamp()
            });

            setIsClockedIn(false);
            setTodayRecord({ ...todayRecord, timeOut: Timestamp.fromDate(now), totalHours });
            await checkTodayStatus(); // Refresh from DB to ensure state is accurate
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
                    <p className="page-subtitle">Record your daily attendance shifts</p>
                </div>
            </div>

            <div className="content-card">
                <div className="clock-display">
                    <div className="clock-time">{timeStr}</div>
                    <div className="clock-date">{dateStr}</div>

                    <div className="clock-actions" style={{ flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                        {/* Regular Office Log */}
                        {(() => {
                            const isInBidding = isClockedIn && (todayRecord?.type === 'bidding');
                            return (
                                <div style={{ display: 'flex', gap: '10px', opacity: isInBidding ? 0.4 : 1, pointerEvents: isInBidding ? 'none' : 'auto', width: '100%', maxWidth: '300px' }}>
                                    <button
                                        className="clock-btn clock-in"
                                        onClick={() => handleClockIn('regular')}
                                        disabled={isClockedIn || actionLoading || isOnLeave || isWeekend}
                                        style={{ flex: 1, padding: '12px' }}
                                    >
                                        <LogIn size={20} />
                                        {actionLoading ? 'Processing...' : isOnLeave ? 'On Leave' : isWeekend ? 'Weekend' : 'Clock In'}
                                    </button>
                                    <button
                                        className="clock-btn clock-out"
                                        onClick={() => setShowConfirmOut(true)}
                                        disabled={!isClockedIn || (todayRecord?.type || 'regular') !== 'regular' || actionLoading || isOnLeave || isWeekend}
                                        style={{ flex: 1, padding: '12px' }}
                                    >
                                        <LogOut size={20} />
                                        {actionLoading ? 'Processing...' : isOnLeave ? 'On Leave' : isWeekend ? 'Weekend' : 'Clock Out'}
                                    </button>
                                </div>
                            );
                        })()}

                        {/* Bidding Log Panel */}
                        {biddingEvent && (() => {
                            const isInRegular = isClockedIn && (todayRecord?.type !== 'bidding');
                            return (
                                <div style={{ display: 'flex', gap: '10px', paddingTop: '28px', borderTop: '1px dashed var(--gray-200)', opacity: isInRegular ? 0.4 : 1, pointerEvents: isInRegular ? 'none' : 'auto', width: '100%', maxWidth: '300px', flexDirection: 'row', flexWrap: 'wrap', position: 'relative' }}>
                                    <div style={{ position: 'absolute', top: '6px', left: '0', fontSize: '12px', color: 'var(--primary-600)', fontWeight: 700, width: '100%', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        📋 Bidding: {biddingEvent.name}
                                    </div>
                                    <button
                                        className="clock-btn clock-in"
                                        onClick={() => handleClockIn('bidding')}
                                        style={{ backgroundColor: 'var(--primary-600)', flex: 1, padding: '12px' }}
                                        disabled={isClockedIn || actionLoading || isOnLeave || isWeekend}
                                    >
                                        <Briefcase size={20} />
                                        Start Bidding
                                    </button>
                                    <button
                                        className="clock-btn clock-out"
                                        onClick={() => setShowConfirmOut(true)}
                                        disabled={!isClockedIn || todayRecord?.type !== 'bidding' || actionLoading || isOnLeave || isWeekend}
                                        style={{ flex: 1, padding: '12px' }}
                                    >
                                        <LogOut size={20} />
                                        End Bidding
                                    </button>
                                </div>
                            );
                        })()}
                    </div>

                    {isWeekend && (
                        <div style={{ marginTop: '20px', backgroundColor: '#fffbeb', padding: '12px', borderRadius: '8px', border: '1px solid #fde68a', color: '#b45309', fontSize: '14px', textAlign: 'center' }}>
                            <strong>Weekend:</strong> Attendance recording is disabled on Saturdays and Sundays.
                        </div>
                    )}

                    <div className={`clock-status ${isClockedIn ? '' : 'clocked-out'}`}>
                        {todayRecord?.type === 'bidding' && isClockedIn && <span className="badge badge-info" style={{ marginRight: 8 }}>Bidding Active</span>}
                        <span className={`status-dot ${isClockedIn ? '' : 'inactive'}`}></span>
                        {isWeekend
                            ? "Attendance is not required today."
                            : isOnLeave
                                ? "You are currently on an approved leave."
                                : isClockedIn
                                    ? `${todayRecord?.type === 'bidding' ? 'Bidding started' : 'Clocked in'} at ${todayRecord?.timeIn?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                    : "Currently clocked out. Ready for next shift."}
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
                        <p style={{ color: 'var(--gray-500)', marginBottom: '24px', lineHeight: '1.5' }}>Are you sure you want to end this session? You will be able to start another session if needed.</p>
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

            {/* Good Luck Bidding Overlay */}
            {showLuckAnim && (
                <div className={`luck-overlay${luckExiting ? ' exiting' : ''}`}
                    style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>

                    {/* Confetti */}
                    {confettiPieces.map(p => (
                        <div key={p.id} className="luck-confetti-piece" style={{
                            left: `${p.left}%`,
                            bottom: '-20px',
                            width: p.size,
                            height: p.size,
                            backgroundColor: p.color,
                            borderRadius: p.shape,
                            transform: `rotate(${p.rotate}deg)`,
                            animationDuration: `${p.duration}s`,
                            animationDelay: `${p.delay}s`,
                        }} />
                    ))}

                    <div className="luck-card">
                        <span className="luck-icon">🏆</span>
                        <div className="luck-title">Best of Luck!</div>
                        <p className="luck-subtitle">You're heading out for a bidding assignment.<br />Go show them what you're made of! 💪</p>
                        {biddingEvent && (
                            <p className="luck-event-name">📋 {biddingEvent.name} — {biddingEvent.location}</p>
                        )}
                        <div className="luck-progress-bar">
                            <div className="luck-progress-fill" style={{ animationDuration: '2.4s' }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
