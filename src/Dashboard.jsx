import { useState, useEffect } from 'react';
import './App.css';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';

const API_URL = 'https://gorbfkap7d.execute-api.us-east-1.amazonaws.com/prod/';

function getUrgencyClass(expiryDate) {
  const daysLeft = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
  if (daysLeft <= 2) return 'urgent';
  if (daysLeft <= 5) return 'soon';
  return 'safe';
}

let toastIdCounter = 0;

function Dashboard({ user }) {
  const isGuest = user.isAnonymous;

  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const [showPremiumPromo, setShowPremiumPromo] = useState(false);

  const [selectedItems, setSelectedItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [showCookInfo, setShowCookInfo] = useState(false);

  const [limitReached, setLimitReached] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [removingItemId, setRemovingItemId] = useState(null);
  const [markUsedLoadingId, setMarkUsedLoadingId] = useState(null);

  const [finishedItems, setFinishedItems] = useState([]);
  const [showUsedItems, setShowUsedItems] = useState(false);
  const [recoverError, setRecoverError] = useState('');
  const [recoverLoadingId, setRecoverLoadingId] = useState(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [loadingUsedItems, setLoadingUsedItems] = useState(false);

  const [editingItem, setEditingItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [toasts, setToasts] = useState([]);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);

  function showToast(message, type = 'success') {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1500);
  }

  function requireAccount() {
    setShowGuestPrompt(true);
  }

  function handleLogout() {
    signOut(auth);
  }

  useEffect(() => {
    fetch(`${API_URL}/items?userId=${user.uid}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items));
  }, [user.uid]);

  async function handleAddItem(e) {
    e.preventDefault();

    if (isGuest) {
      requireAccount();
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, quantity, expiryDate, userId: user.uid }),
      });

      if (res.status === 403) {
        setLimitReached(true);
        return;
      }

      const data = await res.json();
      setItems([...items, data.item]);

      setName('');
      setQuantity('');
      setExpiryDate('');
      setLimitReached(false);
      showToast('Item added successfully.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMarkUsed(itemId, itemName, quantity, expiryDate) {
    if (isGuest) {
      requireAccount();
      return;
    }

    setMarkUsedLoadingId(itemId);

    try {
      await fetch(`${API_URL}/mark-used`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, name: itemName, userId: user.uid, quantity, expiryDate }),
      });

      setMarkUsedLoadingId(null);
      setRemovingItemId(itemId);

      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.itemId !== itemId));
        setRemovingItemId(null);
        setLimitReached(false);
        showToast(`"${itemName}" marked as used.`);
      }, 280);
    } catch {
      setMarkUsedLoadingId(null);
      showToast('Something went wrong. Please try again.', 'error');
    }
  }

  function getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  // ---------- Shopping List (Premium feature) ----------
  function handleShowShoppingList() {
    if (isGuest) {
      requireAccount();
      return;
    }
    setShowPremiumPromo(true);
  }

  // ---------- Cook Something ----------
  function toggleSelectItem(itemId) {
    if (isGuest) {
      requireAccount();
      return;
    }
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter((id) => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  }

  async function handleCookSomething() {
    if (isGuest) {
      requireAccount();
      return;
    }

    setLoadingRecipes(true);
    setShowCookInfo(true);

    const selectedNames = items
      .filter((item) => selectedItems.includes(item.itemId))
      .map((item) => item.name);

    const res = await fetch(`${API_URL}/cook-something`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients: selectedNames }),
    });

    const data = await res.json();
    setRecipes(data.recipes);
    setLoadingRecipes(false);
  }

  function handleCloseRecipes() {
    setRecipes([]);
    setShowCookInfo(false);
    setSelectedItems([]);
  }

  // ---------- Used Items ----------
  async function handleShowUsedItems() {
    if (isGuest) {
      requireAccount();
      return;
    }

    setLoadingUsedItems(true);
    setShowUsedItems(true);
    setRecoverError('');

    const res = await fetch(`${API_URL}/finished-items?userId=${user.uid}`);
    const data = await res.json();
    setFinishedItems(data.finishedItems);
    setLoadingUsedItems(false);
  }

  async function handleRecoverItem(item) {
    setRecoverError('');
    setRecoverLoadingId(item.itemId);

    try {
      const res = await fetch(`${API_URL}/recover-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.itemId,
          userId: user.uid,
          name: item.name,
          quantity: item.quantity,
          expiryDate: item.expiryDate,
        }),
      });

      if (res.status === 403) {
        const data = await res.json();
        setRecoverError(data.message);
        return;
      }

      const data = await res.json();
      setItems((prev) => [...prev, data.item]);
      setFinishedItems((prev) => prev.filter((fi) => fi.itemId !== item.itemId));
      showToast(`"${item.name}" recovered to your pantry.`);
    } finally {
      setRecoverLoadingId(null);
    }
  }

  async function handleDeleteFinished(item) {
    setDeleteLoadingId(item.itemId);

    try {
      await fetch(`${API_URL}/delete-finished`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.itemId, userId: user.uid }),
      });

      setFinishedItems((prev) => prev.filter((fi) => fi.itemId !== item.itemId));
      showToast(`"${item.name}" removed from history.`);
    } finally {
      setDeleteLoadingId(null);
    }
  }

  // ---------- Edit Item ----------
  function handleOpenEdit(item) {
    if (isGuest) {
      requireAccount();
      return;
    }
    setEditingItem(item);
    setEditName(item.name);
    setEditQuantity(item.quantity);
    setEditExpiryDate(item.expiryDate);
  }

  function handleCloseEdit() {
    setEditingItem(null);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setIsSavingEdit(true);

    try {
      const res = await fetch(`${API_URL}/update-item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: editingItem.itemId,
          userId: user.uid,
          name: editName,
          quantity: editQuantity,
          expiryDate: editExpiryDate,
        }),
      });

      const data = await res.json();

      setItems((prev) =>
        prev.map((item) => (item.itemId === data.item.itemId ? data.item : item))
      );

      setEditingItem(null);
      showToast('Changes saved.');
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <div className="app">
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>

      <div className="profile-info">
        {isGuest ? (
          <>
            <div className="profile-avatar-fallback">G</div>
            <span className="profile-name">Guest</span>
          </>
        ) : user.photoURL ? (
          <>
            <img src={user.photoURL} alt="Profile" className="profile-avatar" />
            <span className="profile-name">{user.displayName || user.email}</span>
          </>
        ) : (
          <>
            <div className="profile-avatar-fallback">
              {(user.displayName || user.email || '?')[0].toUpperCase()}
            </div>
            <span className="profile-name">{user.displayName || user.email}</span>
          </>
        )}
      </div>

      <div className="brand-header">
        <img src="/logo.png" alt="Shelf Life" className="brand-logo" />
        <h1>Shelf Life</h1>
      </div>
      <p>Your pantry, tracked.</p>
      <button onClick={handleLogout} className="logout-btn">Log Out</button>

      <form onSubmit={handleAddItem} className="add-form">
        <input
          type="text"
          placeholder="Item name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Quantity"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          min={getTomorrowDate()}
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <span className="spinner" /> : 'Add Item'}
        </button>
      </form>

      {limitReached && (
        <div className="limit-banner banner-in">
          <p>You've reached the free plan limit. Upgrade to add unlimited items.</p>
          <a
            href="https://shelflife.framer.website/"
            target="_blank"
            rel="noopener noreferrer"
            className="upgrade-btn"
          >
            Upgrade
          </a>
        </div>
      )}

      <div className="action-bar">
        <button onClick={handleShowShoppingList} className="premium-action-btn">
          Shopping List Suggestions
          <span className="premium-badge">PRO</span>
        </button>
        <button onClick={handleCookSomething} disabled={selectedItems.length === 0 && !isGuest}>
          Cook Something ({selectedItems.length} selected)
        </button>
        <button onClick={handleShowUsedItems}>
          Used Items
        </button>
      </div>

      {showPremiumPromo && (
        <div className="limit-banner banner-in">
          <h4>Shopping List Suggestions is a Premium feature</h4>
          <p>
            This feature automatically builds a smart shopping list based on the
            items you've recently marked as used — so you never forget to
            restock the things you actually go through. Upgrade to unlock it.
          </p>
          <div className="premium-promo-actions">
            <a
              href="https://shelflife.framer.website/"
              target="_blank"
              rel="noopener noreferrer"
              className="upgrade-btn"
            >
              Upgrade
            </a>
            <button
              className="premium-dismiss-btn"
              onClick={() => setShowPremiumPromo(false)}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      <div className="item-list">
        {items.map((item, index) => (
          <div
            key={item.itemId}
            className={`item-card ${getUrgencyClass(item.expiryDate)} ${
              removingItemId === item.itemId ? 'removing' : ''
            }`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <input
              type="checkbox"
              checked={selectedItems.includes(item.itemId)}
              onChange={() => toggleSelectItem(item.itemId)}
            />
            <h3>{item.name}</h3>
            <p>Qty: {item.quantity}</p>
            <p>Expires: {item.expiryDate}</p>
            <div className="item-card-actions">
              <button
                onClick={() => handleMarkUsed(item.itemId, item.name, item.quantity, item.expiryDate)}
                disabled={markUsedLoadingId === item.itemId}
              >
                {markUsedLoadingId === item.itemId ? <span className="spinner" /> : 'Mark as Used'}
              </button>
              <button onClick={() => handleOpenEdit(item)}>Edit</button>
            </div>
          </div>
        ))}
      </div>

      {showUsedItems && (
        <div className="used-items-section">
          <div className="recipe-list-header">
            <h3>Used Items</h3>
            <button className="close-recipes-btn" onClick={() => setShowUsedItems(false)}>✕</button>
          </div>

          {recoverError && <p className="error-text">{recoverError}</p>}

          {loadingUsedItems ? (
            <p>Loading...</p>
          ) : finishedItems.length === 0 ? (
            <p>No used items yet.</p>
          ) : (
            <div className="used-items-list">
              {finishedItems.map((item) => (
                <div key={item.itemId} className="used-item-row">
                  <div>
                    <strong>{item.name}</strong>
                    <span className="used-item-meta"> — Qty: {item.quantity} — Used on {new Date(item.finishedDate).toLocaleDateString()}</span>
                  </div>
                  <div className="used-item-actions">
                    <button
                      onClick={() => handleRecoverItem(item)}
                      disabled={recoverLoadingId === item.itemId}
                    >
                      {recoverLoadingId === item.itemId ? <span className="spinner" /> : 'Recover'}
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteFinished(item)}
                      disabled={deleteLoadingId === item.itemId}
                    >
                      {deleteLoadingId === item.itemId ? <span className="spinner" /> : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCookInfo && (
        <div className="cook-info-box">
          <h4>How "Cook Something" works</h4>
          <p>
            We search each ingredient you selected separately and show you the
            top matching recipes for each one — so results may include recipes
            that only use one of your ingredients, not all of them together.
          </p>
          <p className="coming-soon-tag">
            🔜 Coming soon: AI-powered smart recipes that combine <em>all</em> your selected ingredients into a single dish suggestion.
          </p>
        </div>
      )}

      {loadingRecipes && <p>Finding recipes...</p>}

      {recipes.length > 0 && (
        <div className="recipe-list">
          <div className="recipe-list-header">
            <h3>Recipe Suggestions</h3>
            <button className="close-recipes-btn" onClick={handleCloseRecipes}>✕</button>
          </div>
          <div className="recipe-grid">
            {recipes.map((recipe) => (
              <div key={recipe.idMeal} className="recipe-card">
                <img src={recipe.strMealThumb} alt={recipe.strMeal} />
                <p>{recipe.strMeal}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingItem && (
        <div className="modal-overlay" onClick={handleCloseEdit}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="recipe-list-header">
              <h3>Edit Item</h3>
              <button className="close-recipes-btn" onClick={handleCloseEdit}>✕</button>
            </div>
            <form onSubmit={handleSaveEdit} className="modal-form">
              <label>
                Item name
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </label>
              <label>
                Quantity
                <input
                  type="text"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  required
                />
              </label>
              <label>
                Expiry date
                <input
                  type="date"
                  value={editExpiryDate}
                  onChange={(e) => setEditExpiryDate(e.target.value)}
                  required
                />
              </label>
              <button type="submit" disabled={isSavingEdit} className="modal-save-btn">
                {isSavingEdit ? <span className="spinner" /> : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showGuestPrompt && (
        <div className="modal-overlay" onClick={() => setShowGuestPrompt(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="recipe-list-header">
              <h3>Sign in to continue</h3>
              <button className="close-recipes-btn" onClick={() => setShowGuestPrompt(false)}>✕</button>
            </div>
            <p style={{ color: '#4A4368', marginBottom: '16px' }}>
              You're browsing as a guest. Create a free account to add items,
              track expiry dates, and unlock the rest of Shelf Life.
            </p>
            <button
              className="modal-save-btn"
              onClick={() => { handleLogout(); setShowGuestPrompt(false); }}
            >
              Sign Up / Log In
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;