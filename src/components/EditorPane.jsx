// src/components/EditorPane.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  Undo, Redo, Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon,
  Scissors, Copy, ClipboardPaste, TextSelect, AlignLeft, AlignRight, AlignCenter, Type,
} from "lucide-react";

const FONT_FAMILIES = ["Arial", "Times New Roman", "Courier New", "Georgia", "Verdana"];
const FONT_SIZES = ["1", "2", "3", "4", "5", "6", "7"]; // Corresponds to <font size="...">

const EditorPane = ({ html = "", onChange }) => {
  // Internal state for editor controls
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0]);
  const [fontSize, setFontSize] = useState(FONT_SIZES[2]);
  const [isRTL, setIsRTL] = useState(false); // Default to LTR
  const editorRef = useRef(null);
  // Ref to track if the last update came from the prop to avoid loops
  const propUpdateInProgress = useRef(false);

  // Effect to update the editor's content ONLY when the html prop changes externally
  useEffect(() => {
    if (editorRef.current && html !== editorRef.current.innerHTML) {
      console.log(`EditorPane useEffect [html]: Prop 'html' ("${html}") differs from current innerHTML ("${editorRef.current.innerHTML}"). Updating editor.`);
      propUpdateInProgress.current = true; // Signal that the next input event is programmatic
      editorRef.current.innerHTML = html; // Update the displayed content

      // Attempt to restore cursor position (basic example: move to end)
      // This is complex and might not work perfectly in all cases.
      try {
          const range = document.createRange();
          const sel = window.getSelection();
          if (sel && editorRef.current.childNodes.length > 0) {
              // Select the last node within the contentEditable div
              range.selectNodeContents(editorRef.current);
              range.collapse(false); // Collapse the range to the end point
              sel.removeAllRanges(); // Remove any existing selection
              sel.addRange(range); // Add the new range
          } else if (sel) {
              // If empty, just focus
              editorRef.current.focus();
          }
      } catch (e) {
          console.error("Error setting cursor position:", e);
          editorRef.current.focus(); // Fallback focus
      }

    }
  }, [html]); // Rerun only when the html prop changes

  // Effect to apply RTL/LTR direction attribute when isRTL state changes
  useEffect(() => {
    console.log(`EditorPane useEffect [isRTL]: Applying direction. isRTL = ${isRTL}`);
    if (editorRef.current) {
      editorRef.current.dir = isRTL ? "rtl" : "ltr";
    }
  }, [isRTL]);

  // Auto-link URLs on paste
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const URL_REGEX = /(\bhttps?:\/\/[^\s]+)/g;
    const handlePaste = (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text");
        const linked = text.replace(
            URL_REGEX,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );
        document.execCommand("insertHTML", false, linked);
     };
    editor.addEventListener("paste", handlePaste);
    return () => editor.removeEventListener("paste", handlePaste);
  }, []); // Run only on mount

  // Handle user input in the contentEditable div
  const handleInput = (event) => {
    if (!editorRef.current) return;

    // If the update was triggered by the useEffect syncing the prop, ignore this input event
    if (propUpdateInProgress.current) {
        propUpdateInProgress.current = false; // Reset the flag
        console.log("EditorPane handleInput: Ignoring input triggered by prop update.");
        return;
    }

    // Otherwise, it's user input, get the new HTML and call onChange
    const newHtml = event.target.innerHTML; // Read from event target for reliability
    const newText = event.target.textContent;
    console.log(`EditorPane handleInput: User input detected. innerHTML="${newHtml}", textContent="${newText}"`);
    onChange(newHtml); // Pass the HTML upwards
  };

  // Toggle text direction state
  const toggleDirection = () => {
    console.log(`EditorPane toggleDirection: Toggling direction. Current isRTL = ${isRTL}`);
    setIsRTL(prevIsRTL => !prevIsRTL);
  };

  // Apply formatting commands
  const applyCommand = (cmd, value = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    editorRef.current?.focus(); // Re-focus might be necessary
    // Manually trigger input handler after command to save state
    // Need a slight delay to ensure DOM updates after execCommand
    setTimeout(() => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    }, 0);
  };

  return (
    <div className="p-4 space-y-2 border rounded bg-white dark:bg-zinc-800">
      {/* Toolbar - RESTORED BUTTONS */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 pb-2 border-b border-zinc-200 dark:border-zinc-700">
         <button onClick={() => applyCommand("undo")} title="Undo" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"><Undo className="w-5 h-5" /></button>
         <button onClick={() => applyCommand("redo")} title="Redo" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"><Redo className="w-5 h-5" /></button>
         <button onClick={() => applyCommand("bold")} title="Bold" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"><BoldIcon className="w-5 h-5" /></button>
         <button onClick={() => applyCommand("italic")} title="Italic" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"><ItalicIcon className="w-5 h-5" /></button>
         <button onClick={() => applyCommand("underline")} title="Underline" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"><UnderlineIcon className="w-5 h-5" /></button>
         {/* Standard clipboard commands might be restricted by browser security */}
         {/* <button onClick={() => applyCommand("cut")} title="Cut" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"><Scissors className="w-5 h-5" /></button> */}
         {/* <button onClick={() => applyCommand("copy")} title="Copy" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"><Copy className="w-5 h-5" /></button> */}
         {/* <button onClick={() => applyCommand("paste")} title="Paste" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"><ClipboardPaste className="w-5 h-5" /></button> */}
         <button onClick={() => applyCommand("selectAll")} title="Select All" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"><TextSelect className="w-5 h-5" /></button>
         <button onClick={() => applyCommand("justifyLeft")} title="Align Left" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"><AlignLeft className="w-5 h-5" /></button>
         <button onClick={() => applyCommand("justifyCenter")} title="Align Center" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"><AlignCenter className="w-5 h-5" /></button>
         <button onClick={() => applyCommand("justifyRight")} title="Align Right" className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"><AlignRight className="w-5 h-5" /></button>

         {/* Direction Toggle Button */}
         <button
           onClick={toggleDirection}
           title={`Text Direction: ${isRTL ? 'RTL' : 'LTR'}`}
           className={`p-1 flex items-center ${isRTL ? 'bg-blue-100 dark:bg-blue-900' : ''} hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded`}
         >
           <Type className="w-5 h-5 mr-1" />
           <span>{isRTL ? 'RTL' : 'LTR'}</span>
         </button>

         {/* Font Family Select */}
         <select title="Font Family" className="p-1 text-sm border rounded bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600" value={fontFamily} onChange={(e) => { applyCommand("fontName", e.target.value); setFontFamily(e.target.value); }}>
           {FONT_FAMILIES.map((f) => (<option key={f} value={f}>{f}</option>))}
         </select>

         {/* Font Size Select */}
         <select title="Font Size" className="p-1 text-sm border rounded bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600" value={fontSize} onChange={(e) => { applyCommand("fontSize", e.target.value); setFontSize(e.target.value); }}>
           {FONT_SIZES.map((s) => (<option key={s} value={s}>{s}</option>))}
         </select>
      </div>

      {/* Editor area - REMOVED dangerouslySetInnerHTML */}
      <div
        ref={editorRef}
        dir={isRTL ? "rtl" : "ltr"} // Apply direction based on state
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput} // Use onInput for better handling of content changes
        // Set initial content via useEffect hook now
        className="w-full min-h-[10rem] h-64 p-2 border border-zinc-300 dark:border-zinc-600 rounded resize-y overflow-auto focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-zinc-100 bg-white dark:bg-zinc-900"
      />
    </div>
  );
};

export default EditorPane;
