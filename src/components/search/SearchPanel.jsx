import React, { useEffect, useRef, useState } from "react";
import { matchText } from "../../utils/searchUtils";
const defaultOptions = {
  caseSensitive: false,
  wholeWord: false,
  useRegex: false,
};

export default function SearchPanel({
  searchItems,
  initialQuery = "",
  options = defaultOptions,
  onClose,
}) {
  const [query, setQuery] = useState(initialQuery);
  const [opts, setOpts] = useState(options);
  const [results, setResults] = useState([]);
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setResults(searchItems(query, opts));
  }, [query, opts, searchItems]);

  return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-700 shadow-lg">
      {/* Header */}
      <div className="p-2 border-b border-zinc-700 flex items-center space-x-2">
        <input
          autoFocus
          type="text"
          aria-label="Search items"
          ref={inputRef}
          className="flex-1 px-2 py-1 rounded bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          placeholder="Search..."
          value={query ?? ""}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          onClick={onClose}
          className="px-2 py-1 rounded hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          title="Close"
        >
          ✕
        </button>
      </div>
      {/* Options */}
      <div className="p-2 flex space-x-3 text-xs">
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={opts.caseSensitive}
            onChange={(e) =>
              setOpts({ ...opts, caseSensitive: e.target.checked })
            }
            className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          />
          <span>Case-sensitive</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={opts.wholeWord}
            onChange={(e) =>
              setOpts({ ...opts, wholeWord: e.target.checked })
            }
            className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          />
          <span>Whole word</span>
        </label>
        <label
          className="flex items-center space-x-1 cursor-not-allowed"
          title="RegEx search will be implemented in the future"
        >
          <input
            type="checkbox"
            checked={opts.useRegex}
            onChange={(e) => setOpts({ ...opts, useRegex: e.target.checked })}
            disabled={true}
            className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          />
          <span className="opacity-50">RegEx</span>
        </label>
      </div>
      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Results list */}
        <div className="w-44 border-r border-zinc-800 overflow-auto">
          {results.map((item) => (
            <div
              key={item.id}
              onClick={() => setPreview(item)}
              className="p-2 cursor-pointer border-b border-zinc-800 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              tabIndex={0}
              role="button"
            >
              <p className="text-sm font-medium">{item.label || item.title}</p>
            </div>
          ))}
        </div>
        {/* Preview */}
        <div className="flex-1 overflow-auto p-4">
          {preview ? (
            <>
              <h3 className="text-lg font-semibold mb-2">
                {preview.label || preview.title}
              </h3>
              <pre className="whitespace-pre-wrap">
                {preview.content || preview.text}
              </pre>
            </>
          ) : (
            <p className="text-zinc-500">Select a result to preview.</p>
          )}
        </div>
      </div>
    </div>
  );
}
