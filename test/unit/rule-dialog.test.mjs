// [unit] tests of the cv-core helpers of the dialog `Filter bearbeiten` (TASK-015b; spec REQ-012, DEC-19, ref
// L654-740): the `Eigenschaft` suggestions (ruleProperties: label or group contains the query, at most 50, `+<n> mehr`),
// the exact-label acceptance (findRuleProperty) and the `Wert` suggestions (ruleValueTexts: distinct display texts, at
// most 200, in value order).
// Spec Testing T5: these tests check logic behind REQ-012-AC2 and AC11; they cite those UI-level ACs in comments only,
// the UI tests are in test/e2e/rule-filter.spec.mjs.
// Expected values: hand-derived from the synthetic entries and rows below (each expectation states what it follows
// from); German number texts from toLocaleString("de-DE"), not from the product's formatter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "../load-core.mjs";

const { ruleProperties, findRuleProperty, ruleValueTexts, createColumnStore, RULE_PROPERTY_LIMIT, RULE_VALUE_LIMIT } =
  await loadCore();

const ENTRIES = [
  { key: "Kategorie", label: "Kategorie", group: "Allgemein" },
  { key: "Name", label: "Name", group: "Allgemein" },
  { key: "BaseQuantities.Length", label: "BaseQuantities.Length", group: "BaseQuantities" },
  { key: "BaseQuantities.Width", label: "BaseQuantities.Width", group: "BaseQuantities" },
  { key: "Pset_WallCommon.IsExternal", label: "Pset_WallCommon.IsExternal", group: "Pset_WallCommon" },
  { key: "Pset_X.Length", label: "Pset_X.Length", group: "Typ: Pset_X" },
  { key: "name", label: "name", group: "Pset_Lower" },
];
const keys = (result) => result.items.map((e) => e.key);

test("[unit] rule dialog: `Eigenschaft` suggestions match label or group in any letter case, in catalogue order", () => {
  // REQ-012-AC2: typing `Length` lists BaseQuantities.Length (label contains it) and Pset_X.Length, in entry order
  assert.deepEqual(keys(ruleProperties(ENTRIES, "Length")), ["BaseQuantities.Length", "Pset_X.Length"]);
  assert.deepEqual(keys(ruleProperties(ENTRIES, "  lENGTH ")), ["BaseQuantities.Length", "Pset_X.Length"]);
  // the group matches too (as ref L696): `typ:` only in the group of Pset_X.Length; `allgemein` the two attributes
  assert.deepEqual(keys(ruleProperties(ENTRIES, "typ:")), ["Pset_X.Length"]);
  assert.deepEqual(keys(ruleProperties(ENTRIES, "allgemein")), ["Kategorie", "Name"]);
  // empty query: all, none left out
  assert.deepEqual(ruleProperties(ENTRIES, "").items.length, ENTRIES.length);
  assert.equal(ruleProperties(ENTRIES, "").more, 0);
  assert.deepEqual(ruleProperties(ENTRIES, "gibtsnicht"), { items: [], more: 0 });
  assert.deepEqual(ruleProperties(null, "x"), { items: [], more: 0 });
});

test("[unit] rule dialog: at most 50 `Eigenschaft` suggestions, the rest counted for `+<n> mehr`", () => {
  assert.equal(RULE_PROPERTY_LIMIT, 50);
  // 120 entries Pset.P000 .. Pset.P119: all match "pset" -> 50 shown (the first 50), 70 more
  const many = Array.from({ length: 120 }, (_, i) => {
    const label = "Pset.P" + String(i).padStart(3, "0");
    return { key: label, label, group: "Pset" };
  });
  const result = ruleProperties(many, "pset");
  assert.equal(result.items.length, 50);
  assert.equal(result.items[0].key, "Pset.P000");
  assert.equal(result.items[49].key, "Pset.P049");
  assert.equal(result.more, 70);
  // "P11": P110 .. P119 -> 10, none more
  assert.deepEqual(ruleProperties(many, "P11"), { items: many.slice(110, 120), more: 0 });
});

test("[unit] rule dialog: a typed label is accepted when it equals a label (exact spelling first, else any case)", () => {
  // REQ-012-AC11: `Name` typed exactly is accepted; `Gibtsnicht` and a part of a label are not
  assert.equal(findRuleProperty(ENTRIES, "Name").key, "Name");
  assert.equal(findRuleProperty(ENTRIES, "  Name ").key, "Name");
  // `name` is a label of its own (Pset_Lower): the exact spelling wins over the case-insensitive match
  assert.equal(findRuleProperty(ENTRIES, "name").key, "name");
  assert.equal(findRuleProperty(ENTRIES, "KATEGORIE").key, "Kategorie");
  assert.equal(findRuleProperty(ENTRIES, "Gibtsnicht"), null);
  assert.equal(findRuleProperty(ENTRIES, "BaseQuantities.Len"), null);
  assert.equal(findRuleProperty(ENTRIES, ""), null);
  assert.equal(findRuleProperty(ENTRIES, "   "), null);
  assert.equal(findRuleProperty(null, "Name"), null);
});

test("[unit] rule dialog: `Wert` suggestions are the distinct display texts of the property in value order", () => {
  // DEC-19 display text: numbers German with up to 3 decimals, multi-values one by one, empty values left out
  const rows = [
    { key: "a", values: { Kat: "IfcWall", Vol: 0.3, Mat: ["Putz", "Beton"], Flag: "Ja" } },
    { key: "b", values: { Kat: "IfcSlab", Vol: 1234.5, Mat: ["Beton"], Flag: "Nein" } },
    { key: "c", values: { Kat: "IfcWall", Vol: 0.30001, Mat: [], Flag: "" } },
    { key: "d", values: { Kat: "Äußeres", Vol: 12 } },
    { key: "e", values: {} },
  ];
  const store = createColumnStore(rows);
  // texts in German collation order (Intl.Collator "de", independent of the product)
  const kat = ["IfcSlab", "IfcWall", "Äußeres"].sort(new Intl.Collator("de").compare);
  assert.deepEqual(ruleValueTexts(store, "Kat"), kat);
  // numbers ascending, 0.3 and 0.30001 both display "0,3" (once)
  const de = (n) => n.toLocaleString("de-DE", { maximumFractionDigits: 3 });
  assert.deepEqual(ruleValueTexts(store, "Vol"), [de(0.3), de(12), de(1234.5)]);
  assert.deepEqual(ruleValueTexts(store, "Vol"), ["0,3", "12", "1.234,5"]);
  assert.deepEqual(ruleValueTexts(store, "Mat"), ["Beton", "Putz"]);
  assert.deepEqual(ruleValueTexts(store, "Flag"), ["Ja", "Nein"]);
  assert.deepEqual(ruleValueTexts(store, "Missing"), []);
  assert.deepEqual(ruleValueTexts(store, null), []);
  // rows as an array work as the other core functions
  assert.deepEqual(ruleValueTexts(rows, "Flag"), ["Ja", "Nein"]);
});

test("[unit] rule dialog: at most 200 `Wert` suggestions", () => {
  assert.equal(RULE_VALUE_LIMIT, 200);
  const rows = Array.from({ length: 450 }, (_, i) => ({ key: String(i), values: { N: i } }));
  const texts = ruleValueTexts(createColumnStore(rows), "N");
  assert.equal(texts.length, 200);
  assert.equal(texts[0], "0");
  assert.equal(texts[199], "199");
  assert.equal(ruleValueTexts(createColumnStore(rows), "N", 3).length, 3);
});
