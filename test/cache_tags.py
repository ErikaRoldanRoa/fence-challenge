"""Cache tags: a file that changed since the live site carries a new ?v= tag in every page that loads it.

Every lab asset URL ends in ?v=<tag> so that a browser never mixes yesterday's script with today's (the hexomino lab
crashed on the 6th of October when it did). The tag of an asset must therefore change whenever the asset does: this
compares the working tree with the live branch and names each changed asset whose page still says the live tag.

Usage: python3 test/cache_tags.py [base-ref]      (default origin/main; fetch it first)
Exit 0 when every changed asset has a new tag, 1 otherwise."""
import os
import re
import subprocess
import sys

ROOT = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()
BASE = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
URL = re.compile(r'(?:src|href)="([^"#]+?)\?v=([^"&]+)"')
SKIP = ("archive/", "node_modules/", "vendor/")


def live(path):
    """The file as the live branch has it, or None when it is new."""
    try:
        return subprocess.check_output(["git", "show", f"{BASE}:{path}"], cwd=ROOT, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        return None


def main():
    if subprocess.run(["git", "rev-parse", "--verify", "-q", BASE], cwd=ROOT, capture_output=True).returncode:
        print(f"cache tags: no {BASE} to compare with (git fetch origin first)")
        return 1
    pages = subprocess.check_output(["git", "ls-files", "-co", "--exclude-standard", "*.html"], cwd=ROOT, text=True).split()
    bad, seen = [], 0
    for page in pages:
        if page.startswith(SKIP):
            continue
        html = open(os.path.join(ROOT, page), encoding="utf-8").read()
        before = live(page)
        old_tags = {}
        if before is not None:
            for m in URL.finditer(before.decode("utf-8", "replace")):
                old_tags[os.path.normpath(os.path.join(os.path.dirname(page), m.group(1)))] = m.group(2)
        for m in URL.finditer(html):
            url, tag = m.group(1), m.group(2)
            if re.match(r"[a-z]+:", url) or url.startswith("//"):
                continue
            asset = os.path.normpath(os.path.join(os.path.dirname(page), url))
            full = os.path.join(ROOT, asset)
            if not os.path.isfile(full):
                bad.append(f"{page}: {url} does not exist")
                continue
            seen += 1
            was = live(asset)
            if was is None or was == open(full, "rb").read():
                continue                                   # new (its URL is new too), or unchanged
            if old_tags.get(asset) == tag:
                bad.append(f"{page}: {url}?v={tag} changed since {BASE} and keeps its tag")
    for b in sorted(set(bad)):
        print("FAIL", b)
    print(f"cache tags: {seen} asset URLs checked, {len(set(bad))} problems")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
