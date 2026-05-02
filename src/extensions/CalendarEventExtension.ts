import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CalendarEventComponent from '../components/editor/CalendarEventComponent';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    calendarEvent: {
      insertCalendarEvent: () => ReturnType;
    };
  }
}

const CalendarEventExtension = Node.create({
  name: 'calendarEvent',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      date: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-date') || '',
      },
      sync: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-sync') === 'true',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="calendar-event"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        {
          'data-type': 'calendar-event',
          'data-date': HTMLAttributes.date,
          'data-sync': String(HTMLAttributes.sync),
          class: 'calendar-event-node',
        }
      ),
      `📅 ${HTMLAttributes.date || '---'}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalendarEventComponent, { as: 'span' });
  },

  addCommands() {
    return {
      insertCalendarEvent:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              date: new Date().toISOString().split('T')[0], // Today as default
              sync: false,
            },
          });
        },
    };
  },
});

export default CalendarEventExtension;
