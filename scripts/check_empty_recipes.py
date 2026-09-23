#!/usr/bin/env python3
"""Find recipe markdown files that are effectively empty.

These include files that are just a title, and files that have the standard recipe
section headers (Author, Ingredients, Procedure, Notes) but no actual content.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

TITLE_RE = re.compile(r"^\s*#\s+.+\S\s*$")
SECTION_RE = re.compile(r"^\s*##\s*(Author|Ingredients|Procedure|Notes)\s*:??\s*$", re.IGNORECASE)
SUBHEADER_RE = re.compile(r"^\s*###\s+")


def is_empty_recipe(path: Path) -> bool:
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()

    title_found = False
    content_found = False
    current_section = None

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue

        if TITLE_RE.match(raw_line):
            if not title_found:
                title_found = True
                current_section = None
            continue

        section_match = SECTION_RE.match(raw_line)
        if section_match:
            current_section = section_match.group(1).lower()
            continue

        if SUBHEADER_RE.match(raw_line):
            if current_section:
                content_found = True
            continue

        if current_section is not None:
            content_found = True
            continue

        if title_found and not raw_line.startswith("#"):
            content_found = True
            continue

    if not title_found:
        return False

    return not content_found


def find_empty_recipes(input_dir: Path) -> list[Path]:
    return sorted(
        path for path in input_dir.rglob("*.md")
        if path.is_file() and is_empty_recipe(path)
    )


def prompt_delete(empty_files: list[Path]) -> bool:
    if not empty_files:
        return False

    print("Empty recipe files found:")
    for path in empty_files:
        print(f"  - {path}")

    while True:
        response = input("Delete these files? [y/N]: ").strip().lower()
        if response in {"y", "yes"}:
            return True
        if response in {"", "n", "no"}:
            return False
        print("Please enter Y/Yes or N/No.")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Find recipe markdown files that are empty or contain only blank sections."
    )
    parser.add_argument(
        "--input-dir",
        "-i",
        default="recipes",
        help="Directory to scan for recipe markdown files (default: recipes)",
    )
    parser.add_argument(
        "--delete",
        action="store_true",
        help="Delete files after finding them; otherwise just report them.",
    )
    args = parser.parse_args(argv)

    input_dir = Path(args.input_dir).resolve()
    if not input_dir.exists():
        print(f"Input directory does not exist: {input_dir}", file=sys.stderr)
        return 1

    empty_files = find_empty_recipes(input_dir)
    if not empty_files:
        print(f"No empty recipe files found under {input_dir}")
        return 0

    if args.delete:
        delete_now = prompt_delete(empty_files)
        if not delete_now:
            print("No files were deleted.")
            return 0

        for path in empty_files:
            path.unlink()
            print(f"Deleted: {path}")
        return 0

    print(f"Empty recipe files found under {input_dir}:")
    for path in empty_files:
        print(path.relative_to(input_dir.parent))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
