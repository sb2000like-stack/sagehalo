const STORAGE_KEY = 'planner-mvp-state-v1';

const defaultState = {
  isOnboarded: false,
  user: {
    name: 'Jamie',
    location: 'Seattle, WA',
    interests: 'Coffee, parks, museums',
    transport: 'Car',
    dailyBudget: 40,
  },
  ai: {
    name: 'Nova',
    personality: 'Friendly',
    greeting: 'Good morning, {name}! Ready to plan your day?',
    provider: 'free',
    apiKey: '',
    model: 'gpt-4o-mini',
  },
  preferences: {
    theme: 'Ocean',
    font: 'Inter',
    textSize: 16,
    dyslexiaMode: false,
    highContrast: false,
    reducedMotion: false,
    simpleLanguage: false,
  },
  weekPreferences: {
    likes: 'coffee, workouts, parks, museums',
    workoutDays: 3,
    extra: 'Keep Friday open and leave one rest day.'
  },
  plans: {
    today: [
      {
        time: '10:00 AM',
        title: 'Coffee & Breakfast',
        location: 'Local café',
        travel: '15 min drive',
        duration: '1 hour',
        cost: '$12',
        why: 'A relaxed start that fits your budget.',
        nearbyPlaces: [
          'Pine Street Coffee',
          'Maple Bean Roasters',
          'Harbor Breakfast House',
          'Sunrise Market Cafe',
          'Northside Brunch Bar'
        ]
      },
      {
        time: '12:00 PM',
        title: 'Museum Visit',
        location: 'Seattle Art Museum',
        travel: '20 min drive',
        duration: '1.5 hours',
        cost: '$18',
        why: 'Cultural activity that keeps the day engaging and indoors.',
        nearbyPlaces: [
          'Seattle Art Museum',
          'Frye Art Museum',
          'Museum of Pop Culture',
          'Wing Luke Museum',
          'Seattle Asian Art Museum'
        ]
      }
    ],
    week: [
      { day: 'Mon', items: ['Deep work block', 'Gym'] },
      { day: 'Tue', items: ['Coffee walk', 'Meal prep'] },
      { day: 'Wed', items: ['Project focus', 'Social dinner'] },
      { day: 'Thu', items: ['Workout', 'Reading'] },
      { day: 'Fri', items: ['Team lunch', 'Free evening'] },
      { day: 'Sat', items: ['Park day', 'Brunch'] },
      { day: 'Sun', items: ['Reset & recharge'] },
    ]
  },
  chat: [
    { sender: 'ai', text: 'Hi {name}! I can help you plan a realistic, enjoyable day.' }
  ]
};

const state = loadState();

const pageButtons = [...document.querySelectorAll('.nav-button')];
const pages = [...document.querySelectorAll('.page')];
const aiNameBadge = document.getElementById('aiNameBadge');
const greetingText = document.getElementById('greetingText');
const locationInput = document.getElementById('locationInput');
const homeSummary = document.getElementById('homeSummary');
const dayPlanList = document.getElementById('dayPlanList');
const weekGrid = document.getElementById('weekGrid');
const aiChat = document.getElementById('aiChat');
const aiStatus = document.getElementById('aiStatus');
const chatInput = document.getElementById('chatInput');
const onboardingModal = document.getElementById('onboardingModal');
const onboardingSteps = [...document.querySelectorAll('.onboarding-step')];
const prevStepButton = document.getElementById('prevStepButton');
const nextStepButton = document.getElementById('nextStepButton');
const submitOnboardingButton = document.getElementById('submitOnboardingButton');
const toast = document.getElementById('toast');

let onboardingStep = 0;
let deferredInstallPrompt = null;

