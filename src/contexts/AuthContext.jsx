import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, addDoc, collection, getDocs, query, where } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    async function login(email, password) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        // userProfile is set by the onSnapshot listener in onAuthStateChanged
        return result;
    }

    async function register(email, password, name, department) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const profile = {
            name,
            email,
            department,
            role: email.toLowerCase().includes('admin') ? 'admin' : 'employee',
            leaveCredits: { vacation: 15, sick: 10, personal: 5 },
            createdAt: serverTimestamp()
        };
        await setDoc(doc(db, 'users', result.user.uid), profile);

        // Notify admins about new registration
        if (profile.role === 'employee') {
            await addDoc(collection(db, 'notifications'), {
                forAdmin: true,
                title: 'New Employee Registered',
                message: `${name} (${department}) has signed up.`,
                link: '/admin/employees',
                read: false,
                createdAt: serverTimestamp()
            });
        }

        setUserProfile(profile);
        return result;
    }

    async function loginWithGoogle(department = '') {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const uid = result.user.uid;

        // Check if user already has a Firestore profile by UID
        const profileRef = doc(db, 'users', uid);
        const profileSnap = await getDoc(profileRef);

        if (!profileSnap.exists()) {
            // Check if the email is already used by another account in our database
            const usersRef = collection(db, 'users');
            const emailQuery = query(usersRef, where('email', '==', result.user.email));
            const emailQuerySnapshot = await getDocs(emailQuery);

            if (!emailQuerySnapshot.empty) {
                // Email is already used by another account (e.g., registered via email/password)
                // We should delete the newly created Google Auth user to prevent orphaned auth records
                await result.user.delete();
                throw new Error('An account with this email address already exists. Please log in using your original method.');
            }

            // New Google user — create profile
            const profile = {
                name: result.user.displayName || '',
                email: result.user.email || '',
                department,
                role: 'employee',
                leaveCredits: { vacation: 15, sick: 10, personal: 5 },
                needsDepartment: true,
                createdAt: serverTimestamp()
            };
            await setDoc(profileRef, profile);
            // Notify admins
            await addDoc(collection(db, 'notifications'), {
                forAdmin: true,
                title: 'New Employee Registered',
                message: `${profile.name} (${department}) has signed up via Google.`,
                link: '/admin/employees',
                read: false,
                createdAt: serverTimestamp()
            });
            return { isNewUser: true, role: 'employee' };
        }

        return { isNewUser: false, role: profileSnap.data().role };
    }

    async function logout() {
        await signOut(auth);
        setUser(null);
        setUserProfile(null);
    }

    function resetPassword(email) {
        return sendPasswordResetEmail(auth, email);
    }

    useEffect(() => {
        let unsubscribeProfile = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);

            // Clean up previous profile listener
            if (unsubscribeProfile) unsubscribeProfile();

            if (currentUser) {
                try {
                    // Set up real-time listener for user profile
                    unsubscribeProfile = onSnapshot(doc(db, 'users', currentUser.uid), (snapshot) => {
                        if (snapshot.exists()) {
                            setUserProfile(snapshot.data());
                            setLoading(false);
                        } else {
                            // User's Firestore document was deleted (e.g. removed by admin)
                            // Force sign out immediately
                            signOut(auth);
                        }
                    }, (err) => {
                        console.error('Profile listener error:', err);
                        setLoading(false);
                    });
                } catch (err) {
                    console.error('Error setting up profile listener:', err);
                    setLoading(false);
                }
            } else {
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
        };
    }, []);

    const value = {
        user,
        userProfile,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        resetPassword,
        isAdmin: userProfile?.role === 'admin'
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
