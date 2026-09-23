#!/usr/bin/env python3
r"""
Split combined recipe markdown files into individual recipe files.

Usage:
  python scripts\split_recipes.py [--input-dir INPUT_DIR] [--pattern PATTERN] [--out-dir OUT_DIR] [--dry-run]

Default INPUT_DIR is the repository root (current working directory when run).
Default PATTERN is "recipe-sec-*.md".
Default OUT_DIR is "recipes" under the input dir.

Behavior:
  - Detects recipe titles (lines starting with '#') and section headers for
    Author, Ingredients, Procedure, and Notes (case-insensitive, with or
    without trailing colons, and header levels #..######).
  - If a recipe is missing one or more required sections, asks the user whether
    to create the recipe file anyway (with missing sections left empty) or to
    skip creating that recipe file.
  - Writes each recipe to its own markdown file named from the recipe title
    (sanitized). Ensures files are not clobbered by appending a numeric suffix
    if needed.

This script is interactive when incomplete recipes are encountered.
"""

from __future__ import annotations
import argparse
import hashlib
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

TITLE_RE = re.compile(r"^\s{0,3}#\s+(?!Author\b|Ingredients\b|Procedure\b|Notes\b|Makes\b)(.+\S)\s*$")
SECTION_RE = re.compile(r"^\s{0,3}(#{1,6})\s*(Author|Ingredients|Procedure|Notes|Makes)\b\s*:?(.*)$", re.IGNORECASE)
SEPARATOR_RE = re.compile(r"^\s*[-]{3,}\s*$")

REQUIRED_SECTIONS = ["title", "author", "ingredients", "procedure", "notes"]


def sanitize_filename(name: str) -> str:
    # Replace fancy quotes, normalize whitespace, keep alphanumerics and dashes/underscores
    name = name.strip()
    name = name.replace('\u201c', '"').replace('\u201d', '"').replace('\u2018', "'").replace('\u2019', "'")
    name = re.sub(r"[^A-Za-z0-9 _-]", "", name)
    name = re.sub(r"[ \t]+", "_", name)
    name = name.strip('_')
    if not name:
        name = "untitled"
    if len(name) > 100:
        digest = hashlib.sha1(name.encode('utf-8')).hexdigest()[:8]
        name = f"{name[:90].rstrip('_')}_{digest}"
    return name


def find_input_files(input_dir: Path, pattern: str) -> List[Path]:
    return sorted(input_dir.glob(pattern))


def is_recipe_title(line: str) -> bool:
    """Return True when the line starts a new recipe title and is not a section header."""
    if not line.strip():
        return False
    if SECTION_RE.match(line):
        return False
    return bool(TITLE_RE.match(line))


def parse_recipes_from_lines(lines: List[str]) -> List[Dict[str, Optional[str]]]:
    recipes: List[Dict[str, Optional[str]]] = []
    i = 0
    n = len(lines)

    current: Optional[Dict[str, Optional[str]]] = None

    def finish_current() -> None:
        nonlocal current
        if current is not None:
            # normalize blank content while preserving explicit section presence
            for key in ["author", "ingredients", "procedure", "notes"]:
                value = current.get(key)
                if value is None:
                    continue
                value = value.rstrip('\n').strip('\n')
                current[key] = value if value.strip() else ""
            recipes.append(current)
            current = None

    while i < n:
        line = lines[i].rstrip('\n')

        if SEPARATOR_RE.match(line):
            finish_current()
            i += 1
            continue

        if is_recipe_title(line):
            finish_current()
            title_text = TITLE_RE.match(line).group(1).strip()
            current = {
                "title": title_text,
                "author": None,
                "ingredients": None,
                "procedure": None,
                "notes": None,
                "_seen_sections": set(),
            }
            i += 1
            continue

        m_sec = SECTION_RE.match(line)
        if m_sec and current is not None:
            sec_name = m_sec.group(2).strip().lower()
            key = {
                "author": "author",
                "ingredients": "ingredients",
                "procedure": "procedure",
                "notes": "notes",
                "makes": "notes",
            }.get(sec_name)
            if key is None:
                i += 1
                continue

            current["_seen_sections"].add(key)
            collected_lines: List[str] = []
            inline_rest = m_sec.group(3).strip()
            if inline_rest:
                collected_lines.append(inline_rest)

            j = i + 1
            while j < n:
                nxt = lines[j].rstrip('\n')
                if is_recipe_title(nxt) or SECTION_RE.match(nxt):
                    break
                collected_lines.append(nxt)
                j += 1

            content = '\n'.join(collected_lines).strip()
            current[key] = content
            i = j
            continue

        i += 1

    finish_current()
    return recipes


