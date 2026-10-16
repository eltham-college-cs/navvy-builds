/** CodeMirror 6 set up for HTML, with CSS highlighted inside <style>. */
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { bracketMatching, defaultHighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view';

export interface Editor {
  view: EditorView;
  getCode(): string;
  setCode(code: string): void;
  goToLine(line: number): void;
  focus(): void;
}

interface Options {
  parent: HTMLElement;
  doc: string;
  label: string;
  onChange(code: string): void;
  /** Esc leaves the editor; focus moves to the next control. */
  onEscape(): void;
}

const theme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '16px',
    backgroundColor: '#FFFFFF',
  },
  '.cm-scroller': {
    fontFamily: "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace",
    lineHeight: '1.6',
  },
  '.cm-content': { padding: '10px 0', caretColor: '#0A1B2E' },
  '.cm-gutters': { backgroundColor: '#F3F6FA', color: '#5B6573', border: 'none', borderRight: '1px solid #D7E3EF' },
  '.cm-activeLine': { backgroundColor: '#FFF8E1' },
  '.cm-activeLineGutter': { backgroundColor: '#FFE08A', color: '#0A1B2E' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftWidth: '2px', borderLeftColor: '#0A1B2E' },
  '&.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#BFDDF7' },
  '.cm-selectionBackground': { backgroundColor: '#D7E3EF' },
});

export function createEditor(opts: Options): Editor {
  const view = new EditorView({
    parent: opts.parent,
    state: EditorState.create({
      doc: opts.doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        indentUnit.of('  '),
        EditorState.tabSize.of(2),
        // Students type every closing tag themselves: this is a recap.
        html({ autoCloseTags: false }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
          {
            key: 'Escape',
            run: () => {
              opts.onEscape();
              return true;
            },
          },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': opts.label,
          'aria-describedby': 'editor-keys',
          spellcheck: 'false',
          autocapitalize: 'off',
          autocorrect: 'off',
        }),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) opts.onChange(u.state.doc.toString());
        }),
        theme,
      ],
    }),
  });

  return {
    view,
    getCode: () => view.state.doc.toString(),
    setCode: (code) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } }),
    goToLine: (line) => {
      const l = view.state.doc.line(Math.min(Math.max(1, line), view.state.doc.lines));
      view.dispatch({ selection: { anchor: l.to }, scrollIntoView: true });
      view.focus();
    },
    focus: () => view.focus(),
  };
}
