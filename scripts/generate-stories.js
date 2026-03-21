#!/usr/bin/env node

/**
 * Auto-generate Storybook stories from React components
 *
 * Usage: node scripts/generate-stories.js
 *
 * This script:
 * 1. Scans src/ui/components for React components
 * 2. Generates basic stories for components without stories
 * 3. Updates existing stories with new exports/props
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const COMPONENTS_DIR = path.join(ROOT_DIR, 'src/ui/components');
const STORIES_DIR = path.join(ROOT_DIR, 'src/ui/stories');

// Components to skip (utilities, contexts, etc.)
const SKIP_PATTERNS = [
  'Icons.tsx',
  'ResizeHandles.tsx',
  /Context\.tsx$/,
  /\.test\.tsx$/,
  /\.spec\.tsx$/,
];

// Extract component info from file
function extractComponentInfo(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath, '.tsx');

  // Find exported components
  const componentMatches = content.matchAll(/export\s+(?:function|const)\s+(\w+)/g);
  const components = [...componentMatches].map(m => m[1]);

  // Find props interface
  const propsMatch = content.match(/interface\s+(\w+Props)\s*\{([^}]+)\}/s);
  const props = propsMatch ? extractProps(propsMatch[2]) : [];

  return {
    fileName,
    filePath,
    components,
    props,
    hasDefaultExport: content.includes('export default'),
  };
}

function extractProps(propsString) {
  const props = [];
  const lines = propsString.split('\n');

  for (const line of lines) {
    const match = line.trim().match(/(\w+)(\?)?:\s*(.+?);/);
    if (match) {
      const [, name, optional, type] = match;
      props.push({
        name,
        optional: !!optional,
        type: type.trim(),
      });
    }
  }

  return props;
}

function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some(pattern => {
    if (typeof pattern === 'string') {
      return filePath.endsWith(pattern);
    }
    return pattern.test(filePath);
  });
}

function getAllComponentFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllComponentFiles(filePath, fileList);
    } else if (file.endsWith('.tsx') && !shouldSkipFile(filePath)) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function generateStoryTemplate(componentInfo) {
  const { fileName, components, props, filePath } = componentInfo;
  const mainComponent = components[0] || fileName;
  const relativePath = path.relative(COMPONENTS_DIR, filePath).replace(/\\/g, '/');
  const importPath = `../components/${relativePath.replace('.tsx', '')}`;

  // Determine category from path
  const pathParts = relativePath.split('/');
  const category = pathParts.length > 1 ? pathParts[0] : 'Components';

  // Generate mock props
  const mockProps = props.map(prop => {
    let value;
    if (prop.type.includes('string')) value = `'Sample ${prop.name}'`;
    else if (prop.type.includes('number')) value = '42';
    else if (prop.type.includes('boolean')) value = 'true';
    else if (prop.type.includes('() =>')) value = '() => console.log("Action")';
    else value = '{}';

    return `    ${prop.name}: ${value},`;
  }).join('\n');

  return `import type { Meta, StoryObj } from '@storybook/react-vite';
import { ${mainComponent} } from '${importPath}';

const meta = {
  title: '${category}/${fileName}',
  component: ${mainComponent},
  tags: ['autodocs'],
  argTypes: {
    // Add custom controls here
  },
} satisfies Meta<typeof ${mainComponent}>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
${mockProps}
  },
};

// TODO: Add more story variants
// export const Variant1: Story = {
//   args: {
//     ...Default.args,
//   },
// };
`;
}

function getStoryFilePath(componentInfo) {
  const storyFileName = `${componentInfo.fileName}.stories.tsx`;
  return path.join(STORIES_DIR, storyFileName);
}

function updateExistingStory(storyPath, componentInfo) {
  const content = fs.readFileSync(storyPath, 'utf8');

  // Check if it's an auto-generated story (has TODO comment)
  if (!content.includes('// TODO: Add more story variants')) {
    return false; // Don't update manually created stories
  }

  // Update import path if needed
  const { fileName, filePath } = componentInfo;
  const relativePath = path.relative(COMPONENTS_DIR, filePath).replace(/\\/g, '/');
  const newImportPath = `../components/${relativePath.replace('.tsx', '')}`;

  // Only update if import path changed (component moved)
  const currentImportMatch = content.match(/from ['"](.+)['"]/);
  if (currentImportMatch && currentImportMatch[1] !== newImportPath) {
    const updatedContent = content.replace(
      /from ['"].+['"]/,
      `from '${newImportPath}'`
    );
    fs.writeFileSync(storyPath, updatedContent);
    return true;
  }

  return false;
}

function main() {
  console.log('🔍 Scanning for components...\n');

  const componentFiles = getAllComponentFiles(COMPONENTS_DIR);
  console.log(`Found ${componentFiles.length} component files\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const componentFile of componentFiles) {
    try {
      const componentInfo = extractComponentInfo(componentFile);

      if (componentInfo.components.length === 0) {
        console.log(`⏭️  Skipping ${componentInfo.fileName} (no exports found)`);
        skipped++;
        continue;
      }

      const storyPath = getStoryFilePath(componentInfo);

      if (fs.existsSync(storyPath)) {
        // Try to update existing auto-generated story
        if (updateExistingStory(storyPath, componentInfo)) {
          console.log(`🔄 Updated ${componentInfo.fileName}.stories.tsx`);
          updated++;
        } else {
          console.log(`✓  ${componentInfo.fileName}.stories.tsx already exists`);
          skipped++;
        }
        continue;
      }

      const storyContent = generateStoryTemplate(componentInfo);
      fs.writeFileSync(storyPath, storyContent);

      console.log(`✨ Created ${componentInfo.fileName}.stories.tsx`);
      created++;

    } catch (error) {
      console.error(`❌ Error processing ${componentFile}:`, error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total:   ${componentFiles.length}`);

  if (created > 0 || updated > 0) {
    console.log(`\n✅ Generated ${created} new story files${updated > 0 ? ` and updated ${updated}` : ''}!`);
    console.log(`   Review them in: ${STORIES_DIR}`);
    console.log(`   Run: npm run storybook to view`);
  }
}

main();
