// Color reference modal component

import React, { useState, useEffect, useMemo } from 'react';
import { useModalContext } from './ModalContext';
import { useAppContext } from '../../context/AppContext';
import { Search } from '../common/Search';
import { TextButton } from '../common/Button';
import { GroupedList, GroupedListSection } from '../common/GroupedList';
import { ColorSwatch } from '../common/ColorSwatch';
import { ModalOverlay, ModalContainer, ModalHeader, ModalBody, ModalFooter } from './Modal';

export function ColorReferenceModal() {
  const { modals, closeColorReference } = useModalContext();
  const { variables } = useAppContext();
  const config = modals.colorReference;
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (config) {
      setSearchQuery('');
    }
  }, [config]);

  const colorVariables = useMemo(() => {
    if (!config) return [];
    return variables.filter(v =>
      v.resolvedType === 'COLOR' && v.id !== (config.currentVariableId || '')
    );
  }, [variables, config]);

  const { grouped, ungrouped, sortedGroups } = useMemo(() => {
    const grouped: Record<string, typeof colorVariables> = {};
    const ungrouped: typeof colorVariables = [];

    colorVariables.forEach(v => {
      const parts = v.name.split('/');
      if (parts.length > 1) {
        const groupName = parts.slice(0, -1).join('/');
        if (!grouped[groupName]) grouped[groupName] = [];
        grouped[groupName].push(v);
      } else {
        ungrouped.push(v);
      }
    });

    return { grouped, ungrouped, sortedGroups: Object.keys(grouped).sort() };
  }, [colorVariables]);

  const getDisplayColor = (v: typeof colorVariables[0]) => {
    const refMatch = v.value.match(/^\{(.+)\}$/);
    if (refMatch) {
      const refVariable = variables.find(rv => rv.name === refMatch[1]);
      if (refVariable?.resolvedType === 'COLOR') {
        return refVariable.value;
      }
      return '#888888';
    }
    return v.value;
  };

  const matchesSearch = (name: string) => {
    if (!searchQuery) return true;
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const handleSelect = (variable: typeof colorVariables[0]) => {
    if (config?.onConfirm) {
      config.onConfirm(variable.id);
    } else if (config?.onSelect) {
      config.onSelect(variable.name);
    }
    closeColorReference();
  };

  const handleEnter = () => {
    const firstMatch = [...ungrouped, ...sortedGroups.flatMap(g => grouped[g])]
      .find(v => matchesSearch(v.name));
    if (firstMatch) {
      handleSelect(firstMatch);
    }
  };

  const sections = useMemo((): GroupedListSection[] => {
    const currentRefMatch = config?.currentValue?.match(/^\{(.+)\}$/);
    const currentRefName = currentRefMatch?.[1];

    const result: GroupedListSection[] = [];

    // Add ungrouped variables section
    const ungroupedFiltered = ungrouped.filter(v => matchesSearch(v.name));
    if (ungroupedFiltered.length > 0 && sortedGroups.length > 0) {
      result.push({
        title: 'Variables',
        items: ungroupedFiltered.map(v => ({
          id: v.id,
          label: v.name,
          icon: <ColorSwatch color={getDisplayColor(v)} />,
          isActive: v.name === currentRefName,
          _data: v,
        })),
      });
    }

    // Add grouped sections
    sortedGroups.forEach(groupName => {
      const groupVars = grouped[groupName].filter(v => matchesSearch(v.name));
      if (groupVars.length > 0) {
        result.push({
          title: groupName,
          items: groupVars.map(v => ({
            id: v.id,
            label: v.name.split('/').pop() || v.name,
            icon: <ColorSwatch color={getDisplayColor(v)} />,
            isActive: v.name === currentRefName,
            _data: v,
          })),
        });
      }
    });

    // If no groups, add ungrouped as single section without title
    if (result.length === 0 && ungroupedFiltered.length > 0) {
      result.push({
        title: '',
        items: ungroupedFiltered.map(v => ({
          id: v.id,
          label: v.name,
          icon: <ColorSwatch color={getDisplayColor(v)} />,
          isActive: v.name === currentRefName,
          _data: v,
        })),
      });
    }

    return result;
  }, [config, ungrouped, sortedGroups, grouped, searchQuery, variables]);

  if (!config) return null;

  return (
    <ModalOverlay isOpen={!!config} onClose={closeColorReference}>
      <ModalContainer width={360}>
        <ModalHeader title="Reference Color" onClose={closeColorReference} />
        <ModalBody>
          <Search
            value={searchQuery}
            onChange={setSearchQuery}
            onEnter={handleEnter}
            placeholder="Search colors..."
            autoFocus
            fullWidth={true}
            className="mb-4"
          />
          <GroupedList
            sections={sections}
            onItemClick={(item: any) => handleSelect(item._data)}
          />
        </ModalBody>
        <ModalFooter>
          <TextButton onClick={closeColorReference}>Cancel</TextButton>
        </ModalFooter>
      </ModalContainer>
    </ModalOverlay>
  );
}
