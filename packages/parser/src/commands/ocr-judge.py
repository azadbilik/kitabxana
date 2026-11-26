"""Settle what `parse ocr-merge` marked, with a local vision model looking at the page (mlx-vlm).

usage: ocr-judge.py <model> <merged.md> <images dir> <out.md>

For each page with marks, the model sees the page image and a numbered list of questions:
  ⟦a|b⟧   which of two readings of the line is printed (A or B)
  ⟦a|–⟧   whether a word only the first reading has is printed
  ⟦+text⟧ whether a passage only the second reading has is printed
Choosing between two given readings is far easier for it than reading the page cold. Answers
replace the marks; a question it doesn't answer clearly stays marked. A passage it confirms stays
as ⟦+text⟧ for laying out by hand (it comes from the flattened second reading); one it rejects goes.
"""
import os
import re
import subprocess
import sys
import time
import unicodedata

from PIL import Image
from mlx_vlm import generate, load
from mlx_vlm.prompt_utils import apply_chat_template
from mlx_vlm.utils import load_config

model_id, merged, images_dir, out = sys.argv[1:5]
MARK = re.compile(r"⟦([^⟧]*)⟧")


def options(inner: str):
    """('pick', a, b) | ('only', a) | ('plus', text)"""
    if inner.startswith("+"):
        return ("plus", inner[1:])
    a, _, b = inner.partition("|")
    return ("only", a) if b == "–" else ("pick", a, b)


def first(inner: str) -> str:
    o = options(inner)
    return "" if o[0] == "plus" else o[1]


def with_choice(line: str, at: int, choice: str) -> str:
    """The line with mark number `at` read as `choice` and every other mark as its first reading"""
    n = -1

    def sub(m):
        nonlocal n
        n += 1
        return choice if n == at else first(m.group(1))

    return re.sub(r"\s{2,}", " ", MARK.sub(sub, line)).strip()


TESSDATA = os.path.join(os.path.dirname(__file__), "../../data/raw/tessdata")


def norm(w: str) -> str:
    return "".join(c for c in w.lower() if unicodedata.category(c)[0] in "LN")


def tess_lines(path: str):
    """Lines Tesseract finds on the page: (words normalised, box)"""
    tsv = subprocess.run(
        ["tesseract", path, "-", "-l", "aze", "--psm", "6", "--tessdata-dir", TESSDATA, "-c", "tessedit_create_tsv=1"],
        capture_output=True, text=True,
    ).stdout
    lines = {}
    for row in tsv.strip().split("\n")[1:]:
        r = row.split("\t")
        if len(r) < 12 or r[0] != "5" or not r[11].strip():
            continue
        key = (r[2], r[3], r[4])
        x, y, w, h = map(int, r[6:10])
        words, box = lines.get(key, ([], [x, y, x + w, y + h]))
        words.append(norm(r[11]))
        box = [min(box[0], x), min(box[1], y), max(box[2], x + w), max(box[3], y + h)]
        lines[key] = (words, box)
    return list(lines.values())


def line_crop(path: str, lines, gap_line: str, tmp: str) -> str | None:
    """The printed line the question is about, cut from the full-resolution scan"""
    want = [norm(w) for w in gap_line.replace("___", " ").split() if norm(w)]
    best, score = None, 0
    for words, box in lines:
        common = sum(1 for w in want if w in words)
        if common > score:
            best, score = box, common
    if not best or score < max(1, min(2, len(want))):
        return None
    im = Image.open(path).convert("RGB")
    h = best[3] - best[1]
    crop = im.crop((max(0, best[0] - 2 * h), max(0, best[1] - h), min(im.width, best[2] + 2 * h), min(im.height, best[3] + h)))
    crop.save(tmp, quality=95)
    return tmp


def page_file(key: str) -> str | None:
    for name in (f"p{key}.jpg", f"p{key}.png", f"{key}.jpg"):
        p = os.path.join(images_dir, name)
        if os.path.exists(p):
            return p
    return None


def page_image(key: str) -> str | None:
    for name in (f"p{key}.jpg", f"p{key}.png", f"{key}.jpg"):
        p = os.path.join(images_dir, name)
        if os.path.exists(p):
            im = Image.open(p).convert("RGB")
            if im.height > 1500:
                im = im.resize((round(im.width * 1500 / im.height), 1500), Image.Resampling.LANCZOS)
            tmp = out + ".page.jpg"
            im.save(tmp, quality=90)
            return tmp
    return None


