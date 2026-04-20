import { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, Timestamp, query, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { Briefcase, MapPin, Calendar, Users, Plus, Trash2, X } from 'lucide-react';
import LoadingScreen from '../../components/LoadingScreen';

export default function BiddingEvents() {
    const { user, userProfile } = useAuth();
    const [events, setEvents] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deletingEvent, setDeletingEvent] = useState(null);

    // Form state
    const [form, setForm] = useState({
        name: '',
        location: '',
        date: '',
        assignedEmployees: []
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch employees for dropdown
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('role', '==', 'employee'));
            const userSnap = await getDocs(q);
            const employeeList = [];
            const empMap = {};
            userSnap.forEach(d => {
                const data = d.data();
                employeeList.push({ id: d.id, name: data.name, department: data.department });
                empMap[d.id] = data.name;
            });
            setEmployees(employeeList);

            // Fetch bidding events
            const eventsRef = collection(db, 'biddingEvents');
            const eventsSnap = await getDocs(eventsRef);
            const eventList = [];
            eventsSnap.forEach(d => {
                const data = d.data();
                eventList.push({
                    id: d.id,
                    ...data,
                    dateStr: data.date?.toDate?.()?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) || data.date,
                    employeeNames: (data.assignedEmployees || []).map(id => empMap[id] || 'Unknown').join(', ')
                });
            });
            
            // Sort by date descending
            eventList.sort((a, b) => {
                const da = a.date?.toDate?.() || new Date(0);
                const db = b.date?.toDate?.() || new Date(0);
                return db - da; // most recent first
            });
            setEvents(eventList);
        } catch (error) {
            console.error("Error fetching bidding events:", error);
        }
        setLoading(false);
    };

    const handleCreateEvent = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const localDate = form.date + 'T00:00:00';
            const eventData = {
                name: form.name,
                location: form.location,
                date: Timestamp.fromDate(new Date(localDate)),
                assignedEmployees: form.assignedEmployees,
                createdBy: user.uid,
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'biddingEvents'), eventData);
            
            await addDoc(collection(db, 'auditLogs'), {
                action: 'Create Bidding Event',
                userId: user.uid,
                targetId: 'Bidding System',
                details: `${userProfile?.name} created bidding event: ${form.name}`,
                timestamp: serverTimestamp()
            });

            setForm({ name: '', location: '', date: '', assignedEmployees: [] });
            setShowModal(false);
            fetchData();
        } catch (error) {
            console.error("Error creating event:", error);
        }
        setSubmitting(false);
    };

    const handleDeleteEvent = async () => {
        if (!deletingEvent) return;
        const { id, name } = deletingEvent;
        try {
            await deleteDoc(doc(db, 'biddingEvents', id));
            await addDoc(collection(db, 'auditLogs'), {
                action: 'Delete Bidding Event',
                userId: user.uid,
                targetId: id,
                details: `${userProfile?.name} deleted bidding event: ${name}`,
                timestamp: serverTimestamp()
            });
            setDeletingEvent(null);
            fetchData();
        } catch (error) {
            console.error("Error deleting event:", error);
        }
    };

    const handleEmployeeToggle = (empId) => {
        setForm(prev => {
            const isSelected = prev.assignedEmployees.includes(empId);
            if (isSelected) {
                return { ...prev, assignedEmployees: prev.assignedEmployees.filter(id => id !== empId) };
            } else {
                return { ...prev, assignedEmployees: [...prev.assignedEmployees, empId] };
            }
        });
    };

    if (loading) return <LoadingScreen message="Loading Bidding Events..." />;

    return (
        <div>
            <div className="section-header">
                <div>
                    <h1 className="page-title"><Briefcase size={28} /> Bidding Events</h1>
                    <p className="page-subtitle">Schedule and assign employees to bidding operations</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    <Plus size={16} /> New Bidding Event
                </button>
            </div>

            <div className="content-card">
                <div className="card-body-flush">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Event Name</th>
                                <th>Location</th>
                                <th>Schedule Date</th>
                                <th>Assigned Employees</th>
                                <th style={{ width: 80 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <div className="empty-state">
                                            <p>No bidding events scheduled.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                events.map(event => (
                                    <tr key={event.id}>
                                        <td style={{ fontWeight: 600 }}>{event.name}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <MapPin size={14} style={{ color: 'var(--gray-400)' }} />
                                                {event.location}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Calendar size={14} style={{ color: 'var(--gray-400)' }} />
                                                {event.dateStr}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Users size={14} style={{ color: 'var(--gray-400)' }} />
                                                <span className="badge badge-info">{event.assignedEmployees?.length || 0}</span>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: 4 }}>
                                                {event.employeeNames || 'None'}
                                            </div>
                                        </td>
                                        <td>
                                            <button 
                                                className="btn btn-sm btn-danger" 
                                                onClick={() => setDeletingEvent({ id: event.id, name: event.name })}
                                                title="Delete"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Event Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                    <div style={{
                        backgroundColor: 'white', borderRadius: 12, padding: 24,
                        width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Briefcase size={20} /> Create Bidding Event
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateEvent}>
                            <div className="form-group full-width">
                                <label>Event Name</label>
                                <input 
                                    className="form-input" 
                                    required 
                                    placeholder="e.g. Q3 Procurement Bid"
                                    value={form.name} 
                                    onChange={e => setForm({...form, name: e.target.value})} 
                                />
                            </div>
                            
                            <div className="form-group full-width">
                                <label>Location</label>
                                <input 
                                    className="form-input" 
                                    required 
                                    placeholder="e.g. City Hall"
                                    value={form.location} 
                                    onChange={e => setForm({...form, location: e.target.value})} 
                                />
                            </div>

                            <div className="form-group full-width">
                                <label>Date</label>
                                <input 
                                    type="date" 
                                    className="form-input" 
                                    required 
                                    min={new Date().toISOString().split('T')[0]}
                                    value={form.date} 
                                    onChange={e => setForm({...form, date: e.target.value})} 
                                />
                            </div>

                            <div className="form-group full-width">
                                <label>Assign Employees</label>
                                <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, maxHeight: 200, overflowY: 'auto' }}>
                                    {employees.map(emp => (
                                        <label key={emp.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={form.assignedEmployees.includes(emp.id)}
                                                onChange={() => handleEmployeeToggle(emp.id)}
                                                style={{ marginRight: 12, accentColor: 'var(--primary-600)' }}
                                            />
                                            <span style={{ fontWeight: 500 }}>{emp.name}</span>
                                            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--gray-500)' }}>{emp.department}</span>
                                        </label>
                                    ))}
                                    {employees.length === 0 && <div style={{ padding: 12, color: 'var(--gray-500)', fontSize: 14 }}>No employees found.</div>}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting || form.assignedEmployees.length === 0}>
                                    {submitting ? 'Creating...' : 'Create Event'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {deletingEvent && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                    <div style={{
                        backgroundColor: '#ffffff', borderRadius: '12px', width: '90%', maxWidth: '400px',
                        padding: '24px', boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
                    }}>
                        <h2 style={{ marginTop: 0, color: '#1f2937', fontSize: '1.25rem' }}>Delete Bidding Event</h2>
                        <p style={{ color: '#4b5563', margin: '16px 0 4px' }}>
                            Are you sure you want to delete:
                        </p>
                        <p style={{ color: '#111827', fontWeight: 600, margin: '0 0 24px' }}>&#x22;{deletingEvent.name}&#x22;</p>
                        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 24px' }}>This action cannot be undone.</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button className="btn btn-secondary" onClick={() => setDeletingEvent(null)}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleDeleteEvent}>Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
