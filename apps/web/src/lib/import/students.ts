import "server-only";
import * as XLSX from "xlsx";
import { z } from "zod";
import {
  studentCreateSchema,
  GENDERS,
  STUDENT_STATUSES,
} from "@/lib/validations/student";

/**
 * Parser import siswa dari file XLSX (SheetJS).
 *
 * Modul ini MURNI (tidak menyentuh DB) sehingga mudah diuji.
 * Alur: baca sheet → map header → validasi tiap baris → hasilkan laporan.
 */

/**
 * Header kolom yang diharapkan di template.
 *
 * `REQUIRED_COLUMNS` di bawah menentukan mana yang WAJIB ada; sisanya
 * opsional. Kolom administrasi sengaja opsional supaya berkas Excel lama
 * (yang dibuat sebelum kolom ini ada) tetap bisa diimpor — kalau tidak,
 * sekolah harus menyusun ulang templatenya hanya untuk menambah NIK.
 */
export const IMPORT_COLUMNS = [
  "nis",
  "nisn",
  "nik",
  "kkNumber",
  "fullName",
  "gender",
  "birthPlace",
  "birthDate",
  "religion",
  "address",
  "village",
  "district",
  "city",
  "province",
  "postalCode",
  "phone",
  "entryYear",
  "status",
  "parentName",
  "parentRelation",
  "parentPhone",
  "parentNik",
  "parentOccupation",
] as const;

/** Kolom yang HARUS ada. Sisanya boleh tidak ada. */
export const REQUIRED_COLUMNS: readonly ImportColumn[] = [
  "nis",
  "fullName",
  "gender",
  "entryYear",
];

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export type ParsedRow = {
  rowNumber: number; // nomor baris di file (untuk pesan)
  ok: boolean;
  data?: z.infer<typeof studentCreateSchema>;
  errors?: string[];
};

export type ParseResult = {
  rows: ParsedRow[];
  validCount: number;
  invalidCount: number;
  headerErrors: string[];
};

/** Terima "L"/"P"/"Laki-laki"/"MALE" → enum. */
function normalizeGender(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const s = String(v).trim().toLowerCase();
  if (["l", "lk", "laki-laki", "laki laki", "pria", "male", "m"].includes(s))
    return "MALE";
  if (["p", "pr", "perempuan", "wanita", "female", "f"].includes(s))
    return "FEMALE";
  return String(v).trim().toUpperCase();
}

function normalizeStatus(v: unknown): string | undefined {
  if (v == null || v === "") return "ACTIVE";
  const s = String(v).trim().toLowerCase();
  const map: Record<string, string> = {
    aktif: "ACTIVE",
    active: "ACTIVE",
    lulus: "GRADUATED",
    graduated: "GRADUATED",
    pindah: "TRANSFERRED",
    transferred: "TRANSFERRED",
    keluar: "DROPPED_OUT",
    "dropped_out": "DROPPED_OUT",
    skorsing: "SUSPENDED",
    suspended: "SUSPENDED",
  };
  return map[s] ?? String(v).trim().toUpperCase();
}

function normalizeRelation(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  const s = String(v).trim().toLowerCase();
  const map: Record<string, string> = {
    ayah: "FATHER",
    bapak: "FATHER",
    father: "FATHER",
    ibu: "MOTHER",
    mother: "MOTHER",
    wali: "GUARDIAN",
    guardian: "GUARDIAN",
  };
  return map[s] ?? String(v).trim().toUpperCase();
}

