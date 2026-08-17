import { supabase } from './supabase.js'

function normalizeUser(user) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    fullName: user.user_metadata?.full_name || user.email
  }
}

function formatValue(value) {
  const numericValue = Number(value || 0)
  if (Number.isInteger(numericValue)) {
    return String(numericValue)
  }
  return numericValue.toFixed(1).replace(/\.0$/, '')
}

function updateStatsDisplay(stats = {}) {
  const fields = {
    'stat-balance': stats.balance,
    'stat-active-orders': stats.activeOrders,
    'stat-total-earnings': stats.totalEarnings,
    'stat-total-withdrawals': stats.totalWithdrawals,
    'stat-team-income': stats.teamIncome,
    'stat-income-today': stats.incomeToday,
    'stat-yesterday-earnings': stats.yesterdayEarnings,
    'stat-points-value': stats.points
  }

  for (const [id, value] of Object.entries(fields)) {
    const el = document.getElementById(id)
    if (el) el.textContent = formatValue(value)
  }
}

  // Refresh button
  const refreshBtn = document.getElementById('refresh-btn')
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      window.location.reload()
    })
  }

  // Display Username
  const userNameDisplay = document.getElementById('user-name-display')
  if (userNameDisplay && currentUser) {
    userNameDisplay.textContent = currentUser.fullName
  }


document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabase.auth.getSession()
  const currentUser = session ? normalizeUser(session.user) : null

  const avatarInput = document.getElementById('avatar-input')
  const userAvatar = document.getElementById('user-avatar')
  const placeholder = document.getElementById('avatar-placeholder')

  if (avatarInput) {
    avatarInput.addEventListener('change', (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          userAvatar.src = event.target.result
          userAvatar.style.display = 'block'
          placeholder.style.display = 'none'
          // Optional: Save to local storage or Supabase in the future
          localStorage.setItem('zella_avatar', event.target.result)
        }
        reader.readAsDataURL(file)
      }
    })

    // Load saved avatar from localStorage
    const savedAvatar = localStorage.getItem('zella_avatar')
    if (savedAvatar) {
      userAvatar.src = savedAvatar
      userAvatar.style.display = 'block'
      placeholder.style.display = 'none'
    }
  }

  const loginLinks = document.querySelectorAll('a[href="login.html"]')
  loginLinks.forEach((link) => {
    if (currentUser) {
      link.textContent = 'Me'
      link.setAttribute('href', 'me.html')
    }
  })

  const signOutBtn = document.querySelector('[data-action="sign-out"]')
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to sign out?')) {
        await supabase.auth.signOut()
        window.location.href = 'login.html'
      }
    })
  }

  const tabBtns = document.querySelectorAll('.tab-btn')
  const tabContents = document.querySelectorAll('.tab-content')

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab

      tabBtns.forEach((b) => {
        const isActive = b.dataset.tab === target
        b.classList.toggle('active', isActive)
        b.setAttribute('aria-selected', isActive)
      })

      tabContents.forEach((panel) => {
        const isActive = panel.id === `${target}-panel`
        panel.classList.toggle('active', isActive)
        panel.hidden = !isActive
      })
    })
  })

  tabContents.forEach((panel) => {
    panel.hidden = !panel.classList.contains('active')
  })

  const exchangeBtn = document.querySelector('.exchange-btn')
  if (exchangeBtn) {
    exchangeBtn.addEventListener('click', () => {
      alert('Points exchange coming soon.')
    })
  }

  // ============================================
  // FETCH REAL PROFILE DATA FROM SUPABASE
  // ============================================
  if (currentUser) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single()

    if (profile) {
      updateStatsDisplay({
        balance: profile.balance || 0,
        activeOrders: 0,
        totalEarnings: profile.total_earnings || 0,
        totalWithdrawals: 0,
        teamIncome: 0,
        incomeToday: 0,
        yesterdayEarnings: 0,
        points: 0
      })
    }
  }
})