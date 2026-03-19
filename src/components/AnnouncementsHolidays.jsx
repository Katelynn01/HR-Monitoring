import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
    collection, getDocs, addDoc, deleteDoc, doc,
    serverTimestamp, orderBy, query, where
} from 'firebase/firestore';
import { Megaphone, CalendarDays, Plus, Trash2, X, Check, Bell } from 'lucide-react';

// ── Philippine Holiday Generator ──────────────────────────────────────────
function getEaster(year) {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
}

function lastMondayOf(year, month /* 0-indexed */) {
    const lastDay = new Date(year, month + 1, 0);
    while (lastDay.getDay() !== 1) lastDay.setDate(lastDay.getDate() - 1);
    return lastDay;
}

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function getPHHolidays(year) {
    const easter = getEaster(year);
    const holidays = [
        // ── Regular Public Holidays ──
        { name: "New Year's Day", date: new Date(year, 0, 1), type: 'regular' },
        { name: "Maundy Thursday", date: addDays(easter, -3), type: 'regular' },
        { name: "Good Friday", date: addDays(easter, -2), type: 'regular' },
        { name: "Araw ng Kagitingan", date: new Date(year, 3, 9), type: 'regular' },
        { name: "Labor Day", date: new Date(year, 4, 1), type: 'regular' },
        { name: "Independence Day", date: new Date(year, 5, 12), type: 'regular' },
        { name: "Ninoy Aquino Day", date: new Date(year, 7, 21), type: 'regular' },
        { name: "National Heroes Day", date: lastMondayOf(year, 7), type: 'regular' },
        { name: "All Saints' Day", date: new Date(year, 10, 1), type: 'regular' },
        { name: "Bonifacio Day", date: new Date(year, 10, 30), type: 'regular' },
        { name: "Christmas Day", date: new Date(year, 11, 25), type: 'regular' },
        { name: "Rizal Day", date: new Date(year, 11, 30), type: 'regular' },
        // ── Special Non-Working Days ──
        { name: "Black Saturday", date: addDays(easter, -1), type: 'special' },
        { name: "All Souls' Day", date: new Date(year, 10, 2), type: 'special' },
        { name: "Feast of the Immaculate Conception", date: new Date(year, 11, 8), type: 'special' },
        { name: "Christmas Eve", date: new Date(year, 11, 24), type: 'special' },
        { name: "Last Day of the Year", date: new Date(year, 11, 31), type: 'special' },
        { name: "People Power Revolution Anniversary", date: new Date(year, 1, 25), type: 'special' },
    ];
    return holidays.map(h => {
        h.date.setHours(0, 0, 0, 0);
        return h;
    });
}
// ──────────────────────────────────────────────────────────────────────────

function toDateOnly(d) {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
}