/** Excel serial date → string ISO (YYYY-MM-DD). */
function normalizeDate(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel epoch: 1899-12-30 (serial 25569 = 1970-01-01)
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

/**
 * Parse buffer XLSX menjadi baris tervalidasi.
 * @param buffer isi file
 */
export function parseStudentWorkbook(buffer: ArrayBuffer | Buffer): ParseResult {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { rows: [], validCount: 0, invalidCount: 0, headerErrors: ["File tidak punya sheet."] };
  }

  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  if (raw.length === 0) {
    return { rows: [], validCount: 0, invalidCount: 0, headerErrors: ["File kosong."] };
  }

  // Normalisasi nama header (case-insensitive, buang spasi).
  const headerMap = new Map<string, string>();
  for (const key of Object.keys(raw[0])) {
    headerMap.set(key.trim().toLowerCase(), key);
  }

  // Hanya kolom ini yang WAJIB. Kolom administrasi (NIK, alamat berjenjang)
  // opsional supaya berkas lama tetap bisa diimpor.
  const headerErrors: string[] = [];
  for (const req of REQUIRED_COLUMNS) {
    if (!headerMap.has(req.toLowerCase())) {
      headerErrors.push(`Kolom wajib "${req}" tidak ditemukan.`);
    }
  }
  if (headerErrors.length) {
    return { rows: [], validCount: 0, invalidCount: 0, headerErrors };
  }

  const get = (row: Record<string, unknown>, col: ImportColumn) => {
    const actual = headerMap.get(col.toLowerCase());
    return actual ? row[actual] : undefined;
  };

  const rows: ParsedRow[] = raw.map((row, idx) => {
    const rowNumber = idx + 2; // baris 1 = header
    const candidate = {
      nis: String(get(row, "nis") ?? "").trim(),
      nisn: String(get(row, "nisn") ?? "").trim(),
      // Kolom administrasi — boleh tidak ada di berkas lama (`get` → undefined
      // → "" → undefined di skema). NIK divalidasi seperti di form.
      nik: String(get(row, "nik") ?? "").trim(),
      kkNumber: String(get(row, "kkNumber") ?? "").trim(),
      fullName: String(get(row, "fullName") ?? "").trim(),
      gender: normalizeGender(get(row, "gender")),
      birthPlace: String(get(row, "birthPlace") ?? "").trim(),
      birthDate: normalizeDate(get(row, "birthDate")),
      religion: String(get(row, "religion") ?? "").trim(),
      address: String(get(row, "address") ?? "").trim(),
      village: String(get(row, "village") ?? "").trim(),
      district: String(get(row, "district") ?? "").trim(),
      city: String(get(row, "city") ?? "").trim(),
      province: String(get(row, "province") ?? "").trim(),
      postalCode: String(get(row, "postalCode") ?? "").trim(),
      phone: String(get(row, "phone") ?? "").trim(),
      entryYear: get(row, "entryYear"),
      status: normalizeStatus(get(row, "status")),
      parentName: String(get(row, "parentName") ?? "").trim(),
      parentRelation: normalizeRelation(get(row, "parentRelation")),
      parentPhone: String(get(row, "parentPhone") ?? "").trim(),
      parentNik: String(get(row, "parentNik") ?? "").trim(),
      parentOccupation: String(get(row, "parentOccupation") ?? "").trim(),
    };

    const parsed = studentCreateSchema.safeParse(candidate);
    if (parsed.success) {
      return { rowNumber, ok: true, data: parsed.data };
    }
    return {
      rowNumber,
      ok: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "baris"}: ${i.message}`,
      ),
    };
  });

  const validCount = rows.filter((r) => r.ok).length;
  return {
    rows,
    validCount,
    invalidCount: rows.length - validCount,
    headerErrors: [],
  };
}

/** Buat file template XLSX (satu baris contoh) untuk diunduh pengguna. */
export function buildStudentTemplate(): Buffer {
  const example = {
    nis: "2025001",
    nisn: "0012345678",
    fullName: "Ani Contoh",
    gender: "P",
    birthPlace: "Bandung",
    birthDate: "2012-05-17",
    religion: "Islam",
    address: "Jl. Melati No. 3",
    phone: "081234567890",
    entryYear: 2025,
    status: "Aktif",
    parentName: "Budi Contoh",
    parentRelation: "Ayah",
    parentPhone: "081298765432",
  };
  const ws = XLSX.utils.json_to_sheet([example], { header: [...IMPORT_COLUMNS] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Siswa");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Export daftar siswa ke XLSX. */
export function buildStudentsExport(
  students: Array<Record<string, unknown>>,
): Buffer {
  const ws = XLSX.utils.json_to_sheet(students, {
    header: ["nis", "nisn", "fullName", "gender", "status", "entryYear", "class"],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Siswa");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export { GENDERS, STUDENT_STATUSES };