text = open(merged, encoding="utf-8").read()
blocks = re.split(r"(?m)^(@@ \S+)$", text)
model, processor = load(model_id)
config = load_config(model_id)
settled = kept = left = 0
result = [blocks[0]]
pages = [(blocks[i], blocks[i + 1]) for i in range(1, len(blocks), 2)]
todo = sum(1 for _, body in pages if MARK.search(body))
done = 0
for head, body in pages:
    lines = body.split("\n")
    questions = []  # (line index, mark index, options, the line with a gap, the two choices)
    for li, line in enumerate(lines):
        for mi, m in enumerate(MARK.finditer(line)):
            o = options(m.group(1))
            gap = with_choice(line, mi, "___")
            if o[0] == "pick":
                pair = (o[1], o[2])
            elif o[0] == "only":
                pair = (o[1], "(nothing: the gap is empty)")
            else:
                pair = ("yes", "no")
            questions.append((li, mi, o, gap, pair))
    image = page_image(head[3:]) if questions else None
    if not questions or not image:
        left += len(questions)
        result += [head, body]
        continue
    done += 1
    t0 = time.time()
    scan = page_file(head[3:])
    found = tess_lines(scan) if scan else []

    def ask_one(n: int, swapped: bool) -> int | None:
        """One question on its line cut from the scan: the index into its pair, or None"""
        _, _, o, gap, pair = questions[n]
        crop = line_crop(scan, found, gap, out + ".line.jpg") if scan and o[0] != "plus" else None
        if not crop:
            return None
        a, b = (pair[1], pair[0]) if swapped else pair
        prompt_text = (
            "This image is one printed line of an Azerbaijani book in the Latin alphabet, which has the letters "
            "ə (an upside-down e), ı (i without a dot), ğ, ö, ü, ç, ş. Look closely, letter by letter (ə against e "
            f"and a, ı against i, m against n). The line reads «{gap}». What is printed in the gap?\n"
            f"A: «{a}»\nB: «{b}»\nAnswer A or B only."
        )
        prompt = apply_chat_template(processor, config, prompt_text, num_images=1)
        try:
            r = generate(model, processor, prompt, [crop], max_tokens=4, temperature=0.0, verbose=False)
        except Exception as e:  # an outsized crop can overflow MLX's 32-bit shapes: leave the question open
            print(f"    skipped: {str(e)[:120]}", file=sys.stderr)
            return None
        m = re.search(r"\b([AB])\b", getattr(r, "text", r))
        if not m:
            return None
        c = 0 if m.group(1) == "A" else 1
        return 1 - c if swapped else c

    def ask(swapped: bool) -> dict[int, int]:
        """Answers as {question: index into its pair}"""
        qs = []
        for n, (_, _, o, gap, pair) in enumerate(questions):
            a, b = (pair[1], pair[0]) if swapped else pair
            if o[0] == "plus":
                qs.append(f"{n + 1}. Is this passage printed on the page: «{o[1]}»? A: {a}  B: {b}")
            else:
                qs.append(f"{n + 1}. In the line «{gap}», what is printed in the gap? A: «{a}»  B: «{b}»")
        prompt_text = (
            "This is a page of an Azerbaijani book in the Latin alphabet, which has the letters ə (an upside-down e), "
            "ı (i without a dot), ğ, ö, ü, ç, ş. Two OCR programs read some words differently. For each numbered "
            "question, find the line on the page and look closely at the word, letter by letter (ə against e and a, "
            "ı against i, ğ against g, ü against u). Answer one line per question as 'N: A' or 'N: B', nothing else.\n\n"
            + "\n".join(qs)
        )
        prompt = apply_chat_template(processor, config, prompt_text, num_images=1)
        try:
            r = generate(model, processor, prompt, [image], max_tokens=8 * len(questions) + 20, temperature=0.0, verbose=False)
        except Exception as e:  # an outsized page can overflow MLX's 32-bit shapes: leave the page's questions open
            print(f"    skipped page: {str(e)[:120]}", file=sys.stderr)
            return {}
        raw = getattr(r, "text", r)
        got = {int(n): (0 if c == "A" else 1) for n, c in re.findall(r"(?m)^\s*(\d+)\s*[:.)]\s*(?:N\s*:\s*)?([AB])\b", raw)}
        if not got and len(questions) == 1:
            lone = re.fullmatch(r"\s*(?:1\s*[:.)]\s*)?(?:N\s*:\s*)?([AB])\W*", raw)
            if lone:
                got = {1: 0 if lone.group(1) == "A" else 1}
        if not got:
            print(f"    no answers in: {raw[:200]!r}", file=sys.stderr)
        return {n: (1 - c if swapped else c) for n, c in got.items()}

    # A word is judged on its own line, cut from the scan at full resolution; what can't be
    # found there (and every ⟦+passage⟧) is asked on the whole page
    first_pass, second_pass = {}, {}
    on_page = []
    for n in range(len(questions)):
        x = ask_one(n, False)
        if x is None:
            on_page.append(n)
            continue
        first_pass[n + 1] = x
        y = ask_one(n, True)
        if y is not None:
            second_pass[n + 1] = y
    if on_page:
        whole = [questions[n] for n in on_page]
        kept_questions, questions = questions, whole
        p1, p2 = ask(False), ask(True)
        questions = kept_questions
        for k, n in enumerate(on_page, 1):
            if k in p1:
                first_pass[n + 1] = p1[k]
            if k in p2:
                second_pass[n + 1] = p2[k]
    # Only an answer given the same way with the choices in either order counts
    answers = {n: "AB"[c] for n, c in first_pass.items() if second_pass.get(n) == c}
    # Resolve from the last mark of a line to the first, so earlier positions stay valid
    for n, (li, mi, o, _, _) in sorted(enumerate(questions), key=lambda x: (x[1][0], -x[1][1])):
        ans = answers.get(n + 1)
        ms = list(MARK.finditer(lines[li]))
        m = ms[mi]
        if ans is None:
            left += 1
            continue
        if o[0] == "plus":
            if ans == "A":
                kept += 1
                continue
            rep = ""
        elif o[0] == "only":
            rep = o[1] if ans == "A" else ""
        else:
            rep = o[1] if ans == "A" else o[2]
        settled += 1
        lines[li] = re.sub(r" {2,}", " ", lines[li][: m.start()] + rep + lines[li][m.end():])
    result += [head, "\n".join(lines)]
    print(f"  page {done}/{todo} {len(questions)} questions, {len(answers)} answered, {time.time() - t0:.0f}s", file=sys.stderr, flush=True)

# re.split kept each "@@ NNN" with its body after it, so joining rebuilds the file
open(out, "w", encoding="utf-8").write("".join(result))
print(f"{settled} settled, {kept} passages confirmed (still marked ⟦+…⟧ to lay out), {left} left marked", file=sys.stderr)
