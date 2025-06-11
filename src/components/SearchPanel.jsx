import React, { useState, useEffect } from "react";
import { matchText } from "../utils/searchUtils";

const defaultOptions = { caseSensitive: false, wholeWord: false, useRegex: false };

export default function SearchPanel({ searchItems, initialQuery = "", options = defaultOptions, onClose }) {
  const [query, setQuery] = useState(initialQuery);
  const [opts, setOpts] = useState(options);
  const [results, setResults] = useState([]);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (query) {
      const hits = searchItems(query, opts);
      setResults(hits);
      setPreview(hits[0] || null);
    } else {
      setResults([]);
      setPreview(null);
    }
  }, [query, opts, searchItems]);

  
  if (results.length === 0) {
    return (
      <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-700">
        <div className="p-4 text-sm text-zinc-400">No matches found.</div>
      </div>
    );
  }

return (
    <div className="flex flex-col h-full bg-zinc-900 border-l border-zinc-700 shadow-lg">
      {/* Header */}
      <div className="p-2 border-b border-zinc-700 flex items-center space-x-2">
        <input
          autoFocus
          type="text"
          className="flex-1 px-2 py-1 rounded bg-zinc-800 focus:outline-none"
          placeholder="Search..."
          value={query ?? ""}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          onClick={onClose}
          className="px-2 py-1 rounded hover:bg-zinc-700"
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
            onChange={(e) => setOpts({ ...opts, caseSensitive: e.target.checked })}
          />
          <span>Case</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={opts.wholeWord}
            onChange={(e) => setOpts({ ...opts, wholeWord: e.target.checked })}
          />
          <span>Whole</span>
        </label>
        <label className="flex items-center space-x-1">
          <input
            type="checkbox"
            checked={opts.useRegex}
            onChange={(e) => setOpts({ ...opts, useRegex: e.target.checked })}
          />
          <span>RegEx</span>
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
              className="p-2 cursor-pointer border-b border-zinc-800 hover:bg-zinc-800"
            >
              <p className="text-sm font-medium">{item.label || item.title}</p>
            </div>
          ))}
        </div>
        {/* Preview */}
        <div className="flex-1 overflow-auto p-4">
          {preview ? (
            <>
              <h3 className="text-lg font-semibold mb-2">{preview.label || preview.title}</h3>
              <pre className="whitespace-pre-wrap">{preview.content || preview.text}</pre>
            </>
          ) : (
            <p className="text-zinc-500">Select a result to preview.</p>
          )}
        </div>
      </div>
    </div>
  );
}