const SUPABASE_URL = "https://ebghwhhskkygwjvuydqj.supabase.co";
const SUPABASE_KEY = "sb_publishable_oKm2BKkGJtfWKkmX_iZntQ_WhfLwY4j";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

const authPanel = $("auth-panel");
const journalPanel = $("journal-panel");
const statusBox = $("status");
const entryForm = $("entry-form");
const entriesList = $("entries-list");
const booksList = $("books-list");
const chaptersList = $("chapters-list");

let currentUser = null;
let selectedBook = null;
let selectedChapterId = null;

function showStatus(message) {
  statusBox.textContent = message;
}

function setBusy(button, busy, label) {
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = label;
  } else {
    button.textContent = label;
    delete button.dataset.originalLabel;
  }
}

function showApp(user) {
  currentUser = user;
  authPanel.hidden = Boolean(user);
  journalPanel.hidden = !user;
  if (!user) {
    entriesList.replaceChildren();
    booksList.replaceChildren();
    chaptersList.replaceChildren();
    selectedBook = null;
    selectedChapterId = null;
    $("chapters-panel").hidden = true;
  }
}

function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text ?? "";
  return element;
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
      options: { emailRedirectTo: "https://ishaanv7.github.io/the-weight-of-knowing/" }
    });
    if (error) throw error;
    if (data.session) showStatus("Account created. Welcome to your archive.");
    else showStatus("Check your email to confirm your account, then sign in.");
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

function switchMode(mode) {
  const notes = mode === "notes";
  $("notes-mode").hidden = !notes;
  $("books-mode").hidden = notes;
  $("notes-mode-btn").classList.toggle("active", notes);
  $("notes-mode-btn").classList.toggle("secondary", !notes);
  $("books-mode-btn").classList.toggle("active", !notes);
  $("books-mode-btn").classList.toggle("secondary", notes);
  $("notes-mode-btn").setAttribute("aria-pressed", String(notes));
  $("books-mode-btn").setAttribute("aria-pressed", String(!notes));
  if (!notes) loadBooks();
}

async function loadEntries() {
  if (!currentUser) return;
  entriesList.replaceChildren();
  const { data, error } = await client
    .from("entries")
    .select("id,title,body,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    showStatus("Could not load entries: " + error.message);
    return;
  }
  if (!data?.length) {
    entriesList.append(createTextElement("p", "muted", "Nothing written yet. Start with one thought."));
    return;
  }
  for (const entry of data) {
    const article = createTextElement("article", "entry");
    article.append(createTextElement("h3", "", entry.title));
    const date = document.createElement("time");
    date.dateTime = entry.created_at;
    date.textContent = new Date(entry.created_at).toLocaleString();
    const body = createTextElement("p", "", entry.body);
    const deleteButton = createTextElement("button", "secondary delete-btn", "Delete entry");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", async () => {
      if (!confirm("Delete this entry permanently?")) return;
      deleteButton.disabled = true;
      const { error: deleteError } = await client.from("entries").delete().eq("id", entry.id);
      if (deleteError) {
        showStatus("Could not delete: " + deleteError.message);
        deleteButton.disabled = false;
        return;
      }
      showStatus("Entry deleted.");
      await loadEntries();
    });
    article.append(date, body, deleteButton);
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
    const { error } = await client.from("entries").insert({ title, body });
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

async function createBook(event) {
  event.preventDefault();
  if (!currentUser) return showStatus("Sign in before creating a book.");
  const title = $("book-title").value.trim();
  const description = $("book-description").value.trim();
  if (!title) return showStatus("Give your book a title first.");
  const button = $("create-book-btn");
  setBusy(button, true, "Creating...");
  try {
    const { error } = await client.from("books").insert({ title, description });
    if (error) throw error;
    $("book-form").reset();
    showStatus("Your book has been created.");
    await loadBooks();
  } catch (error) {
    showStatus("Could not create book: " + error.message);
  } finally {
    setBusy(button, false, "Create book ↗");
  }
}

async function loadBooks() {
  if (!currentUser) return;
  booksList.replaceChildren();
  const { data, error } = await client
    .from("books")
    .select("id,title,description,created_at")
    .order("created_at", { ascending: false });
  if (error) {
    showStatus("Could not load books: " + error.message);
    return;
  }
  if (!data?.length) {
    booksList.append(createTextElement("p", "muted", "No books yet. Create your first one above."));
    return;
  }
  for (const book of data) {
    const card = createTextElement("article", "entry book-card");
    card.append(createTextElement("h3", "", book.title));
    if (book.description) card.append(createTextElement("p", "book-description", book.description));
    const actions = createTextElement("div", "actions", "");
    const openButton = createTextElement("button", "", "Open book");
    openButton.type = "button";
    openButton.addEventListener("click", () => openBook(book));
    const deleteButton = createTextElement("button", "secondary delete-btn", "Delete book");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", async () => {
      if (!confirm(`Delete "${book.title}" and all its chapters permanently?`)) return;
      deleteButton.disabled = true;
      const { error: deleteError } = await client.from("books").delete().eq("id", book.id);
      if (deleteError) {
        showStatus("Could not delete book: " + deleteError.message);
        deleteButton.disabled = false;
        return;
      }
      if (selectedBook?.id === book.id) {
        selectedBook = null;
        selectedChapterId = null;
        $("chapters-panel").hidden = true;
      }
      showStatus("Book deleted.");
      await loadBooks();
    });
    actions.append(openButton, deleteButton);
    card.append(actions);
    booksList.append(card);
  }
}

