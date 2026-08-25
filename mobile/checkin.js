import { supabase } from './supabase.js';

const confirmBtn = document.querySelector('.confirm-btn');
const receiveMessage = document.getElementById('receiveMessage');
const toast = document.getElementById('toast');
const vipRows = document.querySelectorAll('.table-row[data-vip]');

let selectedVip = 'VIP1';

function showToast(message, isError) {
  toast.textContent = message;
  toast.className = 'toast' + (isError ? ' error' : ' visible');
  setTimeout(() => {
    toast.className = 'toast';
  }, 4000);
}

// VIP selection
vipRows.forEach(row => {
  row.addEventListener('click', () => {
    vipRows.forEach(r => r.classList.remove('active'));
    row.classList.add('active');
    selectedVip = row.dataset.vip;
    const reward = row.querySelector('span:last-child').textContent;
    receiveMessage.textContent = 'Selected: ' + selectedVip + ' (' + reward + ')';
  });
});

// Check if already checked in today
async function loadCheckInStatus() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: todayCheckIn } = await supabase
      .from('check_ins')
      .select('streak_count, reward_amount, check_in_date')
      .eq('user_id', user.id)
      .eq('check_in_date', new Date().toISOString().split('T')[0])
      .single();

    if (todayCheckIn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Received';
      receiveMessage.textContent = 'Already checked in today! Streak: ' + todayCheckIn.streak_count + ' days';
    } else {
      // Get streak count from yesterday
      const { data: yesterday } = await supabase
        .from('check_ins')
        .select('streak_count')
        .eq('user_id', user.id)
        .eq('check_in_date', new Date(Date.now() - 86400000).toISOString().split('T')[0])
        .single();

      const streak = yesterday?.streak_count || 0;
      if (streak > 0) {
        receiveMessage.textContent = 'Current streak: ' + streak + ' days. Tap Receive to continue!';
      }
    }
  } catch (e) {
    // No check-in today, button stays active
  }
}

// Receive button
confirmBtn.addEventListener('click', async () => {
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Processing...';

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      showToast('Please log in first.', true);
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Receive';
      return;
    }

    const { data, error } = await supabase.rpc('daily_check_in', {
      p_user_id: user.id
    });

    if (error) throw error;

    if (data.success) {
      showToast('+$' + data.reward + ' received! Streak: ' + data.streak + ' days');
      receiveMessage.textContent = 'Checked in! Streak: ' + data.streak + ' days | Reward: $' + data.reward;
      confirmBtn.textContent = 'Received';
    } else {
      showToast(data.message, true);
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Receive';
    }

  } catch (err) {
    console.error('Check-in error:', err);
    showToast('Check-in failed. Try again.', true);
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Receive';
  }
});

// Init
loadCheckInStatus();