#!/usr/bin/env python3
"""
Picker Photo — Krok 0.5 (v2): CLIP + Aesthetic Scoring

Szybki lokalny scorer bez kosztów API:
- CLIP ViT-L/14 do scoringu w stylu fotografa (zero-shot text-image similarity)
- LAION Aesthetic Predictor v2 do ogólnej oceny estetycznej
- MPS (Apple Silicon) — ~5-20ms/zdjęcie

Wymagania:
    pip install -r scripts/requirements.txt

Użycie:
    python scripts/score.py <katalog> [opcje]
    python scripts/score.py <katalog> --from _scan.json -p cartier-bresson

Opcje:
    --from <plik>           Kandydaci z _scan.json lub _preselect.json
    -p, --photographer <id> Styl oceny (CLIP text prompts)
    --top-percent <n>       Zachowaj top N% (domyślnie: 20)
    --top <n>               Zachowaj dokładnie N zdjęć
    --min-aesthetic <n>     Minimalny wynik estetyczny 0-10 (domyślnie: 4.5)
    --no-aesthetic          Pomiń LAION aesthetic predictor
    -o, --out <plik>        Wyjście (domyślnie: <katalog>/_score.json)
    -w, --workers <n>       Wątki dataloadera (domyślnie: 4)
    --batch <n>             Rozmiar batcha (domyślnie: 32)
    --model <id>            CLIP model (domyślnie: openai/clip-vit-large-patch14)
    --list-photographers    Pokaż dostępnych fotografów
"""

import sys
import json
import argparse
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

import torch
import numpy as np
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

# ── Styl fotografa → CLIP text prompts ────────────────────────────────────

PHOTOGRAPHER_PROMPTS = {
    "cartier-bresson": (
        "black and white street photography decisive moment geometric composition human emotion",
        "blurry noisy overexposed underexposed empty boring static"
    ),
    "avedon": (
        "dramatic black and white portrait psychological depth intense expression isolated subject",
        "cluttered background poor lighting unfocused dull expression"
    ),
    "meyerowitz": (
        "vivid saturated color street photography golden hour warm light layered depth",
        "dull flat colors poor lighting no people no depth"
    ),
    "arbus": (
        "direct frontal portrait flash photography unusual subject social observation",
        "indirect side view busy background soft light conventional subject"
    ),
    "newton": (
        "bold graphic fashion photography hard shadows power architectural lines dramatic contrast",
        "soft diffuse light no contrast weak composition dull subject"
    ),
    "mccurry": (
        "rich saturated color travel photography direct eye contact emotional expression cultural depth",
        "dull muted color no eye contact distant subject generic scene"
    ),
    "capa": (
        "raw action war reportage unposed authentic moment tension urgency documentary",
        "staged posed static calm uneventful studio setup"
    ),
    "mccullin": (
        "powerful black and white documentary suffering hardship raw emotion deep shadows social struggle",
        "happy bright light clean environment cheerful pleasant scene"
    ),
    "salgado": (
        "epic black and white dramatic directional light monumental composition humanitarian scale",
        "ordinary flat light small scale everyday uneventful"
    ),
    "eggleston": (
        "saturated color mundane everyday American subject ordinary overlooked democratic photography",
        "extraordinary special event posed formal important subject"
    ),
    "parr": (
        "hypersaturated color flash photography consumer culture irony humor British seaside leisure",
        "desaturated natural light serious solemn intellectual quiet scene"
    ),
    "goldin": (
        "intimate personal vulnerable moment warm film tones authentic real life candid friendship love",
        "public formal distant cold staged artificial professional"
    ),
    "leibovitz": (
        "cinematic dramatic portrait theatrical lighting powerful celebrity storytelling editorial",
        "snapshot casual unlit simple ordinary subject everyday moment"
    ),
    "maier": (
        "black and white street photography square format geometry shadows reflections candid observation",
        "color blurry unfocused no geometry posed studio color photography"
    ),
    "_generic": (
        "beautiful well-composed photograph excellent lighting sharp focus interesting subject",
        "blurry out of focus poorly lit boring subject bad composition"
    ),
}

