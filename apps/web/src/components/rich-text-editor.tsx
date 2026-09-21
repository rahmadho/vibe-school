"use client";

import { useCallback, useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
/**
 * Editor teks kaya (WYSIWYG) untuk berita & pengumuman.
 *
 * ============================================================
 * KENAPA TIPTAP, BUKAN `contentEditable` SENDIRI
 * ============================================================
 * `contentEditable` mentah menghasilkan HTML yang berbeda-beda antar-peramban
 * (Chrome membungkus teks dengan <div>, Firefox <br>), sehingga isi yang sama
 * tampil berbeda di web publik. TipTap memakai model dokumen sendiri
 * (ProseMirror) sehingga hasilnya konsisten — dan perintah seperti "toggle
 * bold" tidak merusak struktur.
 *
 * ============================================================
 * KENAPA TOMBOL DIKELOMPOK, BUKAN DIJEJER
 * ============================================================
 * Tombol yang dijejer rata tanpa pengelompokan memaksa operator MEMBACA setiap
 * ikon untuk menemukan satu perintah. Di sini tombol dikelompokkan seperti
 * panel penyuntingan cetak — teks, daftar, blok — dengan garis pemisah tipis
 * dan judul kelompok yang muncul saat disorot. Mata cukup melompat ke
 * kelompok, lalu ke tombolnya.
 *
 * Perintah yang jarang dipakai (garis pemisah, kutipan, blok kode) tetap
 * tersedia tetapi tidak berteriak: ukurannya sama, hanya posisinya di kanan.
 */

/* ============================================================
 * IKON — SVG sebaris, bukan emoji, bukan pustaka
 * ============================================================ */

/**
 * Data gambar ikon (viewBox 24×24, garis 1.7, ujung membulat).
 * Digambar sebaris agar bisa diwarnai `currentColor` — ikut berubah saat
 * tombol aktif atau disorot, tanpa berkas tambahan.
 */
const ICON_PATHS: Record<string, string> = {
  bold: "M7 5.5h6.2a3.4 3.4 0 0 1 0 6.8H7zM7 12.3h7a3.6 3.6 0 0 1 0 7.2H7z",
  italic: "M15.5 5.5h-5M13.5 18.5h-5M14 5.5l-3 13",
  strike: "M5.5 12h13M8.2 8.4c0-1.7 1.6-2.9 4-2.9 2.1 0 3.6.9 4 2.3M15.8 15.6c0 1.7-1.6 2.9-4 2.9-2.1 0-3.6-.9-4-2.3",
  h2: "M5 5.5v13M13.5 5.5v13M5 12h8.5M17.5 18.5h3l-2 3.5",
  h3: "M5 5.5v13M13.5 5.5v13M5 12h8.5M17 14.6c.8-.7 1.7-1 2.6-1 1.2 0 2 .7 2 1.7s-.8 1.7-2.2 1.7h-.6M17.6 20.5c1 .8 2 1.1 3 1.1 1.3 0 2.2-.7 2.2-1.8",
  paragraph: "M5 6.5h14M5 12h14M5 17.5h9",
  bullet: "M9 7h10M9 12h10M9 17h10M5 7h.02M5 12h.02M5 17h.02",
  ordered: "M4.5 5.5h1v4M4.5 9.5h2.4M4.3 13.5c.4-.6 1-.9 1.7-.9.9 0 1.6.6 1.6 1.4 0 1.2-3.3 2.6-3.3 4h3.4M9.5 7.5h10M9.5 13h10M9.5 18h10",
  quote: "M6 15.5c-1.2 0-2-.9-2-2.1 0-2.4 1.6-4.4 4-5.4l.7 1.4c-1.6.7-2.6 1.9-2.7 3 .2-.1.5-.2.8-.2 1.1 0 1.9.8 1.9 1.9s-.9 1.9-2.1 1.9zM16 15.5c-1.2 0-2-.9-2-2.1 0-2.4 1.6-4.4 4-5.4l.7 1.4c-1.6.7-2.6 1.9-2.7 3 .2-.1.5-.2.8-.2 1.1 0 1.9.8 1.9 1.9s-.9 1.9-2.1 1.9z",
  code: "m8.5 8.5-4 3.5 4 3.5M15.5 8.5l4 3.5-4 3.5M13.5 5.5l-3 13",
  rule: "M4 12h16",
  undo: "M4.5 9.5h9a4.5 4.5 0 0 1 0 9H9M4.5 9.5 8 6M4.5 9.5 8 13",
  redo: "M19.5 9.5h-9a4.5 4.5 0 0 0 0 9H15M19.5 9.5 16 6M19.5 9.5 16 13",
  unlink: "M9.5 14.5 5.8 18.2a3.5 3.5 0 0 1-5-5l3.7-3.7M14.5 9.5l3.7-3.7a3.5 3.5 0 0 1 5 5l-3.7 3.7M4 4l16 16",
};

function Icon({ name }: { name: string }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

/* ============================================================
 * TOMBOL TOOLBAR
 * ============================================================ */

function ToolButton({
  label,
  shortcut,
  icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  shortcut?: string;
  icon: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      // `onMouseDown` + preventDefault: tanpa ini editor kehilangan fokus dan
      // seleksi teks hilang sebelum perintah dijalankan.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={[
        "flex h-8 w-8 items-center justify-center rounded-sm transition-colors",
        active
          ? "bg-board text-white"
          : "text-slate hover:bg-chalk/60 hover:text-ink",
        disabled ? "cursor-not-allowed opacity-30" : "",
      ].join(" ")}
    >
      <Icon name={icon} />
    </button>
  );
}

