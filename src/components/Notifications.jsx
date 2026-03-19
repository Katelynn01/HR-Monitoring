import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Bell, Check, Clock, AlertCircle } from 'lucide-react';

export default function Notifications() {
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!user) return;

        let q;
        if (isAdmin) {
            // Admin sees notifications meant for admins
            q = query(
                collection(db, 'notifications'),
                where('forAdmin', '==', true),
                // orderBy('createdAt', 'desc')
            );
        } else {
            // Employee sees notifications meant for them
            q = query(
                collection(db, 'notifications'),
                where('userId', '==', user.uid),
                // orderBy('createdAt', 'desc')
            );
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            let unread = 0;
            snapshot.forEach((doc) => {
                const data = doc.data();
                list.push({ id: doc.id, ...data });
                if (!data.read) unread++;
            });

            // Sort client-side if we haven't added an index yet for orderBy
            list.sort((a, b) => {
                const ta = a.createdAt?.toDate?.() || new Date(0);
                const tb = b.createdAt?.toDate?.() || new Date(0);
                return tb - ta;
            });

            setNotifications(list);
            setUnreadCount(unread);
        });

        return () => unsubscribe();
    }, [user, isAdmin]);

    const handleNotificationClick = async (notification) => {
        if (!notification.read) {
            try {
                await updateDoc(doc(db, 'notifications', notification.id), {
                    read: true
                });
            } catch (error) {
                console.error("Error marking notification as read:", error);
            }
        }

        if (notification.link) {
            setIsOpen(false);
            navigate(notification.link);
        }
    };

    const markAsRead = async (notificationId) => {
        try {
            await updateDoc(doc(db, 'notifications', notificationId), {
                read: true
            });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const unreadNotifs = notifications.filter(n => !n.read);
            const promises = unreadNotifs.map(n =>
                updateDoc(doc(db, 'notifications', n.id), { read: true })
            );
            await Promise.all(promises);
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    };

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate?.() || new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="notifications-container" ref={dropdownRef} style={{ position: 'relative' }}>
            <button className="header-icon-btn" onClick={toggleDropdown}>
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="notification-counter" style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        backgroundColor: 'var(--danger)',
                        color: 'white',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        padding: '2px 5px',
                        borderRadius: '10px',
                        lineHeight: 1,
                        border: '2px solid var(--white)',
                        transform: 'translate(25%, -25%)'
                    }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="notifications-dropdown" style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    width: '320px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    border: '1px solid var(--gray-200)',
                    zIndex: 1000,
                    overflow: 'hidden',
                    marginTop: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '400px'
                }}>
                    <div className="notifications-header" style={{
                        padding: '16px',
                        borderBottom: '1px solid var(--gray-100)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'var(--gray-50)'
                    }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary-600)',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    padding: '4px 8px'
                                }}
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="notifications-list" style={{ overflowY: 'auto', flex: 1 }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--gray-500)' }}>
                                <Bell size={32} style={{ margin: '0 auto 8px', opacity: 0.3, display: 'block' }} />
                                <p style={{ margin: 0, fontSize: '14px' }}>No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`notification-item ${!notification.read ? 'unread' : ''}`}
                                    onClick={() => handleNotificationClick(notification)}
                                    style={{
                                        padding: '16px',
                                        borderBottom: '1px solid var(--gray-100)',
                                        display: 'flex',
                                        gap: '12px',
                                        cursor: 'pointer',
                                        backgroundColor: !notification.read ? 'var(--primary-50)' : 'white',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = !notification.read ? 'var(--primary-100)' : 'var(--gray-50)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = !notification.read ? 'var(--primary-50)' : 'white'}
                                >
                                    <div style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: !notification.read ? 'var(--primary-600)' : 'transparent',
                                        marginTop: '6px',
                                        flexShrink: 0
                                    }} />

                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: !notification.read ? 600 : 500,
                                            color: 'var(--gray-900)',
                                            marginBottom: '4px'
                                        }}>
                                            {notification.title}
                                        </div>
                                        <div style={{
                                            fontSize: '13px',
                                            color: 'var(--gray-600)',
                                            marginBottom: '6px',
                                            lineHeight: 1.4
                                        }}>
                                            {notification.message}
                                        </div>
                                        <div style={{
                                            fontSize: '11px',
                                            color: 'var(--gray-400)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <Clock size={10} />
                                            {formatTime(notification.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