function normalizePlanTitles(planList = []) {
  return planList.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const cleanTitle = typeof item.title === 'string' ? item.title.replace(/\s*\([^)]*\)$/, '').trim() : item.title;
    const normalized = { ...item, title: cleanTitle };
    if (!normalized.nearbyPlaces && cleanTitle) {
      normalized.nearbyPlaces = getNearbyPlaces(cleanTitle);
    }
    return normalized;
  });
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(defaultState);
    const parsed = JSON.parse(stored);
    const normalizedState = { ...structuredClone(defaultState), ...parsed, user: { ...defaultState.user, ...(parsed.user || {}) }, ai: { ...defaultState.ai, ...(parsed.ai || {}) }, preferences: { ...defaultState.preferences, ...(parsed.preferences || {}) }, plans: { ...defaultState.plans, ...(parsed.plans || {}) }, chat: parsed.chat || defaultState.chat };
    if (Array.isArray(normalizedState.plans?.today)) {
      normalizedState.plans.today = normalizePlanTitles(normalizedState.plans.today);
    }
    return normalizedState;
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => toast.classList.add('hidden'), 2000);
}

async function fillLocationFromBrowser() {
  if (!navigator.geolocation) {
    showToast('Location access is not available on this browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
      if (!response.ok) {
        throw new Error('Location lookup failed');
      }

      const data = await response.json();
      const address = data.address || {};
      const displayLocation = [
        address.city || address.town || address.village || address.county,
        address.state || address.region,
        address.postcode,
        address.country
      ].filter(Boolean).join(', ');

      const finalLocation = displayLocation || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
      state.user.location = finalLocation;
      if (locationInput) {
        locationInput.value = finalLocation;
      }
      saveState();
      renderAll();
      showToast('Location updated from your device.');
    } catch (error) {
      showToast('Your location was found, but the city name could not be loaded.');
    }
  }, () => {
    showToast('Location permission was denied. You can still enter it manually.');
  });
}

function personalizeText(template, fallback = '') {
  const value = template || fallback;
  if (!value) return '';
  return value
    .replace(/\{name\}/gi, state.user.name)
    .replace(/\buser\b/gi, state.user.name)
    .replace(/\bJamie\b/gi, state.user.name);
}

