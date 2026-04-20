import { AlertTriangle, X } from 'lucide-react';

export default function ErrorModal({ isOpen, onClose, title = "Error", message }) {
    if (!isOpen) return null;

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
                border: '4px solid #ef4444', // red border
                borderRadius: '12px',
                padding: '24px',
                width: '90%',
                maxWidth: '450px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                animation: 'modalSlideIn 0.3s ease-out forwards'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid #fee2e2', // light red separator
                    paddingBottom: '12px',
                    marginBottom: '16px'
                }}>
                    <h3 style={{ color: '#b91c1c', margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={24} />
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px'
                        }}
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{
                    color: '#374151',
                    lineHeight: '1.6',
                    maxHeight: '60vh',
                    overflowY: 'auto',
                    backgroundColor: '#fef2f2', // very light red bg
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    fontSize: '1rem',
                    whiteSpace: 'pre-wrap'
                }}>
                    {message}
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: '#ef4444', // red button
                            color: 'white',
                            border: 'none',
                            padding: '10px 32px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '1rem',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#dc2626'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#ef4444'}
                    >
                        Close
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes modalSlideIn {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
