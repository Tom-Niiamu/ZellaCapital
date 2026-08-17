import { supabase } from './supabase.js'

// Now you can use it
const { data } = await supabase.from('todos').select('*')
const checkinRows = document.querySelectorAll('.checkin-table .table-row[data-vip]');
const receiveMessage = document.getElementById('receiveMessage');
const toast = document.getElementById('toast');
const receiveButton = document.querySelector('.confirm-btn');
let selectedVip = 'VIP1';
let toastTimeout = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

function selectVip(row) {
  checkinRows.forEach((item) => {
    item.classList.toggle('selected', item === row);
  });

  selectedVip = row.dataset.vip;
  receiveMessage.textContent = `Selected VIP: ${selectedVip}`;
}

checkinRows.forEach((row) => {
  row.addEventListener('click', () => selectVip(row));
});

receiveButton.addEventListener('click', () => {
  if (!selectedVip) return;
  const message = `Received reward for ${selectedVip}`;
  receiveMessage.textContent = message;
  showToast(message);
});

selectVip(document.querySelector('.checkin-table .table-row[data-vip]'));
