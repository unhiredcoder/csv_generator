
import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaGripVertical, FaTrash, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';

function SortableField({ field, availableTypes, onUpdate, onRemove, isEditing, onToggleEdit }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [localName, setLocalName] = React.useState(field.name);
  const [localType, setLocalType] = React.useState(field.type);

  const handleSave = () => {
    onUpdate(field.id, { name: localName, type: localType });
    onToggleEdit(field.id);
  };

  const handleCancel = () => {
    setLocalName(field.name);
    setLocalType(field.type);
    onToggleEdit(field.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border border-gray-200 rounded-lg p-4 mb-3 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div {...attributes} {...listeners} className="cursor-move text-gray-400 hover:text-gray-600">
            <FaGripVertical />
          </div>
          
          {isEditing ? (
            <>
              <input
                type="text"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded"
                placeholder="Field name"
              />
              <select
                value={localType}
                onChange={(e) => setLocalType(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded"
              >
                {availableTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <div className="flex space-x-2">
                <button
                  onClick={handleSave}
                  className="p-1 text-green-600 hover:text-green-800"
                >
                  <FaCheck />
                </button>
                <button
                  onClick={handleCancel}
                  className="p-1 text-red-600 hover:text-red-800"
                >
                  <FaTimes />
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="font-medium text-gray-800">{field.name}</div>
                <div className="text-sm text-gray-500 capitalize">{field.type}</div>
              </div>
              <button
                onClick={() => onToggleEdit(field.id)}
                className="p-1 text-blue-600 hover:text-blue-800"
              >
                <FaEdit />
              </button>
            </>
          )}
        </div>
        
        <button
          onClick={() => onRemove(field.id)}
          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
        >
          <FaTrash />
        </button>
      </div>
    </div>
  );
}

function FieldManager({ fields, availableTypes, onAddField, onRemoveField, onUpdateField, onReorderFields }) {
  const [editingField, setEditingField] = React.useState(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = fields.findIndex((field) => field.id === active.id);
      const newIndex = fields.findIndex((field) => field.id === over.id);
      const newOrder = arrayMove(fields, oldIndex, newIndex);
      onReorderFields(newOrder);
    }
  };

  const toggleEdit = (fieldId) => {
    setEditingField(editingField === fieldId ? null : fieldId);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Field Configuration</h2>
        <button
          onClick={onAddField}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          + Add Field
        </button>
      </div>

      <p className="text-gray-600 mb-6">
        Drag and drop to reorder fields. Click the edit icon to modify field name and type.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={fields.map(f => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {fields.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No fields configured. Add your first field!</p>
              </div>
            ) : (
              fields.map((field) => (
                <SortableField
                  key={field.id}
                  field={field}
                  availableTypes={availableTypes}
                  onUpdate={onUpdateField}
                  onRemove={onRemoveField}
                  isEditing={editingField === field.id}
                  onToggleEdit={toggleEdit}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="font-medium text-gray-700 mb-3">Available Field Types</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {availableTypes.map(type => (
            <div key={type.value} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              <div className="font-medium">{type.label}</div>
              <div className="text-xs text-gray-500">{type.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FieldManager;