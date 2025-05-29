// src/components/ResizableImageNodeView.js

export class ResizableImageNodeView {
    constructor(node, view, getPos, HTMLAttributes) {
        this.node = node;
        this.view = view;
        this.getPos = getPos;
        this.HTMLAttributes = HTMLAttributes;

        this.dom = document.createElement(node.type.spec.inline ? 'span' : 'div');
        this.dom.classList.add('resizable-image-wrapper');
        if (HTMLAttributes.class) {
            this.dom.classList.add(...HTMLAttributes.class.split(' '));
        }
        this.dom.style.position = 'relative';
        this.dom.style.display = node.type.spec.inline ? 'inline-block' : 'block';
        // this.dom.style.lineHeight = '0'; // Removed for better vertical alignment with text

        this.img = document.createElement('img');
        this.img.setAttribute('src', node.attrs.src || '');
        if (node.attrs.alt) this.img.setAttribute('alt', node.attrs.alt);
        if (node.attrs.title) this.img.setAttribute('title', node.attrs.title);

        this.img.style.height = 'auto';
        this.img.style.display = 'block'; // Image is block inside wrapper for clean layout

        const nodeWidthAttr = node.attrs.width;
        if (nodeWidthAttr && nodeWidthAttr !== 'auto' && nodeWidthAttr !== null && String(nodeWidthAttr).endsWith('px')) {
            this.dom.style.width = nodeWidthAttr;
            this.img.style.width = '100%';
        } else {
            this.dom.style.width = 'auto';
            this.img.style.width = 'auto';
            this.img.style.maxWidth = '100%';
        }
        this.dom.style.maxWidth = '100%';


        this.dom.appendChild(this.img);

        this.handle = document.createElement('div');
        this.handle.classList.add('resize-handle');
        this.dom.appendChild(this.handle);

        this.handle.addEventListener('mousedown', this.startResize.bind(this));
        this.dom.contentEditable = 'false';
    }

    selectNode() {
        this.dom.classList.add('ProseMirror-selectednode');
    }

    deselectNode() {
        this.dom.classList.remove('ProseMirror-selectednode');
    }

    startResize(event) {
        event.preventDefault();
        this.isResizing = true;
        this.startX = event.clientX;
        this.startWidth = this.dom.offsetWidth;

        const onMouseMove = (e) => {
            if (!this.isResizing) return;
            e.preventDefault();
            const diffX = e.clientX - this.startX;
            let newWidth = this.startWidth + diffX;
            newWidth = Math.max(50, newWidth);

            this.dom.style.width = `${newWidth}px`;
            this.img.style.width = '100%'; // Ensure image fills wrapper after resize
            this.img.style.maxWidth = ''; // Remove explicit max-width on image if wrapper has fixed width
        };

        const onMouseUp = (e) => {
            if (!this.isResizing) return;
            e.preventDefault();
            this.isResizing = false;

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            const finalWidth = this.dom.style.width;

            if (typeof this.getPos === 'function' && this.view) {
                const transaction = this.view.state.tr.setNodeMarkup(this.getPos(), null, {
                    ...this.node.attrs,
                    width: finalWidth,
                });
                this.view.dispatch(transaction);
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    update(node) {
        if (node.type !== this.node.type) {
            return false;
        }

        if (node.attrs.src !== this.node.attrs.src) {
            this.img.setAttribute('src', node.attrs.src || '');
        }
        if (node.attrs.alt !== this.node.attrs.alt) {
            this.img.setAttribute('alt', node.attrs.alt || '');
        }
        if (node.attrs.title !== this.node.attrs.title) {
            this.img.setAttribute('title', node.attrs.title || '');
        }

        const newWidthAttr = node.attrs.width;
        const currentDomWidth = this.dom.style.width;

        if (newWidthAttr !== this.node.attrs.width || currentDomWidth !== newWidthAttr) {
            if (newWidthAttr && newWidthAttr !== 'auto' && newWidthAttr !== null && String(newWidthAttr).endsWith('px')) {
                this.dom.style.width = newWidthAttr;
                this.img.style.width = '100%';
                this.img.style.maxWidth = '';
            } else {
                this.dom.style.width = 'auto';
                this.img.style.width = 'auto';
                this.img.style.maxWidth = '100%';
            }
        }

        this.node = node;
        return true;
    }

    destroy() {
        this.handle.removeEventListener('mousedown', this.startResize);
    }

    ignoreMutation() {
        return true;
    }
}

export default ResizableImageNodeView;