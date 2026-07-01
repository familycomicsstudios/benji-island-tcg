import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RULES_PATH = ROOT / "RULES.md"
OUTPUT_PATH = ROOT / "rules.html"


def strip_frontmatter(markdown: str) -> str:
    lines = markdown.splitlines()
    if not lines or lines[0].strip() != "---":
        return markdown

    result = []
    in_frontmatter = True
    for line in lines[1:]:
        if in_frontmatter and line.strip() == "---":
            in_frontmatter = False
            continue
        if not in_frontmatter:
            result.append(line)
    return "\n".join(result).strip() + "\n"


def markdown_to_html(markdown: str) -> str:
    cleaned = strip_frontmatter(markdown)
    lines = cleaned.splitlines()
    html_parts = []
    in_list = False
    in_code = False

    def flush_list():
        nonlocal in_list
        if in_list:
            html_parts.append("</ul>")
            in_list = False

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("```"):
            flush_list()
            if in_code:
                html_parts.append("</code></pre>")
                in_code = False
            else:
                html_parts.append("<pre><code>")
                in_code = True
            continue

        if in_code:
            html_parts.append(escape_html(stripped))
            continue

        if re.match(r"^#{1,6}\s+", line):
            flush_list()
            level = len(line) - len(line.lstrip("#"))
            text = line[level:].strip()
            html_parts.append(f"<h{level}>{format_inline(text)}</h{level}>")
            continue

        if re.match(r"^\d+\.\s+", line):
            flush_list()
            html_parts.append(f"<p>{format_inline(stripped)}</p>")
            continue

        if re.match(r"^[-*]\s+", line):
            if not in_list:
                html_parts.append("<ul>")
                in_list = True
            item = stripped[2:].strip()
            html_parts.append(f"<li>{format_inline(item)}</li>")
            continue

        flush_list()
        if not stripped:
            continue

        if stripped in {"---", "***"}:
            html_parts.append("<hr />")
            continue

        html_parts.append(f"<p>{format_inline(stripped)}</p>")

    flush_list()
    return "\n".join(html_parts)


def escape_html(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def format_inline(text: str) -> str:
    safe_text = escape_html(text)
    safe_text = re.sub(r"`([^`]+)`", r"<code>\1</code>", safe_text)
    safe_text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", safe_text)
    safe_text = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", safe_text)
    safe_text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', safe_text)
    return safe_text


if __name__ == "__main__":
    markdown = RULES_PATH.read_text(encoding="utf-8")
    body = markdown_to_html(markdown)
    html = f"""<!DOCTYPE html>
<html lang=\"en\">
  <head>
    <meta charset=\"UTF-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
    <title>Super Benji TCG Rules</title>
    <link rel=\"stylesheet\" href=\"style.css\" />
  </head>
  <body>
    <header class=\"page-header\">
      <h1>Super Benji TCG Rules</h1>
      <p class=\"description\">The latest rules reference generated from RULES.md.</p>
      <nav class=\"nav-links\">
        <a href=\"index.html\">Card Database</a>
        <a href=\"deckbuilder.html\">Deck Builder</a>
      </nav>
    </header>
    <main class=\"rules-page\">{body}</main>
  </body>
</html>
"""
    OUTPUT_PATH.write_text(html, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")