function applyTheme() {
  const theme = state.preferences.theme;
  const root = document.documentElement;
  const themes = {
    Ocean: {
      bg: '#edf7ff',
      bgSoft: '#f8fbff',
      bgElevated: '#eef3ff',
      surface: 'rgba(255,255,255,0.8)',
      surfaceStrong: '#ffffff',
      card: 'rgba(255,255,255,0.92)',
      primary: '#3a86ff',
      secondary: '#72d2ff',
      accent: '#ffb703',
      text: '#14233d',
      muted: '#425a7a',
      border: 'rgba(20, 35, 61, 0.2)',
      inputBg: 'rgba(255,255,255,0.86)',
      softBox: 'rgba(58, 134, 255, 0.08)',
    },
    Forest: {
      bg: '#edf9ee',
      bgSoft: '#f8fdf8',
      bgElevated: '#edf7f0',
      surface: 'rgba(255,255,255,0.8)',
      surfaceStrong: '#ffffff',
      card: 'rgba(255,255,255,0.92)',
      primary: '#2e7d32',
      secondary: '#81c784',
      accent: '#ffca28',
      text: '#1d2f1d',
      muted: '#496754',
      border: 'rgba(29, 47, 29, 0.22)',
      inputBg: 'rgba(255,255,255,0.9)',
      softBox: 'rgba(46, 125, 50, 0.09)',
    },
    Sunset: {
      bg: '#fff1e8',
      bgSoft: '#fffaf6',
      bgElevated: '#fdf0e6',
      surface: 'rgba(255,255,255,0.82)',
      surfaceStrong: '#fffaf6',
      card: 'rgba(255,255,255,0.94)',
      primary: '#ff7f50',
      secondary: '#ffb84d',
      accent: '#ffcf5c',
      text: '#2d1a18',
      muted: '#7a564b',
      border: 'rgba(90, 45, 30, 0.22)',
      inputBg: 'rgba(255,255,255,0.88)',
      softBox: 'rgba(255, 127, 80, 0.1)',
    },
    Lavender: {
      bg: '#f5efff',
      bgSoft: '#fbf8ff',
      bgElevated: '#f1ebff',
      surface: 'rgba(255,255,255,0.83)',
      surfaceStrong: '#ffffff',
      card: 'rgba(255,255,255,0.94)',
      primary: '#7b61ff',
      secondary: '#b399ff',
      accent: '#ff8ac1',
      text: '#241c45',
      muted: '#665b97',
      border: 'rgba(36, 28, 69, 0.2)',
      inputBg: 'rgba(255,255,255,0.88)',
      softBox: 'rgba(123, 97, 255, 0.09)',
    },
    Minimal: {
      bg: '#f4f5f7',
      bgSoft: '#f9fafb',
      bgElevated: '#edf0f2',
      surface: 'rgba(255,255,255,0.82)',
      surfaceStrong: '#ffffff',
      card: 'rgba(255,255,255,0.96)',
      primary: '#374151',
      secondary: '#9ca3af',
      accent: '#d1d5db',
      text: '#111827',
      muted: '#6b7280',
      border: 'rgba(17, 24, 39, 0.18)',
      inputBg: 'rgba(255,255,255,0.9)',
      softBox: 'rgba(55, 65, 81, 0.08)',
    },
    Dark: {
      bg: '#101827',
      bgSoft: '#192230',
      bgElevated: '#162132',
      surface: 'rgba(20,29,39,0.82)',
      surfaceStrong: '#1b2738',
      card: 'rgba(20,29,39,0.92)',
      primary: '#7aa2ff',
      secondary: '#4fd1c5',
      accent: '#fbbf24',
      text: '#edf6ff',
      muted: '#c1d3e7',
      border: 'rgba(124, 160, 228, 0.38)',
      inputBg: 'rgba(12, 18, 30, 0.9)',
      softBox: 'rgba(122, 162, 255, 0.14)',
    },
    'High Contrast': {
      bg: '#0b0b0b',
      bgSoft: '#161616',
      bgElevated: '#1d1d1d',
      surface: 'rgba(17,17,17,0.9)',
      surfaceStrong: '#1f1f1f',
      card: 'rgba(30,30,30,0.96)',
      primary: '#f3f3f3',
      secondary: '#7dd3fc',
      accent: '#facc15',
      text: '#ffffff',
      muted: '#dfe7ef',
      border: 'rgba(255,255,255,0.4)',
      inputBg: 'rgba(10,10,10,0.96)',
      softBox: 'rgba(125, 211, 252, 0.18)',
    },
  };
  const selected = themes[theme] || themes.Ocean;

  root.style.setProperty('--bg', selected.bg);
  root.style.setProperty('--bg-soft', selected.bgSoft);
  root.style.setProperty('--bg-elevated', selected.bgElevated);
  root.style.setProperty('--surface', selected.surface);
  root.style.setProperty('--surface-strong', selected.surfaceStrong);
  root.style.setProperty('--card', selected.card);
  root.style.setProperty('--primary', selected.primary);
  root.style.setProperty('--secondary', selected.secondary);
  root.style.setProperty('--accent', selected.accent);
  root.style.setProperty('--text', selected.text);
  root.style.setProperty('--muted', selected.muted);
  root.style.setProperty('--border', selected.border);
  root.style.setProperty('--input-bg', selected.inputBg || 'rgba(255,255,255,0.86)');
  root.style.setProperty('--soft-box', selected.softBox || 'rgba(58, 134, 255, 0.08)');

  document.body.classList.toggle('dyslexia-mode', state.preferences.dyslexiaMode);
  document.body.classList.toggle('high-contrast', state.preferences.highContrast);
  document.body.classList.toggle('reduced-motion', state.preferences.reducedMotion);

  if (state.preferences.font === 'Atkinson Hyperlegible') {
    document.documentElement.style.setProperty('--font-body', '"Atkinson Hyperlegible", sans-serif');
  } else if (state.preferences.font === 'Segoe UI') {
    document.documentElement.style.setProperty('--font-body', '"Segoe UI", sans-serif');
  } else {
    document.documentElement.style.setProperty('--font-body', '"Inter", sans-serif');
  }

  document.documentElement.style.setProperty('--body-size', `${state.preferences.textSize}px`);
}

