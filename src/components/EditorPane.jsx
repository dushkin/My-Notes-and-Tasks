// src/components/EditorPane.jsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Undo, Redo, Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon,
  Scissors, Copy, ClipboardPaste, TextSelect, AlignLeft, AlignRight, AlignCenter,
  Type, Link as LinkIcon, Code as CodeIcon, SquareCode as CodeBlockIcon,
  TerminalSquare as ShellIcon, List as UnorderedListIcon, ListOrdered as OrderedListIcon,
} from "lucide-react";
// Assuming useTree is NOT directly used here for saving, as ContentEditor handles it
// import { useTree } from "../hooks/useTree";


// Ensure these constants and utility functions are defined or imported
// (They were present in your original uploaded code.txt for EditorPane.jsx)
const FONT_FAMILIES = [
  "Arial", "Times New Roman", "Courier New", "Georgia", "Verdana",
  // Add any other fonts you use
];
const FONT_SIZES = ["1", "2", "3", "4", "5", "6", "7"]; // Corresponds to HTML <font size="...">
const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

const ensureProtocol = (url) => {
  if (!url) return "";
  let fullUrl = url.trim();
  fullUrl = fullUrl.replace(/[.,;!?]*$/, ""); // Remove trailing punctuation often copied by mistake
  if (!/^(?:https?|ftp):\/\//i.test(fullUrl)) {
    if (fullUrl.startsWith("www.")) {
      fullUrl = `https://${fullUrl}`;
    } else if (fullUrl.includes(".") && !fullUrl.includes(" ")) { // Basic check for domain-like structure
      fullUrl = `https://${fullUrl}`;
    }
    // Add more sophisticated checks if needed, e.g. for localhost or custom schemes
  }
  return fullUrl;
};