PHOTOGRAPHERS = {
    "cartier-bresson": "Henri Cartier-Bresson",
    "avedon":          "Richard Avedon",
    "meyerowitz":      "Joel Meyerowitz",
    "arbus":           "Diane Arbus",
    "newton":          "Helmut Newton",
    "mccurry":         "Steve McCurry",
    "capa":            "Robert Capa",
    "mccullin":        "Don McCullin",
    "salgado":         "Sebastião Salgado",
    "eggleston":       "William Eggleston",
    "parr":            "Martin Parr",
    "goldin":          "Nan Goldin",
    "leibovitz":       "Annie Leibovitz",
    "maier":           "Vivian Maier",
    "_generic":        "Ogólna jakość",
}

VALID_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif"}

# ── Device ─────────────────────────────────────────────────────────────────

def get_device():
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")

# ── LAION Aesthetic Predictor v2 ───────────────────────────────────────────
# Prosty regressor (MLP 2-layer) na topie embeddingów CLIP ViT-L/14.
# Wagi z: https://github.com/christophschuhmann/improved-aesthetic-predictor

AESTHETIC_WEIGHTS_URL = (
    "https://github.com/christophschuhmann/improved-aesthetic-predictor"
    "/raw/main/sac+logos+ava1-l14-linearMSE.pth"
)

class AestheticPredictor(torch.nn.Module):
    def __init__(self, input_size=768):
        super().__init__()
        self.layers = torch.nn.Sequential(
            torch.nn.Linear(input_size, 1024),
            torch.nn.Dropout(0.2),
            torch.nn.Linear(1024, 128),
            torch.nn.Dropout(0.2),
            torch.nn.Linear(128, 64),
            torch.nn.Dropout(0.1),
            torch.nn.Linear(64, 16),
            torch.nn.Linear(16, 1),
        )

    def forward(self, x):
        return self.layers(x)


