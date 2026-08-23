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
let placementMode = false;

const authCard = document.querySelector('#auth-card');
const appCard = document.querySelector('#app-card');
const groupEmpty = document.querySelector('#group-empty');
const mapView = document.querySelector('#map-view');
const authMessage = document.querySelector('#auth-message');
const appMessage = document.querySelector('#app-message');
const dialogMessage = document.querySelector('#dialog-message');
const cafeDialog = document.querySelector('#cafe-dialog');
const placementPanel = document.querySelector('#placement-panel');
const addCafeBtn = document.querySelector('#add-cafe-btn');
const placementNext = document.querySelector('#placement-next');

function showMessage(el, text, success=false) {
  el.textContent = text || '';
  el.style.color = success ? '#2f6a42' : '#7b3f2c';
}

function setBusy(busy) {
  document.querySelectorAll('button').forEach(btn => btn.disabled = busy);
  if (placementMode && selectedLatLng) placementNext.disabled = false;
}

function ensureMap() {
  if (map) return;

  map = L.map('map', { zoomControl:true }).setView([14.5995,120.9842],11);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19,
    attribution:'&copy; OpenStreetMap contributors'
  }).addTo(map);

  cafeLayer = L.layerGroup().addTo(map);

  map.on('click', e => {
    if (!placementMode) return;
    selectDraftLocation(e.latlng.lat, e.latlng.lng);
  });
}

function beginPlacement() {
  placementMode = true;
  selectedLatLng = null;
  if (draftMarker) {
    draftMarker.remove();
    draftMarker = null;
  }
  placementNext.disabled = true;
  placementPanel.classList.remove('hidden');
  addCafeBtn.classList.add('hidden');
  showMessage(appMessage, 'Tap anywhere on the map to place the café pin.', true);
}

function cancelPlacement() {
  placementMode = false;
  selectedLatLng = null;
  if (draftMarker) {
    draftMarker.remove();
    draftMarker = null;
  }
  placementPanel.classList.add('hidden');
  addCafeBtn.classList.remove('hidden');
  showMessage(appMessage, '');
}

function selectDraftLocation(lat,lng) {
  selectedLatLng = {lat,lng};
  placementNext.disabled = false;

  if (draftMarker) draftMarker.remove();
  draftMarker = L.marker([lat,lng], {draggable:true}).addTo(map);
  draftMarker.on('dragend', () => {
    const p = draftMarker.getLatLng();
    selectedLatLng = {lat:p.lat,lng:p.lng};
  });
}

function openDetailsDialog() {
  if (!selectedLatLng) return;
  placementMode = false;
  placementPanel.classList.add('hidden');
  addCafeBtn.classList.remove('hidden');
  document.querySelector('#lat-display').textContent = selectedLatLng.lat.toFixed(6);
  document.querySelector('#lng-display').textContent = selectedLatLng.lng.toFixed(6);
  showMessage(dialogMessage, '');
  cafeDialog.showModal();
}

function useCurrentLocation(forPlacement=true) {
  if (!navigator.geolocation) {
    showMessage(appMessage, 'This browser does not support location services.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat=pos.coords.latitude, lng=pos.coords.longitude;
      if (forPlacement) {
        selectDraftLocation(lat,lng);
        map.setView([lat,lng],17);
      } else {
        map.setView([lat,lng],16);
      }
    },
    err => showMessage(appMessage, `Could not get your location: ${err.message}`),
    {enableHighAccuracy:true, timeout:12000, maximumAge:30000}
  );
}

async function loadCafes() {
  if (!currentGroup || !map) return;

  const {data,error} = await supabase
    .from('cafes')
    .select('id,name,category,latitude,longitude,address_text,landmark,created_at')
    .eq('group_id',currentGroup.id)
    .order('created_at',{ascending:false});

  if (error) return showMessage(appMessage,error.message);

  cafeLayer.clearLayers();

  for (const cafe of data || []) {
    const parts = [
      cafe.category?.replaceAll('_',' '),
      cafe.address_text,
      cafe.landmark ? `Near ${cafe.landmark}` : null
    ].filter(Boolean);

    L.marker([Number(cafe.latitude),Number(cafe.longitude)])
      .addTo(cafeLayer)
      .bindPopup(`<div class="popup-title">☕ ${escapeHtml(cafe.name)}</div><div class="popup-meta">${escapeHtml(parts.join(' · '))}</div>`);
  }

  document.querySelector('#cafe-count').textContent = `${data?.length || 0} café${data?.length===1?'':'s'}`;
}

