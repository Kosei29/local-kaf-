import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const SUPABASE_URL = "https://reybalitebntwzkmujeo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_mz0eHqZgfIxoqAAx9hFCJg_3ZsKBJjb";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let currentUser = null;
let currentGroup = null;
let map = null;
let cafeLayer = null;
let draftMarker = null;
let selectedLatLng = null;

const authCard = document.querySelector('#auth-card');
const appCard = document.querySelector('#app-card');
const groupEmpty = document.querySelector('#group-empty');
const mapView = document.querySelector('#map-view');
const authMessage = document.querySelector('#auth-message');
const appMessage = document.querySelector('#app-message');
const dialogMessage = document.querySelector('#dialog-message');
const cafeDialog = document.querySelector('#cafe-dialog');

function showMessage(el, text, success = false) {
  el.textContent = text || '';
  el.style.color = success ? '#2f6a42' : '#7b3f2c';
}

function setBusy(busy) {
  document.querySelectorAll('button').forEach(btn => btn.disabled = busy);
}

function ensureMap() {
  if (map) return;

  map = L.map('map', { zoomControl: true }).setView([14.5995, 120.9842], 11);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  cafeLayer = L.layerGroup().addTo(map);

  map.on('click', (e) => {
    if (!cafeDialog.open) return;
    selectDraftLocation(e.latlng.lat, e.latlng.lng);
  });
}

function selectDraftLocation(lat, lng) {
  selectedLatLng = { lat, lng };
  document.querySelector('#lat-display').textContent = lat.toFixed(6);
  document.querySelector('#lng-display').textContent = lng.toFixed(6);

  if (draftMarker) draftMarker.remove();
  draftMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
  draftMarker.on('dragend', () => {
    const p = draftMarker.getLatLng();
    selectDraftLocation(p.lat, p.lng);
  });
  map.panTo([lat, lng]);
}

async function loadCafes() {
  if (!currentGroup || !map) return;

  const { data, error } = await supabase
    .from('cafes')
    .select('id,name,category,latitude,longitude,address_text,landmark,created_at')
    .eq('group_id', currentGroup.id)
    .order('created_at', { ascending: false });

  if (error) {
    showMessage(appMessage, error.message);
    return;
  }

  cafeLayer.clearLayers();

  for (const cafe of data || []) {
    const parts = [
      cafe.category?.replaceAll('_', ' '),
      cafe.address_text,
      cafe.landmark ? `Near ${cafe.landmark}` : null
    ].filter(Boolean);

    L.marker([Number(cafe.latitude), Number(cafe.longitude)])
      .addTo(cafeLayer)
      .bindPopup(`
        <div class="popup-title">☕ ${escapeHtml(cafe.name)}</div>
        <div class="popup-meta">${escapeHtml(parts.join(' · '))}</div>
      `);
  }

  document.querySelector('#cafe-count').textContent =
    `${data?.length || 0} café${data?.length === 1 ? '' : 's'}`;
}

function escapeHtml(text = '') {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function refreshUI() {
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;

  if (!user) {
    currentGroup = null;
    authCard.classList.remove('hidden');
    appCard.classList.add('hidden');
    return;
  }

  authCard.classList.add('hidden');
  appCard.classList.remove('hidden');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  document.querySelector('#user-name').textContent = profile?.display_name || 'Local Kafé member';

  const { data: memberships, error } = await supabase
    .from('group_members')
    .select('role, groups(id, name)')
    .eq('user_id', user.id)
    .limit(1);

  if (error) {
    showMessage(appMessage, error.message);
    return;
  }

  const membership = memberships?.[0];
  currentGroup = membership?.groups || null;

  if (!currentGroup) {
    groupEmpty.classList.remove('hidden');
    mapView.classList.add('hidden');
    return;
  }

  groupEmpty.classList.add('hidden');
  mapView.classList.remove('hidden');
  document.querySelector('.topbar .eyebrow').textContent = currentGroup.name;

  ensureMap();
  setTimeout(() => map.invalidateSize(), 80);
  await loadCafes();
}

document.querySelector('#sign-up').addEventListener('click', async () => {
  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;
  const displayName = document.querySelector('#display-name').value.trim();

  if (!email || password.length < 8) {
    showMessage(authMessage, 'Enter a valid email and a password of at least 8 characters.');
    return;
  }

  setBusy(true);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || email.split('@')[0] } }
  });
  setBusy(false);

  if (error) return showMessage(authMessage, error.message);
  if (!data.session) {
    showMessage(authMessage, 'Account created. Check your email and confirm your address, then sign in.', true);
  } else {
    await refreshUI();
  }
});