function updateUserIdentity() {
  const personalGreeting = personalizeText(state.ai.greeting, 'Good morning');
  aiNameBadge.textContent = state.ai.name;
  greetingText.textContent = personalGreeting.includes(state.user.name)
    ? personalGreeting
    : `${personalGreeting}, ${state.user.name}!`;
  document.getElementById('profileNameInput').value = state.user.name;
  document.getElementById('locationInput').value = state.user.location;
  document.getElementById('interestsInput').value = state.user.interests;
  document.getElementById('transportInput').value = state.user.transport;
  document.getElementById('aiNameInput').value = state.ai.name;
  document.getElementById('aiProviderInput').value = state.ai.provider || 'free';
    document.getElementById('openAiKeyInput').value = state.ai.apiKey || '';
  document.getElementById('personalityInput').value = state.ai.personality;
  document.getElementById('greetingInput').value = state.ai.greeting;
  document.getElementById('dailyBudgetInput').value = state.user.dailyBudget || 0;
  document.getElementById('themeInput').value = state.preferences.theme;
  document.getElementById('fontInput').value = state.preferences.font;
  document.getElementById('textSizeInput').value = state.preferences.textSize;
  document.getElementById('dyslexiaToggle').checked = !!state.preferences.dyslexiaMode;
  document.getElementById('highContrastToggle').checked = !!state.preferences.highContrast;
  document.getElementById('reducedMotionToggle').checked = !!state.preferences.reducedMotion;
  document.getElementById('simpleLanguageToggle').checked = !!state.preferences.simpleLanguage;
  aiStatus.textContent = state.ai.provider === 'openai' && state.ai.apiKey
    ? 'Live OpenAI answers are enabled for this browser.'
    : 'Free AI is ready. It works offline and uses your planner preferences.';

  if (document.getElementById('weekLikesInput')) {
    document.getElementById('weekLikesInput').value = state.weekPreferences.likes;
  }
  if (document.getElementById('workoutDaysInput')) {
    document.getElementById('workoutDaysInput').value = state.weekPreferences.workoutDays;
  }
  if (document.getElementById('weekExtrasInput')) {
    document.getElementById('weekExtrasInput').value = state.weekPreferences.extra;
  }
}

