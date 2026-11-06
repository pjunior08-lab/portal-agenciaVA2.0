"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Heading2, Heading3, Italic, List, ListOrdered, Quote, Redo2, Undo2, Braces } from "lucide-react";
import { cn } from "@/lib/utils";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./menu";

/**
 * Editor de texto rico (Tiptap). Guarda HTML simples; o servidor limpa o HTML ao salvar.
 * `variables` mostra o botão "Variável", que insere {{chave}} no ponto do cursor.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  variables,
  minHeight = 160,
  disabled = false,
  label,
  className,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  variables?: { key: string; label: string }[];
  minHeight?: number;
  disabled?: boolean;
  /** nome acessível do campo */
  label: string;
  className?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, code: false, link: false }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "rich-text min-h-[var(--rte-min)] px-3.5 py-3 text-sm outline-none",
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  // valor trocado por fora (ex.: aplicar modelo)
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) editor.commands.setContent(value || "", { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div
      className={cn("overflow-hidden rounded-xl border border-transparent bg-surface-2 focus-within:border-brand focus-within:bg-surface", disabled && "opacity-70", className)}
      style={{ ["--rte-min" as string]: `${minHeight}px` }}
    >
      {!disabled && <Toolbar editor={editor} variables={variables} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor, variables }: { editor: Editor | null; variables?: { key: string; label: string }[] }) {
  if (!editor) return <div className="h-9 border-b border-line" />;
  const btn = (active: boolean, onClick: () => void, label: string, Icon: typeof Bold) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn("inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-3 hover:text-ink", active && "bg-surface-3 text-ink")}
    >
      <Icon className="size-3.5" />
    </button>
  );
  const chain = () => editor.chain().focus();
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line px-1.5 py-1" role="toolbar" aria-label="Formatação">
      {btn(editor.isActive("bold"), () => chain().toggleBold().run(), "Negrito", Bold)}
      {btn(editor.isActive("italic"), () => chain().toggleItalic().run(), "Itálico", Italic)}
      {btn(editor.isActive("heading", { level: 2 }), () => chain().toggleHeading({ level: 2 }).run(), "Título", Heading2)}
      {btn(editor.isActive("heading", { level: 3 }), () => chain().toggleHeading({ level: 3 }).run(), "Subtítulo", Heading3)}
      {btn(editor.isActive("bulletList"), () => chain().toggleBulletList().run(), "Lista", List)}
      {btn(editor.isActive("orderedList"), () => chain().toggleOrderedList().run(), "Lista numerada", ListOrdered)}
      {btn(editor.isActive("blockquote"), () => chain().toggleBlockquote().run(), "Citação", Quote)}
      <span className="mx-1 h-4 w-px bg-line" aria-hidden />
      {btn(false, () => chain().undo().run(), "Desfazer", Undo2)}
      {btn(false, () => chain().redo().run(), "Refazer", Redo2)}
      {variables && variables.length > 0 && (
        <Menu>
          <MenuTrigger asChild>
            <button type="button" className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-3 hover:text-ink">
              <Braces className="size-3.5" aria-hidden /> Variável
            </button>
          </MenuTrigger>
          <MenuContent align="end" className="max-h-72 overflow-y-auto">
            {variables.map((v) => (
              <MenuItem key={v.key} onSelect={() => chain().insertContent(`{{${v.key}}}`).run()}>
                <span className="flex flex-col">
                  <span>{v.label}</span>
                  <span className="font-mono text-[10px] text-muted">{`{{${v.key}}}`}</span>
                </span>
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      )}
    </div>
  );
}
