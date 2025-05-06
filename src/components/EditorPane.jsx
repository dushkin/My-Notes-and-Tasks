// src/components/EditorPane.jsx
// Based on the uploaded EditorPane.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTree } from "../hooks/useTree";
import {
  Undo,
  Redo,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Scissors,
  Copy,
  ClipboardPaste,
  TextSelect,
  AlignLeft,
  AlignRight,
  AlignCenter,
  Type,
  Link as LinkIcon,
  Code as CodeIcon,
  SquareCode as CodeBlockIcon,
  TerminalSquare as ShellIcon,
  List as UnorderedListIcon,
  ListOrdered as OrderedListIcon,
} from "lucide-react";

const FONT_FAMILIES = [
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
];
const FONT_SIZES = ["1", "2", "3", "4", "5", "6", "7"];
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

// Helper to ensure URL has a protocol
const ensureProtocol = (url) => {
  if (!url) return "";
  let fullUrl = url.trim();
  fullUrl = fullUrl.replace(/[.,;!?]*$/, "");
  if (!/^(?:https?|ftp):\/\//i.test(fullUrl)) {
    if (fullUrl.startsWith("www.")) {
      fullUrl = `https://${fullUrl}`;
    } else if (fullUrl.includes(".") && !fullUrl.includes(" ")) {
      fullUrl = `https://${fullUrl}`;
    }
  }
  return fullUrl;
};

