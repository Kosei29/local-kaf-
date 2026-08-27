import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const SUPABASE_URL="https://reybalitebntwzkmujeo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_mz0eHqZgfIxoqAAx9hFCJg_3ZsKBJjb";
const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);

let currentUser=null,currentGroup=null,map=null,cafeLayer=null,draftMarker=null,selectedLatLng=null,placementMode=false,cafesById={};
let selectedCafeId=null;

const TYPES={
  cafe:{label:'Coffee Café',icon:'☕'},bakery_cafe:{label:'Pastry Café',icon:'🥐'},
  restaurant_cafe:{label:'Restaurant Café',icon:'🍽️'},board_game_cafe:{label:'Board Game Café',icon:'🎲'},
  street_cafe:{label:'Street Café',icon:'🪑'},mobile_cafe:{label:'Mobile Café',icon:'🚚'},
  specialty_cafe:{label:'Specialty Café',icon:'🫘'},chain_cafe:{label:'Coffee Café',icon:'☕'},other:{label:'Other / Hybrid',icon:'✨'}
};

const q=s=>document.querySelector(s);
const authCard=q('#auth-card'),appCard=q('#app-card'),groupEmpty=q('#group-empty'),mapView=q('#map-view');
const authMessage=q('#auth-message'),appMessage=q('#app-message'),dialogMessage=q('#dialog-message');
const cafeDialog=q('#cafe-dialog'),viewDialog=q('#view-dialog'),visitDialog=q('#visit-dialog');
const placementPanel=q('#placement-panel'),addCafeBtn=q('#add-cafe-btn'),placementNext=q('#placement-next');

function showMessage(el,text,success=false){el.textContent=text||'';el.style.color=success?'#2f6a42':'#7b3f2c'}
function setBusy(busy){document.querySelectorAll('button').forEach(btn=>btn.disabled=busy);if(placementMode&&selectedLatLng)placementNext.disabled=false}
function cafeType(c){return TYPES[c]||TYPES.other}
function markerIcon(c){const t=cafeType(c);return L.divIcon({className:'kafe-marker',html:`<div class="kafe-marker-inner"><span>${t.icon}</span></div>`,iconSize:[42,42],iconAnchor:[21,39],popupAnchor:[0,-36]})}
function ensureMap(){if(map)return;map=L.map('map',{zoomControl:true}).setView([14.5995,120.9842],11);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);cafeLayer=L.layerGroup().addTo(map);map.on('click',e=>{if(placementMode)selectDraftLocation(e.latlng.lat,e.latlng.lng)})}
function beginPlacement(){placementMode=true;selectedLatLng=null;if(draftMarker){draftMarker.remove();draftMarker=null}placementNext.disabled=true;placementPanel.classList.remove('hidden');addCafeBtn.classList.add('hidden');showMessage(appMessage,'Tap anywhere on the map to place the café pin.',true)}
function cancelPlacement(){placementMode=false;selectedLatLng=null;if(draftMarker){draftMarker.remove();draftMarker=null}placementPanel.classList.add('hidden');addCafeBtn.classList.remove('hidden');showMessage(appMessage,'')}
function selectDraftLocation(lat,lng){selectedLatLng={lat,lng};placementNext.disabled=false;if(draftMarker)draftMarker.remove();draftMarker=L.marker([lat,lng],{draggable:true}).addTo(map);draftMarker.on('dragend',()=>{const p=draftMarker.getLatLng();selectedLatLng={lat:p.lat,lng:p.lng}})}
function openDetailsDialog(){if(!selectedLatLng)return;placementMode=false;placementPanel.classList.add('hidden');addCafeBtn.classList.remove('hidden');q('#lat-display').textContent=selectedLatLng.lat.toFixed(6);q('#lng-display').textContent=selectedLatLng.lng.toFixed(6);showMessage(dialogMessage,'');cafeDialog.showModal()}
function useCurrentLocation(forPlacement=true){if(!navigator.geolocation)return showMessage(appMessage,'This browser does not support location services.');navigator.geolocation.getCurrentPosition(pos=>{const lat=pos.coords.latitude,lng=pos.coords.longitude;if(forPlacement){selectDraftLocation(lat,lng);map.setView([lat,lng],17)}else map.setView([lat,lng],16)},err=>showMessage(appMessage,`Could not get your location: ${err.message}`),{enableHighAccuracy:true,timeout:12000,maximumAge:30000})}
function escapeHtml(text=''){return String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}

