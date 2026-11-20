import { useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Link2,
  Maximize2,
  PenLine,
  Plus,
  Trash2,
  Unlink,
  Waypoints,
} from 'lucide-react';
import { useWick } from '../../context/WickContext';
import type { MindstormCardTone, MindstormNode } from '../../types/wick';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { WickButton, WickMenu, WickModal, WickTooltip } from '../ui/WickPrimitives';

const PRESET_ROLES = ['Free Space', 'Note', 'Character', 'Scene Beat', 'Setting', 'Question'];

export function MindstormWorkspace({ boardId }: { boardId?: string }) {
  const {
    mindstormBoards,
    works,
    createBoard,
    updateBoard,
    deleteBoard,
    sendNodesToWrite,
    openMindstormTab,
  } = useWick();

  const board = useMemo(
    () => (boardId ? mindstormBoards.find((b) => b.id === boardId) : mindstormBoards[0]) ?? mindstormBoards[0],
    [mindstormBoards, boardId],
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [customRoleNode, setCustomRoleNode] = useState<MindstormNode | null>(null);
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [sendModalNodes, setSendModalNodes] = useState<MindstormNode[] | null>(null);
  const [showDeleteBoard, setShowDeleteBoard] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    type: 'node' | 'pan';
    nodeId?: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  if (!board) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
        <Waypoints className="w-8 h-8 text-[var(--wick-violet)]" />
        <p className="text-sm text-[var(--wick-muted)]">No Mindstorm boards yet.</p>
        <WickButton label="Create First Board" variant="primary" onClick={() => void createBoard()} />
      </div>
    );
  }

  const addFreeCard = (x = 180, y = 140) => {
    const newNode: MindstormNode = {
      id: `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      x: Math.round(x),
      y: Math.round(y),
      title: '',
      body: '',
      role: 'Free Space',
      tone: 'neutral',
    };
    updateBoard(board.id, { nodes: [...board.nodes, newNode] });
    setSelectedNodeId(newNode.id);
  };

  const updateNode = (nodeId: string, patch: Partial<MindstormNode>) => {
    updateBoard(board.id, {
      nodes: board.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
    });
  };

  const deleteNode = (nodeId: string) => {
    updateBoard(board.id, {
      nodes: board.nodes.filter((n) => n.id !== nodeId),
      edges: board.edges.filter((e) => e.fromId !== nodeId && e.toId !== nodeId),
    });
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    if (connectFromId === nodeId) setConnectFromId(null);
  };

  const toggleConnection = (targetId: string) => {
    if (!connectFromId) {
      setConnectFromId(targetId);
      return;
    }
    if (connectFromId === targetId) {
      setConnectFromId(null);
      return;
    }
    const exists = board.edges.some(
      (e) =>
        (e.fromId === connectFromId && e.toId === targetId) ||
        (e.fromId === targetId && e.toId === connectFromId),
    );
    if (!exists) {
      updateBoard(board.id, {
        edges: [
          ...board.edges,
          { id: `edge-${Date.now().toString(36)}`, fromId: connectFromId, toId: targetId },
        ],
      });
    }
    setConnectFromId(null);
  };

  const removeEdge = (edgeId: string) => {
    updateBoard(board.id, {
      edges: board.edges.filter((e) => e.id !== edgeId),
    });
  };

  const getNodeToneClasses = (tone: MindstormCardTone, isSelected: boolean, isConnecting: boolean) => {
    if (isConnecting) {
      return 'border-[var(--wick-violet)] bg-[var(--wick-elevated)] ring-2 ring-[var(--wick-violet-soft)]';
    }
    if (tone === 'amber') {
      return `bg-[var(--wick-elevated)] ${
        isSelected ? 'border-[var(--wick-amber)]' : 'border-[rgba(224,159,62,0.35)]'
      }`;
    }
    if (tone === 'violet') {
      return `bg-[var(--wick-elevated)] ${
        isSelected ? 'border-[var(--wick-violet)]' : 'border-[rgba(149,130,184,0.38)]'
      }`;
    }
    return `bg-[var(--wick-surface)] ${
      isSelected ? 'border-[var(--wick-border-strong)]' : 'border-[var(--wick-border)]'
    }`;
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom - 120;
    const y = (e.clientY - rect.top - pan.y) / zoom - 50;
    addFreeCard(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (drag.type === 'pan') {
      setPan({ x: drag.origX + dx, y: drag.origY + dy });
    } else if (drag.type === 'node' && drag.nodeId) {
      updateNode(drag.nodeId, {
        x: Math.round(drag.origX + dx / zoom),
        y: Math.round(drag.origY + dy / zoom),
      });
    }
  };

  const handlePointerUp = () => {
    dragStateRef.current = null;
  };

  const selectedNode = board.nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Calm Mindstorm Header Bar */}
      <div className="shrink-0 h-12 px-4 border-b border-[var(--wick-border)] bg-[var(--wick-surface)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <WickMenu
            alignment="start"
            menuWidth={240}
            items={[
              ...mindstormBoards.map((b) => ({
                id: b.id,
                label: b.title,
                description: `${b.nodes.length} cards`,
                onClick: () => {
                  openMindstormTab(b.id);
                  setSelectedNodeId(null);
                  setConnectFromId(null);
                  setPan({ x: 0, y: 0 });
                  setZoom(1);
                },
              })),
              { type: 'divider' },
              {
                id: 'create-board',
                label: 'New Mindstorm Board',
                icon: <Plus className="w-4 h-4" />,
                onClick: () => void createBoard(),
              },
            ]}
            trigger={
              <button
                type="button"
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
              >
                <Waypoints className="w-3.5 h-3.5 text-[var(--wick-violet)]" />
                <span>Boards</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            }
          />

          <input
            type="text"
            value={board.title}
            onChange={(e) => updateBoard(board.id, { title: e.target.value })}
            aria-label="Board title"
            className="bg-transparent border-0 outline-none text-sm font-medium text-[var(--wick-ink)] min-w-[160px] max-w-[320px] truncate"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {connectFromId && (
            <div className="flex items-center gap-2 text-xs text-[var(--wick-violet)] mr-1">
              <span>Click another card to connect</span>
              <button
                type="button"
                onClick={() => setConnectFromId(null)}
                className="underline hover:text-[var(--wick-ink)]"
              >
                Cancel
              </button>
            </div>
          )}

          <WickButton
            label="Add Free Card"
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => addFreeCard(180 - pan.x / zoom, 120 - pan.y / zoom)}
          />

          {selectedNode && (
            <WickButton
              label="Send to Write"
              variant="secondary"
              size="sm"
              icon={<PenLine className="w-3.5 h-3.5" />}
              onClick={() => setSendModalNodes([selectedNode])}
            />
          )}

          {board.nodes.length > 0 && !selectedNode && (
            <WickButton
              label="Draft All in Write"
              variant="ghost"
              size="sm"
              icon={<PenLine className="w-3.5 h-3.5" />}
              onClick={() => setSendModalNodes(board.nodes)}
            />
          )}

          <WickTooltip content="Reset canvas view" placement="below">
            <button
              type="button"
              aria-label="Reset canvas view"
              onClick={() => {
                setPan({ x: 0, y: 0 });
                setZoom(1);
              }}
              className="p-1.5 rounded-md text-[var(--wick-muted)] hover:text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </WickTooltip>

          {mindstormBoards.length > 1 && (
            <WickTooltip content="Delete board" placement="below">
              <button
                type="button"
                aria-label="Delete board"
                onClick={() => setShowDeleteBoard(true)}
                className="p-1.5 rounded-md text-[var(--wick-muted)] hover:text-red-400 hover:bg-[var(--color-overlay-hover)] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </WickTooltip>
          )}
        </div>
      </div>

      {/* Spatial Canvas */}
      <div
        ref={canvasRef}
        onDoubleClick={handleCanvasDoubleClick}
        onPointerDown={(e) => {
          if (e.target === canvasRef.current) {
            setSelectedNodeId(null);
            dragStateRef.current = {
              type: 'pan',
              startX: e.clientX,
              startY: e.clientY,
              origX: pan.x,
              origY: pan.y,
            };
          }
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom((z) => Math.min(1.5, Math.max(0.6, z - e.deltaY * 0.001)));
          }
        }}
        className="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, var(--wick-border-strong) 1px, transparent 1px)',
          backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        <div
          className="absolute inset-0 origin-top-left pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* Connection Threads (SVG) */}
          <svg className="absolute inset-0 w-[4000px] h-[4000px] overflow-visible pointer-events-none">
            {board.edges.map((edge) => {
              const from = board.nodes.find((n) => n.id === edge.fromId);
              const to = board.nodes.find((n) => n.id === edge.toId);
              if (!from || !to) return null;
              const x1 = from.x + 135;
              const y1 = from.y + 72;
              const x2 = to.x + 135;
              const y2 = to.y + 72;
              const mx = (x1 + x2) / 2;
              const pathD = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
              return (
                <g key={edge.id} className="pointer-events-auto cursor-pointer group">
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={14}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEdge(edge.id);
                    }}
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke="var(--wick-violet)"
                    strokeOpacity={0.55}
                    strokeWidth={1.75}
                    className="group-hover:stroke-[var(--wick-amber)] group-hover:stroke-opacity-90 transition-colors"
                  />
                </g>
              );
            })}
          </svg>

          {/* Free Space & Role-Selectable Cards */}
          {board.nodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const isConnecting = node.id === connectFromId;
            return (
              <div
                key={node.id}
                style={{ left: node.x, top: node.y, width: 272 }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (connectFromId) {
                    toggleConnection(node.id);
                  } else {
                    setSelectedNodeId(node.id);
                  }
                }}
                className={`pointer-events-auto absolute rounded-xl border p-3.5 shadow-[var(--wick-shadow-soft)] transition-colors duration-150 ${getNodeToneClasses(
                  node.tone,
                  isSelected,
                  isConnecting,
                )}`}
              >
                {/* Card Drag Handle & Optional Role Selector */}
                <div
                  onPointerDown={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                    dragStateRef.current = {
                      type: 'node',
                      nodeId: node.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: node.x,
                      origY: node.y,
                    };
                  }}
                  className="flex items-center justify-between gap-2 mb-2 cursor-move"
                >
                  <WickMenu
                    alignment="start"
                    menuWidth={185}
                    items={[
                      ...PRESET_ROLES.map((r) => ({
                        id: r,
                        label: r,
                        onClick: () => updateNode(node.id, { role: r }),
                      })),
                      { type: 'divider' },
                      {
                        id: 'custom-role',
                        label: 'Custom role...',
                        onClick: () => {
                          setCustomRoleNode(node);
                          setCustomRoleInput(node.role);
                        },
                      },
                    ]}
                    trigger={
                      <button
                        type="button"
                        className="flex items-center gap-1 text-[11px] font-medium text-[var(--wick-muted)] hover:text-[var(--wick-ink)] transition-colors"
                      >
                        <span>{node.role || 'Free Space'}</span>
                        <ChevronDown className="w-3 h-3 opacity-60" />
                      </button>
                    }
                  />

                  <div className="flex items-center gap-1">
                    {/* Tone switchers */}
                    {(['neutral', 'amber', 'violet'] as MindstormCardTone[]).map((tone) => (
                      <button
                        key={tone}
                        type="button"
                        aria-label={`Set card tone ${tone}`}
                        onClick={() => updateNode(node.id, { tone })}
                        className={`w-2.5 h-2.5 rounded-full transition-transform ${
                          node.tone === tone ? 'scale-125 ring-1 ring-[var(--wick-ink)]' : 'opacity-50 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor:
                            tone === 'amber'
                              ? 'var(--wick-amber)'
                              : tone === 'violet'
                                ? 'var(--wick-violet)'
                                : 'var(--wick-muted)',
                        }}
                      />
                    ))}

                    <WickTooltip content={isConnecting ? 'Cancel link' : 'Connect card'} placement="above">
                      <button
                        type="button"
                        aria-label="Connect card"
                        onClick={() => toggleConnection(node.id)}
                        className={`p-1 rounded hover:bg-[var(--color-overlay-hover)] transition-colors ${
                          isConnecting ? 'text-[var(--wick-violet)]' : 'text-[var(--wick-muted)] hover:text-[var(--wick-ink)]'
                        }`}
                      >
                        {isConnecting ? <Unlink className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                      </button>
                    </WickTooltip>

                    <button
                      type="button"
                      aria-label="Delete card"
                      onClick={() => deleteNode(node.id)}
                      className="p-1 rounded text-[var(--wick-muted)] hover:text-red-400 hover:bg-[var(--color-overlay-hover)] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Free-Space Editable Title & Body */}
                <input
                  type="text"
                  dir="auto"
                  value={node.title}
                  onChange={(e) => updateNode(node.id, { title: e.target.value })}
                  placeholder="Idea heading..."
                  className="w-full bg-transparent border-0 outline-none text-sm font-semibold text-[var(--wick-ink)] placeholder:text-[var(--wick-subtle)] mb-1.5"
                />
                <textarea
                  dir="auto"
                  value={node.body}
                  onChange={(e) => updateNode(node.id, { body: e.target.value })}
                  placeholder="Type anything freely—character notes, fragments, dialogue, questions..."
                  rows={3}
                  className="w-full bg-transparent border-0 outline-none resize-none text-xs leading-relaxed text-[var(--wick-muted)] focus:text-[var(--wick-ink)] placeholder:text-[var(--wick-subtle)]"
                />
              </div>
            );
          })}
        </div>

        {/* Quiet Bottom Hint */}
        <div className="pointer-events-none absolute bottom-4 left-4 text-xs text-[var(--wick-subtle)]">
          Double-click anywhere to drop a free-space card · Drag background to pan · Click a thread to unlink
        </div>
      </div>

      {/* Custom Role Dialog */}
      <WickModal
        isOpen={Boolean(customRoleNode)}
        onClose={() => setCustomRoleNode(null)}
        title="Choose Card Role"
        width={380}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <WickButton label="Cancel" variant="ghost" onClick={() => setCustomRoleNode(null)} />
            <WickButton
              label="Apply Role"
              variant="primary"
              onClick={() => {
                if (customRoleNode) {
                  updateNode(customRoleNode.id, { role: customRoleInput.trim() || 'Free Space' });
                }
                setCustomRoleNode(null);
              }}
            />
          </div>
        }
      >
        <input
          type="text"
          value={customRoleInput}
          onChange={(e) => setCustomRoleInput(e.target.value)}
          placeholder="e.g. Subplot, Climax, Motif, Research..."
          autoFocus
          className="w-full px-3 py-2 rounded-lg border border-[var(--wick-border-strong)] bg-[var(--wick-surface)] text-sm text-[var(--wick-ink)] outline-none focus:border-[var(--wick-amber)]"
        />
      </WickModal>

      {/* Send Ideas to Write Dialog */}
      <WickModal
        isOpen={Boolean(sendModalNodes)}
        onClose={() => setSendModalNodes(null)}
        title="Send Ideas to Write"
        width={420}
      >
        <p className="text-sm text-[var(--wick-muted)] mb-4">
          Start a fresh document from {sendModalNodes?.length === 1 ? 'this card' : 'these cards'}, or
          append into an existing manuscript.
        </p>
        <div className="space-y-2">
          <WickButton
            label="Create New Document"
            variant="primary"
            width="100%"
            onClick={() => {
              if (sendModalNodes) void sendNodesToWrite(sendModalNodes);
              setSendModalNodes(null);
            }}
          />
          {works.length > 0 && (
            <div className="pt-3 mt-3 border-t border-[var(--wick-border)] space-y-1.5 max-h-56 overflow-y-auto">
              <div className="text-xs text-[var(--wick-muted)] mb-2">Or append to existing file:</div>
              {works.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    if (sendModalNodes) void sendNodesToWrite(sendModalNodes, w.id);
                    setSendModalNodes(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-[var(--wick-ink)] hover:bg-[var(--color-overlay-hover)] transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{w.title}</span>
                  <span className="text-xs text-[var(--wick-muted)]">
                    {w.kind === 'book' ? 'Add chapter' : 'Append'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </WickModal>

      <ConfirmDeleteModal
        isOpen={showDeleteBoard}
        itemType="Board"
        itemName={board.title}
        warningDetail={`Includes ${board.nodes.length} mindstorm ideas.`}
        onConfirm={() => deleteBoard(board.id)}
        onClose={() => setShowDeleteBoard(false)}
      />
    </div>
  );
}
