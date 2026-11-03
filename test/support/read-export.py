# Independent reader of the table exports (TASK-008, REQ-008) for the tests: Python's csv module and openpyxl 3.1.5
# (spec 4.1, pinned), never the product's code. Prints one JSON object to stdout.
#
#   python3 -I test/support/read-export.py csv  <file>             bytes facts + records parsed with csv.reader(';')
#   python3 -I test/support/read-export.py xlsx <file>             ZIP / XML structure + every cell via openpyxl
#   python3 -I test/support/read-export.py xlsx-summary <file>     ZIP / XML structure + row count and first rows
#                                                                  (read-only mode, for large files)
import csv
import io
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

import openpyxl

MAIN = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def read_csv(path):
    data = open(path, "rb").read()
    bom = data.startswith(b"\xef\xbb\xbf")
    text = data.decode("utf-8-sig" if bom else "utf-8")  # strict: invalid UTF-8 fails the test
    records = list(csv.reader(io.StringIO(text, newline=""), delimiter=";", quotechar='"', strict=True))
    # record separators: every line break outside quoted fields must be CRLF
    bare_lf = 0
    in_quotes = False
    prev = ""
    for ch in text:
        if ch == '"':
            in_quotes = not in_quotes
        elif ch == "\n" and not in_quotes and prev != "\r":
            bare_lf += 1
        prev = ch
    return {
        "bom": bom,
        "endsWithCrlf": text.endswith("\r\n"),
        "bareLfOutsideQuotes": bare_lf,
        "records": records,
    }


def structure(path):
    z = zipfile.ZipFile(path)
    bad = z.testzip()
    names = z.namelist()
    parts = {}
    for name in names:
        raw = z.read(name)
        root = ET.fromstring(raw)  # every part must be well-formed XML
        parts[name] = root.tag
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    order = [child.tag.replace(MAIN, "") for child in sheet]
    pane = sheet.find(MAIN + "sheetViews/" + MAIN + "sheetView/" + MAIN + "pane")
    dim = sheet.find(MAIN + "dimension")
    cts = ET.fromstring(z.read("[Content_Types].xml"))
    overrides = {o.get("PartName"): o.get("ContentType") for o in cts if o.tag.endswith("Override")}
    return {
        "testzip": bad,
        "names": names,
        "rootTags": parts,
        "sheetChildren": order,
        "dimension": dim.get("ref") if dim is not None else None,
        "pane": dict(pane.attrib) if pane is not None else None,
        "overrides": overrides,
        "methods": sorted({info.compress_type for info in z.infolist()}),
    }


def read_xlsx(path):
    out = structure(path)
    wb = openpyxl.load_workbook(path)
    ws = wb.worksheets[0]
    out["sheetNames"] = wb.sheetnames
    out["freezePanes"] = ws.freeze_panes
    out["autoFilter"] = ws.auto_filter.ref
    out["maxRow"] = ws.max_row
    out["maxColumn"] = ws.max_column
    out["widths"] = {k: v.width for k, v in ws.column_dimensions.items()}
    # rows and columns up to the declared <dimension> (openpyxl's max_row ignores trailing rows without values)
    last = (out["dimension"] or "A1").split(":")[-1]
    max_row = int("".join(ch for ch in last if ch.isdigit()))
    max_col = openpyxl.utils.column_index_from_string("".join(ch for ch in last if ch.isalpha()))
    out["dimensionRows"] = max_row
    rows = []
    for row in ws.iter_rows(min_row=1, max_row=max(max_row, ws.max_row), max_col=max(max_col, ws.max_column)):
        rows.append([{"v": c.value, "t": c.data_type, "b": bool(c.font and c.font.b)} for c in row])
    out["rows"] = rows
    return out


def read_xlsx_summary(path):
    out = structure(path)
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.worksheets[0]
    out["sheetNames"] = wb.sheetnames
    count = 0
    first = []
    numeric = 0
    width = 0
    for row in ws.iter_rows(values_only=True):
        count += 1
        width = max(width, len(row))
        numeric += sum(1 for v in row if isinstance(v, (int, float)) and not isinstance(v, bool))
        if count <= 3:
            first.append(list(row))
    out["rowCount"] = count
    out["columnCount"] = width
    out["numericCells"] = numeric
    out["firstRows"] = first
    return out


if __name__ == "__main__":
    mode, path = sys.argv[1], sys.argv[2]
    result = {"csv": read_csv, "xlsx": read_xlsx, "xlsx-summary": read_xlsx_summary}[mode](path)
    sys.stdout.write(json.dumps(result, ensure_ascii=False))
