'use client';

import { useState } from 'react';
import { Plus, Pencil, ToggleLeft, ToggleRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MANAGED_LIST_CONFIG } from '@/types';
import type { ManagedListName, ManagedListItem } from '@/types';

const LIST_NAMES: ManagedListName[] = [
  'serviceTypes',
  'sectors',
  'geographies',
  'titleBands',
  'companySizes',
  'therapyAreas',
];

interface ListData {
  items: ManagedListItem[];
  updatedAt: string | null;
  updatedBy: string | null;
}

/**
 * Slugify a label to create a stable ID.
 */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Single list panel — shows items table with add/edit/toggle actions.
 */
function ListPanel({
  listName,
  data,
  onSave,
}: {
  listName: ManagedListName;
  data: ListData;
  onSave: (listName: ManagedListName, items: ManagedListItem[]) => Promise<void>;
}) {
  const config = MANAGED_LIST_CONFIG[listName];
  const [items, setItems] = useState<ManagedListItem[]>(data.items);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newOrientation, setNewOrientation] = useState<'internal' | 'external' | 'mixed'>('external');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editOrientation, setEditOrientation] = useState<'internal' | 'external' | 'mixed'>('external');
  const [saveMessage, setSaveMessage] = useState('');

  const sortedItems = [...items].sort((a, b) => a.label.localeCompare(b.label));

  function handleAddItem() {
    if (!newLabel.trim()) return;

    const id = slugify(newLabel);
    if (items.some((i) => i.id === id)) {
      alert('An item with this ID already exists.');
      return;
    }

    const newItem: ManagedListItem = {
      id,
      label: newLabel.trim(),
      active: true,
    };
    if (config.hasOrientation) {
      newItem.orientation = newOrientation;
    }

    setItems([...items, newItem]);
    setNewLabel('');
    setNewOrientation('external');
    setAddingNew(false);
    setDirty(true);
  }

  function handleToggleActive(id: string) {
    setItems(items.map((i) => (i.id === id ? { ...i, active: !i.active } : i)));
    setDirty(true);
  }

  function startEdit(item: ManagedListItem) {
    setEditingId(item.id);
    setEditLabel(item.label);
    setEditOrientation(item.orientation || 'external');
  }

  function handleSaveEdit() {
    if (!editLabel.trim() || !editingId) return;
    setItems(
      items.map((i) =>
        i.id === editingId
          ? {
              ...i,
              label: editLabel.trim(),
              ...(config.hasOrientation ? { orientation: editOrientation } : {}),
            }
          : i
      )
    );
    setEditingId(null);
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveMessage('');
    try {
      await onSave(listName, items);
      setDirty(false);
      setSaveMessage('Saved ✓');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveMessage('Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{config.label}</CardTitle>
            <CardDescription>{config.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {saveMessage && (
              <span className={`text-sm ${saveMessage.includes('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {saveMessage}
              </span>
            )}
            {dirty && (
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>
        {data.updatedAt && (
          <p className="text-xs text-[var(--muted)]">
            Last updated: {new Date(data.updatedAt).toLocaleString('en-GB')}
            {data.updatedBy ? ` by ${data.updatedBy}` : ''}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {/* Items table */}
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  ID
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Label
                </th>
                {config.hasOrientation && (
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Orientation
                  </th>
                )}
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Status
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {sortedItems.map((item) => (
                <tr key={item.id} className={!item.active ? 'opacity-50' : ''}>
                  <td className="px-4 py-2 text-xs font-mono text-[var(--muted)]">
                    {item.id}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {editingId === item.id ? (
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="h-7 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      />
                    ) : (
                      item.label
                    )}
                  </td>
                  {config.hasOrientation && (
                    <td className="px-4 py-2 text-sm">
                      {editingId === item.id ? (
                        <select
                          value={editOrientation}
                          onChange={(e) => setEditOrientation(e.target.value as 'internal' | 'external' | 'mixed')}
                          className="h-7 rounded border border-gray-300 text-xs px-1"
                        >
                          <option value="external">External</option>
                          <option value="internal">Internal</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.orientation === 'external'
                              ? 'bg-blue-50 text-blue-700'
                              : item.orientation === 'internal'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {item.orientation || '—'}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2 text-sm">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {item.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === item.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleSaveEdit}
                            title="Save edit"
                          >
                            <Check className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingId(null)}
                            title="Cancel edit"
                          >
                            <X className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEdit(item)}
                            title="Edit label"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleToggleActive(item.id)}
                            title={item.active ? 'Deactivate' : 'Reactivate'}
                          >
                            {item.active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-red-500" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {sortedItems.length === 0 && (
                <tr>
                  <td
                    colSpan={config.hasOrientation ? 5 : 4}
                    className="px-4 py-6 text-center text-sm text-[var(--muted)]"
                  >
                    No items yet. Click &quot;Add Item&quot; to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add new item */}
        {addingNew ? (
          <div className="mt-3 flex items-center gap-2">
            <Input
              placeholder="Enter label..."
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
              autoFocus
            />
            {config.hasOrientation && (
              <select
                value={newOrientation}
                onChange={(e) => setNewOrientation(e.target.value as 'internal' | 'external' | 'mixed')}
                className="h-8 rounded border border-gray-300 text-xs px-2"
              >
                <option value="external">External</option>
                <option value="internal">Internal</option>
                <option value="mixed">Mixed</option>
              </select>
            )}
            <Button size="sm" onClick={handleAddItem}>
              Add
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAddingNew(false);
                setNewLabel('');
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setAddingNew(true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Item
          </Button>
        )}

        <p className="mt-2 text-xs text-[var(--muted)]">
          {items.length} items ({items.filter((i) => i.active).length} active)
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * ManagedListsClient — the main client component for the admin page.
 * Shows tabs for each managed list type.
 */
export function ManagedListsClient({
  initialData,
}: {
  initialData: Record<string, ListData>;
}) {
  const [activeTab, setActiveTab] = useState<ManagedListName>('serviceTypes');
  const [data, setData] = useState(initialData);

  async function handleSave(listName: ManagedListName, items: ManagedListItem[]) {
    const res = await fetch(`/api/managed-lists/${listName}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Save failed');
    }

    // Update local state
    setData((prev) => ({
      ...prev,
      [listName]: {
        ...prev[listName],
        items,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">
          Managed Lists
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Configure the dropdown values used across campaign forms. Changes take effect immediately.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
        {LIST_NAMES.map((name) => (
          <button
            key={name}
            onClick={() => setActiveTab(name)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === name
                ? 'bg-white text-[var(--primary)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {MANAGED_LIST_CONFIG[name].label}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <ListPanel
        key={activeTab}
        listName={activeTab}
        data={data[activeTab] || { items: [], updatedAt: null, updatedBy: null }}
        onSave={handleSave}
      />
    </div>
  );
}
