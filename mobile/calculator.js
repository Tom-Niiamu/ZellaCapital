import { supabase } from './supabase.js';

const inviteCountInput = document.getElementById('inviteCount');
const productSelect = document.getElementById('productSelect');
const confirmBtn = document.querySelector('.confirm-btn');
const resultsCard = document.querySelector('.results-card');

// Earnings per person per day for each product
const productRates = {
  'P-9000': 2.00,   // $2/day per person
  'P-9001': 5.00,   // $5/day per person
  'P-9002': 10.00   // $10/day per person
};

function formatMoney(amount) {
  return '$' + Number(amount || 0).toFixed(2);
}

// Load previous calculations
async function loadHistory() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('calculator_history')
      .select('calculator_type, inputs, result, notes, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error || !data || data.length === 0) return;

    // Add history section if not exists
    let historySection = document.querySelector('.calc-history');
    if (!historySection) {
      historySection = document.createElement('div');
      historySection.className = 'calc-history';
      historySection.style.cssText = 'margin-top:24px;padding:20px;border-radius:18px;background:rgba(255,255,255,0.05);border:1px solid rgba(148,163,184,0.18);';
      resultsCard.parentNode.insertBefore(historySection, resultsCard.nextSibling);
    }

    historySection.innerHTML = '<h3 style="margin:0 0 12px;font-size:1rem;color:var(--text);">Recent Calculations</h3>' +
      data.map(c => {
        const inputs = c.inputs || {};
        return '<div style="padding:10px 14px;border-radius:12px;background:rgba(255,255,255,0.03);margin-bottom:8px;font-size:0.85rem;color:#cbd5e1;">' +
          '<strong>' + inputs.product + '</strong> — ' + (inputs.invite_count || 0) + ' people — ' +
          '<span style="color:#2dd4bf;">' + formatMoney(c.result) + '/day</span>' +
          '<span style="float:right;color:#94a3b8;">' + new Date(c.created_at).toLocaleDateString() + '</span>' +
          '</div>';
      }).join('');
  } catch (e) {
    console.error('History load error:', e);
  }
}

// Save calculation to database
async function saveCalculation(invites, product, daily, monthly, total) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please log in to save calculations.');
      return;
    }

    const { error } = await supabase
      .from('calculator_history')
      .insert({
        user_id: user.id,
        calculator_type: 'team_earnings',
        inputs: { invite_count: invites, product: product },
        result: daily,
        notes: 'Daily: ' + formatMoney(daily) + ', Monthly: ' + formatMoney(monthly)
      });

    if (error) {
      console.error('Save error:', error);
    } else {
      loadHistory(); // Refresh history
    }
  } catch (e) {
    console.error('Save failed:', e);
  }
}

// Calculate button
confirmBtn.addEventListener('click', async () => {
  const invites = parseInt(inviteCountInput.value) || 0;
  const product = productSelect.value;
  const rate = productRates[product] || 2.00;

  if (invites < 2) {
    resultsCard.innerHTML = `
      <p class="result-line" style="color:#f87171;font-weight:700;">Invite 2 or more people to see your estimated earnings.</p>
    `;
    return;
  }

  const daily = invites * rate;
  const monthly = daily * 30;
  const total = monthly * 12; // Annual

  resultsCard.innerHTML = `
    <p class="result-line">Your daily team earnings will be <strong style="color:#2dd4bf;font-size:1.3rem;">${formatMoney(daily)}</strong></p>
    <p class="result-line">Your team's monthly income will be <strong style="color:#2dd4bf;font-size:1.3rem;">${formatMoney(monthly)}</strong></p>
    <p class="result-line">Your team's total income will be <strong style="color:#2dd4bf;font-size:1.3rem;">${formatMoney(total)}</strong></p>
  `;

  await saveCalculation(invites, product, daily, monthly, total);
});

// Load history on page load
loadHistory();