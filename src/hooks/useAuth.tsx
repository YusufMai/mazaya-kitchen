import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type UserRole = 'super_admin' | 'admin' | 'staff';

export interface AppUser {
  uid: string;
  email: string | null;
  name: string | null;
  role: UserRole;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        try {
          // Normalize email to use as document ID
          const emailId = firebaseUser.email.toLowerCase();
          const userDocRef = doc(db, 'users', emailId);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            // Ensure super admin is strictly enforced for dev.yusufmai@gmail.com
            const resolvedRole = emailId === 'dev.yusufmai@gmail.com' ? 'super_admin' : (data.role as UserRole);
            
            // Link UID in case it was a pre-registered user created by an admin
            if (!data.uid || data.name !== firebaseUser.displayName) {
              await updateDoc(userDocRef, {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || data.name,
                role: resolvedRole
              });
            }

            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || data.name,
              role: resolvedRole,
            });
          } else {
            // New user registration
            const role: UserRole = emailId === 'dev.yusufmai@gmail.com' ? 'super_admin' : 'staff';
            const newUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName,
              role,
              createdAt: serverTimestamp(),
            };
            await setDoc(userDocRef, newUser);
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName,
              role,
            });
          }
        } catch (error) {
          console.error("Failed to fetch user role", error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Sign in failed", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("This domain is not authorized in Firebase. Please add " + window.location.hostname + " to your Authorized Domains in the Firebase Console.");
      } else {
        alert("Sign in failed: " + error.message);
      }
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