function titleCase(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function renderSummary() {
  homeSummary.innerHTML = state.plans.today.map((item) => `
    <div class="summary-item">
      <strong>${item.time}</strong>
      <div>${item.title}</div>
      <small>${item.location} • ${item.cost}</small>
    </div>
  `).join('');
}

function getLocationBaseName() {
  const rawLocation = (state.user.location || 'Seattle').trim();
  if (!rawLocation) return 'City';
  const firstPart = rawLocation.split(',')[0].trim();
  return firstPart || rawLocation.split(' ')[0] || 'City';
}

function getNearbyPlaces(activityTitle) {

  function getPlaceLinks(place) {
    const query = encodeURIComponent(`${place}, ${state.user.location}`);
    return `<a href="https://www.google.com/maps/search/?api=1&query=${query}" target="_blank" rel="noopener">Map</a>
      <a href="https://www.google.com/search?q=${encodeURIComponent(`${place} ${state.user.location}`)}" target="_blank" rel="noopener">Web</a>`;
  }
  const title = (activityTitle || '').toLowerCase();
  const cityName = getLocationBaseName();
  const baseList = [
    `${cityName} Center Spot`,
    `${cityName} Greenway Place`,
    `${cityName} Commons`,
    `${cityName} Harbor View`,
    `${cityName} Square`
  ];

  if (title.includes('coffee') || title.includes('breakfast')) {
    return [
      `${cityName} Coffee House`,
      `${cityName} Bean Roasters`,
      `${cityName} Breakfast Room`,
      `${cityName} Morning Cafe`,
      `${cityName} Brunch Bar`
    ];
  }

  if (title.includes('museum') || title.includes('art')) {
    return [
      `${cityName} Museum`,
      `${cityName} Art Gallery`,
      `${cityName} Culture Center`,
      `${cityName} History Hall`,
      `${cityName} Creative Space`
    ];
  }

  if (title.includes('lunch') || title.includes('food') || title.includes('dinner')) {
    return [
      `${cityName} Bistro`,
      `${cityName} Kitchen`,
      `${cityName} Table & Grill`,
      `${cityName} Market Eatery`,
      `${cityName} Street Cafe`
    ];
  }

  if (title.includes('park') || title.includes('walk') || title.includes('outdoor')) {
    return [
      `${cityName} Lake Park`,
      `${cityName} Trail Path`,
      `${cityName} Greenway`,
      `${cityName} Meadow`,
      `${cityName} Ridge Walk`
    ];
  }

  if (title.includes('gym') || title.includes('workout') || title.includes('fitness')) {
    return [
      `${cityName} Motion Studio`,
      `${cityName} Fitness Club`,
      `${cityName} Athletic Center`,
      `${cityName} Wellness Hub`,
      `${cityName} Performance Gym`
    ];
  }

  if (title.includes('movie') || title.includes('cinema')) {
    return [
      `${cityName} Cinema`,
      `${cityName} Picture House`,
      `${cityName} Theater`,
      `${cityName} Screen Hall`,
      `${cityName} Movie Lounge`
    ];
  }

  return baseList;
}

function getPlaceLinks(place) {
  const mapQuery = encodeURIComponent(`${place}, ${state.user.location}`);
  const webQuery = encodeURIComponent(`${place} ${state.user.location}`);
  return `<a href="https://www.google.com/maps/search/?api=1&query=${mapQuery}" target="_blank" rel="noopener">Map</a>
    <a href="https://www.google.com/search?q=${webQuery}" target="_blank" rel="noopener">Web</a>`;
}

function renderDayPlan() {
  dayPlanList.innerHTML = state.plans.today.map((item, index) => {
    const nearbyPlaces = item.nearbyPlaces || getNearbyPlaces(item.title);
    return `
    <div class="activity-card">
      <div class="activity-top">
        <div>
          <strong>${item.time}</strong>
          <h3>${item.title}</h3>
        </div>
      </div>
      <div class="activity-meta">
        <span>📍 ${item.location}</span>
        <span>🚗 ${item.travel}</span>
        <span>⏱ ${item.duration}</span>
        <span>💰 ${item.cost}</span>
      </div>
      <div><strong>Why:</strong> ${item.why}</div>
      <div class="nearby-section">
        <strong>Top nearby places:</strong>
        <ul class="place-list">
          ${nearbyPlaces.slice(0, 5).map((place) => `<li><span>${place}</span><span class="place-links">${getPlaceLinks(place)}</span></li>`).join('')}
        </ul>
      </div>
      <button class="ghost-button small find-places-button" data-activity-index="${index}">Find real places near me</button>
      <div class="activity-actions">
        <button>Edit</button>
        <button>Remove</button>
        <button>Replace</button>
        <button>Navigate</button>
      </div>
    </div>
  `;
  }).join('');
}

async function findRealPlaces(activityIndex) {
  const item = state.plans.today[activityIndex];
  if (!item || !state.user.location) {
    showToast('Add a location in Settings first.');
    return;
  }

  const button = dayPlanList.querySelector(`[data-activity-index="${activityIndex}"]`);
  if (button) {
    button.disabled = true;
    button.textContent = 'Searching nearby...';
  }

  try {
    const query = encodeURIComponent(`${item.title} near ${state.user.location}`);
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${query}`, {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error('Place search failed');
    const places = await response.json();
    if (!places.length) throw new Error('No places found');

    item.nearbyPlaces = places.map((place) => place.display_name.split(',').slice(0, 2).join(',').trim());
    item.location = item.nearbyPlaces[0];
    saveState();
    renderDayPlan();
    showToast(`${item.nearbyPlaces.length} nearby places found.`);
  } catch {
    renderDayPlan();
    showToast('Live place search was unavailable. Showing local suggestions.');
  }
}

function renderWeekPlan() {
  weekGrid.innerHTML = state.plans.week.map((day) => `
    <div class="day-column">
      <h3>${day.day}</h3>
      ${day.items.map((item) => `<div class="day-event">${item}</div>`).join('')}
    </div>
  `).join('');
}

function buildWeekPlanFromPreferences() {
  const likesField = document.getElementById('weekLikesInput')?.value || state.weekPreferences.likes || '';
  const workoutDaysField = document.getElementById('workoutDaysInput')?.value || state.weekPreferences.workoutDays || 3;
  const extraField = document.getElementById('weekExtrasInput')?.value || state.weekPreferences.extra || '';

  const likes = String(likesField)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const workoutDays = Math.max(0, Math.min(7, Number(workoutDaysField) || 0));
  const extraText = extraField.trim();
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return weekdays.map((day, index) => {
    const items = [];

    if (index < workoutDays) {
      items.push('Workout session');
    }

    if (likes.length) {
      const preferred = likes[index % likes.length];
      items.push(`${titleCase(preferred)} time`);
    }

    if (day === 'Fri') {
      items.push('Social plans or dinner');
    }

    if (day === 'Sun') {
      items.push('Reset and recharge');
    }

    if (day === 'Sat' && !items.length) {
      items.push('Free exploration time');
    }

    if (extraText && !items.includes('Flexible block')) {
      items.push('Flexible block');
    }

    if (!items.length) {
      items.push('Free block');
    }

    return {
      day,
      items: items.slice(0, 4),
    };
  });
}

function renderChat() {
  aiChat.innerHTML = state.chat.map((msg) => `
    <div class="chat-bubble ${msg.sender === 'user' ? 'user' : ''}">
      ${personalizeText(msg.text, msg.text)}
    </div>
  `).join('');
  aiChat.scrollTop = aiChat.scrollHeight;
}

function renderAll() {
  applyTheme();
  renderSummary();
  renderDayPlan();
  renderWeekPlan();
  renderChat();
  updateUserIdentity();
}

function openPage(pageId) {
  pages.forEach((page) => page.classList.toggle('active', page.id === pageId));
  pageButtons.forEach((button) => button.classList.toggle('active', button.dataset.page === pageId));
}

function addChatMessage(text, sender = 'user') {
  state.chat.push({ sender, text });
  saveState();
  renderChat();
}

function getFreeAiResponse(text) {
  const request = text.toLowerCase();
  const interests = state.user.interests || 'your favorite activities';
  const location = state.user.location || 'your area';
  const budget = state.user.dailyBudget || 40;
  const workoutDays = state.weekPreferences?.workoutDays || 3;

  if (request.includes('week')) {
    return `I can build your week around ${interests}. You currently have ${workoutDays} workout days saved. Open the Week tab, add any extra preferences, and choose Plan Week.`;
  }

  if (request.includes('place') || request.includes('near') || request.includes('where')) {
    return `For ${location}, I would start with your interests: ${interests}. Open Today and use “Find real places near me” on an activity to search live map results.`;
  }

  if (request.includes('workout') || request.includes('exercise') || request.includes('gym')) {
    return `A good starting point is ${workoutDays} workout days this week, with an easy day between harder sessions. Keep the remaining days for ${interests}.`;
  }

  if (request.includes('budget') || request.includes('cheap') || request.includes('cost')) {
    return `I’ll keep the plan near your $${budget} daily budget. Try a free outdoor activity, one affordable meal, and a flexible block for the rest of the day.`;
  }

  return `I can help you plan around ${interests} in ${location}. Tell me whether you want a day plan, a week plan, nearby places, workouts, or a budget-friendly idea.`;
}

function askFreeAI(text) {
  addChatMessage(getFreeAiResponse(text), 'ai');
}

async function askOpenAI(text) {
  if (!state.ai.apiKey) {
    addChatMessage(`I can help you plan: ${text}. Add your OpenAI API key in Settings for a live answer.`, 'ai');
    return;
  }

  addChatMessage('Thinking through that with your schedule and location...', 'ai');
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${state.ai.apiKey}`
      },
      body: JSON.stringify({
        model: state.ai.model || 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `You are ${state.ai.name}, a ${state.ai.personality} day and week planner. The user's name is ${state.user.name}. Their location is ${state.user.location}. Their interests are ${state.user.interests}. Give concise, practical planning help. Do not claim to have verified live places unless the user opens the provided map or web links.`
          },
          ...state.chat.slice(-8).map((message) => ({
            role: message.sender === 'user' ? 'user' : 'assistant',
            content: message.text
          })).filter((message) => message.content !== 'Thinking through that with your schedule and location...')
        ]
      })
    });

    if (!response.ok) throw new Error('OpenAI request failed');
    const data = await response.json();
    state.chat.pop();
    addChatMessage(data.choices?.[0]?.message?.content || 'I could not generate an answer right now.', 'ai');
  } catch {
    state.chat.pop();
    addChatMessage('I could not reach OpenAI. Check the API key and browser connection, then try again.', 'ai');
  }
}

