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
} from "lucide-react";

const FONT_FAMILIES = ["Arial", "Times New Roman", "Courier New", "Georgia", "Verdana"];
const FONT_SIZES = ["1", "2", "3", "4", "5", "6", "7"];

const EditorPane = ({ html = "", onChange }) => {
  const [currentHtml, setCurrentHtml] = useState(html);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0]);
  const [fontSize, setFontSize] = useState(FONT_SIZES[2]);
  const [isRTL, setIsRTL] = useState(false);
  const editorRef = useRef(null);

  // Sync incoming html without changing direction
  useEffect(() => {
    if (editorRef.current && html !== currentHtml) {
      editorRef.current.innerHTML = html;
      setCurrentHtml(html);
    }
  }, [html]);

  // Apply RTL/LTR direction when toggle button is clicked
  useEffect(() => {
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
  }, []);

  const handleInput = () => {
    if (!editorRef.current) return;
    
    const newHtml = editorRef.current.innerHTML;
    setCurrentHtml(newHtml);
    onChange(newHtml);
  };

  // Toggle direction manually
  const toggleDirection = () => {
    setIsRTL(!isRTL);
  };

  const applyCommand = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
    if (editorRef.current) editorRef.current.focus();
  };

  return (
    <div className="p-4 space-y-2">
      {/* Toolbar with tooltips */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => applyCommand("undo")} title="Undo" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <Undo className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("redo")} title="Redo" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <Redo className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("bold")} title="Bold" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <BoldIcon className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("italic")} title="Italic" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <ItalicIcon className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("underline")} title="Underline" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <UnderlineIcon className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("cut")} title="Cut" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <Scissors className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("copy")} title="Copy" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <Copy className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("paste")} title="Paste" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <ClipboardPaste className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("selectAll")} title="Select All" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <TextSelect className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("justifyLeft")} title="Align Left" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <AlignLeft className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("justifyCenter")} title="Align Center" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <AlignCenter className="w-5 h-5" />
        </button>
        <button onClick={() => applyCommand("justifyRight")} title="Align Right" className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <AlignRight className="w-5 h-5" />
        </button>
        
        <button 
          onClick={toggleDirection} 
          title={`Text Direction: ${isRTL ? 'RTL' : 'LTR'}`}
          className={`p-1 flex items-center ${isRTL ? 'bg-blue-100 dark:bg-blue-900' : ''} hover:bg-gray-100 dark:hover:bg-gray-700 rounded`}
        >
          <Type className="w-5 h-5 mr-1" />
          <span>{isRTL ? 'RTL' : 'LTR'}</span>
        </button>

        <select
          title="Font Family"
          className="p-1 text-sm border rounded text-gray-600 dark:text-gray-400"
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
          className="p-1 text-sm border rounded text-gray-600 dark:text-gray-400"
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

      {/* Editor area with explicit direction setting */}
      <div
        ref={editorRef}
        dir={isRTL ? "rtl" : "ltr"}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="w-full h-64 p-2 border rounded resize-y overflow-auto text-gray-900 dark:text-white bg-white dark:bg-gray-900"
      />
    </div>
  );
};

export default EditorPane;