import { supabase } from './supabase.js'

// Now you can use it
const { data } = await supabase.from('todos').select('*')
const inviteInput = document.getElementById('inviteCount');
const productSelect = document.getElementById('productSelect');
const calculateButton = document.querySelector('.confirm-btn');
const resultLines = document.querySelectorAll('.result-line');

const productRates = {
  'P-9000': { daily: 12, monthly: 360, total: 1080 },
  'P-9001': { daily: 18, monthly: 540, total: 1620 },
  'P-9002': { daily: 26, monthly: 780, total: 2340 },
};

const customSelectWidgets = [];

function createCustomDropdown(select) {
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-dropdown';
  const labelText = select.getAttribute('aria-label') || document.querySelector(`label[for="${select.id}"]`)?.textContent.trim() || select.id;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'custom-dropdown-toggle';
  toggle.setAttribute('aria-haspopup', 'listbox');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', `${select.id}-custom-listbox`);
  toggle.setAttribute('aria-label', labelText);

  const valueSpan = document.createElement('span');
  valueSpan.className = 'custom-dropdown-value';
  const arrow = document.createElement('span');
  arrow.className = 'custom-dropdown-arrow';
  toggle.append(valueSpan, arrow);

  const optionsPanel = document.createElement('div');
  optionsPanel.className = 'custom-dropdown-options';
  optionsPanel.setAttribute('role', 'listbox');
  optionsPanel.setAttribute('aria-label', labelText);
  optionsPanel.id = `${select.id}-custom-listbox`;

  const optionButtons = [];
  Array.from(select.options).forEach((option, index) => {
    const item = document.createElement('div');
    item.className = 'custom-dropdown-option';
    item.role = 'option';
    item.tabIndex = -1;
    item.dataset.value = option.value;
    item.textContent = option.textContent;
    item.setAttribute('aria-selected', option.selected ? 'true' : 'false');
    if (option.disabled) {
      item.setAttribute('aria-disabled', 'true');
    }
    if (option.selected) {
      item.classList.add('selected');
      valueSpan.textContent = option.textContent;
    }
    item.addEventListener('click', () => selectOption(index));
    item.addEventListener('keydown', optionKeydown);
    optionsPanel.appendChild(item);
    optionButtons.push(item);
  });

  if (!valueSpan.textContent) {
    valueSpan.textContent = select.options[select.selectedIndex]?.textContent || select.options[0]?.textContent || '';
  }

  wrapper.append(toggle, optionsPanel);
  select.insertAdjacentElement('afterend', wrapper);
  select.classList.add('custom-select-hidden');
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;

  let activeItemIndex = select.selectedIndex >= 0 ? select.selectedIndex : 0;

  function updateSelection(index, sendChange = true) {
    optionButtons.forEach((item, itemIndex) => {
      const selected = itemIndex === index;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    const selectedOption = select.options[index];
    if (!selectedOption) return;
    valueSpan.textContent = selectedOption.textContent;
    select.value = selectedOption.value;
    if (sendChange) {
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function openDropdown() {
    closeAllCustomDropdowns(wrapper);
    wrapper.classList.add('open');
    optionsPanel.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    activeItemIndex = select.selectedIndex >= 0 ? select.selectedIndex : 0;
    optionButtons[activeItemIndex]?.focus();
  }

  function closeDropdown() {
    wrapper.classList.remove('open');
    optionsPanel.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  function selectOption(index) {
    updateSelection(index);
    closeDropdown();
    toggle.focus();
  }

  function moveFocus(offset) {
    activeItemIndex = (activeItemIndex + offset + optionButtons.length) % optionButtons.length;
    optionButtons[activeItemIndex]?.focus();
  }

  function toggleDropdown() {
    if (optionsPanel.classList.contains('open')) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  function optionKeydown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectOption(activeItemIndex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown();
      toggle.focus();
    }
  }

  function toggleKeydown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openDropdown();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleDropdown();
    } else if (event.key === 'Escape') {
      if (optionsPanel.classList.contains('open')) {
        event.preventDefault();
        closeDropdown();
      }
    }
  }

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    toggleDropdown();
  });
  toggle.addEventListener('keydown', toggleKeydown);

  document.querySelectorAll(`label[for="${select.id}"]`).forEach((label) => {
    label.addEventListener('click', (event) => {
      event.preventDefault();
      toggle.focus();
      toggleDropdown();
    });
  });

  customSelectWidgets.push({ wrapper, close: closeDropdown });
}

function closeAllCustomDropdowns(except = null) {
  customSelectWidgets.forEach((widget) => {
    if (widget.wrapper !== except) {
      widget.close();
    }
  });
}

function initCustomDropdowns() {
  document.querySelectorAll('select').forEach(createCustomDropdown);
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.custom-dropdown')) {
      closeAllCustomDropdowns();
    }
  });
}

function formatCurrency(value) {
  return `$${value.toLocaleString()}`;
}

function updateResults() {
  const invites = Number(inviteInput.value);
  const product = productSelect.value;
  const rate = productRates[product];

  if (invites < 2) {
    resultLines[0].textContent = 'Invite 2 or more people to calculate earnings.';
    resultLines[1].textContent = 'Your team monthly income will be shown here.';
    resultLines[2].textContent = 'Your team total income will be shown here.';
    return;
  }

  const multiplier = invites;
  const daily = rate.daily * multiplier;
  const monthly = rate.monthly * multiplier;
  const total = rate.total * multiplier;

  resultLines[0].textContent = `Your daily team earnings will be ${formatCurrency(daily)}.`;
  resultLines[1].textContent = `Your team's monthly income will be ${formatCurrency(monthly)}.`;
  resultLines[2].textContent = `Your team's total income will be ${formatCurrency(total)}.`;
}

calculateButton.addEventListener('click', updateResults);
inviteInput.addEventListener('input', updateResults);
productSelect.addEventListener('change', updateResults);

initCustomDropdowns();
updateResults();
