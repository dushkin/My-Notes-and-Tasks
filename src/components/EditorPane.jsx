// src/components/EditorPane.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
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
  Code as CodeIcon, // Icon for inline code
  SquareCode as CodeBlockIcon, // Icon for code block
  TerminalSquare as ShellIcon, // Icon for shell command
  List as UnorderedListIcon, // Icon for bulleted list
  ListOrdered as OrderedListIcon, // Icon for numbered list
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

const EditorPane = ({ html = "", onChange }) => {
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0]);
  const [fontSize, setFontSize] = useState(FONT_SIZES[2]);
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
          editorRef.current.focus(); // Ensure editor has focus
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

  // Effect for Paste Handling (Auto-linking)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handlePaste = (e) => {
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
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        });
      }
    };

    editor.addEventListener("paste", handlePaste);
    return () => editor.removeEventListener("paste", handlePaste);
  }, [onChange]); // Add onChange dependency

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
        // Check ref before removing listener
        editorRef.current.removeEventListener("click", handleClick);
      }
    };
  }, []);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [typingTimeout]);

  const handleInput = useCallback(
    (event) => {
      if (!editorRef.current || propUpdateInProgress.current) return;

      const newHtml = event.target.innerHTML;

      // Clear any pending timeout
      if (typingTimeout) clearTimeout(typingTimeout);

      // --- Start: Auto-linking logic (kept similar to original) ---
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
          tempDiv.innerHTML = editorRef.current.innerHTML; // Process current HTML

          const textNodes = [];
          const walker = document.createTreeWalker(
            tempDiv,
            NodeFilter.SHOW_TEXT,
            (node) => {
              // Filter: Skip nodes inside <a> tags
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
                // Add text before URL
                if (matchIndex > lastIndex) {
                  fragment.appendChild(
                    document.createTextNode(
                      text.substring(lastIndex, matchIndex)
                    )
                  );
                }
                // Add linked URL by creating an anchor element
                const link = document.createElement("a");
                const safeUrl = ensureProtocol(url);
                link.href = safeUrl;
                link.target = "_blank";
                link.rel = "noopener noreferrer";
                link.textContent = url; // Use textContent for safety
                fragment.appendChild(link);

                lastIndex = matchIndex + url.length;
                madeChanges = true;
              }
            });

            // Add remaining text after last URL
            if (lastIndex < text.length) {
              fragment.appendChild(
                document.createTextNode(text.substring(lastIndex))
              );
            }

            if (madeChanges && textNode.parentNode) {
              // Find the text node again in the live DOM (important!)
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
                // Fallback: just replace in tempDiv, this might mess up cursor
                // textNode.parentNode.replaceChild(fragment, textNode);
              }
            }
          });

          if (madeChanges) {
            // Use requestAnimationFrame to allow DOM update before getting innerHTML
            requestAnimationFrame(() => {
              if (!editorRef.current) return;
              const finalHtml = editorRef.current.innerHTML;

              // Smart cursor restoration
              if (
                range &&
                cursorNode &&
                cursorOffset !== undefined &&
                selection
              ) {
                try {
                  const newRange = document.createRange();
                  // Try to find the original node or its equivalent
                  const liveCursorNode = findEquivalentNode(
                    editorRef.current,
                    cursorNode
                  );

                  if (liveCursorNode && isValidNode(liveCursorNode)) {
                    // Adjust offset if node length changed (e.g., text split by link)
                    const adjustedOffset = Math.min(
                      cursorOffset,
                      liveCursorNode.length || liveCursorNode.childNodes.length
                    );
                    newRange.setStart(liveCursorNode, adjustedOffset);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                  } else {
                    // Fallback: Place cursor at the end if node not found
                    newRange.selectNodeContents(editorRef.current);
                    newRange.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                  }
                } catch (e) {
                  console.error("Auto-link cursor restoration error:", e);
                  // Fallback to end
                  const endRange = document.createRange();
                  endRange.selectNodeContents(editorRef.current);
                  endRange.collapse(false);
                  if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(endRange);
                  }
                }
              }
              onChange(finalHtml); // Update state with the auto-linked HTML
            });
          }
        }, 700)
      ); // Delay for auto-linking

      // --- End: Auto-linking logic ---

      // Call onChange immediately for responsiveness
      onChange(newHtml);
    },
    [onChange, typingTimeout]
  ); // Added typingTimeout dependency

  // Helper to find an equivalent node in the live DOM after modifications
  const findEquivalentNode = (root, targetNode) => {
    if (!root || !targetNode) return null;
    if (root === targetNode) return root;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL);
    let currentNode;
    while ((currentNode = walker.nextNode())) {
      // Simple comparison (might need refinement for complex cases)
      if (
        currentNode.nodeType === targetNode.nodeType &&
        currentNode.nodeValue === targetNode.nodeValue
      ) {
        // Further check if parent structure is similar? (Optional)
        return currentNode;
      }
    }
    return null; // Not found
  };

  // --- Formatting Commands ---
  const applyCommand = useCallback(
    (cmd, value = null) => {
      editorRef.current?.focus();
      document.execCommand(cmd, false, value);
      editorRef.current?.focus(); // Refocus might be needed after execCommand
      // Use requestAnimationFrame to ensure DOM update before reading innerHTML
      requestAnimationFrame(() => {
        if (editorRef.current) {
          onChange(editorRef.current.innerHTML);
        }
      });
    },
    [onChange]
  );

  // Apply block-level styling (like <pre> or <div class="shell-command">)
  const applyBlockStyle = useCallback(
    (tag, className = null) => {
      editorRef.current?.focus();
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const selectedText = range.toString();

      // --- Determine the block(s) to wrap/modify ---
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
        // If selection starts outside a known block, wrap the whole selection in a new block first
        document.execCommand("formatBlock", false, "div");
        // Re-get the selection/range as it might have changed
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
          return; // Exit if block creation failed
        }
      }

      // --- Handle existing block ---
      // Check if the current block is already the desired type
      const isAlreadyStyled =
        (startBlock.nodeName === tag.toUpperCase() &&
          (!className || startBlock.classList.contains(className))) ||
        (tag === "pre" && startBlock.nodeName === "PRE") ||
        (tag === "div" &&
          className === "shell-command" &&
          startBlock.classList.contains("shell-command"));

      if (isAlreadyStyled) {
        // Convert back to paragraph (or default block)
        document.execCommand("formatBlock", false, "p"); // Use 'p' as a sensible default
      } else {
        // Apply the new block format
        document.execCommand("formatBlock", false, tag); // This wraps the current block/selection line

        // Re-select the block to apply class or inner structure if needed
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
            newBlock.className = ""; // Clear existing classes if necessary
            newBlock.classList.add(className);
          }
          // Special handling for <pre> to ensure <code> inside
          if (tag === "pre") {
            const codeElement = document.createElement("code");
            // Move content from <pre> into <code>, preserving line breaks
            // Use innerHTML carefully, assuming selection was primarily text
            codeElement.innerHTML = newBlock.innerHTML.replace(
              /<br\s*\/?>/gi,
              "\n"
            ); // Convert <br> to newlines
            newBlock.innerHTML = ""; // Clear the <pre>
            newBlock.appendChild(codeElement);
            // Ensure text content is properly escaped if needed (complex)
            // codeElement.textContent = newBlock.textContent; // Safer alternative if HTML tags inside PRE are not expected
          }
        } else {
          console.warn(
            "Could not reliably find the newly formatted block to apply class/structure."
          );
        }
      }

      // Trigger change after DOM modifications
      requestAnimationFrame(() => {
        if (editorRef.current) {
          onChange(editorRef.current.innerHTML);
        }
      });
    },
    [onChange]
  );

  // Apply inline styling (like <code>)
  const applyInlineStyle = useCallback(
    (tag) => {
      editorRef.current?.focus();
      const command = tag === "code" ? "insertHTML" : null; // Use insertHTML for code, execCommand might not support 'code' tag reliably

      if (command) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        const commonAncestor = range.commonAncestorContainer;

        // Check if the selection or its immediate parent is already the tag
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
          // Simple case: entire selection is within the tag
          isWrapped = true;
        } else if (
          !range.collapsed &&
          range.startContainer === range.endContainer &&
          range.startContainer.parentNode.nodeName === tag.toUpperCase()
        ) {
          // Selection is within a node that is the tag
          isWrapped = true;
          parentElement = range.startContainer.parentNode; // The actual tag element
        }
        // More complex checks for partial overlaps might be needed

        if (isWrapped && parentElement) {
          // Unwrap: Replace the parent tag with its text content
          const textContent = parentElement.textContent;
          const textNode = document.createTextNode(textContent);
          parentElement.parentNode.replaceChild(textNode, parentElement);
          // Restore selection (optional, can be complex)
          // range.selectNodeContents(textNode);
          // selection.removeAllRanges();
          // selection.addRange(range);
        } else if (!range.collapsed) {
          // Wrap: Create the tag and insert HTML
          const newNodeHtml = `<${tag}>${selectedText
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</${tag}>`; // Basic HTML escaping
          document.execCommand(command, false, newNodeHtml);
        }
      } else {
        // Fallback or for other potential inline commands
        document.execCommand(tag, false, null);
      }

      requestAnimationFrame(() => {
        if (editorRef.current) {
          onChange(editorRef.current.innerHTML);
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
    applyCommand("insertHTML", linkHtml); // Use applyCommand to handle update
  }, [applyCommand]);

  // Toggle text direction
  const toggleDirection = useCallback(() => {
    setIsRTL((prevIsRTL) => !prevIsRTL);
  }, []);

  // Handler for font family/size changes
  const handleFontChange = useCallback(
    (command, value) => {
      applyCommand(command, value);
      if (command === "fontName") setFontFamily(value);
      if (command === "fontSize") setFontSize(value);
    },
    [applyCommand]
  );

  return (
    <div className="p-4 space-y-2 border rounded bg-white dark:bg-zinc-800">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 border-b border-zinc-200 dark:border-zinc-700">
        {/* --- Basic Formatting --- */}
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
          className="hover:bg-zinc-700 rounded"
        >
          <UnorderedListIcon className="w-5 h-5" />
        </button>
        <button
          onClick={() => applyCommand("insertOrderedList")}
          title="Numbered List"
          className="hover:bg-zinc-700 rounded"
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
          value={fontFamily}
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
          value={fontSize}
          onChange={(e) => handleFontChange("fontSize", e.target.value)}
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}{" "}
              {/* You might want more descriptive names like Small, Medium, Large */}
            </option>
          ))}
        </select>
      </div>

      {/* Editor area */}
      {/* Add the editor-pane class here for the CSS styles to target */}
      <div
        ref={editorRef}
        dir={isRTL ? "rtl" : "ltr"}
        contentEditable
        suppressContentEditableWarning // Still useful but be aware of potential hydration issues if SSR
        onInput={handleInput}
        // Added 'editor-pane' class and ensured prose styles are present
        // Adjusted prose styles for better code compatibility
        className="editor-pane prose prose-sm dark:prose-invert max-w-none w-full min-h-[10rem] h-64 p-3 border border-zinc-300 dark:border-zinc-600 rounded resize-y overflow-auto focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-zinc-100 bg-white dark:bg-zinc-900 prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:underline whitespace-pre-wrap prose-code:before:content-none prose-code:after:content-none prose-pre:bg-inherit dark:prose-pre:bg-inherit prose-pre:p-0"
        role="textbox"
        aria-multiline="true"
      />
    </div>
  );
};

export default EditorPane;
