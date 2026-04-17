import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer, NodeProps, Node, useUpdateNodeInternals } from '@xyflow/react';

const RectangleNode = ({ data, selected, id }: NodeProps<Node<{ label: string; color: string; width?: number; height?: number; onLabelChange?: (id: string, label: string) => void; onInteraction?: () => void }>>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const updateNodeInternals = useUpdateNodeInternals();

  // Notify React Flow when size changes (due to text editing)
  useEffect(() => {
    updateNodeInternals(id);
  }, [text, isEditing, id, updateNodeInternals]);

  useEffect(() => {
    setText(data.label);
  }, [data.label]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Position cursor at the end
      inputRef.current.setSelectionRange(text.length, text.length);

      // Auto-resize textarea height
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [isEditing]);

  const onBlur = () => {
    setIsEditing(false);
    if (data.onLabelChange) {
      data.onLabelChange(id, text);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onBlur();
    }
  };

  const isDark = (color: string) => {
    if (!color) return true;
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  };

  const textColor = isDark(data.color) ? '#ffffff' : '#1f2937';

  // Dynamic font size based on text length
  const getFontSize = (str: string) => {
    const len = str.length;
    if (len < 10) return '14px';
    if (len < 20) return '12px';
    if (len < 50) return '11px';
    return '10px';
  };

  const fontSize = getFontSize(text);

  return (
    <div
      className="relative min-w-[120px] min-h-[60px] rounded-xl transition-all flex items-center justify-center p-6 group shadow-sm"
      onDoubleClick={() => setIsEditing(true)}
      style={{
        background: data.color || '#ff7f00',
        border: selected ? `3px dashed ${isDark(data.color) ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'}` : '1px solid rgba(0,0,0,0.1)',
        width: 'auto',
        height: 'auto',
      }}
    >
      {isEditing ? (
        <textarea
          ref={inputRef}
          className="nodrag bg-transparent border-none outline-none text-center font-medium text-[11px] tracking-widest w-full resize-none flex items-center justify-center"
          style={{
            color: textColor,
            overflow: 'hidden',
            fontSize: fontSize
          }}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (data.onInteraction) data.onInteraction();
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
      ) : (
        <div className="flex items-center justify-center h-full w-full pointer-events-none select-none min-h-[20px]">
          <span 
            className="text-center font-medium text-[11px] tracking-[0.05em] leading-tight break-words max-w-[300px]"
            style={{ 
              color: textColor,
              fontSize: fontSize
            }}
          >
            {text}
          </span>
        </div>
      )}

      {/* Specialized bidirectional handles with larger hit areas */}
      {/* Target points */}
      <Handle id="top-t" type="target" position={Position.Top} className="w-4 h-4 !bg-gray-400 !border-2 !border-white !opacity-0 group-hover:!opacity-100 transition-opacity -top-2" style={{ zIndex: 10 }} />
      <Handle id="bottom-t" type="target" position={Position.Bottom} className="w-4 h-4 !bg-gray-400 !border-2 !border-white !opacity-0 group-hover:!opacity-100 transition-opacity -bottom-2" style={{ zIndex: 10 }} />
      <Handle id="left-t" type="target" position={Position.Left} className="w-4 h-4 !bg-gray-400 !border-2 !border-white !opacity-0 group-hover:!opacity-100 transition-opacity -left-2" style={{ zIndex: 10 }} />
      <Handle id="right-t" type="target" position={Position.Right} className="w-4 h-4 !bg-gray-400 !border-2 !border-white !opacity-0 group-hover:!opacity-100 transition-opacity -right-2" style={{ zIndex: 10 }} />

      {/* Source points (hidden but functional for dragging) */}
      <Handle id="top-s" type="source" position={Position.Top} className="w-4 h-4 !bg-transparent border-none pointer-events-none -top-2" />
      <Handle id="bottom-s" type="source" position={Position.Bottom} className="w-4 h-4 !bg-transparent border-none pointer-events-none -bottom-2" />
      <Handle id="left-s" type="source" position={Position.Left} className="w-4 h-4 !bg-transparent border-none pointer-events-none -left-2" />
      <Handle id="right-s" type="source" position={Position.Right} className="w-4 h-4 !bg-transparent border-none pointer-events-none -right-2" />
    </div>
  );
};

export const nodeTypes = {
  rectangle: memo(RectangleNode),
};
