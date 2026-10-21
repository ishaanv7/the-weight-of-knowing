const SUPABASE_URL = "https://ebghwhhskkygwjvuydqj.supabase.co";
const SUPABASE_KEY = "sb_publishable_oKm2BKkGJtfWKkmX_iZntQ_WhfLwY4j";

const client = window.supabase.createClient(  SUPABASE_URL,  SUPABASE_KEY);

const $ = (id) => document.getElementById(id);

const authPanel = $("auth-panel");
const journalPanel = $("journal-panel");
const statusBox = $("status");
const entryForm = $("entry-form");
const entriesList = $("entries-list");

let currentUser = null;

function showStatus(message) {
  statusBox.textContent = message;
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = label;
  } else {
    button.textContent =
      button.dataset.originalLabel || label;
  }
}

function showApp(user) {
  currentUser = user;
  authPanel.hidden = Boolean(user);
  journalPanel.hidden = !user;

  if (!user) {
    entriesList.replaceChildren();
  }
}

async function signUp() {
  const email = $("email").value.trim();
  const password = $("password").value;
  const button = $("signup-btn");

  if (!email || password.length < 8) {
    showStatus("Enter a valid email and a password of at least 8 characters.");
    return;
  }

  setBusy(button, true, "Creating...");

  try {
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: "https://ishaanv7.github.io/the-weight-of-knowing/"
      }
    });

    if (error) throw error;

    if (data.session) {
      showStatus("Account created. Welcome to your archive.");
    } else {
      showStatus("Check your email to confirm your account, then sign in.");
    }
  } catch (error) {
    showStatus(error.message || "Could not create your account.");
  } finally {
    setBusy(button, false, "Create account");
  }
}

async function signIn(event) {
  event.preventDefault();

  const button = $("login-btn");
  setBusy(button, true, "Signing in...");

  try {
    const { error } = await client.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });

    if (error) throw error;
    showStatus("Signed in successfully.");
  } catch (error) {
    showStatus(error.message || "Could not sign in.");
  } finally {
    setBusy(button, false, "Sign in");
  }
}

async function signOut() {
  const { error } = await client.auth.signOut();

  if (error) {
    showStatus(error.message);
    return;
  }

  showStatus("You have signed out.");
}

async function loadEntries() {
  if (!currentUser) return;

  entriesList.replaceChildren();

  const { data, error } = await client
    .from("entries")
    .select("id, title, body, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    showStatus("Could not load entries: " + error.message);
    return;
  }

  if (!data.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Nothing written yet. Start with one thought.";
    entriesList.append(empty);
    return;
  }

  for (const entry of data) {
    const article = document.createElement("article");
    article.className = "entry";

    const title = document.createElement("h3");
    title.textContent = entry.title;

    const date = document.createElement("time");
    date.dateTime = entry.created_at;
    date.textContent = new Date(entry.created_at).toLocaleString();

    const body = document.createElement("p");
    body.textContent = entry.body;

    const deleteButton = document.createElement("button");
    deleteButton.className = "secondary delete-btn";
    deleteButton.textContent = "Delete entry";

    deleteButton.addEventListener("click", async () => {
      if (!confirm("Delete this entry permanently?")) return;

      deleteButton.disabled = true;

      const { error: deleteError } = await client
        .from("entries")
        .delete()
        .eq("id", entry.id);

      if (deleteError) {
        showStatus("Could not delete: " + deleteError.message);
        deleteButton.disabled = false;
        return;
      }

      showStatus("Entry deleted.");
      await loadEntries();
    });

    article.append(title, date, body, deleteButton);
    entriesList.append(article);
  }
}

async function saveEntry(event) {
  event.preventDefault();

  if (!currentUser) {
    showStatus("Sign in before saving an entry.");
    return;
  }

  const title = $("entry-title").value.trim();
  const body = $("entry-body").value.trim();

  if (!title || !body) {
    showStatus("Write a title and some thoughts first.");
    return;
  }

  const button = entryForm.querySelector('button[type="submit"]');
  setBusy(button, true, "Saving...");

  try {
    const { error } = await client.from("entries").insert({
      title,
      body
    });

    if (error) throw error;

    entryForm.reset();
    showStatus("Your thoughts have been saved.");
    await loadEntries();
  } catch (error) {
    showStatus("Could not save: " + error.message);
  } finally {
    setBusy(button, false, "Save entry ↗");
  }
}

$("auth-form").addEventListener("submit", signIn);
$("signup-btn").addEventListener("click", signUp);
$("logout-btn").addEventListener("click", signOut);
entryForm.addEventListener("submit", saveEntry);

client.auth.onAuthStateChange((_event, session) => {
  showApp(session?.user ?? null);

  // Run database queries outside the auth callback.
  queueMicrotask(() => {
    if (session?.user) {
      loadEntries();
    }
  });
});

async function initialize() {
  const { data, error } = await client.auth.getSession();

  if (error) {
    showStatus("Could not check your session.");
    return;
  }

  showApp(data.session?.user ?? null);

  if (data.session?.user) {
    await loadEntries();
  }
}

initialize();
