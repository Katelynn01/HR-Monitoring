import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Megaphone, X, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * AnnouncementPopup
 * Shows a modal with new announcements for the logged-in employee.
 * "New" = posted after the last dismissed timestamp stored in localStorage.
 */
export default function AnnouncementPopup() {
    const { user } = useAuth();
    const [show, setShow] = useState(false);
    const [announcements, setAnnouncements] = useState([]);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (!user) return;
        fetchNew();
    }, [user]);

    async function fetchNew() {
        try {
            const key = `ann_dismissed_${user.uid}`;
            const lastDismissed = parseInt(localStorage.getItem(key) || '0', 10);

            const snap = await getDocs(
                query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))
            );

            const fresh = [];
            const todayAtMidnight = new Date();
            todayAtMidnight.setHours(0, 0, 0, 0);

            snap.forEach(d => {
                const data = d.data();
                
                // First, verify the eventDate (if any) hasn't passed
                if (data.eventDate) {
                    const evDate = data.eventDate?.toDate ? data.eventDate.toDate() : new Date(data.eventDate);
                    if (evDate < todayAtMidnight) return; // Skip expired announcements
                }

                // Next, check if it's new based on localStorage
                const ts = data.createdAt?.toMillis?.() || 0;
                if (ts > lastDismissed) {
                    fresh.push({ id: d.id, ...data });
                }
            });

            if (fresh.length > 0) {
                setAnnouncements(fresh);
                setIndex(0);
                setShow(true);
            }
        } catch (err) {
            console.error('AnnouncementPopup fetch error:', err);
        }
    }

    function dismiss() {
        const key = `ann_dismissed_${user.uid}`;
        localStorage.setItem(key, Date.now().toString());
        setShow(false);
    }

    if (!show || announcements.length === 0) return null;

    const current = announcements[index];
    const total = announcements.length;

    return (
        <>
            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed', inset: 0,
                    background: 'rgba(0,0,0,0.45)',
                    zIndex: 10000,
                    animation: 'fadeIn 0.2s ease'
                }}
                onClick={dismiss}
            />

            {/* Modal */}
            <div style={{
                position: 'fixed',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 10001,
                width: '90%', maxWidth: 480,
                background: '#fff',
                borderRadius: 16,
                boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
                overflow: 'hidden',
                animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)'
            }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                    padding: '20px 24px',
                    display: 'flex', alignItems: 'center', gap: 12
                }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                    }}>
                        <Megaphone size={20} color="#fff" />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            New Announcement
                        </div>
                        {total > 1 && (
                            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
                                {index + 1} of {total}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={dismiss}
                        style={{
                            background: 'rgba(255,255,255,0.2)', border: 'none',
                            borderRadius: '50%', width: 32, height: 32,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#fff', flexShrink: 0
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px 24px 8px' }}>
                    <h2 style={{
                        margin: '0 0 12px', fontSize: '1.2rem',
                        color: '#111827', fontWeight: 700, lineHeight: 1.3
                    }}>
                        {current.title}
                    </h2>
                    {current.body && (
                        <p style={{
                            margin: 0, fontSize: '0.9rem',
                            color: '#4b5563', lineHeight: 1.6,
                            maxHeight: 160, overflowY: 'auto'
                        }}>
                            {current.body}
                        </p>
                    )}
                    {current.createdAt && (
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 12 }}>
                            Posted {current.createdAt.toDate?.().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                    )}
                    {current.eventDate && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            marginTop: 8, fontSize: 12, fontWeight: 600,
                            background: '#dcfce7', color: '#15803d',
                            padding: '4px 10px', borderRadius: 20
                        }}>
                            <CalendarDays size={14} />
                            Event: {current.eventDate.toDate?.().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || new Date(current.eventDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 24px 20px',
                    display: 'flex', alignItems: 'center',
                    justifyContent: total > 1 ? 'space-between' : 'flex-end',
                    gap: 8
                }}>
                    {total > 1 && (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={() => setIndex(i => Math.max(0, i - 1))}
                                disabled={index === 0}
                                style={{
                                    border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8,
                                    width: 34, height: 34, display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', cursor: index === 0 ? 'not-allowed' : 'pointer',
                                    opacity: index === 0 ? 0.4 : 1
                                }}
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => setIndex(i => Math.min(total - 1, i + 1))}
                                disabled={index === total - 1}
                                style={{
                                    border: '1px solid #e5e7eb', background: '#fff', borderRadius: 8,
                                    width: 34, height: 34, display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', cursor: index === total - 1 ? 'not-allowed' : 'pointer',
                                    opacity: index === total - 1 ? 0.4 : 1
                                }}
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={dismiss}
                        style={{
                            background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                            color: '#fff', border: 'none', borderRadius: 8,
                            padding: '10px 24px', fontWeight: 600,
                            fontSize: '0.9rem', cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
                            transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        Got it!
                    </button>
                </div>

                {/* Dot indicators for multiple */}
                {total > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 16 }}>
                        {announcements.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setIndex(i)}
                                style={{
                                    width: i === index ? 20 : 8, height: 8,
                                    borderRadius: 4, border: 'none',
                                    background: i === index ? '#22c55e' : '#d1d5db',
                                    cursor: 'pointer', transition: 'all 0.3s ease', padding: 0
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes slideUp { from { opacity: 0; transform: translate(-50%, -40%) } to { opacity: 1; transform: translate(-50%, -50%) } }
            `}</style>
        </>
    );
}