window.openCafeProfile=async id=>{
  const c=cafesById[id];if(!c)return;
  selectedCafeId=id;
  const t=cafeType(c.category);
  q('#view-type').textContent=`${t.icon} ${t.label}`;q('#view-name').textContent=c.name;q('#view-icon').textContent=t.icon;
  q('#view-address').textContent=c.address_text||'Not added';q('#view-landmark').textContent=c.landmark||'Not added';
  q('#view-coords').textContent=`${Number(c.latitude).toFixed(6)}, ${Number(c.longitude).toFixed(6)}`;
  q('#visit-note').value='';q('#visit-date').value=new Date().toISOString().slice(0,16);
  await loadVisits(id);viewDialog.showModal();
};

async function loadVisits(cafeId){
  const list=q('#visits-list');list.innerHTML='<p class="muted">Loading visits…</p>';
  const{data,error}=await supabase.from('cafe_visits').select('id,visited_by,visited_at,note,created_at,profiles(display_name)').eq('cafe_id',cafeId).order('visited_at',{ascending:false});
  if(error){list.innerHTML='';showMessage(appMessage,error.message);return}
  q('#visit-count').textContent=`${data?.length||0} visit${data?.length===1?'':'s'}`;
  if(!data?.length){list.innerHTML='<p class="muted">No visits recorded yet. Be the first to log one.</p>';return}
  list.innerHTML=data.map(v=>{const name=escapeHtml(v.profiles?.display_name||'Local Kafé member');const note=escapeHtml(v.note);const date=new Date(v.visited_at).toLocaleString([], {dateStyle:'medium',timeStyle:'short'});return `<article class="visit-card"><div class="visit-head"><strong>${name}</strong><time>${escapeHtml(date)}</time></div><p>${note}</p></article>`}).join('');
}

async function loadCafes(){
  if(!currentGroup||!map)return;
  const{data,error}=await supabase.from('cafes').select('id,name,category,latitude,longitude,address_text,landmark,created_at').eq('group_id',currentGroup.id).order('created_at',{ascending:false});
  if(error)return showMessage(appMessage,error.message);
  cafeLayer.clearLayers();cafesById={};
  for(const cafe of data||[]){
    cafesById[cafe.id]=cafe;const t=cafeType(cafe.category);const parts=[t.label,cafe.address_text,cafe.landmark?`Near ${cafe.landmark}`:null].filter(Boolean);
    L.marker([Number(cafe.latitude),Number(cafe.longitude)],{icon:markerIcon(cafe.category)}).addTo(cafeLayer).bindPopup(`<div class="popup-title">${t.icon} ${escapeHtml(cafe.name)}</div><div class="popup-meta">${escapeHtml(parts.join(' · '))}</div><button class="popup-view" onclick="openCafeProfile('${cafe.id}')">View café</button>`)
  }
  q('#cafe-count').textContent=`${data?.length||0} café${data?.length===1?'':'s'}`;
}

async function refreshUI(){
  const{data:{user}}=await supabase.auth.getUser();currentUser=user;
  if(!user){currentGroup=null;authCard.classList.remove('hidden');appCard.classList.add('hidden');return}
  authCard.classList.add('hidden');appCard.classList.remove('hidden');
  const{data:profile}=await supabase.from('profiles').select('display_name').eq('id',user.id).single();q('#user-name').textContent=profile?.display_name||'Local Kafé member';
  const{data:memberships,error}=await supabase.from('group_members').select('role, groups(id, name)').eq('user_id',user.id).limit(1);
  if(error)return showMessage(appMessage,error.message);
  currentGroup=memberships?.[0]?.groups||null;
  if(!currentGroup){groupEmpty.classList.remove('hidden');mapView.classList.add('hidden');return}
  groupEmpty.classList.add('hidden');mapView.classList.remove('hidden');q('#group-label').textContent=currentGroup.name;ensureMap();setTimeout(()=>map.invalidateSize(),80);await loadCafes();
}

