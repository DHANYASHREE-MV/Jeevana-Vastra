"""Turn the raw product photographs into a consistent, optimised catalogue.

Usage: python -I scripts/process_images.py <project-root> <photo-folder-A> [<photo-folder-B> ...] [--force]

In catalog.json, a product's "src" lists photos by index in a folder's sorted *.jpeg list:
plain numbers refer to folder A, "B3" means photo 3 of folder B, and so on.
Existing outputs are kept unless --force is given.

Every photo becomes a 3:4 catalogue frame (900x1200) so cards and galleries line up.
Photos shot on a plain studio backdrop (black, white, green) get that backdrop replaced with
the brand ivory by flood-filling from the image border; the garment pixels themselves are
never edited, recoloured or regenerated. Portrait scene photos are centre-cropped to 3:4;
landscape photos (e.g. folded sarees shot sideways) are fitted whole onto an ivory 3:4 canvas.

Outputs, per product photo n:
  public/img/products/<slug>-<n>-480.webp   (cards, thumbnails)
  public/img/products/<slug>-<n>-1080.webp  (product page, zoom)
  public/img/products/<slug>-<n>.jpg        (untouched original, garment reference for try-on)
"""
import glob, json, os, shutil, sys
from PIL import Image, ImageDraw, ImageFilter, ImageOps

args = [a for a in sys.argv[1:] if not a.startswith("--")]
FORCE = "--force" in sys.argv
root, folders = args[0], args[1:]
photo_sets = [sorted(glob.glob(os.path.join(f, "*.jpeg"))) for f in folders]


def resolve(ref):
    """0-based folder index + photo index for a catalog src reference (7 or "B3")."""
    if isinstance(ref, int):
        return 0, ref
    return ord(ref[0].upper()) - ord("A"), int(ref[1:])
catalog = json.load(open(os.path.join(root, "server", "data", "catalog.json"), encoding="utf-8"))
out = os.path.join(root, "public", "img", "products")
os.makedirs(out, exist_ok=True)

IVORY = (246, 241, 233)
W, H = 900, 1200
# Source photos with a plain backdrop -> flood-fill tolerance
PLAIN_BACKDROP = {(0, 7): 38, (0, 17): 42, (0, 18): 42, (0, 19): 42, (0, 20): 42, (0, 23): 46, (0, 26): 40}
SENTINEL = (255, 0, 254)


def replace_backdrop(im, thresh):
    work = im.copy()
    w, h = work.size
    seeds = [(x, 0) for x in range(0, w, 12)] + [(x, h - 1) for x in range(0, w, 12)] + \
            [(0, y) for y in range(0, h, 12)] + [(w - 1, y) for y in range(0, h, 12)]
    ref = im.getpixel((2, 2))
    for s in seeds:
        px = work.getpixel(s)
        if px != SENTINEL and sum(abs(a - b) for a, b in zip(px, ref)) < thresh * 2:
            ImageDraw.floodfill(work, s, SENTINEL, thresh=thresh)
    mask = Image.eval(work.convert("RGB"), lambda v: v).point(lambda v: v)  # copy
    r, g, b = work.split()
    m = Image.merge("RGB", (r, g, b)).convert("RGB")
    bg_mask = Image.new("L", (w, h), 0)
    bg_mask.putdata([255 if p == SENTINEL else 0 for p in m.get_flattened_data()])
    bg_mask = bg_mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.6))
    ivory = Image.new("RGB", (w, h), IVORY)
    return Image.composite(ivory, im, bg_mask), bg_mask


def frame(im, key):
    idx = key
    if idx in PLAIN_BACKDROP:
        im, bg = replace_backdrop(im, PLAIN_BACKDROP[idx])
        # bounding box of the subject, then contain it on an ivory 3:4 canvas
        box = ImageOps.invert(bg).point(lambda v: 255 if v > 128 else 0).getbbox() or (0, 0, *im.size)
        im = im.crop(box)
        scale = min((W * 0.86) / im.width, (H * 0.94) / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        canvas = Image.new("RGB", (W, H), IVORY)
        canvas.paste(im, ((W - im.width) // 2, H - im.height - round(H * 0.025)))
        return canvas
    if im.width > im.height:
        # Landscape flat-lay: keep the whole garment, fit it onto an ivory 3:4 canvas
        scale = min((W * 0.94) / im.width, (H * 0.94) / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        canvas = Image.new("RGB", (W, H), IVORY)
        canvas.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
        return canvas
    # Portrait scene / flat-lay photos: centre crop to 3:4 without distortion
    return ImageOps.fit(im, (W, H), Image.LANCZOS, centering=(0.5, 0.42))


for p in catalog["products"]:
    for n, ref in enumerate(p["src"]):
        key = resolve(ref)
        base = os.path.join(out, f"{p['slug']}-{n}")
        if not FORCE and all(os.path.exists(base + ext) for ext in ("-480.webp", "-1080.webp", ".jpg")):
            continue
        orig = ImageOps.exif_transpose(Image.open(photo_sets[key[0]][key[1]])).convert("RGB")
        framed = frame(orig, key)
        framed.resize((480, 640), Image.LANCZOS).save(base + "-480.webp", "WEBP", quality=80, method=6)
        framed.save(base + "-1080.webp", "WEBP", quality=86, method=6)
        o = orig.copy(); o.thumbnail((1024, 1024 * 2))
        o.save(base + ".jpg", "JPEG", quality=88, optimize=True)
    # Human-approved AI mannequin presentation (scripts/mannequin.js) -> "<slug>-mq" image set
    mq = os.path.join(root, "server", "data", "mannequin", "approved", f"{p['slug']}.png")
    if os.path.exists(mq):
        m = Image.open(mq).convert("RGB")
        framed = ImageOps.fit(m, (W, H), Image.LANCZOS, centering=(0.5, 0.45))
        base = os.path.join(out, f"{p['slug']}-mq")
        framed.resize((480, 640), Image.LANCZOS).save(base + "-480.webp", "WEBP", quality=80, method=6)
        framed.save(base + "-1080.webp", "WEBP", quality=86, method=6)
        framed.save(base + ".jpg", "JPEG", quality=90)
        print("  + mannequin view")
    print("ok", p["slug"])

# Collection film: the smallest video found (lighter page weight)
videos = sorted((v for f in folders for v in glob.glob(os.path.join(f, "*.mp4"))), key=os.path.getsize)
if videos:
    shutil.copy(videos[0], os.path.join(root, "public", "media", "collection.mp4"))