/** Pemisah antar kelompok perintah — garis rambut, bukan ruang kosong saja. */
function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-chalk" />;
}

/* ============================================================
 * EDITOR
 * ============================================================ */

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Tulis isi berita di sini…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Blok kode bawaan dimatikan: berita sekolah tidak memuat kode, dan
        // tombolnya hanya menambah kebisingan di toolbar.
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder,
        // Hanya tampilkan saat dokumen benar-benar kosong, bukan di setiap
        // paragraf kosong — kalau tidak, petunjuk muncul di tengah tulisan.
        showOnlyWhenEditable: true,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content: value,
    // WAJIB untuk Next.js: tanpa ini editor dirender di server lalu berbeda
    // dengan hasil di browser → hydration mismatch.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose-editor min-h-[320px] w-full px-5 py-4 text-[15px] leading-relaxed text-ink focus:outline-none",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // Nilai dari luar (mis. setelah simpan / reset) harus masuk ke editor.
  // Tanpa ini, form yang direset tetap menampilkan isi lama.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Alamat tautan (https://…)", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) {
    // Ruang setinggi editor sungguhan supaya tata letak tidak melompat saat
    // editor selesai dimuat.
    return (
      <div className="min-h-[380px] rounded border border-chalk bg-white" />
    );
  }

  return (
    <div className="overflow-hidden rounded border border-chalk bg-white focus-within:border-board">
      <Toolbar editor={editor} onSetLink={setLink} />
      <EditorContent editor={editor} />
      <Footer editor={editor} />
    </div>
  );
}

/* ============================================================
 * TOOLBAR
 * ============================================================ */

function Toolbar({
  editor,
  onSetLink,
}: {
  editor: Editor;
  onSetLink: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Pemformatan teks"
      className="flex flex-wrap items-center gap-0.5 border-b border-chalk bg-paper/60 px-2 py-1.5"
    >
      {/* Kelompok 1 — bentuk huruf */}
      <ToolButton
        label="Tebal"
        shortcut="Ctrl+B"
        icon="bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolButton
        label="Miring"
        shortcut="Ctrl+I"
        icon="italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolButton
        label="Coret"
        icon="strike"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <Divider />

      {/* Kelompok 2 — tingkat judul */}
      <ToolButton
        label="Judul bagian"
        icon="h2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        label="Sub-judul"
        icon="h3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <ToolButton
        label="Teks biasa"
        icon="paragraph"
        active={editor.isActive("paragraph")}
        onClick={() => editor.chain().focus().setParagraph().run()}
      />

      <Divider />

      {/* Kelompok 3 — daftar */}
      <ToolButton
        label="Daftar berbutir"
        icon="bullet"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolButton
        label="Daftar bernomor"
        icon="ordered"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />

      <Divider />

      {/* Kelompok 4 — blok & tautan */}
      <ToolButton
        label="Kutipan"
        icon="quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      />
      <ToolButton
        label={editor.isActive("link") ? "Ubah tautan" : "Tambah tautan"}
        icon="code"
        active={editor.isActive("link")}
        onClick={onSetLink}
      />
      <ToolButton
        label="Hapus tautan"
        icon="unlink"
        disabled={!editor.isActive("link")}
        onClick={() => editor.chain().focus().unsetLink().run()}
      />
      <ToolButton
        label="Garis pemisah"
        icon="rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      />

      {/* Kelompok 5 — riwayat, didorong ke kanan */}
      <span className="ml-auto" />
      <ToolButton
        label="Batalkan"
        shortcut="Ctrl+Z"
        icon="undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolButton
        label="Ulangi"
        shortcut="Ctrl+Shift+Z"
        icon="redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

/**
 * Baris keterangan bawah editor: jumlah kata & petunjuk singkat.
 *
 * Ditampilkan karena penulis berita sekolah sering tidak tahu panjang ideal
 * sebuah berita — angka kata memberi isyarat tanpa memaksa.
 */
function Footer({ editor }: { editor: Editor }) {
  const text = editor.getText().trim();
  const words = text ? text.split(/\s+/).length : 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-chalk bg-paper/60 px-3 py-1.5">
      <span className="text-[11px] text-slate">
        Enter dua kali untuk paragraf baru · pilih teks lalu klik ikon tautan
      </span>
      <span className="font-mono text-[11px] tabular-nums text-slate">
        {words} kata
      </span>
    </div>
  );
}
