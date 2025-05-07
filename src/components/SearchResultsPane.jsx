// src/components/SearchResultsPane.jsx
import React from "react";
import { CaseSensitive, WholeWord, Regex, XCircle } from "lucide-react";

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HighlightMultiple = ({ text, query, opts }) => {
  if (!text || !query) {
    return <>{text}</>;
  }
  const flags = opts.caseSensitive ? "g" : "gi";
  let regex;
  try {
    const pattern = opts.useRegex ? query : escapeRegex(query);
    regex = new RegExp(pattern, flags);
  } catch (e) {
    return <>{text}</>;
  }
  const parts = [];
  let lastIndex = 0;
  let match;
  const textToSearch = String(text);

  while ((match = regex.exec(textToSearch)) !== null) {
    if (match.index > lastIndex) {
      parts.push(textToSearch.substring(lastIndex, match.index));
    }
    parts.push(
      <strong
        key={match.index + "-" + match[0]}
        className="text-yellow-600 dark:text-yellow-300 bg-yellow-200 dark:bg-yellow-700/50 px-0.5 rounded"
      >
        {match[0]}
      </strong>
    );
    lastIndex = regex.lastIndex;
    if (opts.useRegex && match[0].length === 0) {
      regex.lastIndex++;
    }
  }
  if (lastIndex < textToSearch.length) {
    parts.push(textToSearch.substring(lastIndex));
  }
  return parts.length > 0 ? <>{parts}</> : <>{text}</>;
};

const HighlightedPathLabel = ({ pathString, itemLabel, highlightDetails }) => {
  if (!pathString) return <>{pathString}</>;
  const pathParts = pathString.split(" / ");
  const labelFromPath = pathParts[pathParts.length - 1];

  if (
    labelFromPath === itemLabel &&
    highlightDetails &&
    highlightDetails.start !== -1 &&
    highlightDetails.end > highlightDetails.start
  ) {
    const prefix = itemLabel.substring(0, highlightDetails.start);
    const highlighted = itemLabel.substring(
      highlightDetails.start,
      highlightDetails.end
    );
    const suffix = itemLabel.substring(highlightDetails.end);

    pathParts[pathParts.length - 1] = (
      <>
        {prefix}
        <strong className="text-purple-500 dark:text-purple-400 bg-purple-200 dark:bg-purple-700/30 px-0.5 rounded">
          {highlighted}
        </strong>
        {suffix}
      </>
    );
    return (
      <>
        {pathParts.map((part, index) => (
          <React.Fragment key={index}>
            {index > 0 && " / "}
            {part}
          </React.Fragment>
        ))}
      </>
    );
  }
  return <>{pathString}</>;
};

export default function SearchResultsPane({
  query,
  onQueryChange,
  results,
  onSelectResult,
  onClose,
  opts,
  setOpts,
  headerHeightClass,
}) {
  const isRegexEnabledCurrently = false;
  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      <div
        className={`flex items-center space-x-2 p-2 sm:p-3 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0 ${headerHeightClass}`} // Adjusted padding
      >
        <input
          id="global-search-input"
          className="flex-1 px-3 sm:px-2 py-2 sm:py-1 rounded bg-white dark:bg-zinc-800 focus:outline-none text-zinc-900 dark:text-zinc-100 text-base md:text-sm" // Adjusted padding and font
          placeholder="Search..."
          value={query || ""}
          onChange={(e) => onQueryChange(e.target.value)}
          autoFocus
        />
        <div className="flex items-center space-x-1">
          {[
            {
              key: "caseSensitive",
              label: "Case Sensitive",
              Icon: CaseSensitive,
              disabled: false,
            },
            {
              key: "wholeWord",
              label: "Whole Word",
              Icon: WholeWord,
              disabled: false,
            },
            {
              key: "useRegex",
              label: "Use Regular Expression",
              Icon: Regex,
              disabled: !isRegexEnabledCurrently,
            },
          ].map(({ key, label, Icon, disabled }) => (
            <button
              key={key}
              title={disabled ? `${label} (Disabled)` : label}
              onClick={() => {
                if (!disabled) {
                  setOpts((prevOpts) => ({
                    ...prevOpts,
                    [key]: !prevOpts[key],
                  }));
                }
              }}
              disabled={disabled}
              className={`p-1.5 sm:p-1 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                // Adjusted padding
                disabled
                  ? "text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                  : opts[key]
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <Icon className="w-5 h-5 sm:w-4 sm:h-4" />{" "}
              {/* Adjusted icon size */}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 sm:p-1 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded" // Adjusted padding
          title="Close Search"
        >
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {results.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
            No matches.
          </p>
        ) : (
          results.map(
            (
              item // item is a processed search result entry
            ) => (
              <div
                key={item.id}
                onClick={() => onSelectResult(item)}
                className="p-3 sm:p-2 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700" // Increased base padding
              >
                {item.path && (
                  <p
                    className="text-xs text-zinc-500 dark:text-zinc-400 truncate mb-0.5"
                    title={item.path}
                  >
                    <HighlightedPathLabel
                      pathString={item.path}
                      itemLabel={item.label || item.title || ""}
                      highlightDetails={item.pathLabelHighlight}
                    />
                    {item.matchSource && (
                      <span
                        className={`text-xs ml-1 ${
                          item.matchSource === "label"
                            ? "text-blue-400"
                            : item.matchSource === "content"
                            ? "text-green-400"
                            : "text-gray-400"
                        }`}
                      >
                        ({item.matchSource})
                      </span>
                    )}
                  </p>
                )}

                <p
                  className="text-base md:text-sm text-zinc-800 dark:text-zinc-200 max-w-full truncate" // Adjusted font size
                  title={item.displaySnippetText}
                >
                  <HighlightMultiple
                    text={item.displaySnippetText}
                    query={query}
                    opts={opts}
                  />
                </p>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
