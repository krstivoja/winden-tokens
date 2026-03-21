import type {
  CollectionData,
  ShadeCurveHandles,
  ShadeGeneratorConfig,
  ShadeGroupData,
  VariableData,
} from '../types';

const basicCollectionId = 'collection-basic';
const responsiveCollectionId = 'collection-responsive';
const basicModeId = 'mode-basic-default';
const desktopModeId = 'mode-responsive-desktop';
const mobileModeId = 'mode-responsive-mobile';

function createBasicVariable(
  id: string,
  name: string,
  resolvedType: VariableData['resolvedType'],
  value: string
): VariableData {
  return {
    id,
    collectionId: basicCollectionId,
    name,
    resolvedType,
    value,
    valuesByMode: {
      [basicModeId]: value,
    },
  };
}

function createResponsiveFloat(
  id: string,
  name: string,
  desktopValue: string,
  mobileValue: string
): VariableData {
  return {
    id,
    collectionId: responsiveCollectionId,
    name,
    resolvedType: 'FLOAT',
    value: desktopValue,
    valuesByMode: {
      [desktopModeId]: desktopValue,
      [mobileModeId]: mobileValue,
    },
  };
}

function createCurve(value: number): ShadeCurveHandles {
  return {
    startValue: value,
    leftHandle1: { t: 0.2, value },
    leftHandle2: { t: 0.35, value },
    rightHandle1: { t: 0.65, value },
    rightHandle2: { t: 0.8, value },
    endValue: value,
  };
}

function createShadeGeneratorConfig(
  sourceVariableId: string,
  sourceName: string,
  sourceValue: string,
  generatedShades: Array<{ id: string; name: string; value: string }>
): ShadeGeneratorConfig {
  return {
    version: 1,
    sourceVariableId,
    sourceName,
    sourceValue,
    shadeCount: generatedShades.length,
    baseIndex: 3,
    lightValue: 0.95,
    darkValue: 0.19,
    lightnessCurve: createCurve(0.5),
    saturationCurve: createCurve(0.5),
    hueCurve: createCurve(0),
    generatedShades,
    updatedAt: '2026-03-21T10:00:00.000Z',
  };
}

const primaryShadeValues = [
  ['50', '#FDDBF5'],
  ['100', '#F9B9EB'],
  ['200', '#F69CE2'],
  ['300', '#F374D6'],
  ['400', '#C55AAC'],
  ['500', '#9E3F88'],
  ['600', '#7D2769'],
  ['700', '#611450'],
  ['800', '#4B063B'],
  ['900', '#3A002D'],
  ['950', '#310026'],
] as const;

const secondaryShadeValues = [
  ['50', '#EBFCF5'],
  ['100', '#D1F8E9'],
  ['200', '#B5F4DC'],
  ['300', '#93EFCC'],
  ['400', '#68E9B8'],
  ['500', '#37E2A1'],
  ['600', '#00DA87'],
  ['700', '#00A566'],
  ['800', '#006D44'],
  ['900', '#003F27'],
  ['950', '#001E12'],
] as const;

const primaryShadeVariables = primaryShadeValues.map(([step, value]) =>
  createBasicVariable(`var-primary-${step}`, `primary/${step}`, 'COLOR', value)
);

const secondaryShadeVariables = secondaryShadeValues.map(([step, value]) =>
  createBasicVariable(`var-secondary-${step}`, `secondary/${step}`, 'COLOR', value)
);

const primarySourceVariable = createBasicVariable('var-primary', 'primary', 'COLOR', '#F374D6');
const secondarySourceVariable = createBasicVariable('var-secondary', 'secondary', 'COLOR', '#00DA87');

export const mockCollections: CollectionData[] = [
  {
    id: basicCollectionId,
    name: 'basic',
    modes: [{ modeId: basicModeId, name: 'Default' }],
  },
  {
    id: responsiveCollectionId,
    name: 'responsive',
    modes: [
      { modeId: desktopModeId, name: 'Desktop' },
      { modeId: mobileModeId, name: 'Mobile' },
    ],
  },
];

export const mockVariables: VariableData[] = [
  createBasicVariable('var-white', 'white', 'COLOR', '#FFFFFF'),
  createBasicVariable('var-black', 'black', 'COLOR', '#000000'),
  primarySourceVariable,
  secondarySourceVariable,
  ...primaryShadeVariables,
  ...secondaryShadeVariables,
  createBasicVariable('var-marko-base', 'marko/base', 'COLOR', '{secondary/900}'),
  createBasicVariable('var-marko-2', 'marko/2', 'COLOR', '{primary/700}'),
  createBasicVariable('var-marko-34', 'marko/34', 'COLOR', '{secondary/100}'),
  createBasicVariable('var-spacing-xs', 'spacing/xs', 'FLOAT', '4'),
  createBasicVariable('var-spacing-sm', 'spacing/sm', 'FLOAT', '8'),
  createBasicVariable('var-spacing-base', 'spacing/base', 'FLOAT', '12'),
  createBasicVariable('var-spacing-md', 'spacing/md', 'FLOAT', '16'),
  createBasicVariable('var-spacing-lg', 'spacing/lg', 'FLOAT', '24'),
  createBasicVariable('var-font-size-xs', 'font-size/xs', 'FLOAT', '12'),
  createBasicVariable('var-font-size-sm', 'font-size/sm', 'FLOAT', '14'),
  createBasicVariable('var-font-size-md', 'font-size/md', 'FLOAT', '16'),
  createBasicVariable('var-font-size-lg', 'font-size/lg', 'FLOAT', '20'),
  createBasicVariable('var-font-family', 'FFamily', 'STRING', 'Gotu'),
  createBasicVariable('var-flags-grid', 'flags/show-grid', 'BOOLEAN', 'true'),
  createResponsiveFloat('var-screen-mobile', 'screen/mobile', '390', '390'),
  createResponsiveFloat('var-screen-tablet', 'screen/tablet', '768', '640'),
  createResponsiveFloat('var-screen-desktop', 'screen/desktop', '1440', '1024'),
];

export const mockShadeGroups: ShadeGroupData[] = [
  {
    sourceVariableId: primarySourceVariable.id,
    sourceVariableName: primarySourceVariable.name,
    collectionId: basicCollectionId,
    deleteIds: primaryShadeVariables.map(variable => variable.id),
    status: 'clean',
    dirtyReasons: [],
    config: createShadeGeneratorConfig(
      primarySourceVariable.id,
      primarySourceVariable.name,
      primarySourceVariable.value,
      primaryShadeVariables.map(variable => ({
        id: variable.id,
        name: variable.name,
        value: variable.value,
      }))
    ),
  },
  {
    sourceVariableId: secondarySourceVariable.id,
    sourceVariableName: secondarySourceVariable.name,
    collectionId: basicCollectionId,
    deleteIds: secondaryShadeVariables.map(variable => variable.id),
    status: 'clean',
    dirtyReasons: [],
    config: createShadeGeneratorConfig(
      secondarySourceVariable.id,
      secondarySourceVariable.name,
      secondarySourceVariable.value,
      secondaryShadeVariables.map(variable => ({
        id: variable.id,
        name: variable.name,
        value: variable.value,
      }))
    ),
  },
];

export interface StorybookSeed {
  collections: CollectionData[];
  variables: VariableData[];
  shadeGroups: ShadeGroupData[];
}
