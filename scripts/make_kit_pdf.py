"""Build "Mannequin prompts.pdf" for the mannequin kit.

Usage: python -I scripts/make_kit_pdf.py <items.json> <kit folder>
items.json comes from scripts/make-mannequin-kit.js (written into the kit folder).
"""
import json
import os
import sys

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (Image, KeepTogether, ListFlowable, ListItem, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)
from xml.sax.saxutils import escape

items_file, kit = sys.argv[1], sys.argv[2]
items = json.load(open(items_file, encoding="utf-8"))

MAROON = colors.HexColor("#6E1E2B")
GOLD = colors.HexColor("#B08D57")
INK = colors.HexColor("#3B2E25")
MUTED = colors.HexColor("#7A6A5C")
CREAM = colors.HexColor("#F6F1E9")
LINE = colors.HexColor("#E6DCCD")

title = ParagraphStyle("t", fontName="Times-Bold", fontSize=24, leading=28, textColor=MAROON, spaceAfter=4)
sub = ParagraphStyle("s", fontName="Helvetica", fontSize=10, leading=14, textColor=MUTED, spaceAfter=10)
step = ParagraphStyle("st", fontName="Helvetica", fontSize=10.5, leading=15, textColor=INK)
name = ParagraphStyle("n", fontName="Times-Bold", fontSize=14, leading=17, textColor=MAROON, spaceAfter=3)
meta = ParagraphStyle("m", fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED, spaceAfter=5)
prompt = ParagraphStyle("p", fontName="Courier", fontSize=7.6, leading=10, textColor=INK,
                        backColor=CREAM, borderColor=LINE, borderWidth=0.5, borderPadding=5)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 10 * mm, "Jeevana Vastra · Mannequin Prompt Kit")
    canvas.drawRightString(A4[0] - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


story = [
    Paragraph("Jeevana Vastra: Mannequin Prompt Kit", title),
    Paragraph(f"{len(items)} items · same stylish fashion mannequin, pose and ivory background for every product", sub),
    ListFlowable([ListItem(Paragraph(t, step), leftIndent=12) for t in [
        "Open <b>gemini.google.com</b> (or Flow) and choose image creation (Nano Banana).",
        "For each item start a <b>new chat</b>, attach the photo named under <i>Upload</i> from the <b>photos</b> folder, paste the prompt and send.",
        "Compare with the original photo. If colours, motifs, border or tassels changed, regenerate. Keep only exact matches.",
        "Tip: once you have a mannequin you love, also attach that image and add “use exactly this mannequin and pose”.",
        "Save each result in the <b>mannequins</b> folder with the name under <i>Save as</i> (the number at the start matters).",
        "Zip the <b>mannequins</b> folder and upload it in the Claude chat (batches are fine).",
    ]], bulletType="1", bulletFontName="Helvetica-Bold", bulletColor=MAROON, leftIndent=14),
    Spacer(1, 12),
]

for it in items:
    photo = os.path.join(kit, "photos", it["photo"])
    img = Image(photo, width=34 * mm, height=45 * mm, kind="proportional")
    right = [
        Paragraph(f'<font color="#B08D57">#{it["n"]}</font>  {escape(it["name"])}', name),
        Paragraph(f'Upload: <b>photos/{escape(it["photo"])}</b><br/>Save as: <b>{escape(it["save"])}</b>', meta),
        Paragraph(escape(it["prompt"]), prompt),
    ]
    t = Table([[img, right]], colWidths=[38 * mm, None])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, LINE),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
    ]))
    story.append(KeepTogether(t))

out = os.path.join(kit, "Mannequin prompts.pdf")
doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
                        title="Jeevana Vastra Mannequin Prompt Kit", author="Jeevana Vastra")
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(out)