q('#sign-up').addEventListener('click',async()=>{const email=q('#email').value.trim(),password=q('#password').value,displayName=q('#display-name').value.trim();if(!email||password.length<8)return showMessage(authMessage,'Enter a valid email and a password of at least 8 characters.');setBusy(true);const{data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:displayName||email.split('@')[0]}}});setBusy(false);if(error)return showMessage(authMessage,error.message);if(!data.session)showMessage(authMessage,'Account created. Check your email and confirm your address, then sign in.',true);else await refreshUI()});
q('#sign-in').addEventListener('click',async()=>{const{error}=await supabase.auth.signInWithPassword({email:q('#email').value.trim(),password:q('#password').value});if(error)return showMessage(authMessage,error.message);await refreshUI()});
q('#sign-out').addEventListener('click',async()=>{await supabase.auth.signOut();await refreshUI()});
q('#create-group').addEventListener('click',async()=>{const{error}=await supabase.from('groups').insert({name:q('#group-name').value.trim()||'Kafé Hunters',owner_id:currentUser.id});if(error)return showMessage(appMessage,error.message);await refreshUI()});
addCafeBtn.addEventListener('click',beginPlacement);q('#placement-cancel').addEventListener('click',cancelPlacement);q('#placement-location').addEventListener('click',()=>useCurrentLocation(true));placementNext.addEventListener('click',openDetailsDialog);
q('#change-pin').addEventListener('click',()=>{cafeDialog.close();placementMode=true;placementPanel.classList.remove('hidden');addCafeBtn.classList.add('hidden');placementNext.disabled=!selectedLatLng;if(selectedLatLng&&!draftMarker)draftMarker=L.marker([selectedLatLng.lat,selectedLatLng.lng],{draggable:true}).addTo(map)});
q('#close-dialog').addEventListener('click',()=>{cafeDialog.close();cancelPlacement()});q('#close-view').addEventListener('click',()=>viewDialog.close());q('#close-visit').addEventListener('click',()=>visitDialog.close());q('#locate-btn').addEventListener('click',()=>useCurrentLocation(false));
q('#add-visit-btn').addEventListener('click',()=>{q('#visit-note').value='';q('#visit-date').value=new Date().toISOString().slice(0,16);visitDialog.showModal()});

q('#cafe-form').addEventListener('submit',async e=>{e.preventDefault();if(!currentUser||!currentGroup||!selectedLatLng)return;const name=q('#cafe-name').value.trim();if(!name)return showMessage(dialogMessage,'Enter the café name.');setBusy(true);const{error}=await supabase.from('cafes').insert({group_id:currentGroup.id,name,category:q('#cafe-category').value,latitude:selectedLatLng.lat,longitude:selectedLatLng.lng,address_text:q('#cafe-address').value.trim()||null,landmark:q('#cafe-landmark').value.trim()||null,map_source:'manual',created_by:currentUser.id});setBusy(false);if(error)return showMessage(dialogMessage,error.message);cafeDialog.close();e.target.reset();if(draftMarker){draftMarker.remove();draftMarker=null}selectedLatLng=null;placementMode=false;showMessage(appMessage,'Café added to the shared map.',true);await loadCafes()});

q('#visit-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!currentUser||!selectedCafeId)return;
  const note=q('#visit-note').value.trim(),date=q('#visit-date').value;
  if(!note)return showMessage(q('#visit-message'),'Write a note about this visit.');
  if(!date)return showMessage(q('#visit-message'),'Choose the visit date and time.');
  q('#save-visit').disabled=true;
  const{error}=await supabase.from('cafe_visits').insert({cafe_id:selectedCafeId,visited_by:currentUser.id,visited_at:new Date(date).toISOString(),note});
  q('#save-visit').disabled=false;
  if(error)return showMessage(q('#visit-message'),error.message);
  visitDialog.close();showMessage(q('#visit-message'),'');await loadVisits(selectedCafeId);
});

supabase.auth.onAuthStateChange(()=>setTimeout(refreshUI,0));
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(console.error);
refreshUI();
