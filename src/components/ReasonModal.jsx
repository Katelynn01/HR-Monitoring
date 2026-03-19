import { X } from 'lucide-react';

export default function ReasonModal({ isOpen, onClose, reason }) {
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
                border: '4px solid #facc15', // yellow border
                borderRadius: '12px',
                padding: '24px',
                width: '90%',
                maxWidth: '450px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '2px solid #22c55e', // green separator
                    paddingBottom: '12px',
                    marginBottom: '16px'
                }}>
                    <h3 style={{ color: '#166534', margin: 0, fontSize: '1.25rem' }}>Leave Reason</h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#166534',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{
                    color: '#374151',
                    lineHeight: '1.6',
                    maxHeight: '60vh',
                    overflowY: 'auto',
                    backgroundColor: '#f0fdf4', // very light green bg
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0',
                    fontSize: '1rem',
                    whiteSpace: 'pre-wrap'
                }}>
                    {reason || 'No reason provided.'}
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: '#22c55e', // green button
                            color: 'white',
                            border: 'none',
                            padding: '10px 32px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '1rem',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#16a34a'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#22c55e'}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