function askAssistant(text) {
  if (state.ai.provider === 'openai' && state.ai.apiKey) {
    askOpenAI(text);
    return;
  }
  askFreeAI(text);
}

function generateDayPlanFromPrompt(prompt) {
  const budget = parseFloat(document.getElementById('budgetInput').value || 40);
  const vibe = document.getElementById('vibeInput').value || 'relaxing';
  const plan = [
    { time: '9:00 AM', title: 'Morning Coffee', location: 'Neighborhood café', travel: '10 min drive', duration: '45 min', cost: `$${Math.min(15, Math.round(budget * 0.15))}`, why: `A ${vibe} start to ease into the day.` },
    { time: '10:30 AM', title: 'Activity Block', location: 'Local culture or park', travel: '15 min drive', duration: '1.5 hours', cost: `$${Math.min(20, Math.round(budget * 0.35))}`, why: `This keeps the schedule active while matching your ${vibe} focus.` },
    { time: '1:00 PM', title: 'Lunch', location: 'Casual restaurant', travel: '12 min drive', duration: '1 hour', cost: `$${Math.min(22, Math.round(budget * 0.3))}`, why: `A practical break that stays on budget.` },
    { time: '3:00 PM', title: 'Free Time', location: 'Home or nearby area', travel: '10 min', duration: '2 hours', cost: '$0', why: `A buffer for rest and flexibility before the evening.` },
  ];

  state.plans.today = plan.map((item) => ({
    ...item,
    title: item.title.replace(/\s*\([^)]*\)$/, '').trim(),
    nearbyPlaces: getNearbyPlaces(item.title)
  }));
  saveState();
  renderAll();
  showToast('Day plan refreshed.');
}