// Helper function to create link HTML string
const createLinkHtml = (url, text) => {
  const safeUrl = ensureProtocol(url);
  if (safeUrl.startsWith("http") || safeUrl.startsWith("ftp")) {
    const encodedUrl = encodeURI(safeUrl)
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
    const safeText =
      text && text.trim().length > 0
        ? text.replace(/</g, "&lt;").replace(/>/g, "&gt;")
        : safeUrl;
    return `<a href="${encodedUrl}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
  }
  return text && text.trim().length > 0
    ? text.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    : url;
};

// Helper to check if a node is valid and connected to DOM
const isValidNode = (node) => {
  return node && node.nodeType && document.body.contains(node);
};

// *** MODIFIED: Added defaultFontFamily, defaultFontSize props ***
const EditorPane = ({
  html = "",
  onChange,
  defaultFontFamily,
  defaultFontSize,
}) => {
  // *** MODIFIED: Use prop default for initial state ***
  const [fontFamily, setFontFamily] = useState(
    defaultFontFamily || FONT_FAMILIES[0]
  );
  // ─── Sync editor content to tree for both notes & tasks ───
  const { updateNoteContent, updateTask, selectedItemId, selectedItem } =
    useTree();
  const handleContentChange = useCallback(
    (newHtml) => {
      // First update the EditorPane's own state
      onChange(newHtml);
      // Then persist into the tree:
      if (selectedItem && selectedItemId) {
        if (selectedItem.type === "task") {
          updateTask(selectedItemId, newHtml);
        } else {
          updateNoteContent(selectedItemId, newHtml);
        }
      }
    },
    [onChange, updateNoteContent, updateTask, selectedItemId, selectedItem]
  );
  const [fontSize, setFontSize] = useState(defaultFontSize || FONT_SIZES[2]); // Default to size '3' (index 2)

  const [isRTL, setIsRTL] = useState(false);
  const editorRef = useRef(null);
  const propUpdateInProgress = useRef(false);
  const [typingTimeout, setTypingTimeout] = useState(null);

  // Effect to update editor content when html prop changes
  useEffect(() => {
    if (editorRef.current && html !== editorRef.current.innerHTML) {
      propUpdateInProgress.current = true;
      const currentScrollTop = editorRef.current.scrollTop;
      const selection = window.getSelection();
      const range =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const startContainer = range?.startContainer;
      const startOffset = range?.startOffset;

      editorRef.current.innerHTML = html;

      editorRef.current.scrollTop = currentScrollTop;

      try {
        if (selection && range && isValidNode(startContainer)) {
          // Try to restore cursor position
          const newRange = document.createRange();
          // Ensure the container still exists and offset is valid
          if (
            startContainer.nodeType === Node.TEXT_NODE &&
            startOffset <= startContainer.length
          ) {
            newRange.setStart(startContainer, startOffset);
          } else if (
            startContainer.nodeType === Node.ELEMENT_NODE &&
            startOffset <= startContainer.childNodes.length
          ) {
            newRange.setStart(startContainer, startOffset);
          } else {
            // Fallback if container/offset became invalid, place at end of editor
            newRange.selectNodeContents(editorRef.current);
            newRange.collapse(false);
          }
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } else if (selection) {
          // Fallback: If no previous range or node invalid, move cursor to the end
          const endRange = document.createRange();
          endRange.selectNodeContents(editorRef.current);
          endRange.collapse(false); // Collapse to the end
          selection.removeAllRanges();
          selection.addRange(endRange);
          editorRef.current.focus();
        }
      } catch (e) {
        console.error("Error setting cursor position after prop update:", e);
        editorRef.current?.focus(); // Fallback focus
      }

      // Use requestAnimationFrame to ensure prop update is fully processed
      requestAnimationFrame(() => {
        propUpdateInProgress.current = false;
      });
    }
  }, [html]);

  // Effect to apply text direction
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.dir = isRTL ? "rtl" : "ltr";
    }
  }, [isRTL]);

  // Effect for Paste Handling (Auto-linking for text dropped/pasted without button)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handlePasteEvent = (e) => {
      // This handles direct Ctrl+V or context menu paste, applying auto-linking
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;

      const linkedHtml = text.replace(URL_REGEX, (match) =>
        createLinkHtml(match, match)
      );
      document.execCommand("insertHTML", false, linkedHtml);
      if (editorRef.current) {
        // Update state after paste processing
        requestAnimationFrame(() => {
          if (editorRef.current)
            handleContentChange(editorRef.current.innerHTML);
        });
      }
    };

    editor.addEventListener("paste", handlePasteEvent);
    return () => {
      if (editorRef.current) {
        // Check ref on cleanup
        editorRef.current.removeEventListener("paste", handlePasteEvent);
      }
    };
  }, [onChange]);

  // Effect for Handling Clicks on Links
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleClick = (event) => {
      let targetElement = event.target;
      while (targetElement && targetElement !== editor) {
        if (targetElement.tagName === "A" && targetElement.href) {
          event.preventDefault();
          window.open(targetElement.href, "_blank", "noopener,noreferrer");
          return;
        }
        targetElement = targetElement.parentNode;
      }
    };

    editor.addEventListener("click", handleClick);
    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener("click", handleClick);
      }
    };
  }, []);

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [typingTimeout]);

  // Helper to find an equivalent node in the live DOM after modifications
  const findEquivalentNode = (root, targetNode) => {
    if (!root || !targetNode) return null;
    if (root === targetNode) return root;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
    let currentNode;
    while ((currentNode = walker.nextNode())) {
      if (
        currentNode.nodeType === targetNode.nodeType &&
        currentNode.nodeValue === targetNode.nodeValue
      ) {
        return currentNode;
      }
    }
    return null;
  };

  // *** MOVED applyCommand DEFINITION EARLIER ***
  // --- Formatting Commands (Handles execCommand for most things) ---
  const applyCommand = useCallback(
    (cmd, value = null) => {
      editorRef.current?.focus();
      try {
        const success = document.execCommand(cmd, false, value);
        if (!success) {
          console.warn(
            `execCommand(${cmd}) was not successful. It might be unsupported or blocked.`
          );
        }
      } catch (error) {
        console.error(`Error executing command ${cmd}:`, error);
      }
      editorRef.current?.focus();
      // Update state unless it's paste (which updates in its own handler or fallback)
      if (cmd !== "paste") {
        requestAnimationFrame(() => {
          if (editorRef.current) {
            handleContentChange(editorRef.current.innerHTML);
          }
        });
      }
    },
    [onChange]
  );
  // *** END MOVED applyCommand ***

  // Handle input events, including auto-linking after a delay
  const handleInput = useCallback(
    (event) => {
      if (!editorRef.current || propUpdateInProgress.current) return;

      const newHtml = event.target.innerHTML;

      // Clear any pending timeout
      if (typingTimeout) clearTimeout(typingTimeout);

      // --- Start: Auto-linking logic for typed text ---
      setTypingTimeout(
        setTimeout(() => {
          if (!editorRef.current) return;

          const selection = window.getSelection();
          const range =
            selection && selection.rangeCount > 0
              ? selection.getRangeAt(0)
              : null;
          const cursorNode = range?.startContainer;
          const cursorOffset = range?.startOffset;

          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = editorRef.current.innerHTML;

          const textNodes = [];
          const walker = document.createTreeWalker(
            tempDiv,
            NodeFilter.SHOW_TEXT,
            (node) => {
              return node.parentNode.nodeName !== "A"
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
            },
            false
          );
          let node;
          while ((node = walker.nextNode())) {
            textNodes.push(node);
          }

          let madeChanges = false;
          textNodes.forEach((textNode) => {
            const text = textNode.nodeValue;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;

            const urlMatches = [...text.matchAll(URL_REGEX)];
            urlMatches.forEach((match) => {
              const url = match[0];
              const matchIndex = match.index;

              const isCompleteUrl =
                url.length >= 8 &&
                (matchIndex + url.length === text.length ||
                  /[\s.,;!?)]/.test(text[matchIndex + url.length])) &&
                (matchIndex === 0 || /[\s.,;!?(]/.test(text[matchIndex - 1]));

              if (isCompleteUrl) {
                if (matchIndex > lastIndex) {
                  fragment.appendChild(
                    document.createTextNode(
                      text.substring(lastIndex, matchIndex)
                    )
                  );
                }
                const link = document.createElement("a");
                const safeUrl = ensureProtocol(url);
                link.href = safeUrl;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = url;
                fragment.appendChild(link);
                lastIndex = matchIndex + url.length;
                madeChanges = true;
              }
            });
            if (lastIndex < text.length) {
              fragment.appendChild(
                document.createTextNode(text.substring(lastIndex))
              );
            }

            if (madeChanges && textNode.parentNode) {
              const liveTextNode = findEquivalentNode(
                editorRef.current,
                textNode
              );
              if (liveTextNode && liveTextNode.parentNode) {
                liveTextNode.parentNode.replaceChild(fragment, liveTextNode);
              } else {
                console.warn(
                  "Could not find equivalent live node for auto-linking."
                );
              }
            }
          });
          if (madeChanges) {
            requestAnimationFrame(() => {
              if (!editorRef.current) return;
              const finalHtml = editorRef.current.innerHTML;

              if (
                range &&
                cursorNode &&
                cursorOffset !== undefined &&
                selection
              ) {
                try {
                  const newRange = document.createRange();
                  const liveCursorNode = findEquivalentNode(
                    editorRef.current,
                    cursorNode
                  );

                  if (liveCursorNode && isValidNode(liveCursorNode)) {
                    const adjustedOffset = Math.min(
                      cursorOffset,
                      liveCursorNode.length || liveCursorNode.childNodes.length
                    );
                    newRange.setStart(liveCursorNode, adjustedOffset);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                  } else {
                    newRange.selectNodeContents(editorRef.current);
                    newRange.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                  }
                } catch (e) {
                  console.error("Auto-link cursor restoration error:", e);
                  const endRange = document.createRange();
                  endRange.selectNodeContents(editorRef.current);
                  endRange.collapse(false);
                  if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(endRange);
                  }
                }
              }
              handleContentChange(finalHtml);
            });
          }
        }, 700)
      );
      // --- End: Auto-linking logic ---

      // Call onChange immediately for typing responsiveness
      handleContentChange(newHtml);
    },
    [onChange, typingTimeout]
  );

  // --- Specific handler for paste button using Clipboard API ---
  const handlePasteFromClipboard = useCallback(async () => {
    if (!navigator.clipboard?.readText) {
      console.warn("Clipboard API (readText) not supported by this browser.");
      applyCommand("paste"); // Try original execCommand as fallback
      return;
    }
    editorRef.current?.focus();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // Escape basic HTML characters from plain text before inserting as HTML
        const escapedText = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
        // Replace newlines with <br> tags for HTML insertion
        const htmlToInsert = escapedText.replace(/\r?\n/g, "<br>");
        document.execCommand("insertHTML", false, htmlToInsert);
      }
      // Trigger update after successful paste
      requestAnimationFrame(() => {
        if (editorRef.current) {
          handleContentChange(editorRef.current.innerHTML);
        }
      });
    } catch (err) {
      console.error("Failed to read clipboard contents or insert HTML: ", err);
      // If Clipboard API failed, maybe try execCommand as last resort
      try {
        const success = document.execCommand("paste", false, null);
        if (success && editorRef.current) {
          requestAnimationFrame(() => {
            if (editorRef.current) {
              handleContentChange(editorRef.current.innerHTML);
            }
          });
        } else if (!success) {
          console.warn("Fallback execCommand('paste') also failed.");
        }
      } catch (execErr) {
        console.error("Error during fallback execCommand('paste'):", execErr);
      }
    }
    editorRef.current?.focus();
  }, [onChange, applyCommand]); // Now depends on correctly ordered applyCommand

  // Apply block-level styling
  const applyBlockStyle = useCallback(
    (tag, className = null) => {
      editorRef.current?.focus();
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      let startBlock = range.startContainer;
      while (
        (startBlock && startBlock.nodeType !== Node.ELEMENT_NODE) ||
        ![
          "P",
          "DIV",
          "LI",
          "H1",
          "H2",
          "H3",
          "H4",
          "H5",
          "H6",
          "BLOCKQUOTE",
          "PRE",
        ].includes(startBlock.nodeName)
      ) {
        if (startBlock === editorRef.current) break;
        startBlock = startBlock.parentNode;
      }

      if (!startBlock || startBlock === editorRef.current) {
        document.execCommand("formatBlock", false, "div");
        const newSelection = window.getSelection();
        if (!newSelection || newSelection.rangeCount === 0) return;
        const newRange = newSelection.getRangeAt(0);
        startBlock = newRange.startContainer;
        while (
          (startBlock && startBlock.nodeType !== Node.ELEMENT_NODE) ||
          ![
            "P",
            "DIV",
            "LI",
            "H1",
            "H2",
            "H3",
            "H4",
            "H5",
            "H6",
            "BLOCKQUOTE",
            "PRE",
          ].includes(startBlock.nodeName)
        ) {
          if (startBlock === editorRef.current) break;
          startBlock = startBlock.parentNode;
        }
        if (!startBlock || startBlock === editorRef.current) {
          console.error("Failed to wrap selection in a block element.");
          return;
        }
      }

      const isAlreadyStyled =
        (startBlock.nodeName === tag.toUpperCase() &&
          (!className || startBlock.classList.contains(className))) ||
        (tag === "pre" && startBlock.nodeName === "PRE") ||
        (tag === "div" &&
          className === "shell-command" &&
          startBlock.classList.contains("shell-command"));
      if (isAlreadyStyled) {
        document.execCommand("formatBlock", false, "p");
      } else {
        document.execCommand("formatBlock", false, tag);
        const finalSelection = window.getSelection();
        if (!finalSelection || finalSelection.rangeCount === 0) return;
        let finalRange = finalSelection.getRangeAt(0);
        let newBlock = finalRange.startContainer;
        while (newBlock && newBlock.nodeName !== tag.toUpperCase()) {
          if (newBlock === editorRef.current) break;
          newBlock = newBlock.parentNode;
        }

        if (newBlock && newBlock !== editorRef.current) {
          if (className) {
            newBlock.className = "";
            newBlock.classList.add(className);
          }
          if (tag === "pre") {
            const codeElement = document.createElement("code");
            codeElement.innerHTML = newBlock.innerHTML.replace(
              /<br\s*\/?>/gi,
              "\n"
            );
            newBlock.innerHTML = "";
            newBlock.appendChild(codeElement);
          }
        } else {
          console.warn("Could not reliably find the newly formatted block.");
        }
      }

      requestAnimationFrame(() => {
        if (editorRef.current) {
          handleContentChange(editorRef.current.innerHTML);
        }
      });
    },
    [onChange]
  );

  // Apply inline styling
  const applyInlineStyle = useCallback(
    (tag) => {
      editorRef.current?.focus();
      const command = tag === "code" ? "insertHTML" : null;

      if (command) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        const commonAncestor = range.commonAncestorContainer;

        let isWrapped = false;
        let parentElement = commonAncestor;
        if (parentElement.nodeType !== Node.ELEMENT_NODE) {
          parentElement = parentElement.parentNode;
        }
        if (
          parentElement &&
          parentElement.nodeName === tag.toUpperCase() &&
          parentElement.closest(".editor-pane") === editorRef.current
        ) {
          isWrapped = true;
        } else if (
          !range.collapsed &&
          range.startContainer === range.endContainer &&
          range.startContainer.parentNode.nodeName === tag.toUpperCase()
        ) {
          isWrapped = true;
          parentElement = range.startContainer.parentNode;
        }

        if (isWrapped && parentElement) {
          const textContent = parentElement.textContent;
          const textNode = document.createTextNode(textContent);
          parentElement.parentNode.replaceChild(textNode, parentElement);
        } else if (!range.collapsed) {
          const newNodeHtml = `<${tag}>${selectedText
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</${tag}>`;
          document.execCommand(command, false, newNodeHtml);
        }
      } else {
        document.execCommand(tag, false, null);
      }

      requestAnimationFrame(() => {
        if (editorRef.current) {
          handleContentChange(editorRef.current.innerHTML);
        }
      });
    },
    [onChange]
  );

  // Link Button Handler
  const handleCreateLink = useCallback(() => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : "";
    let url = prompt(
      "Enter the URL:",
      selectedText.startsWith("http") ? selectedText : "https://"
    );
    if (!url) return;
    const fullUrl = ensureProtocol(url);
    if (!fullUrl.startsWith("http") && !fullUrl.startsWith("ftp")) {
      alert("Invalid URL provided.");
      return;
    }
    const linkHtml = createLinkHtml(fullUrl, selectedText || fullUrl);
    // Use execCommand insertHTML for link creation
    document.execCommand("insertHTML", false, linkHtml);
    requestAnimationFrame(() => {
      if (editorRef.current) {
        handleContentChange(editorRef.current.innerHTML);
      }
    });
  }, [onChange]); // Depends on onChange for update

  // Toggle text direction
  const toggleDirection = useCallback(() => {
    setIsRTL((prevIsRTL) => !prevIsRTL);
  }, []);

  // Handler for font family/size changes
  const handleFontChange = useCallback(
    (command, value) => {
      applyCommand(command, value); // Now uses applyCommand defined earlier
      if (command === "fontName") setFontFamily(value);
      if (command === "fontSize") setFontSize(value);
    },
    [applyCommand] // Correct dependency order now
  );

  // --- Render Component ---
  return (
    <div className="flex flex-col flex-grow border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-2 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
        {/* --- Undo/Redo --- */}
        <button
          onClick={() => applyCommand("undo")}
          title="Undo"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <Undo className="w-5 h-5" />
        </button>
        <button
          onClick={() => applyCommand("redo")}
          title="Redo"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <Redo className="w-5 h-5" />
        </button>

        {/* --- Cut/Copy/Paste Buttons --- */}
        <button
          onClick={() => applyCommand("cut")}
          title="Cut"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <Scissors className="w-5 h-5" />
        </button>
        <button
          onClick={() => applyCommand("copy")}
          title="Copy"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <Copy className="w-5 h-5" />
        </button>
        <button
          onClick={handlePasteFromClipboard} // Use the specific handler
          title="Paste"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <ClipboardPaste className="w-5 h-5" />
        </button>

        {/* --- Basic Formatting --- */}
        <button
          onClick={() => applyCommand("bold")}
          title="Bold"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <BoldIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => applyCommand("italic")}
          title="Italic"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <ItalicIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => applyCommand("underline")}
          title="Underline"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <UnderlineIcon className="w-5 h-5" />
        </button>

        {/* --- Code Formatting --- */}
        <button
          onClick={() => applyInlineStyle("code")}
          title="Inline Code"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <CodeIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => applyBlockStyle("pre")}
          title="Code Block"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <CodeBlockIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => applyBlockStyle("div", "shell-command")}
          title="Shell Command Block"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <ShellIcon className="w-5 h-5" />
        </button>

        {/* --- Alignment & Selection --- */}
        <button
          onClick={() => applyCommand("justifyLeft")}
          title="Align Left"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <AlignLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => applyCommand("justifyCenter")}
          title="Align Center"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <AlignCenter className="w-5 h-5" />
        </button>
        <button
          onClick={() => applyCommand("justifyRight")}
          title="Align Right"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <AlignRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => applyCommand("selectAll")}
          title="Select All"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <TextSelect className="w-5 h-5" />
        </button>

        {/* --- List Support --- */}
        <button
          onClick={() => applyCommand("insertUnorderedList")}
          title="Bulleted List"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <UnorderedListIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => applyCommand("insertOrderedList")}
          title="Numbered List"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <OrderedListIcon className="w-5 h-5" />
        </button>

        {/* --- Link & Direction --- */}
        <button
          onClick={handleCreateLink}
          title="Create Link"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <LinkIcon className="w-5 h-5" />
        </button>
        <button
          onClick={toggleDirection}
          title={`Text Direction: ${isRTL ? "RTL" : "LTR"}`}
          className={`p-1 flex items-center ${
            isRTL ? "bg-blue-100 dark:bg-blue-900" : ""
          } hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded`}
        >
          <Type className="w-5 h-5 mr-1" />
          <span>{isRTL ? "RTL" : "LTR"}</span>
        </button>

        {/* --- Font Selection --- */}
        <select
          title="Font Family"
          className="p-1 text-sm border rounded bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={fontFamily} // Use local state for controlled component value
          onChange={(e) => handleFontChange("fontName", e.target.value)}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          title="Font Size"
          className="p-1 text-sm border rounded bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={fontSize} // Use local state for controlled component value
          onChange={(e) => handleFontChange("fontSize", e.target.value)}
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        dir={isRTL ? "rtl" : "ltr"}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="editor-pane prose prose-sm dark:prose-invert max-w-none w-full flex-grow p-3 border-t border-zinc-300 dark:border-zinc-600 rounded-b resize-y overflow-auto focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-zinc-100 bg-white dark:bg-zinc-900 prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:underline whitespace-pre-wrap prose-code:before:content-none prose-code:after:content-none prose-pre:bg-inherit dark:prose-pre:bg-inherit prose-pre:p-0" // Keep original classes
        role="textbox"
        aria-multiline="true"
      />
    </div>
  );
};

export default EditorPane;
