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
        /"([^"]*)"|\(|\)|\bAND\b|\bOR\b|\bNOT\b|[^\s()]+/gi;

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

        if(token==="("||token===")")
            continue;

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

            const split=t.split(":");

            terms.push({

                type:"FIELD",

                field:split[0].toLowerCase(),

                value:split.slice(1).join(":"),

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

    return terms;

}

//////////////////////////////////////////////////////////

function contains(text,value){

    return (text||"")
        .toLowerCase()
        .includes(value.toLowerCase());

}

//////////////////////////////////////////////////////////

function evaluate(card, terms) {

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

    function parseExpression(index = 0) {

        let result = null;
        let op = "AND";
        let negate = false;

        while (index < terms.length) {

            const term = terms[index];

            if (term.type === "(") {
                const sub = parseExpression(index + 1);
                let value = sub.result;
                index = sub.index;

                if (negate) {
                    value = !value;
                    negate = false;
                }

                if (result === null)
                    result = value;
                else if (op === "AND")
                    result = result && value;
                else
                    result = result || value;

                continue;
            }

            if (term.type === ")") {
                return {
                    result: result ?? true,
                    index: index + 1
                };
            }

            if (term.type === "AND") {
                op = "AND";
                index++;
                continue;
            }

            if (term.type === "OR") {
                op = "OR";
                index++;
                continue;
            }

            if (term.type === "NOT") {
                negate = true;
                index++;
                continue;
            }

            let value = evaluateTerm(term);

            if (negate) {
                value = !value;
                negate = false;
            }

            if (result === null)
                result = value;
            else if (op === "AND")
                result = result && value;
            else
                result = result || value;

            index++;
        }

        return {
            result: result ?? true,
            index
        };
    }

    return parseExpression().result;
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

    const setSearch =
        parsed.find(t=>
            t.field==="set"||
            t.field==="s"
        );

    if(setSearch){

        sets.push(
            setSearch.value.toLowerCase()
        );

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