async function openBook(book) {
  selectedBook = book;
  selectedChapterId = null;
  $("selected-book-title").textContent = book.title;
  $("selected-book-description").textContent = book.description || "No description added.";
  $("chapters-panel").hidden = false;
  $("chapter-form").reset();
  $("save-chapter-btn").textContent = "Save chapter ↗";
  $("chapter-title").disabled = false;
  $("chapter-body").disabled = false;
  await loadChapters();
  $("chapters-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadChapters() {
  if (!currentUser || !selectedBook) return;
  chaptersList.replaceChildren();
  const { data, error } = await client
    .from("chapters")
    .select("id,book_id,title,body,chapter_order,created_at,updated_at")
    .eq("book_id", selectedBook.id)
    .order("chapter_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    showStatus("Could not load chapters: " + error.message);
    return;
  }
  if (!data?.length) {
    chaptersList.append(createTextElement("p", "muted", "No chapters yet. Add the first chapter above."));
    return;
  }
  data.forEach((chapter, index) => {
    const article = createTextElement("article", "entry chapter-card");
    article.append(createTextElement("h3", "", chapter.title));
    const meta = createTextElement("p", "muted", `Chapter ${index + 1} · Updated ${new Date(chapter.updated_at || chapter.created_at).toLocaleDateString()}`);
    const previewText = chapter.body.length > 320 ? chapter.body.slice(0, 320) + "…" : chapter.body;
    const preview = createTextElement("p", "chapter-preview", previewText);
    const actions = createTextElement("div", "actions", "");
    const editButton = createTextElement("button", "secondary", "Edit chapter");
    editButton.type = "button";
    editButton.addEventListener("click", () => {
      selectedChapterId = chapter.id;
      $("chapter-title").value = chapter.title;
      $("chapter-body").value = chapter.body;
      $("save-chapter-btn").textContent = "Update chapter ↗";
      $("chapter-title").focus();
    });
    const deleteButton = createTextElement("button", "secondary delete-btn", "Delete chapter");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", async () => {
      if (!confirm(`Delete "${chapter.title}" permanently?`)) return;
      deleteButton.disabled = true;
      const { error: deleteError } = await client.from("chapters").delete().eq("id", chapter.id);
      if (deleteError) {
        showStatus("Could not delete chapter: " + deleteError.message);
        deleteButton.disabled = false;
        return;
      }
      if (selectedChapterId === chapter.id) resetChapterEditor();
      showStatus("Chapter deleted.");
      await loadChapters();
    });
    actions.append(editButton, deleteButton);
    article.append(meta, preview, actions);
    chaptersList.append(article);
  });
}

function resetChapterEditor() {
  selectedChapterId = null;
  $("chapter-form").reset();
  $("save-chapter-btn").textContent = "Save chapter ↗";
}

async function saveChapter(event) {
  event.preventDefault();
  if (!currentUser || !selectedBook) return showStatus("Open a book before saving a chapter.");
  const title = $("chapter-title").value.trim();
  const body = $("chapter-body").value.trim();
  if (!title || !body) return showStatus("Add a chapter title and some writing first.");
  const button = $("save-chapter-btn");
  setBusy(button, true, selectedChapterId ? "Updating..." : "Saving...");
  try {
    if (selectedChapterId) {
      const { error } = await client.from("chapters")
        .update({ title, body, updated_at: new Date().toISOString() })
        .eq("id", selectedChapterId)
        .eq("book_id", selectedBook.id);
      if (error) throw error;
      showStatus("Chapter updated.");
    } else {
      const { count, error: countError } = await client.from("chapters")
        .select("id", { count: "exact", head: true })
        .eq("book_id", selectedBook.id);
      if (countError) throw countError;
      const { error } = await client.from("chapters").insert({
        book_id: selectedBook.id,
        title,
        body,
        chapter_order: (count || 0) + 1
      });
      if (error) throw error;
      showStatus("Chapter saved.");
    }
    resetChapterEditor();
    await loadChapters();
  } catch (error) {
    showStatus("Could not save chapter: " + error.message);
  } finally {
    setBusy(button, false, selectedChapterId ? "Update chapter ↗" : "Save chapter ↗");
  }
}

$("auth-form").addEventListener("submit", signIn);
$("signup-btn").addEventListener("click", signUp);
$("logout-btn").addEventListener("click", signOut);
entryForm.addEventListener("submit", saveEntry);
$("book-form").addEventListener("submit", createBook);
$("chapter-form").addEventListener("submit", saveChapter);
$("notes-mode-btn").addEventListener("click", () => switchMode("notes"));
$("books-mode-btn").addEventListener("click", () => switchMode("books"));
$("close-book-btn").addEventListener("click", () => {
  $("chapters-panel").hidden = true;
  selectedBook = null;
  selectedChapterId = null;
  resetChapterEditor();
});

client.auth.onAuthStateChange((_event, session) => {
  showApp(session?.user ?? null);
  queueMicrotask(() => {
    if (session?.user) {
      loadEntries();
      if (!$("books-mode").hidden) loadBooks();
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
  if (data.session?.user) await loadEntries();
}
initialize();