function generateWeekPlan() {
  state.weekPreferences.likes = document.getElementById('weekLikesInput')?.value || state.weekPreferences.likes;
  state.weekPreferences.workoutDays = Number(document.getElementById('workoutDaysInput')?.value) || state.weekPreferences.workoutDays;
  state.weekPreferences.extra = document.getElementById('weekExtrasInput')?.value || state.weekPreferences.extra;

  state.plans.week = buildWeekPlanFromPreferences();
  saveState();
  renderWeekPlan();
  showToast('Weekly plan updated.');
}

function launchOnboarding() {
  onboardingModal.classList.remove('hidden');
  onboardingStep = 0;
  updateOnboardingStep();
}

function closeOnboarding() {
  onboardingModal.classList.add('hidden');
}

function updateOnboardingStep() {
  onboardingSteps.forEach((step, index) => step.classList.toggle('active', index === onboardingStep));
  prevStepButton.classList.toggle('hidden', onboardingStep === 0);
  nextStepButton.classList.toggle('hidden', onboardingStep === onboardingSteps.length - 1);
  submitOnboardingButton.classList.toggle('hidden', onboardingStep !== onboardingSteps.length - 1);
}

function nextOnboardingStep() {
  if (onboardingStep < onboardingSteps.length - 1) {
    onboardingStep += 1;
    updateOnboardingStep();
  }
}

function prevOnboardingStep() {
  if (onboardingStep > 0) {
    onboardingStep -= 1;
    updateOnboardingStep();
  }
}

function submitOnboarding(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const values = Object.fromEntries(formData.entries());

  state.user.name = values.name || state.user.name;
  state.ai.name = values.aiName || state.ai.name;
  state.user.location = values.location || state.user.location;
  state.user.transport = values.transportation || state.user.transport;
  state.user.interests = values.interests || state.user.interests;
  state.ai.personality = values.personality || state.ai.personality;
  state.preferences.theme = values.theme || state.preferences.theme;
  if (!state.ai.greeting) {
    state.ai.greeting = 'Good morning, {name}! Ready to plan your day?';
  }
  state.isOnboarded = true;
  saveState();
  renderAll();
  closeOnboarding();
  showToast('Welcome to your planner!');
}