export default function AnnouncementsHolidays({ isAdmin = false }) {
    const [announcements, setAnnouncements] = useState([]);
    const [customHolidays, setCustomHolidays] = useState([]);

    const [showAnnForm, setShowAnnForm] = useState(false);
    const [annTitle, setAnnTitle] = useState('');
    const [annBody, setAnnBody] = useState('');
    const [annDate, setAnnDate] = useState('');   // ← new: optional event date

    const [showHolForm, setShowHolForm] = useState(false);
    const [holName, setHolName] = useState('');
    const [holDate, setHolDate] = useState('');

    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchAll(); }, []);

    async function fetchAll() {
        const [annSnap, holSnap] = await Promise.all([
            getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc'))),
            getDocs(query(collection(db, 'holidays'), orderBy('date', 'asc')))
        ]);

        const annListRaw = annSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const holList = holSnap.docs.map(d => ({ id: d.id, isCustom: true, ...d.data() }));

        // Filter out announcements where eventDate has passed, and actively delete them from the database
        const todayAtMidnight = new Date();
        todayAtMidnight.setHours(0, 0, 0, 0);

        const annList = [];
        for (const a of annListRaw) {
            if (!a.eventDate) {
                annList.push(a);
                continue;
            }
            const evDate = a.eventDate?.toDate ? a.eventDate.toDate() : new Date(a.eventDate);
            if (evDate >= todayAtMidnight) {
                annList.push(a); // Today or future
            } else {
                // Delete the expired announcement from Firestore
                try {
                    await deleteDoc(doc(db, 'announcements', a.id));
                } catch (err) {
                    console.error('Failed to auto-delete expired announcement:', err);
                }
            }
        }

        setAnnouncements(annList);
        setCustomHolidays(holList);

        // After loading, check and send upcoming-event notifications
        await checkUpcomingNotifications(annList, holList);
    }

    // ── Upcoming-event notification logic ────────────────────────────────────
    async function checkUpcomingNotifications(annList, holList) {
        try {
            const today = toDateOnly(new Date());
            const tomorrow = toDateOnly(addDays(today, 1));

            // Fetch all employees
            const empSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'employee')));
            if (empSnap.empty) return;

            // Fetch existing upcoming notifications to prevent duplicates
            const existingSnap = await getDocs(
                query(collection(db, 'notifications'), where('type', '==', 'upcoming_event'))
            );
            const sentKeys = new Set();
            existingSnap.forEach(d => {
                const key = d.data().upcomingKey;
                if (key) sentKeys.add(key);
            });

            const todayStr = today.toISOString().slice(0, 10);
            const notifBatch = [];

            // ── Check holidays (built-in + custom) ──
            const allPH = [...getPHHolidays(today.getFullYear()), ...getPHHolidays(today.getFullYear() + 1)];
            const allHols = [
                ...allPH.map(h => ({ ...h, isCustom: false })),
                ...holList.map(h => ({
                    ...h,
                    date: h.date?.toDate ? h.date.toDate() : new Date(h.date),
                }))
            ];

            for (const hol of allHols) {
                const hDate = toDateOnly(hol.date);
                const isToday = hDate.getTime() === today.getTime();
                const isTomorrow = hDate.getTime() === tomorrow.getTime();
                if (!isToday && !isTomorrow) continue;

                const label = isToday ? 'Today' : 'Tomorrow';
                for (const emp of empSnap.docs) {
                    const key = `holiday_${hol.name}_${todayStr}_${emp.id}`;
                    if (sentKeys.has(key)) continue;
                    notifBatch.push({
                        userId: emp.id,
                        title: `📅 Holiday ${label}: ${hol.name}`,
                        message: `${hol.name} is ${label === 'Today' ? 'today' : 'tomorrow'} (${hol.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}).`,
                        read: false,
                        createdAt: serverTimestamp(),
                        type: 'upcoming_event',
                        upcomingKey: key,
                        link: '/employee/dashboard'
                    });
                }
            }

            // ── Check announcements with eventDate ──
            for (const ann of annList) {
                if (!ann.eventDate) continue;
                const evDate = toDateOnly(ann.eventDate?.toDate ? ann.eventDate.toDate() : new Date(ann.eventDate));
                const isToday = evDate.getTime() === today.getTime();
                const isTomorrow = evDate.getTime() === tomorrow.getTime();
                if (!isToday && !isTomorrow) continue;

                const label = isToday ? 'Today' : 'Tomorrow';
                for (const emp of empSnap.docs) {
                    const key = `ann_${ann.id}_${todayStr}_${emp.id}`;
                    if (sentKeys.has(key)) continue;
                    notifBatch.push({
                        userId: emp.id,
                        title: `📣 Event ${label}: ${ann.title}`,
                        message: `"${ann.title}" is scheduled for ${label === 'Today' ? 'today' : 'tomorrow'} (${evDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}).`,
                        read: false,
                        createdAt: serverTimestamp(),
                        type: 'upcoming_event',
                        upcomingKey: key,
                        link: '/employee/dashboard'
                    });
                }
            }

            // Write all new notifications
            await Promise.all(notifBatch.map(n => addDoc(collection(db, 'notifications'), n)));
        } catch (err) {
            console.error('checkUpcomingNotifications error:', err);
        }
    }
    // ────────────────────────────────────────────────────────────────────────

    async function addAnnouncement() {
        if (!annTitle.trim()) return;
        setSaving(true);

        // Build the document
        const annDoc = {
            title: annTitle.trim(),
            body: annBody.trim(),
            createdAt: serverTimestamp(),
        };
        if (annDate) {
            const evDate = new Date(annDate);
            evDate.setHours(0, 0, 0, 0);
            annDoc.eventDate = evDate;
        }

        // 1. Create the announcement
        await addDoc(collection(db, 'announcements'), annDoc);

        // 2. Fetch all employees to send notifications to
        const employeesSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'employee')));

        // 3. Create a notification for each employee
        const notificationPromises = employeesSnap.docs.map(empDoc =>
            addDoc(collection(db, 'notifications'), {
                userId: empDoc.id,
                title: 'New Announcement',
                message: annTitle.trim(),
                read: false,
                createdAt: serverTimestamp(),
                link: '/employee/dashboard'
            })
        );
        await Promise.all(notificationPromises);

        setAnnTitle(''); setAnnBody(''); setAnnDate(''); setShowAnnForm(false);
        await fetchAll(); setSaving(false);
    }

    async function addHoliday() {
        if (!holName.trim() || !holDate) return;
        setSaving(true);
        const dateObj = new Date(holDate);
        dateObj.setHours(0, 0, 0, 0);
        await addDoc(collection(db, 'holidays'), { name: holName.trim(), date: dateObj, createdAt: serverTimestamp() });
        setHolName(''); setHolDate(''); setShowHolForm(false);
        await fetchAll(); setSaving(false);
    }

    async function deleteAnn(id) {
        await deleteDoc(doc(db, 'announcements', id));
        setAnnouncements(prev => prev.filter(a => a.id !== id));
    }

    async function deleteHol(id) {
        await deleteDoc(doc(db, 'holidays', id));
        setCustomHolidays(prev => prev.filter(h => h.id !== id));
    }

    // ── Merge PH built-in + custom Firestore holidays ──
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();

    const phHolidays = [
        ...getPHHolidays(currentYear),
        ...getPHHolidays(currentYear + 1)
    ].map(h => ({ ...h, isCustom: false }));

    const allHolidays = [
        ...phHolidays,
        ...customHolidays.map(h => ({
            ...h,
            date: h.date?.toDate ? h.date.toDate() : new Date(h.date),
        }))
    ].filter(h => h.date >= today)
     .sort((a, b) => a.date - b.date);

    function formatHolDate(date) {
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    function daysUntil(date) {
        const diff = Math.round((date - today) / (1000 * 60 * 60 * 24));
        if (diff === 0) return 'Today!';
        if (diff === 1) return 'Tomorrow';
        return `In ${diff} days`;
    }

    function formatEventDate(tsOrDate) {
        if (!tsOrDate) return null;
        const d = tsOrDate.toDate ? tsOrDate.toDate() : new Date(tsOrDate);
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>

            {/* ── Announcements ── */}
            <div className="content-card">
                <div className="card-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Megaphone size={18} color="var(--green-600)" /> Announcements
                    </h3>
                    {isAdmin && (
                        <button className="btn btn-primary btn-sm" onClick={() => { setShowAnnForm(f => !f); setShowHolForm(false); }}>
                            <Plus size={14} /> Add
                        </button>
                    )}
                </div>

                {isAdmin && showAnnForm && (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--green-50)' }}>
                        <input
                            className="filter-input"
                            placeholder="Title *"
                            value={annTitle}
                            onChange={e => setAnnTitle(e.target.value)}
                            style={{ width: '100%', marginBottom: 8 }}
                        />
                        <textarea
                            className="filter-input"
                            placeholder="Message (optional)"
                            value={annBody}
                            onChange={e => setAnnBody(e.target.value)}
                            rows={3}
                            style={{ width: '100%', resize: 'vertical', marginBottom: 8, fontFamily: 'inherit' }}
                        />
                        {/* ── Event Date picker ── */}
                        <div style={{ marginBottom: 8 }}>
                            <label style={{ fontSize: 12, color: 'var(--gray-600)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                                <Bell size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                Event / Announcement Date <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}>(optional — employees will be notified 1 day before)</span>
                            </label>
                            <input
                                type="date"
                                className="filter-input"
                                value={annDate}
                                onChange={e => setAnnDate(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setShowAnnForm(false); setAnnDate(''); }}><X size={13} /></button>
                            <button className="btn btn-primary btn-sm" onClick={addAnnouncement} disabled={saving || !annTitle.trim()}>
                                <Check size={13} /> {saving ? 'Saving...' : 'Post'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="card-body" style={{ padding: 0, maxHeight: 320, overflowY: 'auto' }}>
                    {announcements.length === 0 ? (
                        <div className="empty-state" style={{ padding: 32 }}><Megaphone size={32} /><p>No announcements yet</p></div>
                    ) : announcements.map((a, i) => (
                        <div key={a.id} style={{ padding: '12px 16px', borderBottom: i < announcements.length - 1 ? '1px solid var(--border-color)' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-500)', flexShrink: 0, marginTop: 6 }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 14 }}>{a.title}</div>
                                {a.body && <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>{a.body}</div>}

                                {/* Posted date */}
                                {a.createdAt && (
                                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
                                        Posted {a.createdAt.toDate?.().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </div>
                                )}

                                {/* Event date badge */}
                                {a.eventDate && (
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        marginTop: 6, fontSize: 11, fontWeight: 600,
                                        background: 'var(--green-100)', color: 'var(--green-700)',
                                        padding: '2px 8px', borderRadius: 20
                                    }}>
                                        <CalendarDays size={10} />
                                        Event: {formatEventDate(a.eventDate)}
                                    </div>
                                )}
                            </div>
                            {isAdmin && (
                                <button onClick={() => deleteAnn(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 2, flexShrink: 0 }} title="Delete">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Upcoming Holidays ── */}
            <div className="content-card">
                <div className="card-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CalendarDays size={18} color="var(--green-600)" /> Upcoming Holidays
                        <span style={{ fontSize: 11, background: 'var(--green-100)', color: 'var(--green-700)', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>PH</span>
                    </h3>
                    {isAdmin && (
                        <button className="btn btn-primary btn-sm" onClick={() => { setShowHolForm(f => !f); setShowAnnForm(false); }}>
                            <Plus size={14} /> Custom
                        </button>
                    )}
                </div>

                {isAdmin && showHolForm && (
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'var(--green-50)' }}>
                        <input className="filter-input" placeholder="Holiday name *" value={holName} onChange={e => setHolName(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
                        <input type="date" className="filter-input" value={holDate} onChange={e => setHolDate(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowHolForm(false)}><X size={13} /></button>
                            <button className="btn btn-primary btn-sm" onClick={addHoliday} disabled={saving || !holName.trim() || !holDate}>
                                <Check size={13} /> {saving ? 'Saving...' : 'Add'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="card-body" style={{ padding: 0, maxHeight: 380, overflowY: 'auto' }}>
                    {allHolidays.length === 0 ? (
                        <div className="empty-state" style={{ padding: 32 }}><CalendarDays size={32} /><p>No upcoming holidays</p></div>
                    ) : allHolidays.slice(0, 4).map((h, i) => {
                        const badge = daysUntil(h.date);
                        const isToday = badge === 'Today!';
                        const isTomorrow = badge === 'Tomorrow';
                        const isSpecial = h.type === 'special';
                        return (
                            <div key={h.id || `ph-${i}`} style={{ padding: '10px 16px', borderBottom: i < allHolidays.length - 1 ? '1px solid var(--border-color)' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    minWidth: 44, height: 44, borderRadius: 10,
                                    background: isToday ? 'var(--green-500)' : 'var(--green-50)',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: isToday ? '#fff' : 'var(--green-600)', lineHeight: 1 }}>
                                        {h.date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                                    </span>
                                    <span style={{ fontSize: 18, fontWeight: 800, color: isToday ? '#fff' : 'var(--green-700)', lineHeight: 1 }}>
                                        {h.date.getDate()}
                                    </span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, color: 'var(--gray-800)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        {h.name}
                                        {isSpecial && <span style={{ fontSize: 10, background: '#fef9c3', color: '#854d0e', padding: '1px 6px', borderRadius: 10 }}>Special</span>}
                                        {h.isCustom && <span style={{ fontSize: 10, background: '#ede9fe', color: '#5b21b6', padding: '1px 6px', borderRadius: 10 }}>Custom</span>}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{formatHolDate(h.date)}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                    <span className={`badge ${isToday ? 'badge-success' : isTomorrow ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: 11 }}>
                                        {badge}
                                    </span>
                                    {isAdmin && h.isCustom && (
                                        <button onClick={() => deleteHol(h.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: 2 }} title="Delete">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