function escapeHtml(text='') {
  return String(text)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

async function refreshUI() {
  const {data:{user}} = await supabase.auth.getUser();
  currentUser = user;

  if (!user) {
    currentGroup=null;
    authCard.classList.remove('hidden');
    appCard.classList.add('hidden');
    return;
  }

  authCard.classList.add('hidden');
  appCard.classList.remove('hidden');

  const {data:profile} = await supabase.from('profiles').select('display_name').eq('id',user.id).single();
  document.querySelector('#user-name').textContent = profile?.display_name || 'Local Kafé member';

  const {data:memberships,error} = await supabase
    .from('group_members')
    .select('role, groups(id, name)')
    .eq('user_id',user.id)
    .limit(1);

  if (error) return showMessage(appMessage,error.message);

  currentGroup = memberships?.[0]?.groups || null;

  if (!currentGroup) {
    groupEmpty.classList.remove('hidden');
    mapView.classList.add('hidden');
    return;
  }

  groupEmpty.classList.add('hidden');
  mapView.classList.remove('hidden');
  document.querySelector('#group-label').textContent = currentGroup.name;

  ensureMap();
  setTimeout(()=>map.invalidateSize(),80);
  await loadCafes();
}

document.querySelector('#sign-up').addEventListener('click', async () => {
  const email=document.querySelector('#email').value.trim();
  const password=document.querySelector('#password').value;
  const displayName=document.querySelector('#display-name').value.trim();

  if (!email || password.length<8) return showMessage(authMessage,'Enter a valid email and a password of at least 8 characters.');

  setBusy(true);
  const {data,error} = await supabase.auth.signUp({
    email,password,
    options:{data:{display_name:displayName || email.split('@')[0]}}
  });
  setBusy(false);

  if (error) return showMessage(authMessage,error.message);
  if (!data.session) showMessage(authMessage,'Account created. Check your email and confirm your address, then sign in.',true);
  else await refreshUI();
});

document.querySelector('#sign-in').addEventListener('click', async () => {
  const email=document.querySelector('#email').value.trim();
  const password=document.querySelector('#password').value;
  setBusy(true);
  const {error} = await supabase.auth.signInWithPassword({email,password});
  setBusy(false);
  if (error) return showMessage(authMessage,error.message);
  await refreshUI();
});

document.querySelector('#sign-out').addEventListener('click', async () => {
  await supabase.auth.signOut();
  await refreshUI();
});

document.querySelector('#create-group').addEventListener('click', async () => {
  const name=document.querySelector('#group-name').value.trim() || 'Kafé Hunters';
  if (!currentUser) return;
  setBusy(true);
  const {error} = await supabase.from('groups').insert({name,owner_id:currentUser.id});
  setBusy(false);
  if (error) return showMessage(appMessage,error.message);
  await refreshUI();
});

addCafeBtn.addEventListener('click', beginPlacement);
document.querySelector('#placement-cancel').addEventListener('click', cancelPlacement);
document.querySelector('#placement-location').addEventListener('click', () => useCurrentLocation(true));
placementNext.addEventListener('click', openDetailsDialog);

document.querySelector('#change-pin').addEventListener('click', () => {
  cafeDialog.close();
  placementMode=true;
  placementPanel.classList.remove('hidden');
  addCafeBtn.classList.add('hidden');
  placementNext.disabled = !selectedLatLng;
  if (selectedLatLng && !draftMarker) {
    draftMarker=L.marker([selectedLatLng.lat,selectedLatLng.lng],{draggable:true}).addTo(map);
  }
});

document.querySelector('#close-dialog').addEventListener('click', () => {
  cafeDialog.close();
  cancelPlacement();
});

document.querySelector('#locate-btn').addEventListener('click', () => useCurrentLocation(false));

document.querySelector('#cafe-form').addEventListener('submit', async e => {
  e.preventDefault();

  if (!currentUser || !currentGroup || !selectedLatLng) return;

  const name=document.querySelector('#cafe-name').value.trim();
  if (!name) return showMessage(dialogMessage,'Enter the café name.');

  setBusy(true);
  const {error} = await supabase.from('cafes').insert({
    group_id:currentGroup.id,
    name,
    category:document.querySelector('#cafe-category').value,
    latitude:selectedLatLng.lat,
    longitude:selectedLatLng.lng,
    address_text:document.querySelector('#cafe-address').value.trim() || null,
    landmark:document.querySelector('#cafe-landmark').value.trim() || null,
    map_source:'manual',
    created_by:currentUser.id
  });
  setBusy(false);

  if (error) return showMessage(dialogMessage,error.message);

  cafeDialog.close();
  e.target.reset();

  if (draftMarker) {
    draftMarker.remove();
    draftMarker=null;
  }
  selectedLatLng=null;
  placementMode=false;
  showMessage(appMessage,'Café added to the shared map.',true);
  await loadCafes();
});

supabase.auth.onAuthStateChange(()=>setTimeout(refreshUI,0));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}

refreshUI();