function applySettingsFromInputs() {
  state.user.name = document.getElementById('profileNameInput').value || state.user.name;
  state.user.location = document.getElementById('locationInput').value || state.user.location;
  state.user.interests = document.getElementById('interestsInput').value || state.user.interests;
  state.user.transport = document.getElementById('transportInput').value || state.user.transport;
  state.ai.name = document.getElementById('aiNameInput').value || state.ai.name;
  state.ai.provider = document.getElementById('aiProviderInput').value || 'free';
  state.ai.personality = document.getElementById('personalityInput').value || state.ai.personality;
  state.ai.apiKey = document.getElementById('openAiKeyInput').value.trim();
  state.ai.greeting = document.getElementById('greetingInput').value || state.ai.greeting;
  state.preferences.theme = document.getElementById('themeInput').value || state.preferences.theme;
  state.preferences.font = document.getElementById('fontInput').value || state.preferences.font;
  state.preferences.textSize = Number(document.getElementById('textSizeInput').value) || state.preferences.textSize;
  state.preferences.dyslexiaMode = document.getElementById('dyslexiaToggle').checked;
  state.preferences.highContrast = document.getElementById('highContrastToggle').checked;
  state.preferences.reducedMotion = document.getElementById('reducedMotionToggle').checked;
  state.preferences.simpleLanguage = document.getElementById('simpleLanguageToggle').checked;
  state.user.dailyBudget = Number(document.getElementById('dailyBudgetInput').value) || state.user.dailyBudget;
  saveState();
  renderAll();
  showToast('Settings saved.');
}

function bindEvents() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    document.getElementById('installAppButton').classList.remove('hidden');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    document.getElementById('installAppButton').classList.add('hidden');
    showToast('Planner installed on your device.');
  });

  pageButtons.forEach((button) => {
    button.addEventListener('click', () => openPage(button.dataset.page));
  });

  document.querySelectorAll('[data-open-ai]').forEach((button) => {
    button.addEventListener('click', () => openPage('ai-page'));
  });

  document.querySelectorAll('[data-quick]').forEach((button) => {
    button.addEventListener('click', () => {
      const prompt = button.dataset.quick;
      document.getElementById('dayPromptInput').value = prompt;
      openPage('today-page');
      addChatMessage(prompt, 'user');
      addChatMessage(`I can help with: “${prompt}.” Let’s make a realistic plan around your budget and schedule.`, 'ai');
      generateDayPlanFromPrompt(prompt);
    });
  });

  document.getElementById('newPlanButton').addEventListener('click', () => openPage('today-page'));
  document.getElementById('installAppButton').addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      showToast('Use your browser menu and choose Add to Home Screen.');
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById('installAppButton').classList.add('hidden');
  });
  document.getElementById('todayGenerateButton').addEventListener('click', () => generateDayPlanFromPrompt(document.getElementById('dayPromptInput').value));
  document.getElementById('generateDayPlanButton').addEventListener('click', () => generateDayPlanFromPrompt(document.getElementById('dayPromptInput').value));
  document.getElementById('generateWeekPlanButton').addEventListener('click', generateWeekPlan);

  dayPlanList.addEventListener('click', (event) => {
    const button = event.target.closest('.find-places-button');
    if (button) findRealPlaces(Number(button.dataset.activityIndex));
  });

  document.getElementById('sendChatButton').addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (!text) return;
    addChatMessage(text, 'user');
    chatInput.value = '';
    askAssistant(text);
  });

  document.getElementById('saveSettingsButton').addEventListener('click', applySettingsFromInputs);
  document.getElementById('useMyLocationButton').addEventListener('click', fillLocationFromBrowser);
  document.getElementById('onboardingLocationButton').addEventListener('click', fillLocationFromBrowser);
  document.getElementById('nextStepButton').addEventListener('click', nextOnboardingStep);
  document.getElementById('prevStepButton').addEventListener('click', prevOnboardingStep);
  document.getElementById('onboardingForm').addEventListener('submit', submitOnboarding);
  document.getElementById('themePreviewButton').addEventListener('click', () => {
    const selectedTheme = document.getElementById('themeInput').value || state.preferences.theme;
    state.preferences.theme = selectedTheme;
    saveState();
    renderAll();
    showToast(`${selectedTheme} theme applied.`);
  });
}

function init() {
  bindEvents();
  renderAll();
  openPage('home-page');

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      showToast('Offline install support could not be enabled.');
    });
  }

  if (!state.isOnboarded) {
    launchOnboarding();
  }
}

init();
