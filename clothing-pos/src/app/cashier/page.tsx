import { useEffect, useState } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signOut, User, updatePassword } from "firebase/auth";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, addDoc, query, where } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { QrReader } from "react-qr-reader";
import JsBarcode from "jsbarcode";
import {
  ShoppingCart, LogOut, Moon, Sun, Trash2, Plus, AlertCircle, CheckCircle, Menu, X, Home, Settings, BarChart3
} from 'lucide-react';

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

interface Product {
  id: string;
  name: string;
  price?: number;
  qty: number;
  category: string;
  barcode: string;
}

interface CartItem extends Product {
  cartId: string;
  quantity: number;
}

interface Sale {
  id: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  timestamp: string;
}

export default function CashierPage() {
  const [user, setUser] = useState<User | null>(null);
  const [cashierName, setCashierName] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [activeTab, setActiveTab] = useState<"pos" | "sales" | "settings">("pos");
  
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [manualCode, setManualCode] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [sales, setSales] = useState<Sale[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    age: "",
    phoneNo: "",
    address: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [settingsMsg, setSettingsMsg] = useState("");
  const [settingsType, setSettingsType] = useState<"success" | "error" | "">("");
  const [settingsProcessing, setSettingsProcessing] = useState(false);

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
        fetchCashierData(currentUser.uid);
        fetchProducts();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.href = "/login";
  };

  // Fetch cashier data from Firestore
  const fetchCashierData = async (uid: string) => {
    try {
      const querySnapshot = await getDocs(collection(db, "cashiers"));
      const cashier = querySnapshot.docs.find(doc => doc.data().uid === uid);
      if (cashier) {
        const data = cashier.data();
        setCashierName(data.name);
        setCashierId(cashier.id);
        setSettingsForm({
          name: data.name,
          age: data.age?.toString() || "",
          phoneNo: data.phoneNo || "",
          address: data.address || "",
          newPassword: "",
          confirmPassword: ""
        });
        fetchSales(cashier.id);
      }
    } catch (err) {
      console.error("Error fetching cashier data:", err);
    }
  };

  // Fetch sales for this cashier
  const fetchSales = async (id: string) => {
    try {
      const q = query(collection(db, "sales"), where("cashierId", "==", id));
      const querySnapshot = await getDocs(q);
      const salesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Sale)
      }));
      setSales(salesData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (err) {
      console.error("Error fetching sales:", err);
    }
  };

  // Fetch all products from stocks
  const fetchProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "stocks"));
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Product)
      }));
      setProducts(productsData);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  // Add product to cart by barcode
  const addToCart = async (barcode: string) => {
    try {
      const product = products.find(p => p.barcode === barcode);
      
      if (!product) {
        setMessage("Product not found");
        setMessageType("error");
        setTimeout(() => setMessage(""), 3000);
        return;
      }

      if (product.qty <= 0) {
        setMessage("Product is out of stock");
        setMessageType("error");
        setTimeout(() => setMessage(""), 3000);
        return;
      }

      const existingItem = cart.find(item => item.id === product.id);
      
      if (existingItem) {
        setCart(cart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        setCart([...cart, {
          ...product,
          cartId: `${product.id}-${Date.now()}`,
          quantity: 1
        }]);
      }

      setMessage(`✓ ${product.name} added to cart`);
      setMessageType("success");
      setTimeout(() => setMessage(""), 2000);
      setManualCode("");
    } catch (err) {
      console.error("Error adding to cart:", err);
      setMessage("Error adding product to cart");
      setMessageType("error");
    }
  };

  // Handle barcode scan
  const handleScan = (result: any) => {
    if (result?.text) {
      addToCart(result.text);
      setShowScanner(false);
    }
  };

  // Remove from cart
  const removeFromCart = (cartId: string) => {
    setCart(cart.filter(c => c.cartId !== cartId));
  };

  // Update quantity
  const updateQuantity = (cartId: string, newQuantity: number) => {
    const item = cart.find(c => c.cartId === cartId);
    if (!item) return;

    if (newQuantity <= 0) {
      removeFromCart(cartId);
    } else {
      setCart(cart.map(c =>
        c.cartId === cartId
          ? { ...c, quantity: newQuantity }
          : c
      ));
    }
  };

  // Calculate total
  const total = cart.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);

  // Checkout
  const checkout = async () => {
    if (cart.length === 0) {
      setMessage("Cart is empty");
      setMessageType("error");
      return;
    }

    setIsCheckingOut(true);
    try {
      // Update stock for each item in cart
      for (const item of cart) {
        const productRef = doc(db, "stocks", item.id);
        const productSnap = await getDoc(productRef);
        
        if (productSnap.exists()) {
          const currentQty = productSnap.data().qty;
          const newQty = Math.max(0, currentQty - item.quantity);
          await updateDoc(productRef, { qty: newQty });
        }
      }

      // Save sale record
      await addDoc(collection(db, "sales"), {
        cashierId,
        cashierName,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price || 0
        })),
        total,
        timestamp: new Date().toISOString()
      });

      setMessage("✓ Checkout successful!");
      setMessageType("success");
      
      // Print receipt
      const receiptWindow = window.open('', '', 'width=400,height=600');
      if (receiptWindow) {
        receiptWindow.document.write(`
          <html>
            <head>
              <title>Receipt</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .receipt { text-align: center; }
                .header { font-size: 18px; font-weight: bold; margin-bottom: 20px; }
                .item { text-align: left; padding: 5px 0; border-bottom: 1px solid #ccc; }
                .total { font-size: 16px; font-weight: bold; margin-top: 20px; }
                .footer { margin-top: 20px; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="receipt">
                <div class="header">RetailOS Receipt</div>
                <p>Cashier: ${cashierName}</p>
                <p>Date: ${new Date().toLocaleString()}</p>
                <div style="margin-top: 20px;">
                  ${cart.map(item => `
                    <div class="item">
                      <span>${item.name} x${item.quantity}</span>
                      <span style="float: right;">Rs. ${(item.quantity * (item.price || 0)).toFixed(2)}</span>
                    </div>
                  `).join('')}
                </div>
                <div class="total">
                  <span>Total:</span>
                  <span style="float: right;">Rs. ${total.toFixed(2)}</span>
                </div>
                <div class="footer">
                  <p>Thank you for your purchase!</p>
                </div>
              </div>
            </body>
          </html>
        `);
        receiptWindow.document.close();
        receiptWindow.print();
      }
      
      setCart([]);
      fetchProducts();
      fetchSales(cashierId);
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("Checkout error:", err);
      setMessage("Checkout failed");
      setMessageType("error");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Update profile
  const updateProfile = async () => {
    const { name, age, phoneNo, address, newPassword, confirmPassword } = settingsForm;
    
    if (!name || !age || !phoneNo || !address) {
      setSettingsMsg("All fields are required");
      setSettingsType("error");
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setSettingsMsg("Passwords do not match");
      setSettingsType("error");
      return;
    }

    setSettingsProcessing(true);
    try {
      // Update Firestore
      const cashierRef = doc(db, "cashiers", cashierId);
      await updateDoc(cashierRef, {
        name,
        age: parseInt(age),
        phoneNo,
        address
      });

      // Update password if provided
      if (newPassword) {
        await updatePassword(user!, newPassword);
      }

      setCashierName(name);
      setSettingsMsg("✓ Profile updated successfully!");
      setSettingsType("success");
      setSettingsForm({
        ...settingsForm,
        newPassword: "",
        confirmPassword: ""
      });
      setTimeout(() => setSettingsMsg(""), 3000);
    } catch (err: any) {
      setSettingsMsg(err.message || "Error updating profile");
      setSettingsType("error");
    } finally {
      setSettingsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDark ? 'bg-slate-950' : 'bg-white'
      }`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className={`text-lg font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Loading Cashier...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "pos", label: "POS", icon: ShoppingCart },
    { id: "sales", label: "Sales", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

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
              {cashierName || user?.email}
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

        {/* Mobile Navigation */}
        {sidebarOpen && (
          <div className="sm:hidden mb-6 flex gap-2 overflow-x-auto pb-2 px-4 pt-4">
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
        )}

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-8">
          {/* POS Tab */}
          {activeTab === "pos" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {message && (
                  <div className={`p-4 rounded-lg border flex items-center gap-3 ${
                    messageType === "success"
                      ? isDark
                        ? 'bg-green-950 border-green-900 text-green-200'
                        : 'bg-green-50 border-green-200 text-green-700'
                      : isDark
                      ? 'bg-red-950 border-red-900 text-red-200'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {messageType === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                    <p className="text-sm font-medium">{message}</p>
                  </div>
                )}

                {/* Scanner */}
                <div className={`rounded-2xl border p-6 ${
                  isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Barcode Scanner</h2>
                    <button
                      onClick={() => setShowScanner(!showScanner)}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
                    >
                      {showScanner ? "Close Scanner" : "Open Scanner"}
                    </button>
                  </div>

                  {showScanner && (
                    <div className="rounded-lg overflow-hidden mb-4">
                      <QrReader
                        onResult={handleScan}
                        constraints={{ facingMode: 'environment' }}
                        style={{ width: '100%' }}
                      />
                    </div>
                  )}
                </div>

                {/* Manual Input */}
                <div className={`rounded-2xl border p-6 ${
                  isDark
                    ? 'bg-slate-900 border-slate-800'
                    : 'bg-white border-slate-200'
                }`}>
                  <h2 className="text-xl font-bold mb-4">Manual Entry</h2>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Enter barcode..."
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addToCart(manualCode)}
                      className={`flex-1 px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500'
                          : 'bg-slate-50 border-slate-200 placeholder-slate-400'
                      }`}
                    />
                    <button
                      onClick={() => addToCart(manualCode)}
                      className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isCheckingOut}
                    >
                      <Plus size={18} />
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Cart */}
              <div className={`rounded-2xl border p-6 h-fit sticky top-24 ${
                isDark
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center gap-2 mb-6">
                  <ShoppingCart size={24} className="text-cyan-500" />
                  <h2 className="text-xl font-bold">Cart ({cart.length})</h2>
                </div>

                {cart.length === 0 ? (
                  <p className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    No items in cart
                  </p>
                ) : (
                  <>
                    <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
                      {cart.map((item) => (
                        <div
                          key={item.cartId}
                          className={`p-3 rounded-lg border ${
                            isDark
                              ? 'bg-slate-800 border-slate-700'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{item.name}</p>
                              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                Rs. {item.price?.toFixed(2) || '0.00'}
                              </p>
                            </div>
                            <button
                              onClick={() => removeFromCart(item.cartId)}
                              className={`p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                isDark
                                  ? 'hover:bg-slate-700 text-red-400'
                                  : 'hover:bg-slate-200 text-red-600'
                              }`}
                              disabled={isCheckingOut}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                              className={`px-2 py-1 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
                                isDark
                                  ? 'bg-slate-700 hover:bg-slate-600'
                                  : 'bg-slate-200 hover:bg-slate-300'
                              }`}
                              disabled={isCheckingOut}
                            >
                              −
                            </button>
                            <span className="flex-1 text-center font-semibold">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                              className={`px-2 py-1 rounded text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
                                isDark
                                  ? 'bg-slate-700 hover:bg-slate-600'
                                  : 'bg-slate-200 hover:bg-slate-300'
                              }`}
                              disabled={isCheckingOut}
                            >
                              +
                            </button>
                            <span className="text-sm font-semibold ml-2">
                              Rs. {(item.quantity * (item.price || 0)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className={`p-4 rounded-lg border mb-6 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm">Subtotal:</span>
                        <span className="font-semibold">Rs. {total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-lg font-bold border-t pt-2" style={{
                        borderTopColor: isDark ? '#334155' : '#e2e8f0'
                      }}>
                        <span>Total:</span>
                        <span className="text-cyan-500">Rs. {total.toFixed(2)}</span>
                      </div>
                    </div>

                    <button
                      onClick={checkout}
                      disabled={isCheckingOut}
                      className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-green-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ShoppingCart size={18} />
                      {isCheckingOut ? "Processing..." : "Checkout"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Sales Tab */}
          {activeTab === "sales" && (
            <div className={`rounded-2xl border p-8 ${
              isDark
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200'
            }`}>
              <h2 className="text-2xl font-bold mb-6">Sales History</h2>
              {sales.length === 0 ? (
                <p className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  No sales recorded yet
                </p>
              ) : (
                <div className="space-y-4">
                  {sales.map((sale) => (
                    <div key={sale.id} className={`p-4 rounded-lg border ${
                      isDark
                        ? 'bg-slate-800 border-slate-700'
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold">Sale #{sale.id.slice(0, 8).toUpperCase()}</p>
                          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            {new Date(sale.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-cyan-500">Rs. {sale.total.toFixed(2)}</p>
                      </div>
                      <div className="space-y-2 text-sm">
                        {sale.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{item.name} x{item.quantity}</span>
                            <span>Rs. {(item.quantity * item.price).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === "settings" && (
            <div className={`rounded-2xl border p-8 max-w-2xl ${
              isDark
                ? 'bg-slate-900 border-slate-800'
                : 'bg-white border-slate-200'
            }`}>
              <h2 className="text-2xl font-bold mb-6">Profile Settings</h2>

              {settingsMsg && (
                <div className={`mb-6 p-4 rounded-lg border flex items-center gap-3 ${
                  settingsType === "success"
                    ? isDark
                      ? 'bg-green-950 border-green-900 text-green-200'
                      : 'bg-green-50 border-green-200 text-green-700'
                    : isDark
                    ? 'bg-red-950 border-red-900 text-red-200'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                  {settingsType === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  <p className="text-sm font-medium">{settingsMsg}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                    disabled={settingsProcessing}
                    className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 disabled:bg-slate-700'
                        : 'bg-slate-50 border-slate-200 placeholder-slate-400 disabled:bg-slate-100'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      isDark ? 'text-slate-300' : 'text-slate-700'
                    }`}>
                      Age
                    </label>
                    <input
                      type="number"
                      value={settingsForm.age}
                      onChange={(e) => setSettingsForm({ ...settingsForm, age: e.target.value })}
                      disabled={settingsProcessing}
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
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={settingsForm.phoneNo}
                      onChange={(e) => setSettingsForm({ ...settingsForm, phoneNo: e.target.value })}
                      disabled={settingsProcessing}
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
                    Address
                  </label>
                  <textarea
                    value={settingsForm.address}
                    onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                    disabled={settingsProcessing}
                    rows={3}
                    className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isDark
                        ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 disabled:bg-slate-700'
                        : 'bg-slate-50 border-slate-200 placeholder-slate-400 disabled:bg-slate-100'
                    }`}
                  />
                </div>

                <div className="border-t pt-6" style={{ borderTopColor: isDark ? '#334155' : '#e2e8f0' }}>
                  <h3 className="text-lg font-semibold mb-4">Change Password (Optional)</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDark ? 'text-slate-300' : 'text-slate-700'
                      }`}>
                        New Password
                      </label>
                      <input
                        type="password"
                        value={settingsForm.newPassword}
                        onChange={(e) => setSettingsForm({ ...settingsForm, newPassword: e.target.value })}
                        disabled={settingsProcessing}
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
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={settingsForm.confirmPassword}
                        onChange={(e) => setSettingsForm({ ...settingsForm, confirmPassword: e.target.value })}
                        disabled={settingsProcessing}
                        className={`w-full px-4 py-3 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          isDark
                            ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 disabled:bg-slate-700'
                            : 'bg-slate-50 border-slate-200 placeholder-slate-400 disabled:bg-slate-100'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={updateProfile}
                  disabled={settingsProcessing}
                  className={`w-full px-6 py-3 font-semibold rounded-lg transition-all ${
                    settingsProcessing
                      ? 'bg-slate-400 cursor-not-allowed text-slate-600'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/30'
                  }`}
                >
                  {settingsProcessing ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}