#!/usr/bin/env python3
"""Check the site results against the source PDF and its count tables."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess


def verify(pdf: Path) -> None:
    site = Path(__file__).resolve().parents[1]
    data = json.loads((site / "src/content/data/results.json").read_text())
    assert hashlib.sha256(pdf.read_bytes()).hexdigest() == data["source"]["sha256"], "The source PDF hash changed."
    text = subprocess.check_output(["pdftotext", "-layout", str(pdf), "-"], text=True)
    main = text.split("Table 2:", 1)[1].split("3.4.2", 1)[0]
    keys = ["passAt1", "pass3", "light", "standard", "hard", "steps", "cost"]
    expected = {}
    family = "closed"
    for line in main.splitlines():
        if "Open-weight models" in line:
            family = "open"
        match = re.fullmatch(r"\s*(.+?)\s+\([\d; ]+\)\s+(Max|High)\s+((?:\d+\.\d+\s*){7})", line)
        if match:
            name = match[1].replace("–", " ")
            expected[name] = {"family": family, "reasoning": match[2], **dict(zip(keys, map(float, match[3].split())))}
    assert len(expected) == 14, "The PDF must contain 14 main result rows."
    rows = data["models"]
    assert len(rows) == len(expected) == len({row["id"] for row in rows})
    assert {row["model"] for row in rows} == set(expected)
    assert data["worlds"] == 47 and data["seeds"] == 3
    assert data["difficulty"] == {"light": 9, "standard": 15, "hard": 23}
    supplementary = text.split("Table 12:", 1)[1].split("Table 13:", 1)[0]
    seed_table = text.split("Table 14:", 1)[1].split("Table 15:", 1)[0]
    consistency_table = text.split("Table 15:", 1)[1].split("Table 16:", 1)[0]
    aliases = {
        "Claude Opus 5": "Opus 5", "Claude Haiku 4.5": "Haiku 4.5",
        "Meta MuseSpark 1.2": "Muse Spark 1.2", "GLM-5.2": "GLM 5.2",
    }
    for row in rows:
        name = row["model"]
        for key, value in expected[name].items():
            assert row[key] == value, f"Table 2 mismatch: {name}, {key}."
        label = re.escape(aliases.get(name, name))
        extra = re.search(r"^\s*" + label + r"\s+(\d+)/141 \(([\d.]+)%\)\s+(\d+)/47 \(([\d.]+)%\)", supplementary, re.M)
        assert extra, f"No supplementary row for {name}."
        assert [row["outcomeRuns"], row["outcomeCompletion"], row["anySeedWorlds"], row["anySeed"]] == [int(extra[1]), float(extra[2]), int(extra[3]), float(extra[4])]
        seeds = re.findall(r"^\s*" + label + r"\s+([123])\s+(\d+)/47 ", seed_table, re.M)
        assert row["seeds"] == [int(count) for _, count in seeds]
        assert len(row["seeds"]) == 3
        consistency = re.search(r"^\s*" + label + r"\s+((?:\d+\s+){7}\d+)\s*$", consistency_table, re.M)
        assert consistency, f"No consistency row for {name}."
        assert row["consistency"] == list(map(int, consistency[1].split()))[:4]
        never, once, twice, always = row["consistency"]
        assert sum(row["consistency"]) == 47
        assert once + 2 * twice + 3 * always == sum(row["seeds"])
        assert round(sum(row["seeds"]) / 141 * 100, 1) == row["passAt1"]
        assert round(always / 47 * 100, 1) == row["pass3"]
        assert row["anySeedWorlds"] == 47 - never
        assert round(row["anySeedWorlds"] / 47 * 100, 1) == row["anySeed"]
        assert round(row["outcomeRuns"] / 141 * 100, 1) == row["outcomeCompletion"]
    assert sum(sum(row["seeds"]) for row in rows) == 667
    assert sum(row["outcomeRuns"] for row in rows) == 921
    print("Verified 14 models, 98 main metrics, all supplementary values, and all three seed counts.")
    print("Pass³ matches each model's all-seed intersection. Pooled totals match the paper.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    verify(parser.parse_args().pdf)
