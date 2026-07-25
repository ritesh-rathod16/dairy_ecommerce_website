"""
Generates a real invoice PDF for an order using reportlab.

Note: deliberately uses "Rs." instead of the "₹" glyph — reportlab's built-in
base-14 fonts (Helvetica etc.) don't reliably include the Indian Rupee sign
across platforms, and it can render as a missing-glyph box. "Rs." is safe
everywhere without needing to embed a custom TTF font.
"""
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

from app.services.settings import get_runtime_settings


def _rs(amount) -> str:
    return f"Rs. {amount:.2f}"


async def build_invoice_pdf(order: dict, customer: dict) -> bytes:
    rt = await get_runtime_settings()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=20 * mm, bottomMargin=20 * mm, leftMargin=20 * mm, rightMargin=20 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("InvoiceTitle", parent=styles["Title"], fontSize=20, spaceAfter=2)
    small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=9, textColor=colors.grey)
    normal = styles["Normal"]

    story = []

    story.append(Paragraph(rt["merchant_name"], title_style))
    story.append(Paragraph("Tax Invoice", small))
    story.append(Spacer(1, 10))

    meta_table = Table(
        [
            ["Invoice / Order #:", order["order_number"], "Date:", order["created_at"].strftime("%d %b %Y, %I:%M %p")],
            ["Payment method:", order["payment_method"], "Payment status:", order.get("payment_status", "pending")],
        ],
        colWidths=[100, 140, 90, 140],
    )
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.grey),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.grey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    story.append(Paragraph("Bill to", ParagraphStyle("H", parent=styles["Heading4"], spaceAfter=2)))
    addr = order["address"]
    address_lines = f"{customer.get('name', '')}<br/>{customer.get('phone', '')} · {customer.get('email', '')}<br/>" \
                     f"{addr['line1']}{', ' + addr['line2'] if addr.get('line2') else ''}<br/>" \
                     f"{addr['city']} - {addr['pincode']}"
    story.append(Paragraph(address_lines, normal))
    story.append(Spacer(1, 16))

    # Line items
    rows = [["Item", "Unit", "Qty", "Price", "Total"]]
    for item in order["items"]:
        rows.append([item["name"], item["unit"], str(item["quantity"]), _rs(item["price"]), _rs(item["line_total"])])

    item_table = Table(rows, colWidths=[180, 80, 40, 80, 80])
    item_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1B4332")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E5E5")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FBF6EC")]),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 10))

    totals_rows = [
        ["Subtotal", _rs(order["subtotal"])],
        ["Delivery fee", "FREE" if order["delivery_fee"] == 0 else _rs(order["delivery_fee"])],
        ["Total", _rs(order["total"])],
    ]
    totals_table = Table(totals_rows, colWidths=[400, 80], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
        ("FONTSIZE", (0, 2), (-1, 2), 11),
        ("LINEABOVE", (0, 2), (-1, 2), 0.75, colors.HexColor("#1B4332")),
        ("TOPPADDING", (0, 2), (-1, 2), 6),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 24))

    story.append(Paragraph(
        "This is a system-generated invoice and does not require a signature.",
        small,
    ))

    doc.build(story)
    return buf.getvalue()
