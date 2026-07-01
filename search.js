(function (root) {
    const loadedSets = new Map();

    function getRarity(card) {
        return ((card && card.rarity) || "").trim() || "Common";
    }

    function formatCardText(text) {
        text = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        text = text
            .replace(/&lt;(\/?(?:ul|ol|li))&gt;/gi, "<$1>");

        text = text.replace(
            /\{icons\/([^}]+)\}/g,
            (_, file) => `<img class="inline-icon" src="icons/${file}" alt="">`
        );

        text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
        text = text.replace(/__(.+?)__/g, "<u>$1</u>");
        text = text.replace(/~~(.+?)~~/g, "<del>$1</del>");
        text = text.replaceAll(" / ", "<br>");
        text = text.replaceAll("---", "<hr>");

        return text;
    }

    async function loadSet(setName) {
        const normalizedName = (setName || "").toLowerCase().trim();

        if (!normalizedName) {
            return [];
        }

        if (loadedSets.has(normalizedName)) {
            return loadedSets.get(normalizedName);
        }

        const response = await fetch(`json/${normalizedName}.json`);
        if (!response.ok) {
            throw new Error(`Could not load set ${normalizedName}`);
        }

        const cards = await response.json();
        loadedSets.set(normalizedName, cards);
        return cards;
    }

    function tokenize(query) {
        const regex = /"[^"]*"|'[^']*'|\(|\)|\bAND\b|\bOR\b|\bNOT\b|[^\s()]+/gi;
        const tokens = [];
        let match;

        while ((match = regex.exec(query)) !== null) {
            tokens.push(match[0]);
        }

        return tokens;
    }

    function parse(query) {
        const tokens = tokenize(query || "");
        const terms = [];

        for (const token of tokens) {
            if (token === "(") {
                terms.push({ type: "(" });
                continue;
            }

            if (token === ")") {
                terms.push({ type: ")" });
                continue;
            }

            if (token.toUpperCase() === "AND") {
                terms.push({ type: "AND" });
                continue;
            }

            if (token.toUpperCase() === "OR") {
                terms.push({ type: "OR" });
                continue;
            }

            if (token.toUpperCase() === "NOT") {
                terms.push({ type: "NOT" });
                continue;
            }

            let negate = false;
            let value = token;

            if (value.startsWith("-")) {
                negate = true;
                value = value.substring(1);
            }

            if (value.includes(":")) {
                const split = value.split(/:(.+)/);
                let fieldValue = split[1];
                let exact = false;

                if (fieldValue.startsWith("'") && fieldValue.endsWith("'")) {
                    exact = true;
                    fieldValue = fieldValue.slice(1, -1);
                }

                if (fieldValue.startsWith('"') && fieldValue.endsWith('"')) {
                    fieldValue = fieldValue.slice(1, -1);
                }

                terms.push({
                    type: "FIELD",
                    field: split[0].toLowerCase(),
                    value: fieldValue,
                    exact,
                    negate
                });
            } else {
                let exact = false;

                if (value.startsWith("'") && value.endsWith("'")) {
                    exact = true;
                    value = value.slice(1, -1);
                }

                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }

                terms.push({
                    type: "TEXT",
                    value,
                    exact,
                    negate
                });
            }
        }

        const output = [];

        for (let i = 0; i < terms.length; i++) {
            output.push(terms[i]);

            const current = terms[i];
            const next = terms[i + 1];

            if (!next) continue;

            const left = current.type === "TEXT" || current.type === "FIELD" || current.type === ")";
            const right = next.type === "TEXT" || next.type === "FIELD" || next.type === "(" || next.type === "NOT";

            if (left && right) {
                output.push({ type: "AND" });
            }
        }

        return output;
    }

    function contains(text, value) {
        return (text || "").toLowerCase().includes(value.toLowerCase());
    }

    function equals(text, value) {
        return (text || "").toLowerCase() === value.toLowerCase();
    }

    function evaluate(card, terms) {
        let index = 0;

        function evaluateTerm(term) {
            let result = false;

            if (term.type === "TEXT") {
                result =
                    contains(card.cardname, term.value) ||
                    contains(card.cardtext, term.value) ||
                    contains(card.cardtype, term.value) ||
                    contains(card["set name"], term.value);
            } else if (term.type === "FIELD") {
                switch (term.field) {
                    case "name":
                        result = term.exact ? equals(card.cardname, term.value) : contains(card.cardname, term.value);
                        break;
                    case "text":
                        result = term.exact ? equals(card.cardtext, term.value) : contains(card.cardtext, term.value);
                        break;
                    case "type":
                    case "t":
                        result = term.exact ? equals(card.cardtype, term.value) : contains(card.cardtype, term.value);
                        break;
                    case "set":
                    case "s":
                        result = term.exact ? equals(card["set name"], term.value) : contains(card["set name"], term.value);
                        break;
                    case "rarity":
                    case "r":
                        result = term.exact ? equals(card.rarity, term.value) : contains(card.rarity, term.value);
                        break;
                    case "id":
                        result = term.exact ? equals(card.id, term.value) : contains(card.id, term.value);
                        break;
                }
            }

            if (term.negate) {
                result = !result;
            }

            return result;
        }

        function parsePrimary() {
            const term = terms[index++];
            if (!term) return true;
            if (term.type === "(") {
                const value = parseOr();
                index++;
                return value;
            }
            if (term.type === "NOT") {
                return !parsePrimary();
            }
            return evaluateTerm(term);
        }

        function parseAnd() {
            let value = parsePrimary();
            while (terms[index]?.type === "AND") {
                index++;
                value = value && parsePrimary();
            }
            return value;
        }

        function parseOr() {
            let value = parseAnd();
            while (terms[index]?.type === "OR") {
                index++;
                value = value || parseAnd();
            }
            return value;
        }

        return parseOr();
    }

    function searchCards(query, cards) {
        const parsed = parse(query || "");
        return (cards || []).filter((card) => evaluate(card, parsed));
    }

    async function searchCardsFromSets(query, setNames = ["bs26"]) {
        const cards = [];
        for (const setName of setNames) {
            cards.push(...(await loadSet(setName)));
        }
        return searchCards(query, cards);
    }

    function render(cards) {
        const resultsDiv = document.getElementById("results");
        if (!resultsDiv) return;

        resultsDiv.innerHTML = "";

        for (const card of cards) {
            const filename = card.id;
            const img = `card-images/${filename}.png`;

            resultsDiv.innerHTML += `
<div class="card">
<img src="${img}" loading="lazy">
<h2>${card.cardname}</h2>
<div class="meta">
${card.id}<br>
${card.cardtype}<br>
${getRarity(card)}
</div>
<div class="rules">
${formatCardText(card.cardtext)}
</div>
</div>
`;
        }
    }

    async function performSearch() {
        const input = document.getElementById("search");
        if (!input) return;

        const query = input.value.trim();
        const parsed = parse(query);

        let sets = [];
        const setTerms = parsed.filter((term) => term.type === "FIELD" && (term.field === "set" || term.field === "s"));

        if (setTerms.length) {
            sets = [...new Set(setTerms.map((term) => term.value.toLowerCase()))];
        } else {
            sets = ["bs26"];
        }

        const cards = [];
        for (const setName of sets) {
            cards.push(...(await loadSet(setName)));
        }

        render(cards.filter((card) => evaluate(card, parsed)));
    }

    const searchInput = document.getElementById("search");
    const goButton = document.getElementById("go");

    function readSearchFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get("q") || params.get("search") || "";
    }

    function initializeSearch() {
        if (!searchInput) return;

        searchInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                performSearch();
            }
        });

        const initialQuery = readSearchFromUrl();
        if (initialQuery) {
            searchInput.value = initialQuery;
        }

        performSearch();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeSearch);
    } else {
        initializeSearch();
    }

    if (goButton) {
        goButton.onclick = performSearch;
    }

    root.SuperBenjiSearch = {
        getRarity,
        formatCardText,
        loadSet,
        tokenize,
        parse,
        contains,
        equals,
        evaluate,
        searchCards,
        searchCardsFromSets,
        render,
        performSearch
    };
})(window);