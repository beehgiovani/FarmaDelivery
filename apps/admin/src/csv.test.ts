import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, escapeCsvFormula } from "./csv";

test("escapes spreadsheet formula prefixes before CSV quoting", () => {
  assert.equal(escapeCsvFormula("=1+1"), "'=1+1");
  assert.equal(escapeCsvFormula("+5513999990000"), "'+5513999990000");
  assert.equal(escapeCsvFormula("-Asturias"), "'-Asturias");
  assert.equal(escapeCsvFormula("@cliente"), "'@cliente");
  assert.equal(escapeCsvFormula("\tvalor"), "'\tvalor");
  assert.equal(escapeCsvFormula("\rvalor"), "'\rvalor");
  assert.equal(escapeCsvFormula("Asturias"), "Asturias");
});

test("quotes CSV values and escapes embedded quotes after formula protection", () => {
  assert.equal(csvCell('Asturias "principal"'), '"Asturias ""principal"""');
  assert.equal(csvCell('=HYPERLINK("https://exemplo")'), '"\'=HYPERLINK(""https://exemplo"")"');
});