const createLinkHtml = (url, text) => {
  const safeUrl = ensureProtocol(url);
  // Only create a link if it seems like a valid web/ftp URL
  if (safeUrl.startsWith("http") || safeUrl.startsWith("ftp")) {
    const encodedUrl = encodeURI(safeUrl) // Encode URL for safety
      .replace(/"/g, "&quot;") // Escape quotes for href attribute
      .replace(/'/g, "&#39;");
    const safeText =
      text && text.trim().length > 0
        ? text.replace(/</g, "&lt;").replace(/>/g, "&gt;") // Escape HTML in link text
        : safeUrl; // Fallback to URL as text if no specific text provided
    return `<a href="${encodedUrl}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
  }
  // If not a linkable URL, return the original text (or URL if text was empty)
  return text && text.trim().length > 0
    ? text.replace(/</g, "&lt;").replace(/>/g, "&gt;")
    : url;
};

const isValidNode = (node) => {
  // Checks if a node is valid and part of the document
  return node && node.nodeType && document.body.contains(node);
};


const EditorPane = ({
  html = "",
  onChange,
  defaultFontFamily,
  defaultFontSize,
}) => {
  const [fontFamily, setFontFamily] = useState(
    defaultFontFamily || FONT_FAMILIES[0]
  );
  const [fontSize, setFontSize] = useState(defaultFontSize || FONT_SIZES[2]); // Typically "3" is normal size
  const [isRTL, setIsRTL] = useState(false);
  const editorRef = useRef(null);
  const propUpdateInProgress = useRef(false);
  const [typingTimeout, setTypingTimeout] = useState(null); // For auto-linking debounce

  const handleContentChangeInternal = useCallback(
    (newHtml) => {
      if (onChange) {
        onChange(newHtml); // This is handleChange from ContentEditor
      }
    },
    [onChange]
  );

  useEffect(() => {
    if (editorRef.current && html !== editorRef.current.innerHTML) {
      propUpdateInProgress.current = true;
      const currentScrollTop = editorRef.current.scrollTop; // Preserve scroll of content area
      // Basic selection preservation (can be made more robust)
      const selection = window.getSelection();
      const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
      const activeElement = document.activeElement;

      editorRef.current.innerHTML = html;
      editorRef.current.scrollTop = currentScrollTop; // Restore scroll

      try {
        if (range && editorRef.current.contains(activeElement)) { // Restore selection only if editor was focused
          // Attempt to re-apply selection; this is complex and might need adjustment
          // Check if startContainer is still valid in the updated DOM
          if (isValidNode(range.startContainer) && isValidNode(range.endContainer)) {
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      } catch (e) {
        console.warn("Could not restore selection after HTML prop update:", e);
      }

      requestAnimationFrame(() => {
        propUpdateInProgress.current = false;
      });
    }
  }, [html]);


  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.dir = isRTL ? "rtl" : "ltr";
    }
  }, [isRTL]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handlePasteEvent = (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;

      // Auto-link URLs on paste
      const linkedHtml = text.replace(URL_REGEX, (match) =>
        createLinkHtml(match, match)
      );
      document.execCommand("insertHTML", false, linkedHtml);
      requestAnimationFrame(() => { // Ensure DOM has updated
        if (editorRef.current) handleContentChangeInternal(editorRef.current.innerHTML);
      });
    };

    editor.addEventListener("paste", handlePasteEvent);
    return () => {
      if (editorRef.current) { // Check ref before removing listener
        editorRef.current.removeEventListener("paste", handlePasteEvent);
      }
    };
  }, [handleContentChangeInternal]); // Added handleContentChangeInternal dependency

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const handleClick = (event) => {
      let targetElement = event.target;
      while (targetElement && targetElement !== editor) {
        if (targetElement.tagName === "A" && targetElement.href) {
          event.preventDefault();
          window.open(targetElement.href, "_blank", "noopener,noreferrer");
          return; // Link clicked, exit
        }
        targetElement = targetElement.parentNode;
      }
    };
    editor.addEventListener("click", handleClick);
    return () => {
      if (editorRef.current) { // Check ref
        editorRef.current.removeEventListener("click", handleClick);
      }
    };
  }, []); // No dependencies needed if logic is self-contained

  useEffect(() => {
    // Cleanup timeout on unmount or if typingTimeout changes
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [typingTimeout]);

  const applyCommand = useCallback(
    (cmd, value = null) => {
      editorRef.current?.focus(); // Ensure editor has focus before command
      try {
        const success = document.execCommand(cmd, false, value);
        if (!success) console.warn(`execCommand(${cmd}) was not successful.`);
      } catch (error) {
        console.error(`Error executing command ${cmd}:`, error);
      }
      // editorRef.current?.focus(); // Re-focus, might be redundant
      // For commands other than paste, trigger content change
      if (cmd !== 'paste') { // Paste is handled specially by its own handlers
          requestAnimationFrame(() => { // Wait for DOM to update
            if (editorRef.current) handleContentChangeInternal(editorRef.current.innerHTML);
          });
      }
    },
    [handleContentChangeInternal] // Add dependency
  );

  const handleInput = useCallback(
    (event) => {
      if (!editorRef.current || propUpdateInProgress.current) return;
      const newHtml = event.target.innerHTML;

      // Debounce auto-linking logic to avoid running on every keystroke
      if (typingTimeout) clearTimeout(typingTimeout);
      setTypingTimeout(
        setTimeout(() => {
          if (!editorRef.current) return;

          // Save cursor position before DOM manipulation for auto-linking
          const selection = window.getSelection();
          let originalRange = null;
          if (selection && selection.rangeCount > 0) {
            originalRange = selection.getRangeAt(0).cloneRange();
          }

          let madeChanges = false;
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = editorRef.current.innerHTML; // Work on a copy

          const textNodesToProcess = [];
          const walker = document.createTreeWalker(
            tempDiv,
            NodeFilter.SHOW_TEXT,
            (node) => (node.parentNode.nodeName !== 'A' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
            false
          );
          let node;
          while ((node = walker.nextNode())) {
            textNodesToProcess.push(node);
          }

          textNodesToProcess.forEach((textNode) => {
            const text = textNode.nodeValue;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            const urlMatches = [...text.matchAll(URL_REGEX)];

            urlMatches.forEach((match) => {
              const url = match[0];
              const matchIndex = match.index;
              // Basic check to ensure it's a "complete" URL (ends with space or end of text)
              const isCompleteUrl = (matchIndex + url.length === text.length || /[\s.,;!?)]/.test(text[matchIndex + url.length])) &&
                                    (matchIndex === 0 || /[\s.,;!?(]/.test(text[matchIndex - 1]));

              if (isCompleteUrl) {
                if (matchIndex > lastIndex) {
                  fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchIndex)));
                }
                const linkHtml = createLinkHtml(url, url); // Use helper
                const tempLinkContainer = document.createElement('div'); // Create link from HTML string
                tempLinkContainer.innerHTML = linkHtml;
                if (tempLinkContainer.firstChild) {
                    fragment.appendChild(tempLinkContainer.firstChild);
                } else { // Fallback if createLinkHtml returned plain text
                    fragment.appendChild(document.createTextNode(url));
                }
                lastIndex = matchIndex + url.length;
                madeChanges = true;
              }
            });

            if (lastIndex < text.length) {
              fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
            }

            if (madeChanges && textNode.parentNode) { // Check if parentNode exists
                // Find the equivalent live node in the actual editor to replace
                // This is tricky. For simplicity, if changes are made, we might have to update the whole editor content.
                // A more robust solution involves careful DOM manipulation on editorRef.current.
                // For this example, we'll assume the change happens in tempDiv and then we update editorRef.current.
                textNode.parentNode.replaceChild(fragment, textNode);
            }
          });

          if (madeChanges) {
            editorRef.current.innerHTML = tempDiv.innerHTML; // Update the live editor

            // Attempt to restore cursor - this is complex and error-prone
            if (originalRange && selection) {
              try {
                // Check if originalRange containers are still valid in the new DOM
                if (isValidNode(originalRange.startContainer) && isValidNode(originalRange.endContainer) &&
                    editorRef.current.contains(originalRange.startContainer) && editorRef.current.contains(originalRange.endContainer)) {
                  selection.removeAllRanges();
                  selection.addRange(originalRange);
                } else {
                  // Fallback: place cursor at the end
                  const endRange = document.createRange();
                  endRange.selectNodeContents(editorRef.current);
                  endRange.collapse(false);
                  selection.removeAllRanges();
                  selection.addRange(endRange);
                }
              } catch (e) {
                console.warn("Auto-link cursor restoration error:", e);
                  const endRange = document.createRange(); // Fallback
                  endRange.selectNodeContents(editorRef.current);
                  endRange.collapse(false);
                  if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(endRange);
                  }
              }
            }
            handleContentChangeInternal(editorRef.current.innerHTML); // Propagate changes
          }
        }, 700) // Delay for auto-linking check
      );

      handleContentChangeInternal(newHtml); // Immediate propagation for debounced save
    },
    [handleContentChangeInternal, typingTimeout]
  );

  const handlePasteFromClipboard = useCallback(async () => {
    if (!navigator.clipboard?.readText) {
      applyCommand("paste"); // Fallback for older browsers or permissions issue
      return;
    }
    editorRef.current?.focus();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // Convert newlines to <br> for proper HTML insertion if pasting plain text
        const htmlToInsert = text
          .replace(/&/g, "&amp;") // Basic sanitization
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
          .replace(/\r?\n/g, "<br>");
        document.execCommand("insertHTML", false, htmlToInsert);
      }
      requestAnimationFrame(() => { // Ensure DOM update before reading innerHTML
        if (editorRef.current) handleContentChangeInternal(editorRef.current.innerHTML);
      });
    } catch (err) {
      console.error("Failed to read clipboard or insert HTML: ", err);
      // Fallback to simple paste if advanced paste fails
      try {
        const success = document.execCommand("paste", false, null);
        if (success && editorRef.current) {
          requestAnimationFrame(() => {
            if (editorRef.current) handleContentChangeInternal(editorRef.current.innerHTML);
          });
        } else if (!success) {
          console.warn("Fallback execCommand('paste') also failed.");
        }
      } catch (execErr) {
        console.error("Error during fallback execCommand('paste'):", execErr);
      }
    }
    editorRef.current?.focus(); // Re-focus after operation
  }, [applyCommand, handleContentChangeInternal]);

  const applyBlockStyle = useCallback(
    (tag, className = null) => {
      editorRef.current?.focus();
      document.execCommand("formatBlock", false, `<${tag}>`); // Simple formatBlock

      // If a className is specified, find the newly created block and apply it.
      // This is a simplification; robustly finding the "new" block can be tricky.
      if (className) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          let container = selection.getRangeAt(0).commonAncestorContainer;
          while (container && container !== editorRef.current) {
            if (container.nodeName === tag.toUpperCase()) {
              container.className = className; // Apply or replace class
              break;
            }
            container = container.parentNode;
          }
        }
      }
       if (tag === "pre" && editorRef.current) { // Special handling for PRE to wrap content in CODE
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            let block = selection.getRangeAt(0).commonAncestorContainer;
            while(block && block.nodeName !== 'PRE' && block !== editorRef.current) {
                block = block.parentNode;
            }
            if (block && block.nodeName === 'PRE' && !block.querySelector('code')) {
                const codeElement = document.createElement('code');
                // Move children of PRE into CODE
                while(block.firstChild) {
                    codeElement.appendChild(block.firstChild);
                }
                block.appendChild(codeElement);
            }
        }
      }


      requestAnimationFrame(() => {
        if (editorRef.current) handleContentChangeInternal(editorRef.current.innerHTML);
      });
    },
    [handleContentChangeInternal]
  );

  const applyInlineStyle = useCallback(
    (tag) => { // tag here is 'bold', 'italic', 'underline', or 'code' for inline code
      editorRef.current?.focus();
      let command = tag;
      if (tag === 'code') { // For inline code, execCommand doesn't have a direct 'code' command
          // We'll wrap selection with <code> tags using insertHTML
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return; // Need a selection
          
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();
          
          // Check if already wrapped in <code>
          let parent = range.commonAncestorContainer;
          if (parent.nodeType !== Node.ELEMENT_NODE) {
              parent = parent.parentNode;
          }
          if (parent && parent.nodeName === 'CODE' && parent.closest('.editor-pane') === editorRef.current) {
              // Unwrap: replace <code>text</code> with just text
              const textNode = document.createTextNode(parent.textContent);
              parent.parentNode.replaceChild(textNode, parent);
              // Restore selection around the new text node (simplified)
              range.selectNodeContents(textNode);
              selection.removeAllRanges();
              selection.addRange(range);
          } else {
              // Wrap with <code>
              const codeNode = document.createElement('code');
              codeNode.textContent = selectedText.replace(/</g, "&lt;").replace(/>/g, "&gt;"); // Escape HTML within code
              range.deleteContents(); // Remove selected text
              range.insertNode(codeNode); // Insert the new <code> node
              // Select the content of the new code node
              range.selectNodeContents(codeNode);
              selection.removeAllRanges();
              selection.addRange(range);
          }
          command = null; // Prevent execCommand below
      } else {
        document.execCommand(command, false, null);
      }

      requestAnimationFrame(() => {
        if (editorRef.current) handleContentChangeInternal(editorRef.current.innerHTML);
      });
    },
    [handleContentChangeInternal]
  );

  const handleCreateLink = useCallback(() => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : "";
    let url = prompt("Enter the URL:", selectedText.startsWith("http") || selectedText.startsWith("www.") ? selectedText : "https://");
    if (!url) return;

    const linkHtml = createLinkHtml(url, selectedText); // Use helper

    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
        document.execCommand("insertHTML", false, linkHtml);
    } else { // If no text selected, just insert the link
        document.execCommand("insertHTML", false, linkHtml);
    }

    requestAnimationFrame(() => {
      if (editorRef.current) handleContentChangeInternal(editorRef.current.innerHTML);
    });
  }, [handleContentChangeInternal]);

  const toggleDirection = useCallback(() => {
    setIsRTL((prev) => !prev);
  }, []);

  const handleFontChange = useCallback(
    (command, value) => {
      applyCommand(command, value); // applyCommand triggers handleContentChangeInternal
      if (command === "fontName") setFontFamily(value);
      if (command === "fontSize") setFontSize(value);
    },
    [applyCommand]
  );

  const buttonBaseClass = "p-1.5 sm:p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded";

  return (
    // Main container for the editor pane
    // - flex flex-col: Toolbar and content area stacked vertically.
    // - flex-grow: This entire pane should grow to fill space given by ContentEditor.
    // - overflow-hidden: This is key. It prevents this div from scrolling.
    //                    Instead, the inner contentEditable div will scroll.
    <div className="flex flex-col flex-grow overflow-hidden border rounded bg-transparent dark:border-zinc-700">
      {/* Toolbar */}
      {/* - flex-shrink-0: Prevents toolbar from shrinking. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-y-1 p-2 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
        <button onClick={() => applyCommand("undo")} title="Undo" className={buttonBaseClass}>
          <Undo className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("redo")} title="Redo" className={buttonBaseClass}>
          <Redo className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("cut")} title="Cut" className={buttonBaseClass}>
          <Scissors className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("copy")} title="Copy" className={buttonBaseClass}>
          <Copy className="w-5 h-5" />
        </button>
        <button onClick={handlePasteFromClipboard} title="Paste" className={buttonBaseClass}>
          <ClipboardPaste className="w-5 h-5" />
        </button>
        <button onClick={() => applyInlineStyle("bold")} title="Bold" className={buttonBaseClass}>
          <BoldIcon className="w-5 h-5" />
        </button>
        <button onClick={() => applyInlineStyle("italic")} title="Italic" className={buttonBaseClass}>
          <ItalicIcon className="w-5 h-5" />
        </button>
        <button onClick={() => applyInlineStyle("underline")} title="Underline" className={buttonBaseClass}>
          <UnderlineIcon className="w-5 h-5" />
        </button>
        <button onClick={() => applyInlineStyle("code")} title="Inline Code" className={buttonBaseClass}>
          <CodeIcon className="w-5 h-5" />
        </button>
        <button onClick={() => applyBlockStyle("pre")} title="Code Block" className={buttonBaseClass}>
          <CodeBlockIcon className="w-5 h-5" />
        </button>
        <button onClick={() => applyBlockStyle("div", "shell-command")} title="Shell Command Block" className={buttonBaseClass}>
          <ShellIcon className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("justifyLeft")} title="Align Left" className={buttonBaseClass}>
          <AlignLeft className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("justifyCenter")} title="Align Center" className={buttonBaseClass}>
          <AlignCenter className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("justifyRight")} title="Align Right" className={buttonBaseClass}>
          <AlignRight className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("selectAll")} title="Select All" className={buttonBaseClass}>
          <TextSelect className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("insertUnorderedList")} title="Bulleted List" className={buttonBaseClass}>
          <UnorderedListIcon className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("insertOrderedList")} title="Numbered List" className={buttonBaseClass}>
          <OrderedListIcon className="w-5 h-5" />
        </button>
        <button onClick={handleCreateLink} title="Create Link" className={buttonBaseClass}>
          <LinkIcon className="w-5 h-5" />
        </button>
        <button
          onClick={toggleDirection}
          title={`Text Direction: ${isRTL ? "RTL" : "LTR"}`}
          className={`p-1.5 sm:p-1 flex items-center ${isRTL ? "bg-blue-100 dark:bg-blue-900" : ""} hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded`}
        >
          <Type className="w-5 h-5 mr-1" />
          <span>{isRTL ? "RTL" : "LTR"}</span>
        </button>
        <select
          title="Font Family"
          className="p-1.5 sm:p-1 text-base md:text-sm border rounded bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={fontFamily}
          onChange={(e) => handleFontChange("fontName", e.target.value)}
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select
          title="Font Size"
          className="p-1.5 sm:p-1 text-base md:text-sm border rounded bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={fontSize}
          onChange={(e) => handleFontChange("fontSize", e.target.value)}
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Content Editable Area */}
      {/* - flex-grow: This area takes up remaining vertical space within EditorPane. */}
      {/* - overflow-auto: THIS IS WHERE THE SCROLLING FOR THE CONTENT HAPPENS. */}
      <div
        ref={editorRef}
        dir={isRTL ? "rtl" : "ltr"}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="editor-pane prose prose-base md:prose-sm dark:prose-invert max-w-none w-full flex-grow p-3 border-t border-zinc-300 dark:border-zinc-600 rounded-b resize-y overflow-auto focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-zinc-100 prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:underline whitespace-pre-wrap prose-code:before:content-none prose-code:after:content-none prose-pre:bg-inherit dark:prose-pre:bg-inherit prose-pre:p-0"
        role="textbox"
        aria-multiline="true"
      />
    </div>
  );
};

export default EditorPane;