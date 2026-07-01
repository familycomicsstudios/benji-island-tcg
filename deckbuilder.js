(() => {
  const elements = {
    cardSearch: document.getElementById("cardSearch"),
    setFilter: document.getElementById("setFilter"),
    availableCards: document.getElementById("availableCards"),
    deckList: document.getElementById("deckList"),
    deckSummary: document.getElementById("deckSummary"),
    deckIssues: document.getElementById("deckIssues"),
    deckInput: document.getElementById("deckInput"),
    exportSet: document.getElementById("exportSet"),
    exportNames: document.getElementById("exportNames"),
    deckNameInput: document.getElementById("deckNameInput"),
    newDeck: document.getElementById("newDeck"),
    toggleImport: document.getElementById("toggleImport"),
    applyImport: document.getElementById("applyImport"),
    cancelImport: document.getElementById("cancelImport"),
    importPanel: document.getElementById("importPanel"),
    importText: document.getElementById("importText"),
    importStatus: document.getElementById("importStatus"),
    copyExport: document.getElementById("copyExport")
  };

  const state = {
    cards: [],
    entries: [],
    search: "",
    setFilter: "all",
    deckName: "Untitled Deck"
  };

  function init() {
    state.search = readSearchFromUrl();
    elements.cardSearch.value = state.search;

    fetch("json/bs26.json")
      .then((response) => response.json())
      .then((cards) => {
        state.cards = cards;
        populateSetFilter(cards);
        render();
      });

    elements.cardSearch.addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      syncSearchToUrl();
      renderCatalog();
    });

    elements.setFilter.addEventListener("change", (event) => {
      state.setFilter = event.target.value;
      renderCatalog();
    });

    elements.deckNameInput.addEventListener("input", (event) => {
      state.deckName = event.target.value.trim() || "Untitled Deck";
      elements.deckNameInput.value = state.deckName;
    });

    elements.newDeck.addEventListener("click", newDeck);
    elements.toggleImport.addEventListener("click", () => {
      elements.importPanel.classList.toggle("hidden");
      if (!elements.importPanel.classList.contains("hidden")) {
        elements.importText.focus();
      }
    });
    elements.cancelImport.addEventListener("click", () => {
      elements.importPanel.classList.add("hidden");
      elements.importStatus.textContent = "";
    });
    elements.applyImport.addEventListener("click", importDeck);
    elements.copyExport.addEventListener("click", copyNameExport);
  }

  function populateSetFilter(cards) {
    const sets = [...new Set(cards.map((card) => card["set name"]).filter(Boolean))].sort();
    elements.setFilter.innerHTML = '<option value="all">All sets</option>';
    sets.forEach((setName) => {
      const option = document.createElement("option");
      option.value = setName;
      option.textContent = setName;
      elements.setFilter.appendChild(option);
    });
  }

  function getCardKey(card) {
    return card.id || `${card["set name"]}/${card["card number"]}`;
  }

  function isUniqueCard(card) {
    return (card.cardtype || "").toLowerCase().includes("unique");
  }

  function getRarity(card) {
    return ((card && card.rarity) || "").trim() || "Common";
  }

  function getCardTypeGroup(card) {
    const typeText = (card.cardtype || "").toLowerCase();
    if (typeText.includes("character")) return "Characters";
    if (typeText.includes("artifact")) return "Artifacts";
    if (typeText.includes("location")) return "Locations";
    if (typeText.includes("action")) return "Actions";
    return "Other";
  }

  function addCard(card) {
    const key = getCardKey(card);
    const existing = state.entries.find((entry) => entry.key === key);
    if (existing) {
      existing.count += 1;
    } else {
      state.entries.push({ key, card, count: 1 });
    }
    render();
  }

  function adjustCardCount(key, delta) {
    const index = state.entries.findIndex((entry) => entry.key === key);
    if (index < 0) return;

    const next = state.entries[index].count + delta;
    if (next <= 0) {
      state.entries.splice(index, 1);
    } else {
      state.entries[index].count = next;
    }
    render();
  }

  function removeCard(key) {
    const index = state.entries.findIndex((entry) => entry.key === key);
    if (index >= 0) {
      state.entries.splice(index, 1);
      render();
    }
  }

  function syncSearchToUrl() {
    const url = new URL(window.location.href);
    if (state.search) {
      url.searchParams.set("q", state.search);
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function readSearchFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || params.get("search") || "";
  }

  function getFilteredCards() {
    const queryMatches = window.SuperBenjiSearch?.searchCards
      ? window.SuperBenjiSearch.searchCards(state.search, state.cards)
      : state.cards.filter((card) => {
          const haystack = [card.cardname, card.cardtype, card.cardtext, card["set name"], card.rarity]
            .join(" ")
            .toLowerCase();
          return !state.search || haystack.includes(state.search.toLowerCase());
        });

    return queryMatches.filter((card) => state.setFilter === "all" || card["set name"] === state.setFilter);
  }

  function renderCatalog() {
    const filteredCards = getFilteredCards();
    elements.availableCards.innerHTML = "";

    if (!filteredCards.length) {
      elements.availableCards.innerHTML = '<p class="empty-state">No cards match the current filters.</p>';
      return;
    }

    filteredCards.forEach((card) => {
      const cardElement = document.createElement("button");
      cardElement.type = "button";
      cardElement.className = "card-choice";
      cardElement.innerHTML = `
        <strong>${card.cardname}</strong>
        <span>${card["set name"]} · ${getRarity(card)}</span>
        <small>${card.cardtype}</small>
      `;
      cardElement.addEventListener("click", () => addCard(card));
      elements.availableCards.appendChild(cardElement);
    });
  }

  function getIssues() {
    const issues = [];
    const totalCards = state.entries.reduce((sum, entry) => sum + entry.count, 0);

    if (totalCards !== 27) {
      issues.push(`Deck size is ${totalCards}; the deck must contain exactly 27 cards.`);
    }

    const byName = new Map();
    state.entries.forEach((entry) => {
      const name = entry.card.cardname;
      byName.set(name, (byName.get(name) || 0) + entry.count);
    });

    byName.forEach((count, name) => {
      const card = state.entries.find((entry) => entry.card.cardname === name)?.card;
      if (!card) return;
      if (isUniqueCard(card) && count > 1) {
        issues.push(`${name} is unique and may only appear once.`);
      } else if (!isUniqueCard(card) && count > 3) {
        issues.push(`${name} has ${count} copies, but the limit is 3.`);
      }
    });

    return issues;
  }

  function renderIssues() {
    const issues = getIssues();
    if (!issues.length) {
      elements.deckIssues.innerHTML = '<div class="issue good">No rules issues detected.</div>';
      return;
    }

    elements.deckIssues.innerHTML = `
      <div class="issue bad">${issues.length} issue${issues.length === 1 ? "" : "s"} need attention:</div>
      <ul class="issue-list">
        ${issues.map((issue) => `<li>${issue}</li>`).join("")}
      </ul>
    `;
  }

  function renderSummary() {
    const totalCards = state.entries.reduce((sum, entry) => sum + entry.count, 0);
    const issues = getIssues();
    const legal = issues.length === 0;
    elements.deckSummary.innerHTML = `
      <div class="summary-line"><strong>${totalCards}</strong> / 27 cards</div>
      <div class="summary-line ${legal ? "good" : "bad"}">${legal ? "Deck is legal." : "Deck is illegal."}</div>
    `;
  }

  function renderDeckList() {
    elements.deckList.innerHTML = "";

    if (!state.entries.length) {
      elements.deckList.innerHTML = '<p class="empty-state">Add cards to build your deck.</p>';
      return;
    }

    const groups = new Map();
    state.entries.forEach((entry) => {
      const group = getCardTypeGroup(entry.card);
      const bucket = groups.get(group) || [];
      bucket.push(entry);
      groups.set(group, bucket);
    });

    const groupOrder = ["Characters", "Artifacts", "Locations", "Actions", "Other"];
    groupOrder.forEach((groupName) => {
      const bucket = groups.get(groupName);
      if (!bucket || !bucket.length) return;

      const section = document.createElement("section");
      section.className = "deck-group";
      section.innerHTML = `<h3>${groupName}</h3>`;

      const list = document.createElement("div");
      list.className = "deck-group-list";

      bucket.sort((a, b) => a.card.cardname.localeCompare(b.card.cardname));
      bucket.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "deck-row";
        row.innerHTML = `
          <div>
            <strong>${entry.card.cardname}</strong>
            <div class="deck-meta">${entry.count}× · ${getRarity(entry.card)}</div>
          </div>
          <div class="deck-controls">
            <button data-key="${entry.key}" data-delta="-1" type="button">−</button>
            <button data-key="${entry.key}" data-delta="1" type="button">+</button>
            <button data-key="${entry.key}" data-action="remove" type="button">Remove</button>
          </div>
        `;
        row.querySelectorAll("button").forEach((button) => {
          button.addEventListener("click", () => {
            const action = button.getAttribute("data-action");
            const delta = Number.parseInt(button.getAttribute("data-delta") || "0", 10);
            if (action === "remove") {
              removeCard(entry.key);
            } else {
              adjustCardCount(entry.key, delta);
            }
          });
        });
        list.appendChild(row);
      });

      section.appendChild(list);
      elements.deckList.appendChild(section);
    });
  }

  function renderDeckText() {
    elements.deckInput.value = state.entries
      .map((entry) => `${entry.count} x ${entry.card.cardname}`)
      .join("\n");

    elements.exportSet.value = state.entries
      .map((entry) => `${entry.count} x ${entry.card.id || entry.key}`)
      .join("\n");

    elements.exportNames.value = state.entries
      .map((entry) => `${entry.count} x ${entry.card.cardname}`)
      .join("\n");
  }

  function renderSavedDecks() {
    const options = Object.keys(state.savedDecks).sort((a, b) => a.localeCompare(b));
    const currentValue = elements.savedDecks.value;
    elements.savedDecks.innerHTML = '<option value="">Load saved deck</option>';
    options.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      elements.savedDecks.appendChild(option);
    });
    elements.savedDecks.value = currentValue || "";
  }

  function render() {
    renderCatalog();
    renderIssues();
    renderSummary();
    renderDeckList();
    renderDeckText();
    elements.deckNameInput.value = state.deckName;
  }

  function newDeck() {
    state.entries = [];
    state.deckName = "Untitled Deck";
    elements.importStatus.textContent = "Started a new deck.";
    render();
  }

  function importDeck() {
    const raw = elements.importText.value.trim();
    if (!raw) {
      elements.importStatus.textContent = "Paste card lines to import a deck.";
      return;
    }

    const nextEntries = [];
    const issues = [];
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const match = trimmed.match(/^(\d+)\s*x\s+(.+)$/i);
      if (!match) {
        issues.push(`Could not read: ${trimmed}`);
        return;
      }
      const count = Number.parseInt(match[1], 10);
      const cardName = match[2].trim();
      const card = state.cards.find((candidate) => candidate.cardname.toLowerCase() === cardName.toLowerCase());
      if (!card) {
        issues.push(`No card found for ${cardName}`);
        return;
      }
      nextEntries.push({ key: getCardKey(card), card, count });
    });

    if (issues.length) {
      elements.importStatus.innerHTML = `<strong>Import issues:</strong><br>${issues.join("<br>")}`;
      return;
    }

    state.entries = nextEntries;
    render();
    elements.importPanel.classList.add("hidden");
    elements.importStatus.textContent = "Deck imported.";
  }

  async function copyNameExport() {
    try {
      await navigator.clipboard.writeText(elements.exportNames.value || "");
      elements.importStatus.textContent = "Copied card list to the clipboard.";
    } catch (error) {
      elements.importStatus.textContent = "Clipboard access failed; you can copy the export manually.";
    }
  }

  init();
})();
