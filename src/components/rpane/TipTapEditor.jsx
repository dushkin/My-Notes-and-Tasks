import React, { useEffect, useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { DOMParser } from "prosemirror-model";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import ResizableImageNodeView from "../ResizableImageNodeView.js";
import TextStyle from "@tiptap/extension-text-style";
import { Extension } from "@tiptap/core";
import FontFamily from "@tiptap/extension-font-family";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";
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
import { authFetch } from "../../services/apiClient";
import { isRTLText } from "../../utils/rtlUtils";
import AutoRTLAlignment from "../extensions/AutoRTLAlignment";

// Decode HTML entities if they exist
const decodeHtmlEntities = (str) => {
  if (!str || typeof str !== 'string') return str;
  
  // Check if the string contains HTML entities
  if (str.includes('&lt;') || str.includes('&gt;') || str.includes('&amp;')) {
    // Create a temporary DOM element to decode
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
  }
  
  return str;
};

// Safe content conversion that prevents [object Object]
const safeStringify = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    // Decode HTML entities if present
    return decodeHtmlEntities(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    // Handle the specific case where content data is passed as an object
    if (value.content && typeof value.content === 'string') {
      console.warn('⚠️ Extracting content from object:', value);
      return decodeHtmlEntities(value.content);
    }
    console.warn('⚠️ Attempted to stringify object as content:', value);
    return '';
  }
  return String(value);
};

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
  console.log("[TipTap] Uploading image to server:", { fileName: file.name, fileSize: file.size });
  
  const formData = new FormData();
  formData.append("image", file);
  
  try {
    const response = await authFetch(`/images/upload`, {
      method: "POST",
      body: formData,
    });

    console.log("[TipTap] Upload response status:", response.status);

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
    console.log("[TipTap] Upload response data:", data);
    
    if (!data.url) {
      throw new Error("Server response did not include image URL");
    }
    
    return data.url;
  } catch (error) {
    console.error("Image upload error:", error);
    throw error; // Re-throw the error instead of returning null
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
  dir, // Add dir prop for direction control
}) => {
  const [editorDir, setEditorDir] = useState(initialDirection || dir || "ltr");
  const contentSetRef = useRef(false);
  const isInitializedRef = useRef(false);
  
  // Debug content prop changes
  useEffect(() => {
    console.log('🎨 TipTap received content prop:', {
      contentType: typeof content,
      contentValue: content,
      contentPreview: typeof content === 'string' ? content.substring(0, 100) : 'NON-STRING'
    });
  }, [content]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // We'll configure our own heading extension
        paragraph: false, // We'll configure our own paragraph extension
        codeBlock: { languageClassPrefix: "language-" },
      }),
      // Custom paragraph extension with dir support
      Paragraph.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            dir: {
              default: null,
              parseHTML: element => element.getAttribute('dir'),
              renderHTML: attributes => {
                if (!attributes.dir) return {};
                return { dir: attributes.dir };
              },
            },
          };
        },
      }),
      // Custom heading extension with dir support
      Heading.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            dir: {
              default: null,
              parseHTML: element => element.getAttribute('dir'),
              renderHTML: attributes => {
                if (!attributes.dir) return {};
                return { dir: attributes.dir };
              },
            },
          };
        },
      }).configure({
        levels: [1, 2, 3],
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
        selectable: true,
        atom: true,

        addAttributes() {
          return {
            src: {
              default: null,
              parseHTML: (element) => element.getAttribute("src"),
              renderHTML: (attributes) => {
                if (!attributes.src) return {};
                return { src: attributes.src };
              },
            },
            alt: {
              default: null,
              parseHTML: (element) => element.getAttribute("alt"),
              renderHTML: (attributes) => {
                if (!attributes.alt) return {};
                return { alt: attributes.alt };
              },
            },
            title: {
              default: null,
              parseHTML: (element) => element.getAttribute("title"),
              renderHTML: (attributes) => {
                if (!attributes.title) return {};
                return { title: attributes.title };
              },
            },
            width: {
              default: "auto",
              parseHTML: (element) =>
                element.style.width || element.getAttribute("width") || "auto",
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
            crossorigin: {
              default: null,
              parseHTML: (element) => element.getAttribute("crossorigin"),
              renderHTML: (attributes) => {
                if (!attributes.crossorigin) return {};
                return { crossorigin: attributes.crossorigin };
              },
            },
          };
        },

        parseHTML() {
          return [
            {
              tag: 'img[src]',
              getAttrs: (dom) => ({
                src: dom.getAttribute('src'),
                alt: dom.getAttribute('alt'),
                title: dom.getAttribute('title'),
                width: dom.style.width || dom.getAttribute('width') || 'auto',
                crossorigin: dom.getAttribute('crossorigin'),
              }),
            },
          ];
        },

        renderHTML({ HTMLAttributes }) {
          return ['img', HTMLAttributes];
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

        addCommands() {
          return {
            setImage: (options) => ({ commands }) => {
              return commands.insertContent({
                type: this.name,
                attrs: options,
              });
            },
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
      AutoRTLAlignment.configure({ types: ["paragraph", "heading"] }),
    ],

    content: safeStringify(content),

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
          `prose prose-base md:prose-sm dark:prose-invert max-w-none focus:outline-none p-3 ${editorDir === 'rtl' ? 'text-right' : 'text-left'}`,
        dir: editorDir,
      },

      handlePaste: (view, event, slice) => {
        // Immediate check for file paths in text to prevent them from appearing
        const text = event.clipboardData?.getData("text/plain");
        const filePathPattern = /^[a-zA-Z]:[\\\/].*\.(png|jpg|jpeg|gif|bmp|webp)$/i;
        
        if (text && filePathPattern.test(text.trim())) {
          console.log("[TipTap] Blocking file path paste:", text.trim());
          event.preventDefault();
          event.stopPropagation();
          return true; // Block this paste completely
        }
        
        const items = event.clipboardData?.items;
        
        if (items) {
          // Look for any image items (including screenshots)
          for (let i = 0; i < items.length; i++) {
            const clipboardItem = items[i];
            
            // Check for any image type
            if (clipboardItem.type.startsWith("image/")) {
              console.log("[TipTap] Image detected, processing...");
              event.preventDefault();
              event.stopPropagation();
              
              const file = clipboardItem.getAsFile();
              if (file) {
                handleImageUpload(file, view, null);
                return true;
              }
            }
          }
        }

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

  const convertFileToDataURL = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (file, view, event = null) => {
    console.log("[TipTap] Starting image upload:", { fileName: file.name, fileSize: file.size, fileType: file.type });
    
    try {
      if (!file.type.startsWith('image/')) {
        console.error("[TipTap] Invalid file type:", file.type);
        alert("Please select a valid image file.");
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        console.error("[TipTap] File too large:", file.size);
        alert("Image file is too large. Please select an image smaller than 10MB.");
        return;
      }

      const { schema } = view.state;

      // Check if schema has the resizableImage node
      if (!schema.nodes.resizableImage) {
        console.error("[TipTap] resizableImage node not found in schema. Available nodes:", Object.keys(schema.nodes));
        alert("Image extension not properly configured.");
        return;
      }

      // For paste events, always use current selection
      // For drag events, we could use coordinates, but selection is more reliable
      const { selection } = view.state;
      console.log("[TipTap] Using current selection for insertion:", selection.from, "to:", selection.to);
      
      try {
        // For smaller images (< 1MB), use data URL to avoid CORS issues
        // For larger images, still try server upload
        let imageSrc;
        
        if (file.size < 1024 * 1024) { // 1MB limit for data URLs
          console.log("[TipTap] Converting to data URL to avoid CORS");
          imageSrc = await convertFileToDataURL(file);
          console.log("[TipTap] Data URL created, length:", imageSrc.length);
        } else {
          console.log("[TipTap] File too large for data URL, uploading to server");
          imageSrc = await uploadImageToServer(file);
          console.log("[TipTap] Upload successful, URL:", imageSrc);
        }
        
        // Create image node with data URL or server URL
        const imageNode = schema.nodes.resizableImage.create({
          src: imageSrc,
          width: "auto",
          alt: file.name
        });
        
        // Use the current selection for insertion
        const tr = view.state.tr;
        
        // Insert the image at the current position
        tr.replaceSelectionWith(imageNode);
        
        view.dispatch(tr);
        view.focus();
        
        console.log("[TipTap] Image inserted successfully at selection:", selection.from, "to:", selection.to);
      } catch (nodeError) {
        console.error("[TipTap] Error creating image node:", nodeError);
        alert("Failed to insert image into editor.");
      }
    } catch (err) {
      console.error("[TipTap] Error processing image:", err);
      alert(`Image upload failed: ${err.message}`);
    }
  };


  useEffect(() => {
    if (editor && !contentSetRef.current) {
      const safeContent = safeStringify(content);
      const currentHTML = editor.getHTML();
      
      console.log('🔄 TipTap setting content:', {
        contentToSet: safeContent,
        currentHTML: currentHTML,
        contentType: typeof content,
        areEqual: safeContent === currentHTML
      });
      
      if (safeContent !== currentHTML) {
        console.log('🔄 TipTap setting HTML content:', safeContent);
        editor.commands.setContent(safeContent, true); // true = parse as HTML
        
        // Trigger RTL alignment processing after content is set
        setTimeout(() => {
          if (editor.view) {
            try {
              const state = editor.view.state;
              let tr = state.tr;
              let modified = false;

              // Process alignment and direction for all nodes
              state.doc.descendants((node, pos) => {
                if (!['paragraph', 'heading'].includes(node.type.name)) return;
                
                const textContent = node.textContent.trim();
                if (!textContent || textContent.length < 1) return;

                const shouldBeRTL = isRTLText(textContent);
                const targetAlignment = shouldBeRTL ? 'right' : 'left';
                const targetDirection = shouldBeRTL ? 'rtl' : 'ltr';
                const currentAlignment = node.attrs.textAlign || 'left';
                const currentDirection = node.attrs.dir || 'ltr';
                
                if (currentAlignment !== targetAlignment || currentDirection !== targetDirection) {
                  try {
                    tr.setNodeMarkup(pos, null, {
                      ...node.attrs,
                      textAlign: targetAlignment,
                      dir: targetDirection
                    });
                    modified = true;
                  } catch (error) {
                    console.warn('Failed to set RTL markup on initial load:', error);
                  }
                }
              });

              if (modified) {
                // Mark transaction to avoid conflicts with AutoRTLAlignment
                tr.setMeta('autoRTLAlignment', true);
                editor.view.dispatch(tr);
              }
            } catch (error) {
              console.warn('Error processing initial RTL alignment:', error);
            }
          }
        }, 100);
      }

      contentSetRef.current = true;

      setTimeout(() => {
        isInitializedRef.current = true;
      }, 100);
    }
  }, [content, editor]);

  useEffect(() => {
    const targetDir = dir || initialDirection;
    
    if (
      editor &&
      targetDir &&
      targetDir !== editor.view.dom.getAttribute("dir")
    ) {
      setEditorDir(targetDir);
      editor.view.dom.setAttribute("dir", targetDir);
      
      // Update CSS classes for RTL/LTR alignment
      const editorElement = editor.view.dom;
      editorElement.classList.remove('text-left', 'text-right');
      editorElement.classList.add(targetDir === 'rtl' ? 'text-right' : 'text-left');
      
      // Auto-set text alignment when direction changes programmatically
      const alignment = targetDir === "rtl" ? "right" : "left";
      editor.chain().focus().setTextAlign(alignment).run();
    }
  }, [dir, initialDirection, editor]);

  useEffect(() => {
    contentSetRef.current = false;
    isInitializedRef.current = false;
  }, [content]);

  const toggleEditorDirection = useCallback(() => {
    if (!editor) return;
    const newDir = editorDir === "ltr" ? "rtl" : "ltr";
    setEditorDir(newDir);
    editor.view.dom.setAttribute("dir", newDir);
    
    // Update CSS classes for RTL/LTR alignment
    const editorElement = editor.view.dom;
    editorElement.classList.remove('text-left', 'text-right');
    editorElement.classList.add(newDir === 'rtl' ? 'text-right' : 'text-left');
    
    // Auto-set text alignment based on direction
    const alignment = newDir === "rtl" ? "right" : "left";
    editor.chain().focus().setTextAlign(alignment).run();
    
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
        await handleImageUpload(file, editor.view, null);
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
    <div className="flex flex-col h-full border rounded bg-white dark:bg-zinc-900 dark:border-zinc-700">
      {showToolbar && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-2 gap-y-1 p-2 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0 bg-white dark:bg-zinc-900">
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
      <div className="flex-1 overflow-auto tiptap-editor-content-area">
        <EditorContent editor={editor} className="h-full" />
      </div>
    </div>
  );
};

export default TipTapEditor;
