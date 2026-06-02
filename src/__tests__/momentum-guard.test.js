const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');

describe('MomentumUI guard rails', () => {
  test('required momentum packages are declared in package.json', () => {
    const packageJsonPath = path.join(repoRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencies = packageJson.dependencies || {};

    expect(dependencies['@momentum-ui/react']).toBeDefined();
    expect(dependencies['@momentum-ui/core']).toBeDefined();
    expect(dependencies['@momentum-ui/icons']).toBeDefined();
  });

  test('momentum icon font asset exists in node_modules', () => {
    const woff2Path = path.join(
      repoRoot,
      'node_modules',
      '@momentum-ui',
      'icons',
      'fonts',
      'momentum-ui-icons.woff2',
    );

    expect(fs.existsSync(woff2Path)).toBe(true);
  });

  test('build script still runs inline-font processing for momentum icons', () => {
    const packageJsonPath = path.join(repoRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    expect(packageJson.scripts.build).toContain('inline-fonts.js');
    expect(packageJson.scripts['build:standalone']).toContain('inline-fonts.js');
  });

  test('momentum primitive wrapper layer exists', () => {
    const wrapperPath = path.join(repoRoot, 'src', 'ui', 'momentumPrimitives.jsx');
    expect(fs.existsSync(wrapperPath)).toBe(true);

    const source = fs.readFileSync(wrapperPath, 'utf8');
    expect(source).toContain('MomentumCard');
    expect(source).toContain('MomentumSelect');
    expect(source).toContain('CardSection');
  });
});
