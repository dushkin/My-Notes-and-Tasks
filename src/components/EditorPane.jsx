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
} from "lucide-react";

const FONT_FAMILIES = [
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
];

const FONT_SIZES = ["1", "2", "3", "4", "5", "6", "7"];

const EditorPane = ({ html = "", onChange }) => {
  const [currentHtml, setCurrentHtml] = useState(html);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0]);
  const [fontSize, setFontSize] = useState(FONT_SIZES[2]);
  const editorRef = useRef(null);

  useEffect(() => {
    setCurrentHtml(html);
    if (editorRef.current) editorRef.current.innerHTML = html;
  }, [html]);

  const handleInput = () => {
    const newHtml = editorRef.current.innerHTML;
    setCurrentHtml(newHtml);
    onChange(newHtml);
  };

  const applyCommand = (cmd, value = null) => {
    document.execCommand(cmd, false, value);
    editorRef.current.focus();
  };

  return (
    <div className="p-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => applyCommand("undo")}>
          <Undo />
        </button>
        <button onClick={() => applyCommand("redo")}>
          <Redo />
        </button>
        <button onClick={() => applyCommand("bold")}>
          <BoldIcon />
        </button>
        <button onClick={() => applyCommand("italic")}>
          <ItalicIcon />
        </button>
        <button onClick={() => applyCommand("underline")}>
          <UnderlineIcon />
        </button>
        <button onClick={() => applyCommand("cut")}>
          <Scissors />
        </button>
        <button onClick={() => applyCommand("copy")}>
          <Copy />
        </button>
        <button onClick={() => applyCommand("paste")}>
          <ClipboardPaste />
        </button>
        <button onClick={() => applyCommand("selectAll")}>
          <TextSelect />
        </button>
        <button onClick={() => applyCommand("justifyLeft")}>
          <AlignLeft />
        </button>
        <button onClick={() => applyCommand("justifyRight")}>
          <AlignRight />
        </button>

        <select
          className="text-gray-600 dark:text-gray-400"
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
          className="text-gray-600 dark:text-gray-400"
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

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="w-full h-64 p-2 border rounded resize-y overflow-auto text-gray-900 dark:text-white bg-white dark:bg-gray-900"
      />
    </div>
  );
};
export default EditorPane;
