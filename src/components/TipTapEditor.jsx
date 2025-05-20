// src/components/TipTapEditor.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";

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
  Type, // For LTR/RTL toggle
  Image as ImageIconLucide, // For a dedicated image upload button
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api"; // Or your actual API base

const FONT_FAMILIES = [
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
];

// This is the function that will handle image uploads
const uploadImageToServer = async (file) => {
  const formData = new FormData();
  formData.append("image", file); // 'image' should match your backend's expected field name

  try {
    const token = localStorage.getItem("userToken"); // Get auth token if your endpoint is protected
    const response = await fetch(`${API_BASE_URL}/images/upload`, {
      // Ensure this endpoint exists on your backend
      method: "POST",
      headers: {
        // 'Content-Type': 'multipart/form-data' is automatically set by browser for FormData
        ...(token && { Authorization: `Bearer ${token}` }), // Add auth header if needed
      },
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
    if (data.url) {
      return data.url; // Backend should return { url: "..." }
    } else {
      throw new Error("Server did not return an image URL.");
    }
  } catch (error) {
    console.error("Image upload error:", error);
    alert(`Image upload failed: ${error.message}`); // Notify user
    return null; // Indicate failure
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
        inline: false,
        allowBase64: false, // [IMPORTANT] Disable Base64 embedding
        HTMLAttributes: {
          style:
            "max-width: 100%; height: auto; display: block; margin: 10px 0;",
        },
      }),
      TextStyle,
      FontFamily.configure({ types: ["textStyle"] }),
      Placeholder.configure({
        placeholder:
          "Start typing, paste an image, or click the image icon to upload...",
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: content,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-base md:prose-sm dark:prose-invert max-w-none focus:outline-none p-3", // Added p-3 for padding
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
              if (url) {
                const { schema } = view.state;
                const coordinates = view.posAtCoords({
                  left: event.clientX,
                  top: event.clientY,
                });
                if (coordinates) {
                  const node = schema.nodes.image.create({ src: url });
                  const transaction = view.state.tr.insert(
                    coordinates.pos,
                    node
                  );
                  view.dispatch(transaction);
                }
              }
            });
            return true; // We handled the drop
          }
        }
        return false; // Let TipTap handle other drops
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
              if (url) {
                const { schema } = view.state;
                const node = schema.nodes.image.create({ src: url });
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
              }
            });
            return true; // We handled the paste
          }
        }
        return false; // Let TipTap handle other pastes
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

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
          editor.chain().focus().setImage({ src: url }).run();
        }
      }
    };
    input.click();
  }, [editor]);

  if (!editor) {
    return <div className="p-4 text-zinc-500">Loading editor...</div>;
  }

  return (
    <div className="flex flex-col flex-grow overflow-hidden border rounded bg-white dark:bg-zinc-900 dark:border-zinc-700">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 p-2 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
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
          </option>
          <option value="p">Paragraph</option>
          <option value="h1">H1</option>
          <option value="h2">H2</option>
          <option value="h3">H3</option>
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
