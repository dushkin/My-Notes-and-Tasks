// src/components/TipTapEditor.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image"; // TipTap's Image extension
import TextStyle from "@tiptap/extension-text-style";
import { Extension } from "@tiptap/core";
import FontFamily from "@tiptap/extension-font-family";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
// TextSelection might not be explicitly needed in paste handlers if TipTap handles inline insertion well
// import { TextSelection } from '@tiptap/pm/state';

import {
  Undo,
  Redo,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  List as UnorderedListIcon,
  ListOrdered as OrderedListIcon,
  Link as LinkIcon,
  Code as CodeIcon,
  SquareCode as CodeBlockIcon,
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Image as ImageIconLucide,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";
const FONT_FAMILIES = [
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
];
const FONT_SIZE_OPTIONS = [
  { label: "Small", value: "0.8em" }, // Using relative units for inline
  { label: "Normal", value: "1em" },
  { label: "Large", value: "1.2em" },
  { label: "Extra Large", value: "1.5em" },
];

const FontSizeExtension = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) =>
              element.style.fontSize?.replace(/['"]+/g, ""),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

const uploadImageToServer = async (file) => {
  const formData = new FormData();
  formData.append("image", file);
  try {
    const token = localStorage.getItem("userToken");
    const response = await fetch(`${API_BASE_URL}/images/upload`, {
      method: "POST",
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Upload failed, server error." }));
      throw new Error(
        errorData.message || `HTTP error! status: ${response.status}`
      );
    }
    const data = await response.json();
    return data.url || null;
  } catch (error) {
    console.error("Image upload error:", error);
    alert(`Image upload failed: ${error.message}`);
    return null;
  }
};

const TipTapEditor = ({ content, onChange, defaultFontFamily }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { languageClassPrefix: "language-" },
      }),
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      }),
      Image.configure({
        inline: true, // <<<<<<< CHANGED TO TRUE for inline images
        allowBase64: false,
        HTMLAttributes: {
          // Style for inline images: adjust max-height as needed
          style:
            "display: inline-block; max-height: 2em; vertical-align: middle; margin: 0 0.2em; max-width: 100%;",
          // class: 'tiptap-inline-image', // Optional: for CSS targeting
        },
      }),
      TextStyle,
      FontFamily.configure({ types: ["textStyle"] }),
      FontSizeExtension,
      Placeholder.configure({
        placeholder:
          "Start typing, paste an image, or click the image icon to upload...",
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }), // TextAlign typically applies to block nodes
    ],
    content: content, // Initial content for this instance
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML()); // Propagate changes upwards
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-base md:prose-sm dark:prose-invert max-w-none focus:outline-none p-3",
      },
      handleDrop: (view, event, slice, moved) => {
        if (
          !moved &&
          event.dataTransfer &&
          event.dataTransfer.files &&
          event.dataTransfer.files.length
        ) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            uploadImageToServer(file).then((url) => {
              if (url && view.editable) {
                const { schema, tr } = view.state;
                const coordinates = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                });
                if (coordinates) {
                  const imageNode = schema.nodes.image.create({ src: url });
                  tr.insert(coordinates.pos, imageNode);
                  view.dispatch(tr);
                  view.focus();
                }
              }
            });
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event, slice) => {
        if (
          event.clipboardData &&
          event.clipboardData.files &&
          event.clipboardData.files.length
        ) {
          const file = event.clipboardData.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            uploadImageToServer(file).then((url) => {
              if (url && view.editable) {
                const { schema, tr } = view.state;
                const imageNode = schema.nodes.image.create({ src: url });
                tr.replaceSelectionWith(imageNode);
                view.dispatch(tr);
                view.focus();
              }
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  // This useEffect is now primarily for when the editor instance itself is created/destroyed
  // or if external (non-user-edit) changes to 'content' prop were to be handled directly,
  // but ContentEditor now controls re-initialization via the 'key' prop.
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // This might still be needed if `item.content` is updated externally (e.g. by app-level undo)
      // while the same item is being edited.
      editor.commands.setContent(content, false);
    }
    // If you want to reset lastContentEmittedRef when editor is re-initialized for a new item:
    // return () => { lastContentEmittedRef.current = ""; } // Or initial content of new item
  }, [content, editor]); // Runs when `content` prop or `editor` instance changes

  const [editorDir, setEditorDir] = useState("ltr");
  const toggleEditorDirection = () =>
    setEditorDir((prev) => (prev === "ltr" ? "rtl" : "ltr"));

  useEffect(() => {
    if (editor?.view.dom) {
      editor.view.dom.setAttribute("dir", editorDir);
    }
  }, [editorDir, editor]);

  const addImageFromFilePicker = useCallback(() => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      if (input.files && input.files.length) {
        const file = input.files[0];
        const url = await uploadImageToServer(file);
        if (url) {
          editor.chain().focus().setImage({ src: url }).run(); // TipTap's setImage command
        }
      }
    };
    input.click();
  }, [editor]);

  const handleFontSizeChange = (e) => {
    const size = e.target.value;
    if (size) {
      editor.chain().focus().setFontSize(size).run();
    } else {
      editor.chain().focus().unsetFontSize().run();
    }
    e.target.value =
      FONT_SIZE_OPTIONS.find(
        (opt) => opt.value === editor.getAttributes("textStyle").fontSize
      )?.value || "";
  };

  if (!editor) {
    return <div className="p-4 text-zinc-500">Loading editor...</div>;
  }

  return (
    <div className="flex flex-col flex-grow overflow-hidden border rounded bg-white dark:bg-zinc-900 dark:border-zinc-700">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 p-2 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
        {/* ... Toolbar buttons ... */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          title="Undo"
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-50"
        >
          {" "}
          <Undo className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          title="Redo"
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-50"
        >
          {" "}
          <Redo className="w-5 h-5" />{" "}
        </button>
        <select
          title="Text Style"
          className="p-1.5 text-sm border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          onChange={(e) => {
            const value = e.target.value;
            if (value === "p") editor.chain().focus().setParagraph().run();
            else if (value.startsWith("h"))
              editor
                .chain()
                .focus()
                .toggleHeading({ level: parseInt(value.substring(1)) })
                .run();
            e.target.value = "";
          }}
          value=""
        >
          <option value="" disabled>
            Style
          </option>{" "}
          <option value="p">Paragraph</option> <option value="h1">H1</option>{" "}
          <option value="h2">H2</option> <option value="h3">H3</option>
        </select>
        <select
          title="Font Family"
          className="p-1.5 text-sm border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={
            editor.getAttributes("textStyle").fontFamily ||
            defaultFontFamily ||
            ""
          }
          onChange={(e) =>
            editor
              .chain()
              .focus()
              .setFontFamily(e.target.value || FONT_FAMILIES[0])
              .run()
          }
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          title="Font Size"
          className="p-1.5 text-sm border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={editor.getAttributes("textStyle").fontSize || ""}
          onChange={handleFontSizeChange}
        >
          <option value="">Default Size</option>
          {FONT_SIZE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded ${
            editor.isActive("bold") ? "bg-zinc-200 dark:bg-zinc-600" : ""
          }`}
        >
          {" "}
          <BoldIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded ${
            editor.isActive("italic") ? "bg-zinc-200 dark:bg-zinc-600" : ""
          }`}
        >
          {" "}
          <ItalicIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded ${
            editor.isActive("underline") ? "bg-zinc-200 dark:bg-zinc-600" : ""
          }`}
        >
          {" "}
          <UnderlineIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => {
            const url = window.prompt("Enter URL:");
            if (url)
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: url })
                .run();
          }}
          title="Set Link"
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded ${
            editor.isActive("link") ? "bg-zinc-200 dark:bg-zinc-600" : ""
          }`}
        >
          {" "}
          <LinkIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={addImageFromFilePicker}
          title="Upload Image"
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          {" "}
          <ImageIconLucide className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline Code"
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded ${
            editor.isActive("code") ? "bg-zinc-200 dark:bg-zinc-600" : ""
          }`}
        >
          {" "}
          <CodeIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code Block"
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded ${
            editor.isActive("codeBlock") ? "bg-zinc-200 dark:bg-zinc-600" : ""
          }`}
        >
          {" "}
          <CodeBlockIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bulleted List"
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded ${
            editor.isActive("bulletList") ? "bg-zinc-200 dark:bg-zinc-600" : ""
          }`}
        >
          {" "}
          <UnorderedListIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded ${
            editor.isActive("orderedList") ? "bg-zinc-200 dark:bg-zinc-600" : ""
          }`}
        >
          {" "}
          <OrderedListIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Align Left"
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded ${
            editor.isActive({ textAlign: "left" })
              ? "bg-zinc-200 dark:bg-zinc-600"
              : ""
          }`}
        >
          {" "}
          <AlignLeft className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Align Center"
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded ${
            editor.isActive({ textAlign: "center" })
              ? "bg-zinc-200 dark:bg-zinc-600"
              : ""
          }`}
        >
          {" "}
          <AlignCenter className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Align Right"
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded ${
            editor.isActive({ textAlign: "right" })
              ? "bg-zinc-200 dark:bg-zinc-600"
              : ""
          }`}
        >
          {" "}
          <AlignRight className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={toggleEditorDirection}
          title={`Text Direction: ${editorDir.toUpperCase()}`}
          className={`p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded`}
        >
          {" "}
          <Type className="w-5 h-5" /> {editorDir.toUpperCase()}{" "}
        </button>
      </div>
      <div className="flex-grow overflow-auto tiptap-editor-content-area">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
};

export default TipTapEditor;
