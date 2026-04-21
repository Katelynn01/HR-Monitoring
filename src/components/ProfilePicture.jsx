import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Loader2, Trash2, X, Check } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export default function ProfilePicture({ userProfile, isEditing = false }) {
    const { user } = useAuth();
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const fileInputRef = useRef(null);

    // Cropper specific state
    const [selectedImage, setSelectedImage] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const onCropComplete = (croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

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
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                setSelectedImage(event.target.result);
                // Modal will open to crop
                if (e.target) e.target.value = '';
            };
        } catch (err) {
            console.error('File read error:', err);
            setError(err.message || 'Failed to read image.');
            setTimeout(() => setError(null), 3000);
            if (e.target) e.target.value = '';
        }
    };

    const handleCropSave = async () => {
        if (!selectedImage || !croppedAreaPixels || !user) return;
        
        try {
            setIsUploading(true);
            
            const img = new Image();
            img.src = selectedImage;
            
            // Wait for image to load to grab dimensions
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Target avatar dimension (square)
            const TARGET_SIZE = 250;
            canvas.width = TARGET_SIZE;
            canvas.height = TARGET_SIZE;

            // Draw cropped area onto the full target size
            ctx.drawImage(
                img,
                croppedAreaPixels.x,
                croppedAreaPixels.y,
                croppedAreaPixels.width,
                croppedAreaPixels.height,
                0,
                0,
                TARGET_SIZE,
                TARGET_SIZE
            );

            // Get compressed base64 string
            const base64String = canvas.toDataURL('image/jpeg', 0.8);

            // Persist URL to Firestore user document
            await updateDoc(doc(db, 'users', user.uid), {
                profile_image: base64String
            });

            setSuccess(true);
            setSelectedImage(null); // Close crop modal
            setZoom(1);
            setCrop({ x: 0, y: 0 });
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Firestore/crop error:', err);
            setError('Failed to save profile picture.');
            setTimeout(() => setError(null), 3000);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCropCancel = () => {
        setSelectedImage(null);
        setZoom(1);
        setCrop({ x: 0, y: 0 });
    };
    const handleRemove = async (e) => {
        e.stopPropagation();
        if (!user) return;

        setError(null);
        setSuccess(false);

        try {
            setIsUploading(true);
            await updateDoc(doc(db, 'users', user.uid), {
                profile_image: null
            });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Failed to remove profile picture:', err);
            setError('Failed to remove profile picture.');
            setTimeout(() => setError(null), 3000);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className={`profile-picture-container ${isEditing ? 'editable' : ''}`} onClick={(e) => {
            if (!isEditing) return;
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

                {isEditing && (
                    <div className="profile-picture-overlay">
                        {isUploading ? <Loader2 className="spinner-icon" size={16} /> : <Camera size={16} />}
                    </div>
                )}
            </div>

            {isEditing && userProfile?.profile_image && (
                <button
                    type="button"
                    className="remove-picture-btn"
                    onClick={handleRemove}
                    disabled={isUploading}
                    title="Remove Profile Picture"
                >
                    <Trash2 size={12} />
                </button>
            )}

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                style={{ display: 'none' }}
            />

            {error && <div className="profile-picture-msg error">{error}</div>}
            {success && <div className="profile-picture-msg success">Saved!</div>}

            {/* Cropping Modal */}
            {selectedImage && createPortal(
                <div className="crop-modal-overlay" onClick={(e) => e.stopPropagation()}>
                    <div className="crop-modal-content">
                        <h3 className="crop-modal-title">Adjust Profile Picture</h3>
                        <div className="cropper-container">
                            <Cropper
                                image={selectedImage}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                        </div>
                        <div className="cropper-controls">
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                aria-labelledby="Zoom"
                                onChange={(e) => setZoom(e.target.value)}
                                className="zoom-slider"
                            />
                        </div>
                        <div className="crop-modal-actions">
                            <button className="btn btn-secondary" onClick={handleCropCancel} disabled={isUploading}>
                                <X size={16} /> Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleCropSave} disabled={isUploading}>
                                {isUploading ? <Loader2 className="spinner-icon" size={16} /> : <Check size={16} />} Save
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
