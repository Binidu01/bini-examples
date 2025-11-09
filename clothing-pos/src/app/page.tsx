import { useState, useEffect } from "react";
import { 
  BarChart3, Package, Users, TrendingUp, Cloud, Lock, 
  ArrowRight, Menu, X, Moon, Sun
} from "lucide-react";

export default function Home() {
  const [isDark, setIsDark] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem("theme-mode");
    if (savedMode !== null) {
      setIsDark(savedMode === "dark");
    } else {
      const darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setIsDark(darkMode);
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem("theme-mode", newMode ? "dark" : "light");
    window.dispatchEvent(new CustomEvent("theme-changed", { detail: { isDark: newMode } }));
  };

  const features = [
    { 
      icon: BarChart3, 
      title: "Smart Billing", 
      desc: "Scan, checkout, and print receipts instantly." 
    },
    { 
      icon: Package, 
      title: "Inventory Tracking", 
      desc: "Monitor stock levels and prevent shortages." 
    },
    { 
      icon: Users, 
      title: "User Roles", 
      desc: "Admins manage cashiers and reports securely." 
    },
    { 
      icon: TrendingUp, 
      title: "Analytics", 
      desc: "View daily sales and performance stats." 
    },
    { 
      icon: Cloud, 
      title: "Cloud Sync", 
      desc: "Offline-first with automatic Firebase sync." 
    },
    { 
      icon: Lock, 
      title: "Secure Access", 
      desc: "Authentication and role control via Firebase." 
    },
  ];

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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">POS</span>
            </div>
            <span className="font-semibold text-lg hidden sm:inline">RetailOS</span>
          </div>

          <div className="flex items-center gap-4">
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
            <button 
              onClick={() => setMobileMenu(!mobileMenu)}
              className="md:hidden p-2"
            >
              {mobileMenu ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`pt-20 pb-16 text-center ${isDark ? '' : ''}`}>
          <div className="inline-block mb-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isDark
                ? 'bg-slate-800 text-cyan-400'
                : 'bg-cyan-100 text-cyan-700'
            }`}>
              Complete Retail Solution
            </span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-tight">
            Smart Clothing Shop
            <span className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              {" "}POS System
            </span>
          </h1>
          
          <p className={`text-xl mb-8 max-w-3xl mx-auto leading-relaxed ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Manage your entire clothing store from one place. Track inventory, sales, cashiers, and customers — 
            in real-time, even offline. Built with <span className="font-semibold">Bini.js</span> and <span className="font-semibold">Firebase</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <a
              href="/login"
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-cyan-500/30 transition-all duration-200 hover:scale-105 inline-flex items-center gap-2"
            >
              Login to System
              <ArrowRight size={18} />
            </a>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-20">
          {features.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={feature.title}
                className={`group p-7 rounded-xl border transition-all duration-300 hover:shadow-lg ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 hover:border-cyan-500'
                    : 'bg-slate-50 border-slate-200 hover:border-cyan-500'
                } hover:shadow-cyan-500/10`}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-all group-hover:scale-110 ${
                  isDark
                    ? 'bg-slate-800 group-hover:bg-gradient-to-br group-hover:from-cyan-500 group-hover:to-blue-600'
                    : 'bg-cyan-100 group-hover:bg-gradient-to-br group-hover:from-cyan-500 group-hover:to-blue-600'
                }`}>
                  <IconComponent 
                    size={24} 
                    className={`transition-colors ${
                      isDark ? 'group-hover:text-white' : 'group-hover:text-white text-cyan-600'
                    }`}
                  />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {feature.title}
                </h3>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  {feature.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className={`rounded-2xl border my-20 p-12 text-center transition-all ${
          isDark
            ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700'
            : 'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200'
        }`}>
          <h2 className="text-4xl font-bold mb-4">
            Start Managing Smarter Today
          </h2>
          <p className={`text-lg mb-8 max-w-2xl mx-auto ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            Get started with your store's own POS system in minutes. No setup fees, no contracts.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/login"
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all hover:scale-105 inline-block"
            >
              Get Started Now
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer className={`border-t py-12 text-center ${
          isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-600'
        }`}>
          <p>
            Clothing POS System © {new Date().getFullYear()} — built for modern retailers.
          </p>
          <p className="mt-2">
            Developed with ❤️ using <span className="font-semibold text-cyan-500">Bini.js</span> and <span className="font-semibold text-amber-500">Firebase</span>.
          </p>
        </footer>
      </div>
    </div>
  );
}