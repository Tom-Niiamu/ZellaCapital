import { supabase } from './supabase.js'

// Now you can use it
const { data } = await supabase.from('todos').select('*')
const walletForm = document.getElementById('walletForm');
const walletAddressInput = document.getElementById('walletAddressInput');
const walletMessage = document.getElementById('walletMessage');

function setWalletMessage(message, type = 'success') {
  if (!walletMessage) return;
  walletMessage.textContent = message;
  walletMessage.className = `wallet-message ${type}`.trim();
}

async function submitWalletAddress(address) {
  const currentUser = window.__zellaCurrentUser || (await window.zellaDatabase?.getCurrentUser?.());
  const submission = {
    type: 'wallet_submit',
    walletAddress: address,
    email: currentUser?.email || '',
    fullName: currentUser?.fullName || '',
    submittedAt: new Date().toISOString(),
  };

  // Backend removed: wallet submissions are stored locally in the browser.
  const submissionsKey = 'zella_wallet_submissions';
  let submissions = [];
  try {
    submissions = JSON.parse(localStorage.getItem(submissionsKey) || '[]');
  } catch (error) {
    console.warn('Unable to read local wallet submissions.', error);
    submissions = [];
  }
  submissions.push(submission);
  localStorage.setItem(submissionsKey, JSON.stringify(submissions));

  return { ok: true, local: true, submission };
}

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
      setWalletMessage('Wallet address submitted successfully.');
      walletForm.reset();
    } catch (error) {
      console.error(error);
      setWalletMessage('Unable to submit wallet address right now.', 'error');
    }
  });
}
