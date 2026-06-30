const loadedSets = new Map();

const resultsDiv = document.getElementById("results");

document.getElementById("go").onclick = performSearch;

document.getElementById("search").addEventListener("keydown", e=>{
    if(e.key==="Enter")
        performSearch();
});

//////////////////////////////////////////////////////////

async function loadSet(setName){

    setName = setName.toLowerCase();

    if(loadedSets.has(setName))
        return loadedSets.get(setName);

    const cards =
        await fetch(`json/${setName}.json`)
        .then(r=>r.json());

    loadedSets.set(setName,cards);

    return cards;

}

//////////////////////////////////////////////////////////

function tokenize(query){

    const regex =
        /[A-Za-z]+:"[^"]*"|"[^"]*"|\(|\)|\bAND\b|\bOR\b|\bNOT\b|[^\s()]+/gi;

    const tokens=[];

    let m;

    while((m=regex.exec(query))!==null){

        tokens.push(
            m[1] ?? m[0]
        );

    }

    return tokens;

}

//////////////////////////////////////////////////////////

function parse(query){

    const tokens = tokenize(query);

    const terms=[];

    for(const token of tokens){

        if (token === "(") {
            terms.push({ type: "(" });
            continue;
        }

        if (token === ")") {
            terms.push({ type: ")" });
            continue;
        }

        if(token.toUpperCase()==="AND"){
            terms.push({
                type:"AND"
            });
            continue;
        }

        if(token.toUpperCase()==="OR"){
            terms.push({
                type:"OR"
            });
            continue;
        }

        if(token.toUpperCase()==="NOT"){
            terms.push({
                type:"NOT"
            });
            continue;
        }

        let negate=false;

        let t=token;

        if(t.startsWith("-")){

            negate=true;

            t=t.substring(1);

        }

        if(t.includes(":")){

            const split = t.split(/:(.+)/);

            terms.push({

                type:"FIELD",

                field:split[0].toLowerCase(),

                value: split[1].replace(/^"|"$/g, ""),

                negate

            });

        }

        else{

            terms.push({

                type:"TEXT",

                value:t,

                negate

            });

        }

    }

    const output = [];

    for (let i = 0; i < terms.length; i++) {

        output.push(terms[i]);

        const a = terms[i];
        const b = terms[i + 1];

        if (!b) continue;

        const left =
            a.type === "TEXT" ||
            a.type === "FIELD" ||
            a.type === ")";

        const right =
            b.type === "TEXT" ||
            b.type === "FIELD" ||
            b.type === "(" ||
            b.type === "NOT";

        if (left && right) {
            output.push({ type: "AND" });
        }
    }

    return output;

}

//////////////////////////////////////////////////////////

function contains(text,value){

    return (text||"")
        .toLowerCase()
        .includes(value.toLowerCase());

}

//////////////////////////////////////////////////////////

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

        }

        else if (term.type === "FIELD") {

            switch (term.field) {

                case "name":
                    result = contains(card.cardname, term.value);
                    break;

                case "text":
                    result = contains(card.cardtext, term.value);
                    break;

                case "type":
                case "t":
                    result = contains(card.cardtype, term.value);
                    break;

                case "set":
                case "s":
                    result = contains(card["set name"], term.value);
                    break;

                case "rarity":
                case "r":
                    result = contains(card.rarity, term.value);
                    break;

                case "id":
                    result = contains(card.id, term.value);
                    break;
            }

        }

        if (term.negate)
            result = !result;

        return result;
    }

    function parsePrimary() {

        const term = terms[index++];

        if (!term)
            return true;

        if (term.type === "(") {

            const value = parseOr();

            index++; // skip ')'

            return value;

        }

        if (term.type === "NOT")
            return !parsePrimary();

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

//////////////////////////////////////////////////////////

function render(cards){

    resultsDiv.innerHTML="";

    for(const card of cards){

        const index =
            Number(card["card number"])-1;

        const filename =
            card["id"]

        const img =
            `card-images/${filename}.png`;

        resultsDiv.innerHTML+=`

<div class="card">

<img src="${img}" loading="lazy">

<h2>${card.cardname}</h2>

<div class="meta">

${card.id}<br>

${card.cardtype}<br>

${card.rarity}

</div>

<div class="rules">

${card.cardtext}

</div>

</div>

`;

    }

}

//////////////////////////////////////////////////////////

async function performSearch(){

    const query =
        document.getElementById("search").value.trim();

    const parsed =
        parse(query);

    console.log(parsed);

    // Determine which sets need loading.
    // Eventually you'll use your indexes here.
    // For now, if no set is specified,
    // it loads every set listed below.

    let sets=[];

    const setTerms = parsed.filter(
        t =>
            t.type === "FIELD" &&
            (t.field === "set" || t.field === "s")
    );

    if (setTerms.length) {

        sets = [
            ...new Set(
                setTerms.map(t => t.value.toLowerCase())
            )
        ];

    }

    else{

        // Add your sets here.
        sets=[
            "bs26"
        ];

    }

    let cards=[];

    for(const s of sets){

        cards.push(
            ...(await loadSet(s))
        );

    }

    cards =
        cards.filter(c=>
            evaluate(c,parsed)
        );

    render(cards);

}