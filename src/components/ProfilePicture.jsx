import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export default function ProfilePicture({ userProfile }) {
    const { user } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !user) return;

        setError(null);
        setSuccess(false);

        if (!file.type.startsWith('image/')) {
            setError('Please select an image file.');
            return;
        }

        try {
            setIsUploading(true);

            // Compress image using Canvas to save directly to Firestore as Base64
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 250;
                    const MAX_HEIGHT = 250;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Get compressed base64 string
                    const base64String = canvas.toDataURL('image/jpeg', 0.8);

                    try {
                        // Persist URL to Firestore user document
                        await updateDoc(doc(db, 'users', user.uid), {
                            profile_image: base64String
                        });

                        setSuccess(true);
                        setTimeout(() => setSuccess(false), 3000);
                    } catch (err) {
                        console.error('Firestore update error:', err);
                        setError('Failed to save profile picture.');
                        setTimeout(() => setError(null), 3000);
                    } finally {
                        setIsUploading(false);
                        if (e.target) e.target.value = '';
                    }
                };
            };
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || 'Failed to process image.');
            setTimeout(() => setError(null), 3000);
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    return (
        <div className="profile-picture-container" onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
        }}>
            <div className="profile-picture-wrapper">
                {userProfile?.profile_image ? (
                    <img
                        src={userProfile.profile_image}
                        alt="Profile"
                        className="profile-picture-img"
                    />
                ) : (
                    <div className="profile-picture-placeholder">
                        {userProfile?.name?.charAt(0).toUpperCase()}
                    </div>
                )}

                <div className="profile-picture-overlay">
                    {isUploading ? <Loader2 className="spinner-icon" size={16} /> : <Camera size={16} />}
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: 'none' }}
            />

            {error && <div className="profile-picture-msg error">{error}</div>}
            {success && <div className="profile-picture-msg success">Saved!</div>}
        </div>
    );
}
