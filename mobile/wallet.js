import { supabase } from './supabase.js'

// ===== DEBUG: Check auth status =====
async function debugAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Supabase user:', user);
  
  if (!user) {
    console.log('No Supabase user found. Checking custom auth...');
    console.log('window.__zellaCurrentUser:', window.__zellaCurrentUser);
    console.log('window.zellaDatabase:', window.zellaDatabase);
  }
}
debugAuth();
// ===== END DEBUG =====

const walletForm = document.getElementById('walletForm');
const walletAddressInput = document.getElementById('walletAddressInput');
const walletMessage = document.getElementById('walletMessage');

// Optional: Add these elements to your HTML if you want to show balance/history
const walletBalanceEl = document.getElementById('walletBalance');
const walletTransactionsEl = document.getElementById('walletTransactions');

function setWalletMessage(message, type = 'success') {
  if (!walletMessage) return;
  walletMessage.textContent = message;
  walletMessage.className = `wallet-message ${type}`.trim();
}

// Format currency
function formatMoney(amount) {
  return '$' + Number(amount || 0).toFixed(2);
}

// Get current user
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Load wallet data: balance, transactions, withdrawal address
async function loadWalletData() {
  const user = await getCurrentUser();
  if (!user) {
    setWalletMessage('Please log in to view wallet.', 'error');
    return;
  }

  // 1. Fetch wallet balance
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('balance, currency')
    .eq('user_id', user.id)
    .single();

  if (walletError) {
    console.error('Wallet fetch error:', walletError);
  }

  // 2. Fetch transaction history (last 10)
  const { data: transactions, error: txnError } = await supabase
    .from('transactions')
    .select('type, amount, direction, balance_after, description, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (txnError) {
    console.error('Transaction fetch error:', txnError);
  }

  // 3. Fetch profile (for withdrawal address)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('withdrawal_address, full_name')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Profile fetch error:', profileError);
  }

  // Update UI
  if (walletBalanceEl && wallet) {
    walletBalanceEl.textContent = formatMoney(wallet.balance);
  }

  if (walletAddressInput && profile?.withdrawal_address) {
    walletAddressInput.value = profile.withdrawal_address;
  }

  if (walletTransactionsEl && transactions) {
    walletTransactionsEl.innerHTML = transactions.map(t => `
      <div class="txn-row ${t.direction}">
        <span class="txn-type">${t.type}</span>
        <span class="txn-amount ${t.direction}">${t.direction === 'credit' ? '+' : '-'}${formatMoney(t.amount)}</span>
        <span class="txn-desc">${t.description || ''}</span>
        <span class="txn-date">${new Date(t.created_at).toLocaleDateString()}</span>
      </div>
    `).join('');
  }
}

// Save withdrawal address to Supabase (replaces localStorage)
async function submitWalletAddress(address) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Not logged in');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ withdrawal_address: address })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Save error:', error);
    throw new Error('Failed to save wallet address');
  }

  return { ok: true, saved: data };
}

// Form submit
if (walletForm) {
  walletForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setWalletMessage('');

    const address = walletAddressInput?.value?.trim();
    if (!address) {
      setWalletMessage('Please enter a wallet address.', 'error');
      return;
    }

    try {
      await submitWalletAddress(address);
      setWalletMessage('Wallet address saved to your account.');
      walletForm.reset();
    } catch (error) {
      console.error(error);
      setWalletMessage(error.message || 'Unable to save wallet address.', 'error');
    }
  });
}

// Load data on page load
loadWalletData();