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
      let tr = null;
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
        const targetDirection = shouldBeRTL ? 'rtl' : 'ltr';
        
        // Get current alignment and direction
        const currentAlignment = node.attrs.textAlign || 'left';
        const currentDirection = node.attrs.dir || 'ltr';
        
        // Only update if alignment or direction needs to change
        if (currentAlignment !== targetAlignment || currentDirection !== targetDirection) {
          // Create transaction lazily only when needed
          if (!tr) {
            tr = state.tr;
          }
          
          try {
            tr.setNodeMarkup(pos, null, {
              ...node.attrs,
              textAlign: targetAlignment,
              dir: targetDirection
            });
            modified = true;
          } catch (error) {
            console.warn('[AutoRTLAlignment] Failed to set node markup:', error);
            return false; // Stop processing on error
          }
        }
      });

      return modified ? tr : null;
    };

    return [
      new Plugin({
        key: new PluginKey('autoRTLAlignment'),
        
        // Remove problematic init state handler
        state: {
          init: () => ({}),
          apply: (tr, pluginState) => pluginState,
        },

        // Process alignment on content changes only
        appendTransaction: (transactions, oldState, newState) => {
          // Skip if no content changes or if we're already processing RTL changes
          const hasContentChange = transactions.some(tr => 
            tr.docChanged && !tr.getMeta('autoRTLAlignment')
          );
          
          if (!hasContentChange) return null;

          try {
            const tr = processAlignment(newState);
            if (tr) {
              // Mark this transaction to avoid infinite loops
              tr.setMeta('autoRTLAlignment', true);
            }
            return tr;
          } catch (error) {
            console.warn('[AutoRTLAlignment] Transaction error:', error);
            return null;
          }
        },
      }),
    ];
  },
});

export default AutoRTLAlignment;