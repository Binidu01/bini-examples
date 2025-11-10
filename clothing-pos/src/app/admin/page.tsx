import { useEffect, useState, useRef } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  User,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  Home,
  Users,
  Package,
  TrendingUp,
  LogOut,
  Moon,
  Sun,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle,
  Menu,
  X,
  Edit2,
  Download,
  Eye,
  Receipt,
} from "lucide-react";
import JsBarcode from "jsbarcode";

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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

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
  const [activeTab, setActiveTab] = useState<
    "home" | "cashiers" | "stocks" | "sales" | "analytics"
  >("home");
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(false);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [barcodePreview, setBarcodePreview] = useState<{
    barcode: string;
    productName: string;
  } | null>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);

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

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      setIsDark(customEvent.detail.isDark);
    };

    window.addEventListener("theme-changed", handleThemeChange);
    return () => window.removeEventListener("theme-changed", handleThemeChange);
  }, []);

  useEffect(() => {
    if (barcodePreview && barcodeCanvasRef.current) {
      try {
        const ctx = barcodeCanvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(
            0,
            0,
            barcodeCanvasRef.current.width,
            barcodeCanvasRef.current.height
          );
        }

        JsBarcode(barcodeCanvasRef.current, barcodePreview.barcode, {
          format: "CODE128",
          width: 2,
          height: 100,
          displayValue: true,
          fontSize: 16,
          margin: 10,
          background: "#ffffff",
          lineColor: "#000000",
        });
      } catch (err) {
        console.error("Error generating barcode preview:", err);
      }
    }
  }, [barcodePreview]);

  const toggleDarkMode = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem("theme-mode", newMode ? "dark" : "light");
    window.dispatchEvent(
      new CustomEvent("theme-changed", { detail: { isDark: newMode } })
    );
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        window.location.href = "/login";
      } else {
        setUser(currentUser);
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

  const previewBarcode = (barcode: string, productName: string) => {
    setBarcodePreview({ barcode, productName });
  };

  const calculateLowStockItems = (stocks: any[]) => {
    const LOW_STOCK_THRESHOLD = 10;
    return stocks
      .filter((stock) => stock.qty <= LOW_STOCK_THRESHOLD)
      .map((stock) => ({
        id: stock.id,
        name: stock.name,
        qty: stock.qty,
        category: stock.category,
      }))
      .sort((a, b) => a.qty - b.qty);
  };

  const fetchAllSales = async () => {
    setSalesLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "sales"));
      const salesData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Sale),
      }));
      setAllSales(
        salesData.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      );
    } catch (err) {
      console.error("Error fetching sales:", err);
    } finally {
      setSalesLoading(false);
    }
  };

  const [cashierData, setCashierData] = useState({
    name: "",
    age: "",
    address: "",
    email: "",
    password: "",
    phoneNo: "",
  });
  const [cashierMsg, setCashierMsg] = useState("");
  const [cashierType, setCashierType] = useState<"success" | "error" | "">("");
  const [cashierProcessing, setCashierProcessing] = useState(false);
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [editingCashierId, setEditingCashierId] = useState<string | null>(null);

  const fetchCashiers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "cashiers"));
      const cashiersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }));
      setCashiers(cashiersData);
    } catch (err) {
      console.error("Error fetching cashiers:", err);
    }
  };

  const handleCashierChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setCashierData((prev) => ({ ...prev, [name]: value }));
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
        await updateDoc(doc(db, "cashiers", editingCashierId), {
          name,
          age: parseInt(age),
          address,
          email,
          phoneNo,
        });

        setCashierMsg(`✓ Cashier ${name} updated successfully!`);
        setCashierType("success");
        setEditingCashierId(null);
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        await addDoc(collection(db, "cashiers"), {
          uid: userCredential.user.uid,
          name,
          age: parseInt(age),
          address,
          email,
          phoneNo,
          createdAt: new Date().toISOString(),
          status: "active",
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
        phoneNo: "",
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
      phoneNo: cashier.phoneNo,
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
      phoneNo: "",
    });
  };

  const deleteCashier = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this cashier?")) {
      return;
    }

    setCashierProcessing(true);
    try {
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

  const [stockName, setStockName] = useState("");
  const [stockQty, setStockQty] = useState(0);
  const [stockPrice, setStockPrice] = useState(0);
  const [stockCategory, setStockCategory] = useState("mens");
  const [stocks, setStocks] = useState<
    {
      id: string;
      name: string;
      qty: number;
      price: number;
      category: string;
      barcode: string;
    }[]
  >([]);
  const [stockMsg, setStockMsg] = useState("");
  const [stockType, setStockType] = useState<"success" | "error" | "">("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const generateBarcode = () => {
    return (
      "BC" + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase()
    );
  };

  const downloadBarcodePNG = (barcode: string, productName: string) => {
    const canvas = document.createElement("canvas");
    try {
      JsBarcode(canvas, barcode, {
        format: "CODE128",
        width: 2,
        height: 100,
        displayValue: true,
        fontSize: 16,
        margin: 10,
        background: "#ffffff",
        lineColor: "#000000",
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${productName}-${barcode}.png`;
      link.click();
    } catch (err) {
      console.error("Error generating barcode:", err);
    }
  };

  const fetchStocks = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "stocks"));
      const stocksData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
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
      const newStock = {
        name: stockName,
        qty: stockQty,
        price: stockPrice,
        category: stockCategory,
        barcode,
      };
      const docRef = await addDoc(collection(db, "stocks"), newStock);

      setStocks([...stocks, { id: docRef.id, ...newStock }]);
      setLowStockItems(
        calculateLowStockItems([...stocks, { id: docRef.id, ...newStock }])
      );

      setStockMsg(
        `✓ Stock ${stockName} added successfully! Barcode: ${barcode}`
      );
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
    window.scrollTo(0, 0);
  };

  const updateStock = async () => {
    if (!stockName || stockQty <= 0 || stockPrice <= 0 || !editingId) {
      setStockMsg("Name, quantity, and price are required");
      setStockType("error");
      return;
    }
    setIsProcessing(true);
    try {
      const currentStock = stocks.find((s) => s.id === editingId);
      const barcode = currentStock?.barcode || generateBarcode();

      const updatedStocks = stocks.map((s) =>
        s.id === editingId
          ? {
              ...s,
              name: stockName,
              qty: stockQty,
              price: stockPrice,
              category: stockCategory,
              barcode,
            }
          : s
      );

      setStocks(updatedStocks);
      setLowStockItems(calculateLowStockItems(updatedStocks));

      await deleteDoc(doc(db, "stocks", editingId));
      await addDoc(collection(db, "stocks"), {
        name: stockName,
        qty: stockQty,
        price: stockPrice,
        category: stockCategory,
        barcode,
      });

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
      const updatedStocks = stocks.filter((s) => s.id !== id);
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

  const LowStockAlertBanner = () => {
    const showLowStockBanner = ["home", "stocks", "analytics"].includes(
      activeTab
    );

    if (!showLowStockBanner || lowStockItems.length === 0) return null;

    return (
      <div className="relative w-full">
        <div
          className="w-full py-2 px-3 sm:py-3 sm:px-4 text-white font-semibold text-center"
          style={{
            background: "linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%)",
            boxShadow: "0 4px 12px rgba(255, 107, 107, 0.3)",
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
            <AlertCircle size={16} className="text-white flex-shrink-0" />
            <span className="text-sm sm:text-lg">LOW STOCK ALERT</span>
            <AlertCircle size={16} className="text-white flex-shrink-0" />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            {lowStockItems.slice(0, 3).map((item) => {
              const intensity = Math.max(0.3, 1 - item.qty / 10);
              const backgroundColor = `rgba(255, ${Math.floor(
                255 * (1 - intensity)
              )}, ${Math.floor(255 * (1 - intensity))}, 0.9)`;

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-white font-medium shadow-sm"
                  style={{ backgroundColor }}
                >
                  <span className="font-bold">{item.qty}</span>
                  <span className="max-w-20 truncate text-xs">{item.name}</span>
                </div>
              );
            })}
          </div>

          {lowStockItems.length > 3 && (
            <div className="text-xs mt-1 opacity-90">
              +{lowStockItems.length - 3} more
            </div>
          )}
        </div>

        <div
          className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-pulse"
          style={{
            background: "linear-gradient(135deg, #ff0000 0%, #ff4444 100%)",
            boxShadow: "0 0 8px rgba(255, 0, 0, 0.7)",
          }}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? "bg-slate-950" : "bg-white"
        }`}
      >
        <div className="text-center px-4">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p
            className={`text-lg font-semibold ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}
          >
            Loading Dashboard...
          </p>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: stocks.map((s) => s.name.substring(0, 12)),
    datasets: [
      {
        label: "Stock Qty",
        data: stocks.map((s) => s.qty),
        backgroundColor: ["rgba(6, 182, 212, 0.7)", "rgba(0, 119, 255, 0.7)"],
        borderColor: ["rgb(6, 182, 212)", "rgb(0, 119, 255)"],
        borderWidth: 2,
      },
    ],
  };

  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "cashiers", label: "Cashiers", icon: Users },
    { id: "stocks", label: "Stocks", icon: Package },
    { id: "sales", label: "Sales", icon: Receipt },
    { id: "analytics", label: "Analytics", icon: TrendingUp },
  ];

  const totalSales = allSales.length;
  const totalRevenue = allSales.reduce((sum, sale) => sum + sale.total, 0);
  const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

  const StatCard = ({
    title,
    value,
    icon: Icon,
    color,
  }: {
    title: string;
    value: any;
    icon: any;
    color: string;
  }) => (
    <div
      className={`rounded-lg sm:rounded-xl border p-3 sm:p-6 ${
        isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <h3 className="font-semibold text-xs sm:text-sm">{title}</h3>
        <Icon className={`text-${color}-500`} size={18} />
      </div>
      <p className="text-xl sm:text-3xl font-bold">{value}</p>
    </div>
  );

  return (
    <div
      className={`min-h-screen w-full transition-colors duration-300 ${
        isDark ? "bg-slate-950 text-slate-50" : "bg-slate-50 text-slate-900"
      }`}
    >
      {/* Header */}
      <header
        className={`border-b transition-colors sticky top-0 z-40 w-full ${
          isDark
            ? "border-slate-800 bg-slate-900/50"
            : "border-slate-200 bg-white/80"
        } backdrop-blur-md`}
      >
        <div className="px-3 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                isDark ? "hover:bg-slate-800" : "hover:bg-slate-100"
              }`}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">POS</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold hidden sm:inline">
                RetailOS
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs sm:text-sm truncate max-w-32 ${
                isDark ? "text-slate-400" : "text-slate-600"
              }`}
            >
              {user?.email}
            </span>
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
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-2 sm:px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-semibold text-xs sm:text-sm"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <LowStockAlertBanner />

      <div className="flex flex-col sm:flex-row w-full">
        {/* Sidebar - Mobile Overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-30 sm:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <aside
              className={`fixed left-0 top-16 h-screen w-64 border-r transition-colors z-30 overflow-y-auto ${
                isDark
                  ? "border-slate-800 bg-slate-900"
                  : "border-slate-200 bg-white"
              }`}
            >
              <nav className="p-4 space-y-2">
                {navItems.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm ${
                        activeTab === item.id
                          ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg"
                          : isDark
                          ? "hover:bg-slate-800 text-slate-300"
                          : "hover:bg-slate-100"
                      }`}
                    >
                      <IconComponent size={18} />
                      <span className="font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-8 pb-24 sm:pb-8 w-full">
          {/* Mobile Navigation Tabs */}
          <div className="sm:hidden mb-4 flex gap-1 overflow-x-auto pb-2 -mx-3 px-3">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-semibold flex-shrink-0 transition-all ${
                    activeTab === item.id
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                      : isDark
                      ? "bg-slate-800 text-slate-300"
                      : "bg-slate-100"
                  }`}
                >
                  <IconComponent size={13} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Home Tab */}
          {activeTab === "home" && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold">Welcome!</h2>
                <p className={isDark ? "text-slate-400" : "text-slate-600"}>
                  Manage your POS system
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-6">
                <StatCard
                  title="Cashiers"
                  value={cashiers.length}
                  icon={Users}
                  color="cyan"
                />
                <StatCard
                  title="Stock Items"
                  value={stocks.length}
                  icon={Package}
                  color="blue"
                />
                <StatCard
                  title="Total Units"
                  value={stocks.reduce((sum, s) => sum + s.qty, 0)}
                  icon={TrendingUp}
                  color="purple"
                />
                <StatCard
                  title="Total Sales"
                  value={totalSales}
                  icon={Receipt}
                  color="green"
                />
              </div>

              {lowStockItems.length > 0 && (
                <div
                  className={`rounded-lg sm:rounded-2xl border p-3 sm:p-6 ${
                    isDark
                      ? "bg-red-950/20 border-red-800"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <AlertCircle
                      className="text-red-500 flex-shrink-0"
                      size={20}
                    />
                    <h3 className="text-base sm:text-xl font-bold text-red-600">
                      Low Stock Items
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {lowStockItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-2 sm:p-3 rounded text-sm ${
                          isDark ? "bg-red-900/30" : "bg-red-100"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-medium truncate">
                            {item.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold flex-shrink-0 ${
                              item.qty <= 3
                                ? "bg-red-500 text-white"
                                : item.qty <= 6
                                ? "bg-orange-500 text-white"
                                : "bg-yellow-500 text-white"
                            }`}
                          >
                            {item.qty}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sales Tab */}
          {activeTab === "sales" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-6">
                <StatCard
                  title="Total Sales"
                  value={totalSales}
                  icon={Receipt}
                  color="cyan"
                />
                <StatCard
                  title="Total Revenue"
                  value={`Rs. ${totalRevenue.toFixed(0)}`}
                  icon={TrendingUp}
                  color="green"
                />
                <StatCard
                  title="Avg Order"
                  value={`Rs. ${averageOrderValue.toFixed(0)}`}
                  icon={Package}
                  color="blue"
                />
              </div>

              <div
                className={`rounded-lg sm:rounded-2xl border p-3 sm:p-8 ${
                  isDark
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <h2 className="text-lg sm:text-2xl font-bold mb-4">
                  All Sales
                </h2>
                {salesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : allSales.length === 0 ? (
                  <p
                    className={`text-center py-6 text-sm ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    No sales yet
                  </p>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {allSales.slice(0, 10).map((sale) => (
                      <div
                        key={sale.id}
                        className={`p-3 sm:p-4 rounded-lg border text-sm ${
                          isDark
                            ? "bg-slate-800 border-slate-700"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <p
                              className={`text-xs font-semibold uppercase ${
                                isDark ? "text-slate-400" : "text-slate-600"
                              }`}
                            >
                              Cashier
                            </p>
                            <p className="font-semibold">{sale.cashierName}</p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-xs font-semibold uppercase ${
                                isDark ? "text-slate-400" : "text-slate-600"
                              }`}
                            >
                              Total
                            </p>
                            <p className="text-lg font-bold text-cyan-500">
                              Rs. {sale.total.toFixed(0)}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`text-xs ${
                            isDark ? "text-slate-400" : "text-slate-600"
                          }`}
                        >
                          {new Date(sale.timestamp).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cashiers Tab */}
          {activeTab === "cashiers" && (
            <div className="space-y-4 sm:space-y-6">
              <div
                className={`rounded-lg sm:rounded-2xl border p-3 sm:p-8 ${
                  isDark
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <h2 className="text-lg sm:text-2xl font-bold mb-4">
                  {editingCashierId ? "Edit Cashier" : "Register Cashier"}
                </h2>

                {cashierMsg && (
                  <div
                    className={`mb-4 p-3 rounded-lg border flex items-center gap-2 text-sm ${
                      cashierType === "success"
                        ? isDark
                          ? "bg-green-950 border-green-900 text-green-200"
                          : "bg-green-50 border-green-200 text-green-700"
                        : isDark
                        ? "bg-red-950 border-red-900 text-red-200"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}
                  >
                    {cashierType === "success" ? (
                      <CheckCircle size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <p>{cashierMsg}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <input
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    value={cashierData.name}
                    onChange={handleCashierChange}
                    disabled={cashierProcessing}
                    className={`w-full px-3 py-2 sm:py-3 rounded text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-white"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      name="age"
                      placeholder="Age"
                      value={cashierData.age}
                      onChange={handleCashierChange}
                      disabled={cashierProcessing}
                      className={`w-full px-3 py-2 sm:py-3 rounded text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-white"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    />
                    <input
                      type="tel"
                      name="phoneNo"
                      placeholder="Phone"
                      value={cashierData.phoneNo}
                      onChange={handleCashierChange}
                      disabled={cashierProcessing}
                      className={`w-full px-3 py-2 sm:py-3 rounded text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-white"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    />
                  </div>

                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={cashierData.email}
                    onChange={handleCashierChange}
                    disabled={cashierProcessing || editingCashierId}
                    className={`w-full px-3 py-2 sm:py-3 rounded text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-white"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  />

                  <textarea
                    name="address"
                    placeholder="Address"
                    value={cashierData.address}
                    onChange={handleCashierChange}
                    disabled={cashierProcessing}
                    rows={2}
                    className={`w-full px-3 py-2 sm:py-3 rounded text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-white"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  />

                  <input
                    type="password"
                    name="password"
                    placeholder={
                      editingCashierId ? "New Password (optional)" : "Password"
                    }
                    value={cashierData.password}
                    onChange={handleCashierChange}
                    disabled={cashierProcessing}
                    className={`w-full px-3 py-2 sm:py-3 rounded text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-white"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={registerCashier}
                      disabled={cashierProcessing}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 sm:py-3 font-semibold rounded text-sm transition-all ${
                        cashierProcessing
                          ? "bg-slate-400 text-slate-600"
                          : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg"
                      }`}
                    >
                      <Plus size={16} />
                      {editingCashierId ? "Update" : "Register"}
                    </button>
                    {editingCashierId && (
                      <button
                        onClick={cancelEditCashier}
                        disabled={cashierProcessing}
                        className={`flex-1 px-3 py-2 sm:py-3 font-semibold rounded text-sm transition-all ${
                          cashierProcessing
                            ? "bg-slate-400 text-slate-600"
                            : "bg-slate-600 hover:bg-slate-700 text-white"
                        }`}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={`rounded-lg sm:rounded-2xl border p-3 sm:p-8 ${
                  isDark
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <h3 className="text-base sm:text-xl font-bold mb-4">
                  Cashiers
                </h3>
                {cashiers.length === 0 ? (
                  <p
                    className={`text-center py-6 text-sm ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    No cashiers yet
                  </p>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {cashiers.map((cashier) => (
                      <div
                        key={cashier.id}
                        className={`p-3 rounded border text-sm ${
                          isDark
                            ? "bg-slate-800 border-slate-700"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="font-semibold">{cashier.name}</p>
                            <p
                              className={
                                isDark ? "text-slate-400" : "text-slate-600"
                              }
                            >
                              {cashier.email}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold flex-shrink-0 ${
                              cashier.status === "active"
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                            }`}
                          >
                            {cashier.status}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => editCashier(cashier)}
                            disabled={cashierProcessing}
                            className={`flex-1 p-1.5 rounded text-xs transition-colors ${
                              cashierProcessing
                                ? "text-slate-400"
                                : "hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            <Edit2 size={14} className="mx-auto" />
                          </button>
                          <button
                            onClick={() =>
                              deleteCashier(cashier.id, cashier.uid)
                            }
                            disabled={cashierProcessing}
                            className={`flex-1 p-1.5 rounded text-xs transition-colors ${
                              cashierProcessing
                                ? "text-slate-400"
                                : "hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
                            }`}
                          >
                            <Trash2 size={14} className="mx-auto" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stocks Tab */}
          {activeTab === "stocks" && (
            <div className="space-y-4 sm:space-y-6">
              <div
                className={`rounded-lg sm:rounded-2xl border p-3 sm:p-8 ${
                  isDark
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <h2 className="text-lg sm:text-2xl font-bold mb-4">
                  Add Stock
                </h2>

                {stockMsg && (
                  <div
                    className={`mb-4 p-3 rounded-lg border flex items-center gap-2 text-sm ${
                      stockType === "success"
                        ? isDark
                          ? "bg-green-950 border-green-900 text-green-200"
                          : "bg-green-50 border-green-200 text-green-700"
                        : isDark
                        ? "bg-red-950 border-red-900 text-red-200"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}
                  >
                    {stockType === "success" ? (
                      <CheckCircle size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    <p className="truncate">{stockMsg}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Product Name"
                    value={stockName}
                    onChange={(e) => setStockName(e.target.value)}
                    className={`w-full px-3 py-2 sm:py-3 rounded text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-white"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={stockCategory}
                      onChange={(e) => setStockCategory(e.target.value)}
                      className={`w-full px-3 py-2 sm:py-3 rounded text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-white"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    >
                      <option value="mens">Men's</option>
                      <option value="womens">Women's</option>
                      <option value="kids">Kids</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Qty"
                      value={stockQty}
                      onChange={(e) =>
                        setStockQty(parseInt(e.target.value) || 0)
                      }
                      className={`w-full px-3 py-2 sm:py-3 rounded text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        isDark
                          ? "bg-slate-800 border-slate-700 text-white"
                          : "bg-slate-50 border-slate-200"
                      }`}
                    />
                  </div>

                  <input
                    type="number"
                    placeholder="Unit Price"
                    step="0.01"
                    value={stockPrice}
                    onChange={(e) =>
                      setStockPrice(parseFloat(e.target.value) || 0)
                    }
                    className={`w-full px-3 py-2 sm:py-3 rounded text-sm border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isDark
                        ? "bg-slate-800 border-slate-700 text-white"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  />

                  <button
                    onClick={editingId ? updateStock : addStock}
                    disabled={isProcessing}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 sm:py-3 font-semibold rounded text-sm transition-all ${
                      isProcessing
                        ? "bg-slate-400 text-slate-600"
                        : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg"
                    }`}
                  >
                    <Plus size={16} />
                    {editingId ? "Update" : "Add"} Stock
                  </button>

                  {editingId && (
                    <button
                      onClick={cancelEdit}
                      disabled={isProcessing}
                      className={`w-full px-3 py-2 sm:py-3 font-semibold rounded text-sm transition-all ${
                        isProcessing
                          ? "bg-slate-400 text-slate-600"
                          : "bg-slate-600 hover:bg-slate-700 text-white"
                      }`}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div
                className={`rounded-lg sm:rounded-2xl border p-3 sm:p-8 ${
                  isDark
                    ? "bg-slate-900 border-slate-800"
                    : "bg-white border-slate-200"
                }`}
              >
                <h3 className="text-base sm:text-xl font-bold mb-4">
                  Inventory
                </h3>
                {stocks.length === 0 ? (
                  <p
                    className={`text-center py-6 text-sm ${
                      isDark ? "text-slate-400" : "text-slate-600"
                    }`}
                  >
                    No stocks yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {stocks.map((stock) => (
                      <div
                        key={stock.id}
                        className={`p-3 rounded border text-sm ${
                          isDark
                            ? "bg-slate-800 border-slate-700"
                            : "bg-slate-50 border-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="font-semibold">{stock.name}</p>
                            <div className="flex gap-1 mt-1 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${
                                  stock.category === "mens"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                    : stock.category === "womens"
                                    ? "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300"
                                    : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                                }`}
                              >
                                {stock.category}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  stock.qty > 10
                                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                    : stock.qty <= 3
                                    ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                                }`}
                              >
                                {stock.qty} units
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-semibold text-cyan-600 dark:text-cyan-400">
                              Rs. {stock.price.toFixed(0)}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1 items-center justify-between">
                          <code
                            className={`text-xs px-2 py-1 rounded truncate flex-1 ${
                              isDark
                                ? "bg-slate-700 text-slate-200"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {stock.barcode}
                          </code>
                          <div className="flex gap-1">
                            <button
                              onClick={() =>
                                previewBarcode(stock.barcode, stock.name)
                              }
                              className={`p-1 rounded transition-colors ${
                                isDark
                                  ? "hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                                  : "hover:bg-slate-100 text-slate-600"
                              }`}
                              title="View"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() =>
                                downloadBarcodePNG(stock.barcode, stock.name)
                              }
                              className={`p-1 rounded transition-colors ${
                                isDark
                                  ? "hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                                  : "hover:bg-slate-100 text-slate-600"
                              }`}
                              title="Download"
                            >
                              <Download size={14} />
                            </button>
                            <button
                              onClick={() => editStock(stock)}
                              disabled={isProcessing}
                              className={`p-1 rounded transition-colors ${
                                isProcessing
                                  ? "text-slate-400"
                                  : "hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400"
                              }`}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => deleteStock(stock.id)}
                              disabled={isProcessing}
                              className={`p-1 rounded transition-colors ${
                                isProcessing
                                  ? "text-slate-400"
                                  : "hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
                              }`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === "analytics" && (
            <div className="space-y-4 sm:space-y-8">
              {allSales.length === 0 ? (
                <div
                  className={`rounded-lg sm:rounded-2xl border p-6 sm:p-12 text-center ${
                    isDark
                      ? "bg-slate-900 border-slate-800"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <Receipt size={40} className="mx-auto mb-3 opacity-50" />
                  <p className={isDark ? "text-slate-400" : "text-slate-600"}>
                    No sales data available
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className={`rounded-lg sm:rounded-2xl border p-3 sm:p-8 overflow-x-auto ${
                      isDark
                        ? "bg-slate-900 border-slate-800"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <h2 className="text-base sm:text-2xl font-bold mb-4">
                      Stock Analytics
                    </h2>
                    {stocks.length > 0 && (
                      <Bar
                        data={chartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: true,
                          indexAxis: "x" as const,
                          plugins: {
                            legend: { position: "top" as const },
                            title: {
                              display: false,
                            },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: {
                                color: isDark ? "#cbd5e1" : "#475569",
                              },
                              grid: {
                                color: isDark ? "#334155" : "#e2e8f0",
                              },
                            },
                            x: {
                              ticks: {
                                color: isDark ? "#cbd5e1" : "#475569",
                              },
                              grid: {
                                color: isDark ? "#334155" : "#e2e8f0",
                              },
                            },
                          },
                        }}
                      />
                    )}
                  </div>

                  <div
                    className={`rounded-lg sm:rounded-2xl border p-3 sm:p-8 ${
                      isDark
                        ? "bg-slate-900 border-slate-800"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <h3 className="text-base sm:text-xl font-bold mb-3">
                      Top Cashiers
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(
                        allSales.reduce((acc: any, sale) => {
                          acc[sale.cashierName] =
                            (acc[sale.cashierName] || 0) + 1;
                          return acc;
                        }, {})
                      )
                        .sort((a: any, b: any) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([name, count]: any) => (
                          <div
                            key={name}
                            className="flex justify-between items-center p-2 sm:p-3 rounded text-sm"
                          >
                            <span className="font-medium">{name}</span>
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold ${
                                isDark
                                  ? "bg-cyan-900 text-cyan-300"
                                  : "bg-cyan-100 text-cyan-700"
                              }`}
                            >
                              {count} sales
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div
                    className={`rounded-lg sm:rounded-2xl border p-3 sm:p-8 ${
                      isDark
                        ? "bg-slate-900 border-slate-800"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    <h3 className="text-base sm:text-xl font-bold mb-3">
                      Top Products
                    </h3>
                    <div className="space-y-2">
                      {Object.entries(
                        allSales.reduce((acc: any, sale) => {
                          sale.items.forEach((item) => {
                            if (!acc[item.name]) {
                              acc[item.name] = { quantity: 0, revenue: 0 };
                            }
                            acc[item.name].quantity += item.quantity;
                            acc[item.name].revenue +=
                              item.quantity * item.price;
                          });
                          return acc;
                        }, {})
                      )
                        .sort((a: any, b: any) => b[1].quantity - a[1].quantity)
                        .slice(0, 5)
                        .map(([name, data]: any) => (
                          <div
                            key={name}
                            className="flex justify-between items-center p-2 sm:p-3 rounded text-xs sm:text-sm"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{name}</p>
                              <p
                                className={
                                  isDark ? "text-slate-400" : "text-slate-600"
                                }
                              >
                                {data.quantity} units
                              </p>
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-xs font-bold flex-shrink-0 ml-2 ${
                                isDark
                                  ? "bg-purple-900 text-purple-300"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              Rs. {data.revenue.toFixed(0)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Barcode Preview Modal */}
      {barcodePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div
            className={`rounded-lg sm:rounded-2xl p-4 sm:p-6 w-full max-w-sm ${
              isDark ? "bg-slate-800" : "bg-white"
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base sm:text-lg font-bold">Barcode</h3>
              <button
                onClick={() => setBarcodePreview(null)}
                className={`p-1 rounded ${
                  isDark ? "hover:bg-slate-700" : "hover:bg-slate-100"
                }`}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col items-center justify-center gap-3">
              <div
                className={`w-full flex justify-center p-2 rounded border overflow-x-auto ${
                  isDark
                    ? "bg-white border-slate-600"
                    : "bg-white border-slate-300"
                }`}
              >
                <canvas
                  ref={barcodeCanvasRef}
                  className="max-w-full"
                  style={{ maxHeight: "120px" }}
                />
              </div>
              <p
                className={`text-xs sm:text-sm text-center break-words ${
                  isDark ? "text-slate-300" : "text-slate-600"
                }`}
              >
                {barcodePreview.productName}
              </p>
              <code
                className={`px-2 py-1 rounded text-xs font-mono text-center break-all w-full ${
                  isDark
                    ? "bg-slate-700 text-slate-200"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {barcodePreview.barcode}
              </code>
              <button
                onClick={() => {
                  downloadBarcodePNG(
                    barcodePreview.barcode,
                    barcodePreview.productName
                  );
                  setBarcodePreview(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors font-semibold text-sm"
              >
                <Download size={14} />
                Download PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
