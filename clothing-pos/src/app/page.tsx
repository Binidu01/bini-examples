import { useState, useEffect } from "react";
import {
  BarChart3,
  Package,
  Users,
  TrendingUp,
  Cloud,
  Lock,
  ArrowRight,
  Moon,
  Sun,
} from "lucide-react";

export default function Home() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem("theme-mode");
    if (savedMode !== null) {
      setIsDark(savedMode === "dark");
    } else {
      const darkMode = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setIsDark(darkMode);
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem("theme-mode", newMode ? "dark" : "light");
    window.dispatchEvent(
      new CustomEvent("theme-changed", { detail: { isDark: newMode } })
    );
  };

  const features = [
    {
      icon: BarChart3,
      title: "Smart Billing",
      desc: "Scan, checkout, and print receipts instantly.",
    },
    {
      icon: Package,
      title: "Inventory Tracking",
      desc: "Monitor stock levels and prevent shortages.",
    },
    {
      icon: Users,
      title: "User Roles",
      desc: "Admins manage cashiers and reports securely.",
    },
    {
      icon: TrendingUp,
      title: "Analytics",
      desc: "View daily sales and performance stats.",
    },
    {
      icon: Cloud,
      title: "Cloud Sync",
      desc: "Offline-first with automatic Firebase sync.",
    },
    {
      icon: Lock,
      title: "Secure Access",
      desc: "Authentication and role control via Firebase.",
    },
  ];

  return (
    <div
      className={`min-h-screen w-full transition-colors duration-300 ${
        isDark ? "bg-slate-950 text-slate-50" : "bg-white text-slate-900"
      }`}
    >
      {/* Navigation */}
      <nav
        className={`border-b transition-colors sticky top-0 z-50 w-full ${
          isDark
            ? "border-slate-800 bg-slate-900/50"
            : "border-slate-200 bg-white/80"
        } backdrop-blur-md`}
      >
        <div className="px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs sm:text-sm">
                POS
              </span>
            </div>
            <span className="font-semibold text-base sm:text-lg hidden sm:inline">
              RetailOS
            </span>
          </div>

          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
              isDark
                ? "bg-slate-800 hover:bg-slate-700"
                : "bg-slate-100 hover:bg-slate-200"
            }`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="py-12 sm:py-20 text-center">
          <div className="inline-block mb-3 sm:mb-4">
            <span
              className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                isDark
                  ? "bg-slate-800 text-cyan-400"
                  : "bg-cyan-100 text-cyan-700"
              }`}
            >
              Complete Retail Solution
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight px-2 sm:px-0">
            Smart Clothing Shop
            <span className="bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 bg-clip-text text-transparent">
              {" "}
              POS System
            </span>
          </h1>

          <p
            className={`text-sm sm:text-base lg:text-xl mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-2 sm:px-0 ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Manage your entire clothing store from one place. Track inventory,
            sales, cashiers, and customers — in real-time, even offline. Built
            with <span className="font-semibold">React</span> and{" "}
            <span className="font-semibold">Firebase</span>.
          </p>

          <div className="flex justify-center mb-12 sm:mb-16 px-2">
            <a
              href="/login"
              className="px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-xl hover:shadow-cyan-500/30 transition-all duration-200 hover:scale-105 inline-flex items-center gap-2 text-sm sm:text-base"
            >
              Login to System
              <ArrowRight size={16} />
            </a>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 py-12 sm:py-20">
          {features.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={feature.title}
                className={`group p-4 sm:p-7 rounded-lg sm:rounded-xl border transition-all duration-300 hover:shadow-lg ${
                  isDark
                    ? "bg-slate-900 border-slate-800 hover:border-cyan-500"
                    : "bg-slate-50 border-slate-200 hover:border-cyan-500"
                } hover:shadow-cyan-500/10`}
              >
                <div
                  className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center mb-3 sm:mb-4 transition-all group-hover:scale-110 ${
                    isDark
                      ? "bg-slate-800 group-hover:bg-gradient-to-br group-hover:from-cyan-500 group-hover:to-blue-600"
                      : "bg-cyan-100 group-hover:bg-gradient-to-br group-hover:from-cyan-500 group-hover:to-blue-600"
                  }`}
                >
                  <IconComponent
                    size={20}
                    className={`transition-colors sm:w-6 sm:h-6 ${
                      isDark
                        ? "group-hover:text-white"
                        : "group-hover:text-white text-cyan-600"
                    }`}
                  />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">
                  {feature.title}
                </h3>
                <p
                  className={`text-xs sm:text-sm ${
                    isDark ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  {feature.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* CTA Section */}
        <div
          className={`rounded-lg sm:rounded-2xl border my-12 sm:my-20 p-6 sm:p-12 text-center transition-all ${
            isDark
              ? "bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700"
              : "bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200"
          }`}
        >
          <h2 className="text-2xl sm:text-4xl font-bold mb-3 sm:mb-4 px-2">
            Start Managing Smarter Today
          </h2>
          <p
            className={`text-sm sm:text-lg mb-6 sm:mb-8 max-w-2xl mx-auto px-2 ${
              isDark ? "text-slate-400" : "text-slate-600"
            }`}
          >
            Get started with your store's own POS system in minutes. No setup
            fees, no contracts.
          </p>
          <div className="flex justify-center px-2">
            <a
              href="/login"
              className="px-6 sm:px-8 py-2.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-cyan-500/30 transition-all hover:scale-105 inline-block text-sm sm:text-base"
            >
              Get Started Now
            </a>
          </div>
        </div>

        {/* Footer */}
        <footer
          className={`border-t py-8 sm:py-12 text-center ${
            isDark
              ? "border-slate-800 text-slate-400"
              : "border-slate-200 text-slate-600"
          }`}
        >
          <p className="text-xs sm:text-sm">
            Clothing POS System © {new Date().getFullYear()} — built for modern
            retailers.
          </p>
          <p className="mt-2 text-xs sm:text-sm">
            Developed with ❤️ using{" "}
            <span className="font-semibold text-cyan-500">React</span> and{" "}
            <span className="font-semibold text-amber-500">Firebase</span>.
          </p>
        </footer>
      </div>
    </div>
  );
}
