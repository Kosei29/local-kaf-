import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm';

const SUPABASE_URL = "https://reybalitebntwzkmujeo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_mz0eHqZgfIxoqAAx9hFCJg_3ZsKBJjb";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const authCard = document.querySelector('#auth-card');
const appCard = document.querySelector('#app-card');
const authMessage = document.querySelector('#auth-message');
const appMessage = document.querySelector('#app-message');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const displayNameInput = document.querySelector('#display-name');
const groupEmpty = document.querySelector('#group-empty');
const groupReady = document.querySelector('#group-ready');

function setBusy(busy) {
  document.querySelectorAll('button').forEach(btn => btn.disabled = busy);
}

function showMessage(el, text, success = false) {
  el.textContent = text || '';
  el.style.color = success ? '#2f6a42' : '#7b3f2c';
}

async function refreshUI() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
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
  document.querySelector('#user-email').textContent = user.email || '';

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
  if (!membership?.groups) {
    groupEmpty.classList.remove('hidden');
    groupReady.classList.add('hidden');
  } else {
    groupEmpty.classList.add('hidden');
    groupReady.classList.remove('hidden');
    document.querySelector('#current-group-name').textContent = membership.groups.name;
  }
}

document.querySelector('#sign-up').addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const displayName = displayNameInput.value.trim();

  if (!email || password.length < 8) {
    showMessage(authMessage, 'Enter a valid email and a password of at least 8 characters.');
    return;
  }

  setBusy(true);
  showMessage(authMessage, '');

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email.split('@')[0] }
    }
  });

  setBusy(false);

  if (error) {
    showMessage(authMessage, error.message);
    return;
  }

  if (!data.session) {
    showMessage(authMessage, 'Account created. Check your email and confirm your address, then sign in.', true);
  } else {
    await refreshUI();
  }
});

document.querySelector('#sign-in').addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  setBusy(true);
  showMessage(authMessage, '');

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  setBusy(false);

  if (error) {
    showMessage(authMessage, error.message);
    return;
  }

  await refreshUI();
});

document.querySelector('#sign-out').addEventListener('click', async () => {
  await supabase.auth.signOut();
  await refreshUI();
});

document.querySelector('#create-group').addEventListener('click', async () => {
  const name = document.querySelector('#group-name').value.trim() || 'Local Kafé';
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    showMessage(appMessage, 'Please sign in again.');
    return;
  }

  setBusy(true);
  showMessage(appMessage, '');

  const { error } = await supabase
    .from('groups')
    .insert({ name, owner_id: user.id });

  setBusy(false);

  if (error) {
    showMessage(appMessage, error.message);
    return;
  }

  showMessage(appMessage, 'Group created successfully.', true);
  await refreshUI();
});

supabase.auth.onAuthStateChange(() => {
  setTimeout(refreshUI, 0);
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.error);
}

refreshUI();
