import json
from pathlib import Path
from collections import defaultdict

# ---------- Configuration ----------

CARDS_FOLDER = Path("json")
INDEX_FOLDER = Path("index")

INDEX_FOLDER.mkdir(exist_ok=True)

# ---------- Indexes ----------

all_cards = []
name_index = defaultdict(list)
id_index = {}
set_index = defaultdict(list)
rarity_index = defaultdict(list)

# ---------- Read every JSON file ----------

for json_file in sorted(CARDS_FOLDER.glob("*.json")):
    print(f"Reading {json_file.name}")

    with open(json_file, "r", encoding="utf-8") as f:
        cards = json.load(f)

    for card in cards:

        location = {
            "file": json_file.name,
            "id": card.get("id")
        }

        # Small master list
        all_cards.append({
            "id": card.get("id"),
            "name": card.get("cardname"),
            "set": card.get("set name"),
            "rarity": card.get("rarity"),
            "file": json_file.name
        })

        # Name -> cards
        name = card.get("cardname", "").strip()
        if name:
            name_index[name].append(location)

        # ID -> card
        card_id = card.get("id")
        if card_id:
            id_index[card_id] = location

        # Set -> cards
        set_name = card.get("set name", "").strip()
        if set_name:
            set_index[set_name].append(location)

        # Rarity -> cards
        rarity = card.get("rarity", "").strip()
        if rarity:
            rarity_index[rarity].append(location)

# ---------- Save helper ----------

def save(filename, data):
    with open(INDEX_FOLDER / filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

# ---------- Write indexes ----------

save("all.json", all_cards)
save("names.json", dict(name_index))
save("ids.json", id_index)
save("sets.json", dict(set_index))
save("rarities.json", dict(rarity_index))

print(f"\nIndexed {len(all_cards)} cards.")
print(f"Indexes written to '{INDEX_FOLDER}'.")