def load_aesthetic_predictor(device):
    """Pobierz i załaduj wagi LAION aesthetic predictor."""
    import urllib.request
    import os

    cache_dir = Path.home() / ".cache" / "picker_photo"
    cache_dir.mkdir(parents=True, exist_ok=True)
    weights_path = cache_dir / "aesthetic_predictor_v2.pth"

    if not weights_path.exists():
        print("  Pobieranie LAION aesthetic predictor (~17MB)...")
        urllib.request.urlretrieve(AESTHETIC_WEIGHTS_URL, weights_path)

    model = AestheticPredictor()
    state = torch.load(weights_path, map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.eval()
    return model.to(device)

# ── Scoring ────────────────────────────────────────────────────────────────

def load_image(path: Path):
    """Wczytaj i znormalizuj zdjęcie (zachowaj orientację EXIF)."""
    try:
        img = Image.open(path).convert("RGB")
        # Orientacja EXIF
        from PIL import ExifTags
        try:
            exif = img._getexif()
            if exif:
                for tag, val in exif.items():
                    if ExifTags.TAGS.get(tag) == "Orientation":
                        if val == 3:   img = img.rotate(180, expand=True)
                        elif val == 6: img = img.rotate(270, expand=True)
                        elif val == 8: img = img.rotate(90, expand=True)
        except Exception:
            pass
        return img
    except Exception as e:
        raise RuntimeError(f"Błąd odczytu: {e}") from e


@torch.no_grad()
def score_batch(paths, clip_model, processor, aesthetic_model, pos_text_emb, neg_text_emb, device):
    """Zwraca (clip_score, aesthetic_score) dla batcha zdjęć."""
    images = []
    valid_idx = []
    for i, p in enumerate(paths):
        try:
            images.append(load_image(p))
            valid_idx.append(i)
        except Exception:
            pass

    if not images:
        return [(0.0, 0.0)] * len(paths)

    inputs = processor(images=images, return_tensors="pt", padding=True)
    pixel_values = inputs["pixel_values"].to(device)

    # CLIP image embeddings
    img_out = clip_model.vision_model(pixel_values=pixel_values)
    img_emb = clip_model.visual_projection(img_out.pooler_output)
    img_emb = img_emb / img_emb.norm(dim=-1, keepdim=True)

    # CLIP score (cosine sim z positive - negative)
    pos_sim = (img_emb @ pos_text_emb.T).squeeze(-1)
    neg_sim = (img_emb @ neg_text_emb.T).squeeze(-1)
    clip_scores = ((pos_sim - neg_sim + 1) / 2 * 100).clamp(0, 100).cpu().numpy()

    # Aesthetic score (0-10)
    aes_scores = aesthetic_model(img_emb).squeeze(-1).cpu().numpy()

    results = [(0.0, 0.0)] * len(paths)
    for out_i, src_i in enumerate(valid_idx):
        results[src_i] = (float(clip_scores[out_i]), float(aes_scores[out_i]))
    return results

# ── Progress ───────────────────────────────────────────────────────────────

def bar(done, total, width=30):
    filled = round(done / total * width)
    return "█" * filled + "░" * (total - filled if filled > width else width - filled)

def score_bar_str(score):
    filled = round(score / 10)
    return "█" * filled + "░" * (10 - filled)

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Picker Photo CLIP Scorer", add_help=False)
    parser.add_argument("directory")
    parser.add_argument("--from", dest="from_file")
    parser.add_argument("-p", "--photographer", default="_generic")
    parser.add_argument("--top-percent", type=float, default=20)
    parser.add_argument("--top", type=int, default=None)
    parser.add_argument("--min-aesthetic", type=float, default=4.5)
    parser.add_argument("--no-aesthetic", action="store_true")
    parser.add_argument("-o", "--out")
    parser.add_argument("-w", "--workers", type=int, default=4)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--model", default="openai/clip-vit-large-patch14")
    parser.add_argument("--list-photographers", action="store_true")
    parser.add_argument("-h", "--help", action="store_true")
    args = parser.parse_args()

    if args.help:
        print(__doc__)
        sys.exit(0)

    if args.list_photographers:
        print("\nDostępni fotografowie:\n")
        for k, v in PHOTOGRAPHERS.items():
            if k != "_generic":
                print(f"  {k:<22} {v}")
        print(f"  {'_generic':<22} Ogólna jakość fotograficzna")
        sys.exit(0)

    dir_path = Path(args.directory)
    out_file = Path(args.out) if args.out else dir_path / "_score.json"

    photographer_id = args.photographer
    if photographer_id not in PHOTOGRAPHER_PROMPTS:
        print(f"Nieznany fotograf: {photographer_id}")
        print(f"Dostępne: {', '.join(PHOTOGRAPHER_PROMPTS.keys())}")
        sys.exit(1)

    pos_prompt, neg_prompt = PHOTOGRAPHER_PROMPTS[photographer_id]
    photographer_name = PHOTOGRAPHERS.get(photographer_id, photographer_id)

    # Wczytaj listę zdjęć
    source_total = None
    if args.from_file:
        from_path = Path(args.from_file)
        if not from_path.is_absolute() and not from_path.exists():
            from_path = dir_path / from_path
        with open(from_path) as f:
            manifest = json.load(f)
        candidates = manifest.get("candidates", [])
        image_paths = [Path(c["path"]) for c in candidates]
        source_total = manifest.get("summary", {}).get("total") or manifest.get("summary", {}).get("input")
    else:
        image_paths = sorted([
            p for p in dir_path.iterdir()
            if p.suffix.lower() in VALID_EXTS and not p.name.startswith("_")
        ])

    if not image_paths:
        print("Brak zdjęć do analizy.")
        sys.exit(1)

    device = get_device()
    device_name = {"mps": "Apple Silicon (MPS)", "cuda": "NVIDIA GPU (CUDA)", "cpu": "CPU"}.get(device.type, device.type)

    print(f"""
┌─────────────────────────────────────────────────────┐
│  Picker Photo — CLIP Scorer                         │
├─────────────────────────────────────────────────────┤
│  Model    : {args.model[:40]:<40}│
│  Urządzenie: {device_name[:39]:<39}│
│  Fotograf : {photographer_name[:40]:<40}│
│  Zdjęcia  : {str(len(image_paths)):<40}│
│  Batch    : {str(args.batch):<40}│
└─────────────────────────────────────────────────────┘
""")

    # Załaduj CLIP
    print("Ładowanie CLIP...", end=" ", flush=True)
    t0 = time.time()
    clip_model = CLIPModel.from_pretrained(args.model).to(device).eval()
    processor  = CLIPProcessor.from_pretrained(args.model)
    print(f"✓ ({time.time()-t0:.1f}s)")

    # Zakoduj tekst raz
    text_inputs = processor(text=[pos_prompt, neg_prompt], return_tensors="pt", padding=True).to(device)
    with torch.no_grad():
        text_out = clip_model.text_model(**text_inputs)
        text_emb = clip_model.text_projection(text_out.pooler_output)
        text_emb = text_emb / text_emb.norm(dim=-1, keepdim=True)
    pos_text_emb = text_emb[0:1]
    neg_text_emb = text_emb[1:2]

    # Załaduj aesthetic predictor
    aesthetic_model = None
    if not args.no_aesthetic:
        print("Ładowanie LAION Aesthetic Predictor...", end=" ", flush=True)
        t0 = time.time()
        try:
            aesthetic_model = load_aesthetic_predictor(device)
            print(f"✓ ({time.time()-t0:.1f}s)")
        except Exception as e:
            print(f"✗ Pominięto: {e}")
    print()

    # Przetwarzaj w batchach
    results = []
    total = len(image_paths)
    done = 0

    for batch_start in range(0, total, args.batch):
        batch_paths = image_paths[batch_start:batch_start + args.batch]

        scored = score_batch(
            batch_paths, clip_model, processor,
            aesthetic_model if aesthetic_model else AestheticPredictor().to(device).eval(),
            pos_text_emb, neg_text_emb, device
        )

        for path, (clip_s, aes_s) in zip(batch_paths, scored):
            done += 1
            results.append({
                "path": str(path),
                "name": path.name,
                "clipScore": round(clip_s, 1),
                "aestheticScore": round(aes_s, 2),
            })
            cat = "PICK " if clip_s >= 75 else ("MAYBE" if clip_s >= 60 else "skip ")
            print(
                f"\r[{done:>{len(str(total))}}/{total}] "
                f"{path.name[:34]:<34} "
                f"{clip_s:5.1f}  {score_bar_str(clip_s)}  {cat}",
                end=""
            )

    print(f"\n")

    # Filtruj i rankinguj
    valid = [r for r in results if r["clipScore"] > 0]
    if aesthetic_model and not args.no_aesthetic:
        valid = [r for r in valid if r["aestheticScore"] >= args.min_aesthetic]

    valid.sort(key=lambda r: (r["clipScore"] + r["aestheticScore"] * 5), reverse=True)

    if args.top is not None:
        candidates_out = valid[:args.top]
    else:
        cutoff = max(1, round(total * args.top_percent / 100))
        candidates_out = valid[:cutoff]

    print(f"─────────────────────────────────────────────")
    print(f"  Przeskanowane  : {total}")
    if aesthetic_model and not args.no_aesthetic:
        below_aes = len(results) - len(valid) - (total - len(results))
        print(f"  Poniżej estet. : {below_aes} (aesthetic < {args.min_aesthetic})")
    print(f"  Kandydaci → AI : {len(candidates_out)}  (top {args.top if args.top else str(args.top_percent)+'%'})")
    print(f"─────────────────────────────────────────────")

    report = {
        "directory": str(dir_path),
        "date": __import__("datetime").datetime.now().isoformat(),
        "model": args.model,
        "photographer": photographer_name,
        "photographerId": photographer_id,
        "settings": {
            "topPercent": args.top_percent,
            "topN": args.top,
            "minAesthetic": args.min_aesthetic,
        },
        "summary": {
            "input": total,
            "sourceTotal": source_total,
            "candidates": len(candidates_out),
        },
        "candidates": [
            {"path": r["path"], "name": r["name"],
             "clipScore": r["clipScore"], "aestheticScore": r["aestheticScore"]}
            for r in candidates_out
        ],
    }

    with open(out_file, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"""
✓ Gotowe! Raport: {out_file}

Następny krok — Claude ocenia {len(candidates_out)} najlepszych:
  npm run pick -- "{dir_path}" --from "{out_file}" -p {photographer_id if photographer_id != '_generic' else '<fotograf>'}
""")


if __name__ == "__main__":
    main()
