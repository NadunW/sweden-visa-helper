#!/usr/bin/env node
// Checks that package.json carries a valid X.Y.Z version that is ready to release:
//  - format is MAJOR.MINOR.PATCH
//  - not lower than the base branch's version
//  - no git tag vX.Y.Z exists yet (so every merge to main produces a new release)
// Usage: BASE_VERSION=1.2.3 EXISTING_TAGS="v1.0.0 v1.2.3" node scripts/check-version.js
const { version } = require('../package.json');

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const parse = v => v.match(SEMVER).slice(1).map(Number);
const compare = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

function check(current, base, tags) {
  if (!SEMVER.test(current)) return `package.json version "${current}" is not in X.Y.Z format.`;
  if (base && SEMVER.test(base) && compare(current, base) < 0) return `Version ${current} is lower than the base branch's ${base}.`;
  if (tags.includes(`v${current}`)) return `Tag v${current} already exists. Bump the version: npm run bump:patch (or bump:minor / bump:major).`;
  return null;
}

if (require.main === module) {
  const tags = (process.env.EXISTING_TAGS || '').split(/\s+/).filter(Boolean);
  const err = check(version, process.env.BASE_VERSION || '', tags);
  if (err) { console.error(`::error::${err}`); process.exit(1); }
  console.log(`Version ${version} is ready to release as v${version}.`);
}

module.exports = { check, compare };