def write_recipe_file(out_dir: Path, recipe: Dict[str, Optional[str]]) -> Path:
    title = recipe.get('title') or 'untitled'
    base = sanitize_filename(title)
    filename = base + '.md'
    dest = out_dir / filename
    # ensure uniqueness
    count = 1
    while dest.exists():
        dest = out_dir / f"{base}_{count}.md"
        count += 1
    # build markdown content while keeping content immediately under its section header
    blocks = [f"# {title}"]
    author = recipe.get('author') or ''
    blocks.append('## Author\n' + author)
    ingredients = recipe.get('ingredients') or ''
    blocks.append('## Ingredients\n' + ingredients)
    procedure = recipe.get('procedure') or ''
    blocks.append('## Procedure\n' + procedure)
    notes = recipe.get('notes') or ''
    blocks.append('## Notes\n' + notes)

    dest.write_text('\n\n'.join(blocks).rstrip() + '\n', encoding='utf-8')
    return dest


def recipe_missing_sections(recipe: Dict[str, Optional[str]]) -> List[str]:
    seen = set(recipe.get('_seen_sections', set()))
    missing = []
    for section in ['author', 'ingredients', 'procedure', 'notes']:
        if section not in seen:
            missing.append(section)
    return missing


def interactive_decision_create_or_skip(recipe: Dict[str, Optional[str]]) -> bool:
    # Ask user whether to create the recipe file anyway or skip it. Return True to create.
    title = recipe.get('title') or 'untitled'
    missing = recipe_missing_sections(recipe)
    print('\n---')
    print(f"Recipe: {title}")
    if missing:
        print("Missing sections:", ', '.join(missing))
    else:
        print("All sections present.")
    # show a short preview
    print('\nPreview:')
    for k in ['author', 'ingredients', 'procedure', 'notes']:
        val = recipe.get(k)
        preview = (val.strip().splitlines()[0] if val and val.strip() else '<empty>')
        print(f"  {k}: {preview}")
    while True:
        resp = input('\nCreate this recipe file anyway? [Y]es / [S]kip (default Yes): ').strip().lower()
        if resp == '' or resp.startswith('y'):
            return True
        if resp.startswith('s'):
            return False
        print('Please enter Y (create) or S (skip).')


def process_files(input_paths: List[Path], out_dir: Path, dry_run: bool = False, interactive: bool = False) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    total = 0
    created = 0
    skipped = 0

    for p in input_paths:
        print(f"Processing {p}")
        lines = p.read_text(encoding='utf-8').splitlines()
        recipes = parse_recipes_from_lines(lines)
        print(f"  Found {len(recipes)} recipe(s) in {p.name}")
        for rec in recipes:
            total += 1
            missing = recipe_missing_sections(rec)
            if missing:
                if interactive and sys.stdin.isatty():
                    create = interactive_decision_create_or_skip(rec)
                else:
                    print(f"  Warning: {rec.get('title')} missing sections: {', '.join(missing)}")
                    create = True
            else:
                create = True
            if create:
                if dry_run:
                    print(f"  (dry-run) Would create: {rec.get('title')}")
                else:
                    dest = write_recipe_file(out_dir, rec)
                    print(f"  Created: {dest}")
                created += 1
            else:
                skipped += 1
    print('\nDone.')
    print(f"Total recipes encountered: {total}")
    print(f"Created: {created}")
    print(f"Skipped: {skipped}")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description='Split recipe markdown files into individual recipe files')
    parser.add_argument('--input-dir', '-i', default='.', help='Input directory (default: current dir)')
    parser.add_argument('--pattern', '-p', default='recipe-sec-*.md', help='Glob pattern for input files (default: recipe-sec-*.md)')
    parser.add_argument('--out-dir', '-o', default='recipes', help='Output directory (default: recipes)')
    parser.add_argument('--dry-run', action='store_true', help='Do not write files, just show what would be done')
    parser.add_argument('--interactive', action='store_true', help='Prompt when a recipe is missing required sections')
    args = parser.parse_args(argv)

    input_dir = Path(args.input_dir).resolve()
    out_dir = (input_dir / args.out_dir) if not os.path.isabs(args.out_dir) else Path(args.out_dir).resolve()

    input_files = find_input_files(input_dir, args.pattern)
    if not input_files:
        print(f"No files found matching pattern '{args.pattern}' in {input_dir}")
        return 1

    process_files(input_files, out_dir, dry_run=args.dry_run, interactive=args.interactive)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
