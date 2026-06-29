import csv
import json

# Input and output files
INPUT_FILE = input("Enter the path to the input TSV file: ")
OUTPUT_FILE = "cards.json"

cards = []

with open(INPUT_FILE, "r", encoding="utf-8-sig", newline="") as tsv_file:
    reader = list(csv.DictReader(tsv_file, delimiter="\t"))

    for row in reader:
        # Remove leading/trailing whitespace from keys and values
        cleaned_row = {
            key.strip(): value.strip()
            for key, value in row.items()
        }

        cleaned_row["id"] = cleaned_row["set name"].lower() + "/" + str(reader.index(row)).zfill(2)

        # Convert Copies to an integer if possible
        if cleaned_row.get("Copies", "").isdigit():
            cleaned_row["Copies"] = int(cleaned_row["Copies"])

        cards.append(cleaned_row)

with open(OUTPUT_FILE, "w", encoding="utf-8") as json_file:
    json.dump(cards, json_file, indent=4, ensure_ascii=False)

print(f"Converted {len(cards)} cards to {OUTPUT_FILE}")