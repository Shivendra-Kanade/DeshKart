const { useState, useEffect, useMemo, useRef } = React;

/* ---------- settings ---------- */
const API = "";   // same origin: served by Spring Boot itself
const CURRENCY = "INR";                 // change to "INR" etc.
const USD_TO_INR_RATE = 83; // Conversion rate from USD to INR
const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: CURRENCY }).format((n || 0) * USD_TO_INR_RATE);

/* ---------- api helper ---------- */
async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error((data && (data.message || data.error)) || (typeof data === "string" && data) || `Request failed (${res.status})`);
  return data;
}

/* ---------- product tile (with image support) ---------- */
const hue = (s = "") => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
function Tile({ product, className = "" }) {
  const h = hue(product.category || product.name);
  if (product.imageUrl) {
    return (
      <div className={"tile " + className} style={{ backgroundImage: `url(${product.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
    );
  }
  return (
    <div className={"tile " + className} style={{ background: `linear-gradient(135deg,hsl(${h} 80% 90%),hsl(${h} 75% 78%))`, color: `hsl(${h} 50% 28%)` }}>
      {(product.name || "?")[0].toUpperCase()}
    </div>
  );
}

/* ---------- auth modal ---------- */
function AuthModal({ open, onClose, onDone }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const { token } = await api(`/auth/${mode}`, { method: "POST", body: f });
      let user;
      try { user = await api("/auth/me", { token }); }
      catch { throw new Error("Signed in, but /auth/me is missing on the server. Add the endpoint from the setup notes."); }
      onDone(token, user);
      setF({ name: "", email: "", password: "" });
    } catch (x) { setErr(mode === "login" && /40[13]/.test(x.message) ? "Wrong email or password." : x.message); }
    setBusy(false);
  }
  return (
    <>
      <div className={"veil" + (open ? " on" : "")} onClick={onClose} />
      <form className={"modal" + (open ? " on" : "")} onSubmit={submit} aria-hidden={!open}>
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <div className="tabs">
          <button type="button" className={"chip" + (mode === "login" ? " on" : "")} onClick={() => setMode("login")}>Log in</button>
          <button type="button" className={"chip" + (mode === "register" ? " on" : "")} onClick={() => setMode("register")}>Sign up</button>
        </div>
        {mode === "register" && <label className="field">Name<input required value={f.name} onChange={set("name")} /></label>}
        <label className="field">Email<input type="email" required value={f.email} onChange={set("email")} /></label>
        <label className="field">Password<input type="password" required minLength={4} value={f.password} onChange={set("password")} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn" style={{ width: "100%" }} disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button>
      </form>
    </>
  );
}

/* ---------- cart drawer ---------- */
function CartDrawer({ open, onClose, cart, onRemove, onCheckout, busy }) {
  const items = cart?.items || [];
  const total = items.reduce((s, i) => s + Number(i.priceAtTime) * i.quantity, 0);
  return (
    <>
      <div className={"veil" + (open ? " on" : "")} onClick={onClose} />
      <aside className={"drawer" + (open ? " on" : "")} aria-label="Shopping cart" aria-hidden={!open}>
        <header><h2>Your cart</h2><button className="x" onClick={onClose} aria-label="Close cart">✕</button></header>
        <div className="list">
          {items.length === 0 && <p className="empty">Your cart is empty. Add something you like.</p>}
          {items.map((i) => (
            <div className="line" key={i.id}>
              <Tile product={i.product} />
              <div style={{ flex: 1 }}><b>{i.product.name}</b><small>{i.quantity} × {money(i.priceAtTime)}</small></div>
              <b>{money(i.priceAtTime * i.quantity)}</b>
              <button className="x" onClick={() => onRemove(i.id)} aria-label={"Remove " + i.product.name}>✕</button>
            </div>
          ))}
        </div>
        <footer>
          <div className="row"><span>Total</span><span className="price">{money(total)}</span></div>
          <button className="btn" disabled={!items.length || busy} onClick={onCheckout}>{busy ? "Placing order…" : "Place order"}</button>
        </footer>
      </aside>
    </>
  );
}

/* ---------- orders ---------- */
function Orders({ orders }) {
  if (!orders) return <p className="empty">Loading your orders…</p>;
  if (!orders.length) return <p className="empty">No orders yet. Your purchases will show up here.</p>;
  return (
    <div className="orders">
      {[...orders].reverse().map((o, n) => (
        <article className="order" key={o.id} style={{ animationDelay: n * 60 + "ms" }}>
          <div className="row"><b>Order #{o.id}</b><span className={"pill " + o.status}>{o.status}</span></div>
          <small style={{ color: "var(--muted)" }}>{o.createdAt ? new Date(o.createdAt).toLocaleString() : ""}</small>
          <ul>{o.items.map((i) => <li key={i.id}>{i.quantity} × {i.product.name}</li>)}</ul>
          <div className="row"><span>Total</span><span className="price">{money(o.totalPrice)}</span></div>
        </article>
      ))}
    </div>
  );
}

/* ---------- admin panel ---------- */
function AdminPanel({ products, users, orders, token, onRefresh, api }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: "", description: "", price: "", stock: "", category: "", imageUrl: "" });

  if (!token) return <p className="empty">Please log in to view admin panel.</p>;

  const stats = {
    totalProducts: products?.length || 0,
    totalUsers: users?.length || 0,
    totalOrders: orders?.length || 0,
    totalRevenue: orders?.reduce((sum, o) => sum + (o.totalPrice || 0), 0) || 0,
    lowStock: products?.filter(p => p.stock > 0 && p.stock < 5).length || 0,
    outOfStock: products?.filter(p => p.stock <= 0).length || 0
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        ...productForm,
        price: parseFloat(productForm.price),
        stock: parseInt(productForm.stock)
      };
      if (editingProduct) {
        await api(`/products/${editingProduct.id}`, { method: "PUT", body: productData, token });
      } else {
        await api("/products", { method: "POST", body: productData, token });
      }
      setShowProductModal(false);
      setEditingProduct(null);
      setProductForm({ name: "", description: "", price: "", stock: "", category: "", imageUrl: "" });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || "",
      price: product.price,
      stock: product.stock,
      category: product.category || "",
      imageUrl: product.imageUrl || ""
    });
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (id) => {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        await api(`/products/${id}`, { method: "DELETE", token });
        onRefresh();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleUserRoleChange = async (userId, newRole) => {
    try {
      await api(`/users/${userId}/role`, { method: "PUT", body: { role: newRole }, token });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleOrderStatusChange = async (orderId, newStatus) => {
    try {
      await api(`/orders/${orderId}/status`, { method: "PUT", body: { status: newStatus }, token });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="admin-panel">
      <h1>Admin Dashboard</h1>

      <div className="chips" role="group" aria-label="Admin Tabs">
        {["dashboard", "products", "users", "orders"].map((t) => (
          <button key={t} className={"chip" + (activeTab === t ? " on" : "")} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && (
        <div className="dashboard-stats">
          <div className="stat-card" style={{ animationDelay: "0ms" }}>
            <div className="stat-icon">📦</div>
            <div className="stat-value">{stats.totalProducts}</div>
            <div className="stat-label">Total Products</div>
          </div>
          <div className="stat-card" style={{ animationDelay: "50ms" }}>
            <div className="stat-icon">👥</div>
            <div className="stat-value">{stats.totalUsers}</div>
            <div className="stat-label">Total Users</div>
          </div>
          <div className="stat-card" style={{ animationDelay: "100ms" }}>
            <div className="stat-icon">🛒</div>
            <div className="stat-value">{stats.totalOrders}</div>
            <div className="stat-label">Total Orders</div>
          </div>
          <div className="stat-card" style={{ animationDelay: "150ms" }}>
            <div className="stat-icon">💰</div>
            <div className="stat-value">{money(stats.totalRevenue)}</div>
            <div className="stat-label">Total Revenue</div>
          </div>
          <div className="stat-card" style={{ animationDelay: "200ms" }}>
            <div className="stat-icon">⚠️</div>
            <div className="stat-value">{stats.lowStock}</div>
            <div className="stat-label">Low Stock</div>
          </div>
          <div className="stat-card" style={{ animationDelay: "250ms" }}>
            <div className="stat-icon">❌</div>
            <div className="stat-value">{stats.outOfStock}</div>
            <div className="stat-label">Out of Stock</div>
          </div>
        </div>
      )}

      {activeTab === "products" && (
        <div className="data-table-container">
          <div className="table-title">
            <span>Products</span>
            <button className="btn" onClick={() => { setEditingProduct(null); setProductForm({ name: "", description: "", price: "", stock: "", category: "", imageUrl: "" }); setShowProductModal(true); }}>Add Product</button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products && products.map((p, i) => (
                <tr key={p.id} style={{ animationDelay: i * 30 + "ms" }}>
                  <td>{p.id}</td>
                  <td>{p.name}</td>
                  <td>{p.category || "-"}</td>
                  <td>{money(p.price)}</td>
                  <td><span className={p.stock <= 0 ? "pill CANCELLED" : p.stock < 5 ? "pill" : ""}>{p.stock <= 0 ? "Out of stock" : p.stock}</span></td>
                  <td>
                    <button className="btn ghost" style={{ padding: "4px 8px", fontSize: "0.8rem" }} onClick={() => handleEditProduct(p)}>Edit</button>
                    <button className="btn ghost" style={{ padding: "4px 8px", fontSize: "0.8rem", color: "var(--red)" }} onClick={() => handleDeleteProduct(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "users" && (
        <div className="data-table-container">
          <div className="table-title">Users</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users && users.map((u, i) => (
                <tr key={u.id} style={{ animationDelay: i * 30 + "ms" }}>
                  <td>{u.id}</td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className={"pill " + (u.role === "ADMIN" ? "CONFIRMED" : "")}>{u.role}</span></td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => handleUserRoleChange(u.id, e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--line)" }}
                    >
                      <option value="CUSTOMER">Customer</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "orders" && (
        <div className="data-table-container">
          <div className="table-title">Orders</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Status</th>
                <th>Total</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders && orders.map((o, i) => (
                <tr key={o.id} style={{ animationDelay: i * 30 + "ms" }}>
                  <td>{o.id}</td>
                  <td>{o.user?.name || o.user?.email || "-"}</td>
                  <td><span className={"pill " + o.status}>{o.status}</span></td>
                  <td>{money(o.totalPrice)}</td>
                  <td>
                    <select
                      value={o.status}
                      onChange={(e) => handleOrderStatusChange(o.id, e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--line)" }}
                    >
                      <option value="PENDING">Pending</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="SHIPPED">Shipped</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showProductModal && (
        <>
          <div className="veil on" onClick={() => setShowProductModal(false)} />
          <form className="modal on" onSubmit={handleProductSubmit}>
            <h2>{editingProduct ? "Edit Product" : "Add Product"}</h2>
            <label className="field">Name<input required value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></label>
            <label className="field">Description<textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows="3" style={{ width: "100%", padding: "11px 14px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--paper)" }} /></label>
            <label className="field">Price (USD)<input type="number" step="0.01" required value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></label>
            <label className="field">Stock<input type="number" required value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} /></label>
            <label className="field">Category<input value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })} /></label>
            <label className="field">Image URL<input value={productForm.imageUrl} onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })} /></label>
            <button className="btn" style={{ width: "100%" }}>{editingProduct ? "Update Product" : "Add Product"}</button>
          </form>
        </>
      )}
    </div>
  );
}

/* ---------- app ---------- */
function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("user") || "null"));
  const [products, setProducts] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [cart, setCart] = useState(null);
  const [orders, setOrders] = useState(null);
  const [allOrders, setAllOrders] = useState(null);
  const [users, setUsers] = useState(null);
  const [view, setView] = useState("shop");
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [bump, setBump] = useState(0);
  const timer = useRef();

  const say = (m) => { setToast(m); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(""), 2400); };
  const count = (cart?.items || []).reduce((s, i) => s + i.quantity, 0);

  useEffect(() => { api("/products").then(setProducts).catch(() => setLoadErr(`Can't reach the store. Is the server running?`)); }, []);

  useEffect(() => {
    if (!token || !user) return;
    api(`/carts/${user.id}`, { token }).then(setCart).catch((e) => e.message.includes("403") && logout());
  }, [token, user]);

  useEffect(() => {
    if (view === "orders" && token && user) { setOrders(null); api(`/orders/user/${user.id}`, { token }).then(setOrders).catch((e) => say(e.message)); }
  }, [view, token, user]);

  useEffect(() => {
    if (view === "database" && token) {
      api("/orders", { token }).then(setAllOrders).catch((e) => say(e.message));
      api("/users", { token }).then(setUsers).catch((e) => say(e.message));
    }
  }, [view, token]);

  const refreshDatabase = async () => {
    if (token) {
      setProducts(await api("/products"));
      setAllOrders(await api("/orders", { token }));
      setUsers(await api("/users", { token }));
      say("Database tables refreshed");
    }
  };

  function login(t, u) {
    localStorage.setItem("token", t); localStorage.setItem("user", JSON.stringify(u));
    setToken(t); setUser(u); setAuthOpen(false); say(`Welcome, ${u.name}`);
  }
  function logout() {
    localStorage.clear(); setToken(null); setUser(null); setCart(null); setOrders(null); setView("shop");
  }

  async function add(p) {
    if (!token) return setAuthOpen(true);
    try {
      setCart(await api(`/carts/${user.id}/items?productId=${p.id}&quantity=1`, { method: "POST", token }));
      setBump((b) => b + 1); say(`${p.name} added to cart`);
    } catch (e) { say(e.message); }
  }
  async function remove(itemId) {
    try { await api(`/carts/${user.id}/items/${itemId}`, { method: "DELETE", token }); setCart(await api(`/carts/${user.id}`, { token })); }
    catch (e) { say(e.message); }
  }
  async function checkout() {
    setBusy(true);
    try {
      const o = await api(`/orders/${user.id}`, { method: "POST", token });
      setCart(await api(`/carts/${user.id}`, { token }));
      // Refresh products to show updated stock
      setProducts(await api("/products"));
      setCartOpen(false); setView("orders"); say(`Order #${o.id} placed`);
    } catch (e) { say(e.message); }
    setBusy(false);
  }

  const cats = useMemo(() => ["All", ...new Set((products || []).map((p) => p.category).filter(Boolean))], [products]);
  const uniqueProducts = useMemo(() => {
    const seen = new Set();
    return (products || []).filter(p => {
      const key = `${p.id}-${p.name}-${p.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [products]);
  const shown = uniqueProducts.filter((p) => (cat === "All" || p.category === cat) && (p.name + (p.description || "")).toLowerCase().includes(q.toLowerCase()));
  const heroItems = uniqueProducts.slice(0, 4);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <button className="brand" onClick={() => setView("shop")}><i />DeshKart</button>
          <nav className="nav">
            <button className={view === "shop" ? "on" : ""} onClick={() => setView("shop")}>Shop</button>
            {user && <button className={view === "orders" ? "on" : ""} onClick={() => setView("orders")}>My orders</button>}
            {user && user.role === "ADMIN" && <button className={view === "database" ? "on" : ""} onClick={() => setView("database")}>Admin Panel</button>}
          </nav>
          <div className="search"><input placeholder="Search products" aria-label="Search products" value={q} onChange={(e) => { setQ(e.target.value); setView("shop"); }} /></div>
          {user ? <button className="btn ghost" onClick={logout}>Log out</button> : <button className="btn ghost" onClick={() => setAuthOpen(true)}>Log in</button>}
          <button className="btn cartbtn" onClick={() => (token ? setCartOpen(true) : setAuthOpen(true))} aria-label={`Open cart, ${count} items`}>
            Cart{count > 0 && <span key={bump} className="badge bump">{count}</span>}
          </button>
        </div>
      </header>

      <main className="wrap">
        {view === "orders" ? <Orders orders={orders} /> : view === "database" ? <AdminPanel products={products} users={users} orders={allOrders} token={token} onRefresh={refreshDatabase} api={api} /> : (
          <>
            <section className="hero">
              <div>
                <h1>Good things, shipped fast.</h1>
                <p>Browse the catalogue, fill your cart and track every order from one place.</p>
                <a className="btn" href="#products" style={{ display: "inline-block", textDecoration: "none" }}>Browse products</a>
              </div>
              <div className="stage" aria-hidden="true">
                {(heroItems.length ? heroItems : [{ name: "New", category: "a" }, { name: "Fresh", category: "b" }, { name: "Top", category: "c" }]).map((p, i) => (
                  <div className="float" key={i}><Tile product={p} /><span>{p.name}</span></div>
                ))}
              </div>
            </section>

            <section id="products">
              <div className="chips" role="group" aria-label="Categories">
                {cats.map((c) => <button key={c} className={"chip" + (c === cat ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}
              </div>
              {loadErr && <p className="empty">{loadErr}</p>}
              {!loadErr && products === null && <p className="empty">Loading products…</p>}
              {products && !shown.length && <p className="empty">{products.length ? "Nothing matches your search." : "No products yet. An admin can add some through Swagger (POST /products)."}</p>}
              <div className="grid">
                {shown.map((p, i) => (
                  <article className={"card" + (p.stock <= 0 ? " out-of-stock" : "")} key={p.id} style={{ animationDelay: Math.min(i, 10) * 50 + "ms" }}>
                    <Tile product={p} />
                    {p.stock <= 0 && <div className="sold-out-badge">Sold Out</div>}
                    {p.stock > 0 && p.stock < 5 && <div className="low-stock-badge">Only {p.stock} left</div>}
                    <div className="body">
                      <h3>{p.name}</h3>
                      <p className="desc">{p.description}</p>
                      <span className={"stock" + (p.stock > 0 && p.stock < 5 ? " low" : "")}>{p.stock > 5 ? "In stock" : p.stock > 0 ? `Only ${p.stock} left` : "Out of stock"}</span>
                      <div className="row">
                        <span className="price">{money(p.price)}</span>
                        <button className="btn" disabled={!(p.stock > 0)} onClick={() => add(p)}>{p.stock > 0 ? "Add to cart" : "Unavailable"}</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onDone={login} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} cart={cart} onRemove={remove} onCheckout={checkout} busy={busy} />
      <div className={"toast" + (toast ? " on" : "")} role="status">{toast}</div>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
