/**
 * CSV as banks actually export it: RFC 4180 quoting, quoted
 * newlines and doubled quotes, a UTF-8 byte-order mark, CRLF or LF, and
 * whichever delimiter the bank chose — comma, semicolon or tab. Blank lines
 * are dropped; ragged rows are kept as they are for the mapper to judge.
 */

export function detectDelimiter(text: string): "," | ";" | "\t" {
  const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
  const counts = ([",", ";", "\t"] as const).map((d) => ({
    d,
    // Count outside quotes only.
    n: sample.replace(/"[^"]*"/g, "").split(d).length - 1,
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ",";
}

export function parseCsv(
  input: string,
  delimiter = detectDelimiter(input),
): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    if (row.some((cell) => cell.trim() !== ""))
      rows.push(row.map((cell) => cell.trim()));
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field.trim() === "") {
      field = "";
      quoted = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      endRow();
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}
