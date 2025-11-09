import { useEffect, useState, useRef } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut, User, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  Home, Users, Package, TrendingUp, LogOut, Moon, Sun, Trash2,
  Plus, AlertCircle, CheckCircle, Menu, X, Edit2, Download, Eye, Receipt
} from 'lucide-react';
import JsBarcode from 'jsbarcode';

// Firebase initialization
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Sale {
  id: string;
  cashierId: string;
  cashierName: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  timestamp: string;
}

interface LowStockItem {
  id: string;
  name: string;
  qty: number;
  category: string;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"home" | "cashiers" | "stocks" | "sales" | "analytics">("home");
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Sales state
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);

  // Low stock state
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);

  // Theme sync
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

  const toggleDarkMode = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem("theme-mode", newMode ? "dark" : "light");
    window.dispatchEvent(new CustomEvent("theme-changed", { detail: { isDark: newMode } }));
  };

  // Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        window.location.href = "/login";
      } else {
        setUser(currentUser);
        // Fetch all data when user is authenticated
        fetchStocks();
        fetchCashiers();
        fetchAllSales();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  // Calculate low stock items
  const calculateLowStockItems = (stocks: any[]) => {
    const LOW_STOCK_THRESHOLD = 10;
    const lowStock = stocks
      .filter(stock => stock.qty <= LOW_STOCK_THRESHOLD)
      .map(stock => ({
        id: stock.id,
        name: stock.name,
        qty: stock.qty,
        category: stock.category
      }))
      .sort((a, b) => a.qty - b.qty); // Sort by lowest quantity first
    
    return lowStock;
  };

  // Fetch all sales from all cashiers
  const fetchAllSales = async () => {
    setSalesLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "sales"));
      const salesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Sale)
      }));
      // Sort by timestamp descending (newest first)
      setAllSales(salesData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (err) {
      console.error("Error fetching sales:", err);
    } finally {
      setSalesLoading(false);
    }
  };

  // Cashier Management
  const [cashierData, setCashierData] = useState({
    name: "",
    age: "",
    address: "",
    email: "",
    password: "",
    phoneNo: ""
  });
  const [cashierMsg, setCashierMsg] = useState("");
  const [cashierType, setCashierType] = useState<"success" | "error" | "">("");
  const [cashierProcessing, setCashierProcessing] = useState(false);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [editingCashierId, setEditingCashierId] = useState<string | null>(null);

  const fetchCashiers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "cashiers"));
      const cashiersData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...(doc.data() as any) 
      }));
      setCashiers(cashiersData);
    } catch (err) {
      console.error("Error fetching cashiers:", err);
    }
  };

  const handleCashierChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCashierData(prev => ({ ...prev, [name]: value }));
  };

  const registerCashier = async () => {
    const { name, age, address, email, password, phoneNo } = cashierData;
    
    if (!name || !age || !address || !email || !phoneNo) {
      setCashierMsg("All fields are required");
      setCashierType("error");
      return;
    }

    if (editingCashierId && !password) {
      setCashierMsg("Password is required for updates");
      setCashierType("error");
      return;
    }

    if (!editingCashierId && !password) {
      setCashierMsg("Password is required");
      setCashierType("error");
      return;
    }

    if (parseInt(age) < 18) {
      setCashierMsg("Cashier must be at least 18 years old");
      setCashierType("error");
      return;
    }

    setCashierProcessing(true);
    try {
      if (editingCashierId) {
        // Update existing cashier
        const cashierDoc = cashiers.find(c => c.id === editingCashierId);
        await updateDoc(doc(db, "cashiers", editingCashierId), {
          name,
          age: parseInt(age),
          address,
          email,
          phoneNo
        });

        setCashierMsg(`✓ Cashier ${name} updated successfully!`);
        setCashierType("success");
        setEditingCashierId(null);
      } else {
        // Create new cashier
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        await addDoc(collection(db, "cashiers"), {
          uid: userCredential.user.uid,
          name,
          age: parseInt(age),
          address,
          email,
          phoneNo,
          createdAt: new Date().toISOString(),
          status: "active"
        });

        setCashierMsg(`✓ Cashier ${name} registered successfully!`);
        setCashierType("success");
      }

      setCashierData({
        name: "",
        age: "",
        address: "",
        email: "",
        password: "",
        phoneNo: ""
      });
      
      fetchCashiers();
      setTimeout(() => setCashierMsg(""), 3000);
    } catch (err: any) {
      setCashierMsg(err.message || "Error processing cashier");
      setCashierType("error");
    } finally {
      setCashierProcessing(false);
    }
  };

  const editCashier = (cashier: any) => {
    setEditingCashierId(cashier.id);
    setCashierData({
      name: cashier.name,
      age: cashier.age.toString(),
      address: cashier.address,
      email: cashier.email,
      password: "",
      phoneNo: cashier.phoneNo
    });
  };

  const cancelEditCashier = () => {
    setEditingCashierId(null);
    setCashierData({
      name: "",
      age: "",
      address: "",
      email: "",
      password: "",
      phoneNo: ""
    });
  };

  const deleteCashier = async (id: string, uid: string) => {
    if (!window.confirm("Are you sure you want to delete this cashier?")) {
      return;
    }

    setCashierProcessing(true);
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, "cashiers", id));

      setCashierMsg("✓ Cashier deleted successfully!");
      setCashierType("success");
      fetchCashiers();
      setTimeout(() => setCashierMsg(""), 3000);
    } catch (err: any) {
      setCashierMsg(err.message || "Error deleting cashier");
      setCashierType("error");
    } finally {
      setCashierProcessing(false);
    }
  };

  // Stock Management
  const [stockName, setStockName] = useState("");
  const [stockQty, setStockQty] = useState(0);
  const [stockPrice, setStockPrice] = useState(0);
  const [stockCategory, setStockCategory] = useState("mens");
  const [stocks, setStocks] = useState<{ id: string; name: string; qty: number; price: number; category: string; barcode: string }[]>([]);
  const [stockMsg, setStockMsg] = useState("");
  const [stockType, setStockType] = useState<"success" | "error" | "">("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate unique barcode
  const generateBarcode = () => {
    return 'BC' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase();
  };

  // Download barcode as PNG
  const downloadBarcodePNG = (barcode: string, productName: string) => {
    const svg = document.createElement('div');
    svg.innerHTML = '<svg id="temp-barcode"></svg>';
    document.body.appendChild(svg);
    
    try {
      JsBarcode("#temp-barcode", barcode, {
        format: "CODE128",
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 16,
        margin: 10
      });
      
      const svgElement = document.getElementById('temp-barcode') as any;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = `${productName}-${barcode}.png`;
        link.click();
        
        document.body.removeChild(svg);
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    } catch (err) {
      console.error('Error generating barcode:', err);
      document.body.removeChild(svg);
    }
  };

  const fetchStocks = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "stocks"));
      const stocksData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...(doc.data() as any) 
      }));
      setStocks(stocksData);
      setLowStockItems(calculateLowStockItems(stocksData));
    } catch (err) {
      console.error("Error fetching stocks:", err);
    }
  };

  const addStock = async () => {
    if (!stockName || stockQty <= 0 || stockPrice <= 0) {
      setStockMsg("Name, quantity, and price are required");
      setStockType("error");
      return;
    }
    setIsProcessing(true);
    try {
      const barcode = generateBarcode();
      const newStock = { name: stockName, qty: stockQty, price: stockPrice, category: stockCategory, barcode };
      const docRef = await addDoc(collection(db, "stocks"), newStock);
      
      setStocks([...stocks, { id: docRef.id, ...newStock }]);
      setLowStockItems(calculateLowStockItems([...stocks, { id: docRef.id, ...newStock }]));
      
      setStockMsg(`✓ Stock ${stockName} added successfully! Barcode: ${barcode}`);
      setStockType("success");
      setStockName("");
      setStockQty(0);
      setStockPrice(0);
      setStockCategory("mens");
      setTimeout(() => setStockMsg(""), 3000);
    } catch (err: any) {
      setStockMsg(err.message || "Error adding stock");
      setStockType("error");
    } finally {
      setIsProcessing(false);
    }
  };

  const editStock = (stock: any) => {
    setEditingId(stock.id);
    setStockName(stock.name);
    setStockQty(stock.qty);
    setStockPrice(stock.price || 0);
    setStockCategory(stock.category);
  };

  const updateStock = async () => {
    if (!stockName || stockQty <= 0 || stockPrice <= 0 || !editingId) {
      setStockMsg("Name, quantity, and price are required");
      setStockType("error");
      return;
    }
    setIsProcessing(true);
    try {
      const currentStock = stocks.find(s => s.id === editingId);
      const barcode = currentStock?.barcode || generateBarcode();
      
      const updatedStocks = stocks.map(s => 
        s.id === editingId 
          ? { ...s, name: stockName, qty: stockQty, price: stockPrice, category: stockCategory, barcode }
          : s
      );
      
      setStocks(updatedStocks);
      setLowStockItems(calculateLowStockItems(updatedStocks));
      
      await deleteDoc(doc(db, "stocks", editingId));
      await addDoc(collection(db, "stocks"), { name: stockName, qty: stockQty, price: stockPrice, category: stockCategory, barcode });
      
      setStockMsg(`✓ Stock ${stockName} updated successfully!`);
      setStockType("success");
      setStockName("");
      setStockQty(0);
      setStockPrice(0);
      setStockCategory("mens");
      setEditingId(null);
      setTimeout(() => setStockMsg(""), 3000);
    } catch (err: any) {
      setStockMsg(err.message || "Error updating stock");
      setStockType("error");
      fetchStocks();
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setStockName("");
    setStockQty(0);
    setStockPrice(0);
    setStockCategory("mens");
  };

  const deleteStock = async (id: string) => {
    setIsProcessing(true);
    try {
      const updatedStocks = stocks.filter(s => s.id !== id);
      setStocks(updatedStocks);
      setLowStockItems(calculateLowStockItems(updatedStocks));
      await deleteDoc(doc(db, "stocks", id));
      setStockMsg("✓ Stock deleted successfully!");
      setStockType("success");
      setTimeout(() => setStockMsg(""), 3000);
    } catch (err) {
      setStockMsg("Error deleting stock");
      setStockType("error");
      fetchStocks();
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    if (activeTab === "stocks" || activeTab === "analytics") {
      fetchStocks();
    }
    if (activeTab === "cashiers") {
      fetchCashiers();
    }
    if (activeTab === "sales") {
      fetchAllSales();
    }
  }, [activeTab]);

  // Low Stock Alert Banner Component
  const LowStockAlertBanner = () => {
    // Only show on home, stocks, and analytics tabs
    const showLowStockBanner = ["home", "stocks", "analytics"].includes(activeTab);
    
    if (!showLowStockBanner || lowStockItems.length === 0) return null;

    return (
      <div className="relative">
        {/* Alert Banner */}
        <div 
          className="w-full py-3 px-4 text-white font-semibold text-center"
          style={{
            background: 'linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%)',
            boxShadow: '0 4px 12px rgba(255, 107, 107, 0.3)'
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <AlertCircle size={20} className="text-white" />
            <span className="text-lg">LOW STOCK ALERT</span>
            <AlertCircle size={20} className="text-white" />
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            {lowStockItems.map((item, index) => {
              // Calculate color intensity based on stock level (red for very low, orange for low)
              const intensity = Math.max(0.3, 1 - (item.qty / 10));
              const backgroundColor = `rgba(255, ${Math.floor(255 * (1 - intensity))}, ${Math.floor(255 * (1 - intensity))}, 0.9)`;
              
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-3 py-1 rounded-full text-white font-medium shadow-sm"
                  style={{ backgroundColor }}
                >
                  <span className="font-bold">{item.qty}</span>
                  <span className="max-w-32 truncate">{item.name}</span>
                  <span className="text-xs opacity-90 capitalize">({item.category})</span>
                </div>
              );
            })}
          </div>
          
          <div className="text-xs mt-2 opacity-90">
            {lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} below 10 units threshold
          </div>
        </div>
        
        {/* Pulsing dot indicator */}
        <div 
          className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
          style={{
            background: 'linear-gradient(135deg, #ff0000 0%, #ff4444 100%)',
            boxShadow: '0 0 8px rgba(255, 0, 0, 0.7)'
          }}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-slate-950' : 'bg-white'
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className={`text-lg font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: stocks.map(s => s.name),
    datasets: [
      {
        label: "Stock Quantity",
        data: stocks.map(s => s.qty),
        backgroundColor: ["rgba(6, 182, 212, 0.7)", "rgba(0, 119, 255, 0.7)"],
        borderColor: ["rgb(6, 182, 212)", "rgb(0, 119, 255)"],
        borderWidth: 2,
      }
    ]
  };

  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "cashiers", label: "Cashiers", icon: Users },
    { id: "stocks", label: "Stocks", icon: Package },
    { id: "sales", label: "Sales", icon: Receipt },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
  ];

  // Calculate sales statistics
  const totalSales = allSales.length;
  const totalRevenue = allSales.reduce((sum, sale) => sum + sale.total, 0);
  const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark ? 'bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Header */}
      <header className={`border-b transition-colors ${
        isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/80'
      } backdrop-blur-md sticky top-0 z-40`}>
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">POS</span>
              </div>
              <h1 className="text-2xl font-bold hidden sm:inline">RetailOS</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              {user?.email}
            </span>
            <button 
              onClick={toggleDarkMode}
              className={`p-2 rounded-lg transition-colors ${
                isDark ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Low Stock Alert Banner */}
      <LowStockAlertBanner />

      <div className="flex">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className={`w-64 border-r transition-colors ${
            isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/50'
          } p-6 hidden sm:block`}>
            <nav className="space-y-2">
              {navItems.map(item => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      activeTab === item.id
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                        : isDark
                        ? 'hover:bg-slate-800 text-slate-300'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    <IconComponent size={20} />
                    <span className="font-semibold">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-8">
          {/* Mobile Navigation */}
          <div className="sm:hidden mb-6 flex gap-2 overflow-x-auto pb-2">
            {navItems.map(item => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-all ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                      : isDark
                      ? 'bg-slate-800 text-slate-300'
                      : 'bg-slate-100'
                  }`}
                >
                  <IconComponent size={16} />
                  <span className="text-sm font-semibold">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Home Tab */}
          {activeTab === "home" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-3xl font-bold mb-2">Welcome Back!</h2>
                <p className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                  Manage your POS system efficiently
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className={`rounded-xl border p-6 ${
                  isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Total Cashiers</h3>
                    <Users className="text-cyan-500" size={24} />
                  </div>
                  <p className="text-3xl font-bold">{cashiers.length}</p>
                  <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Registered users</p>
                </div>

                <div className={`rounded-xl border p-6 ${
                  isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Total Stock Items</h3>
                    <Package className="text-blue-500" size={24} />
                  </div>
                  <p className="text-3xl font-bold">{stocks.length}</p>
                  <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Items tracked</p>
                </div>

                <div className={`rounded-xl border p-6 ${
                  isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Total Units</h3>
                    <TrendingUp className="text-purple-500" size={24} />
                  </div>
                  <p className="text-3xl font-bold">{stocks.reduce((sum, s) => sum + s.qty, 0)}</p>
                  <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Units in inventory</p>
                </div>

                <div className={`rounded-xl border p-6 ${
                  isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Category Breakdown</h3>
                    <Package className="text-green-500" size={24} />
                  </div>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-semibold capitalize">Men's:</span> {stocks.filter(s => s.category === 'mens').reduce((sum, s) => sum + s.qty, 0)} units</p>
                    <p><span className="font-semibold capitalize">Women's:</span> {stocks.filter(s => s.category === 'womens').reduce((sum, s) => sum + s.qty, 0)} units</p>
                    <p><span className="font-semibold capitalize">Kids:</span> {stocks.filter(s => s.category === 'kids').reduce((sum, s) => sum + s.qty, 0)} units</p>
                  </div>
                </div>
              </div>

              {/* Low Stock Warning on Home Tab */}
              {lowStockItems.length > 0 && (
                <div className={`rounded-2xl border p-6 ${
                  isDark
                    ? 'bg-red-950/20 border-red-800'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="text-red-500" size={24} />
                    <h3 className="text-xl font-bold text-red-600">Low Stock Items</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {lowStockItems.map(item => (
                      <div key={item.id} className={`p-3 rounded-lg ${
                        isDark ? 'bg-red-900/30' : 'bg-red-100'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{item.name}</span>
                          <span className={`px-2 py-1 rounded-full text-sm font-bold ${
                            item.qty <= 3 
                              ? 'bg-red-500 text-white' 
                              : item.qty <= 6
                              ? 'bg-orange-500 text-white'
                              : 'bg-yellow-500 text-white'
                          }`}>
                            {item.qty} left
                          </span>
                        </div>
                        <p className={`text-xs mt-1 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                          {item.category}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sales Tab */}
          {activeTab === "sales" && (
            <div className="space-y-6">
              {/* Sales Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`rounded-xl border p-6 ${
                  isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Total Sales</h3>
                    <Receipt className="text-cyan-500" size={24} />
                  </div>
                  <p className="text-3xl font-bold">{totalSales}</p>
                  <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Transactions completed</p>
                </div>

                <div className={`rounded-xl border p-6 ${
                  isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Total Revenue</h3>
                    <TrendingUp className="text-green-500" size={24} />
                  </div>
                  <p className="text-3xl font-bold">Rs. {totalRevenue.toFixed(2)}</p>
                  <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Total earnings</p>
                </div>

                <div className={`rounded-xl border p-6 ${
                  isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Avg Order Value</h3>
                    <Package className="text-blue-500" size={24} />
                  </div>
                  <p className="text-3xl font-bold">Rs. {averageOrderValue.toFixed(2)}</p>
                  <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>Per transaction</p>
                </div>
              </div>

              {/* Sales List */}
              <div className={`rounded-2xl border p-8 ${
                isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}>
                <h2 className="text-2xl font-bold mb-6">All Cashier Sales</h2>
                {salesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : allSales.length === 0 ? (
                  <p className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    No sales recorded yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {allSales.map((sale) => (
                      <div key={sale.id} className={`p-6 rounded-lg border ${
                        isDark
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              Sale ID
                            </p>
                            <p className="font-mono text-sm font-semibold">{sale.id.slice(0, 8).toUpperCase()}</p>
                          </div>
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              Cashier
                            </p>
                            <p className="font-semibold">{sale.cashierName}</p>
                          </div>
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              Date & Time
                            </p>
                            <p className="text-sm">{new Date(sale.timestamp).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                              Total
                            </p>
                            <p className="text-2xl font-bold text-cyan-500">Rs. {sale.total.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className={`border-t pt-4 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                          <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Items ({sale.items.length})
                          </p>
                          <div className="space-y-2">
                            {sale.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span>{item.name}</span>
                                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                  x{item.quantity} @ Rs. {item.price.toFixed(2)}
                                </span>
                                <span className="font-semibold">Rs. {(item.quantity * item.price).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cashiers Tab */}
          {activeTab === "cashiers" && (
            <div className="space-y-6">
              <div className={`rounded-2xl border p-8 ${
                isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}>
                <h2 className="text-2xl font-bold mb-6">{editingCashierId ? "Edit Cashier" : "Register Cashier"}</h2>

                {cashierMsg && (
                  <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
                    cashierType === "success"
                      ? isDark
                        ? 'bg-green-950 border-green-900 text-green-200'
                        : 'bg-green-50 border-green-200 text-green-700'
                      : isDark
                      ? 'bg-red-950 border-red-900 text-red-200'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {cashierType === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <p className="text-sm font-medium">{cashierMsg}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        Full Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        placeholder="John Doe"
                        value={cashierData.name}
                        onChange={handleCashierChange}
                        disabled={cashierProcessing}
                        className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 disabled:bg-slate-700'
                            : 'bg-slate-50 border-slate-200 placeholder-slate-400 disabled:bg-slate-100'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        Age *
                      </label>
                      <input
                        type="number"
                        name="age"
                        placeholder="25"
                        value={cashierData.age}
                        onChange={handleCashierChange}
                        disabled={cashierProcessing}
                        className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 disabled:bg-slate-700'
                            : 'bg-slate-50 border-slate-200 placeholder-slate-400 disabled:bg-slate-100'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        Email Address *
                      </label>
                      <input
                        type="email"
                        name="email"
                        placeholder="cashier@example.com"
                        value={cashierData.email}
                        onChange={handleCashierChange}
                        disabled={cashierProcessing || editingCashierId}
                        className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 disabled:bg-slate-700'
                            : 'bg-slate-50 border-slate-200 placeholder-slate-400 disabled:bg-slate-100'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        name="phoneNo"
                        placeholder="+1 (555) 000-0000"
                        value={cashierData.phoneNo}
                        onChange={handleCashierChange}
                        disabled={cashierProcessing}
                        className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 disabled:bg-slate-700'
                            : 'bg-slate-50 border-slate-200 placeholder-slate-400 disabled:bg-slate-100'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Address *
                    </label>
                    <textarea
                      name="address"
                      placeholder="123 Main St, City, Country"
                      value={cashierData.address}
                      onChange={handleCashierChange}
                      disabled={cashierProcessing}
                      rows={3}
                      className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 disabled:bg-slate-700'
                          : 'bg-slate-50 border-slate-200 placeholder-slate-400 disabled:bg-slate-100'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Password {editingCashierId ? "(leave blank to keep current)" : "*"}
                    </label>
                    <input
                      type="password"
                      name="password"
                      placeholder="••••••••"
                      value={cashierData.password}
                      onChange={handleCashierChange}
                      disabled={cashierProcessing}
                      className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 disabled:bg-slate-700'
                          : 'bg-slate-50 border-slate-200 placeholder-slate-400 disabled:bg-slate-100'
                      }`}
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={registerCashier}
                      disabled={cashierProcessing}
                      className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all ${
                        cashierProcessing
                          ? 'bg-slate-400 cursor-not-allowed text-slate-600'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/30'
                      }`}
                    >
                      <Plus size={18} />
                      {cashierProcessing ? "Processing..." : (editingCashierId ? "Update Cashier" : "Register Cashier")}
                    </button>
                    {editingCashierId && (
                      <button
                        onClick={cancelEditCashier}
                        disabled={cashierProcessing}
                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all ${
                          cashierProcessing
                            ? 'bg-slate-400 cursor-not-allowed text-slate-600'
                            : 'bg-slate-600 hover:bg-slate-700 text-white'
                        }`}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Cashiers List */}
              <div className={`rounded-2xl border p-8 ${
                isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}>
                <h3 className="text-xl font-bold mb-6">Registered Cashiers</h3>
                {cashiers.length === 0 ? (
                  <p className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    No cashiers registered yet
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold">Name</th>
                          <th className="text-left py-3 px-4 font-semibold">Email</th>
                          <th className="text-left py-3 px-4 font-semibold">Phone</th>
                          <th className="text-left py-3 px-4 font-semibold">Age</th>
                          <th className="text-left py-3 px-4 font-semibold">Status</th>
                          <th className="text-left py-3 px-4 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashiers.map(cashier => (
                          <tr key={cashier.id} className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                            <td className="py-3 px-4">{cashier.name}</td>
                            <td className="py-3 px-4">{cashier.email}</td>
                            <td className="py-3 px-4">{cashier.phoneNo}</td>
                            <td className="py-3 px-4">{cashier.age}</td>
                            <td className="py-3 px-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                cashier.status === 'active'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                              }`}>
                                {cashier.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => editCashier(cashier)}
                                  disabled={cashierProcessing}
                                  className={`p-2 rounded-lg transition-colors ${
                                    cashierProcessing
                                      ? 'text-slate-400 cursor-not-allowed'
                                      : 'hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400'
                                  }`}
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => deleteCashier(cashier.id, cashier.uid)}
                                  disabled={cashierProcessing}
                                  className={`p-2 rounded-lg transition-colors ${
                                    cashierProcessing
                                      ? 'text-slate-400 cursor-not-allowed'
                                      : 'hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400'
                                  }`}
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stocks Tab */}
          {activeTab === "stocks" && (
            <div className="space-y-6">
              <div className={`rounded-2xl border p-8 ${
                isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}>
                <h2 className="text-2xl font-bold mb-6">Add Stock</h2>

                {stockMsg && (
                  <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
                    stockType === "success"
                      ? isDark
                        ? 'bg-green-950 border-green-900 text-green-200'
                        : 'bg-green-50 border-green-200 text-green-700'
                      : isDark
                      ? 'bg-red-950 border-red-900 text-red-200'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {stockType === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <p className="text-sm font-medium">{stockMsg}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Product Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., T-Shirt Red Medium"
                      value={stockName}
                      onChange={(e) => setStockName(e.target.value)}
                      className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                          : 'bg-slate-50 border-slate-200 placeholder-slate-400'
                      }`}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        Category
                      </label>
                      <select
                        value={stockCategory}
                        onChange={(e) => setStockCategory(e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <option value="mens">Men's</option>
                        <option value="womens">Women's</option>
                        <option value="kids">Kids</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        Quantity (Units)
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={stockQty}
                        onChange={(e) => setStockQty(parseInt(e.target.value) || 0)}
                        className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                            : 'bg-slate-50 border-slate-200 placeholder-slate-400'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        Unit Price
                      </label>
                      <input
                        type="number"
                        placeholder="0.00"
                        step="0.01"
                        value={stockPrice}
                        onChange={(e) => setStockPrice(parseFloat(e.target.value) || 0)}
                        className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                            : 'bg-slate-50 border-slate-200 placeholder-slate-400'
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    onClick={editingId ? updateStock : addStock}
                    disabled={isProcessing}
                    className={`w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all ${
                      isProcessing
                        ? 'bg-slate-400 cursor-not-allowed text-slate-600'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/30'
                    }`}
                  >
                    <Plus size={18} />
                    {isProcessing ? "Processing..." : (editingId ? "Update Stock" : "Add Stock")}
                  </button>

                  {editingId && (
                    <button
                      onClick={cancelEdit}
                      disabled={isProcessing}
                      className={`w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all ${
                        isProcessing
                          ? 'bg-slate-400 cursor-not-allowed text-slate-600'
                          : 'bg-slate-600 hover:bg-slate-700 text-white'
                      }`}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Stock List */}
              <div className={`rounded-2xl border p-8 ${
                isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}>
                <h3 className="text-xl font-bold mb-6">Current Inventory</h3>
                {stocks.length === 0 ? (
                  <p className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    No stocks added yet
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold">Product Name</th>
                          <th className="text-left py-3 px-4 font-semibold">Category</th>
                          <th className="text-left py-3 px-4 font-semibold">Quantity</th>
                          <th className="text-left py-3 px-4 font-semibold">Price</th>
                          <th className="text-left py-3 px-4 font-semibold">Barcode</th>
                          <th className="text-left py-3 px-4 font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stocks.map(stock => (
                          <tr key={stock.id} className={`border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                            <td className="py-3 px-4">{stock.name}</td>
                            <td className="py-3 px-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${
                                stock.category === 'mens'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                                  : stock.category === 'womens'
                                  ? 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300'
                                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                              }`}>
                                {stock.category}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                                stock.qty > 10
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : stock.qty <= 3
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                              }`}>
                                {stock.qty}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-cyan-600 dark:text-cyan-400">
                              Rs. {stock.price.toFixed(2)}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <code className={`px-2 py-1 rounded text-xs font-mono ${
                                  isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-800'
                                }`}>
                                  {stock.barcode}
                                </code>
                                <button
                                  onClick={() => downloadBarcodePNG(stock.barcode, stock.name)}
                                  className={`p-1 rounded transition-colors ${
                                    isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-600'
                                  }`}
                                  title="Download as PNG"
                                >
                                  <Download size={16} />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => editStock(stock)}
                                  disabled={isProcessing}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isProcessing
                                      ? 'text-slate-400 cursor-not-allowed'
                                      : 'hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400'
                                  }`}
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => deleteStock(stock.id)}
                                  disabled={isProcessing}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isProcessing
                                      ? 'text-slate-400 cursor-not-allowed'
                                      : 'hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400'
                                  }`}
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <div className="space-y-8">
              {/* Sales Analytics */}
              <div className={`rounded-2xl border p-8 ${
                isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}>
                <h2 className="text-2xl font-bold mb-6">Sales Analytics</h2>
                
                {allSales.length === 0 ? (
                  <div className={`text-center py-12 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <Receipt size={48} className="mx-auto mb-3 opacity-50" />
                    <p>No sales data available yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Top Performers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className={`p-6 rounded-lg border ${
                        isDark
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        <h3 className="font-bold mb-4">Top Cashiers by Sales Count</h3>
                        <div className="space-y-3">
                          {Object.entries(
                            allSales.reduce((acc: any, sale) => {
                              acc[sale.cashierName] = (acc[sale.cashierName] || 0) + 1;
                              return acc;
                            }, {})
                          )
                            .sort((a: any, b: any) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([name, count]: any) => (
                              <div key={name} className="flex justify-between items-center">
                                <span className="font-medium">{name}</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                  isDark
                                    ? 'bg-cyan-900 text-cyan-300'
                                    : 'bg-cyan-100 text-cyan-700'
                                }`}>
                                  {count} sales
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className={`p-6 rounded-lg border ${
                        isDark
                          ? 'bg-slate-800 border-slate-700'
                          : 'bg-slate-50 border-slate-200'
                      }`}>
                        <h3 className="font-bold mb-4">Top Cashiers by Revenue</h3>
                        <div className="space-y-3">
                          {Object.entries(
                            allSales.reduce((acc: any, sale) => {
                              acc[sale.cashierName] = (acc[sale.cashierName] || 0) + sale.total;
                              return acc;
                            }, {})
                          )
                            .sort((a: any, b: any) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([name, revenue]: any) => (
                              <div key={name} className="flex justify-between items-center">
                                <span className="font-medium">{name}</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                  isDark
                                    ? 'bg-green-900 text-green-300'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  Rs. {(revenue as number).toFixed(2)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    {/* Top Products */}
                    <div className={`p-6 rounded-lg border ${
                      isDark
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <h3 className="font-bold mb-4">Top Selling Products</h3>
                      <div className="space-y-3">
                        {Object.entries(
                          allSales.reduce((acc: any, sale) => {
                            sale.items.forEach((item) => {
                              if (!acc[item.name]) {
                                acc[item.name] = { quantity: 0, revenue: 0 };
                              }
                              acc[item.name].quantity += item.quantity;
                              acc[item.name].revenue += item.quantity * item.price;
                            });
                            return acc;
                          }, {})
                        )
                          .sort((a: any, b: any) => b[1].quantity - a[1].quantity)
                          .slice(0, 10)
                          .map(([name, data]: any) => (
                            <div key={name} className="flex justify-between items-center">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{name}</p>
                                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {data.quantity} units • Rs. {data.revenue.toFixed(2)}
                                </p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-sm font-bold whitespace-nowrap ml-2 ${
                                isDark
                                  ? 'bg-purple-900 text-purple-300'
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {data.quantity} sold
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Daily Sales Summary */}
                    <div className={`p-6 rounded-lg border ${
                      isDark
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <h3 className="font-bold mb-4">Sales Summary by Date</h3>
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {Object.entries(
                          allSales.reduce((acc: any, sale) => {
                            const date = new Date(sale.timestamp).toLocaleDateString();
                            if (!acc[date]) {
                              acc[date] = { count: 0, total: 0 };
                            }
                            acc[date].count += 1;
                            acc[date].total += sale.total;
                            return acc;
                          }, {})
                        )
                          .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                          .map(([date, data]: any) => (
                            <div key={date} className="flex justify-between items-center p-3 rounded bg-opacity-50 hover:bg-opacity-100 transition-all">
                              <div>
                                <p className="font-medium text-sm">{date}</p>
                                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {data.count} transactions
                                </p>
                              </div>
                              <span className="text-lg font-bold text-cyan-500">Rs. {data.total.toFixed(2)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stock Analytics */}
              <div className={`rounded-2xl border p-8 ${
                isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}>
                <h2 className="text-2xl font-bold mb-6">Stock Analytics</h2>
                {stocks.length === 0 ? (
                  <div className={`text-center py-12 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <Package size={48} className="mx-auto mb-3 opacity-50" />
                    <p>No stock data available. Add stocks to view analytics.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <Bar
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: true,
                        plugins: {
                          legend: { position: 'top' as const },
                          title: { display: true, text: 'Stock Quantity Overview' }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              color: isDark ? '#cbd5e1' : '#475569'
                            },
                            grid: {
                              color: isDark ? '#334155' : '#e2e8f0'
                            }
                          },
                          x: {
                            ticks: {
                              color: isDark ? '#cbd5e1' : '#475569'
                            },
                            grid: {
                              color: isDark ? '#334155' : '#e2e8f0'
                            }
                          }
                        }
                      }}
                    />

                    {/* Low Stock Analysis */}
                    {lowStockItems.length > 0 && (
                      <div className={`p-6 rounded-lg border ${
                        isDark
                          ? 'bg-red-950/20 border-red-800'
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <h3 className="font-bold mb-4 text-red-600">Low Stock Analysis</h3>
                        <div className="space-y-3">
                          {lowStockItems.map(item => (
                            <div key={item.id} className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                                  {item.category} • Only {item.qty} units remaining
                                </p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                                item.qty <= 3 
                                  ? 'bg-red-500 text-white' 
                                  : item.qty <= 6
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-yellow-500 text-white'
                              }`}>
                                {Math.round((item.qty / 10) * 100)}% of threshold
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}