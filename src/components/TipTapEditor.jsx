import React, { useEffect, useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { DOMParser } from "prosemirror-model";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import ResizableImageNodeView from "./ResizableImageNodeView";
import TextStyle from "@tiptap/extension-text-style";
import { Extension } from "@tiptap/core";
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type,
  Image as ImageIconLucide,
} from "lucide-react";
import { marked } from "marked";
import { authFetch } from "../services/apiClient";

const FONT_FAMILIES = [
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
];
const FONT_SIZE_OPTIONS = [
  { label: "Small", value: "0.8em" },
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
    const response = await authFetch(`/images/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Upload failed, server error." }));
      console.error("[TipTap] Upload failed:", errorData);
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

const TipTapEditor = ({
  content,
  initialDirection,
  onUpdate,
  onFocus,
  onBlur,
  defaultFontFamily,
  showToolbar, // Ensure this prop is included
}) => {
  const [editorDir, setEditorDir] = useState(initialDirection || "ltr");
  const contentSetRef = useRef(false);
  const isInitializedRef = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { languageClassPrefix: "language-" },
      }),
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: true,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer nofollow",
        },
      }),
      Image.extend({
        name: "resizableImage",
        group: "inline",
        inline: true,
        draggable: true,

        addAttributes() {
          return {
            ...this.parent?.(),
            src: {
              default: null,
              parseHTML: (element) => element.getAttribute("src"),
            },
            alt: {
              default: null,
              parseHTML: (element) => element.getAttribute("alt"),
            },
            title: {
              default: null,
              parseHTML: (element) => element.getAttribute("title"),
            },
            width: {
              default: null,
              parseHTML: (element) =>
                element.style.width || element.getAttribute("width"),
              renderHTML: (attributes) => {
                const width = String(attributes.width || "auto").trim();
                if (width === "auto" || !width || width === "null") {
                  return { style: "width: auto; max-width: 100%;" };
                }
                if (/^\d+(\.\d+)?(px|%)?$/.test(width)) {
                  return { style: `width: ${width}; max-width: 100%;` };
                }
                return { style: "width: auto; max-width: 100%;" };
              },
            },
          };
        },

        addNodeView() {
          return ({ node, editor, getPos, HTMLAttributes }) => {
            return new ResizableImageNodeView(
              node,
              editor.view,
              getPos,
              HTMLAttributes
            );
          };
        },
      }).configure({
        allowBase64: false,
        HTMLAttributes: {
          class: "tiptap-image-node",
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
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],

    content: content || "",

    onUpdate: ({ editor: currentEditor }) => {
      if (onUpdate && isInitializedRef.current) {
        const newContent = currentEditor.getHTML();
        onUpdate(newContent, editorDir);
      }
    },

    onFocus: () => {
      if (onFocus) {
        onFocus();
      }
    },

    onBlur: () => {
      if (onBlur) {
        onBlur();
      }
    },

    editorProps: {
      handleKeyDown: (view, event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          const { state, dispatch } = view;
          dispatch(state.tr.insertText("\t"));
          return true;
        }
        return false;
      },

      attributes: {
        class:
          "prose prose-base md:prose-sm dark:prose-invert max-w-none focus:outline-none p-3",
        dir: editorDir,
      },

      handlePaste: (view, event, slice) => {
        const items = event.clipboardData?.items;

        if (items) {
          for (let i = 0; i < items.length; i++) {
            const clipboardItem = items[i];
            if (
              clipboardItem.type.startsWith("image/") &&
              clipboardItem.kind === "file"
            ) {
              event.preventDefault();
              const file = clipboardItem.getAsFile();
              if (file) {
                handleImageUpload(file, view);
              }
              return true;
            }
          }
        }

        const text = event.clipboardData?.getData("text/plain");
        const html = event.clipboardData?.getData("text/html");

        const commonMarkdownPatterns =
          /^(?:#+\s|\*\s|-\s|>\s|```|$$ .* $$$$ .* $$|`[^`]+`|\d+\.\s)/m;

        if (
          html &&
          text &&
          !commonMarkdownPatterns.test(text.substring(0, 250))
        ) {
          console.log("[TipTapEditor] Using default HTML paste handling");
          return false;
        }

        if (text && commonMarkdownPatterns.test(text)) {
          try {
            const renderer = new marked.Renderer();
            renderer.image = () => "";
            const markdownHtml = marked.parse(text.trim(), { renderer });
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = markdownHtml;
            const prosemirrorSlice = DOMParser.fromSchema(
              view.state.schema
            ).parseSlice(tempDiv, {});
            view.dispatch(view.state.tr.replaceSelection(prosemirrorSlice));
            return true;
          } catch (e) {
            console.error("Error parsing pasted markdown:", e);
            return false;
          }
        }

        console.log("[TipTapEditor] Using default text paste handling");
        return false;
      },

      handleDrop: async function (view, event, slice, moved) {
        if (
          !moved &&
          event.dataTransfer &&
          event.dataTransfer.files &&
          event.dataTransfer.files.length
        ) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            await handleImageUpload(file, view, event);
            return true;
          }
        }
        return false;
      },
    },
  });

  const handleImageUpload = async (file, view, event = null) => {
    try {
      const url = await uploadImageToServer(file);
      if (url && view && view.editable) {
        const img = new window.Image();
        img.onload = () => {
          const { naturalWidth } = img;
          const { schema } = view.state;

          let insertPos;
          if (event) {
            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            insertPos = coordinates?.pos;
          } else {
            insertPos = view.state.selection.from;
          }

          if (insertPos !== undefined) {
            const imageNode = schema.nodes.resizableImage.create({
              src: url,
              width: `${naturalWidth}px`,
            });
            const tr = view.state.tr.insert(insertPos, imageNode);
            const spaceNode = schema.text(" ");
            tr.insert(insertPos + imageNode.nodeSize, spaceNode);
            view.dispatch(tr);
            view.focus();
          }
        };

        img.onerror = () => {
          const { schema } = view.state;
          let insertPos;

          if (event) {
            const coordinates = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            insertPos = coordinates?.pos;
          } else {
            insertPos = view.state.selection.from;
          }

          if (insertPos !== undefined) {
            const imageNode = schema.nodes.resizableImage.create({
              src: url,
              width: "300px",
            });
            const tr = view.state.tr.insert(insertPos, imageNode);
            const spaceNode = schema.text(" ");
            tr.insert(insertPos + imageNode.nodeSize, spaceNode);
            view.dispatch(tr);
            view.focus();
          }
        };

        img.src = url;
      }
    } catch (err) {
      console.error("[TipTap] Error processing image:", err);
    }
  };

  useEffect(() => {
    if (editor && !contentSetRef.current) {
      if (content !== editor.getHTML()) {
        editor.commands.setContent(content || "", false);
      }

      contentSetRef.current = true;

      setTimeout(() => {
        isInitializedRef.current = true;
      }, 100);
    }
  }, [content, editor]);

  useEffect(() => {
    if (
      editor &&
      initialDirection &&
      initialDirection !== editor.view.dom.getAttribute("dir")
    ) {
      setEditorDir(initialDirection);
      editor.view.dom.setAttribute("dir", initialDirection);
    }
  }, [initialDirection, editor]);

  useEffect(() => {
    contentSetRef.current = false;
    isInitializedRef.current = false;
  }, [content]);

  const toggleEditorDirection = useCallback(() => {
    if (!editor) return;
    const newDir = editorDir === "ltr" ? "rtl" : "ltr";
    setEditorDir(newDir);
    editor.view.dom.setAttribute("dir", newDir);
    if (onUpdate && isInitializedRef.current) {
      onUpdate(editor.getHTML(), newDir);
    }
  }, [editor, editorDir, onUpdate]);

  const addImageFromFilePicker = useCallback(async () => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      if (input.files && input.files.length) {
        const file = input.files[0];
        await handleImageUpload(file, editor.view);
      }
    };
    input.click();
  }, [editor]);

  const handleFontSizeChange = (e) => {
    if (!editor) return;
    const size = e.target.value;
    if (size) {
      editor.chain().focus().setFontSize(size).run();
    } else {
      editor.chain().focus().unsetFontSize().run();
    }
    e.target.value = editor.getAttributes("textStyle").fontSize || "";
  };

  if (!editor) {
    return <div className="p-4 text-zinc-500">Loading editor...</div>;
  }

  const buttonBaseClass =
    "p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded disabled:opacity-50 focus:ring-1 focus:ring-blue-400";

  return (
    <div className="flex flex-col flex-grow overflow-hidden border rounded bg-white dark:bg-zinc-900 dark:border-zinc-700">
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 p-2 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
          <button
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            title="Undo"
            className={buttonBaseClass}
          >
            <Undo className="w-5 h-5" />
          </button>
          <button
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            title="Redo"
            className={buttonBaseClass}
          >
            <Redo className="w-5 h-5" />
          </button>
          <select
            title="Text Style"
            className="p-1.5 text-sm border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            onChange={(e) => {
              if (!editor) return;
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
            onChange={(e) => {
              if (!editor) return;
              editor
                .chain()
                .focus()
                .setFontFamily(e.target.value || FONT_FAMILIES[0])
                .run();
            }}
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
            className={`${buttonBaseClass} ${
              editor.isActive("bold") ? "bg-zinc-200 dark:bg-zinc-600" : ""
            }`}
          >
            <BoldIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
            className={`${buttonBaseClass} ${
              editor.isActive("italic") ? "bg-zinc-200 dark:bg-zinc-600" : ""
            }`}
          >
            <ItalicIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
            className={`${buttonBaseClass} ${
              editor.isActive("underline") ? "bg-zinc-200 dark:bg-zinc-600" : ""
            }`}
          >
            <UnderlineIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (!editor) return;
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
            className={`${buttonBaseClass} ${
              editor.isActive("link") ? "bg-zinc-200 dark:bg-zinc-600" : ""
            }`}
          >
            <LinkIcon className="w-5 h-5" />
          </button>
          <button
            onClick={addImageFromFilePicker}
            title="Upload Image"
            className={buttonBaseClass}
          >
            <ImageIconLucide className="w-5 h-5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Inline Code"
            className={`${buttonBaseClass} ${
              editor.isActive("code") ? "bg-zinc-200 dark:bg-zinc-600" : ""
            }`}
          >
            <CodeIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code Block"
            className={`${buttonBaseClass} ${
              editor.isActive("codeBlock") ? "bg-zinc-200 dark:bg-zinc-600" : ""
            }`}
          >
            <CodeBlockIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bulleted List"
            className={`${buttonBaseClass} ${
              editor.isActive("bulletList")
                ? "bg-zinc-200 dark:bg-zinc-600"
                : ""
            }`}
          >
            <UnorderedListIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
            className={`${buttonBaseClass} ${
              editor.isActive("orderedList")
                ? "bg-zinc-200 dark:bg-zinc-600"
                : ""
            }`}
          >
            <OrderedListIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            title="Align Left"
            className={`${buttonBaseClass} ${
              editor.isActive({ textAlign: "left" })
                ? "bg-zinc-200 dark:bg-zinc-600"
                : ""
            }`}
          >
            <AlignLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            title="Align Center"
            className={`${buttonBaseClass} ${
              editor.isActive({ textAlign: "center" })
                ? "bg-zinc-200 dark:bg-zinc-600"
                : ""
            }`}
          >
            <AlignCenter className="w-5 h-5" />
          </button>
          <button
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            title="Align Right"
            className={`${buttonBaseClass} ${
              editor.isActive({ textAlign: "right" })
                ? "bg-zinc-200 dark:bg-zinc-600"
                : ""
            }`}
          >
            <AlignRight className="w-5 h-5" />
          </button>
          <button
            onClick={toggleEditorDirection}
            title={`Text Direction: ${editorDir.toUpperCase()}`}
            className={buttonBaseClass}
          >
            <Type className="w-5 h-5" /> {editorDir.toUpperCase()}
          </button>
          <button
            onClick={() => {
              if (!editor) return;
              const selection = editor.state.selection;
              let selectedText = editor.state.doc.textBetween(
                selection.from,
                selection.to,
                "\n"
              );
              if (selectedText.trim()) {
                try {
                  const cleanedText = selectedText
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0)
                    .join("\n");
                  if (!cleanedText) {
                    alert("Selection is empty after cleanup.");
                    return;
                  }
                  const renderer = new marked.Renderer();
                  renderer.image = () => "";
                  const html = marked.parse(cleanedText, { renderer });
                  editor
                    .chain()
                    .focus()
                    .deleteSelection()
                    .insertContent(html, {
                      parseOptions: { preserveWhitespace: false },
                    })
                    .run();
                } catch (e) {
                  console.error("Error parsing selected markdown", e);
                  alert("Could not parse selected text as Markdown.");
                }
              } else {
                alert("Please select some text to convert from Markdown.");
              }
            }}
            title="Convert selected text from Markdown"
            className={buttonBaseClass}
          >
            MD
          </button>
        </div>
      )}
      <div className="flex-grow overflow-auto tiptap-editor-content-area">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
};

export default TipTapEditor;
