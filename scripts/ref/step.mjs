// Minimal, dependency-free ISO 10303-21 (STEP) reader used only to derive test reference values
// (spec Testing -> Test data). Deliberately independent of the product's extraction code and of fragments.

/** Decodes STEP string escapes: '' -> ', \X2\hhhh..\X0\ (UTF-16), \X4\..\X0\, \X\hh (ISO 8859-1), \S\c, \\. */
export function decodeStepString(raw) {
  let s = raw.replace(/''/g, "'");
  s = s.replace(/\\X2\\((?:[0-9A-Fa-f]{4})+)\\X0\\/g, (_, hex) =>
    String.fromCharCode(...hex.match(/.{4}/g).map((h) => parseInt(h, 16))),
  );
  s = s.replace(/\\X4\\((?:[0-9A-Fa-f]{8})+)\\X0\\/g, (_, hex) =>
    String.fromCodePoint(...hex.match(/.{8}/g).map((h) => parseInt(h, 16))),
  );
  s = s.replace(/\\X\\([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  s = s.replace(/\\S\\(.)/g, (_, c) => String.fromCharCode(c.charCodeAt(0) + 128));
  return s.replace(/\\\\/g, "\\");
}

/**
 * Parses one parameter list text "( ... )" into JS values:
 * $ -> null, * -> {derived:true}, #n -> {ref:n}, 'x' -> string, .E. -> {enum:'E'}, number -> number,
 * TYPE(v) -> {type:'TYPE', value:v}, ( ... ) -> array.
 */
export function parseParams(text) {
  let i = 0;
  const ws = () => {
    while (i < text.length && /\s/.test(text[i])) i++;
  };
  function value() {
    ws();
    const c = text[i];
    if (c === "$") return (i++, null);
    if (c === "*") return (i++, { derived: true });
    if (c === "#") {
      const m = /^#(\d+)/.exec(text.slice(i, i + 24));
      i += m[0].length;
      return { ref: Number(m[1]) };
    }
    if (c === "'") {
      let j = i + 1;
      for (;;) {
        if (text[j] === "'" && text[j + 1] === "'") j += 2;
        else if (text[j] === "'") break;
        else j++;
      }
      const s = decodeStepString(text.slice(i + 1, j));
      i = j + 1;
      return s;
    }
    if (c === ".") {
      const j = text.indexOf(".", i + 1);
      const e = text.slice(i + 1, j);
      i = j + 1;
      return { enum: e };
    }
    if (c === "(") return list();
    const num = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(text.slice(i, i + 40));
    if (num) {
      i += num[0].length;
      return Number(num[0]);
    }
    const kw = /^[A-Z0-9_]+/.exec(text.slice(i, i + 80));
    if (kw) {
      i += kw[0].length;
      ws();
      const inner = list();
      return { type: kw[0], value: inner.length === 1 ? inner[0] : inner };
    }
    throw new Error(`unexpected '${c}' at ${i} in ${text.slice(0, 120)}`);
  }
  function list() {
    ws();
    if (text[i] !== "(") throw new Error("expected (");
    i++;
    const out = [];
    ws();
    if (text[i] === ")") return (i++, out);
    for (;;) {
      out.push(value());
      ws();
      if (text[i] === ",") i++;
      else if (text[i] === ")") return (i++, out);
      else throw new Error(`expected , or ) at ${i}`);
    }
  }
  return list();
}

/** Reads a STEP file into Map<id, {id, type, raw}> (params parsed lazily via entity(id).args). */
export function readStep(text) {
  const start = text.search(/\bDATA\s*;/);
  const end = text.lastIndexOf("ENDSEC");
  const data = text.slice(text.indexOf(";", start) + 1, end);
  const map = new Map();
  const re = /'(?:[^']|'')*'|;/g;
  let s = 0;
  for (let m; (m = re.exec(data));) {
    if (m[0] !== ";") continue;
    const rec = data.slice(s, re.lastIndex - 1).trim();
    s = re.lastIndex;
    const h = /^#(\d+)\s*=\s*([A-Z0-9_]+)\s*/.exec(rec);
    if (!h) continue;
    const ent = { id: Number(h[1]), type: h[2], raw: rec.slice(h[0].length) };
    Object.defineProperty(ent, "args", {
      get() {
        return (this._a ??= parseParams(this.raw));
      },
    });
    map.set(ent.id, ent);
  }
  const schema = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/.exec(text)?.[1] ?? null;
  return { entities: map, schema };
}