document.querySelector('#sign-in').addEventListener('click', async () => {
  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;

  setBusy(true);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  setBusy(false);

  if (error) return showMessage(authMessage, error.message);
  await refreshUI();
});

document.querySelector('#sign-out').addEventListener('click', async () => {
  await supabase.auth.signOut();
  await refreshUI();
});

document.querySelector('#create-group').addEventListener('click', async () => {
  const name = document.querySelector('#group-name').value.trim() || 'Kafé Hunters';
  if (!currentUser) return;

  setBusy(true);
  const { error } = await supabase.from('groups').insert({
    name,
    owner_id: currentUser.id
  });
  setBusy(false);

  if (error) return showMessage(appMessage, error.message);
  await refreshUI();
});

document.querySelector('#add-cafe-btn').addEventListener('click', () => {
  showMessage(dialogMessage, '');
  selectedLatLng = null;
  document.querySelector('#lat-display').textContent = '—';
  document.querySelector('#lng-display').textContent = '—';
  cafeDialog.showModal();
  setTimeout(() => map.invalidateSize(), 50);
});

document.querySelector('#close-dialog').addEventListener('click', () => {
  cafeDialog.close();
  if (draftMarker) {
    draftMarker.remove();
    draftMarker = null;
  }
});

function useCurrentLocation() {
  if (!navigator.geolocation) {
    showMessage(dialogMessage, 'This browser does not support location services.');
    return;
  }

  showMessage(dialogMessage, 'Getting your location…', true);

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      selectDraftLocation(lat, lng);
      map.setView([lat, lng], 17);
      showMessage(dialogMessage, 'Location selected. You can drag the pin if needed.', true);
    },
    err => showMessage(dialogMessage, `Could not get your location: ${err.message}`),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
}

document.querySelector('#use-location').addEventListener('click', useCurrentLocation);
document.querySelector('#locate-btn').addEventListener('click', () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    pos => map.setView([pos.coords.latitude, pos.coords.longitude], 16),
    () => showMessage(appMessage, 'Location permission was not available.')
  );
});

document.querySelector('#cafe-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentUser || !currentGroup) return;
  if (!selectedLatLng) {
    showMessage(dialogMessage, 'Choose a location first by tapping the map or using your current location.');
    return;
  }

  const name = document.querySelector('#cafe-name').value.trim();
  if (!name) {
    showMessage(dialogMessage, 'Enter the café name.');
    return;
  }

  setBusy(true);
  const { error } = await supabase.from('cafes').insert({
    group_id: currentGroup.id,
    name,
    category: document.querySelector('#cafe-category').value,
    latitude: selectedLatLng.lat,
    longitude: selectedLatLng.lng,
    address_text: document.querySelector('#cafe-address').value.trim() || null,
    landmark: document.querySelector('#cafe-landmark').value.trim() || null,
    map_source: 'manual',
    created_by: currentUser.id
  });
  setBusy(false);

  if (error) {
    showMessage(dialogMessage, error.message);
    return;
  }

  cafeDialog.close();
  e.target.reset();
  if (draftMarker) {
    draftMarker.remove();
    draftMarker = null;
  }
  selectedLatLng = null;
  showMessage(appMessage, 'Café added to the shared map.', true);
  await loadCafes();
});

supabase.auth.onAuthStateChange(() => setTimeout(refreshUI, 0));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}

refreshUI();
