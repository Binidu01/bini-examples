import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Moon, Sun, ArrowLeft } from "lucide-react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Initialize Firebase (read from env.local)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem("theme-mode");
    if (savedMode !== null) {
      setIsDark(savedMode === "dark");
    } else {
      const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(darkMode);
    }

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      setIsDark(customEvent.detail.isDark);
    };

    window.addEventListener("theme-changed", handleThemeChange);
    return () => window.removeEventListener("theme-changed", handleThemeChange);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      
      // Check if user is admin
      if (email === "admin@gmail.com") {
        navigate("/admin");
        return;
      }

      // Check if user is a cashier
      const cashierQuery = query(
        collection(db, "cashiers"),
        where("uid", "==", uid)
      );
      const cashierSnapshot = await getDocs(cashierQuery);
      
      if (!cashierSnapshot.empty) {
        // User is a cashier
        navigate("/cashier");
        return;
      }

      // User exists but has no role assigned
      setError("Your account does not have an assigned role. Contact support.");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem("theme-mode", newMode ? "dark" : "light");
    window.dispatchEvent(new CustomEvent("theme-changed", { detail: { isDark: newMode } }));
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark 
        ? 'bg-slate-950 text-slate-50' 
        : 'bg-white text-slate-900'
    }`}>
      {/* Navigation */}
      <nav className={`border-b transition-colors ${
        isDark 
          ? 'border-slate-800 bg-slate-900/50' 
          : 'border-slate-200 bg-white/80'
      } backdrop-blur-md sticky top-0 z-50`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className={`p-2 rounded-lg transition-colors ${
                isDark 
                  ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' 
                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
              title="Go back to home"
            >
              <ArrowLeft size={20} />
            </button>
            <a href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">POS</span>
              </div>
              <span className="font-semibold text-lg hidden sm:inline">RetailOS</span>
            </a>
          </div>
          
          <button 
            onClick={toggleDarkMode}
            className={`p-2 rounded-lg transition-colors ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700' 
                : 'bg-slate-100 hover:bg-slate-200'
            }`}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-4">
        <div className="w-full max-w-md">
          {/* Form Card */}
          <div className={`rounded-2xl border transition-all ${
            isDark
              ? 'bg-slate-900 border-slate-800 shadow-2xl shadow-slate-950'
              : 'bg-white border-slate-200 shadow-xl shadow-slate-200/50'
          } p-8`}>
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">POS</span>
                </div>
                <h1 className="text-2xl font-bold">Welcome Back</h1>
              </div>
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Sign in to access your POS system
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className={`mb-6 p-4 rounded-lg border transition-all ${
                isDark
                  ? 'bg-red-950 border-red-900 text-red-200'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Login Fields */}
            <div className="space-y-6">
              {/* Email Input */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    isDark
                      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-300'
                  }`}
                />
              </div>

              {/* Password Input */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 pr-12 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-slate-600'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-slate-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors ${
                      isDark
                        ? 'text-slate-500 hover:text-slate-300'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleLogin}
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                  loading
                    ? `${isDark ? 'bg-slate-700' : 'bg-slate-200'} text-slate-500 cursor-not-allowed`
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-105'
                }`}
              >
                {loading ? "Signing in..." : (
                  <>
                    Sign In
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bottom Info */}
          <div className={`text-center mt-6 text-sm ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
            <p>Secure login powered by Firebase</p>
          </div>
        </div>
      </div>
    </div>
  );
}