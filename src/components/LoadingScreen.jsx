export default function LoadingScreen({ message = 'Loading...' }) {
    return (
        <div className="loading-screen">
            {/* Wrapper with relative positioning to stack text behind gif */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {/* GEMINI text behind the GIF */}
                <span style={{
                    position: 'absolute',
                    fontSize: '7rem',
                    fontWeight: '900',
                    color: 'rgba(22, 163, 74, 0.12)',
                    letterSpacing: '0.2em',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    zIndex: 0,
                    fontFamily: 'Inter, sans-serif'
                }}>
                    GEMINI
                </span>

                {/* Tractor GIF on top */}
                <img
                    src="/tractor-loading.gif"
                    alt="Loading..."
                    style={{
                        width: '210px',
                        height: '210px',
                        objectFit: 'contain',
                        position: 'relative',
                        zIndex: 1
                    }}
                />
            </div>
            <p style={{ color: '#6b7280', fontWeight: 500 }}>{message}</p>
        </div>
    );
}
