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
  Code as CodeIcon,
  SquareCode as CodeBlockIcon,
  TerminalSquare as ShellIcon,
  List as UnorderedListIcon,
  ListOrdered as OrderedListIcon,
  // ImageIcon is removed as per the new request to only support pasting images
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

const isValidNode = (node) => {
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
  const [fontSize, setFontSize] = useState(defaultFontSize || FONT_SIZES[2]);
  const [isRTL, setIsRTL] = useState(false);
  const editorRef = useRef(null);
  const propUpdateInProgress = useRef(false);
  const [typingTimeout, setTypingTimeout] = useState(null);

  const handleContentChangeInternal = useCallback(
    (newHtml) => {
      if (onChange) {
        onChange(newHtml);
      }
    },
    [onChange]
  );

  useEffect(() => {
    if (editorRef.current && html !== editorRef.current.innerHTML) {
      propUpdateInProgress.current = true;
      const currentScrollTop = editorRef.current.scrollTop;
      const selection = window.getSelection();
      const range =
        selection && selection.rangeCount > 0
          ? selection.getRangeAt(0).cloneRange()
          : null;
      const activeElement = document.activeElement;

      editorRef.current.innerHTML = html;
      editorRef.current.scrollTop = currentScrollTop;

      try {
        if (range && editorRef.current.contains(activeElement)) {
          if (
            isValidNode(range.startContainer) &&
            isValidNode(range.endContainer)
          ) {
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

  // Modified Paste Handler
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handlePasteEvent = (e) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // Check for image files in the clipboard
      const items = clipboardData.items;
      let imageFile = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          imageFile = items[i].getAsFile();
          break;
        }
      }

      if (imageFile) {
        e.preventDefault(); // Prevent default paste behavior for the image
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64ImageData = event.target.result;
          const imgHtml = `<img src="${base64ImageData}" alt="Pasted Image" style="max-width: 100%; height: auto; display: block; margin: 10px 0;" />`;
          editorRef.current?.focus(); // Ensure editor is focused
          document.execCommand("insertHTML", false, imgHtml);
          requestAnimationFrame(() => {
            if (editorRef.current)
              handleContentChangeInternal(editorRef.current.innerHTML);
          });
        };
        reader.readAsDataURL(imageFile);
      } else {
        // If no image, handle as text (for URL auto-linking, etc.)
        e.preventDefault(); // Still prevent default to control how text is inserted
        const text = clipboardData.getData("text/plain");
        if (!text) return;

        const linkedHtml = text.replace(URL_REGEX, (match) =>
          createLinkHtml(match, match)
        );
        editorRef.current?.focus();
        document.execCommand("insertHTML", false, linkedHtml);
        requestAnimationFrame(() => {
          if (editorRef.current)
            handleContentChangeInternal(editorRef.current.innerHTML);
        });
      }
    };

    editor.addEventListener("paste", handlePasteEvent);
    return () => {
      if (editorRef.current) {
        editorRef.current.removeEventListener("paste", handlePasteEvent);
      }
    };
  }, [handleContentChangeInternal]); // handleContentChangeInternal is a dependency

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

  useEffect(() => {
    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [typingTimeout]);

  const applyCommand = useCallback(
    (cmd, value = null) => {
      editorRef.current?.focus();
      try {
        document.execCommand(cmd, false, value);
      } catch (error) {
        console.error(`Error executing command ${cmd}:`, error);
      }
      if (cmd !== "paste") {
        requestAnimationFrame(() => {
          if (editorRef.current)
            handleContentChangeInternal(editorRef.current.innerHTML);
        });
      }
    },
    [handleContentChangeInternal]
  );

  const handleInput = useCallback(
    (event) => {
      if (!editorRef.current || propUpdateInProgress.current) return;
      const newHtml = event.target.innerHTML;
      if (typingTimeout) clearTimeout(typingTimeout);
      setTypingTimeout(
        setTimeout(() => {
          if (!editorRef.current) return;
          const selection = window.getSelection();
          let originalRange = null;
          if (selection && selection.rangeCount > 0) {
            originalRange = selection.getRangeAt(0).cloneRange();
          }
          let madeChanges = false;
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = editorRef.current.innerHTML;
          const textNodesToProcess = [];
          const walker = document.createTreeWalker(
            tempDiv,
            NodeFilter.SHOW_TEXT,
            (node) =>
              node.parentNode.nodeName !== "A"
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT,
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
              const isCompleteUrl =
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
                const linkHtml = createLinkHtml(url, url);
                const tempLinkContainer = document.createElement("div");
                tempLinkContainer.innerHTML = linkHtml;
                if (tempLinkContainer.firstChild) {
                  fragment.appendChild(tempLinkContainer.firstChild);
                } else {
                  fragment.appendChild(document.createTextNode(url));
                }
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
              textNode.parentNode.replaceChild(fragment, textNode);
            }
          });

          if (madeChanges) {
            editorRef.current.innerHTML = tempDiv.innerHTML;
            if (originalRange && selection) {
              try {
                if (
                  isValidNode(originalRange.startContainer) &&
                  isValidNode(originalRange.endContainer) &&
                  editorRef.current.contains(originalRange.startContainer) &&
                  editorRef.current.contains(originalRange.endContainer)
                ) {
                  selection.removeAllRanges();
                  selection.addRange(originalRange);
                } else {
                  const endRange = document.createRange();
                  endRange.selectNodeContents(editorRef.current);
                  endRange.collapse(false);
                  selection.removeAllRanges();
                  selection.addRange(endRange);
                }
              } catch (e) {
                console.warn("Auto-link cursor restoration error:", e);
                const endRange = document.createRange();
                endRange.selectNodeContents(editorRef.current);
                endRange.collapse(false);
                if (selection) {
                  selection.removeAllRanges();
                  selection.addRange(endRange);
                }
              }
            }
            handleContentChangeInternal(editorRef.current.innerHTML);
          }
        }, 700)
      );
      handleContentChangeInternal(newHtml);
    },
    [handleContentChangeInternal, typingTimeout]
  );

  const handlePasteFromClipboard = useCallback(async () => {
    // This function is now primarily for explicit paste button, main logic in useEffect
    if (!navigator.clipboard?.readText) {
      applyCommand("paste");
      return;
    }
    editorRef.current?.focus();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const htmlToInsert = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
          .replace(/\r?\n/g, "<br>");
        document.execCommand("insertHTML", false, htmlToInsert);
      }
      requestAnimationFrame(() => {
        if (editorRef.current)
          handleContentChangeInternal(editorRef.current.innerHTML);
      });
    } catch (err) {
      console.error("Failed to read clipboard or insert HTML: ", err);
      try {
        const success = document.execCommand("paste", false, null);
        if (success && editorRef.current) {
          requestAnimationFrame(() => {
            if (editorRef.current)
              handleContentChangeInternal(editorRef.current.innerHTML);
          });
        } else if (!success) {
          console.warn("Fallback execCommand('paste') also failed.");
        }
      } catch (execErr) {
        console.error("Error during fallback execCommand('paste'):", execErr);
      }
    }
    editorRef.current?.focus();
  }, [applyCommand, handleContentChangeInternal]);

  const applyBlockStyle = useCallback(
    (tag, className = null) => {
      editorRef.current?.focus();
      document.execCommand("formatBlock", false, `<${tag}>`);
      if (className) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          let container = selection.getRangeAt(0).commonAncestorContainer;
          while (container && container !== editorRef.current) {
            if (container.nodeName === tag.toUpperCase()) {
              container.className = className;
              break;
            }
            container = container.parentNode;
          }
        }
      }
      if (tag === "pre" && editorRef.current) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          let block = selection.getRangeAt(0).commonAncestorContainer;
          while (
            block &&
            block.nodeName !== "PRE" &&
            block !== editorRef.current
          ) {
            block = block.parentNode;
          }
          if (
            block &&
            block.nodeName === "PRE" &&
            !block.querySelector("code")
          ) {
            const codeElement = document.createElement("code");
            while (block.firstChild) {
              codeElement.appendChild(block.firstChild);
            }
            block.appendChild(codeElement);
          }
        }
      }
      requestAnimationFrame(() => {
        if (editorRef.current)
          handleContentChangeInternal(editorRef.current.innerHTML);
      });
    },
    [handleContentChangeInternal]
  );

  const applyInlineStyle = useCallback(
    (tag) => {
      editorRef.current?.focus();
      let command = tag;
      if (tag === "code") {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed)
          return;
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();
        let parent = range.commonAncestorContainer;
        if (parent.nodeType !== Node.ELEMENT_NODE) {
          parent = parent.parentNode;
        }
        if (
          parent &&
          parent.nodeName === "CODE" &&
          parent.closest(".editor-pane") === editorRef.current
        ) {
          const textNode = document.createTextNode(parent.textContent);
          parent.parentNode.replaceChild(textNode, parent);
          range.selectNodeContents(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          const codeNode = document.createElement("code");
          codeNode.textContent = selectedText
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          range.deleteContents();
          range.insertNode(codeNode);
          range.selectNodeContents(codeNode);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        command = null;
      } else {
        document.execCommand(command, false, null);
      }
      requestAnimationFrame(() => {
        if (editorRef.current)
          handleContentChangeInternal(editorRef.current.innerHTML);
      });
    },
    [handleContentChangeInternal]
  );

  const handleCreateLink = useCallback(() => {
    editorRef.current?.focus();
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : "";
    let url = prompt(
      "Enter the URL:",
      selectedText.startsWith("http") || selectedText.startsWith("www.")
        ? selectedText
        : "https://"
    );
    if (!url) return;
    const linkHtml = createLinkHtml(url, selectedText);
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      document.execCommand("insertHTML", false, linkHtml);
    } else {
      document.execCommand("insertHTML", false, linkHtml);
    }
    requestAnimationFrame(() => {
      if (editorRef.current)
        handleContentChangeInternal(editorRef.current.innerHTML);
    });
  }, [handleContentChangeInternal]);

  // handleInsertImage by URL is removed as per request to only support pasting.

  const toggleDirection = useCallback(() => {
    setIsRTL((prev) => !prev);
  }, []);
  const handleFontChange = useCallback(
    (command, value) => {
      applyCommand(command, value);
      if (command === "fontName") setFontFamily(value);
      if (command === "fontSize") setFontSize(value);
    },
    [applyCommand]
  );

  const buttonBaseClass =
    "p-1.5 sm:p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded";

  return (
    <div className="flex flex-col flex-grow overflow-hidden border rounded bg-transparent dark:border-zinc-700">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-y-1 p-2 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
        <button
          onClick={() => applyCommand("undo")}
          title="Undo"
          className={buttonBaseClass}
        >
          {" "}
          <Undo className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyCommand("redo")}
          title="Redo"
          className={buttonBaseClass}
        >
          {" "}
          <Redo className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyCommand("cut")}
          title="Cut"
          className={buttonBaseClass}
        >
          {" "}
          <Scissors className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyCommand("copy")}
          title="Copy"
          className={buttonBaseClass}
        >
          {" "}
          <Copy className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={handlePasteFromClipboard}
          title="Paste"
          className={buttonBaseClass}
        >
          {" "}
          <ClipboardPaste className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyInlineStyle("bold")}
          title="Bold"
          className={buttonBaseClass}
        >
          {" "}
          <BoldIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyInlineStyle("italic")}
          title="Italic"
          className={buttonBaseClass}
        >
          {" "}
          <ItalicIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyInlineStyle("underline")}
          title="Underline"
          className={buttonBaseClass}
        >
          {" "}
          <UnderlineIcon className="w-5 h-5" />{" "}
        </button>
        {/* Image button for URL insert is removed */}
        <button
          onClick={() => applyInlineStyle("code")}
          title="Inline Code"
          className={buttonBaseClass}
        >
          {" "}
          <CodeIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyBlockStyle("pre")}
          title="Code Block"
          className={buttonBaseClass}
        >
          {" "}
          <CodeBlockIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyBlockStyle("div", "shell-command")}
          title="Shell Command Block"
          className={buttonBaseClass}
        >
          {" "}
          <ShellIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyCommand("justifyLeft")}
          title="Align Left"
          className={buttonBaseClass}
        >
          {" "}
          <AlignLeft className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyCommand("justifyCenter")}
          title="Align Center"
          className={buttonBaseClass}
        >
          {" "}
          <AlignCenter className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyCommand("justifyRight")}
          title="Align Right"
          className={buttonBaseClass}
        >
          {" "}
          <AlignRight className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyCommand("selectAll")}
          title="Select All"
          className={buttonBaseClass}
        >
          {" "}
          <TextSelect className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyCommand("insertUnorderedList")}
          title="Bulleted List"
          className={buttonBaseClass}
        >
          {" "}
          <UnorderedListIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={() => applyCommand("insertOrderedList")}
          title="Numbered List"
          className={buttonBaseClass}
        >
          {" "}
          <OrderedListIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={handleCreateLink}
          title="Create Link"
          className={buttonBaseClass}
        >
          {" "}
          <LinkIcon className="w-5 h-5" />{" "}
        </button>
        <button
          onClick={toggleDirection}
          title={`Text Direction: ${isRTL ? "RTL" : "LTR"}`}
          className={`p-1.5 sm:p-1 flex items-center ${
            isRTL ? "bg-blue-100 dark:bg-blue-900" : ""
          } hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded`}
        >
          {" "}
          <Type className="w-5 h-5 mr-1" /> <span>{isRTL ? "RTL" : "LTR"}</span>{" "}
        </button>
        <select
          title="Font Family"
          className="p-1.5 sm:p-1 text-base md:text-sm border rounded bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className="p-1.5 sm:p-1 text-base md:text-sm border rounded bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={fontSize}
          onChange={(e) => handleFontChange("fontSize", e.target.value)}
        >
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div
        ref={editorRef}
        dir={isRTL ? "rtl" : "ltr"}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput} // This will also trigger for pastes if not handled by paste event exclusively
        className="editor-pane prose prose-base md:prose-sm dark:prose-invert max-w-none w-full flex-grow p-3 border-t border-zinc-300 dark:border-zinc-600 rounded-b resize-y overflow-auto focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-zinc-100 prose-a:text-blue-600 dark:prose-a:text-blue-400 hover:prose-a:underline whitespace-pre-wrap prose-code:before:content-none prose-code:after:content-none prose-pre:bg-inherit dark:prose-pre:bg-inherit prose-pre:p-0"
        role="textbox"
        aria-multiline="true"
      />
    </div>
  );
};

export default EditorPane;
