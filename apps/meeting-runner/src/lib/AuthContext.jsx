import React, { createContext, useState, useContext, useEffect } from "react";
import { api, initAuth, isConfigured, signIn, signOut } from "@/api/m365";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(isConfigured);
  const [authError, setAuthError] = useState(isConfigured ? null : { type: "not_configured" });

  useEffect(() => {
    if (!isConfigured) return;
    (async () => {
      try {
        const account = await initAuth();
        if (!account) {
          setAuthError({ type: "auth_required" });
        } else {
          setUser(await api.auth.me());
        }
      } catch (e) {
        console.error("Sign-in check failed:", e);
        setAuthError({ type: "unknown", message: e.message });
      } finally {
        setIsLoadingAuth(false);
      }
    })();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        logout: signOut,
        navigateToLogin: signIn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
