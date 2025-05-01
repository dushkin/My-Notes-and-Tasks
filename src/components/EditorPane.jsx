import React, { useState, useRef, useEffect } from "react";
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

  // Remove any trailing punctuation that might have been accidentally included
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
      editorRef.current.innerHTML = html;
      editorRef.current.scrollTop = currentScrollTop;
      try {
        const range = document.createRange();
        const sel = window.getSelection();
        if (sel && editorRef.current.childNodes.length > 0) {
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        } else if (sel) {
          editorRef.current.focus();
        }
      } catch (e) {
        console.error("Error setting cursor position:", e);
        editorRef.current?.focus();
      }
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
        onChange(editorRef.current.innerHTML);
      }
    };

    editor.addEventListener("paste", handlePaste);
    return () => editor.removeEventListener("paste", handlePaste);
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

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [typingTimeout]);

  const handleInput = (event) => {
    if (!editorRef.current || propUpdateInProgress.current) return;
  
    const newHtml = event.target.innerHTML;
    
    // Clear any pending timeout
    if (typingTimeout) clearTimeout(typingTimeout);
  
    // Set new timeout with smarter conditions
    setTypingTimeout(setTimeout(() => {
      if (!editorRef.current) return;
  
      // Save selection
      const selection = window.getSelection();
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const cursorNode = range?.startContainer;
      const cursorOffset = range?.startOffset;
  
      // Create temporary div to parse HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newHtml;
  
      // Find all text nodes not already in links
      const textNodes = [];
      const walker = document.createTreeWalker(
        tempDiv,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
  
      let node;
      while ((node = walker.nextNode())) {
        if (node.parentNode.nodeName !== 'A') {
          textNodes.push(node);
        }
      }
  
      // Process each text node for URLs
      let madeChanges = false;
      textNodes.forEach(textNode => {
        const text = textNode.nodeValue;
        let newText = '';
        let lastIndex = 0;
  
        // Find URLs but only link complete ones
        const urlMatches = [...text.matchAll(URL_REGEX)];
        urlMatches.forEach(match => {
          const url = match[0];
          const matchIndex = match.index;
  
          // Only link if:
          // 1. URL is at least 8 chars (like "http://a")
          // 2. Is followed by space/punctuation/end
          // 3. Is preceded by space/punctuation/start
          const isCompleteUrl = (
            url.length >= 8 &&
            (matchIndex + url.length === text.length || 
             /[\s.,;!?)]/.test(text[matchIndex + url.length])) &&
            (matchIndex === 0 || 
             /[\s.,;!?(]/.test(text[matchIndex - 1]))
          );
  
          if (isCompleteUrl) {
            // Add text before URL
            newText += text.substring(lastIndex, matchIndex);
            // Add linked URL
            newText += createLinkHtml(url, url);
            lastIndex = matchIndex + url.length;
            madeChanges = true;
          }
        });
  
        // Add remaining text after last URL
        newText += text.substring(lastIndex);
  
        if (madeChanges) {
          const wrapper = document.createElement('span');
          wrapper.innerHTML = newText;
          textNode.parentNode.replaceChild(wrapper, textNode);
        }
      });
  
      if (madeChanges) {
        propUpdateInProgress.current = true;
        const linkedHtml = tempDiv.innerHTML;
        
        // Update content
        editorRef.current.innerHTML = linkedHtml;
  
        // Smart cursor restoration
        if (range && cursorNode && cursorOffset !== undefined) {
          try {
            // Find equivalent position in new content
            const newRange = document.createRange();
            let found = false;
            
            // If cursor was at end of text, put it after changes
            if (cursorNode.nodeType === Node.TEXT_NODE && 
                cursorOffset === cursorNode.nodeValue.length) {
              newRange.selectNodeContents(editorRef.current);
              newRange.collapse(false);
              found = true;
            } 
            // Otherwise try to find original position
            else if (isValidNode(cursorNode)) {
              newRange.setStart(cursorNode, Math.min(cursorOffset, cursorNode.length || 0));
              newRange.collapse(true);
              found = true;
            }
  
            if (found) {
              selection.removeAllRanges();
              selection.addRange(newRange);
            }
          } catch (e) {
            console.error("Cursor restoration error:", e);
            // Fallback to end
            const endRange = document.createRange();
            endRange.selectNodeContents(editorRef.current);
            endRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(endRange);
          }
        }
  
        onChange(linkedHtml);
        propUpdateInProgress.current = false;
      }
    }, 600)); // Slightly longer delay for more natural typing
    
    onChange(newHtml);
  };

  // Toggle text direction
  const toggleDirection = () => {
    setIsRTL((prevIsRTL) => !prevIsRTL);
  };

  // Apply formatting commands
  const applyCommand = (cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    setTimeout(() => {
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }, 0);
  };

  // Link Button Handler
  const handleCreateLink = () => {
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
    document.execCommand("insertHTML", false, linkHtml);

    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="p-4 space-y-2 border rounded bg-white dark:bg-zinc-800">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pb-2 border-b border-zinc-200 dark:border-zinc-700">
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
        <button
          onClick={() => applyCommand("selectAll")}
          title="Select All"
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
        >
          <TextSelect className="w-5 h-5" />
        </button>
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
        <select
          title="Font Family"
          className="p-1 text-sm border rounded bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600"
          value={fontFamily}
          onChange={(e) => {
            applyCommand("fontName", e.target.value);
            setFontFamily(e.target.value);
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
          className="p-1 text-sm border rounded bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600"
          value={fontSize}
          onChange={(e) => {
            applyCommand("fontSize", e.target.value);
            setFontSize(e.target.value);
          }}
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
        className="prose prose-sm dark:prose-invert max-w-none w-full min-h-[10rem] h-64 p-2 border border-zinc-300 dark:border-zinc-600 rounded resize-y overflow-auto focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-zinc-100 bg-white dark:bg-zinc-900 prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:underline whitespace-pre-wrap"
      />
    </div>
  );
};

export default EditorPane;