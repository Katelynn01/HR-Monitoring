import { useState, useRef } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '../supabase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export default function ProfilePicture({ userProfile }) {
    const { user } = useAuth(); // getting `user` to access `uid`
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file || !user) return;

        setError(null);
        setSuccess(false);

        // Validation
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file.');
            return;
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB
            setError('Image maximum size is 2MB.');
            return;
        }

        try {
            setIsUploading(true);
            
            // Generate filename using the user's ID
            const fileExt = file.name.split('.').pop();
            const filePath = `users/${user.uid}.${fileExt}`;

            // Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('profile-pictures')
                .upload(filePath, file, {
                    upsert: true,
                    cacheControl: '3600'
                });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('profile-pictures')
                .getPublicUrl(filePath);

            // Add a timestamp query parameter to bypass browser caching 
            // since the user might be replacing the same file path
            const profileImageUrl = `${publicUrl}?t=${Date.now()}`;

            // Update user profile in Firestore
            await updateDoc(doc(db, 'users', user.uid), {
                profile_image: profileImageUrl
            });

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
            
        } catch (err) {
            console.error('Upload error:', err);
            setError(err.message || 'Failed to upload image.');
            setTimeout(() => setError(null), 3000);
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = ''; // Reset input
        }
    };

    return (
        <div className="profile-picture-container" onClick={() => fileInputRef.current?.click()}>
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
