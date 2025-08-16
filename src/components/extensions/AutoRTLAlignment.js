import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { isRTLText } from '../../utils/rtlUtils';

/**
 * TipTap extension that automatically detects RTL/LTR content in each paragraph/heading
 * and applies appropriate text alignment based on the content.
 */
export const AutoRTLAlignment = Extension.create({
  name: 'autoRTLAlignment',

  addOptions() {
    return {
      // Types of nodes to apply auto-alignment to
      types: ['paragraph', 'heading'],
      // Minimum text length to trigger detection
      minLength: 1,
    };
  },

  addProseMirrorPlugins() {
    const processAlignment = (state) => {
      const tr = state.tr;
      let modified = false;

      // Walk through all nodes in the document
      state.doc.descendants((node, pos) => {
        // Only process supported node types
        if (!this.options.types.includes(node.type.name)) {
          return;
        }

        // Skip empty nodes or nodes shorter than minimum length
        const textContent = node.textContent.trim();
        if (!textContent || textContent.length < this.options.minLength) {
          return;
        }

        // Detect if content is RTL or LTR
        const shouldBeRTL = isRTLText(textContent);
        const targetAlignment = shouldBeRTL ? 'right' : 'left';
        
        // Get current alignment
        const currentAlignment = node.attrs.textAlign || 'left';
        
        // Only update if alignment needs to change
        if (currentAlignment !== targetAlignment) {
          tr.setNodeMarkup(pos, null, {
            ...node.attrs,
            textAlign: targetAlignment
          });
          modified = true;
        }
      });

      return modified ? tr : null;
    };

    return [
      new Plugin({
        key: new PluginKey('autoRTLAlignment'),
        
        // Process alignment when editor content is set/loaded
        state: {
          init: (config, state) => {
            // Process initial content alignment
            setTimeout(() => {
              const tr = processAlignment(state);
              if (tr && this.editor?.view) {
                this.editor.view.dispatch(tr);
              }
            }, 0);
            return {};
          },
          apply: (tr, pluginState) => pluginState,
        },

        // Process alignment on content changes
        appendTransaction: (transactions, oldState, newState) => {
          // Only process if there was actual content change
          const hasContentChange = transactions.some(tr => tr.docChanged);
          if (!hasContentChange) return null;

          return processAlignment(newState);
        },
      }),
    ];
  },
});

export default AutoRTLAlignment;