// Spreadsheet reading for bulk upload (Q9). Plain CSV, as Excel and Google Sheets save it: quoted fields,
// commas or semicolons, CRLF, and a byte-order mark are all handled. No library: the format is small and fixed.

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export type ColKey = "full_name" | "roll_no" | "batch_year" | "program" | "email" | "phone";
export const REQUIRED: ColKey[] = ["full_name", "roll_no", "batch_year", "program"];
export const COL_LABEL: Record<ColKey, string> = {
  full_name: "Full name", roll_no: "Roll number", batch_year: "Batch year", program: "Programme", email: "Email", phone: "Phone",
};

// Header words exam cells commonly use, matched after lower-casing and removing spaces and punctuation.
const SYNONYMS: Record<ColKey, string[]> = {
  full_name: ["fullname", "name", "studentname", "alumnusname", "alumniname", "nameofstudent", "candidatename"],
  roll_no: ["rollno", "rollnumber", "roll", "enrollmentno", "enrolmentno", "enrollmentnumber", "enrolmentnumber", "registrationno",
    "registrationnumber", "regno", "studentid", "prn", "admissionno"],
  batch_year: ["batchyear", "batch", "graduationyear", "yearofgraduation", "passingyear", "yearofpassing", "passoutyear", "year", "graduatingyear"],
  program: ["program", "programme", "course", "department", "branch", "degree", "discipline", "programmename", "coursename"],
  email: ["email", "emailid", "emailaddress", "mail"],
  phone: ["phone", "mobile", "mobileno", "mobilenumber", "phonenumber", "contact", "contactno", "contactnumber"],
};
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Which column holds what. Exact matches win over loose ones; each column is used once. */
export function matchColumns(header: string[]): Partial<Record<ColKey, number>> {
  const out: Partial<Record<ColKey, number>> = {};
  const used = new Set<number>();
  const h = header.map(norm);
  for (const pass of ["exact", "contains"] as const) {
    for (const key of Object.keys(SYNONYMS) as ColKey[]) {
      if (out[key] !== undefined) continue;
      const idx = h.findIndex((x, i) => !used.has(i) && SYNONYMS[key].some((s) => (pass === "exact" ? x === s : x.includes(s) && s.length >= 4)));
      if (idx >= 0) { out[key] = idx; used.add(idx); }
    }
  }
  return out;
}

export type Parsed = { line: number; full_name: string; roll_no: string; batch_year: string; program: string; email: string; phone: string; problems: string[] };

export function readRows(rows: string[][], cols: Partial<Record<ColKey, number>>): Parsed[] {
  const seen = new Map<string, number>();
  return rows.slice(1).map((r, i) => {
    const get = (k: ColKey) => (cols[k] === undefined ? "" : (r[cols[k]!] ?? "").trim());
    const p: Parsed = {
      line: i + 2, full_name: get("full_name").replace(/\s+/g, " "), roll_no: get("roll_no"), batch_year: get("batch_year").replace(/\.0$/, ""),
      program: get("program"), email: get("email"), phone: get("phone"), problems: [],
    };
    if (!p.full_name) p.problems.push("no name");
    if (!p.roll_no) p.problems.push("no roll number");
    if (!/^\d{4}$/.test(p.batch_year) || +p.batch_year < 1950 || +p.batch_year > 2100) p.problems.push(p.batch_year ? `batch “${p.batch_year}” isn’t a year` : "no batch year");
    if (!p.program) p.problems.push("no programme");
    if (p.full_name.length > 120 || p.program.length > 120 || p.roll_no.length > 40) p.problems.push("a value is too long");
    if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) p.email = "";            // optional: drop, don't block
    if (p.phone && !/^[+0-9 ()-]{7,24}$/.test(p.phone)) p.phone = "";
    const key = p.roll_no.toLowerCase();
    if (key) {
      if (seen.has(key)) p.problems.push(`same roll number as line ${seen.get(key)}`);
      else seen.set(key, p.line);
    }
    return p;
  });
}
