// Hook to organize variables into groups and calculate connections

import { useMemo } from 'react';
import { VariableData } from '../../types';
import { GroupData, VariableNode, Connection } from './types';
import { parseColorToRgb, rgbObjToHex } from '../../utils/color';

const GROUP_WIDTH = 220;
const GROUP_GAP = 120;
const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 36;
const GROUP_PADDING = 8;

export function useGroupedData(
  variables: VariableData[],
  selectedCollectionId: string | null
) {
  return useMemo(() => {
    // Filter to color variables in selected collection
    const colorVars = variables.filter(
      v => v.collectionId === selectedCollectionId && v.resolvedType === 'COLOR'
    );

    // Reference pattern
    const refPattern = /^\{(.+)\}$/;

    // Group variables by their group name (part before last /)
    const groupMap = new Map<string, VariableNode[]>();

    colorVars.forEach(v => {
      const parts = v.name.split('/');
      const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Ungrouped';
      const displayName = parts[parts.length - 1];

      // Check if it's a reference
      const refMatch = v.value.match(refPattern);
      const isReference = !!refMatch;
      const referenceName = refMatch ? refMatch[1] : null;

      // Get display color
      let displayColor = v.value;
      if (isReference && referenceName) {
        const refVar = colorVars.find(cv => cv.name === referenceName);
        if (refVar) {
          displayColor = refVar.value;
        }
      }

      // Parse to hex
      const rgb = parseColorToRgb(displayColor);
      const hexColor = rgb ? rgbObjToHex(rgb) : '#888888';

      const node: VariableNode = {
        id: v.id,
        name: v.name,
        displayName: isReference ? `{${referenceName}}` : hexColor.toUpperCase(),
        color: hexColor,
        value: v.value,
        isReference,
        referenceName,
      };

      const group = groupMap.get(groupName) || [];
      group.push(node);
      groupMap.set(groupName, group);
    });

    // Convert to array and calculate positions
    // Separate groups: source groups (no references) vs referencing groups
    const sourceGroups: GroupData[] = [];
    const refGroups: GroupData[] = [];

    groupMap.forEach((vars, name) => {
      const hasReferences = vars.some(v => v.isReference);
      const group: GroupData = {
        name,
        variables: vars,
        x: 0,
        y: 0,
      };

      if (hasReferences) {
        refGroups.push(group);
      } else {
        sourceGroups.push(group);
      }
    });

    // Sort groups alphabetically
    sourceGroups.sort((a, b) => a.name.localeCompare(b.name));
    refGroups.sort((a, b) => a.name.localeCompare(b.name));

    // Position source groups on the left
    let yOffset = 20;
    sourceGroups.forEach(group => {
      group.x = 20;
      group.y = yOffset;
      const groupHeight = HEADER_HEIGHT + group.variables.length * ROW_HEIGHT + GROUP_PADDING * 2;
      yOffset += groupHeight + 20;
    });

    // Position referencing groups on the right
    yOffset = 20;
    refGroups.forEach(group => {
      group.x = 20 + GROUP_WIDTH + GROUP_GAP;
      group.y = yOffset;
      const groupHeight = HEADER_HEIGHT + group.variables.length * ROW_HEIGHT + GROUP_PADDING * 2;
      yOffset += groupHeight + 20;
    });

    // Combine groups
    const groups = [...sourceGroups, ...refGroups];

    // Build connections
    const connections: Connection[] = [];
    const nameToGroupVar = new Map<string, { groupIndex: number; varIndex: number }>();

    // Map all variable names to their positions
    groups.forEach((group, groupIndex) => {
      group.variables.forEach((v, varIndex) => {
        nameToGroupVar.set(v.name, { groupIndex, varIndex });
      });
    });

    // Create connections for references
    groups.forEach((group, groupIndex) => {
      group.variables.forEach((v, varIndex) => {
        if (v.isReference && v.referenceName) {
          const target = nameToGroupVar.get(v.referenceName);
          if (target) {
            connections.push({
              id: `${v.id}->${v.referenceName}`,
              fromGroupIndex: groupIndex,
              fromVarIndex: varIndex,
              toGroupIndex: target.groupIndex,
              toVarIndex: target.varIndex,
            });
          }
        }
      });
    });

    return { groups, connections, ROW_HEIGHT, HEADER_HEIGHT, GROUP_PADDING };
  }, [variables, selectedCollectionId]);
}
